# Pacote técnico: OCR mais leve, CI, normalizador e limites

Data: 2026-11-11
Branch: `pacote-tecnico` (a partir de `main` depois do PR #7)
Escopo aprovado no chat pelo usuário ("pode seguir, escreve o design"), depois de um levantamento no código, no build e nos 5 PDFs reais. O usuário pediu que eu decidisse o caso `(/ )`; a decisão e a evidência estão na seção 3.

## Intenção

Fechar as pendências técnicas adiadas no PR #5 (OCR) e no PR #7 (tela de resultados) que valem o custo. Nada aqui muda o que o operador vê, salvo um campo de motivo lido corretamente com mais frequência. São ajustes de peso de deploy, segurança do CI, robustez do normalizador do OCR e ruído do build.

## Metas

1. `public/ocr` com cerca de 9,5 MB em vez de cerca de 19 MB, sem mudar o que o navegador baixa.
2. CI instala dependências sem rodar scripts de instalação.
3. O normalizador do OCR corrige dois erros de leitura vistos nos formulários reais: caixa vazia lida como `(/ )` e rótulo do NIS com dígito (`N1S:`).
4. `npm run build` sem o aviso de chunk acima de 500 kB, com o motivo escrito no código.
5. Estouro do limite de páginas no OCR não descarta um motor de OCR que o arquivo nem chegou a usar.

## Não-metas

- Dividir o chunk do pdfjs ou trocar a forma de carregá-lo.
- Atualizar `tesseract.js`, `pdfjs-dist` ou qualquer outra dependência. O `package-lock.json` não muda.
- CSP do worker em Firefox e Safari, arquivo de trabalho editado à mão, normalização de URL no preview do Vite.
- Os minors da tela de resultados (borda do `th` grudado, largura da coluna Nome, `isComposing` no Enter, teste de limpeza do `body.overflow`) e o `tabIndex=0` em "Tamanho real". Este último está certo: área com rolagem precisa receber foco pelo teclado.
- Pontos de acessibilidade do redesign: o PR #6 corrigiu todos os Minors; não há item aberto.

## Anti-metas

- OCR quebrar em algum navegador por falta de núcleo: o e2e do OCR (`frontend/e2e/ocr.spec.ts`) tem de continuar passando sob o CSP do `vercel.json`.
- O normalizador alterar dígitos de CPF, NIS, NIB ou datas. A regra do arquivo ("nunca mexe em dígitos") continua valendo para os dados. O `1` de `N1S` é parte do rótulo, não um dado.
- Uma caixa marcada virar vazia. Só `(/ )` vira `( )`; `( x )`, `(x)`, `( X |` e afins continuam como hoje.
- Silenciar o aviso de chunk para todo chunk: o limite novo fica logo acima do maior chunk atual, não em um valor alto.

## Levantamento (2026-11-11)

- `frontend/public/ocr/core` tem 4 arquivos: `tesseract-core-lstm.wasm.js` e `tesseract-core-simd-lstm.wasm.js` (3,9 MB cada), `tesseract-core.wasm.js` e `tesseract-core-simd.wasm.js` (4,7 MB cada). `frontend/src/lib/ocr/motorOcr.ts` cria o worker com `OEM.LSTM_ONLY`, e com esse modo o worker do tesseract.js escolhe a variante `-lstm` (com ou sem SIMD). As duas sem LSTM nunca são baixadas.
- `npm run build`: `pdf-*.js` tem 541,88 kB (164,72 kB gzip) e é o único chunk acima de 500 kB. Ele vem de `frontend/src/lib/pdf/carregarPdfjs.ts`, que já usa `import()` sob demanda. O `worker-*.js` de 1,28 MB é o worker do pdf.js, emitido como asset, e não entra no aviso.
- `package-lock.json` tem 3 pacotes com `"hasInstallScript": true` (corrigido depois da leitura do revisor): `esbuild@0.25.12` (`postinstall: node install.js`, usado pelo Vite no build e no dev), `fsevents` (só macOS, não instala no runner Linux) e `tesseract.js` (`opencollective-postinstall || true`, só uma mensagem). O binário do esbuild vem da dependência opcional `@esbuild/linux-x64`, que está no lockfile e não precisa de script. O CI (`.github/workflows/testes.yml`) roda `npm ci`, lint, testes, build e e2e.
- `frontend/src/lib/processar.ts`, `registroDoOcr`: `emUso` recebe a geração do motor antes de `lerPorOcr`. No `catch`, qualquer `LimiteExcedido` com `emUso` descarta o motor. Mas `lerPorOcr` (`frontend/src/lib/ocr/lerPorOcr.ts:72`) lança `LimiteExcedido('PDF com mais de N páginas')` antes de `prepararMotor()`, então um PDF escaneado com páginas demais descarta um motor sadio, e o próximo PDF escaneado paga a carga do modelo de novo.
- OCR cru dos 5 PDFs reais (`~/Área de trabalho/Desligamentos`), rodado no app em `npm run dev`, antes do normalizador. Ver a seção 3.

## 1. Núcleos do OCR

`frontend/scripts/copiar-ocr.mjs` passa a copiar só `tesseract-core-lstm.wasm.js` e `tesseract-core-simd-lstm.wasm.js`. O comentário da lista diz por quê: o app usa `OEM.LSTM_ONLY`, e o worker só pede as variantes `-lstm`. Se alguém trocar o OEM em `motorOcr.ts`, a lista tem de voltar a ter os 4 núcleos. Deixar um comentário curto nos dois lugares.

Verificação: `npm run build` e o e2e do OCR passando (ele roda sob `vite preview` com o CSP real e baixa o núcleo de `/ocr/core`). Conferir em `du -sh frontend/public/ocr` que o total caiu para cerca de 9,5 MB.

## 2. CI sem scripts de instalação

Em `.github/workflows/testes.yml`, `npm ci` vira `npm ci --ignore-scripts`. Os scripts do próprio projeto (`prebuild`, `predev`, `prepreview` com `copiar-ocr`) não são scripts de instalação e continuam rodando, porque o CI chama `npm run build` e o e2e normalmente.

O e2e usa o Google Chrome que já vem no runner (comentário no workflow), então não depende de download de navegador no `postinstall`.

O único script que importa é o `postinstall` do esbuild, que confere o binário da plataforma e troca o atalho JS pelo binário. Sem ele, o esbuild acha o binário em `@esbuild/linux-x64` (dependência opcional, instalada pelo `npm ci` sem script). Decisão minha:
1. Primeiro passo da implementação, antes de mexer no workflow: provar localmente com `rm -rf node_modules && npm ci --ignore-scripts`, depois lint, testes, build e e2e passando. A troca no workflow é uma linha.
2. Se o esbuild falhar sem o script, o workflow ganha, logo depois do `npm ci --ignore-scripts`, o passo `npm rebuild esbuild`. Esse passo roda só o script do esbuild, um pacote conhecido, e não o de toda a árvore. Um comentário no workflow explica por quê.
3. O script do `tesseract.js` deixa de rodar, e isso não tem efeito.

Em qualquer caso, o comentário no workflow diz que os scripts de instalação ficam desligados para que um pacote comprometido não rode código no CI.

## 3. Normalizador do OCR

Arquivo: `frontend/src/lib/ocr/normalizarTextoOcr.ts`, com testes em `normalizarTextoOcr.test.ts`.

### 3.1 Caixa vazia lida como `(/ )`

Evidência: no OCR cru, `|(/ ) OUTRO: |` (ADNA) e `1(/ ) Renda familiar mensal per capita superior;` (DINA). Nas imagens das duas páginas as caixas estão em branco. A única caixa marcada nos dois formulários é "Mudança para outro Município", lida como `( x)`. O `/` é a perna do `(` em itálico. Hoje `QUALQUER_CAIXA` em `frontend/src/lib/parser/campos.ts` (`/\(\s*[xX ]\s*\)/u`) não reconhece `(/ )` como caixa.

Regra (minha decisão, pedida pelo usuário): `(` seguido de `/` e espaços opcionais e `)` vira `( )`. Vale em qualquer posição da linha, não só no começo, porque o OCR deixa lixo antes da caixa (`1(`, `'(`, `I(`). `(/x)` ou `(x/)` não entram na regra; ficam como estão.

Testes: `|(/ ) OUTRO: |` dá `( ) OUTRO:`; `1(/ ) Renda familiar mensal per capita superior;` dá `1( ) Renda familiar mensal per capita superior;`; `( x) Mudança para outro Município;` não muda. Um teste do `parseText` (ou de `campos`) com um bloco de motivo que tenha `(/ )` numa linha e `( x)` noutra confirma que o motivo lido é o marcado.

### 3.2 Rótulo do NIS com dígito

Evidência: `N1S:` foi visto numa leitura anterior durante o PR #5 e ficou adiado. Na leitura de hoje os 5 PDFs leram `NIS` direito, então não há um caso real novo; a correção é preventiva e barata.

Regra: em `ROTULO_NIS_APOS_NIB`, o rótulo deformado passa a aceitar letras e dígitos, de 2 a 5 caracteres, com pelo menos uma letra. Também aceita um `|` opcional entre os dígitos do NIB e o rótulo, porque o OCR real devolve `NIB: 0562977732 |NIS: 20705987161`. Todo o resto da regra continua igual: só logo depois de `NIB: <dígitos>` e só antes de exatamente 11 dígitos.

Testes: `NIB: 0562977732 N1S: 20705987161` dá `NIB: 0562977732 NIS: 20705987161`; `NIB: 0562977732 |N1S: 20705987161` dá `NIB: 0562977732 |NIS: 20705987161`; um rótulo só de dígitos (`NIB: 0562977732 12: 20705987161`) não muda; o caso `Ints:` de hoje continua passando.

## 4. Aviso de chunk do build

Em `frontend/vite.config.ts`, `build.chunkSizeWarningLimit: 600` (kB), com um comentário: o único chunk acima de 500 kB é o pdfjs, que já é carregado sob demanda por `carregarPdfjs.ts`; o limite fica logo acima dele para que um chunk novo e grande ainda gere aviso.

Verificação: `npm run build` sem a linha `(!) Some chunks are larger than 500 kB`.

## 5. Limite de páginas no OCR

Em `registroDoOcr` (`frontend/src/lib/processar.ts`), o estouro do limite de páginas não descarta o motor de OCR. Os outros casos continuam como hoje: relógio estourado ou lote cancelado descartam motor e worker do pdf.js; `LimiteExcedido` vindo de uma página inválida (`rasterizar.ts`) ou de qualquer ponto depois de o motor estar preparado continua descartando o motor.

Como distinguir fica com o construtor. Duas formas aceitáveis: marcar em `registroDoOcr` quando o motor ficou pronto (`aoComecar` já é chamado logo depois de `prepararMotor()`) e só descartar depois disso; ou checar o limite de páginas sem depender da mensagem do erro. Não comparar a mensagem de texto do erro.

Testes em `processar.test.ts` (ou onde os casos de `reiniciarOcr` já estão): PDF escaneado com páginas demais sai como registro vazio com a mensagem de hoje e `reiniciarOcr` não é chamado; o teste existente de `LimiteExcedido` que espera `reiniciarOcr` (`frontend/src/lib/processar.test.ts:212`) hoje usa a mensagem de limite de páginas com `lerPorOcr` simulado. Ele tem de ser reescrito para lançar o `LimiteExcedido` depois de `aoComecar`, ou seja, com o motor pronto, e continuar esperando `reiniciarOcr`.

## Restrições

- Sem dependência nova; `package.json` e `package-lock.json` não mudam.
- CSP de `frontend/vercel.json` não muda.
- `npm run lint`, `npm test`, `npm run build` e `npm run test:e2e` passando no fim.
- Execução: front-end inteiro pelo agent `frontend-developer`, com TDD nos itens 3 e 5. Revisão `code-reviewer` uma vez no diff final. `security-auditor` também, porque o item 2 mexe na instalação de dependências do CI.

## Fica com o construtor

- Como dividir os itens em tarefas e commits.
- A forma exata das regex do item 3, dentro das regras e dos testes acima.
- Como o item 5 sabe que o motor está pronto, dentro das duas formas aceitas.
