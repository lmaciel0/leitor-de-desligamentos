# Redesign Navy/Cream/Coral: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a paleta pela Navy/Cream/Coral e dar vida à tela: barra superior baixa com linha de etapas, painel de números, boas-vindas grande, tabela com etiquetas, movimento e confete.

**Architecture:** Tokens de cor/raio/sombra/movimento em variáveis CSS (`src/index.css`) expostos ao Tailwind. Lógica nova em funções puras testáveis (`src/lib/etapa.ts`, `src/lib/revisao.ts`, `src/lib/confete.ts`); componentes novos finos por cima. `App.tsx` continua dono do estado.

**Tech Stack:** React 18, TypeScript, Tailwind 3, lucide-react, Vitest + Testing Library, Playwright + axe. Nova dependência: `canvas-confetti@1.9.3` e `@types/canvas-confetti`.

**Spec:** `docs/superpowers/specs/2026-11-11-redesign-paleta-design.md` (leia antes de cada tarefa). Mockups: `.superpowers/brainstorm/658128-1794423738/content/`.

## Global Constraints

- Todo código em `frontend/`. Comandos rodam de `frontend/`.
- Código escrito pelo agent `frontend-developer`, teste falhando primeiro.
- Paleta: Navy `#14213D`, Cream `#F4EDE0`, Coral `#FF6B5B`. Escuro: fundo `#0D1220`, superfície `#161D30`, destaque `#14213D`, linha `#252E45`, texto `#F4EDE0`, suave `#9BA3B5`, coral `#FF7A6B`.
- Texto sobre coral é navy `#14213D` (branco sobre coral reprova: ~2,8:1). Contraste WCAG AA nos dois temas.
- Nenhuma regra de negócio muda (parser, OCR, status, exportação).
- Sem script, fonte ou CDN externos; CSP de `frontend/vercel.json` não muda.
- Dependências novas: só `canvas-confetti` e `@types/canvas-confetti`. Nada de `framer-motion`.
- Toda animação some com `prefers-reduced-motion: reduce` (regra global já existe em `src/index.css`); contador mostra o valor final direto e o confete não dispara.
- Nomes acessíveis que os testes usam continuam válidos: grupo `Triagem por status` com botões de nome `N OK` / `N REVISAR` e `aria-pressed`; botão `Modo escuro` com `aria-pressed`; `data-testid="zona-upload"`; rótulo `/escolha arquivos/i`; input `Abrir trabalho`; botões `Processar arquivos`, `Limpar dados`, `Salvar trabalho`, `Remover <arquivo>`, `Baixar XLSX`, `Baixar CSV`, `Baixar somente REVISAR`.
- Verificação de cada tarefa: `npm run type-check && npm run lint && npx vitest run --reporter=dot` sem falhas.
- Commit ao fim de cada tarefa (mensagem em português, Conventional Commits, com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).

## Review Focus

1. Tema escuro: cada componente novo precisa de cor nos dois temas; o teste axe do e2e roda também com `.dark` (Tarefa 8).
2. Lote grande (300+ linhas): pulso e fade são CSS por linha, sem timer JS por linha; nada roda indefinidamente (Tarefa 5).
3. Trabalho salvo por versão anterior (sem `revisarNoLote`) abre e conta corretamente (Tarefa 3).
4. Edição durante o contador animado: o nome acessível dos cartões já tem o valor final (Tarefa 4).
5. Tela estreita (360 px): barra superior sem rolagem horizontal; etapas viram texto (Tarefa 2).

---

### Task 0: 21st e referências (coordenador, sem código de produto)

Feita pela sessão principal, não pelo agent (o agent não tem acesso ao MCP).

- [ ] **Step 1:** Pedir ao usuário a autenticação do 21st (`mcp__21st__authenticate`).
- [ ] **Step 2:** Buscar componentes de referência: cartão de estatística com número animado; stepper horizontal com linha de progresso; dropzone de upload em destaque; botão com barra de progresso. Salvar o código/descrição de cada um em `.superpowers/21st/<nome>.md`.
- [ ] **Step 3:** Adicionar `.superpowers/` ao `.gitignore` da raiz.
- [ ] **Step 4:** Se o MCP falhar, avisar o usuário antes de seguir sem referências.
- [ ] **Step 5:** Commit do `.gitignore`.

Cada tarefa seguinte que tiver referência recebe o caminho do `.md` correspondente; o agent adapta à paleta e às restrições, sem copiar dependências.

---

### Task 1: Tokens da paleta nos dois temas

**Files:**
- Modify: `frontend/src/index.css`, `frontend/tailwind.config.js`
- Modify (troca de classes): todos os `frontend/src/components/*.tsx` e `frontend/src/App.tsx`
- Modify: `frontend/e2e/leitor.spec.ts` (axe no escuro)

**Interfaces:**
- Produces: classes Tailwind com estes papéis (variáveis CSS `--<papel>` em canais RGB, como hoje):
  `fundo`, `superficie`, `superficie-alt`, `linha`, `texto`, `forte`, `suave`, `apagado`, `coral`, `sobre-coral`, `coral-texto`, `coral-claro`, `coral-fundo`, `destaque`, `sobre-destaque`, `ok-fundo`, `anel`.
  Mais `rounded-cartao` (12px), `shadow-cartao` (`0 6px 20px rgb(20 33 61 / .08)`), e variáveis `--duracao-curta: 150ms`, `--duracao-media: 600ms`, `--curva: cubic-bezier(.2,.8,.2,1)`.
- Valores claros: fundo `#F4EDE0`, superficie `#FFFFFF`, superficie-alt `#FBF7F0`, linha `#E2D8C6`, texto `#1B2438`, forte `#14213D`, suave `#5E6676`, apagado `#9AA0AC`, coral `#FF6B5B`, sobre-coral `#14213D`, coral-texto `#B23A2C`, coral-claro `#FFE4DF`, coral-fundo `#FFF3F0`, destaque `#14213D`, sobre-destaque `#FFFFFF`, ok-fundo `#E3E7F0`, anel `#14213D`.
- Valores escuros (`.dark`): fundo `#0D1220`, superficie `#161D30`, superficie-alt `#161D30`, linha `#252E45`, texto `#F4EDE0`, forte `#F4EDE0`, suave `#9BA3B5`, apagado `#5F6880`, coral `#FF7A6B`, sobre-coral `#14213D`, coral-texto `#FFB3A9`, coral-claro `#3A2026` (fundo de cartão "revisar"), coral-fundo `rgb(255 122 107 / .10)` equivalente opaco sobre a superfície, destaque `#14213D`, sobre-destaque `#F4EDE0`, ok-fundo `rgb(244 237 224 / .12)` equivalente opaco, anel `#F4EDE0`.
- Os nomes antigos (`eclipse`, `honey`, `sobre-honey`, `papel`, `tinta`, `denim`, `denim-claro`, `honey-claro`, `tijolo`, `primario`, `primario-hover`, `sobre-primario`, `ok`, `acento`) deixam de existir.

- [ ] **Step 0:** Invocar a skill `ui-design-system` para conferir a escala de tokens (espaço, raio, sombra, movimento) e o contraste de cada par texto/fundo acima. Ajustar tons só se algum par ficar abaixo de AA, mantendo-os reconhecíveis.
- [ ] **Step 1: Teste falhando (e2e):** em `e2e/leitor.spec.ts`, no teste que clica em `Modo escuro` (linha ~48), depois de `toHaveClass(/dark/)`, rodar a mesma checagem axe do arquivo (`new AxeBuilder({ page }).withTags(REGRAS_WCAG).analyze()`) e esperar `violations` vazio. Rodar `npx playwright test e2e/leitor.spec.ts` antes da troca; registrar o resultado (pode já passar; o objetivo é proteger o escuro novo).
- [ ] **Step 2:** Reescrever as variáveis em `src/index.css` e as cores em `tailwind.config.js` com os papéis acima. `body` com fundo `fundo` e duas manchas difusas fixas (`body::before`, `position: fixed`, `pointer-events: none`, `z-index: -1`): radial coral ~20% de opacidade no canto superior direito e navy ~10% no inferior esquerdo; no escuro, coral ~16% e sem a navy.
- [ ] **Step 3:** `.botao-primario`: fundo `coral`, texto `sobre-coral`, hover com coral ~8% mais escuro, `rounded-lg`. `.botao-secundario`: fundo `superficie`, borda `linha`, texto `forte`, hover `superficie-alt`. Foco visível com `anel`. `.campo-celula` com bordas em `linha`/`forte`.
- [ ] **Step 4:** Trocar as classes antigas em todos os componentes e no `App.tsx` pelas novas (mesma função visual). O cabeçalho atual (`bg-eclipse`) fica temporariamente `bg-fundo border-b border-linha text-forte`; a Tarefa 2 o substitui.
- [ ] **Step 5:** `grep -rnE "eclipse|honey|denim|tijolo|primario|papel|tinta|acento|\bok\b" src --include=*.tsx --include=*.css` só pode achar texto que não é classe (ex.: status `'OK'`).
- [ ] **Step 6:** Verificação global + `npx playwright test` (inclui axe claro e escuro). Esperado: tudo verde.
- [ ] **Step 7:** Commit `feat: paleta Navy/Cream/Coral nos dois temas`.

---

### Task 2: Barra superior com linha de etapas

**Files:**
- Create: `frontend/src/lib/etapa.ts`, `frontend/src/lib/etapa.test.ts`
- Create: `frontend/src/components/BarraEtapas.tsx`, `frontend/src/components/BarraEtapas.test.tsx`
- Create: `frontend/src/components/Cabecalho.tsx` (logo, nome, etapas, selo, tema)
- Modify: `frontend/src/components/BotaoTema.tsx` (visual), `frontend/src/components/BarraExportar.tsx` (+`onExportado`), `frontend/src/App.tsx`, `frontend/src/App.test.tsx`, `frontend/src/components/BarraExportar.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // lib/etapa.ts
  export type Etapa = 'enviar' | 'processar' | 'revisar' | 'exportado';
  export const ETAPAS: readonly { id: 'enviar' | 'processar' | 'revisar' | 'exportar'; rotulo: string }[];
  // rótulos: 'Enviar', 'Processar', 'Revisar', 'Exportar'
  export function etapaAtual(estado: { arquivos: number; registros: number; carregando: boolean; exportado: boolean }): Etapa;
  // BarraEtapas.tsx
  export function BarraEtapas(props: { etapa: Etapa; processando: boolean }): JSX.Element;
  // BarraExportar.tsx: nova prop obrigatória
  onExportado: () => void; // chamada só depois de baixarBlob sem erro
  ```
- Estado novo no App: `exportado: boolean`. Fica `true` em `onExportado`; volta a `false` em `editar`, `conferir`, `processar` (início), `aplicarTrabalho`, `limpar`.

- [ ] **Step 1: Testes falhando de `etapaAtual`** (`lib/etapa.test.ts`):
  - `{arquivos:0, registros:0, carregando:false, exportado:false}` → `'enviar'`
  - `{arquivos:2, registros:0, carregando:false, exportado:false}` → `'processar'`
  - `{arquivos:2, registros:0, carregando:true, exportado:false}` → `'processar'`
  - `{arquivos:2, registros:5, carregando:true, exportado:false}` → `'processar'` (reprocessando)
  - `{arquivos:0, registros:5, carregando:false, exportado:false}` → `'revisar'`
  - `{arquivos:0, registros:5, carregando:false, exportado:true}` → `'exportado'`
  - `{arquivos:0, registros:0, carregando:false, exportado:true}` → `'enviar'`
- [ ] **Step 2:** Rodar `npx vitest run src/lib/etapa.test.ts`: FAIL (módulo inexistente). Implementar. PASS.
- [ ] **Step 3: Testes falhando de `BarraEtapas`**:
  - `nav` com nome `Etapas`, contendo `ol` com 4 `li` na ordem Enviar, Processar, Revisar, Exportar.
  - `etapa='revisar'`: o item Revisar tem `aria-current="step"`; Enviar e Processar têm texto acessível de feito (ex.: `sr-only` "concluída"); Exportar não tem `aria-current`.
  - `etapa='exportado'`: os 4 marcados como concluídos; nenhum `aria-current`.
  - Texto móvel presente: `etapa='revisar'` → `Etapa 3 de 4 · Revisar`; `etapa='exportado'` → `Etapa 4 de 4 · Exportado`. (Na tela larga ele fica `sm:hidden`/`aria-hidden`, e a lista fica `hidden sm:flex`; o teste só confere o texto.)
  - `processando=true` com `etapa='processar'`: bolinha atual com classe de giro (`animate-spin` num ícone `LoaderCircle`).
- [ ] **Step 4:** FAIL → implementar conforme mockup `barra-superior-v2.html` opção 2 (bolinhas 18px, linha 2px; feitas `destaque` com ✓; atual `coral` com halo `ring-4 ring-coral/25`; próximas `apagado`). PASS.
- [ ] **Step 5: Testes falhando no App** (`App.test.tsx`):
  - Ao abrir: `aria-current="step"` em Enviar.
  - Depois de subir PDF: em Processar.
  - Depois de processar: em Revisar.
  - Clicar `Baixar XLSX` (com `baixarBlob` mockado, já é) → todas concluídas, sem `aria-current`; editar uma célula depois → `aria-current` volta para Revisar.
  - `Limpar dados` → Enviar.
  - Selo: existe elemento com texto `Local` e nome/descrição acessível `Seus PDFs não saem deste computador.` (ex.: `title` + `aria-label`, ou tooltip ligado por `aria-describedby` que aparece em hover e foco).
  - `BarraExportar.test.tsx`: `onExportado` chamado 1x após exportação bem-sucedida e 0x quando `gerar` lança erro.
- [ ] **Step 6:** FAIL → implementar `Cabecalho` (altura 56px, `bg-fundo border-b border-linha`, logo 26px coral com "L" em `sobre-coral`, nome em Bricolage 16px `text-forte`, `BarraEtapas` no centro, selo e `BotaoTema` à direita) e usar no `App`. `BotaoTema` vira botão quadrado 36–44px só com ícone, `aria-label="Modo escuro"`, mantendo `aria-pressed`. PASS em toda a suíte.
- [ ] **Step 7:** Em 360px de largura (`npm run dev` + navegador ou Playwright com viewport 360), conferir sem rolagem horizontal no cabeçalho.
- [ ] **Step 8:** Verificação global; commit `feat: barra superior baixa com linha de etapas`.

---

### Task 3: Conta de revisão do lote

**Files:**
- Modify: `frontend/src/tipos.ts` (`revisarNoLote?: boolean`)
- Create: `frontend/src/lib/revisao.ts`, `frontend/src/lib/revisao.test.ts`
- Modify: `frontend/src/lib/trabalho.ts`, `frontend/src/lib/trabalho.test.ts`, `frontend/src/App.tsx`, `frontend/src/App.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // tipos.ts, em DesligamentoRecord
  /** Precisou de revisão em algum momento do lote (alimenta "X de Y conferidos"). Ausente vale false. */
  revisarNoLote?: boolean;
  // lib/revisao.ts
  export function marcarRevisao(registros: DesligamentoRecord[]): DesligamentoRecord[]; // revisarNoLote = revisarNoLote || status === 'REVISAR'; devolve o mesmo objeto quando nada muda
  export function contarRevisao(registros: DesligamentoRecord[]): { conferidos: number; total: number }; // total = com revisarNoLote; conferidos = desses, status 'OK'
  ```
- Estado novo no App: `lote: number` (começa 0; `+1` ao terminar `processar` com sucesso, em `aplicarTrabalho` e em `limpar`). Tarefas 4 e 7 usam.
- `processar` e `aplicarTrabalho` aplicam `marcarRevisao` nos registros recebidos; `editar` e `conferir` aplicam `marcarRevisao` no registro alterado.
- Exportação XLSX/CSV não ganha coluna (colunas são explícitas em `lib/exportar/colunas.ts`; não mexer).

- [ ] **Step 1: Testes falhando de `revisao.ts`:**
  - `marcarRevisao` marca `true` quem é REVISAR, mantém `true` quem já era e virou OK, deixa ausente/false quem é OK e nunca foi.
  - `contarRevisao([ok, revisar, okQueFoiRevisar])` → `{ conferidos: 1, total: 2 }`.
  - `contarRevisao([])` → `{ conferidos: 0, total: 0 }`.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: Testes falhando de `trabalho.ts`:**
  - `gerarTrabalho` + `lerTrabalho` preserva `revisarNoLote: true` num registro hoje OK.
  - Registro com `revisarNoLote: 'sim'` → erro `Registro 1: campo "revisarNoLote" inválido.`
  - Registro sem a chave abre sem a chave (o App é quem completa via `marcarRevisao`).
  - Versão continua `2`.
- [ ] **Step 4:** FAIL → ler a chave opcional no mesmo padrão de `lerMarcaDeOcr` → PASS.
- [ ] **Step 5: Testes falhando no App** (sem UI ainda; observar pelo trabalho salvo): processar `[registro(1), revisar(2)]`, corrigir o nome do 2 até OK, clicar `Salvar trabalho`, ler o JSON passado a `baixarBlob` → registro 2 com `revisarNoLote: true`, registro 1 sem `true`. Abrir trabalho antigo sem a chave com 1 REVISAR → salvar de novo → esse registro sai com `revisarNoLote: true`.
- [ ] **Step 6:** FAIL → implementar no App → PASS.
- [ ] **Step 7:** Verificação global; commit `feat: conta de registros que passaram por revisão no lote`.

---

### Task 4: Painel de números (substitui a BarraTriagem)

**Files:**
- Create: `frontend/src/lib/contagem.ts` (hook), `frontend/src/lib/contagem.test.ts`
- Create: `frontend/src/components/PainelNumeros.tsx`, `frontend/src/components/PainelNumeros.test.tsx`
- Delete: `frontend/src/components/BarraTriagem.tsx`, `frontend/src/components/BarraTriagem.test.tsx` (casos migram para `PainelNumeros.test.tsx`)
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `contarRevisao` e `lote` (Task 3); `Status` de `tipos.ts`.
- Produces:
  ```ts
  // lib/contagem.ts
  export function useContagem(alvo: number, chave: number, duracaoMs = 600): number;
  // Quando `chave` muda: anima de 0 até `alvo` (requestAnimationFrame, easing de saída).
  // Quando só `alvo` muda: vai direto ao novo valor. Com prefers-reduced-motion: sempre `alvo`.
  // PainelNumeros.tsx
  export function PainelNumeros(props: {
    total: number; ok: number; revisar: number;
    conferidos: number; totalRevisao: number;
    statusAtivo: Status | null; onAlternar: (status: Status) => void;
    lote: number;
  }): JSX.Element;
  ```

- [ ] **Step 1: Testes falhando de `useContagem`** (`renderHook`, timers falsos ou mock de `requestAnimationFrame`):
  - `chave` nova com alvo 42: primeiro valor `0`, ao fim de 600ms `42`.
  - Mesmo `chave`, alvo 42 → 41: retorna `41` sem animar.
  - `matchMedia('(prefers-reduced-motion: reduce)').matches = true`: retorna `42` de cara.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: Testes falhando de `PainelNumeros`** (migrar os de `BarraTriagem.test.tsx`):
  - `role="group"` com nome `Triagem por status`.
  - Botões com nome exato `18 OK` e `6 REVISAR` (via `aria-label` com os valores finais; o número animado visível fica `aria-hidden`), `aria-pressed` refletindo `statusAtivo`, clique chama `onAlternar('OK' | 'REVISAR')`.
  - Botão `REVISAR` existe mesmo com 0 quando `statusAtivo === 'REVISAR'` (comportamento atual).
  - Cartão "arquivos lidos" com o total, não é botão.
  - Cartão "Revisão" com texto `4 de 11 conferidos` e `role="progressbar"` (`aria-valuenow=4`, `aria-valuemax=11`); ausente quando `totalRevisao === 0`.
- [ ] **Step 4:** FAIL → implementar conforme `vida-corpo.html` opção 3: grade `1fr 1fr 1fr 1.4fr` (empilha em 2 colunas abaixo de `md`), cartões `superficie` `rounded-cartao` borda `linha`; número em Bricolage 28px extrabold. Rótulos visíveis: `arquivos lidos`, `OK`, `REVISAR` (escolha do plano: o rótulo visível bate com o nome acessível). "REVISAR" com fundo `coral-fundo`, borda coral suave, número `coral-texto`. "Revisão" com fundo `destaque`, texto `sobre-destaque`, barra 6px trilho translúcido e preenchimento `coral`. Cartão ativo: `ring-2 ring-anel`; inativo quando outro está ativo: `opacity-60`.
- [ ] **Step 5:** Trocar `BarraTriagem` por `PainelNumeros` no App, passando `lote` e `contarRevisao(registros)`. PASS em toda a suíte (os testes de App/e2e que usam `1 REVISAR` continuam passando).
- [ ] **Step 6:** Verificação global; commit `feat: painel de números com contador e progresso da revisão`.

---

### Task 5: Tabela em cartão, etiquetas de status e movimento das linhas

**Files:**
- Modify: `frontend/src/components/TabelaResultados.tsx`, `frontend/src/components/TabelaResultados.test.tsx`, `frontend/src/index.css` (keyframes), `frontend/tailwind.config.js` (animações)

**Interfaces:**
- Produces: classes `animate-entrar` (fade + 4px de subida, 300ms, 1x) e `animate-pulso-coral` (halo coral, 1,2s, **3 iterações**, depois para).

- [ ] **Step 1: Testes falhando:**
  - Registro OK: célula de status mostra etiqueta com texto exato `OK` (mantém `getByText('OK')`).
  - Registro REVISAR com 2 pendências: o botão que abre as pendências continua com o mesmo nome acessível de hoje; a etiqueta visível mostra `Revisar · 2` e tem a classe `animate-pulso-coral`.
  - Toda `tr` de registro tem `animate-entrar`.
  - Não existe `setInterval`/`setTimeout` no componente (o movimento é só CSS).
- [ ] **Step 2:** FAIL → implementar: wrapper da tabela `rounded-cartao border-linha shadow-cartao bg-superficie`; cabeçalho `text-suave`; linhas REVISAR `bg-coral-fundo` com faixa `shadow-[inset_3px_0_0_rgb(var(--coral))]`; etiqueta OK `bg-ok-fundo text-forte rounded-full px-2.5 py-0.5 text-xs font-bold`; etiqueta Revisar `bg-coral-claro text-coral-texto` idem. Keyframes em `index.css` com `animation-iteration-count: 3` no pulso. PASS.
- [ ] **Step 3:** Checar `ImagemDaPagina` e a lista de pendências com os tokens novos nos dois temas (visual, `npm run dev`).
- [ ] **Step 4:** Verificação global; commit `feat: tabela em cartão com etiquetas e movimento das linhas`.

---

### Task 6: Boas-vindas, faixa compacta, barra de ações e processamento

**Files:**
- Create: `frontend/src/components/BoasVindas.tsx`, `frontend/src/components/BoasVindas.test.tsx`
- Modify: `frontend/src/components/ZonaUpload.tsx` (+teste), `frontend/src/App.tsx`, `frontend/src/App.test.tsx`, `frontend/src/components/BarraExportar.tsx`, `frontend/src/components/AvisoReprocessar.tsx` (só estilo)

**Interfaces:**
- Produces:
  ```ts
  export function BoasVindas(props: {
    onAdicionar: (arquivos: File[]) => void;
    onAbrirTrabalho: (arquivo: File | undefined) => void;
    entradaTrabalho: React.RefObject<HTMLInputElement>;
  }): JSX.Element;
  ```
- Regra do App: `arquivos.length === 0 && registros.length === 0 && !carregando` → só `BoasVindas` (sem `ZonaUpload` e sem a barra de ações). Caso contrário → `ZonaUpload` compacta + barra de ações de hoje.
- A frase "Escolha um ou mais PDFs e clique em Processar arquivos." sai (a boas-vindas a substitui).

- [ ] **Step 1: Testes falhando de `BoasVindas`:**
  - Título `Solte os termos de desligamento aqui` (heading) e texto `PDF digital ou escaneado. Nada sai deste computador.`
  - O `label` raiz tem `data-testid="zona-upload"`; input de arquivo com nome que casa `/escolha arquivos/i` (`aria-label="Escolher PDFs ou soltar aqui: escolha arquivos"` ou equivalente), `accept="application/pdf,.pdf"`, `multiple`; botão visual `Escolher PDFs`.
  - Soltar arquivos (`fireEvent.drop`) chama `onAdicionar` com eles; `dragOver` liga o estado "arrastando" (classe `border-coral` e as folhas com a classe de abrir).
  - Input `Abrir trabalho` (label visível `Abrir trabalho salvo`, `aria-label="Abrir trabalho"`, `accept="application/json,.json"`) chama `onAbrirTrabalho` e usa o ref recebido.
- [ ] **Step 2:** FAIL → implementar conforme `tela-vazia.html` opção 2: cartão central `max-w-[520px]`, borda tracejada 2px `linha` (coral ao arrastar), fundo `superficie/60`, 3 folhas em SVG inline (a do meio com contorno coral) que giram ±10° e sobem 6px ao arrastar (`transition` com `--duracao-curta`). PASS.
- [ ] **Step 3: Testes falhando no App:**
  - Tela inicial: existe heading `Solte os termos de desligamento aqui`; não existe botão `Processar arquivos`.
  - Depois de subir um PDF: some o heading; aparecem `Processar arquivos` e a zona compacta.
  - Ajustar o teste atual de "Selecione ao menos um PDF." (`App.test.tsx` ~linha 90) para o caso alcançável: abrir trabalho (arquivos vazios, registros > 0) e clicar `Processar arquivos`.
  - Durante o processamento (`processarLote` pendente com `onProgresso(1, 3)`): `role="progressbar"` com `aria-valuenow=1`, `aria-valuemax=3` junto do botão; com `onEtapa('Lendo página 2 por OCR...')` o texto aparece dentro de um cartão com `role="status"`.
- [ ] **Step 4:** FAIL → implementar: `ZonaUpload` compacta com ícone em quadrado `coral-claro`/`coral-texto`; barra de progresso 3px `coral` embaixo do botão Processar; cartão de etapa `superficie rounded-cartao` com `LoaderCircle animate-spin`. PASS.
- [ ] **Step 5:** `BarraExportar`: fundo `fundo/90` com `backdrop-blur`, borda `linha`; `Baixar XLSX` com `botao-primario` (coral). `AvisoReprocessar`: cartão com tokens novos.
- [ ] **Step 6:** Verificação global; commit `feat: boas-vindas, faixa compacta e progresso do processamento`.

---

### Task 7: Confete ao terminar a revisão

**Files:**
- Create: `frontend/src/lib/confete.ts`, `frontend/src/lib/confete.test.ts`
- Modify: `frontend/package.json` (`canvas-confetti@1.9.3`, `@types/canvas-confetti`), `frontend/src/App.tsx`, `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `lote` (Task 3).
- Produces:
  ```ts
  // lib/confete.ts
  export function soltarConfete(): void;
  // Sem efeito se matchMedia('(prefers-reduced-motion: reduce)') casar.
  // Cria uma vez um <canvas> fixo, tela cheia, pointer-events none, aria-hidden, z-index acima do conteúdo,
  // e usa confetti.create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true })
  // (useWorker false: worker via blob: seria barrado pela CSP worker-src 'self').
  // Disparo: ~120 partículas, spread 70, origem y 0.3, cores ['#FF6B5B', '#14213D', '#F4EDE0', '#FFB3A9'].
  // Import dinâmico de 'canvas-confetti' para não pesar o carregamento inicial.
  ```
- Regra no App (spec, seção "Confete"): por `lote`, no máximo 1 disparo.
  - Lote vindo de `processar` com `registros > 0` e 0 REVISAR ao terminar → dispara.
  - Durante o lote, REVISAR passa de > 0 para 0 → dispara (se ainda não disparou nesse lote).
  - Lote vindo de `aplicarTrabalho` já com 0 REVISAR → não dispara.
  - `limpar` → não dispara.

- [ ] **Step 1: Testes falhando de `confete.ts`** (mock de `canvas-confetti`): com reduced motion → `create` não chamado; sem → `create` chamado 1x com `useWorker: false` mesmo em 2 disparos, e a instância chamada 2x.
- [ ] **Step 2:** FAIL → instalar `npm i canvas-confetti@1.9.3 && npm i -D @types/canvas-confetti` → implementar → PASS.
- [ ] **Step 3: Testes falhando no App** (`vi.mock('./lib/confete', () => ({ soltarConfete: vi.fn() }))`):
  - Processar `[registro(1)]` → `soltarConfete` 1x.
  - Processar `[registro(1), revisar(2)]` → 0x; corrigir o nome do 2 → 1x; apagar o nome de novo e corrigir → continua 1x.
  - Abrir trabalho `[registro(1)]` → 0x.
  - Abrir trabalho `[revisar(1)]`, corrigir → 1x.
  - Processar `[]` → 0x.
- [ ] **Step 4:** FAIL → implementar no App (ref com `{ lote, origem, jaSoltou, revisarAnterior }`, avaliado num `useEffect` sobre `[lote, totalRevisar, registros.length]`) → PASS.
- [ ] **Step 5:** Verificação global; `npm run build` passa; commit `feat: confete quando a revisão do lote termina`.

---

### Task 8: Verificação final

- [ ] **Step 1:** `npm run type-check && npm run lint && npx vitest run --reporter=dot && npm run build`: tudo verde.
- [ ] **Step 2:** `npx playwright test`: verde, incluindo axe no claro e no escuro.
- [ ] **Step 3:** `npm run preview` e conferir no navegador (claro e escuro, 1400px e 360px): primeira tela, upload, processamento, revisão até o confete, exportar marcando a etapa. Comparar com os mockups.
- [ ] **Step 4:** Atualizar `README`/docs se descreverem cores ou a tela antiga.
- [ ] **Step 5:** Commit de docs, se houver.
