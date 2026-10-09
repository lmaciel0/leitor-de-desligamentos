# Leitor de Desligamentos

[![Testes](https://github.com/lmaciel0/leitor-de-desligamentos/actions/workflows/testes.yml/badge.svg)](https://github.com/lmaciel0/leitor-de-desligamentos/actions/workflows/testes.yml)

Extrai, revisa e exporta dados de formulários PDF de desligamento do Cartão Mais Infância Ceará. **Tudo roda no navegador**: os PDFs não são enviados a nenhum servidor.

## Funcionalidades

- Upload de vários PDFs (seletor ou arrastar e soltar) e leitura de todas as páginas.
- PDFs repetidos (mesmo conteúdo, mesmo com outro nome) são processados uma só vez, com aviso. Arquivos que não são PDF são ignorados com aviso.
- Colunas `Arquivo`, `Referencia`, `Município`, `CPF`, `NIS`, `NIB`, `Nome` e `Motivo` em tabela editável.
- Motivo do desligamento: lê a opção marcada com `( X )` entre as várias opções do formulário.
- Nomes que quebram em duas linhas no formulário são juntados.
- A data de referência é o dia do processamento.
- CPF, NIS e NIB preservados como texto, incluindo zeros à esquerda.
- Status automático `OK` ou `REVISAR`, com a lista de pendências de cada linha. Um CPF que não tem 11 dígitos (por exemplo, erro de digitação no PDF) vira `REVISAR`. Motivo `OUTRO` sem o detalhe (que costuma ser manuscrito) também vira `REVISAR`, para você digitar o detalhe na tabela.
- Barra de triagem que filtra por status, e filtros por município e motivo.
- Download em XLSX, CSV UTF-8 separado por ponto e vírgula e XLSX só com os registros `REVISAR`. Prefira o XLSX: ao abrir um CSV no Excel, os zeros à esquerda se perdem.
- Processar de novo, com resultados na tela, pede confirmação: o reprocessamento substitui os resultados e descarta as edições manuais.
- Acessível por teclado e leitor de tela (WCAG 2.1 AA; verificado com axe-core nos principais estados).
- PDFs escaneados (sem texto selecionável) não são lidos: aparecem como `REVISAR` para digitação manual.

## Privacidade

Nenhum dado sai do computador. O site é estático, o CSP (`frontend/vercel.json`) bloqueia conexões para outros domínios e as fontes são servidas pelo próprio site. A pasta `archives-models/` está no `.gitignore` e serve só para guardar, localmente, formulários de exemplo.

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
