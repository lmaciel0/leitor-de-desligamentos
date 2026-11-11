import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { criarPdf, criarPdfEscaneado, linhasDoFormulario } from './pdfs';

const ORIGEM = 'http://localhost:4173';
const REGRAS_WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const NOME = 'MARIA ESCANEADA SILVA';

// OCR de verdade (tesseract.js) no navegador: o primeiro arquivo ainda carrega o modelo.
test.setTimeout(120_000);

async function semViolacoes(page: Page) {
  const resultado = await new AxeBuilder({ page }).withTags(REGRAS_WCAG).analyze();
  expect(resultado.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

/** Desenha o formulário sintético num canvas do navegador e devolve o PNG (fundo branco, fonte grande). */
async function pngDoFormulario(page: Page, linhas: string[]): Promise<Buffer> {
  const base64 = await page.evaluate((textos) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1700;
    canvas.height = 2200;
    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('canvas 2D indisponível');
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.fillStyle = '#000000';
    contexto.font = '34px Arial, Helvetica, sans-serif';
    contexto.textBaseline = 'top';
    textos.forEach((texto, i) => contexto.fillText(texto, 80, 120 + i * 70));
    return canvas.toDataURL('image/png').split(',')[1] ?? '';
  }, linhas);
  return Buffer.from(base64, 'base64');
}

async function pdfEscaneado(page: Page, caminho: string): Promise<string> {
  return criarPdfEscaneado(caminho, await pngDoFormulario(page, linhasDoFormulario({ nome: NOME })));
}

async function processar(page: Page, arquivos: string[]) {
  await page.locator('input[type=file][accept*="pdf"]').setInputFiles(arquivos);
  await page.getByRole('button', { name: /Processar arquivos/ }).click();
  await expect(page.getByRole('group', { name: 'Triagem por status' })).toBeVisible({ timeout: 100_000 });
}

function linhaDe(page: Page, arquivo: string) {
  return page.locator('tbody tr').filter({ has: page.getByLabel(`Nome de ${arquivo}`) });
}

test('PDF escaneado: lê os campos por OCR, fica REVISAR, mostra a página e nada sai da origem', async ({ page }, info) => {
  const foraDaOrigem: string[] = [];
  const problemas: string[] = [];
  page.on('request', (r) => {
    if (/^(data|blob):/.test(r.url())) return;
    if (new URL(r.url()).origin !== ORIGEM) foraDaOrigem.push(r.url());
  });
  page.on('console', (m) => {
    if (m.type() === 'error') problemas.push(m.text());
  });

  await page.goto('/');
  const escaneado = await pdfEscaneado(page, info.outputPath('escaneado.pdf'));
  await processar(page, [escaneado]);

  await expect(page.getByLabel('Nome de escaneado.pdf')).toHaveValue(NOME);
  await expect(page.getByLabel('CPF de escaneado.pdf')).toHaveValue('52998224725');
  await expect(page.getByLabel('NIS de escaneado.pdf')).toHaveValue('12345678919');
  await expect(page.getByRole('button', { name: '1 REVISAR' })).toBeVisible();
  await linhaDe(page, 'escaneado.pdf').getByRole('button', { name: /REVISAR/ }).click();
  await expect(page.getByRole('list', { name: 'Pendências de escaneado.pdf' })).toContainText('PDF lido por OCR: conferir os campos');
  await expect(page.getByRole('img', { name: 'Página do PDF escaneado.pdf' })).toBeVisible();

  expect(foraDaOrigem).toEqual([]);
  expect(problemas).toEqual([]);
});

test('editar uma célula não tira o PDF escaneado de REVISAR; só "Está validado" leva a OK', async ({ page }, info) => {
  await page.goto('/');
  const escaneado = await pdfEscaneado(page, info.outputPath('escaneado.pdf'));
  await processar(page, [escaneado]);
  const linha = linhaDe(page, 'escaneado.pdf');
  await expect(linha.getByRole('button', { name: /REVISAR/ })).toBeVisible();

  await page.getByLabel('Motivo de escaneado.pdf').fill('Mudança para outro Município');
  await page.getByLabel('Município de escaneado.pdf').click();
  await expect(linha.getByRole('button', { name: /REVISAR/ })).toBeVisible();

  const validado = page.getByRole('checkbox', { name: 'Está validado: escaneado.pdf' });
  await validado.check();
  await expect(linha.getByText('OK', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '1 OK' })).toBeVisible();

  await validado.uncheck();
  await expect(linha.getByRole('button', { name: /REVISAR/ })).toBeVisible();
});

test('lote só com PDF de texto não baixa nada do OCR', async ({ page }, info) => {
  const doOcr: string[] = [];
  page.on('request', (r) => {
    if (r.url().startsWith(`${ORIGEM}/ocr/`)) doOcr.push(r.url());
  });
  const texto = await criarPdf(info.outputPath('texto.pdf'), linhasDoFormulario({ nome: 'JOANA PEREIRA LIMA' }));

  await page.goto('/');
  await processar(page, [texto]);
  await expect(page.getByRole('button', { name: '1 OK' })).toBeVisible();
  expect(doOcr).toEqual([]);
});

test('lote misto: o PDF de texto sai OK como antes e o escaneado sai REVISAR', async ({ page }, info) => {
  const texto = await criarPdf(info.outputPath('texto.pdf'), linhasDoFormulario({ nome: 'JOANA PEREIRA LIMA' }));
  await page.goto('/');
  const escaneado = await pdfEscaneado(page, info.outputPath('escaneado.pdf'));
  await processar(page, [texto, escaneado]);

  await expect(page.getByRole('button', { name: '1 OK' })).toBeVisible();
  await expect(page.getByRole('button', { name: '1 REVISAR' })).toBeVisible();
  await expect(page.getByLabel('Nome de texto.pdf')).toHaveValue('JOANA PEREIRA LIMA');
  await expect(linhaDe(page, 'texto.pdf').getByText('OK', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Nome de escaneado.pdf')).toHaveValue(NOME);
  await expect(linhaDe(page, 'escaneado.pdf').getByRole('button', { name: /REVISAR/ })).toBeVisible();
});

test('tela com uma linha de OCR e a imagem da página aberta não tem violações de acessibilidade', async ({ page }, info) => {
  await page.goto('/');
  const escaneado = await pdfEscaneado(page, info.outputPath('escaneado.pdf'));
  await processar(page, [escaneado]);
  await expect(page.getByRole('img', { name: 'Página do PDF escaneado.pdf' })).toBeVisible();
  await linhaDe(page, 'escaneado.pdf').getByRole('button', { name: /REVISAR/ }).click();
  await page.getByRole('button', { name: 'Ampliar' }).click();
  await expect(page.getByRole('button', { name: 'Reduzir' })).toBeVisible();
  await semViolacoes(page);
});
