# Tela de resultados: tabela inteira e página do OCR maior

Data: 2026-11-11
Branch: `tela-resultados` (a partir de `main` depois do PR #6)
Aprovado no chat pelo usuário ("pode, escreve o plano"), sem rodada de perguntas: o usuário pediu "a tabela inteira e a imagem maior" e deixou o layout comigo.

## Intenção

Depois do redesign, a tela de resultados ficou "pequena e mal encaixada" (palavras do usuário). Hoje:
- o conteúdo para em 1400 px de largura, mas a tabela tem ~1870 px, então as colunas da direita (conferências e status) ficam escondidas atrás de uma rolagem horizontal;
- a tabela rola dentro de uma caixa de 70% da altura da tela, o que dá rolagem dupla (a da caixa e a da página);
- a página lida por OCR aparece com 224 px de altura, pequena demais para conferir os campos.

## Metas

1. Todas as colunas à vista, sem rolagem horizontal, a partir de 1366 px de largura (notebook comum).
2. Uma rolagem só: a página. O cabeçalho da tabela fica grudado no topo ao rolar.
3. A página do OCR grande o bastante para ler os campos ao lado da linha, e uma forma de vê-la em tela cheia.

## Não-metas

- Nenhuma regra de negócio muda (parser, OCR, status, validações, exportação). A ordem e os nomes das colunas na exportação (`lib/exportar/colunas.ts`) não mudam.
- Sem dependência nova. CSP de `frontend/vercel.json` não muda.
- Não mexer na tela de boas-vindas, no painel de números nem nos filtros além da largura.

## Anti-metas

- Nome ou motivo cortado sem como ler: o texto quebra linha em vez de sumir.
- Quebrar acessibilidade: axe WCAG 2.1 AA continua limpo nos dois temas, inclusive com a página ampliada aberta.
- Lote grande (300+ linhas) ficar lento por medição de altura célula a célula em JavaScript.

## Decidido

### Largura
- O conteúdo da página (cabeçalho, corpo e barra de exportar) passa de 1400 px para até 1920 px, com margem lateral menor no desktop (24 px).

### Tabela
- Colunas, nesta ordem: Arquivo, Município, CPF, NIS, NIB, Nome, Motivo, Conferências, Status.
- "Referência" deixa de ser coluna: a data aparece embaixo do nome do arquivo, menor e em cor suave, com o rótulo "Referência" só para leitor de tela.
- As três conferências viram uma coluna "Conferências" com três caixas lado a lado. Rótulos visíveis curtos: "Município", "Validado", "CMIC". O nome acessível de cada caixa continua o de hoje (`Município confere: a.pdf`, `Está validado: a.pdf`, `Recebe CMIC: a.pdf`), que contém o rótulo visível. Cada caixa mantém alvo de 44 px.
- Nome e Motivo dividem o espaço que sobra e quebram linha quando o texto é longo (campo de várias linhas que cresce com o conteúdo, só com CSS). Enter não cria quebra de linha; uma quebra colada vira espaço.
- A caixa com rolagem própria sai. A partir de 1366 px a página rola sozinha e o cabeçalho da tabela gruda no topo. Abaixo de 1366 px a tabela rola na horizontal dentro do cartão, como hoje, e a página não ganha rolagem horizontal.

### Página lida por OCR
- O painel abaixo da linha fica em duas colunas: a página à esquerda, com até 60% da altura da tela; à direita, o título "Página lida por OCR: <arquivo>", o botão "Ampliar" e, para registros a revisar, a lista de pendências (aberta e fechada pelo mesmo botão de status de hoje).
- "Ampliar" abre a página em tela cheia, sobre tudo. Esc ou "Fechar" fecham, e o foco volta para "Ampliar". Dentro dela, um botão alterna entre "caber na tela" e "tamanho real" (rolando quando maior que a tela). O foco fica preso dentro enquanto está aberta.
- A imagem continua só em memória, como hoje.

## Deixado ao builder
- Larguras exatas das colunas fixas, desde que a tabela caiba em 1366 px.
- O desenho do botão e da barra da página ampliada, com os tokens existentes nos dois temas.
- Atualizar o README na linha que descreve a página do OCR.
