# Tela de resultados: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tabela de resultados cabe inteira a partir de 1366 px, com uma rolagem só, e a página lida por OCR aparece grande ao lado e em tela cheia.

**Architecture:** Largura da página numa classe CSS única usada por cabeçalho, corpo e barra de exportar. A tabela ganha `table-fixed` com `<colgroup>`, células mescladas (Arquivo+Referência, Conferências) e campos de texto que quebram linha só com CSS. O painel de OCR vira grade de duas colunas e um componente novo `PaginaAmpliada` mostra a página em tela cheia via portal.

**Tech Stack:** React 18, TypeScript, Tailwind 3, lucide-react, Vitest + Testing Library, Playwright + axe. Sem dependência nova.

**Spec:** `docs/superpowers/specs/2026-11-11-tela-resultados-design.md` (leia antes de cada tarefa).

## Global Constraints

- Todo código em `frontend/`; comandos rodam de `frontend/`. Código escrito pelo agent `frontend-developer`, teste falhando primeiro.
- Nenhuma regra de negócio muda; `lib/exportar/colunas.ts` intocado. Sem dependência nova. `frontend/vercel.json` intocado.
- Tokens existentes (`fundo`, `superficie`, `superficie-alt`, `linha`, `texto`, `forte`, `suave`, `apagado`, `coral`, `sobre-coral`, `coral-texto`, `coral-claro`, `coral-fundo`, `destaque`, `sobre-destaque`, `ok-fundo`, `anel`, `rounded-cartao`, `shadow-cartao`); tudo funciona em claro e `.dark`. `apagado` não serve para texto (reprova 4,5:1).
- Nomes acessíveis que testes e e2e usam continuam: `<Campo> de <arquivo>` nos campos (`Nome de ok.pdf`, `Motivo de ok.pdf`…), `Município confere: <arquivo>`, `Está validado: <arquivo>`, `Recebe CMIC: <arquivo>`, botão de status com nome `/REVISAR/`, lista `Pendências de <arquivo>`, imagem `Página do PDF <arquivo>`, tabela `Resultados do processamento`, todo `th` com `scope="col"`.
- Movimento existente (`animate-entrar`, `animate-pulso-coral`) continua; nada novo anima.
- Verificação de cada tarefa: `npm run type-check && npm run lint && npx vitest run --reporter=dot` e `npx playwright test` sem falhas.
- Commit ao fim de cada tarefa (português, Conventional Commits, última linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).

## Review Focus

1. Lote de 300+ linhas: o campo que cresce com o texto é só CSS (sem ler `scrollHeight` por célula); rolar e digitar continuam fluidos (Tarefa 1).
2. Tela entre 360 e 1365 px: a tabela rola na horizontal dentro do cartão e a página não tem rolagem horizontal (Tarefa 1, e2e).
3. Nome longo (36+ caracteres, ex.: `ISADORA STEFFANI MONTEIRO CAVALCANTE`) e texto colado com quebra de linha: quebra em linhas, nunca some; o valor salvo não tem `\n` (Tarefa 1).
4. Página ampliada aberta quando a linha some (filtro trocado, Limpar dados): a rolagem do `body` volta ao normal (Tarefa 2).
5. Tema escuro com a página ampliada aberta: axe limpo e contraste da barra (Tarefa 2, e2e).

---

### Task 1: Largura da página e tabela inteira

**Files:**
- Modify: `frontend/src/index.css` (classes `.largura-pagina`, `.campo-texto`; `.campo-celula` sem `min-w-[8rem]`)
- Modify: `frontend/src/App.tsx:337`, `frontend/src/components/Cabecalho.tsx:73`, `frontend/src/components/BarraExportar.tsx:29` (trocar `mx-auto max-w-[1400px] px-4 md:px-10` por `largura-pagina`)
- Modify: `frontend/src/components/TabelaResultados.tsx`, `frontend/src/components/TabelaResultados.test.tsx`
- Modify: `frontend/e2e/leitor.spec.ts` (teste novo de largura)

**Interfaces:**
- Produces: classe `.largura-pagina` = `mx-auto w-full max-w-[1920px] px-4 md:px-6`. Classe `.campo-texto` (wrapper do campo que cresce). Constante `ROTULOS_CURTOS: Record<CampoConferencia, string>` em `TabelaResultados.tsx` = `{ municipioConfere: 'Município', validado: 'Validado', recebeCmic: 'CMIC' }`. A Tarefa 2 mexe na mesma `TabelaResultados.tsx` (linha de OCR); esta tarefa não toca o painel de OCR além de manter o `colSpan` certo (`COLUNAS` passa a 9).

- [ ] **Step 1: Testes falhando (`TabelaResultados.test.tsx`)**
  - `os cabeçalhos são Arquivo, Município, CPF, NIS, NIB, Nome, Motivo, Conferências e Status`: `getAllByRole('columnheader').map(th => th.textContent)` igual a `['Arquivo','Município','CPF','NIS','NIB','Nome','Motivo','Conferências','Status']`; todos com `scope="col"`.
  - Substituir o teste `mostra as três colunas de conferência…` por: os três checkboxes com nomes `Município confere: a.pdf`, `Está validado: a.pdf`, `Recebe CMIC: a.pdf`, desmarcados; os textos visíveis `Município`, `Validado`, `CMIC` dentro da linha (`within(linha).getByText('Validado')`).
  - `a data de referência aparece na célula do arquivo`: célula que contém `a.pdf` também contém o texto da referência do registro de teste e o texto `Referência` (sr-only).
  - `Nome e Motivo são campos de várias linhas`: `getByLabelText('Nome de a.pdf').tagName === 'TEXTAREA'`, idem `Motivo de a.pdf`; o wrapper tem `data-valor` igual ao valor.
  - `Enter no nome não cria quebra de linha`: `userEvent.type(nome, 'X{Enter}')` → nenhuma chamada de `onEditar` com valor contendo `\n`.
  - `quebra de linha colada vira espaço`: `fireEvent.change(nome, { target: { value: 'ANA\nSOUZA' } })` → `onEditar` chamado com `(1, 'nome', 'ANA SOUZA')`.
  - `a tabela não tem rolagem própria na vertical`: o wrapper da tabela não tem a classe `max-h-[70vh]`.
- [ ] **Step 2:** `npx vitest run src/components/TabelaResultados.test.tsx` → FAIL nos testes novos.
- [ ] **Step 3: Implementar.**
  - `.largura-pagina` nos três contêineres.
  - Tabela `table-fixed w-full min-w-[80rem]`; `<colgroup>` com larguras fixas (sugestão: Arquivo 9rem, Município 9rem, CPF 7.5rem, NIS 7.5rem, NIB 7rem, Conferências 13rem, Status 7rem; Nome e Motivo sem largura). Ajuste se precisar, mantendo a soma ≤ 80rem.
  - Wrapper: `overflow-x-auto min-[1366px]:overflow-visible rounded-cartao border border-linha bg-superficie shadow-cartao` (sem `max-h`). `thead th` continua `sticky top-0 bg-superficie`.
  - Célula Arquivo: nome com `truncate` e `title`, e abaixo `<span className="sr-only">Referência: </span>` + data `text-xs text-suave tabular`. A faixa coral à esquerda das linhas REVISAR fica nessa célula.
  - Célula Conferências: três `label` lado a lado, cada uma com o rótulo curto (`text-xs text-suave`, `aria-hidden`) acima do checkbox; alvo mínimo 44×44; `aria-label` do checkbox inalterado.
  - Nome e Motivo: `<div className="campo-texto" data-valor={valor}>` + `<textarea rows={1}>` com a mesma classe `campo-celula`. `.campo-texto` é a técnica de grade: `display:grid`; `::after { content: attr(data-valor) ' '; white-space: pre-wrap; visibility: hidden; }`; textarea e `::after` em `grid-area: 1/1/2/2` com mesmo padding, fonte e borda; textarea `resize:none; overflow:hidden`. `onKeyDown`: Enter → `preventDefault()`. `onChange`: valor com `/\r?\n/g` trocado por espaço. Os campos numéricos e Município continuam `input`.
- [ ] **Step 4:** `npx vitest run src/components/TabelaResultados.test.tsx` → PASS; suíte inteira verde (ajustar outros testes só se dependiam do cabeçalho `Referência` ou dos `th` de conferência, explicando no relatório).
- [ ] **Step 5: e2e falhando (`e2e/leitor.spec.ts`)** — teste `em 1366 px a tabela cabe inteira e a página não rola na horizontal`: viewport `{ width: 1366, height: 768 }`, processar `ok.pdf` e `sem-cpf.pdf`, então
  - `document.documentElement.scrollWidth <= 1366`;
  - o wrapper da tabela tem `scrollWidth <= clientWidth`;
  - o `boundingBox()` do `columnheader` `Status` termina em `x + width <= 1366`.
  E em viewport `{ width: 1000, height: 768 }`: `document.documentElement.scrollWidth <= 1000` (a tabela rola dentro do cartão). Rodar antes da implementação do Step 3 se possível; registrar o resultado.
- [ ] **Step 6:** `npx playwright test` verde. Conferir em screenshot 1366 e 1920, claro e escuro, que Nome longo quebra em linhas.
- [ ] **Step 7:** Verificação global; commit `feat: tabela de resultados inteira a partir de 1366 px, com uma rolagem só`.

---

### Task 2: Página do OCR grande e em tela cheia

**Files:**
- Create: `frontend/src/components/PaginaAmpliada.tsx`, `frontend/src/components/PaginaAmpliada.test.tsx`
- Modify: `frontend/src/components/ImagemDaPagina.tsx`, `frontend/src/components/ImagemDaPagina.test.tsx`
- Modify: `frontend/src/components/TabelaResultados.tsx` (painel de OCR), `frontend/src/components/TabelaResultados.test.tsx`
- Modify: `frontend/e2e/ocr.spec.ts:134-135`
- Modify: `README.md` (linha dos PDFs escaneados: mencionar "Ampliar" em tela cheia)

**Interfaces:**
- Consumes: `TabelaResultados` da Tarefa 1 (`COLUNAS = 9`).
- Produces:
  ```ts
  // PaginaAmpliada.tsx
  export function PaginaAmpliada(props: { imagem: string; arquivo: string; onFechar: () => void }): JSX.Element;
  // renderiza via createPortal em document.body:
  // role="dialog", aria-modal="true", aria-label={`Página do PDF ${arquivo}, em tela cheia`}
  // img alt={`Página ampliada do PDF ${arquivo}`}  (não contém "Página do PDF <arquivo>", para não colidir com o seletor do e2e)
  // botões: 'Fechar' e um alternador com aria-pressed: rótulo 'Tamanho real' (pressed=false, caber na tela) / 'Caber na tela' (pressed=true)
  ```
  `ImagemDaPagina` mantém a assinatura `{ idDoRegistro, arquivo }`; o botão vira `Ampliar` com `aria-haspopup="dialog"` (sem `aria-pressed`, sem `Reduzir`).

- [ ] **Step 1: Testes falhando (`PaginaAmpliada.test.tsx`)**
  - abre com o foco em `Fechar`; `getByRole('dialog', { name: 'Página do PDF a.pdf, em tela cheia' })` existe e está em `document.body`.
  - `Escape` chama `onFechar` 1x; clicar `Fechar` chama `onFechar` 1x.
  - Tab a partir do último botão volta ao primeiro, e Shift+Tab do primeiro vai ao último (foco preso).
  - alternador: começa `Tamanho real` com `aria-pressed="false"`; clicar → nome `Caber na tela`, `aria-pressed="true"`.
  - montado: `document.body.style.overflow === 'hidden'`; desmontado (`unmount()`): volta ao valor anterior.
- [ ] **Step 2: Testes falhando (`ImagemDaPagina.test.tsx`)** — substituir o teste de `Ampliar/Reduzir` por: clicar `Ampliar` abre o dialog; `Escape` fecha e o foco volta ao botão `Ampliar`; o botão tem `aria-haspopup="dialog"`. Manter os testes de imagem `Página do PDF a.pdf` e de imagem indisponível.
- [ ] **Step 3: Testes falhando (`TabelaResultados.test.tsx`)** — registro `lidoPorOcr: true`, `status: 'REVISAR'`, 2 pendências, imagem guardada:
  - antes de abrir: linhas do `tbody` = 2 (linha do registro + painel); a lista `Pendências de a.pdf` não existe.
  - clicar o botão `/REVISAR/` → a lista `Pendências de a.pdf` aparece **dentro do painel** (mesmo `tr` que contém a imagem `Página do PDF a.pdf`), linhas do `tbody` continuam 2, e `aria-controls` do botão aponta para o `id` da lista.
  - registro sem OCR e REVISAR: continua abrindo a lista numa linha própria (comportamento de hoje).
- [ ] **Step 4:** `npx vitest run src/components` → FAIL nos novos.
- [ ] **Step 5: Implementar.**
  - Painel de OCR: `grid gap-6 md:grid-cols-[minmax(0,auto)_minmax(16rem,1fr)]`, com `sticky left-0` como hoje para telas estreitas. Esquerda: `ImagemDaPagina` com a imagem `max-h-[60vh] w-auto max-w-full object-contain rounded border border-linha bg-white`. Direita: título `Página lida por OCR: <arquivo>`, botão `Ampliar` e, se REVISAR e aberto, a lista de pendências com `id={`pendencias-${id}`}`. Para registros de OCR, a linha separada de pendências não é renderizada.
  - Como o botão `Ampliar` fica na coluna da direita e a imagem na esquerda, `ImagemDaPagina` pode ganhar a forma que o builder preferir (ex.: render da imagem e do botão separados), desde que o nome da imagem, o botão e o aviso de indisponível continuem.
  - `PaginaAmpliada`: overlay `fixed inset-0 z-50 flex flex-col bg-fundo/95 backdrop-blur`; barra no topo com o nome do arquivo (`text-forte`), alternador (`botao-secundario`) e `Fechar` (`botao-secundario`, ícone `X`); área `flex-1 overflow-auto` com a imagem: caber na tela = `max-h-full max-w-full object-contain mx-auto`; tamanho real = sem limites. `useEffect` para Esc, foco inicial, foco preso e `overflow` do `body` (guardar e restaurar no cleanup). Ao fechar, quem abriu devolve o foco ao `Ampliar`.
- [ ] **Step 6:** `npx vitest run` → PASS.
- [ ] **Step 7: e2e (`e2e/ocr.spec.ts`)** — no teste `tela com uma linha de OCR e a imagem da página aberta…`: trocar `Ampliar`/`Reduzir` por: clicar `Ampliar`, esperar `getByRole('dialog', { name: 'Página do PDF escaneado.pdf, em tela cheia' })` visível, rodar `semViolacoes(page)`, alternar para o tema escuro com o dialog fechado (Esc), reabrir e rodar `semViolacoes(page)` de novo; Esc fecha e `Ampliar` tem o foco.
- [ ] **Step 8:** `npx playwright test` verde. Screenshot 1366 claro e escuro com um registro de OCR aberto e com a página ampliada.
- [ ] **Step 9:** README: na linha dos PDFs escaneados, dizer que a página aparece ao lado dos campos e que "Ampliar" a abre em tela cheia.
- [ ] **Step 10:** Verificação global + `npm run build`; commit `feat: página lida por OCR maior, ao lado das pendências e em tela cheia`.
