import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { copyFileSync, readFileSync } from 'node:fs';
import { criarPdf, linhasDoFormulario } from './pdfs';

const REGRAS_WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function semViolacoes(page: Page) {
  const resultado = await new AxeBuilder({ page }).withTags(REGRAS_WCAG).analyze();
  expect(resultado.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

async function pdfsDoLote(pasta: (nome: string) => string) {
  const ok = await criarPdf(pasta('ok.pdf'), linhasDoFormulario({ nome: 'JOANA PEREIRA LIMA' }));
  const semCpf = await criarPdf(pasta('sem-cpf.pdf'), linhasDoFormulario({ nome: 'ANA SOUZA', cpf: '' }));
  const copia = pasta('copia-de-ok.pdf');
  copyFileSync(ok, copia);
  return { ok, semCpf, copia };
}

async function processar(page: Page, arquivos: string[]) {
  await page.locator('input[type=file][accept*="pdf"]').setInputFiles(arquivos);
  await page.getByRole('button', { name: /Processar arquivos/ }).click();
  await expect(page.getByRole('group', { name: 'Triagem por status' })).toBeVisible();
}

test('processa no navegador, sem requisições externas e sem violações de acessibilidade nos dois temas', async ({ page }, info) => {
  const externas: string[] = [];
  const problemas: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost:4173') && !/^(data|blob):/.test(r.url())) externas.push(r.url());
  });
  page.on('console', (m) => {
    if (m.type() === 'error') problemas.push(m.text());
  });
  const { ok, semCpf, copia } = await pdfsDoLote((nome) => info.outputPath(nome));

  await page.goto('/');
  await semViolacoes(page);
  await page.locator('input[type=file][accept*="pdf"]').setInputFiles([ok, semCpf, copia]);
  await expect(page.getByRole('status').filter({ hasText: 'repetido' })).toHaveText('1 arquivo repetido ignorado: copia-de-ok.pdf.');
  await page.getByRole('button', { name: /Processar arquivos/ }).click();
  await expect(page.getByRole('button', { name: '1 OK' })).toBeVisible();
  await expect(page.getByRole('button', { name: '1 REVISAR' })).toBeVisible();
  await expect(page.getByLabel('Nome de ok.pdf')).toHaveValue('JOANA PEREIRA LIMA');
  await semViolacoes(page);

  await page.getByRole('button', { name: 'Modo escuro' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await semViolacoes(page);

  expect(externas).toEqual([]);
  expect(problemas).toEqual([]);
});

test('Esc fecha o menu de filtro e o aviso de reprocessar, devolvendo o foco', async ({ page }, info) => {
  const { ok } = await pdfsDoLote((nome) => info.outputPath(nome));
  await page.goto('/');
  await processar(page, [ok]);

  await page.getByRole('button', { name: /^Município/ }).click();
  await expect(page.getByRole('group', { name: 'Município' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: 'Município' })).toBeHidden();
  await expect(page.getByRole('button', { name: /^Município/ })).toBeFocused();

  await page.getByRole('button', { name: /Processar arquivos/ }).click();
  await expect(page.getByRole('alertdialog', { name: 'Processar de novo?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(page.getByRole('button', { name: /Processar arquivos/ })).toBeFocused();
});

test('funciona num navegador sem as APIs posteriores ao Chrome 109', async ({ page }, info) => {
  const remover = [
    'delete Promise.withResolvers; delete Promise.try; delete URL.parse; delete URL.canParse;',
    'if (globalThis.AbortSignal) delete AbortSignal.any;',
    'delete Uint8Array.fromBase64; delete Uint8Array.prototype.toBase64; delete Math.sumPrecise;',
    'delete globalThis.Float16Array; delete Object.groupBy; delete Map.groupBy;',
  ].join(' ');
  await page.context().addInitScript({ content: remover });
  // O pdf.js roda num worker: remove as mesmas APIs lá dentro.
  await page.route(/\/assets\/worker-.*\.js$/, async (rota) => {
    const resposta = await rota.fetch();
    await rota.fulfill({ response: resposta, body: `${remover}\n${await resposta.text()}` });
  });
  const { ok, semCpf } = await pdfsDoLote((nome) => info.outputPath(nome));

  await page.goto('/');
  expect(await page.evaluate(() => typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers)).toBe('function');
  await processar(page, [ok, semCpf]);
  await expect(page.getByRole('button', { name: '1 OK' })).toBeVisible();
  await expect(page.getByLabel('Nome de ok.pdf')).toHaveValue('JOANA PEREIRA LIMA');
});

test('salvar e abrir o trabalho mantém edições e conferências', async ({ page }, info) => {
  const { ok } = await pdfsDoLote((nome) => info.outputPath(nome));
  await page.goto('/');
  await processar(page, [ok]);
  await page.getByRole('checkbox', { name: 'Recebe CMIC: ok.pdf' }).check();
  await page.getByLabel('Motivo de ok.pdf').fill('Motivo corrigido à mão');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Salvar trabalho' }).click()]);
  const arquivo = info.outputPath('trabalho.json');
  await download.saveAs(arquivo);
  expect(JSON.parse(readFileSync(arquivo, 'utf-8')).registros).toHaveLength(1);

  await page.getByRole('button', { name: 'Limpar dados' }).click();
  await expect(page.getByLabel('Motivo de ok.pdf')).toBeHidden();
  await page.getByLabel('Abrir trabalho').setInputFiles(arquivo);
  await expect(page.getByLabel('Motivo de ok.pdf')).toHaveValue('Motivo corrigido à mão');
  await expect(page.getByRole('checkbox', { name: 'Recebe CMIC: ok.pdf' })).toBeChecked();
});
