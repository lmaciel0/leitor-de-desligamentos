# Leitor de Desligamentos

[![Testes](https://github.com/lmaciel0/leitor-de-desligamentos/actions/workflows/testes.yml/badge.svg)](https://github.com/lmaciel0/leitor-de-desligamentos/actions/workflows/testes.yml)

Extrai, revisa e exporta dados de formulários PDF de desligamento do Cartão Mais Infância Ceará. **Tudo roda no navegador**: os PDFs não são enviados a nenhum servidor.

## Funcionalidades

- Upload de vários PDFs (seletor ou arrastar e soltar) e leitura de todas as páginas.
- PDFs repetidos (mesmo conteúdo, mesmo com outro nome) são processados uma só vez, com aviso. Arquivos que não são PDF são ignorados com aviso.
- Colunas `Arquivo`, `Referencia`, `Município`, `CPF`, `NIS`, `NIB`, `Nome` e `Motivo` em tabela editável.
- Três conferências feitas à mão, em checkbox: `Município confere`, `Está validado` e `Recebe CMIC`. Elas não mudam o status e saem na exportação como `SIM` ou `NÃO`.
- Motivo do desligamento: lê a opção marcada com `( X )` entre as várias opções do formulário.
- Nomes que quebram em duas linhas no formulário são juntados.
- A data de referência é o dia do processamento.
- CPF, NIS e NIB preservados como texto, incluindo zeros à esquerda.
- Status automático `OK` ou `REVISAR`, com a lista de pendências de cada linha. Viram `REVISAR`: CPF que não tem 11 dígitos (por exemplo, erro de digitação no PDF), CPF ou NIS com dígito verificador errado, e motivo `OUTRO` sem o detalhe (que costuma ser manuscrito), para você digitar o detalhe na tabela.
- Limites por arquivo: PDF com mais de 20 MB, mais de 10 páginas ou que leve mais de 20 s para ser lido vira `REVISAR` com o motivo, e o resto do lote continua.
- **Salvar trabalho / Abrir trabalho:** guarda os registros (com edições e conferências) num arquivo `.json` que você salva onde quiser, para continuar depois. Nada fica guardado no navegador. O arquivo contém CPF e NIS: guarde-o em local seguro.
- Barra de triagem que filtra por status, e filtros por município e motivo.
- Download em XLSX, CSV UTF-8 separado por ponto e vírgula e XLSX só com os registros `REVISAR`. Prefira o XLSX: ao abrir um CSV no Excel, os zeros à esquerda se perdem.
- Processar de novo, com resultados na tela, pede confirmação: o reprocessamento substitui os resultados e descarta as edições manuais.
- Modo escuro: botão no cabeçalho. Na primeira visita segue o tema do sistema; depois lembra a sua escolha neste navegador (só o tema fica guardado).
- Acessível por teclado e leitor de tela (WCAG 2.1 AA; verificado com axe-core nos principais estados).
- PDFs escaneados (sem texto selecionável) não são lidos: aparecem como `REVISAR` para digitação manual.
- Funciona em navegadores mais antigos (testado simulando o Chrome 109, o último do Windows 7/8). Em navegadores antigos demais, mostra um aviso pedindo para atualizar, em vez de uma tela branca.

## Privacidade

Nenhum dado sai do computador. O site é estático, o CSP (`frontend/vercel.json`) bloqueia conexões para outros domínios e as fontes são servidas pelo próprio site. A pasta `archives-models/` está no `.gitignore` e serve só para guardar, localmente, formulários de exemplo.

## Stack

React 18, TypeScript, Vite, Tailwind CSS, `pdfjs-dist` (leitura de PDF, build legacy), `write-excel-file` (XLSX), Vitest, Playwright + axe-core (testes no navegador), ESLint.

## Como executar

Requer Node.js 22.13 ou superior.

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm test         # testes (Vitest)
npm run lint     # ESLint, com regras de acessibilidade
npm run build    # gera frontend/dist
npm run test:e2e # testes no Google Chrome instalado (Playwright + axe), sob o CSP do vercel.json
```

## Deploy na Vercel

Importe o repositório com **Root Directory = `frontend`** e preset Vite. O `vercel.json` já define instalação, build, saída e cabeçalhos de segurança.

## Licença

MIT. Veja `LICENSE`.
