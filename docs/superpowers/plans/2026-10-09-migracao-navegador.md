# Leitor de Desligamentos no navegador: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o backend Java por processamento 100% no navegador (TypeScript + pdf.js), com a interface redesenhada, publicável na Vercel como site estático.

**Architecture:** Toda a lógica vive em `frontend/src/lib/` como módulos sem React (extração de texto, parser, exportação, processamento em lote). Os componentes React em `frontend/src/components/` só exibem estado e disparam ações; `App.tsx` guarda o estado e liga as peças. Nenhum dado do usuário sai do navegador, e a Vercel serve apenas arquivos estáticos com um CSP que bloqueia conexões externas.

**Tech Stack:** React 18, TypeScript 5, Vite 6, Tailwind 3, Vitest 5, Testing Library, `pdfjs-dist` 6.4.299, `write-excel-file` 4.1.1 (entrada `write-excel-file/universal`), `pdf-lib` e `fflate` (só em testes), `@fontsource/*`.

**Spec:** `docs/superpowers/specs/2026-10-09-migracao-navegador-design.md`

## Global Constraints

- Mantidos: React 18, TypeScript, Vite e Tailwind. Sem backend, sem Python, sem Supabase, sem OCR.
- Nenhum dado de PDF sai do navegador: nenhuma chamada `fetch`/`XMLHttpRequest` com dados do usuário; CSP com `connect-src 'self'`; fontes locais via `@fontsource` (sem `@import` do Google Fonts).
- CSV: separador `;`, UTF-8 com BOM (`\uFEFF` no início), campos com `;`, `"` ou quebra de linha entre aspas com `"` duplicado.
- Colunas de exportação, nesta ordem e grafia: `ARQUIVO`, `Referencia`, `MUNICIPIO`, `CPF`, `NIS`, `NOME`, `MOTIVO`, `STATUS`.
- XLSX: uma aba chamada `Desligamentos`, todas as células como texto (CPF e NIS preservam zeros à esquerda), largura de coluna ajustada ao conteúdo.
- `referencia` é a data do processamento em `dd/MM/yyyy`.
- CPF é válido só quando tem 11 dígitos (sem validar dígitos verificadores). Os campos obrigatórios são `MUNICIPIO`, `CPF`, `NIS`, `NOME`, `MOTIVO`, nesta ordem nas mensagens de inconsistência.
- Mensagens fixas de inconsistência: `erro de processamento: <mensagem>` e `PDF sem texto selecionável (escaneado)`.
- Cores: Eclipse `#213555`, Denim `#4F709C`, Honey `#E5D283` (somente para o estado `REVISAR`), Papel `#F3F5F8`, Tinta `#16233A` e `#5B6B82`, Tijolo `#A33A2E` (somente erro de processamento). Honey nunca é cor de texto sobre fundo claro.
- Tipografia: Bricolage Grotesque nos títulos, IBM Plex Sans na interface. Sem rótulos em caixa alta, sem cards com sombra, sem movimento decorativo; respeitar `prefers-reduced-motion`; foco visível por teclado.
- O repositório nunca recebe PDFs com dados reais (o `.gitignore` já ignora `*.pdf`); PDFs de teste são gerados no próprio teste com `pdf-lib`.
- Node ≥ 22.13 (exigência do `pdfjs-dist` 6): o CI usa Node 22.
- Decisão de implementação: `parseText` devolve chaves em minúsculas (`municipio`, `cpf`, `nis`, `nome`, `motivo`), iguais às do `DesligamentoRecord`; as mensagens de inconsistência continuam em maiúsculas (`MUNICIPIO`, `CPF`...). A spec descrevia as chaves em maiúsculas; o conteúdo e o comportamento não mudam.

## Review Focus

Entradas e condições que a spec implica mas que nenhum requisito testa diretamente, da mais provável para a menos:

1. **CPF/NIS com zeros à esquerda e pontuação nas exportações.** Um CPF `00123456789` virar número no XLSX ou perder o zero no CSV corrompe o dado. Teste na Task 2.
2. **PDF cujos itens de texto chegam fora de ordem, com CRLF ou com Y ligeiramente diferente na mesma linha.** O parser depende de quebras de linha; sem isso os campos saem vazios. Testes nas Tasks 1 e 3.
3. **Um arquivo ruim no meio do lote (0 bytes, não-PDF).** Deve virar uma linha `REVISAR` e não derrubar o lote. Teste na Task 4.
4. **Editar uma célula com o filtro `REVISAR` ativo.** Ao corrigir o dado a linha vira `OK` e sumiria da tabela enquanto o usuário digita. A linha em edição precisa continuar visível até sair da célula. Teste na Task 7.
5. **Clicar em Limpar (ou Processar de novo) com um lote em andamento.** Resultados antigos não podem reaparecer depois da limpeza. Teste na Task 8.

---

## Mapa de arquivos

Criados em `frontend/`:

| Arquivo | Responsabilidade |
|---|---|
| `vitest.config.ts` | Configuração de testes (alias do `pdfjs-dist` para o build `legacy`, setup) |
| `src/testes/setup.ts` | `jest-dom` e limpeza do Testing Library |
| `src/testes/criarPdf.ts` | Gera PDFs sintéticos com `pdf-lib` para os testes |
| `src/tipos.ts` | `Status`, `CampoEditavel`, `DesligamentoRecord` |
| `src/lib/parser/campos.ts` | Port de `FieldParser.java`: `parseText`, `inconsistencies`, `statusFor`, `recalcular` |
| `src/lib/exportar/colunas.ts` | Cabeçalho e valores de linha compartilhados |
| `src/lib/exportar/csv.ts` | `gerarCsv` |
| `src/lib/exportar/xlsx.ts` | `gerarXlsx` |
| `src/lib/exportar/baixar.ts` | `baixarBlob` (download local) |
| `src/lib/pdf/montarLinhas.ts` | Agrupa itens de texto do pdf.js em linhas |
| `src/lib/pdf/extrairTexto.ts` | Lê um PDF com pdf.js e devolve o texto em linhas |
| `src/lib/pdf/configurarWorker.ts` | Configura o worker do pdf.js (só no navegador) |
| `src/lib/processar.ts` | Arquivo → registro e lote com progresso e cancelamento |
| `src/components/ZonaUpload.tsx` | Seleção/arrasto de PDFs e lista de arquivos |
| `src/components/BarraTriagem.tsx` | Barra proporcional OK × REVISAR que filtra por status |
| `src/components/Filtros.tsx` | Menus compactos de município e motivo |
| `src/components/TabelaResultados.tsx` | Tabela editável com linhas expansíveis |
| `src/components/BarraExportar.tsx` | Rodapé fixo com os três downloads |
| `vercel.json` | CSP e cabeçalhos de segurança |
| `src/vercel.test.ts` | Garante que o CSP não permite conexões externas |

Modificados: `package.json`, `vite.config.ts`, `tailwind.config.js`, `index.html`, `src/index.css`, `src/main.tsx`, `src/App.tsx`, `.github/workflows/testes.yml`, `README.md`, `.gitignore`. Removidos no fim: `backend/`, `Iniciar Leitor.bat`, `scripts/`.

Todos os comandos abaixo rodam em `C:\Users\lucas\repositorios_git\leitor-de-desligamentos\frontend`, na branch `migracao-navegador`, salvo indicação.

---

### Task 1: Parser de campos com Vitest configurado

**Files:**
- Create: `frontend/vitest.config.ts`, `frontend/src/testes/setup.ts`, `frontend/src/tipos.ts`, `frontend/src/lib/parser/campos.ts`
- Test: `frontend/src/lib/parser/campos.test.ts`
- Modify: `frontend/package.json`, `frontend/vite.config.ts`

**Interfaces:**
- Produces (`tipos.ts`):
  ```ts
  export type Status = 'OK' | 'REVISAR';
  export type CampoEditavel = 'municipio' | 'cpf' | 'nis' | 'nome' | 'motivo';
  export const CAMPOS_EDITAVEIS: readonly CampoEditavel[];
  export type CamposDesligamento = Record<CampoEditavel, string>;
  export interface DesligamentoRecord extends CamposDesligamento {
    id: number; arquivo: string; referencia: string;
    status: Status; inconsistencias: string[];
  }
  ```
- Produces (`campos.ts`):
  ```ts
  export function parseText(texto: string): CamposDesligamento;
  export function inconsistencies(campos: CamposDesligamento): string[];
  export function statusFor(campos: CamposDesligamento): Status;
  export function recalcular(registro: DesligamentoRecord): DesligamentoRecord;
  ```

- [ ] **Step 1: Instalar as dependências**

```bash
npm install pdfjs-dist@6.4.299 write-excel-file@4.1.1
npm install -D vitest@5.0.3 jsdom@30.1.2 @types/node@22 @testing-library/react@16.3.3 @testing-library/user-event@14.6.7 @testing-library/jest-dom@7.0.1 pdf-lib@1.17.1 fflate
npm install @fontsource/ibm-plex-sans@5.3.0 @fontsource/bricolage-grotesque@5.3.0
```

Expected: instalação sem erros; `package.json` lista as dependências.

- [ ] **Step 2: Ajustar `package.json`**

Em `frontend/package.json`, adicione `"test": "vitest run"` em `scripts` e `"engines": { "node": ">=22.13" }` no nível raiz. O trecho `scripts` fica:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "type-check": "tsc --noEmit",
  "test": "vitest run"
},
```

- [ ] **Step 3: Remover o proxy da API do Vite**

Substitua todo o conteúdo de `frontend/vite.config.ts` por:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

- [ ] **Step 4: Criar a configuração do Vitest**

`frontend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // O build moderno do pdf.js avisa e falha no Node; os testes usam o build legacy.
    alias: [{ find: /^pdfjs-dist$/, replacement: 'pdfjs-dist/legacy/build/pdf.mjs' }],
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/testes/setup.ts'],
  },
});
```

`frontend/src/testes/setup.ts`:

```ts
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  if (typeof document !== 'undefined') cleanup();
});
```

- [ ] **Step 5: Criar os tipos**

`frontend/src/tipos.ts`:

```ts
export type Status = 'OK' | 'REVISAR';

export type CampoEditavel = 'municipio' | 'cpf' | 'nis' | 'nome' | 'motivo';

export const CAMPOS_EDITAVEIS: readonly CampoEditavel[] = ['municipio', 'cpf', 'nis', 'nome', 'motivo'];

export type CamposDesligamento = Record<CampoEditavel, string>;

export interface DesligamentoRecord extends CamposDesligamento {
  id: number;
  arquivo: string;
  /** Data do processamento em dd/MM/yyyy. */
  referencia: string;
  status: Status;
  inconsistencias: string[];
}
```

- [ ] **Step 6: Escrever os testes que falham**

`frontend/src/lib/parser/campos.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { DesligamentoRecord } from '../../tipos';
import { inconsistencies, parseText, recalcular, statusFor } from './campos';

const TEXTO = [
  'MUNICÍPIO: CIDADE EXEMPLO',
  'CPF: 001.234.567-89',
  'NIS: 000123456789',
  'NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: MARIA DA SILVA',
  'MOTIVO DO DESLIGAMENTO',
  '( ) Mudança para outro Estado',
  '(X) OUTRO',
  'Mudança de renda da família',
].join('\n');

describe('parseText', () => {
  it('preserva identificadores e monta o motivo "OUTRO"', () => {
    const campos = parseText(TEXTO);
    expect(campos).toEqual({
      municipio: 'CIDADE EXEMPLO',
      cpf: '00123456789',
      nis: '000123456789',
      nome: 'MARIA DA SILVA',
      motivo: 'OUTRO: Mudança de renda da família',
    });
    expect(statusFor(campos)).toBe('OK');
  });

  it('aceita quebras de linha CRLF', () => {
    expect(parseText(TEXTO.replace(/\n/g, '\r\n'))).toEqual(parseText(TEXTO));
  });

  it('remove o número no final do município', () => {
    expect(parseText('MUNICÍPIO: CIDADE EXEMPLO 12').municipio).toBe('CIDADE EXEMPLO');
  });

  it('remove ruído numérico no final do nome', () => {
    const texto = 'NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: MARIA DA SILVA 123';
    expect(parseText(texto).nome).toBe('MARIA DA SILVA');
    expect(parseText('NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: ANA(2)').nome).toBe('ANA');
  });

  it('usa a linha seguinte quando o valor não está na linha do rótulo', () => {
    const texto = 'CPF:\n\n   \n123.456.789-09';
    expect(parseText(texto).cpf).toBe('12345678909');
  });

  it('limita o CPF aos 11 primeiros dígitos', () => {
    expect(parseText('CPF: 123.456.789-0999').cpf).toBe('12345678909');
  });

  it('devolve o motivo marcado quando não é "outro"', () => {
    const texto = 'MOTIVO DO DESLIGAMENTO\n(X) Mudança para outro Estado\n( ) OUTRO';
    expect(parseText(texto).motivo).toBe('Mudança para outro Estado');
  });

  it('pula caixas de marcação ao procurar o detalhe de "outro"', () => {
    const texto = 'MOTIVO DO DESLIGAMENTO\n(X) Outro\n( ) Mudança\nDetalhe aqui';
    expect(parseText(texto).motivo).toBe('Outro: Detalhe aqui');
  });

  it('ignora marcações depois do fim da seção de motivo', () => {
    const texto = 'MOTIVO DO DESLIGAMENTO\n( ) Mudança\nASSINATURA\n(X) OUTRO\nfoo';
    expect(parseText(texto).motivo).toBe('');
  });

  it('devolve todos os campos vazios para texto vazio', () => {
    const campos = parseText('');
    expect(campos).toEqual({ municipio: '', cpf: '', nis: '', nome: '', motivo: '' });
    expect(inconsistencies(campos)).toEqual(['MUNICIPIO', 'CPF', 'NIS', 'NOME', 'MOTIVO']);
  });
});

describe('inconsistencies e statusFor', () => {
  const completo = { municipio: 'OUTRA CIDADE', cpf: '12345678909', nis: '123', nome: 'ANA', motivo: 'Mudança' };

  it('campo ausente exige revisão', () => {
    const campos = { ...completo, municipio: '', nis: '', nome: '', motivo: '', cpf: '123' };
    expect(statusFor(campos)).toBe('REVISAR');
  });

  it('CPF com tamanho diferente de 11 gera "CPF inválido" mesmo com os outros campos preenchidos', () => {
    const campos = { ...completo, cpf: '1234567890' };
    expect(inconsistencies(campos)).toContain('CPF inválido');
    expect(statusFor(campos)).toBe('REVISAR');
  });

  it('registro completo fica OK', () => {
    expect(inconsistencies(completo)).toEqual([]);
    expect(statusFor(completo)).toBe('OK');
  });
});

describe('recalcular', () => {
  it('troca status e inconsistências depois de uma edição', () => {
    const registro: DesligamentoRecord = {
      id: 1,
      arquivo: 'a.pdf',
      referencia: '09/10/2026',
      municipio: '',
      cpf: '12345678909',
      nis: '123',
      nome: 'ANA',
      motivo: 'Mudança',
      status: 'REVISAR',
      inconsistencias: ['PDF sem texto selecionável (escaneado)'],
    };
    const corrigido = recalcular({ ...registro, municipio: 'CIDADE' });
    expect(corrigido.status).toBe('OK');
    expect(corrigido.inconsistencias).toEqual([]);
    expect(recalcular(registro).inconsistencias).toEqual(['MUNICIPIO']);
  });
});
```

- [ ] **Step 7: Rodar os testes e ver falhar**

Run: `npx vitest run src/lib/parser/campos.test.ts`
Expected: FAIL com "Failed to resolve import './campos'".

- [ ] **Step 8: Implementar o parser**

`frontend/src/lib/parser/campos.ts`:

```ts
import {
  CAMPOS_EDITAVEIS,
  type CamposDesligamento,
  type DesligamentoRecord,
  type Status,
} from '../../tipos';

/**
 * Extração dos campos dos formulários de desligamento.
 * Port fiel de FieldParser.java: mesmos rótulos, mesmas regras, mesmas mensagens.
 */

const FLAGS = 'iu';
const QUEBRA_DE_LINHA = /\r\n|\r|\n/;
const TOKEN = /[\wÀ-ÿ]+|\([^)]*\)/gu;

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function padraoDoRotulo(rotulo: string): string {
  return (rotulo.match(TOKEN) ?? []).map(escaparRegex).join('\\s+');
}

const ROTULO_NOME = new RegExp(
  `${padraoDoRotulo('NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO')}\\s*:\\s*([^\\r\\n]*)`,
  FLAGS,
);
const TITULO_MOTIVO = /MOTIVO\s+DO\s+DESLIGAMENTO/iu;
const FIM_MOTIVO = /\n\s*(?:ASSINATURA|OBSERVA[CÇ]ÕES?|DATA\s*:|MUNIC[IÍ]PIO\s*:)/iu;
const CAIXA_MARCADA = /\(\s*[xX]\s*\)/u;
const CAIXA_MARCADA_TODAS = /\(\s*[xX]\s*\)/gu;
const QUALQUER_CAIXA = /\(\s*[xX ]\s*\)/u;
const RUIDO_FINAL_DO_NOME = /[\d()-]+$/u;
const NUMERO_FINAL_DO_MUNICIPIO = /\s+\d+\s*$/u;
const NAO_DIGITOS = /\D/gu;

function aparar(valor: string, caracteres: string): string {
  let inicio = 0;
  let fim = valor.length;
  while (inicio < fim && caracteres.includes(valor[inicio])) inicio++;
  while (fim > inicio && caracteres.includes(valor[fim - 1])) fim--;
  return valor.slice(inicio, fim);
}

function limpar(valor: string | null | undefined): string {
  if (!valor) return '';
  return aparar(valor.replace(/\s+/gu, ' '), ' \t:;');
}

function primeiraLinhaPreenchida(resto: string, tratar: (linha: string) => string): string {
  for (const linha of resto.split(QUEBRA_DE_LINHA)) {
    const valor = tratar(limpar(linha));
    if (valor) return valor;
  }
  return '';
}

function valorAposRotulo(texto: string, rotulo: string): string {
  const achado = new RegExp(`${rotulo}\\s*:\\s*([^\\r\\n]*)`, FLAGS).exec(texto);
  if (!achado) return '';
  const valor = limpar(achado[1]);
  if (valor) return valor;
  return primeiraLinhaPreenchida(texto.slice(achado.index + achado[0].length), (linha) => linha);
}

function primeirosDigitos(valor: string, maximo: number): string {
  return valor.replace(NAO_DIGITOS, '').slice(0, maximo);
}

function sanitizarNome(valor: string): string {
  return valor.replace(RUIDO_FINAL_DO_NOME, '').trim();
}

function extrairNome(texto: string): string {
  const achado = ROTULO_NOME.exec(texto);
  if (!achado) return '';
  const valor = sanitizarNome(limpar(achado[1]));
  if (valor) return valor;
  return primeiraLinhaPreenchida(texto.slice(achado.index + achado[0].length), sanitizarNome);
}

function extrairMotivo(texto: string): string {
  const titulo = TITULO_MOTIVO.exec(texto);
  if (!titulo) return '';
  const resto = texto.slice(titulo.index + titulo[0].length);
  const fim = FIM_MOTIVO.exec(resto);
  const secao = fim ? resto.slice(0, fim.index) : resto;
  const linhas = secao.split(QUEBRA_DE_LINHA);
  for (let indice = 0; indice < linhas.length; indice++) {
    if (!CAIXA_MARCADA.test(linhas[indice])) continue;
    let motivo = limpar(linhas[indice].replace(CAIXA_MARCADA_TODAS, ''));
    if (!motivo) continue;
    if (motivo.slice(0, 5).toLowerCase() === 'outro') {
      for (let seguinte = indice + 1; seguinte < linhas.length; seguinte++) {
        const detalhe = limpar(linhas[seguinte]);
        if (!detalhe || QUALQUER_CAIXA.test(detalhe)) continue;
        motivo = `${motivo}: ${detalhe}`;
        break;
      }
    }
    return motivo;
  }
  return '';
}

export function parseText(texto: string): CamposDesligamento {
  const entrada = texto ?? '';
  return {
    municipio: valorAposRotulo(entrada, 'MUNIC[IÍ]PIO').replace(NUMERO_FINAL_DO_MUNICIPIO, '').trim(),
    cpf: primeirosDigitos(valorAposRotulo(entrada, 'CPF'), 11),
    nis: valorAposRotulo(entrada, 'NIS').replace(NAO_DIGITOS, ''),
    nome: extrairNome(entrada),
    motivo: extrairMotivo(entrada),
  };
}

export function inconsistencies(campos: CamposDesligamento): string[] {
  const problemas = CAMPOS_EDITAVEIS.filter((campo) => !campos[campo]?.trim()).map((campo) => campo.toUpperCase());
  const cpf = campos.cpf?.trim() ?? '';
  if (cpf && cpf.length !== 11) problemas.push('CPF inválido');
  return problemas;
}

export function statusFor(campos: CamposDesligamento): Status {
  return inconsistencies(campos).length === 0 ? 'OK' : 'REVISAR';
}

/** Recalcula status e inconsistências a partir dos campos (usado depois de editar uma célula). */
export function recalcular(registro: DesligamentoRecord): DesligamentoRecord {
  const problemas = inconsistencies(registro);
  return { ...registro, inconsistencias: problemas, status: problemas.length === 0 ? 'OK' : 'REVISAR' };
}
```

- [ ] **Step 9: Rodar os testes e ver passar**

Run: `npx vitest run src/lib/parser/campos.test.ts`
Expected: PASS (todos os testes). Se algum falhar por diferença de regex entre Java e JS, corrija o `campos.ts` e não o teste, a menos que o teste contradiga `FieldParser.java`.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vite.config.ts vitest.config.ts src/testes/setup.ts src/tipos.ts src/lib/parser
git commit -m "feat: parser de campos em TypeScript e configuração do Vitest

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Exportação CSV e XLSX

**Files:**
- Create: `frontend/src/lib/exportar/colunas.ts`, `csv.ts`, `xlsx.ts`, `baixar.ts`
- Test: `frontend/src/lib/exportar/exportar.test.ts`

**Interfaces:**
- Consumes: `DesligamentoRecord` de `../../tipos`.
- Produces:
  ```ts
  // colunas.ts
  export const CABECALHO_EXPORTACAO: readonly ['ARQUIVO','Referencia','MUNICIPIO','CPF','NIS','NOME','MOTIVO','STATUS'];
  export function valoresDaLinha(registro: DesligamentoRecord): string[];
  export function somenteRevisar(registros: DesligamentoRecord[]): DesligamentoRecord[];
  // csv.ts
  export function gerarCsv(registros: DesligamentoRecord[]): string; // começa com '\uFEFF'
  // xlsx.ts
  export function gerarXlsx(registros: DesligamentoRecord[]): Promise<Blob>;
  // baixar.ts
  export function baixarBlob(blob: Blob, nomeDoArquivo: string): void;
  ```

- [ ] **Step 1: Escrever os testes que falham**

`frontend/src/lib/exportar/exportar.test.ts`:

```ts
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { DesligamentoRecord } from '../../tipos';
import { somenteRevisar } from './colunas';
import { gerarCsv } from './csv';
import { gerarXlsx } from './xlsx';

function registro(parcial: Partial<DesligamentoRecord> = {}): DesligamentoRecord {
  return {
    id: 1,
    arquivo: 'a.pdf',
    referencia: '17/09/2026',
    municipio: 'CIDADE EXEMPLO',
    cpf: '00123456789',
    nis: '000123456789',
    nome: 'MARIA DA SILVA',
    motivo: 'OUTRO: Mudança',
    status: 'OK',
    inconsistencias: [],
    ...parcial,
  };
}

describe('gerarCsv', () => {
  it('começa com BOM e o cabeçalho esperado, separado por ponto e vírgula', () => {
    const csv = gerarCsv([registro()]);
    expect(csv.startsWith('\uFEFFARQUIVO;Referencia;MUNICIPIO;CPF;NIS;NOME;MOTIVO;STATUS\n')).toBe(true);
    expect(csv.split('\n')[1]).toBe(
      'a.pdf;17/09/2026;CIDADE EXEMPLO;00123456789;000123456789;MARIA DA SILVA;OUTRO: Mudança;OK',
    );
  });

  it('preserva zeros à esquerda de CPF e NIS', () => {
    const csv = gerarCsv([registro({ cpf: '00000000001', nis: '0001' })]);
    expect(csv).toContain(';00000000001;0001;');
  });

  it('coloca entre aspas campos com ponto e vírgula, aspas ou quebra de linha', () => {
    const csv = gerarCsv([registro({ arquivo: 'a;"b".pdf', nome: 'linha1\nlinha2', motivo: 'x\r\ny' })]);
    expect(csv).toContain('"a;""b"".pdf"');
    expect(csv).toContain('"linha1\nlinha2"');
    expect(csv).toContain('"x\r\ny"');
  });

  it('gera apenas o cabeçalho para lista vazia', () => {
    expect(gerarCsv([])).toBe('\uFEFFARQUIVO;Referencia;MUNICIPIO;CPF;NIS;NOME;MOTIVO;STATUS');
  });
});

describe('gerarXlsx', () => {
  async function abrir(registros: DesligamentoRecord[]) {
    const blob = await gerarXlsx(registros);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { bytes, arquivos: unzipSync(bytes) };
  }

  it('é um contêiner ZIP com a aba "Desligamentos"', async () => {
    const { bytes, arquivos } = await abrir([registro()]);
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe('PK');
    expect(strFromU8(arquivos['xl/workbook.xml'])).toContain('name="Desligamentos"');
  });

  it('grava CPF e NIS como texto, preservando zeros à esquerda', async () => {
    const { arquivos } = await abrir([registro({ cpf: '00123456789', nis: '0001' })]);
    const textos = strFromU8(arquivos['xl/sharedStrings.xml']);
    expect(textos).toContain('<t>00123456789</t>');
    expect(textos).toContain('<t>0001</t>');
    const planilha = strFromU8(arquivos['xl/worksheets/sheet1.xml']);
    expect(planilha).not.toContain('t="n"');
  });

  it('inclui o cabeçalho e uma linha por registro', async () => {
    const { arquivos } = await abrir([registro(), registro({ id: 2, arquivo: 'b.pdf' })]);
    const textos = strFromU8(arquivos['xl/sharedStrings.xml']);
    for (const titulo of ['ARQUIVO', 'Referencia', 'MUNICIPIO', 'CPF', 'NIS', 'NOME', 'MOTIVO', 'STATUS']) {
      expect(textos).toContain(`<t>${titulo}</t>`);
    }
    expect(textos).toContain('<t>b.pdf</t>');
  });

  it('aceita lista vazia', async () => {
    const { arquivos } = await abrir([]);
    expect(strFromU8(arquivos['xl/workbook.xml'])).toContain('name="Desligamentos"');
  });
});

describe('somenteRevisar', () => {
  it('mantém apenas os registros REVISAR', () => {
    const lista = [registro({ id: 1 }), registro({ id: 2, status: 'REVISAR' })];
    expect(somenteRevisar(lista).map((r) => r.id)).toEqual([2]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/exportar`
Expected: FAIL com "Failed to resolve import './colunas'".

- [ ] **Step 3: Implementar colunas, CSV, XLSX e download**

`frontend/src/lib/exportar/colunas.ts`:

```ts
import type { DesligamentoRecord } from '../../tipos';

export const CABECALHO_EXPORTACAO = [
  'ARQUIVO',
  'Referencia',
  'MUNICIPIO',
  'CPF',
  'NIS',
  'NOME',
  'MOTIVO',
  'STATUS',
] as const;

export function valoresDaLinha(registro: DesligamentoRecord): string[] {
  return [
    registro.arquivo,
    registro.referencia,
    registro.municipio,
    registro.cpf,
    registro.nis,
    registro.nome,
    registro.motivo,
    registro.status,
  ].map((valor) => valor ?? '');
}

export function somenteRevisar(registros: DesligamentoRecord[]): DesligamentoRecord[] {
  return registros.filter((registro) => registro.status === 'REVISAR');
}
```

`frontend/src/lib/exportar/csv.ts`:

```ts
import type { DesligamentoRecord } from '../../tipos';
import { CABECALHO_EXPORTACAO, valoresDaLinha } from './colunas';

const BOM = '\uFEFF';

function escapar(valor: string): string {
  if (/[;"\r\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

export function gerarCsv(registros: DesligamentoRecord[]): string {
  const linhas = [
    CABECALHO_EXPORTACAO.join(';'),
    ...registros.map((registro) => valoresDaLinha(registro).map(escapar).join(';')),
  ];
  return BOM + linhas.join('\n');
}
```

`frontend/src/lib/exportar/xlsx.ts`:

```ts
import writeExcelFile from 'write-excel-file/universal';
import type { DesligamentoRecord } from '../../tipos';
import { CABECALHO_EXPORTACAO, valoresDaLinha } from './colunas';

const LARGURA_MAXIMA = 60;

export async function gerarXlsx(registros: DesligamentoRecord[]): Promise<Blob> {
  const linhas = registros.map(valoresDaLinha);
  const colunas = CABECALHO_EXPORTACAO.map((titulo, coluna) => {
    const maior = linhas.reduce((atual, linha) => Math.max(atual, linha[coluna].length), titulo.length);
    return { width: Math.min(LARGURA_MAXIMA, maior + 2) };
  });
  const dados = [
    CABECALHO_EXPORTACAO.map((titulo) => ({ value: titulo, fontWeight: 'bold' as const })),
    ...linhas.map((linha) => linha.map((value) => ({ value, type: String, format: '@' }))),
  ];
  return writeExcelFile(dados, { sheet: 'Desligamentos', columns: colunas }).toBlob();
}
```

`frontend/src/lib/exportar/baixar.ts`:

```ts
export function baixarBlob(blob: Blob, nomeDoArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeDoArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revogar na hora pode cancelar o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/exportar`
Expected: PASS (todos os testes).

- [ ] **Step 5: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. Se o `tsc` reclamar do tipo de `dados` em `xlsx.ts`, importe `SheetData` de `write-excel-file/universal` e declare `const dados: SheetData = [...]`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/exportar
git commit -m "feat: exportação CSV e XLSX no navegador

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Extração de texto com pdf.js

**Files:**
- Create: `frontend/src/lib/pdf/montarLinhas.ts`, `extrairTexto.ts`, `configurarWorker.ts`, `frontend/src/testes/criarPdf.ts`
- Test: `frontend/src/lib/pdf/montarLinhas.test.ts`, `frontend/src/lib/pdf/extrairTexto.test.ts`

**Interfaces:**
- Consumes: `parseText` de `../parser/campos` (apenas no teste de integração).
- Produces:
  ```ts
  // montarLinhas.ts
  export interface ItemTexto { str: string; x: number; y: number; largura: number; altura: number; }
  export function montarLinhas(itens: ItemTexto[]): string;
  // extrairTexto.ts
  export function extrairTexto(pdf: ArrayBuffer): Promise<string>; // páginas unidas por '\n'
  // configurarWorker.ts: efeito colateral ao importar
  // testes/criarPdf.ts
  export interface TextoNaPagina { texto: string; x: number; y: number; }
  export function criarPdf(paginas: TextoNaPagina[][]): Promise<ArrayBuffer>;
  ```

- [ ] **Step 1: Escrever os testes de `montarLinhas` (falham)**

`frontend/src/lib/pdf/montarLinhas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { montarLinhas, type ItemTexto } from './montarLinhas';

function item(str: string, x: number, y: number, largura = str.length * 5, altura = 10): ItemTexto {
  return { str, x, y, largura, altura };
}

describe('montarLinhas', () => {
  it('ordena de cima para baixo e da esquerda para a direita, mesmo com itens fora de ordem', () => {
    const itens = [item('B2', 100, 700), item('A1', 10, 780), item('B1', 100, 780), item('A2', 10, 700)];
    expect(montarLinhas(itens)).toBe('A1 B1\nA2 B2');
  });

  it('trata Y levemente diferente como a mesma linha', () => {
    const itens = [item('CPF:', 10, 500), item('123', 100, 502.5)];
    expect(montarLinhas(itens)).toBe('CPF: 123');
  });

  it('separa linhas cujo Y difere mais que a tolerância', () => {
    const itens = [item('linha 1', 10, 500), item('linha 2', 10, 488)];
    expect(montarLinhas(itens)).toBe('linha 1\nlinha 2');
  });

  it('junta itens colados sem espaço e itens afastados com um espaço', () => {
    const colados = [item('CP', 10, 500, 10), item('F:', 20, 500, 10)];
    expect(montarLinhas(colados)).toBe('CPF:');
    const afastados = [item('CPF:', 10, 500, 20), item('123', 60, 500, 15)];
    expect(montarLinhas(afastados)).toBe('CPF: 123');
  });

  it('não duplica espaço quando o item já traz espaço', () => {
    const itens = [item('CPF: ', 10, 500, 25), item('123', 60, 500, 15)];
    expect(montarLinhas(itens)).toBe('CPF: 123');
  });

  it('ignora itens só com espaços e devolve vazio sem itens', () => {
    expect(montarLinhas([item('  ', 10, 500)])).toBe('');
    expect(montarLinhas([])).toBe('');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/pdf/montarLinhas.test.ts`
Expected: FAIL com "Failed to resolve import './montarLinhas'".

- [ ] **Step 3: Implementar `montarLinhas`**

`frontend/src/lib/pdf/montarLinhas.ts`:

```ts
/**
 * O pdf.js devolve fragmentos de texto com coordenadas, sem quebras de linha.
 * O parser depende de linhas (por exemplo, o valor de um rótulo pode estar na
 * linha seguinte), então reconstruímos as linhas pela posição vertical.
 */
export interface ItemTexto {
  str: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Fração da altura da fonte tolerada entre itens da mesma linha. */
const TOLERANCIA_VERTICAL = 0.5;
/** Fração da altura da fonte a partir da qual um intervalo conta como espaço. */
const INTERVALO_DE_ESPACO = 0.15;

function altura(item: ItemTexto): number {
  return Math.max(item.altura, 1);
}

function agruparPorLinha(itens: ItemTexto[]): ItemTexto[][] {
  const ordenados = [...itens].sort((a, b) => b.y - a.y);
  const linhas: ItemTexto[][] = [];
  for (const item of ordenados) {
    const atual = linhas[linhas.length - 1];
    if (atual && Math.abs(atual[0].y - item.y) <= altura(atual[0]) * TOLERANCIA_VERTICAL) {
      atual.push(item);
    } else {
      linhas.push([item]);
    }
  }
  return linhas;
}

function juntarLinha(linha: ItemTexto[]): string {
  const ordenada = [...linha].sort((a, b) => a.x - b.x);
  let texto = '';
  let anterior: ItemTexto | undefined;
  for (const item of ordenada) {
    if (anterior) {
      const intervalo = item.x - (anterior.x + anterior.largura);
      const temEspaco = texto.endsWith(' ') || item.str.startsWith(' ');
      if (!temEspaco && intervalo > altura(item) * INTERVALO_DE_ESPACO) texto += ' ';
    }
    texto += item.str;
    anterior = item;
  }
  return texto;
}

export function montarLinhas(itens: ItemTexto[]): string {
  const comTexto = itens.filter((item) => item.str.trim() !== '');
  return agruparPorLinha(comTexto).map(juntarLinha).join('\n');
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/pdf/montarLinhas.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Criar o gerador de PDF de teste**

`frontend/src/testes/criarPdf.ts`:

```ts
import { PDFDocument, StandardFonts } from 'pdf-lib';

export interface TextoNaPagina {
  texto: string;
  x: number;
  y: number;
}

/** Gera um PDF sintético: uma lista de textos posicionados por página. Sem dados reais. */
export async function criarPdf(paginas: TextoNaPagina[][]): Promise<ArrayBuffer> {
  const documento = await PDFDocument.create();
  const fonte = await documento.embedFont(StandardFonts.Helvetica);
  for (const textos of paginas) {
    const pagina = documento.addPage([595, 842]);
    for (const { texto, x, y } of textos) {
      pagina.drawText(texto, { x, y, size: 11, font: fonte });
    }
  }
  const bytes = await documento.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
```

- [ ] **Step 6: Escrever o teste de integração (falha)**

`frontend/src/lib/pdf/extrairTexto.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { criarPdf, type TextoNaPagina } from '../../testes/criarPdf';
import { parseText } from '../parser/campos';
import { extrairTexto } from './extrairTexto';

/** Formulário sintético: rótulos à esquerda, valores em outra coluna, desenhados fora de ordem. */
const FORMULARIO: TextoNaPagina[] = [
  { texto: 'Mudança de renda da família', x: 50, y: 640 },
  { texto: '(X) OUTRO', x: 50, y: 660 },
  { texto: '( ) Mudança para outro Estado', x: 50, y: 680 },
  { texto: 'MOTIVO DO DESLIGAMENTO', x: 50, y: 700 },
  { texto: 'MARIA DA SILVA', x: 400, y: 740 },
  { texto: 'NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO:', x: 50, y: 740 },
  { texto: '000123456789', x: 120, y: 760 },
  { texto: 'NIS:', x: 50, y: 760 },
  { texto: '001.234.567-89', x: 120, y: 780 },
  { texto: 'CPF:', x: 50, y: 780 },
  { texto: 'CIDADE EXEMPLO', x: 120, y: 800 },
  { texto: 'MUNICÍPIO:', x: 50, y: 800 },
];

describe('extrairTexto', () => {
  it('reconstrói as linhas do formulário e o parser encontra todos os campos', async () => {
    const texto = await extrairTexto(await criarPdf([FORMULARIO]));
    expect(parseText(texto)).toEqual({
      municipio: 'CIDADE EXEMPLO',
      cpf: '00123456789',
      nis: '000123456789',
      nome: 'MARIA DA SILVA',
      motivo: 'OUTRO: Mudança de renda da família',
    });
  });

  it('une as páginas na ordem', async () => {
    const texto = await extrairTexto(
      await criarPdf([[{ texto: 'PAGINA UM', x: 50, y: 800 }], [{ texto: 'PAGINA DOIS', x: 50, y: 800 }]]),
    );
    expect(texto).toBe('PAGINA UM\nPAGINA DOIS');
  });

  it('devolve texto vazio para PDF sem texto', async () => {
    expect((await extrairTexto(await criarPdf([[]]))).trim()).toBe('');
  });

  it('rejeita bytes que não são um PDF', async () => {
    await expect(extrairTexto(new Uint8Array([1, 2, 3]).buffer)).rejects.toThrow();
  });
});
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx vitest run src/lib/pdf/extrairTexto.test.ts`
Expected: FAIL com "Failed to resolve import './extrairTexto'".

- [ ] **Step 8: Implementar `extrairTexto` e a configuração do worker**

`frontend/src/lib/pdf/extrairTexto.ts`:

```ts
import { getDocument } from 'pdfjs-dist';
import { montarLinhas, type ItemTexto } from './montarLinhas';

export async function extrairTexto(pdf: ArrayBuffer): Promise<string> {
  const documento = await getDocument({ data: new Uint8Array(pdf) }).promise;
  try {
    const paginas: string[] = [];
    for (let numero = 1; numero <= documento.numPages; numero++) {
      const pagina = await documento.getPage(numero);
      const conteudo = await pagina.getTextContent();
      const itens: ItemTexto[] = [];
      for (const item of conteudo.items) {
        if ('str' in item) {
          itens.push({
            str: item.str,
            x: item.transform[4],
            y: item.transform[5],
            largura: item.width,
            altura: item.height,
          });
        }
      }
      paginas.push(montarLinhas(itens));
    }
    return paginas.join('\n');
  } finally {
    await documento.destroy();
  }
}
```

`frontend/src/lib/pdf/configurarWorker.ts`:

```ts
import { GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Importado só pelo main.tsx: nos testes (Node) o pdf.js usa o worker embutido.
GlobalWorkerOptions.workerSrc = workerUrl;
```

- [ ] **Step 9: Rodar e ver passar**

Run: `npx vitest run src/lib/pdf`
Expected: PASS (6 + 4 testes). Se o teste "reconstrói as linhas" falhar, imprima `texto` com `console.log(JSON.stringify(texto))` e ajuste as constantes `TOLERANCIA_VERTICAL` e `INTERVALO_DE_ESPACO` em `montarLinhas.ts`; os testes de `montarLinhas` devem continuar verdes.

- [ ] **Step 10: Importar o worker no `main.tsx` e checar tipos**

Em `frontend/src/main.tsx`, adicione `import './lib/pdf/configurarWorker';` logo abaixo de `import App from './App';`.

Run: `npx tsc --noEmit`
Expected: sem erros (o `App.tsx` ainda é o antigo e continua compilando).

- [ ] **Step 11: Commit**

```bash
git add src/lib/pdf src/testes/criarPdf.ts src/main.tsx
git commit -m "feat: extração de texto de PDF no navegador com pdf.js

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Processamento de arquivos e lotes

**Files:**
- Create: `frontend/src/lib/processar.ts`
- Test: `frontend/src/lib/processar.test.ts`

**Interfaces:**
- Consumes: `extrairTexto(pdf: ArrayBuffer): Promise<string>`, `parseText`, `inconsistencies`, `DesligamentoRecord`, `criarPdf`.
- Produces:
  ```ts
  export const MENSAGEM_PDF_ESCANEADO = 'PDF sem texto selecionável (escaneado)';
  export function formatarReferencia(data: Date): string; // dd/MM/yyyy
  export function processarArquivo(id: number, arquivo: File, referencia: string): Promise<DesligamentoRecord>;
  export interface OpcoesDoLote { onProgresso?: (feitos: number, total: number) => void; signal?: AbortSignal; }
  export function processarLote(arquivos: File[], hoje: Date, opcoes?: OpcoesDoLote): Promise<DesligamentoRecord[]>;
  ```

- [ ] **Step 1: Escrever os testes que falham**

`frontend/src/lib/processar.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { criarPdf, type TextoNaPagina } from '../testes/criarPdf';
import { formatarReferencia, MENSAGEM_PDF_ESCANEADO, processarArquivo, processarLote } from './processar';

const FORMULARIO: TextoNaPagina[] = [
  { texto: 'MUNICÍPIO: CIDADE EXEMPLO', x: 50, y: 800 },
  { texto: 'CPF: 001.234.567-89', x: 50, y: 780 },
  { texto: 'NIS: 000123456789', x: 50, y: 760 },
  { texto: 'NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: MARIA DA SILVA', x: 50, y: 740 },
  { texto: 'MOTIVO DO DESLIGAMENTO', x: 50, y: 700 },
  { texto: '(X) Mudança para outro Estado', x: 50, y: 680 },
];

async function pdfFile(nome: string, paginas: TextoNaPagina[][]): Promise<File> {
  return new File([await criarPdf(paginas)], nome, { type: 'application/pdf' });
}

describe('formatarReferencia', () => {
  it('formata dd/MM/yyyy com zeros à esquerda', () => {
    expect(formatarReferencia(new Date(2026, 8, 7))).toBe('07/09/2026');
    expect(formatarReferencia(new Date(2026, 11, 25))).toBe('25/12/2026');
  });
});

describe('processarArquivo', () => {
  it('extrai os campos e marca OK quando está completo', async () => {
    const registro = await processarArquivo(3, await pdfFile('ok.pdf', [FORMULARIO]), '09/10/2026');
    expect(registro).toEqual({
      id: 3,
      arquivo: 'ok.pdf',
      referencia: '09/10/2026',
      municipio: 'CIDADE EXEMPLO',
      cpf: '00123456789',
      nis: '000123456789',
      nome: 'MARIA DA SILVA',
      motivo: 'Mudança para outro Estado',
      status: 'OK',
      inconsistencias: [],
    });
  });

  it('marca REVISAR e lista os campos que faltam', async () => {
    const semCpf = FORMULARIO.filter((linha) => !linha.texto.startsWith('CPF'));
    const registro = await processarArquivo(1, await pdfFile('sem-cpf.pdf', [semCpf]), '09/10/2026');
    expect(registro.status).toBe('REVISAR');
    expect(registro.inconsistencias).toEqual(['CPF']);
  });

  it('sinaliza PDF sem texto como escaneado', async () => {
    const registro = await processarArquivo(1, await pdfFile('imagem.pdf', [[]]), '09/10/2026');
    expect(registro).toMatchObject({ status: 'REVISAR', cpf: '', inconsistencias: [MENSAGEM_PDF_ESCANEADO] });
  });

  it('converte falha do pdf.js em "erro de processamento" (arquivo de 0 bytes)', async () => {
    const vazio = new File([new Uint8Array(0)], 'vazio.pdf', { type: 'application/pdf' });
    const registro = await processarArquivo(1, vazio, '09/10/2026');
    expect(registro.status).toBe('REVISAR');
    expect(registro.inconsistencias).toHaveLength(1);
    expect(registro.inconsistencias[0]).toMatch(/^erro de processamento: /);
  });

  it('usa "arquivo.pdf" quando o nome vem vazio', async () => {
    const registro = await processarArquivo(1, await pdfFile('', [FORMULARIO]), '09/10/2026');
    expect(registro.arquivo).toBe('arquivo.pdf');
  });
});

describe('processarLote', () => {
  it('um arquivo ruim no meio não derruba o lote e os ids seguem a ordem', async () => {
    const arquivos = [
      await pdfFile('a.pdf', [FORMULARIO]),
      new File(['isto não é um pdf'], 'texto.pdf', { type: 'application/pdf' }),
      await pdfFile('c.pdf', [FORMULARIO]),
    ];
    const registros = await processarLote(arquivos, new Date(2026, 9, 9));
    expect(registros.map((r) => [r.id, r.arquivo, r.status])).toEqual([
      [1, 'a.pdf', 'OK'],
      [2, 'texto.pdf', 'REVISAR'],
      [3, 'c.pdf', 'OK'],
    ]);
    expect(registros.every((r) => r.referencia === '09/10/2026')).toBe(true);
  });

  it('reporta o progresso a cada arquivo', async () => {
    const onProgresso = vi.fn();
    const arquivos = [await pdfFile('a.pdf', [FORMULARIO]), await pdfFile('b.pdf', [FORMULARIO])];
    await processarLote(arquivos, new Date(), { onProgresso });
    expect(onProgresso.mock.calls).toEqual([[1, 2], [2, 2]]);
  });

  it('para quando o sinal é abortado', async () => {
    const controlador = new AbortController();
    const arquivos = [await pdfFile('a.pdf', [FORMULARIO]), await pdfFile('b.pdf', [FORMULARIO])];
    const registros = await processarLote(arquivos, new Date(), {
      signal: controlador.signal,
      onProgresso: () => controlador.abort(),
    });
    expect(registros).toHaveLength(1);
  });

  it('devolve lista vazia para lote vazio', async () => {
    expect(await processarLote([], new Date())).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/processar.test.ts`
Expected: FAIL com "Failed to resolve import './processar'".

- [ ] **Step 3: Implementar**

`frontend/src/lib/processar.ts`:

```ts
import type { DesligamentoRecord } from '../tipos';
import { extrairTexto } from './pdf/extrairTexto';
import { inconsistencies, parseText } from './parser/campos';

export const MENSAGEM_PDF_ESCANEADO = 'PDF sem texto selecionável (escaneado)';

export function formatarReferencia(data: Date): string {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getFullYear()}`;
}

function registroVazio(id: number, arquivo: string, referencia: string, problema: string): DesligamentoRecord {
  return {
    id,
    arquivo,
    referencia,
    municipio: '',
    cpf: '',
    nis: '',
    nome: '',
    motivo: '',
    status: 'REVISAR',
    inconsistencias: [problema],
  };
}

export async function processarArquivo(id: number, arquivo: File, referencia: string): Promise<DesligamentoRecord> {
  const nome = arquivo.name?.trim() ? arquivo.name : 'arquivo.pdf';
  try {
    const texto = await extrairTexto(await arquivo.arrayBuffer());
    if (!texto.trim()) return registroVazio(id, nome, referencia, MENSAGEM_PDF_ESCANEADO);
    const campos = parseText(texto);
    const problemas = inconsistencies(campos);
    return {
      id,
      arquivo: nome,
      referencia,
      ...campos,
      status: problemas.length === 0 ? 'OK' : 'REVISAR',
      inconsistencias: problemas,
    };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    return registroVazio(id, nome, referencia, `erro de processamento: ${mensagem}`);
  }
}

export interface OpcoesDoLote {
  onProgresso?: (feitos: number, total: number) => void;
  signal?: AbortSignal;
}

export async function processarLote(
  arquivos: File[],
  hoje: Date,
  opcoes: OpcoesDoLote = {},
): Promise<DesligamentoRecord[]> {
  const referencia = formatarReferencia(hoje);
  const registros: DesligamentoRecord[] = [];
  for (const [indice, arquivo] of arquivos.entries()) {
    if (opcoes.signal?.aborted) break;
    registros.push(await processarArquivo(indice + 1, arquivo, referencia));
    opcoes.onProgresso?.(registros.length, arquivos.length);
  }
  return registros;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/processar.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/processar.ts src/lib/processar.test.ts
git commit -m "feat: processamento de arquivos e lotes no navegador

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Fundação visual (tokens, fontes e estilos base)

**Files:**
- Modify: `frontend/tailwind.config.js`, `frontend/index.html`, `frontend/src/index.css`, `frontend/src/main.tsx`

**Interfaces:**
- Produces: cores Tailwind `eclipse`, `denim`, `honey`, `papel`, `tinta`, `suave`, `tijolo`, `honey-claro`, `denim-claro`; fontes `font-titulo` e `font-sans`; classes CSS usadas pelos componentes: `.botao-primario`, `.botao-secundario`, `.campo-celula`, `.tabular`.

- [ ] **Step 1: Tokens do Tailwind**

Substitua `frontend/tailwind.config.js` por:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        eclipse: '#213555',
        denim: '#4F709C',
        honey: '#E5D283',
        'honey-claro': '#F6EFC9',
        'denim-claro': '#E4EBF3',
        papel: '#F3F5F8',
        tinta: '#16233A',
        suave: '#5B6B82',
        tijolo: '#A33A2E',
      },
      fontFamily: {
        titulo: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Fontes locais e worker no `main.tsx`**

Substitua `frontend/src/main.tsx` por:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/bricolage-grotesque/600.css';
import '@fontsource/bricolage-grotesque/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import App from './App';
import './lib/pdf/configurarWorker';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 3: Título e descrição no `index.html`**

Em `frontend/index.html`, troque a linha do `<title>` por:

```html
    <title>Leitor de desligamentos</title>
    <meta name="description" content="Extrai, revisa e exporta dados de formulários PDF de desligamento. Tudo é processado no seu navegador." />
```

- [ ] **Step 4: Estilos base**

Substitua `frontend/src/index.css` por:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { font-family: 'IBM Plex Sans', system-ui, sans-serif; }
  body { margin: 0; background: #F3F5F8; color: #16233A; }
  h1, h2, p { margin: 0; }
  h1 { font-family: 'Bricolage Grotesque', system-ui, sans-serif; font-weight: 700; }
  :focus-visible { outline: 3px solid #4F709C; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
}

@layer components {
  .tabular { font-variant-numeric: tabular-nums; }

  .botao-primario,
  .botao-secundario {
    @apply inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold;
  }
  .botao-primario { @apply bg-eclipse text-white hover:bg-tinta; }
  .botao-secundario { @apply border border-denim bg-white text-eclipse hover:bg-denim-claro; }
  .botao-primario:disabled,
  .botao-secundario:disabled { @apply cursor-not-allowed opacity-50; }

  .campo-celula {
    @apply w-full min-w-[8rem] rounded border border-transparent bg-transparent px-2 py-1.5 text-sm;
  }
  .campo-celula:hover { @apply border-denim/40 bg-white; }
  .campo-celula:focus { @apply border-denim bg-white; }

  .menu-filtro > summary { @apply flex cursor-pointer list-none items-center gap-2 rounded-md border border-denim/40 bg-white px-3 py-2 text-sm text-eclipse; }
  .menu-filtro > summary::-webkit-details-marker { display: none; }
  .menu-filtro[open] > summary { @apply border-denim; }
}
```

- [ ] **Step 5: Verificar que o build ainda passa**

O `App.tsx` antigo continua no lugar até a Task 8; os estilos antigos que ele usa (`surface-card` etc.) deixam de existir, o que só afeta a aparência temporária.

Run: `npm run build`
Expected: `tsc` e `vite build` concluem sem erros. Anote o tamanho do bundle `dist/assets/*.js` (o `pdfjs-dist` aumenta bastante) apenas como referência.

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.js index.html src/index.css src/main.tsx
git commit -m "feat: tokens visuais, fontes locais e estilos base

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: ZonaUpload e BarraTriagem

**Files:**
- Create: `frontend/src/components/ZonaUpload.tsx`, `frontend/src/components/BarraTriagem.tsx`
- Test: `frontend/src/components/ZonaUpload.test.tsx`, `frontend/src/components/BarraTriagem.test.tsx`

**Interfaces:**
- Consumes: `Status` de `../tipos`.
- Produces:
  ```tsx
  export function ZonaUpload(props: {
    arquivos: File[];
    onAdicionar: (arquivos: File[]) => void;
    onRemover: (indice: number) => void;
  }): JSX.Element;

  export function BarraTriagem(props: {
    ok: number;
    revisar: number;
    statusAtivo: Status | null;
    onAlternar: (status: Status) => void; // clicar no status ativo desativa o filtro (decisão do chamador)
  }): JSX.Element;
  ```

- [ ] **Step 1: Escrever os testes que falham**

`frontend/src/components/BarraTriagem.test.tsx`:

```tsx
// @vitest-env jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BarraTriagem } from './BarraTriagem';

describe('BarraTriagem', () => {
  it('mostra as contagens e marca o status ativo', () => {
    render(<BarraTriagem ok={18} revisar={6} statusAtivo="REVISAR" onAlternar={() => {}} />);
    expect(screen.getByRole('button', { name: /18 OK/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /6 REVISAR/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicar em um trecho pede para alternar aquele status', async () => {
    const onAlternar = vi.fn();
    render(<BarraTriagem ok={18} revisar={6} statusAtivo={null} onAlternar={onAlternar} />);
    await userEvent.click(screen.getByRole('button', { name: /6 REVISAR/ }));
    expect(onAlternar).toHaveBeenCalledWith('REVISAR');
  });

  it('não mostra o trecho de um status sem registros', () => {
    render(<BarraTriagem ok={5} revisar={0} statusAtivo={null} onAlternar={() => {}} />);
    expect(screen.queryByRole('button', { name: /REVISAR/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /5 OK/ })).toBeInTheDocument();
  });

  it('mantém o trecho do filtro ativo mesmo com zero registros, para o usuário poder desativá-lo', async () => {
    const onAlternar = vi.fn();
    render(<BarraTriagem ok={5} revisar={0} statusAtivo="REVISAR" onAlternar={onAlternar} />);
    await userEvent.click(screen.getByRole('button', { name: /0 REVISAR/ }));
    expect(onAlternar).toHaveBeenCalledWith('REVISAR');
  });
});
```

`frontend/src/components/ZonaUpload.test.tsx`:

```tsx
// @vitest-env jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ZonaUpload } from './ZonaUpload';

const pdf = (nome: string) => new File(['x'], nome, { type: 'application/pdf' });

describe('ZonaUpload', () => {
  it('lista os arquivos e permite removê-los', async () => {
    const onRemover = vi.fn();
    render(<ZonaUpload arquivos={[pdf('a.pdf'), pdf('b.pdf')]} onAdicionar={() => {}} onRemover={onRemover} />);
    expect(screen.getByText('a.pdf')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remover b.pdf' }));
    expect(onRemover).toHaveBeenCalledWith(1);
  });

  it('adiciona os PDFs escolhidos no seletor', async () => {
    const onAdicionar = vi.fn();
    render(<ZonaUpload arquivos={[]} onAdicionar={onAdicionar} onRemover={() => {}} />);
    await userEvent.upload(screen.getByLabelText(/escolha arquivos/i), [pdf('a.pdf'), pdf('b.pdf')]);
    expect(onAdicionar).toHaveBeenCalledTimes(1);
    expect(onAdicionar.mock.calls[0][0].map((f: File) => f.name)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('ao soltar arquivos aceita só PDFs', () => {
    const onAdicionar = vi.fn();
    render(<ZonaUpload arquivos={[]} onAdicionar={onAdicionar} onRemover={() => {}} />);
    const zona = screen.getByTestId('zona-upload');
    const texto = new File(['x'], 'nota.txt', { type: 'text/plain' });
    fireEvent.drop(zona, { dataTransfer: { files: [pdf('a.pdf'), texto] } });
    expect(onAdicionar.mock.calls[0][0].map((f: File) => f.name)).toEqual(['a.pdf']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components`
Expected: FAIL com "Failed to resolve import './BarraTriagem'".

- [ ] **Step 3: Implementar `BarraTriagem`**

`frontend/src/components/BarraTriagem.tsx`:

```tsx
import type { Status } from '../tipos';

interface Props {
  ok: number;
  revisar: number;
  statusAtivo: Status | null;
  onAlternar: (status: Status) => void;
}

const ESTILO: Record<Status, string> = {
  OK: 'bg-denim text-white',
  REVISAR: 'bg-honey text-eclipse',
};

export function BarraTriagem({ ok, revisar, statusAtivo, onAlternar }: Props) {
  const trechos: { status: Status; quantidade: number }[] = [
    { status: 'OK' as const, quantidade: ok },
    { status: 'REVISAR' as const, quantidade: revisar },
  ].filter((trecho) => trecho.quantidade > 0 || trecho.status === statusAtivo);

  return (
    <div role="group" aria-label="Triagem por status" className="flex h-11 overflow-hidden rounded-md">
      {trechos.map(({ status, quantidade }) => {
        const ativo = statusAtivo === status;
        const apagado = statusAtivo !== null && !ativo;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={ativo}
            onClick={() => onAlternar(status)}
            style={{ flexGrow: quantidade }}
            className={`tabular min-w-[7rem] px-4 text-left text-sm font-semibold ${ESTILO[status]} ${
              apagado ? 'opacity-40' : ''
            } ${ativo ? 'ring-2 ring-inset ring-eclipse' : ''}`}
          >
            {quantidade} {status}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Implementar `ZonaUpload`**

`frontend/src/components/ZonaUpload.tsx`:

```tsx
import { FileText, Upload, X } from 'lucide-react';
import { useState } from 'react';

interface Props {
  arquivos: File[];
  onAdicionar: (arquivos: File[]) => void;
  onRemover: (indice: number) => void;
}

function ehPdf(arquivo: File): boolean {
  return arquivo.type === 'application/pdf' || arquivo.name.toLowerCase().endsWith('.pdf');
}

export function ZonaUpload({ arquivos, onAdicionar, onRemover }: Props) {
  const [arrastando, setArrastando] = useState(false);

  return (
    <div>
      <label
        data-testid="zona-upload"
        onDragOver={(evento) => {
          evento.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(evento) => {
          evento.preventDefault();
          setArrastando(false);
          onAdicionar(Array.from(evento.dataTransfer.files).filter(ehPdf));
        }}
        className={`flex cursor-pointer items-center gap-3 rounded-md border border-dashed px-5 py-6 text-eclipse ${
          arrastando ? 'border-eclipse bg-denim-claro' : 'border-denim bg-white'
        }`}
      >
        <Upload size={22} aria-hidden="true" />
        <span className="font-medium">Solte os PDFs aqui ou escolha arquivos</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          aria-label="Solte os PDFs aqui ou escolha arquivos"
          onChange={(evento) => {
            onAdicionar(Array.from(evento.target.files ?? []));
            evento.target.value = '';
          }}
        />
      </label>
      {arquivos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {arquivos.map((arquivo, indice) => (
            <li
              key={`${arquivo.name}-${indice}`}
              className="flex max-w-full items-center gap-2 rounded-full bg-denim-claro px-3 py-1.5 text-sm text-eclipse"
            >
              <FileText size={14} aria-hidden="true" />
              <span className="truncate">{arquivo.name}</span>
              <button
                type="button"
                aria-label={`Remover ${arquivo.name}`}
                onClick={() => onRemover(indice)}
                className="text-suave hover:text-tinta"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/components`
Expected: PASS (7 testes). Se `getByLabelText(/escolha arquivos/i)` encontrar dois elementos (label e input), mantenha só o `aria-label` do input e troque o texto do `<span>` para um elemento sem associação ao input, ou use `getByTestId` no teste; o comportamento exigido é "o input aceita upload".

- [ ] **Step 6: Commit**

```bash
git add src/components
git commit -m "feat: componentes ZonaUpload e BarraTriagem

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Filtros, TabelaResultados e BarraExportar

**Files:**
- Create: `frontend/src/components/Filtros.tsx`, `TabelaResultados.tsx`, `BarraExportar.tsx`
- Test: `frontend/src/components/Filtros.test.tsx`, `TabelaResultados.test.tsx`, `BarraExportar.test.tsx`

**Interfaces:**
- Consumes: `DesligamentoRecord`, `CampoEditavel`, `CAMPOS_EDITAVEIS` de `../tipos`; `gerarCsv`, `gerarXlsx`, `somenteRevisar` de `../lib/exportar/*`; `baixarBlob` de `../lib/exportar/baixar`.
- Produces:
  ```tsx
  export function Filtros(props: {
    municipios: string[]; motivos: string[];
    municipiosSelecionados: string[]; motivosSelecionados: string[];
    onMunicipios: (valores: string[]) => void; onMotivos: (valores: string[]) => void;
  }): JSX.Element;

  export function TabelaResultados(props: {
    registros: DesligamentoRecord[];
    onEditar: (id: number, campo: CampoEditavel, valor: string) => void;
    onIniciarEdicao: (id: number) => void;
    onEncerrarEdicao: () => void;
  }): JSX.Element;

  export function BarraExportar(props: {
    registros: DesligamentoRecord[];
    onErro: (mensagem: string) => void;
  }): JSX.Element;
  ```

- [ ] **Step 1: Escrever os testes que falham**

`frontend/src/components/Filtros.test.tsx`:

```tsx
// @vitest-env jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Filtros } from './Filtros';

const base = {
  municipios: ['CIDADE A', 'CIDADE B'],
  motivos: ['Mudança'],
  municipiosSelecionados: [] as string[],
  motivosSelecionados: [] as string[],
  onMunicipios: () => {},
  onMotivos: () => {},
};

describe('Filtros', () => {
  it('marcar um município informa a nova seleção', async () => {
    const onMunicipios = vi.fn();
    render(<Filtros {...base} onMunicipios={onMunicipios} />);
    await userEvent.click(screen.getByText('Município'));
    await userEvent.click(screen.getByLabelText('CIDADE B'));
    expect(onMunicipios).toHaveBeenCalledWith(['CIDADE B']);
  });

  it('desmarcar remove o item da seleção e o resumo mostra a quantidade', async () => {
    const onMunicipios = vi.fn();
    render(<Filtros {...base} municipiosSelecionados={['CIDADE A', 'CIDADE B']} onMunicipios={onMunicipios} />);
    expect(screen.getByText('Município (2)')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Município (2)'));
    await userEvent.click(screen.getByLabelText('CIDADE A'));
    expect(onMunicipios).toHaveBeenCalledWith(['CIDADE B']);
  });
});
```

`frontend/src/components/TabelaResultados.test.tsx`:

```tsx
// @vitest-env jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DesligamentoRecord } from '../tipos';
import { TabelaResultados } from './TabelaResultados';

function registro(parcial: Partial<DesligamentoRecord>): DesligamentoRecord {
  return {
    id: 1,
    arquivo: 'a.pdf',
    referencia: '09/10/2026',
    municipio: 'CIDADE',
    cpf: '12345678909',
    nis: '123',
    nome: 'ANA',
    motivo: 'Mudança',
    status: 'OK',
    inconsistencias: [],
    ...parcial,
  };
}

const acoes = { onEditar: () => {}, onIniciarEdicao: () => {}, onEncerrarEdicao: () => {} };

describe('TabelaResultados', () => {
  it('editar uma célula informa id, campo e valor', async () => {
    const onEditar = vi.fn();
    render(<TabelaResultados {...acoes} onEditar={onEditar} registros={[registro({ nome: '' })]} />);
    await userEvent.type(screen.getByLabelText('nome de a.pdf'), 'B');
    expect(onEditar).toHaveBeenCalledWith(1, 'nome', 'B');
  });

  it('avisa o início e o fim da edição de uma célula', async () => {
    const onIniciarEdicao = vi.fn();
    const onEncerrarEdicao = vi.fn();
    render(<TabelaResultados {...acoes} onIniciarEdicao={onIniciarEdicao} onEncerrarEdicao={onEncerrarEdicao} registros={[registro({})]} />);
    await userEvent.click(screen.getByLabelText('cpf de a.pdf'));
    expect(onIniciarEdicao).toHaveBeenCalledWith(1);
    await userEvent.tab();
    expect(onEncerrarEdicao).toHaveBeenCalled();
  });

  it('linha REVISAR mostra as pendências ao expandir', async () => {
    const revisar = registro({ status: 'REVISAR', inconsistencias: ['CPF', 'NIS'], cpf: '', nis: '' });
    render(<TabelaResultados {...acoes} registros={[revisar]} />);
    expect(screen.queryByRole('list', { name: 'Pendências de a.pdf' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /REVISAR/ }));
    expect(screen.getByRole('list', { name: 'Pendências de a.pdf' })).toHaveTextContent('CPF');
    expect(screen.getByRole('list', { name: 'Pendências de a.pdf' })).toHaveTextContent('NIS');
  });

  it('linha OK mostra "OK" sem botão de pendências', () => {
    render(<TabelaResultados {...acoes} registros={[registro({})]} />);
    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /REVISAR/ })).not.toBeInTheDocument();
  });

  it('explica quando nenhum registro corresponde aos filtros', () => {
    render(<TabelaResultados {...acoes} registros={[]} />);
    expect(screen.getByText('Nenhum registro corresponde aos filtros.')).toBeInTheDocument();
  });
});
```

`frontend/src/components/BarraExportar.test.tsx`:

```tsx
// @vitest-env jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesligamentoRecord } from '../tipos';

vi.mock('../lib/exportar/baixar', () => ({ baixarBlob: vi.fn() }));
// O XLSX real é coberto em lib/exportar; aqui só interessa quais registros chegam ao gerador.
vi.mock('../lib/exportar/xlsx', () => ({ gerarXlsx: vi.fn(async () => new Blob(['x'])) }));

import { baixarBlob } from '../lib/exportar/baixar';
import { gerarXlsx } from '../lib/exportar/xlsx';
import { BarraExportar } from './BarraExportar';

function registro(id: number, status: 'OK' | 'REVISAR'): DesligamentoRecord {
  return {
    id,
    arquivo: `${id}.pdf`,
    referencia: '09/10/2026',
    municipio: 'C',
    cpf: '12345678909',
    nis: '1',
    nome: 'N',
    motivo: 'M',
    status,
    inconsistencias: [],
  };
}

describe('BarraExportar', () => {
  beforeEach(() => {
    vi.mocked(baixarBlob).mockClear();
    vi.mocked(gerarXlsx).mockClear();
  });

  it('baixa o CSV com o nome esperado', async () => {
    render(<BarraExportar registros={[registro(1, 'OK')]} onErro={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }));
    expect(baixarBlob).toHaveBeenCalledTimes(1);
    expect(vi.mocked(baixarBlob).mock.calls[0][1]).toBe('desligamentos.csv');
  });

  it('baixa o XLSX completo e o XLSX somente com REVISAR', async () => {
    render(<BarraExportar registros={[registro(1, 'OK'), registro(2, 'REVISAR')]} onErro={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Baixar XLSX' }));
    await userEvent.click(screen.getByRole('button', { name: 'Baixar somente REVISAR' }));
    const nomes = vi.mocked(baixarBlob).mock.calls.map((chamada) => chamada[1]);
    expect(nomes).toEqual(['desligamentos.xlsx', 'desligamentos_revisar.xlsx']);
    expect(vi.mocked(gerarXlsx).mock.calls[0][0]).toHaveLength(2);
    expect(vi.mocked(gerarXlsx).mock.calls[1][0].map((r) => r.id)).toEqual([2]);
  });

  it('desabilita "somente REVISAR" quando não há registros REVISAR', () => {
    render(<BarraExportar registros={[registro(1, 'OK')]} onErro={() => {}} />);
    expect(screen.getByRole('button', { name: 'Baixar somente REVISAR' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components`
Expected: FAIL com "Failed to resolve import './Filtros'".

- [ ] **Step 3: Implementar `Filtros`**

`frontend/src/components/Filtros.tsx`:

```tsx
import { ChevronDown } from 'lucide-react';

interface MenuProps {
  titulo: string;
  opcoes: string[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
}

function MenuFiltro({ titulo, opcoes, selecionados, onChange }: MenuProps) {
  const resumo = selecionados.length ? `${titulo} (${selecionados.length})` : titulo;
  return (
    <details className="menu-filtro relative">
      <summary>
        {resumo}
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="absolute z-20 mt-1 max-h-72 min-w-[16rem] overflow-auto rounded-md border border-denim/40 bg-white p-2 shadow-lg">
        {opcoes.length === 0 && <p className="px-2 py-1 text-sm text-suave">Nenhum valor encontrado.</p>}
        {opcoes.map((opcao) => (
          <label key={opcao} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-denim-claro">
            <input
              type="checkbox"
              checked={selecionados.includes(opcao)}
              onChange={() =>
                onChange(selecionados.includes(opcao) ? selecionados.filter((valor) => valor !== opcao) : [...selecionados, opcao])
              }
            />
            {opcao}
          </label>
        ))}
      </div>
    </details>
  );
}

interface Props {
  municipios: string[];
  motivos: string[];
  municipiosSelecionados: string[];
  motivosSelecionados: string[];
  onMunicipios: (valores: string[]) => void;
  onMotivos: (valores: string[]) => void;
}

export function Filtros(props: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <MenuFiltro titulo="Município" opcoes={props.municipios} selecionados={props.municipiosSelecionados} onChange={props.onMunicipios} />
      <MenuFiltro titulo="Motivo" opcoes={props.motivos} selecionados={props.motivosSelecionados} onChange={props.onMotivos} />
    </div>
  );
}
```

- [ ] **Step 4: Implementar `TabelaResultados`**

`frontend/src/components/TabelaResultados.tsx`:

```tsx
import { Fragment, useState } from 'react';
import { CAMPOS_EDITAVEIS, type CampoEditavel, type DesligamentoRecord } from '../tipos';

interface Props {
  registros: DesligamentoRecord[];
  onEditar: (id: number, campo: CampoEditavel, valor: string) => void;
  onIniciarEdicao: (id: number) => void;
  onEncerrarEdicao: () => void;
}

const TITULOS: Record<CampoEditavel, string> = {
  municipio: 'Município',
  cpf: 'CPF',
  nis: 'NIS',
  nome: 'Nome',
  motivo: 'Motivo',
};

const CAMPOS_NUMERICOS: readonly CampoEditavel[] = ['cpf', 'nis'];
const COLUNAS = CAMPOS_EDITAVEIS.length + 3;

export function TabelaResultados({ registros, onEditar, onIniciarEdicao, onEncerrarEdicao }: Props) {
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());

  function alternar(id: number) {
    setExpandidos((atuais) => {
      const proximos = new Set(atuais);
      if (!proximos.delete(id)) proximos.add(id);
      return proximos;
    });
  }

  if (registros.length === 0) {
    return <p className="px-1 py-8 text-sm text-suave">Nenhum registro corresponde aos filtros.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-denim/30 bg-white">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="text-suave">
            {['Arquivo', 'Referência', ...CAMPOS_EDITAVEIS.map((campo) => TITULOS[campo]), 'Status'].map((titulo) => (
              <th key={titulo} className="sticky top-0 whitespace-nowrap border-b border-denim/30 bg-white px-3 py-3 font-semibold">
                {titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {registros.map((registro) => {
            const revisar = registro.status === 'REVISAR';
            const aberto = expandidos.has(registro.id);
            return (
              <Fragment key={registro.id}>
                <tr className={`border-b border-denim/15 ${revisar ? 'bg-honey-claro' : ''}`}>
                  <td className={`whitespace-nowrap px-3 py-2 ${revisar ? 'shadow-[inset_4px_0_0_#E5D283]' : ''}`}>
                    {registro.arquivo}
                  </td>
                  <td className="tabular whitespace-nowrap px-3 py-2">{registro.referencia}</td>
                  {CAMPOS_EDITAVEIS.map((campo) => (
                    <td key={campo} className="px-1 py-1">
                      <input
                        className={`campo-celula ${CAMPOS_NUMERICOS.includes(campo) ? 'tabular' : ''}`}
                        aria-label={`${campo} de ${registro.arquivo}`}
                        value={registro[campo]}
                        onFocus={() => onIniciarEdicao(registro.id)}
                        onBlur={onEncerrarEdicao}
                        onChange={(evento) => onEditar(registro.id, campo, evento.target.value)}
                      />
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">
                    {revisar ? (
                      <button
                        type="button"
                        aria-expanded={aberto}
                        onClick={() => alternar(registro.id)}
                        className="rounded px-2 py-1 text-eclipse underline decoration-eclipse/40 underline-offset-4"
                      >
                        REVISAR
                        <span className="ml-2 font-normal text-suave">
                          {registro.inconsistencias.length} {registro.inconsistencias.length === 1 ? 'pendência' : 'pendências'}
                        </span>
                      </button>
                    ) : (
                      <span className="text-denim">OK</span>
                    )}
                  </td>
                </tr>
                {revisar && aberto && (
                  <tr className="border-b border-denim/15 bg-honey-claro">
                    <td colSpan={COLUNAS} className="px-3 pb-3 pl-6">
                      <ul aria-label={`Pendências de ${registro.arquivo}`} className="list-disc pl-5 text-sm">
                        {registro.inconsistencias.map((pendencia) => (
                          <li key={pendencia}>{pendencia}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Implementar `BarraExportar`**

`frontend/src/components/BarraExportar.tsx`:

```tsx
import { Download } from 'lucide-react';
import { baixarBlob } from '../lib/exportar/baixar';
import { somenteRevisar } from '../lib/exportar/colunas';
import { gerarCsv } from '../lib/exportar/csv';
import { gerarXlsx } from '../lib/exportar/xlsx';
import type { DesligamentoRecord } from '../tipos';

interface Props {
  registros: DesligamentoRecord[];
  onErro: (mensagem: string) => void;
}

export function BarraExportar({ registros, onErro }: Props) {
  const pendentes = somenteRevisar(registros);

  async function exportar(gerar: () => Promise<Blob> | Blob, nomeDoArquivo: string) {
    try {
      baixarBlob(await gerar(), nomeDoArquivo);
    } catch (erro) {
      onErro(erro instanceof Error ? `Não foi possível gerar o arquivo: ${erro.message}` : 'Não foi possível gerar o arquivo.');
    }
  }

  return (
    <div className="sticky bottom-0 border-t border-denim/30 bg-papel/95 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 sm:flex-row md:px-10">
        <button type="button" className="botao-primario" onClick={() => exportar(() => gerarXlsx(registros), 'desligamentos.xlsx')}>
          <Download size={16} aria-hidden="true" />
          Baixar XLSX
        </button>
        <button
          type="button"
          className="botao-secundario"
          onClick={() => exportar(() => new Blob([gerarCsv(registros)], { type: 'text/csv;charset=utf-8' }), 'desligamentos.csv')}
        >
          <Download size={16} aria-hidden="true" />
          Baixar CSV
        </button>
        <button
          type="button"
          className="botao-secundario"
          disabled={pendentes.length === 0}
          onClick={() => exportar(() => gerarXlsx(pendentes), 'desligamentos_revisar.xlsx')}
        >
          <Download size={16} aria-hidden="true" />
          Baixar somente REVISAR
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/components`
Expected: PASS (todos os testes das Tasks 6 e 7).

- [ ] **Step 7: Commit**

```bash
git add src/components
git commit -m "feat: Filtros, TabelaResultados e BarraExportar

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: App.tsx ligando tudo

**Files:**
- Modify: `frontend/src/App.tsx` (reescrita completa)
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `processarLote(arquivos, hoje, { onProgresso, signal })` de `./lib/processar`; `recalcular` de `./lib/parser/campos`; todos os componentes das Tasks 6 e 7.
- Produces: `export default function App(): JSX.Element`.

- [ ] **Step 1: Escrever os testes que falham**

`frontend/src/App.test.tsx`:

```tsx
// @vitest-env jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesligamentoRecord } from './tipos';

vi.mock('./lib/processar', () => ({ processarLote: vi.fn() }));

import App from './App';
import { processarLote } from './lib/processar';

function registro(id: number, parcial: Partial<DesligamentoRecord> = {}): DesligamentoRecord {
  return {
    id,
    arquivo: `${id}.pdf`,
    referencia: '09/10/2026',
    municipio: 'CIDADE',
    cpf: '12345678909',
    nis: '123',
    nome: 'ANA',
    motivo: 'Mudança',
    status: 'OK',
    inconsistencias: [],
    ...parcial,
  };
}

const revisar = (id: number) =>
  registro(id, { nome: '', status: 'REVISAR', inconsistencias: ['NOME'] });

async function enviarEProcessar(...nomes: string[]) {
  const arquivos = nomes.map((nome) => new File(['x'], nome, { type: 'application/pdf' }));
  await userEvent.upload(screen.getByLabelText(/escolha arquivos/i), arquivos);
  await userEvent.click(screen.getByRole('button', { name: /Processar arquivos/ }));
}

describe('App', () => {
  beforeEach(() => vi.mocked(processarLote).mockReset());

  it('processa os arquivos e mostra a triagem e a tabela', async () => {
    vi.mocked(processarLote).mockResolvedValue([registro(1), revisar(2)]);
    render(<App />);
    await enviarEProcessar('1.pdf', '2.pdf');
    expect(await screen.findByRole('button', { name: /1 OK/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 REVISAR/ })).toBeInTheDocument();
    expect(screen.getByLabelText('nome de 2.pdf')).toBeInTheDocument();
  });

  it('exige ao menos um PDF para processar', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Processar arquivos/ }));
    expect(screen.getByText('Selecione ao menos um PDF.')).toBeInTheDocument();
    expect(processarLote).not.toHaveBeenCalled();
  });

  it('clicar em REVISAR na triagem filtra e clicar de novo remove o filtro', async () => {
    vi.mocked(processarLote).mockResolvedValue([registro(1), revisar(2)]);
    render(<App />);
    await enviarEProcessar('1.pdf', '2.pdf');
    await userEvent.click(await screen.findByRole('button', { name: /1 REVISAR/ }));
    expect(screen.queryByLabelText('nome de 1.pdf')).not.toBeInTheDocument();
    expect(screen.getByLabelText('nome de 2.pdf')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /1 REVISAR/ }));
    expect(screen.getByLabelText('nome de 1.pdf')).toBeInTheDocument();
  });

  it('editar uma célula recalcula o status', async () => {
    vi.mocked(processarLote).mockResolvedValue([revisar(1)]);
    render(<App />);
    await enviarEProcessar('1.pdf');
    await userEvent.type(await screen.findByLabelText('nome de 1.pdf'), 'B');
    expect(await screen.findByRole('button', { name: /1 OK/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^\d+ REVISAR/ })).not.toBeInTheDocument();
  });

  it('com o filtro REVISAR ativo, a linha editada continua visível até sair da célula', async () => {
    vi.mocked(processarLote).mockResolvedValue([registro(1), revisar(2)]);
    render(<App />);
    await enviarEProcessar('1.pdf', '2.pdf');
    await userEvent.click(await screen.findByRole('button', { name: /1 REVISAR/ }));
    const campo = screen.getByLabelText('nome de 2.pdf');
    await userEvent.type(campo, 'B');
    expect(screen.getByLabelText('nome de 2.pdf')).toHaveValue('B');
    await userEvent.tab();
    await waitFor(() => expect(screen.queryByLabelText('nome de 2.pdf')).not.toBeInTheDocument());
  });

  it('Limpar dados zera tudo e descarta o resultado de um lote em andamento', async () => {
    let concluir: (registros: DesligamentoRecord[]) => void = () => {};
    vi.mocked(processarLote).mockImplementation(
      () => new Promise<DesligamentoRecord[]>((resolver) => { concluir = resolver; }),
    );
    render(<App />);
    await enviarEProcessar('1.pdf');
    await userEvent.click(screen.getByRole('button', { name: 'Limpar dados' }));
    concluir([registro(1)]);
    await waitFor(() => expect(screen.queryByLabelText('nome de 1.pdf')).not.toBeInTheDocument());
    expect(within(document.body).queryByText('1.pdf')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Processar arquivos/ })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL (o `App.tsx` antigo busca `/api` e não tem esses componentes).

- [ ] **Step 3: Reescrever o `App.tsx`**

Substitua todo o conteúdo de `frontend/src/App.tsx` por:

```tsx
import { LoaderCircle, Play, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { BarraExportar } from './components/BarraExportar';
import { BarraTriagem } from './components/BarraTriagem';
import { Filtros } from './components/Filtros';
import { TabelaResultados } from './components/TabelaResultados';
import { ZonaUpload } from './components/ZonaUpload';
import { recalcular } from './lib/parser/campos';
import { processarLote } from './lib/processar';
import type { CampoEditavel, DesligamentoRecord, Status } from './tipos';

function valoresUnicos(registros: DesligamentoRecord[], campo: 'municipio' | 'motivo'): string[] {
  return [...new Set(registros.map((registro) => registro[campo]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
}

export default function App() {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [registros, setRegistros] = useState<DesligamentoRecord[]>([]);
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [motivos, setMotivos] = useState<string[]>([]);
  const [statusAtivo, setStatusAtivo] = useState<Status | null>(null);
  const [idEmEdicao, setIdEmEdicao] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });
  const [erro, setErro] = useState('');
  const controladorRef = useRef<AbortController | null>(null);

  const visiveis = useMemo(
    () =>
      registros.filter((registro) => {
        // A linha em edição fica visível mesmo que a edição mude seu status.
        if (registro.id === idEmEdicao) return true;
        if (municipios.length && !municipios.includes(registro.municipio)) return false;
        if (motivos.length && !motivos.includes(registro.motivo)) return false;
        if (statusAtivo && registro.status !== statusAtivo) return false;
        return true;
      }),
    [registros, municipios, motivos, statusAtivo, idEmEdicao],
  );

  const totalOk = registros.filter((registro) => registro.status === 'OK').length;
  const totalRevisar = registros.length - totalOk;

  function zerarFiltros() {
    setMunicipios([]);
    setMotivos([]);
    setStatusAtivo(null);
    setIdEmEdicao(null);
  }

  async function processar() {
    if (!arquivos.length) {
      setErro('Selecione ao menos um PDF.');
      return;
    }
    controladorRef.current?.abort();
    const controlador = new AbortController();
    controladorRef.current = controlador;
    setCarregando(true);
    setErro('');
    setProgresso({ feitos: 0, total: arquivos.length });
    try {
      const resultado = await processarLote(arquivos, new Date(), {
        signal: controlador.signal,
        onProgresso: (feitos, total) => {
          if (!controlador.signal.aborted) setProgresso({ feitos, total });
        },
      });
      if (controlador.signal.aborted) return;
      setRegistros(resultado);
      zerarFiltros();
    } catch (falha) {
      if (!controlador.signal.aborted) setErro(falha instanceof Error ? falha.message : 'Erro inesperado.');
    } finally {
      if (controladorRef.current === controlador) {
        controladorRef.current = null;
        setCarregando(false);
      }
    }
  }

  function limpar() {
    controladorRef.current?.abort();
    controladorRef.current = null;
    setCarregando(false);
    setArquivos([]);
    setRegistros([]);
    setErro('');
    zerarFiltros();
  }

  function editar(id: number, campo: CampoEditavel, valor: string) {
    setRegistros((atuais) =>
      atuais.map((registro) => (registro.id === id ? recalcular({ ...registro, [campo]: valor }) : registro)),
    );
  }

  return (
    <div className="min-h-screen bg-papel">
      <header className="bg-eclipse text-white">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-1 px-4 py-6 md:flex-row md:items-end md:justify-between md:px-10">
          <h1 className="text-3xl md:text-4xl">Leitor de desligamentos</h1>
          <p className="text-sm text-white/80">Seus PDFs não saem deste computador.</p>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 pb-8 pt-6 md:px-10">
        <ZonaUpload
          arquivos={arquivos}
          onAdicionar={(novos) => setArquivos((atuais) => [...atuais, ...novos])}
          onRemover={(indice) => setArquivos((atuais) => atuais.filter((_, posicao) => posicao !== indice))}
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="button" className="botao-primario" onClick={processar} disabled={carregando}>
            {carregando ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
            {carregando ? `Processando ${progresso.feitos} de ${progresso.total}` : 'Processar arquivos'}
          </button>
          <button type="button" className="botao-secundario" onClick={limpar}>
            <Trash2 size={16} aria-hidden="true" />
            Limpar dados
          </button>
        </div>
        {erro && (
          <p role="alert" className="mt-3 text-sm font-medium text-tijolo">
            {erro}
          </p>
        )}

        {registros.length === 0 ? (
          <p className="mt-10 text-sm text-suave">Escolha um ou mais PDFs e clique em Processar arquivos.</p>
        ) : (
          <section className="mt-8 space-y-4" aria-label="Resultados">
            <BarraTriagem
              ok={totalOk}
              revisar={totalRevisar}
              statusAtivo={statusAtivo}
              onAlternar={(status) => setStatusAtivo((atual) => (atual === status ? null : status))}
            />
            <Filtros
              municipios={valoresUnicos(registros, 'municipio')}
              motivos={valoresUnicos(registros, 'motivo')}
              municipiosSelecionados={municipios}
              motivosSelecionados={motivos}
              onMunicipios={setMunicipios}
              onMotivos={setMotivos}
            />
            <TabelaResultados
              registros={visiveis}
              onEditar={editar}
              onIniciarEdicao={setIdEmEdicao}
              onEncerrarEdicao={() => setIdEmEdicao(null)}
            />
          </section>
        )}
      </main>

      {registros.length > 0 && <BarraExportar registros={registros} onErro={setErro} />}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (6 testes). Se "a linha editada continua visível" falhar porque o `blur` dispara antes de o React reavaliar, confirme que `onEncerrarEdicao` só é chamado no `onBlur` do input (já é) e que `setIdEmEdicao(null)` roda no mesmo evento.

- [ ] **Step 5: Rodar a suíte inteira, tipos e build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: todos os testes passam, sem erros de tipo, build conclui.

- [ ] **Step 6: Conferir visualmente no navegador**

Run: `npm run dev` (em segundo plano) e abra `http://localhost:5173`. Gere um PDF sintético com o formulário (por exemplo, rodando um script rápido com `pdf-lib` fora do repositório) e processe-o. Confirme: faixa Eclipse com a frase de privacidade, barra de triagem, linha `REVISAR` em honey com a pendência expansível, rodapé fixo, foco visível ao tabular, layout utilizável com a janela estreita (largura de celular). Pare o servidor ao terminar. Se algo destoar do desenho da spec (seção 8), corrija nos arquivos de componente e rode `npm test` de novo.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: App ligada às novas camadas, sem backend

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Vercel, CSP e CI

**Files:**
- Create: `frontend/vercel.json`
- Test: `frontend/src/vercel.test.ts`
- Modify: `.github/workflows/testes.yml`

- [ ] **Step 1: Escrever o teste que falha**

`frontend/src/vercel.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface Cabecalho { key: string; value: string }
interface ConfigVercel { headers: { source: string; headers: Cabecalho[] }[] }

function csp(): string {
  const arquivo = fileURLToPath(new URL('../vercel.json', import.meta.url));
  const config = JSON.parse(readFileSync(arquivo, 'utf-8')) as ConfigVercel;
  const cabecalho = config.headers.flatMap((regra) => regra.headers).find((h) => h.key === 'Content-Security-Policy');
  if (!cabecalho) throw new Error('vercel.json sem Content-Security-Policy');
  return cabecalho.value;
}

describe('vercel.json', () => {
  it('só permite conexões para a própria origem', () => {
    expect(csp()).toMatch(/connect-src 'self'(;|$)/);
  });

  it('não libera nenhum host externo em nenhuma diretiva', () => {
    expect(csp()).not.toMatch(/https?:\/\//);
  });

  it('permite o worker do pdf.js da própria origem', () => {
    expect(csp()).toMatch(/worker-src 'self'/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/vercel.test.ts`
Expected: FAIL (ENOENT ao ler `vercel.json`).

- [ ] **Step 3: Criar o `vercel.json`**

`frontend/vercel.json`:

```json
{
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
        },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "no-referrer" }
      ]
    }
  ]
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/vercel.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Atualizar o CI**

Substitua todo o conteúdo de `.github/workflows/testes.yml` por:

```yaml
name: Testes

on:
  push:
    branches: [main]
  pull_request:

jobs:
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm test
      - run: npm run build
```

Isso remove o job de Maven; o backend sai do repositório na Task 10.

- [ ] **Step 6: Commit e push da branch**

```bash
git add vercel.json src/vercel.test.ts ../.github/workflows/testes.yml
git commit -m "feat: CSP da Vercel e CI só com Node

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin migracao-navegador
```

- [ ] **Step 7: Publicar um preview na Vercel (ação do usuário)**

Peça ao usuário para importar o repositório na Vercel com **Root Directory = `frontend`** e Framework Preset "Vite", e abrir o preview da branch `migracao-navegador`. Peça que processe um PDF sintético com o DevTools aberto (aba Console) e confirme: o PDF é processado, a tabela aparece, os downloads funcionam e **não há erros de CSP** no console. Se o console acusar bloqueio do worker ou de WebAssembly, acrescente a origem exata ao CSP em `vercel.json` (por exemplo `'wasm-unsafe-eval'` em `script-src`), mantenha `connect-src 'self'`, rode `npx vitest run src/vercel.test.ts` e faça novo commit.

---

### Task 10: Paridade com PDFs reais e remoção do Java

**Files:**
- Delete: `backend/`, `Iniciar Leitor.bat`, `scripts/`
- Modify: `README.md`, `.gitignore`
- Temporário (não commitar): `frontend/src/paridade.local.test.ts`, scripts no diretório de rascunho

- [ ] **Step 1: Pedir os PDFs reais ao usuário**

Peça ao usuário uma pasta com um ou mais formulários reais, **fora do repositório** (por exemplo `C:\Users\lucas\Desktop\pdfs-paridade`). Não copie esses arquivos para dentro do repositório. Anote o caminho como `PASTA_PDFS`. Sem esses PDFs, não prossiga para o Step 5: a remoção do Java depende da comparação.

- [ ] **Step 2: Gerar a saída do parser TypeScript**

Crie `frontend/src/paridade.local.test.ts` (arquivo temporário, não commitar):

```ts
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { processarArquivo } from './lib/processar';

const pasta = process.env.PARIDADE_PASTA;

describe.skipIf(!pasta)('paridade (local)', () => {
  it('grava a saída do parser TS', async () => {
    const nomes = readdirSync(pasta!).filter((nome) => nome.toLowerCase().endsWith('.pdf')).sort();
    const saida = [];
    for (const nome of nomes) {
      const bytes = readFileSync(join(pasta!, nome));
      const arquivo = new File([bytes], nome, { type: 'application/pdf' });
      const r = await processarArquivo(1, arquivo, '00/00/0000');
      saida.push({ arquivo: nome, municipio: r.municipio, cpf: r.cpf, nis: r.nis, nome: r.nome, motivo: r.motivo, status: r.status });
    }
    writeFileSync(join(pasta!, '_saida-ts.json'), JSON.stringify(saida, null, 2));
  });
});
```

Run (PowerShell): `$env:PARIDADE_PASTA = "<PASTA_PDFS>"; npx vitest run src/paridade.local.test.ts`
Expected: PASS e o arquivo `_saida-ts.json` criado em `PASTA_PDFS`.

- [ ] **Step 3: Gerar a saída do backend Java**

Em outro terminal, na pasta `backend`, rode `./mvnw spring-boot:run` e aguarde `Started DesligamentosApplication`. Depois rode o script abaixo (salve em um arquivo do diretório de rascunho, não no repositório), com `node comparar.mjs "<PASTA_PDFS>"`:

```js
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pasta = process.argv[2];
const nomes = readdirSync(pasta).filter((n) => n.toLowerCase().endsWith('.pdf')).sort();
const javaSaida = [];
for (const nome of nomes) {
  const dados = new FormData();
  dados.append('files', new Blob([readFileSync(join(pasta, nome))], { type: 'application/pdf' }), nome);
  dados.append('ocrEnabled', 'false');
  const resposta = await fetch('http://localhost:8080/api/processar', { method: 'POST', body: dados });
  const { registros } = await resposta.json();
  const r = registros[0];
  javaSaida.push({ arquivo: nome, municipio: r.municipio, cpf: r.cpf, nis: r.nis, nome: r.nome, motivo: r.motivo, status: r.status });
}
writeFileSync(join(pasta, '_saida-java.json'), JSON.stringify(javaSaida, null, 2));

const ts = JSON.parse(readFileSync(join(pasta, '_saida-ts.json'), 'utf-8'));
let divergencias = 0;
for (const esperado of javaSaida) {
  const obtido = ts.find((t) => t.arquivo === esperado.arquivo);
  for (const campo of ['municipio', 'cpf', 'nis', 'nome', 'motivo', 'status']) {
    if (esperado[campo] !== obtido[campo]) {
      divergencias++;
      console.log(`DIVERGE ${esperado.arquivo} ${campo}: java=${JSON.stringify(esperado[campo])} ts=${JSON.stringify(obtido[campo])}`);
    }
  }
}
console.log(divergencias === 0 ? `Paridade total em ${javaSaida.length} PDF(s).` : `${divergencias} divergência(s).`);
```

Expected: `Paridade total em N PDF(s).` PDFs escaneados (que o Java só lia por OCR, desligado aqui) aparecem como divergência esperada e devem ser listados ao usuário, não corrigidos.

- [ ] **Step 4: Resolver divergências**

Para cada divergência real (não escaneado): imprima o texto extraído (`console.log(JSON.stringify(await extrairTexto(...)))` no teste temporário) e ajuste `TOLERANCIA_VERTICAL`/`INTERVALO_DE_ESPACO` em `frontend/src/lib/pdf/montarLinhas.ts` ou a regex correspondente em `campos.ts`. Cada correção ganha um teste novo em `montarLinhas.test.ts` ou `campos.test.ts` que reproduz o caso com texto **fictício**, nunca com dados reais. Repita os Steps 2 e 3 até `Paridade total`. Depois pare o backend Java e apague `src/paridade.local.test.ts`.

- [ ] **Step 5: Remover o backend e os scripts Java**

Na raiz do repositório:

```bash
git rm -r backend scripts "Iniciar Leitor.bat"
```

Em `.gitignore`, apague o bloco `# Java/Maven` (linhas de `target/` até `*.log`), mantendo o restante.

- [ ] **Step 6: Reescrever o README**

Substitua todo o conteúdo de `README.md` por:

````markdown
# Leitor de Desligamentos

[![Testes](https://github.com/lmaciel0/leitor-de-desligamentos/actions/workflows/testes.yml/badge.svg)](https://github.com/lmaciel0/leitor-de-desligamentos/actions/workflows/testes.yml)

Extrai, revisa e exporta dados de formulários PDF de desligamento. **Tudo roda no navegador**: os PDFs não são enviados a nenhum servidor.

## Funcionalidades

- Upload de vários PDFs (seletor ou arrastar e soltar) e leitura de todas as páginas.
- Colunas `Arquivo`, `Referencia`, `Município`, `CPF`, `NIS`, `Nome` e `Motivo` em tabela editável.
- A data de referência é o dia do processamento.
- CPF e NIS preservados como texto, incluindo zeros à esquerda.
- Status automático `OK` ou `REVISAR`, com a lista de pendências de cada linha.
- Barra de triagem que filtra por status, e filtros por município e motivo.
- Download em XLSX, CSV UTF-8 separado por ponto e vírgula e XLSX só com os registros `REVISAR`.
- PDFs escaneados (sem texto selecionável) não são lidos: aparecem como `REVISAR` para digitação manual.

## Privacidade

Nenhum dado sai do computador. O site é estático, o CSP (`frontend/vercel.json`) bloqueia conexões para outros domínios e as fontes são servidas pelo próprio site.

## Stack

React 18, TypeScript, Vite, Tailwind CSS, `pdfjs-dist` (leitura de PDF), `write-excel-file` (XLSX), Vitest.

## Como executar

Requer Node.js 22.13 ou superior.

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm test         # testes
npm run build    # gera frontend/dist
```

## Deploy na Vercel

Importe o repositório com **Root Directory = `frontend`** e preset Vite. O `vercel.json` já define instalação, build, saída e cabeçalhos de segurança.

## Licença

MIT. Veja `LICENSE`.
````

- [ ] **Step 7: Verificação final**

Run: `cd frontend && npm ci && npm test && npm run build`
Expected: testes passam e o build conclui. Rode também `git status` e confirme que não há PDFs, `_saida-*.json` nem `*.local.test.ts` no stage.

- [ ] **Step 8: Commit e atualizar a branch**

```bash
git add -A
git commit -m "feat: remove o backend Java e atualiza o README

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push
```

Em seguida, abra o pull request com `gh pr create` apontando para `main`, descrevendo a migração e citando a spec e este plano; termine a descrição com `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Self-review

**Cobertura da spec**

| Seção da spec | Task |
|---|---|
| 2. Escopo (sem backend, Supabase, OCR) | Global Constraints; nenhuma task cria backend |
| 3. Arquitetura | Mapa de arquivos; Tasks 1 a 8 |
| 4.1 Extração (`pdf.js`, linhas por Y) | Task 3 |
| 4.2 Parser (port do Java, tradução de regex) | Task 1 |
| 5. Modelo de dados e recálculo local | Tasks 1 e 8 |
| 6. Exportação CSV/XLSX/somente REVISAR | Tasks 2 e 7 |
| 7. Fluxo e erros (corrompido, escaneado, lote) | Task 4 |
| 8. Design (tokens, barra de triagem, filtros, linha expansível, rodapé fixo) | Tasks 5 a 8 |
| 9. Privacidade (CSP, fontes locais) | Tasks 5 e 9 |
| 10. Testes (parser, exportação, PDF sintético, processamento, interface, CI) | Tasks 1 a 9 |
| 11. Migração e remoção do Java | Task 10 |
| 12. Riscos (ordem de linhas, XLSX, escaneados, lotes) | Task 3 (tolerâncias testadas), Task 2 (largura própria), Task 4 (escaneado), Task 10 (paridade real) |

Divergências deliberadas em relação à spec: chaves de `parseText` em minúsculas (registrado em Global Constraints); `write-excel-file` 4.x usa `write-excel-file/universal` e `fflate` entra só nos testes de XLSX; CI sobe para Node 22 por exigência do `pdfjs-dist` 6; um único filtro de status (alternado pela barra de triagem), no lugar do multisseleção antigo.

**Verificação de placeholders:** nenhum "TBD/TODO"; todos os passos de código trazem o código.

**Consistência de tipos:** `DesligamentoRecord`, `CampoEditavel`, `CAMPOS_EDITAVEIS`, `recalcular`, `parseText`, `inconsistencies`, `statusFor`, `extrairTexto(pdf: ArrayBuffer)`, `montarLinhas(itens: ItemTexto[])`, `processarArquivo(id, arquivo, referencia)`, `processarLote(arquivos, hoje, opcoes)`, `gerarCsv`/`gerarXlsx`/`somenteRevisar`/`baixarBlob`, e as props dos componentes têm as mesmas assinaturas em todas as tasks que as usam.

**Review Focus:** itens 1 e 2 (Tasks 1, 2 e 3), item 3 (Task 4, teste do lote com arquivo ruim), item 4 (Task 8, teste da linha em edição) e item 5 (Task 8, teste de Limpar durante o processamento) têm teste atribuído.
