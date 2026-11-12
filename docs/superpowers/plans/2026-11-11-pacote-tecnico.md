# Pacote técnico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OCR mais leve no deploy, CI sem scripts de instalação, normalizador do OCR mais robusto, build sem aviso de chunk e limite de páginas que não descarta o motor de OCR.

**Architecture:** Cinco ajustes pequenos e independentes no `frontend/`, agrupados em 4 tarefas: normalizador (TDD), limite de páginas em `processar.ts` (TDD), arquivos de build (`copiar-ocr.mjs` + `vite.config.ts`) e workflow do CI. Nenhuma tela muda.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Playwright + axe, tesseract.js 5.1.1, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-11-pacote-tecnico-design.md`

## Global Constraints

- Branch `pacote-tecnico`, a partir de `main` (`000fbfe`). Primeiro commit: spec + este plano.
- Sem dependência nova; `package.json` e `package-lock.json` não mudam.
- CSP de `frontend/vercel.json` não muda.
- O normalizador nunca altera dígitos de CPF, NIS, NIB ou datas.
- Só `(/ )` vira `( )`; caixas marcadas (`( x )`, `(x)`, `( X |`) continuam como hoje.
- `chunkSizeWarningLimit: 600` (kB), não um valor maior.
- Fim: `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e` passando (rodar em `frontend/`, saída filtrada).
- Código escrito pelo agent `frontend-developer` (TypeScript/JS/YAML do front). Commit por tarefa, mensagens em português no padrão do repo (`feat:`, `fix:`, `build:`, `ci:`).

## Review Focus

1. Navegador sem SIMD: o worker pede `tesseract-core-lstm.wasm.js` (sem SIMD); ele tem de continuar em `public/ocr/core`. Task 3 confere os dois arquivos `-lstm`.
2. Lote com um PDF escaneado de páginas demais seguido de outro escaneado: o segundo é lido sem descartar o motor. Task 2, teste de lote.
3. `NIB: <dígitos> N1S: <10 ou 12 dígitos>`: nada muda, porque a regra exige exatamente 11 dígitos. Task 1.
4. `(/x)` e `(x/)` (marca de verdade com traço): não viram caixa vazia. Task 1.
5. `npm ci` local, sem `--ignore-scripts`, continua funcionando para quem desenvolve: só o CI muda. Task 4 não mexe em `package.json`.

---

### Task 1: Normalizador do OCR

**Files:**
- Modify: `frontend/src/lib/ocr/normalizarTextoOcr.ts`
- Test: `frontend/src/lib/ocr/normalizarTextoOcr.test.ts`

**Interfaces:**
- Consumes: `parseText(texto: string): CamposDesligamento` de `frontend/src/lib/parser/campos.ts` (só no teste de integração).
- Produces: `normalizarTextoOcr(texto: string): string`, mesma assinatura de hoje.

- [ ] **Step 1: Testes que falham**, no `describe('normalizarTextoOcr')` existente:
  - `'troca a caixa vazia lida como (/ ) por ( )'`: `normalizarTextoOcr('|(/ ) OUTRO: |')` é `'( ) OUTRO:'`; `normalizarTextoOcr('1(/ ) Renda familiar mensal per capita superior;')` é `'1( ) Renda familiar mensal per capita superior;'`; `normalizarTextoOcr('(/) Processo de fiscalização;')` é `'( ) Processo de fiscalização;'`.
  - `'não mexe em marca com traço nem em caixa marcada'`: `'(/x) Processo de fiscalização;'`, `'(x/) Processo de fiscalização;'` e `'( x) Mudança para outro Município;'` voltam iguais.
  - `'corrige o rótulo NIS lido com dígito depois do NIB'`: `'NIB: 0562977732 N1S: 20705987161'` dá `'NIB: 0562977732 NIS: 20705987161'`; `'NIB: 0562977732 |N1S: 20705987161'` dá `'NIB: 0562977732 |NIS: 20705987161'`.
  - `'não troca rótulo só de dígitos nem NIS fora de 11 dígitos'`: `'NIB: 0562977732 12: 20705987161'`, `'NIB: 0562977732 N1S: 2070598716'` e `'NIB: 0562977732 N1S: 207059871610'` voltam iguais.
  - `'motivo com caixas (/ ) continua sendo o marcado'`: `parseText(normalizarTextoOcr(bloco)).motivo` é `'Mudança para outro Município'` (o `limpar` do parser tira o `;` final), com `bloco` = `'MOTIVO DO DESLIGAMENTO:\n1(/ ) Renda familiar mensal per capita superior;\n|( x) Mudança para outro Município;\n|(/ ) OUTRO: |\nDATA EM QUE SAIU DO PERFIL DO CMIC: 24/04/2026'`.
  - O teste de hoje `'corrige o rótulo NIS lido como Ints depois do NIB'` continua igual.

- [ ] **Step 2: Rodar e ver falhar.** `cd frontend && npx vitest run src/lib/ocr/normalizarTextoOcr.test.ts`. Esperado: os testes de `(/ )` e `N1S` falham; os de "não mexe" passam.

- [ ] **Step 3: Implementar** em `normalizarTextoOcr.ts`:
  - Constante nova `CAIXA_VAZIA_COM_BARRA` = `(`, espaços opcionais, `/`, espaços opcionais, `)`, global, em qualquer posição; troca por `( )` dentro de `normalizarLinha`, depois de tirar as bordas.
  - `ROTULO_NIS_APOS_NIB`: rótulo de 2 a 5 letras ou dígitos com pelo menos uma letra (lookahead), e `\|?` opcional entre o espaço depois do NIB e o rótulo, preservado na troca. O resto (só depois de `NIB: <dígitos>`, só antes de exatamente 11 dígitos) igual.
  - Comentário do topo: "nunca mexe em dígitos dos dados; o `1` de `N1S` é parte do rótulo".

- [ ] **Step 4: Rodar e ver passar.** Mesmo comando. Esperado: PASS em todos. Depois `npm test` inteiro sem falhas.

- [ ] **Step 5: Commit.** `git add frontend/src/lib/ocr/normalizarTextoOcr.ts frontend/src/lib/ocr/normalizarTextoOcr.test.ts && git commit -m "fix: normalizador do OCR trata caixa vazia (/ ) e rótulo N1S"`

### Task 2: Limite de páginas não descarta o motor

**Files:**
- Modify: `frontend/src/lib/processar.ts` (`registroDoOcr`, linhas ~128-192)
- Test: `frontend/src/lib/processar.test.ts` (teste da linha ~212 e novos ao lado)

**Interfaces:**
- Consumes: `lerPorOcr(pdf, { maxPaginas, sinal, aoComecar, aoIniciarPagina })` e `reiniciarOcr(geracao)` de `frontend/src/lib/ocr/lerPorOcr.ts`, sem mudança. `aoComecar` é chamado logo depois de `prepararMotor()`.
- Produces: nada novo; `processarArquivo` e `processarLote` com as mesmas assinaturas.

- [ ] **Step 1: Testes que falham** (os mocks de `lerPorOcr` e `reiniciarOcr` já existem no arquivo):
  - Renomear e reescrever o teste da linha ~212 para `'limite excedido no OCR com o motor pronto vira registro vazio e reinicia o motor'`: `lerPorOcr` simulado com `mockImplementation(async (_pdf, opcoes) => { opcoes.aoComecar?.(1); throw new LimiteExcedido('página inválida'); })`. Espera `inconsistencias: ['página inválida']`, `status: 'REVISAR'` e `reiniciarOcr` chamado 1 vez.
  - Novo `'PDF escaneado com páginas demais vira registro vazio sem descartar o motor'`: `mockRejectedValue(new LimiteExcedido('PDF com mais de 10 páginas'))` (sem chamar `aoComecar`). Espera `inconsistencias: ['PDF com mais de 10 páginas']` e `reiniciarOcr` não chamado.
  - Novo `'escaneado com páginas demais não atrapalha o escaneado seguinte'`: `lerPorOcr` rejeita como acima na 1ª chamada e resolve com o texto do formulário escaneado usado nos outros testes na 2ª (`mockRejectedValueOnce` + `mockResolvedValueOnce`). `processarLote` com dois `escaneado()`: o 1º tem a mensagem de limite, o 2º tem `lidoPorOcr: true`, e `reiniciarOcr` não foi chamado.

- [ ] **Step 2: Rodar e ver falhar.** `cd frontend && npx vitest run src/lib/processar.test.ts`. Esperado: os dois testes novos falham (hoje `reiniciarOcr` é chamado).

- [ ] **Step 3: Implementar** em `registroDoOcr`: uma variável local `motorPronto = false`, marcada `true` no começo do `aoComecar`. No `catch`, o ramo `erro instanceof LimiteExcedido` só chama `trocarMotorOcr` com `emUso && motorPronto`. O ramo do relógio abortado (`relogio.signal.aborted`) não muda. Não comparar mensagem de erro. Atualizar o comentário JSDoc de `registroDoOcr` com a regra nova em uma linha.

- [ ] **Step 4: Rodar e ver passar.** Mesmo comando, depois `npm test`. Esperado: PASS, incluindo os testes de relógio e cancelamento de lote que já existem.

- [ ] **Step 5: Commit.** `git add frontend/src/lib/processar.ts frontend/src/lib/processar.test.ts && git commit -m "fix: limite de páginas no OCR não descarta o motor sadio"`

### Task 3: Núcleos LSTM e limite do aviso de chunk

**Files:**
- Modify: `frontend/scripts/copiar-ocr.mjs` (lista `nucleos`)
- Modify: `frontend/src/lib/ocr/motorOcr.ts` (comentário junto de `OEM.LSTM_ONLY`, sem mudar código)
- Modify: `frontend/vite.config.ts`

**Interfaces:**
- Consumes: nada de outras tarefas.
- Produces: `public/ocr/core/` só com `tesseract-core-lstm.wasm.js` e `tesseract-core-simd-lstm.wasm.js`.

- [ ] **Step 1: Medir antes.** `cd frontend && npm run build 2>&1 | grep -E "larger than 500|pdf-"` mostra o aviso e `pdf-*.js` com ~541 kB; `du -sh public/ocr` mostra ~19M.

- [ ] **Step 2: `copiar-ocr.mjs`:** `nucleos` passa a ter só os dois `-lstm`. O comentário diz: o app usa `OEM.LSTM_ONLY` (`src/lib/ocr/motorOcr.ts`) e o worker só pede as variantes `-lstm`; trocar o OEM exige voltar os 4 núcleos. Em `motorOcr.ts`, comentário de uma linha junto do `OEM.LSTM_ONLY` apontando para essa lista.

- [ ] **Step 3: `vite.config.ts`:** `build: { chunkSizeWarningLimit: 600 }` no `defineConfig`, com comentário: o único chunk acima de 500 kB é o pdfjs, carregado sob demanda por `src/lib/pdf/carregarPdfjs.ts`; o limite fica logo acima dele para um chunk novo e grande ainda avisar.

- [ ] **Step 4: Verificar.** `npm run build 2>&1 | grep -c "larger than 500"` é `0`; `ls public/ocr/core` lista exatamente os dois `-lstm`; `du -sh public/ocr` mostra ~9,5M; `npx playwright test e2e/ocr.spec.ts` PASS (OCR sob o CSP real). Depois `npm run test:e2e` inteiro PASS.

- [ ] **Step 5: Commit.** `git add frontend/scripts/copiar-ocr.mjs frontend/src/lib/ocr/motorOcr.ts frontend/vite.config.ts && git commit -m "build: copia só os núcleos LSTM do OCR e ajusta o limite do aviso de chunk"`

### Task 4: CI sem scripts de instalação

**Files:**
- Modify: `.github/workflows/testes.yml`

**Interfaces:**
- Consumes: o build da Task 3 (o e2e do CI roda depois do build).
- Produces: nada para outras tarefas.

- [ ] **Step 1: Prova local.** Em `frontend/`: `rm -rf node_modules && npm ci --ignore-scripts`, depois `npm run lint && npm test && npm run build && npm run test:e2e`, com saída filtrada. Esperado: tudo passa. Anotar no relatório se o esbuild funcionou sem o `postinstall`.

- [ ] **Step 2: Workflow.** `- run: npm ci` vira `- run: npm ci --ignore-scripts`, com comentário: scripts de instalação desligados para que um pacote comprometido não rode código no CI; os scripts do projeto (`prebuild` etc.) continuam rodando. Só se o Step 1 falhou no esbuild: passo seguinte `- run: npm rebuild esbuild`, com comentário dizendo que roda só o script do esbuild, que confere o binário da plataforma.

- [ ] **Step 3: Restaurar o ambiente local.** `npm ci` (com scripts) em `frontend/`, para quem desenvolve voltar ao estado normal. `npm run build` PASS.

- [ ] **Step 4: Commit.** `git add .github/workflows/testes.yml && git commit -m "ci: instala dependências sem scripts de instalação"`

### Fechamento (sessão principal)

- [ ] Revisão `code-reviewer` no diff `main..pacote-tecnico`, e `security-auditor` no mesmo diff (foco: Task 4 e a CSP intacta).
- [ ] `superpowers:verification-before-completion`: `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e` com a saída real.
- [ ] `superpowers:finishing-a-development-branch`.
