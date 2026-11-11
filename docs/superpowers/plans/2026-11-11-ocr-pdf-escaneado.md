# OCR de PDFs escaneados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Todo código TypeScript e de teste é escrito pelo agent `typescript-pro`; a sessão principal coordena.

**Goal:** PDFs escaneados passam a ser lidos por OCR no navegador e viram linhas da tabela, sempre `REVISAR` até o operador validar.

**Architecture:** Quando `extrairTexto` volta vazio, `processarArquivo` rasteriza as páginas com o pdf.js, roda `tesseract.js` (worker reutilizado, arquivos servidos pela mesma origem), normaliza o texto e usa o `parseText` atual. O registro ganha a marca `lidoPorOcr`; o status de registros de OCR só sai de `REVISAR` com "validado" marcado. A imagem da página-fonte fica só em memória, como data URL, e aparece ao lado dos campos na revisão.

**Tech Stack:** React 18, TypeScript, Vite 6, Vitest 5, Playwright, `pdfjs-dist` 6, `tesseract.js` 5.1.1 (versão validada no teste), `@tesseract.js-data/por`.

**Spec:** `docs/superpowers/specs/2026-11-11-ocr-pdf-escaneado-design.md`

## Global Constraints

- Nenhum dado, imagem ou texto sai do computador: `connect-src 'self'`, sem host externo em nenhuma diretiva do CSP, sem CDN.
- O CSP não pode conter `blob:` (o teste atual em `frontend/src/vercel.test.ts` exige isso). Por isso a imagem da página é um data URL (`img-src 'self' data:`), nunca um object URL.
- Limites atuais continuam: 20 MB e 10 páginas por PDF (`LIMITES_PADRAO` em `frontend/src/lib/processar.ts`).
- Todo registro de OCR fica `REVISAR` até "validado" estar marcado, mesmo depois de editar células. Editar não conta como revisão.
- A imagem da página nunca vai para o arquivo de trabalho, para a exportação nem para armazenamento do navegador.
- Sem PDFs reais no repositório. Fixtures são sintéticas (CPF e NIS fictícios com dígitos válidos, como em `frontend/e2e/pdfs.ts`).
- `tesseract.js` fixo em 5.1.1; só muda de versão depois de repetir a comparação nos 5 PDFs reais.
- PDFs com texto seguem o caminho atual, sem mudança de comportamento; o código do OCR só carrega quando aparece um PDF escaneado (import dinâmico).
- Arquivo de trabalho: versão 2 do formato; arquivos de versão 1 continuam abrindo.
- Texto de interface em português, como o resto do app.
- Todos os comandos rodam em `frontend/`. Testes com saída filtrada: `npx vitest run <arquivo> 2>&1 | tail -15`.

## Review Focus

1. PDF escaneado em branco ou ilegível: OCR devolve texto vazio. Esperado: linha vazia `REVISAR` com a pendência `PDF sem texto reconhecido pelo OCR`, sem travar o lote (Task 5).
2. Lote misto (PDFs com texto e escaneados): os de texto saem idênticos a hoje e sem carregar o OCR; os escaneados não atrasam nem derrubam os vizinhos (Task 5).
3. Operador edita uma célula de um registro de OCR ou marca "validado" e depois desmarca: o status acompanha a regra, nunca vira `OK` sem validação (Task 3).
4. Abrir arquivo de trabalho antigo (versão 1) e um novo com registros de OCR sem imagem em memória: abre sem erro e a tela diz que a imagem não está disponível (Tasks 3 e 6).
5. Cancelar o lote durante o OCR, ou estourar o tempo de um PDF: o worker do OCR é encerrado e recriado, e o próximo arquivo é lido normalmente (Task 5).

## File Structure

Criar:
- `frontend/src/lib/ocr/normalizarTextoOcr.ts`: limpeza do texto do OCR antes do `parseText`.
- `frontend/src/lib/ocr/avisosDeLeitura.ts`: avisos de nome no cartão, datas e quantidade de motivos marcados (rodam uma vez, na hora do OCR).
- `frontend/src/lib/ocr/imagens.ts`: armazém em memória das imagens das páginas, com limite.
- `frontend/src/lib/ocr/rasterizar.ts`: página do pdf.js para canvas (só navegador).
- `frontend/src/lib/ocr/motorOcr.ts`: worker do `tesseract.js` (criar, reconhecer, reiniciar).
- `frontend/src/lib/ocr/lerPorOcr.ts`: orquestra rasterizar + reconhecer + escolher página-fonte.
- `frontend/src/components/ImagemDaPagina.tsx`: painel com a imagem na revisão.
- Testes ao lado de cada arquivo (`*.test.ts(x)`), mais `frontend/e2e/ocr.spec.ts`.

Modificar:
- `frontend/src/tipos.ts`, `frontend/src/lib/parser/campos.ts`, `frontend/src/lib/trabalho.ts`, `frontend/src/lib/processar.ts`, `frontend/src/App.tsx`, `frontend/src/components/TabelaResultados.tsx`, `frontend/vite.config.ts`, `frontend/vercel.json`, `frontend/src/vercel.test.ts`, `frontend/package.json`, `frontend/e2e/pdfs.ts`, `README.md`, `docs/superpowers/specs/2026-10-09-migracao-navegador-design.md`.

---

### Task 1: Normalização do texto do OCR

**Files:**
- Create: `frontend/src/lib/ocr/normalizarTextoOcr.ts`
- Test: `frontend/src/lib/ocr/normalizarTextoOcr.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `export function normalizarTextoOcr(texto: string): string`

Erros reais observados (teste de 2026-11-11), a reproduzir com dados sintéticos: rótulo `NIS:` lido como `Ints:`; marcador de motivo lido como `( x |` e `( x)`; barras `|` nas bordas das linhas; linhas de lixo do logotipo e da assinatura. `parseText` já aceita `NIs:`, `( x)` e `(X )`.

- [ ] **Step 1: Escrever os testes que falham.** Casos, com a saída exata esperada:
  - `'NIB: 0562977732 Ints: 20705987161'` vira `'NIB: 0562977732 NIS: 20705987161'`.
  - `'| ( x | Mudança para outro Município;'` vira `'( x ) Mudança para outro Município;'`.
  - `'| MUNICÍPIO: ARACATI - CE |'` vira `'MUNICÍPIO: ARACATI - CE'`.
  - `'( ) Processo de fiscalização; |'` fica `'( ) Processo de fiscalização;'` (marcador vazio intacto).
  - Dígitos nunca mudam: entrada com `CPF: 056.297.773-27` sai igual.
  - Texto sem erro conhecido sai igual, exceto bordas `|` e espaços sobrando.
  - Um `Ints:` que não está depois de um número de NIB, por exemplo `'Ints: 123'`, não vira `NIS:`.
- [ ] **Step 2: Rodar** `npx vitest run src/lib/ocr/normalizarTextoOcr.test.ts 2>&1 | tail -15`. Esperado: FAIL, módulo não existe.
- [ ] **Step 3: Implementar `normalizarTextoOcr` em `frontend/src/lib/ocr/normalizarTextoOcr.ts`.** Processa linha a linha: tira `|` e espaços das bordas; a regra do NIS só troca o rótulo quando ele vem logo depois de `NIB: <dígitos>` e antes de 11 dígitos (token de 2 a 5 letras terminado em `:`); a regra do marcador troca `( x |` por `( x )` só no início da linha. Não toca em dígitos.
- [ ] **Step 4: Rodar o teste.** Esperado: PASS.
- [ ] **Step 5: Commit.** `git add src/lib/ocr/normalizarTextoOcr.ts src/lib/ocr/normalizarTextoOcr.test.ts && git commit -m "feat: normaliza texto vindo de OCR"`

---

### Task 2: Validações do OCR

**Files:**
- Create: `frontend/src/lib/ocr/avisosDeLeitura.ts`
- Modify: `frontend/src/lib/parser/campos.ts` (só acrescenta as duas exportações novas; `recalcular` muda na Task 3)
- Test: `frontend/src/lib/ocr/avisosDeLeitura.test.ts`, `frontend/src/lib/parser/campos.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - em `campos.ts`: `export const PENDENCIA_OCR = 'PDF lido por OCR: conferir os campos'` e `export function nibDivergeDoCpf(campos: Pick<CamposDesligamento, 'cpf' | 'nib'>): boolean`
  - em `avisosDeLeitura.ts`: `export function avisosDeLeitura(texto: string): string[]`

- [ ] **Step 1: Testes que falham em `campos.test.ts`.** `nibDivergeDoCpf`: `{cpf:'05629777327', nib:'0562977732'}` é `false`; `{cpf:'04522748345', nib:'0058235124'}` é `true`; `nib` vazio ou `cpf` com menos de 10 dígitos é `false` (campo faltando já tem a sua própria pendência).
- [ ] **Step 2: Testes que falham em `avisosDeLeitura.test.ts`**, com texto sintético no layout do formulário:
  - formulário correto devolve `[]`;
  - `NOME NO CARTÃO CMIC: ANA SOUZA` com responsável `ANA SOUSA` devolve `['Nome no cartão CMIC difere do nome do responsável']` (comparação sem acento, sem caixa e sem espaços repetidos);
  - `DATA NASC.: 31/02/1990` devolve `['Data inválida: DATA NASC.']`; vale para `DATA NASC.`, `DATA DA ÚLTIMA ATUALIZAÇÃO`, `DATA DA VALIDAÇÃO CMIC`, `DATA EM QUE SAIU DO PERFIL DO CMIC`; rótulo ausente não gera aviso;
  - nenhum marcador `( x )` na seção do motivo devolve `['Nenhum motivo de desligamento marcado']`; dois devolvem `['Mais de um motivo de desligamento marcado']`.
- [ ] **Step 3: Rodar os dois arquivos.** Esperado: FAIL.
- [ ] **Step 4: Implementar** `nibDivergeDoCpf` e `PENDENCIA_OCR` em `campos.ts` (NIB deve ser igual aos 10 primeiros dígitos do CPF) e `avisosDeLeitura` em `avisosDeLeitura.ts`. A seção do motivo vai de `MOTIVO DO DESLIGAMENTO` até `DATA EM QUE SAIU`; contar marcadores `( x )` dentro dela. Regexes próprias do arquivo; não importar nada de `campos.ts` além do que já é exportado.
- [ ] **Step 5: Rodar os dois arquivos.** Esperado: PASS.
- [ ] **Step 6: Commit.** `git add src/lib/ocr/avisosDeLeitura.ts src/lib/ocr/avisosDeLeitura.test.ts src/lib/parser/campos.ts src/lib/parser/campos.test.ts && git commit -m "feat: validações específicas de leitura por OCR"`

### Task 3: Marca de OCR, status e arquivo de trabalho

**Files:**
- Modify: `frontend/src/tipos.ts`, `frontend/src/lib/parser/campos.ts` (`recalcular`), `frontend/src/lib/trabalho.ts`, `frontend/src/App.tsx` (`conferir`, perto da linha 227)
- Test: `frontend/src/lib/parser/campos.test.ts`, `frontend/src/lib/trabalho.test.ts`

**Interfaces:**
- Consumes: `PENDENCIA_OCR`, `nibDivergeDoCpf` (Task 2).
- Produces:
  - em `tipos.ts`, dois campos opcionais em `DesligamentoRecord`: `lidoPorOcr?: boolean` e `avisosOcr?: string[]` (opcionais para não mexer em todas as fixtures; ausente vale `false` e `[]`).
  - em `campos.ts`: `export function pendenciasDoRegistro(registro: Pick<DesligamentoRecord, CampoEditavel | 'validado' | 'lidoPorOcr' | 'avisosOcr'>): string[]` e `export function conferirRegistro(registro: DesligamentoRecord, campo: CampoConferencia, marcado: boolean): DesligamentoRecord`

Regra de `pendenciasDoRegistro`: sem `lidoPorOcr`, ou com `validado` marcado, devolve só `inconsistencies(registro)`. Com `lidoPorOcr` e sem `validado`, devolve `[PENDENCIA_OCR, ...inconsistencies(registro), 'NIB diferente dos 10 primeiros dígitos do CPF' (só se nibDivergeDoCpf), ...avisosOcr]`. `recalcular` passa a usar essa função. `conferirRegistro` marca o campo; só recalcula quando `campo === 'validado'` e `lidoPorOcr` (para registros comuns, nada muda, inclusive as pendências "PDF ..." que `recalcular` apagaria).

- [ ] **Step 1: Testes que falham em `campos.test.ts`** (registro base com CPF, NIS e demais campos válidos):
  - registro com `lidoPorOcr: true`, `validado: false` e nenhum problema: `recalcular` devolve status `REVISAR` e `inconsistencias` com `PENDENCIA_OCR` primeiro;
  - o mesmo, depois de editar `nome` via `recalcular({ ...r, nome: 'OUTRO NOME' })`: continua `REVISAR`;
  - `conferirRegistro(r, 'validado', true)` num registro de OCR sem problemas: status `OK`, `inconsistencias` vazia;
  - `conferirRegistro(r, 'validado', false)` depois disso: volta a `REVISAR`;
  - OCR com `avisosOcr: ['Mais de um motivo de desligamento marcado']` e `validado: true`: aviso some e status `OK`;
  - OCR com NIB divergente: aparece o aviso de NIB enquanto não validado;
  - OCR validado mas com CPF de dígito inválido: continua `REVISAR` (`'CPF com dígito verificador inválido'`);
  - registro sem `lidoPorOcr`: `conferirRegistro(r, 'validado', true)` não altera `status` nem `inconsistencias` (inclui o caso de um registro com `inconsistencias: ['PDF maior que 20 MB']`).
- [ ] **Step 2: Testes que falham em `trabalho.test.ts`:**
  - `gerarTrabalho` escreve `versao: 2`;
  - `lerTrabalho` abre um JSON de `versao: 1` (registro sem `lidoPorOcr`) e `lidoPorOcr` fica indefinido;
  - round-trip de um registro de OCR com `avisosOcr`: lê de volta `lidoPorOcr: true` e os avisos, com status `REVISAR` e `PENDENCIA_OCR` presente uma única vez;
  - arquivo editado à mão para `status: 'OK'` num registro de OCR não validado: lido como `REVISAR`;
  - `lidoPorOcr` que não é booleano, ou `avisosOcr` que não é lista de textos, ou com mais de 50 itens: `TrabalhoInvalido` com o campo no texto;
  - `versao: 3` continua recusada com a mensagem existente.
- [ ] **Step 3: Rodar os dois arquivos.** Esperado: FAIL.
- [ ] **Step 4: Implementar** os tipos, `pendenciasDoRegistro`, `conferirRegistro` e a nova `recalcular`. Em `trabalho.ts`: constante `VERSOES_ACEITAS = [1, 2]`, `VERSAO = 2` ao gerar, leitura dos dois campos novos com os mesmos limites de `MAX_PENDENCIAS` e `MAX_CARACTERES_POR_CAMPO`, e no cálculo das pendências ao abrir: para registros de OCR, `daLeitura` exclui `PENDENCIA_OCR` e o resto vem de `pendenciasDoRegistro`; os demais registros seguem o caminho atual.
- [ ] **Step 5: Em `App.tsx`, trocar o corpo do `map` de `conferir`** para usar `conferirRegistro(registro, campo, marcado)`. Rodar `npx vitest run src/lib src/App.test.tsx 2>&1 | tail -15`. Esperado: PASS, sem regressão.
- [ ] **Step 6: Commit.** `git add src/tipos.ts src/lib/parser src/lib/trabalho.ts src/lib/trabalho.test.ts src/App.tsx && git commit -m "feat: marca de OCR mantém o registro em REVISAR até validar"`

---

### Task 4: Arquivos do OCR e CSP

**Files:**
- Create: `frontend/scripts/copiar-ocr.mjs`
- Modify: `frontend/package.json`, `frontend/vercel.json`, `frontend/vite.config.ts`, `frontend/src/vercel.test.ts`, `.gitignore` (raiz ou `frontend/`, o que já ignorar `dist`)

**Interfaces:**
- Consumes: nada.
- Produces: arquivos servidos pela mesma origem em `/ocr/worker.min.js`, `/ocr/core/` (núcleo WASM do `tesseract.js-core`) e `/ocr/lang/por.traineddata.gz`; esses três caminhos são os que a Task 5 passa a `createWorker` como `workerPath`, `corePath` e `langPath`.

Decisão de infraestrutura (do plano): o script copia os arquivos de `node_modules` para `frontend/public/ocr/` (ignorado pelo git). O Vite serve `public/` no dev e copia para `dist` no build, sem plugin. O script roda em `predev`, `prebuild` e `prepreview`. Confirmar os caminhos exatos dentro de `node_modules` (em `@tesseract.js-data/por` o arquivo está numa pasta como `4.0.0_best_int/`).

- [ ] **Step 1: Instalar as dependências com versão exata:** `npm install --save-exact tesseract.js@5.1.1 @tesseract.js-data/por@1.0.0`. Conferir que `tesseract.js-core` veio como dependência do `tesseract.js`.
- [ ] **Step 2: Escrever o script** `scripts/copiar-ocr.mjs` e os scripts do `package.json` (`"copiar-ocr": "node scripts/copiar-ocr.mjs"`, `predev`, `prebuild`, `prepreview`). O script falha com mensagem clara se um arquivo de origem não existir.
- [ ] **Step 3: Testes que falham em `vercel.test.ts`:**
  - existe uma regra de cabeçalhos com `source` `/ocr/(.*)` cujo CSP é idêntico ao global exceto por `script-src 'self' 'wasm-unsafe-eval'`;
  - a regra global (`source` `/((?!ocr/).*)`) não contém `wasm-unsafe-eval`;
  - o CSP de `/ocr/(.*)` continua sem `blob:` e sem `http(s)://`, com `connect-src 'self'` e `worker-src 'self'`.
  Os testes existentes devem seguir passando.
- [ ] **Step 4: Rodar** `npx vitest run src/vercel.test.ts 2>&1 | tail -15`. Esperado: FAIL.
- [ ] **Step 5: Editar `vercel.json`:** a regra atual passa de `/(.*)` para `/((?!ocr/).*)` (sem tocar nos valores) e entra a regra `/ocr/(.*)` com os mesmos quatro outros cabeçalhos e o CSP com `'wasm-unsafe-eval'` só em `script-src`. Em `vite.config.ts`, trocar `preview.headers` por um plugin com `configurePreviewServer` que aplica, em cada requisição, os cabeçalhos das regras cujo `source` (usado como `new RegExp('^' + source + '$')`) casa com o caminho. A fonte única continua sendo `vercel.json`.
- [ ] **Step 6: Verificar.** `npx vitest run src/vercel.test.ts 2>&1 | tail -15` passa; `npm run build 2>&1 | tail -8` termina sem erro e `ls dist/ocr dist/ocr/lang` mostra o worker, o núcleo e `por.traineddata.gz`.
- [ ] **Step 7: Commit.** `git add scripts package.json package-lock.json vercel.json vite.config.ts src/vercel.test.ts .gitignore && git commit -m "feat: serve arquivos do OCR pela própria origem"`

### Task 5: Motor de OCR e integração em `processarArquivo`

**Files:**
- Create: `frontend/src/lib/ocr/imagens.ts`, `frontend/src/lib/ocr/rasterizar.ts`, `frontend/src/lib/ocr/motorOcr.ts`, `frontend/src/lib/ocr/lerPorOcr.ts`
- Modify: `frontend/src/lib/processar.ts`
- Test: `frontend/src/lib/ocr/imagens.test.ts`, `frontend/src/lib/ocr/lerPorOcr.test.ts`, `frontend/src/lib/processar.test.ts`

**Interfaces:**
- Consumes: `normalizarTextoOcr` (Task 1), `avisosDeLeitura` e `PENDENCIA_OCR` (Task 2), `recalcular` e os campos `lidoPorOcr`/`avisosOcr` (Task 3), caminhos `/ocr/worker.min.js`, `/ocr/core`, `/ocr/lang` (Task 4), `LimiteExcedido` de `extrairTexto.ts`.
- Produces:
  - `imagens.ts`: `export const MAX_IMAGENS_EM_MEMORIA = 30`; `guardarImagem(idDoRegistro: number, dataUrl: string): void` (descarta a mais antiga ao passar do limite); `obterImagem(idDoRegistro: number): string | undefined`; `limparImagens(): void`
  - `motorOcr.ts`: `prepararMotor(): Promise<void>` (cria o worker do `tesseract.js` uma vez, com `createWorker('por', 1, { workerPath, corePath, langPath, workerBlobURL: false })`); `reconhecerImagem(imagem: HTMLCanvasElement): Promise<string>`; `reiniciarMotor(): Promise<void>` (encerra e descarta o worker; o próximo `prepararMotor` cria outro)
  - `rasterizar.ts`: `abrirPdfParaOcr(pdf: ArrayBuffer): Promise<PdfRasterizavel>` onde `interface PdfRasterizavel { total: number; renderizar(numero: number): Promise<HTMLCanvasElement>; destruir(): Promise<void> }` (300 dpi, via `page.render` do pdf.js 6; confirmar a assinatura com `npx ctx7@latest docs /mozilla/pdf.js "render page to canvas"`); `miniatura(canvas: HTMLCanvasElement): string` (data URL JPEG, qualidade 0.7, largura máxima 900 px)
  - `lerPorOcr.ts`:
    ```ts
    export interface ResultadoOcr { texto: string; imagem: string | null }
    export interface OpcoesOcr {
      maxPaginas: number;
      sinal: AbortSignal;
      aoComecar?: (totalDePaginas: number) => void;
      aoIniciarPagina?: (pagina: number, total: number) => void;
    }
    export interface DependenciasOcr {
      abrirPdf(pdf: ArrayBuffer): Promise<PdfRasterizavel>;
      prepararMotor(): Promise<void>;
      reconhecer(canvas: HTMLCanvasElement): Promise<string>;
      miniatura(canvas: HTMLCanvasElement): string;
    }
    export function lerPorOcr(pdf: ArrayBuffer, opcoes: OpcoesOcr, deps?: DependenciasOcr): Promise<ResultadoOcr>
    export function reiniciarOcr(): Promise<void>   // reinicia o motor real
    ```
  - `processar.ts`: `export const MENSAGEM_OCR_VAZIO = 'PDF sem texto reconhecido pelo OCR'`; `export const OCR_BASE_MS = 20_000`; `export const OCR_POR_PAGINA_MS = 12_000`; `export function orcamentoOcrMs(paginas: number): number` (`OCR_BASE_MS + OCR_POR_PAGINA_MS * paginas`; decisão do plano, a partir de ~6 s por página medidos); `processarArquivo` ganha o 5º parâmetro `extras: { sinalDoLote?: AbortSignal; onEtapa?: (mensagem: string) => void } = {}`; `OpcoesDoLote` ganha `onEtapa?: (mensagem: string) => void`, repassado.

Comportamento de `lerPorOcr`: abre o PDF; se `total > maxPaginas`, lança `LimiteExcedido('PDF com mais de N páginas')` sem reconhecer nada; chama `prepararMotor()` (o carregamento do modelo fica fora do tempo do arquivo); chama `aoComecar(total)`; para cada página confere `sinal.aborted` (lança `sinal.reason`), chama `aoIniciarPagina`, renderiza, reconhece e normaliza com `normalizarTextoOcr`. Texto final = páginas unidas por `\n`. Página-fonte da imagem: a primeira cujo texto casa `/NOME\s+DO\s+RESPONS[ÁA]VEL/i`; sem casamento, a página 1. Sempre chama `destruir()` ao sair, inclusive por erro ou aborto.

Comportamento em `processarArquivo`: o caminho de texto fica como está. Se o texto vier vazio, para o relógio de leitura de texto, importa `./ocr/lerPorOcr` dinamicamente, avisa `onEtapa('Lendo <arquivo> por OCR (página n de total)')` a cada página, arma um novo relógio em `aoComecar` com `orcamentoOcrMs(total)` (mesma mensagem `PDF demorou mais de N s para ser lido`) e liga `sinalDoLote` ao relógio. Texto do OCR vazio devolve `registroVazio` com `MENSAGEM_OCR_VAZIO` (sem `lidoPorOcr`). Com texto, o registro sai de `recalcular({ id, arquivo, referencia, ...parseText(texto), ...SEM_CONFERENCIA, lidoPorOcr: true, avisosOcr: avisosDeLeitura(texto), status: 'REVISAR', inconsistencias: [] })` e a imagem vai para `guardarImagem(id, imagem)`. Se o relógio disparou ou o lote foi cancelado durante o OCR, chama `reiniciarOcr()` (além do `trocarWorker` atual quando for o caso). `MENSAGEM_PDF_ESCANEADO` deixa de ser usada: remover e ajustar os testes e e2e que a citam (`grep -rn MENSAGEM_PDF_ESCANEADO src e2e`).

- [ ] **Step 1: Testes que falham em `imagens.test.ts`:** guardar e obter; `obterImagem` de id desconhecido é `undefined`; guardar `MAX_IMAGENS_EM_MEMORIA + 1` imagens descarta a primeira; `limparImagens` esvazia.
- [ ] **Step 2: Testes que falham em `lerPorOcr.test.ts`**, com `DependenciasOcr` falsas e canvases falsos:
  - duas páginas com textos `'A'` e `'B'` resultam em texto `'A\nB'`; `aoIniciarPagina` chamado com `(1, 2)` e `(2, 2)`; `aoComecar` chamado uma vez com `2`, depois de `prepararMotor`;
  - rótulo `NOME DO RESPONSÁVEL` só na página 2: `imagem` vem da miniatura da página 2; sem rótulo em nenhuma: da página 1;
  - `total` maior que `maxPaginas`: rejeita com `LimiteExcedido` e `reconhecer` nunca é chamado;
  - `sinal` abortado antes da página 2: rejeita com `sinal.reason` e `destruir` foi chamado;
  - texto com `Ints:` depois de `NIB: 0562977732` sai com `NIS:`.
- [ ] **Step 3: Testes que falham em `processar.test.ts`**, com `vi.mock('./ocr/lerPorOcr')` e um PDF de página em branco (extração devolve vazio):
  - OCR devolve formulário sintético válido: registro com `lidoPorOcr: true`, campos preenchidos, `status: 'REVISAR'`, `inconsistencias[0] === PENDENCIA_OCR`, e `obterImagem(id)` igual à imagem devolvida;
  - OCR devolve texto vazio: registro vazio com `inconsistencias: [MENSAGEM_OCR_VAZIO]`, sem `lidoPorOcr`;
  - PDF com texto (`criarPdf`): `lerPorOcr` não é chamado (Review Focus 2);
  - `lerPorOcr` rejeita com `LimiteExcedido`: registro vazio com a mensagem e `reiniciarOcr` chamado;
  - `lerPorOcr` rejeita com `Error('falha')`: `erro de processamento: falha`;
  - `sinalDoLote` abortado durante o OCR: o arquivo termina sem travar e `reiniciarOcr` é chamado;
  - `orcamentoOcrMs(10)` é `140_000`.
- [ ] **Step 4: Rodar** `npx vitest run src/lib/ocr src/lib/processar.test.ts 2>&1 | tail -20`. Esperado: FAIL.
- [ ] **Step 5: Implementar** os quatro módulos de `src/lib/ocr/` e as mudanças em `processar.ts`, com a mesma estrutura de `try/catch/finally` e relógio que `processarArquivo` já tem.
- [ ] **Step 6: Rodar** `npx vitest run 2>&1 | tail -15` e `npm run type-check 2>&1 | tail -5`. Esperado: PASS, sem regressão.
- [ ] **Step 7: Commit.** `git add src/lib && git commit -m "feat: lê PDFs escaneados por OCR no navegador"`

---

### Task 6: Conferência visual e progresso na tela

**Files:**
- Create: `frontend/src/components/ImagemDaPagina.tsx`
- Modify: `frontend/src/components/TabelaResultados.tsx` (área das pendências, perto das linhas 105-130), `frontend/src/App.tsx`
- Test: `frontend/src/components/ImagemDaPagina.test.tsx`, `frontend/src/components/TabelaResultados.test.tsx`, `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `obterImagem`, `limparImagens` (Task 5); `onEtapa` de `processarLote` (Task 5); `lidoPorOcr` (Task 3).
- Produces: `export function ImagemDaPagina(props: { idDoRegistro: number; arquivo: string }): JSX.Element`

Comportamento: com imagem em memória, mostra `<img>` com `alt` `Página do PDF <arquivo>` e um botão alternador "Ampliar"/"Reduzir" (`aria-pressed`). Sem imagem, mostra o texto `Imagem da página não está disponível. Carregue o PDF de novo para conferir.`. A `TabelaResultados` só mostra o componente para registros com `lidoPorOcr`. O `App` chama `limparImagens()` ao iniciar `processar()`, em `aplicarTrabalho` e ao limpar os resultados (os ids de registro recomeçam a cada lote, então imagens antigas não podem sobrar), e guarda a mensagem de `onEtapa` num estado exibido junto do progresso, apagada quando o lote termina.

- [ ] **Step 1: Testes que falham em `ImagemDaPagina.test.tsx`:** com `guardarImagem(7, 'data:image/jpeg;base64,AAAA')`, renderizar com `idDoRegistro: 7` mostra a imagem com o `alt` esperado; o botão "Ampliar" vira "Reduzir" e `aria-pressed` acompanha; id sem imagem mostra o texto de indisponível e nenhuma `<img>`.
- [ ] **Step 2: Testes que falham em `TabelaResultados.test.tsx`:** registro com `lidoPorOcr: true` mostra o painel; registro sem a marca não mostra.
- [ ] **Step 3: Teste que falha em `App.test.tsx`**, no padrão de mock que o arquivo já usa para `processarLote`: quando o mock chama `opcoes.onEtapa('Lendo a.pdf por OCR (página 1 de 1)')`, a mensagem aparece na tela; ao terminar o lote, some. Outro: abrir um trabalho chama `limparImagens` (imagem guardada antes deixa de existir).
- [ ] **Step 4: Rodar** os três arquivos. Esperado: FAIL.
- [ ] **Step 5: Implementar** o componente e as ligações. Seguir as classes e o estilo existentes (tema claro e escuro, foco visível); sem biblioteca nova.
- [ ] **Step 6: Rodar** `npx vitest run 2>&1 | tail -15` e `npm run lint 2>&1 | tail -10`. Esperado: PASS.
- [ ] **Step 7: Commit.** `git add src/components src/App.tsx src/App.test.tsx && git commit -m "feat: mostra a página original na revisão de registros de OCR"`

---

### Task 7: Teste no navegador e documentação

**Files:**
- Create: `frontend/e2e/ocr.spec.ts`
- Modify: `frontend/e2e/pdfs.ts`, `README.md`, `docs/superpowers/specs/2026-10-09-migracao-navegador-design.md`

**Interfaces:**
- Consumes: tudo das tarefas anteriores, rodando sob o CSP real do `vite preview`.
- Produces: `export async function criarPdfEscaneado(caminho: string, png: Buffer): Promise<string>` em `e2e/pdfs.ts` (PDF de uma página com a imagem PNG embutida via `embedPng` do `pdf-lib`, sem camada de texto).

O PNG do formulário sintético é desenhado dentro do navegador (`page.evaluate` com `canvas`, as linhas de `linhasDoFormulario`, fonte sem serifa grande, fundo branco, cerca de 1700x2200 px) e devolvido em base64; o teste grava o PDF com `criarPdfEscaneado`. Os testes de OCR usam `test.setTimeout(120_000)`.

- [ ] **Step 1: Escrever `e2e/ocr.spec.ts` com os testes** (seguir os seletores e o estilo de `leitor.spec.ts`):
  - PDF escaneado sintético: a linha aparece com nome, CPF `52998224725` e NIS `12345678919` lidos, status `REVISAR`, pendência `PDF lido por OCR: conferir os campos` e a imagem da página visível;
  - editar uma célula não tira a linha de `REVISAR`; marcar "Está validado" muda para `OK` (CPF e NIS do fixture são válidos; o aviso de NIB só vale enquanto não validado); desmarcar volta a `REVISAR`;
  - nenhuma requisição sai da origem do app durante o lote (coletar `page.on('request')` e comparar o host);
  - lote só com PDF de texto: nenhuma requisição para `/ocr/` (Review Focus 2);
  - lote misto (texto + escaneado): o de texto sai `OK` como antes, o escaneado `REVISAR`;
  - verificação `axe` na tela com uma linha de OCR e a imagem aberta, sem violações.
- [ ] **Step 2: Rodar** `npm run build 2>&1 | tail -5 && npx playwright test e2e/ocr.spec.ts 2>&1 | tail -25`. Esperado: FAIL só por `criarPdfEscaneado` inexistente.
- [ ] **Step 3: Implementar `criarPdfEscaneado`** e ajustar o que o e2e revelar (se o worker ou o WASM do OCR for bloqueado pelo CSP, o erro aparece no console do navegador; a correção é na regra `/ocr/(.*)` da Task 4, e só se isso não resolver o `wasm-unsafe-eval` vira global, registrando a mudança no design).
- [ ] **Step 4: Rodar** `npx playwright test 2>&1 | tail -25`. Esperado: todos passam, os antigos inclusive.
- [ ] **Step 5: Documentação.** No `README.md`, trocar a linha que diz que PDFs escaneados "não são lidos" por: são lidos por OCR no computador, ficam `REVISAR` até a validação e a página original aparece na revisão; na seção Privacidade, dizer que o OCR roda no navegador e nada é enviado. Na spec de 2026-10-09, na linha "Sem OCR nesta versão", acrescentar a referência `Superada em 2026-11-11: ver 2026-11-11-ocr-pdf-escaneado-design.md`.
- [ ] **Step 6: Verificação final completa**, mostrando a saída: `npm run lint 2>&1 | tail -5`, `npx vitest run 2>&1 | tail -8`, `npm run build 2>&1 | tail -5`, `npx playwright test 2>&1 | tail -8`.
- [ ] **Step 7: Commit.** `git add e2e README.md ../docs/superpowers/specs && git commit -m "test: OCR de PDF escaneado no navegador; docs"`
- [ ] **Step 8 (manual, do operador, depois do merge):** rodar `npm run dev`, soltar os 5 PDFs de `/home/lmaciel0/Área de trabalho/Desligamentos` e conferir: 5 linhas `REVISAR`, campos iguais aos do teste de 2026-11-11, aviso de NIB na linha da DINA, imagem da página ao lado, e `OK` só depois de validar. Esses arquivos têm dados pessoais e não entram no repositório.
