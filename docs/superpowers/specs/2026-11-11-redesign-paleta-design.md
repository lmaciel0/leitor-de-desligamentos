# Redesign visual: paleta Navy/Cream/Coral e uma tela com mais vida

Data: 2026-11-11
Branch: `redesign-paleta` (a partir de `origin/main`, depois do merge do OCR no PR #5)
Mockups aprovados: `.superpowers/brainstorm/658128-1794423738/content/` (`barra-superior-v2.html` opção 2, `vida-corpo.html` opção 3, `tela-vazia.html` opção 2, `tema-escuro.html` opção 2)

## Intenção

O Leitor de desligamentos funciona, mas a tela é sóbria demais: barra superior alta (~110 px) que ocupa espaço sem dizer nada, triagem como barra chapada, nenhuma sensação de avanço. O usuário quer que o sistema tenha vida: que mostre em que passo o trabalho está, comemore quando a revisão termina e use a paleta nova.

Paleta (definida pelo usuário):

| Nome | Hex |
|---|---|
| Navy | `#14213D` |
| Cream | `#F4EDE0` |
| Coral | `#FF6B5B` |

## Metas

1. Trocar a paleta atual (eclipse `#213555`, honey `#E5D283`, denim) pela Navy/Cream/Coral, nos temas claro e escuro.
2. Barra superior baixa (~56 px) com linha de progresso de etapas.
3. Painel de números no lugar da barra de triagem, com contador animado e progresso da revisão.
4. Primeira tela de boas-vindas grande, que encolhe depois do primeiro PDF.
5. Movimento expressivo (fade de linhas, pulso, confete), sempre desligado com `prefers-reduced-motion`.

## Não-metas

- Nenhuma mudança de regra de negócio: parser, OCR, cálculo de status, validações, exportação (XLSX/CSV/…) e formato de exportação ficam iguais.
- Nada de rotas, páginas novas ou navegação. Continua uma tela só.
- Não trocar a stack (React 18, Tailwind 3, lucide-react, Bricolage Grotesque + IBM Plex Sans).

## Anti-metas (seria fracasso mesmo funcionando)

- Quebrar acessibilidade: os testes `axe` do e2e (`e2e/leitor.spec.ts`, `e2e/ocr.spec.ts`, regras WCAG) têm de continuar passando nos dois temas.
- Animação que atrapalha o trabalho: nada pisca sem parar, nada bloqueia clique, nada roda com "reduzir movimento" ligado.
- Mandar dado para fora: componentes do 21st entram como código no repositório, sem script, fonte ou CDN externos (a CSP em `frontend/vercel.json` continua `'self'`).

## Restrições

- Código de front-end escrito pelo agent `frontend-developer`, com TDD.
- Os testes atuais (Vitest + Playwright) continuam passando. Nomes acessíveis usados por eles se mantêm:
  - grupo `Triagem por status`, com botões cujo nome contém `N OK` e `N REVISAR` e usam `aria-pressed`;
  - botão `Modo escuro` com `aria-pressed`;
  - `data-testid="zona-upload"` e o rótulo que casa com `/escolha arquivos/i`;
  - botões `Remover <arquivo>`, `Abrir trabalho`, `Salvar trabalho`, `Processar arquivos`, `Limpar dados`.
  Se algum texto visível precisar mudar, o nome acessível antigo continua válido (via `aria-label`) ou o teste é ajustado junto, explicando o motivo.
- Contraste WCAG AA (4,5:1 texto normal, 3:1 texto grande e elementos de interface). Coral `#FF6B5B` com texto branco dá ~2,8:1 e **não passa**; ver tokens abaixo.
- Dependência nova permitida: só `canvas-confetti` (e `@types/canvas-confetti`).
- `prefers-reduced-motion: reduce` já zera animações em `src/index.css`; o confete e o contador também precisam respeitar (sem confete, número final direto).

## Decisões do usuário

### Barra superior (`barra-superior-v2.html`, opção 2)
- Altura ~56 px, fundo cream (igual ao da página), separada por linha fina.
- Esquerda: quadradinho coral com "L" + "Leitor de desligamentos" em navy (Bricolage, ~16 px).
- Centro: linha de progresso com 4 etapas — Enviar, Processar, Revisar, Exportar. Feitas: bolinha navy com ✓ e linha navy até a atual. Atual: bolinha coral com halo. Próximas: apagadas.
- Direita: selo "🔒 Local" (balão ao passar o mouse/foco: "Seus PDFs não saem deste computador.") e botão de tema.
- A etapa só indica; não é clicável.
- Etapa derivada do estado:
  - sem PDF escolhido e sem registros → Enviar;
  - PDFs escolhidos, sem registros → Processar;
  - processando → Processar, com a bolinha girando;
  - há registros → Revisar;
  - depois de exportar → Exportar marcado como feito (volta a Revisar se o usuário editar algo depois). Limpar dados volta a Enviar.
- Celular: a linha some e vira texto "Etapa 3 de 4 · Revisar".
- A etapa atual é anunciada para leitor de tela (ex.: `aria-current="step"` numa lista ordenada).

### Primeira tela (`tela-vazia.html`, opção 2)
- Sem PDFs e sem registros: zona de upload grande no centro com folhas desenhadas, título "Solte os termos de desligamento aqui", subtítulo "PDF digital ou escaneado. Nada sai deste computador.", botões "Escolher PDFs" e "Abrir trabalho salvo".
- Ao arrastar PDFs por cima: folhas se abrem e a borda fica coral.
- Depois do primeiro PDF (ou com registros), encolhe para a faixa compacta (zona tracejada numa linha, como hoje) com a barra de ações normal.

### Corpo com resultados (`vida-corpo.html`, opção 3)
- Painel de 4 cartões no lugar da `BarraTriagem`:
  - "arquivos lidos" (total);
  - "OK" (navy);
  - "para revisar" (fundo coral claro, número coral escuro);
  - "Revisão": cartão navy cheio, texto "X de Y conferidos" e barra de avanço coral. Só aparece se Y > 0.
- Os cartões "OK" e "para revisar" filtram a tabela como a triagem faz hoje (alternam, `aria-pressed`).
- Números contam de 0 até o valor (~0,6 s) quando um lote termina ou um trabalho é aberto.
- Tabela em cartão branco com sombra suave. Status como etiqueta: "OK" navy claro, "Revisar · N" coral. Linhas a revisar mantêm fundo coral claro e faixa coral à esquerda.
- A etiqueta "Revisar" pulsa de leve (regra na seção "Pulso").
- Linhas entram com fade ao aparecer.
- Confete curto quando a revisão termina (regra na seção "Confete").
- Fundo cream com duas manchas difusas: coral no canto superior direito, navy no inferior esquerdo. Não interferem em contraste de texto.

### Conta "conferidos" (refinada depois da revisão do documento; escolha minha)
- Y = registros que precisaram de revisão em algum momento do lote: os que eram REVISAR quando o lote terminou de processar (ou ao abrir um trabalho), mais qualquer registro OK que vire REVISAR por edição depois. X = quantos desses estão OK agora.
- Consequência: "Y de Y conferidos" equivale a zero registros REVISAR na tela, sem contradição com o cartão "para revisar".
- Abrir e salvar trabalho preserva a conta: o arquivo de trabalho ganha um campo opcional por registro (ex.: `revisarNoLote: boolean`), no mesmo padrão de chaves opcionais de `lidoPorOcr`/`avisosOcr` em `src/lib/trabalho.ts`. O leitor da v2 monta o objeto só com chaves conhecidas, então fica na versão 2, sem versão 3.
- Trabalho antigo sem o campo: Y = registros que estão REVISAR ao abrir.
- "Lote" recomeça em: processar, abrir trabalho, limpar dados.

### Confete (escolha minha)
- Dispara quando o número de REVISAR passa de > 0 para 0 dentro do lote atual, uma vez por lote. Se depois voltar a ter REVISAR e zerar de novo, não repete.
- Lote que termina de processar já com 0 REVISAR: confete uma vez.
- Abrir trabalho que já está todo OK: sem confete (não houve conclusão nesta sessão).

### Pulso da etiqueta "Revisar" (escolha minha)
- Pulsa 3 vezes quando a linha aparece (fim do lote, abrir trabalho, filtro que a mostra pela primeira vez) e para. Nada pulsa indefinidamente.
- Não depende de "linha aberta" e não é salvo no trabalho.

### Etapa "Exportar" (escolha minha)
- Conta como exportar: qualquer exportação bem-sucedida da `BarraExportar` (todos os formatos e o "somente REVISAR"). "Salvar trabalho" não conta.
- Depois de exportado, qualquer edição de célula ou marcação de conferência volta a etapa para Revisar.
- A `BarraExportar` ganha um callback de sucesso (ex.: `onExportado`).

### Durante o processamento
- Bolinha "Processar" girando na barra superior.
- Botão "Processando X de Y" com barra de progresso coral embaixo.
- A mensagem de etapa (inclusive OCR, "Lendo página N por OCR...") num cartão discreto com indicador animado, em vez de texto solto.

### Barra de exportar
- Mantém posição fixa no rodapé; fundo cream translúcido com blur, botão principal em coral.
- Exportar com sucesso marca a etapa "Exportar" como feita.

### Tema escuro (`tema-escuro.html`, opção 2)
- Fundo `#0D1220`, cartões/superfícies navy `#14213D` (ou próximo, ex.: `#161D30` para superfície e `#14213D` para destaque), linhas `#252E45`, texto cream `#F4EDE0`, texto suave `#9BA3B5`, coral clareado `#FF7A6B`.
- Cartão "Revisão" em navy `#14213D` com barra coral.
- Linhas a revisar: coral com ~10 % de opacidade + faixa coral.
- Alternância de tema continua em `src/lib/tema.ts` (classe `.dark`), sem mudança de comportamento.

## Como fazer (decidido)

1. **Tokens primeiro**, com a skill `ui-design-system`: cores (claro/escuro), espaçamento, raios, sombras, durações e curvas de movimento. Substituem as variáveis de `src/index.css` e as cores de `tailwind.config.js`. Os nomes antigos (`eclipse`, `honey`, `denim`, `tijolo`…) saem; os componentes passam a usar os nomes novos.
2. **Componentes do 21st** (pedido do usuário; MCP `mcp__21st__*`). A autenticação é o primeiro passo da implementação, feita pelo usuário antes das tarefas de componente. Se o MCP não responder, aviso o usuário antes de escrever os componentes à mão. Servem de base para: cartão de número com contador animado, stepper/linha de etapas, zona de upload de boas-vindas, botão com barra de progresso. O código entra adaptado à paleta, sem dependências além de `canvas-confetti`. Se um componente do 21st puxar `framer-motion` ou outra lib, ele é reescrito em CSS/React puro.
3. Implementação pelo agent `frontend-developer`, componente a componente, com teste primeiro para comportamento novo (etapa derivada do estado, conta de conferidos, filtro pelos cartões, encolher da zona de upload, confete só uma vez por conclusão, reduced motion).

## Tokens (proposta de partida; o builder ajusta pelos contrastes)

Claro:

| Papel | Valor |
|---|---|
| fundo | Cream `#F4EDE0` |
| superfície | `#FFFFFF` (cartões, tabela) / `#FBF7F0` (zona de upload) |
| linha | `#E2D8C6` |
| texto | `#1B2438` |
| texto forte / marca | Navy `#14213D` |
| texto suave | `#5E6676` |
| ação primária | fundo Coral `#FF6B5B`, **texto Navy `#14213D`** (~5,7:1) |
| coral para texto sobre claro | `#B23A2C` (ex.: "Revisar", números de revisar) |
| coral claro (fundo de revisar) | `#FFE4DF` / `#FFF3F0` |

Escuro: ver seção do tema escuro; ação primária coral `#FF7A6B` com texto `#14213D`.

Escolha minha (pode ser revista): os mockups mostravam texto branco no botão coral; isso reprova no contraste, então o texto do botão primário passa a navy, mantendo o coral exato da paleta.

## Deixado ao builder

- Estrutura de componentes novos (ex.: `BarraEtapas`, `PainelNumeros`, `BoasVindas`) e como derivar a etapa (hook ou função pura).
- Desenho exato das folhas da boas-vindas (SVG inline).
- Duração/curvas finas das animações, dentro de "curto e discreto".
- Ajustes de tom nos tokens para passar contraste, desde que fiquem reconhecíveis como Navy/Cream/Coral.
- Atualizar o `README`/docs se descreverem a aparência.
- Adicionar `.superpowers/` ao `.gitignore`.
