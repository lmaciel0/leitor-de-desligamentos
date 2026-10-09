# Leitor de Desligamentos: migração para execução 100% no navegador

Data: 2026-10-09
Status: aguardando revisão

## 1. Objetivo

Colocar o Leitor de Desligamentos online na Vercel sem perder o comportamento atual: extrair os campos de formulários PDF de desligamento, permitir revisão e edição numa tabela e exportar para XLSX/CSV.

Hoje o sistema é um backend Java (Spring Boot, PDFBox, POI) mais um frontend React que roda localmente. A nova versão elimina o backend: todo o processamento acontece no navegador do usuário, em TypeScript, e a Vercel serve apenas arquivos estáticos.

Quem usa: operadores que processam lotes de formulários de desligamento. Os PDFs contêm CPF e NIS, que são dados pessoais. Por isso a garantia central do produto é que os PDFs nunca saem do computador do usuário.

## 2. Decisões tomadas e escopo

Decisões acordadas durante o brainstorming:

- **Sem backend.** Descartado Python, que era a ideia inicial, porque a Vercel limita o corpo das requisições a cerca de 4,5 MB e não oferece Tesseract. Executar no navegador resolve os dois problemas e dá a melhor posição em privacidade.
- **Sem Supabase.** Sem servidor e sem dado persistido, ele não teria função. Se for necessário login no futuro, entra como camada separada, em outra spec.
- **Sem OCR nesta versão.** O OCR do Java só rodava quando o PDF não tinha texto, e as regex foram calibradas para texto nativo. PDFs escaneados serão sinalizados como `REVISAR`. Adicionar `tesseract.js` fica para uma versão futura, se aparecerem PDFs escaneados reais.
- **Frontend mantido:** React 18, TypeScript, Vite e Tailwind. O visual é redesenhado (seção 8).

Fora de escopo: login, persistência de dados, OCR, validação de dígitos verificadores do CPF (o Java valida só o tamanho de 11 dígitos; a paridade é mantida), qualquer chamada de rede com dados do usuário.

## 3. Arquitetura

Tudo fica em `frontend/`. A pasta `backend/` é removida no último passo (seção 11).

```
frontend/src/
  tipos.ts                      DesligamentoRecord, Status
  lib/pdf/extrairTexto.ts       pdf.js: texto da página com linhas reconstruídas
  lib/parser/campos.ts          port de FieldParser.java (funções puras)
  lib/exportar/xlsx.ts          geração do XLSX
  lib/exportar/csv.ts           geração do CSV
  lib/processar.ts              arquivo → texto → campos → registro
  components/                   ZonaUpload, BarraTriagem, Filtros,
                                TabelaResultados, BarraExportar
  App.tsx                       estado e composição
```

Cada módulo em `lib/` não depende de React e é testável isoladamente. `campos.ts` e `csv.ts` são funções puras. `extrairTexto.ts` é a única parte que toca o `pdf.js`.

## 4. Extração de texto e parser

### 4.1 Extração

`extrairTexto(buffer: ArrayBuffer): Promise<string>` usa `pdfjs-dist` com o worker carregado pelo Vite. Para cada página:

1. Obter os itens com `getTextContent()`.
2. Agrupar os itens em linhas pela coordenada Y (tolerância de metade da altura da fonte do item).
3. Ordenar cada linha por X e juntar os itens com um espaço quando houver intervalo visível entre eles.
4. Ordenar as linhas de cima para baixo e juntá-las com `\n`.
5. Juntar as páginas com `\n`.

Esse passo existe porque o parser depende de quebras de linha (por exemplo, o valor de `NOME ...:` pode estar na linha seguinte) e o `pdf.js` não devolve texto em linhas por padrão, ao contrário do `PDFTextStripper` do PDFBox. É o principal risco técnico e é coberto pelos testes da seção 10.

Se o texto resultante for vazio depois de `trim()`, o PDF é tratado como escaneado (seção 7).

### 4.2 Parser

`campos.ts` é um port fiel de `FieldParser.java`, com as mesmas entradas e saídas:

- `parseText(texto)` devolve `{ MUNICIPIO, CPF, NIS, NOME, MOTIVO }`.
  - `MUNICIPIO`: valor após `MUNICÍPIO:`, sem número no final.
  - `CPF`: apenas dígitos, limitado aos 11 primeiros.
  - `NIS`: apenas dígitos.
  - `NOME`: valor após `NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO:`, sem ruído numérico ou de pontuação no final.
  - `MOTIVO`: linha marcada com `(X)` sob `MOTIVO DO DESLIGAMENTO`, até `ASSINATURA`, `OBSERVAÇÕES`, `DATA:` ou `MUNICÍPIO:`. Quando o motivo começa com "outro", acrescenta `: ` e o primeiro detalhe não vazio e sem caixa de marcação que vier depois.
  - Se o valor não estiver na mesma linha do rótulo, usa a primeira linha não vazia seguinte.
- `inconsistencies(registro)` lista os campos vazios pelo nome em maiúsculas e acrescenta `CPF inválido` quando o CPF tem tamanho diferente de 11.
- `statusFor(registro)` devolve `OK` quando não há inconsistências e `REVISAR` caso contrário.

Cuidados de tradução das regex Java para JavaScript:

- `CASE_INSENSITIVE | UNICODE_CASE` vira as flags `iu`.
- `\R` (quebra de linha do Java) vira `/\r\n|\r|\n/`.
- `strip()` vira `trim()`.
- `labelPattern` escapa cada token com uma função de escape de regex e os junta com `\s+`.
- O padrão de token `[\wÀ-ÿ]+|\([^)]*\)` é mantido.

## 5. Modelo de dados

```ts
type Status = 'OK' | 'REVISAR';

interface DesligamentoRecord {
  id: number;
  arquivo: string;
  referencia: string;      // dd/MM/yyyy, data do processamento
  municipio: string;
  cpf: string;             // sempre string, preserva zeros à esquerda
  nis: string;
  nome: string;
  motivo: string;
  status: Status;
  inconsistencias: string[];
}
```

Os registros ficam no estado do React. Editar uma célula recalcula `status` e `inconsistencias` com `inconsistencies()` no próprio navegador, o que substitui o endpoint `/api/recalcular`. Depois de uma edição, as inconsistências voltam a ser derivadas só dos campos, como no `refreshStatus` do Java.

## 6. Exportação

Colunas, na ordem e com a grafia do Java: `ARQUIVO`, `Referencia`, `MUNICIPIO`, `CPF`, `NIS`, `NOME`, `MOTIVO`, `STATUS`.

- **CSV:** separador `;`, UTF-8 com BOM (`﻿` no início), campos com `;`, `"` ou quebra de linha entre aspas com `"` duplicado. Gerado à mão, sem biblioteca.
- **XLSX:** uma aba chamada `Desligamentos`, todas as células como texto (CPF e NIS não podem perder zeros), largura de coluna ajustada ao conteúdo. Biblioteca: `write-excel-file`, por ser leve e gravar células de texto. Se não atender ao ajuste de largura ou ao tipo texto, a alternativa é `exceljs`. O SheetJS do npm está desatualizado e fica descartado.
- **Somente REVISAR:** o mesmo XLSX, filtrando os registros com `status === 'REVISAR'`.

Os downloads usam `Blob` e `URL.createObjectURL`, sem rede.

## 7. Fluxo e erros

1. O usuário escolhe os PDFs. Cada `File` vira `ArrayBuffer` no navegador.
2. `processar.ts` processa os arquivos em sequência e atualiza um indicador de progresso. O trabalho pesado fica no worker do `pdf.js`, então a tela não trava.
3. Cada arquivo gera um registro. A referência é `new Date()` formatada em `dd/MM/yyyy`.
4. "Limpar dados" zera arquivos, registros e filtros.

Tratamento de erro por arquivo, sem interromper o lote:

- PDF corrompido, protegido por senha ou com falha no `pdf.js`: registro vazio, `REVISAR`, inconsistência `erro de processamento: <mensagem>`.
- PDF sem texto selecionável: registro vazio, `REVISAR`, inconsistência `PDF sem texto selecionável (escaneado)`.
- Arquivo que não é PDF é recusado no seletor (`accept`) e, se passar, cai no caso de PDF corrompido.

## 8. Design visual

Direção aprovada: ferramenta de triagem, com a tabela como protagonista e sem cards.

Cores (`#4F709C` foi assumido para o denim; o valor informado continha uma letra O):

| Token | Hex | Uso |
|---|---|---|
| Eclipse | `#213555` | faixa do topo, botão primário, texto forte |
| Denim | `#4F709C` | foco, links, botão secundário, linhas de grade |
| Honey | `#E5D283` | exclusivamente o estado `REVISAR` |
| Papel | `#F3F5F8` | fundo |
| Tinta | `#16233A` e `#5B6B82` | texto e texto secundário |
| Tijolo | `#A33A2E` | somente erro de processamento |

Contraste medido: honey sobre eclipse 8,1:1; denim sobre branco 5,1:1. Honey nunca é cor de texto sobre fundo claro; entra como preenchimento com texto eclipse.

Tipografia: Bricolage Grotesque nos títulos e IBM Plex Sans na interface e na tabela, com números tabulares em CPF e NIS. Sem rótulos em caixa alta.

Layout, alinhado à esquerda:

- Faixa eclipse com o título e a frase "Seus PDFs não saem deste computador".
- Zona de upload compacta, lista de arquivos com botão de remover, botões Processar e Limpar.
- **Barra de triagem:** barra proporcional OK versus REVISAR com as contagens. Cada trecho é um botão (`aria-pressed`) que filtra por status. É o elemento memorável da interface e substitui os três cards de métrica.
- Filtros de município e motivo como menus compactos no lugar dos `select multiple`; o status é filtrado pela barra de triagem.
- Tabela editável com cabeçalho fixo. Linhas `REVISAR` têm barra lateral e fundo honey suave; o texto "REVISAR" aparece na coluna de status, então a cor não é o único sinal.
- As inconsistências de uma linha aparecem ao expandi-la, no lugar da tabela de inconsistências separada.
- Rodapé fixo com Baixar XLSX, Baixar CSV e Baixar somente REVISAR.

Qualidade mínima: responsivo até celular (tabela com rolagem horizontal), foco visível por teclado, `prefers-reduced-motion` respeitado, sem movimento decorativo.

## 9. Privacidade e deploy

- `vercel.json` com cabeçalho `Content-Security-Policy` contendo `connect-src 'self'`, para o navegador bloquear qualquer envio de dados a terceiros. O worker do `pdf.js` e as fontes vêm do próprio domínio.
- Fontes hospedadas no próprio site via `@fontsource`; o `@import` do Google Fonts atual é removido.
- Sem analytics, sem logs de conteúdo, sem armazenamento (`localStorage` não é usado para dados dos registros).
- Build: `vite build`, saída em `dist`. Projeto Vercel com diretório raiz `frontend`.

## 10. Testes

Vitest, com os testes do projeto Java portados com as mesmas entradas e saídas esperadas.

- **Parser** (de `FieldParserTest`): texto de exemplo gera `CIDADE EXEMPLO`, `00123456789`, `000123456789`, `MARIA DA SILVA` e `OUTRO: Mudança de renda da família` com status `OK`; campo ausente exige revisão; CPF com 10 dígitos gera `CPF inválido` e `REVISAR`. Casos adicionais: valor do rótulo na linha seguinte, município com número no final, nome com ruído numérico.
- **Exportação** (de `ExportServiceTest`): o CSV começa com BOM e o cabeçalho `ARQUIVO;Referencia;MUNICIPIO;CPF;NIS;NOME;MOTIVO;STATUS`; o XLSX é um contêiner ZIP (primeiros bytes `PK`); o escape de `;`, `"` e quebra de linha; CPF com zero à esquerda preservado.
- **Extração de PDF:** um PDF de exemplo sintético, sem dados reais, com o mesmo layout do formulário, gerado no próprio teste com `pdf-lib` (dependência de desenvolvimento). O teste extrai o texto com `extrairTexto` e confere que `parseText` produz os campos esperados. Cobre o risco de ordem de linhas do `pdf.js`. O repositório não recebe PDFs com dados reais.
- **Processamento:** um arquivo inválido gera registro `REVISAR` com `erro de processamento` sem derrubar o lote; um PDF sem texto gera `PDF sem texto selecionável (escaneado)`.
- **Interface:** teste de componente para a barra de triagem (clicar filtra) e para o recálculo de status ao editar uma célula.

CI do GitHub (`.github/workflows/testes.yml`): um único job Node com `npm ci`, `npm test` e `npm run build`. O job de Maven é removido junto com o backend.

## 11. Migração e remoção do Java

Ordem de execução:

1. Criar o parser, a exportação e os testes em TypeScript e deixá-los verdes.
2. Implementar a extração com `pdf.js` e o teste com PDF sintético.
3. Refazer a interface conforme a seção 8, ligada à nova camada `lib/`.
4. Configurar a Vercel (`vercel.json`, CSP, fontes locais) e publicar um preview.
5. Só então remover `backend/`, `Iniciar Leitor.bat` e `scripts/`, e reescrever o `README.md` (descrição, stack, como rodar com `npm run dev`, deploy).

Antes do passo 5, comparar a saída do parser TS com a do Java sobre os mesmos PDFs reais do usuário, fora do repositório, para confirmar a paridade.

## 12. Riscos

- **Ordem de linhas do `pdf.js`.** Se o algoritmo da seção 4.1 não reproduzir o texto do PDFBox em algum layout, os campos saem vazios e as linhas ficam `REVISAR`. Mitigação: PDF sintético nos testes e comparação com a saída do Java no passo 5 da migração.
- **Biblioteca de XLSX.** `write-excel-file` pode não oferecer o ajuste automático de largura. Mitigação: calcular a largura pelo maior texto da coluna, ou usar `exceljs`.
- **PDFs escaneados.** Ficam sinalizados e precisam de digitação manual até o OCR existir.
- **Lotes grandes.** O processamento sequencial no navegador usa a memória do usuário. Lotes de centenas de PDFs são aceitáveis; milhares não foram avaliados.

## 13. Informação necessária do usuário

Um ou mais PDFs reais do formulário, mantidos fora do repositório, para validar a paridade do parser no passo 5. O PDF sintético dos testes é criado a partir do layout descrito pelos rótulos do próprio parser.

## 14. Ajustes após validar com formulários reais (2026-10-09)

Dois formulários reais (modelos em `archives-models/`, fora do git) foram processados pelo backend Java e pelo parser TypeScript: a saída foi idêntica campo a campo. A comparação também expôs defeitos que o Java já tinha, corrigidos aqui por decisão do usuário:

- **Nome em duas linhas.** O nome do responsável pode quebrar para a linha seguinte ("APARECIDA DOS SANTOS" / "NASCIMENTO"). O parser junta até duas linhas de continuação que só tenham letras e não comecem por um rótulo do formulário.
- **CPF sem corte.** O CPF mantém todos os dígitos presentes no PDF. Um CPF com mais de 11 dígitos (um dos modelos traz 12) deixa de ser cortado em silêncio e vira `REVISAR` com `CPF inválido`. Ao editar a célula, CPF, NIS e NIB aceitam só dígitos.
- **Nova coluna NIB.** O NIB (`NIB: 0863785131`, na mesma linha do NIS) entra depois do NIS, na tabela e nas exportações, e é obrigatório para o status `OK`. O cabeçalho exportado passa a ser `ARQUIVO;Referencia;MUNICIPIO;CPF;NIS;NIB;NOME;MOTIVO;STATUS`.
- **Motivo "OUTRO".** O marcador real é `( X )`, com espaços. Para "OUTRO" o detalhe vem da mesma linha (sobre os sublinhados) ou da linha seguinte; sem detalhe o motivo fica só "OUTRO". A seção do motivo termina em "DATA EM QUE SAIU DO PERFIL". Esse caso não pôde ser validado com um formulário real, porque nenhum dos modelos tem "OUTRO" marcado.
