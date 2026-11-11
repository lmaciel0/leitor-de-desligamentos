# Leitor de Desligamentos: leitura de PDFs escaneados com OCR no navegador

Data: 2026-11-11
Status: aguardando revisão

## 1. Objetivo e motivo

Hoje, um PDF sem camada de texto (escaneado) aparece na tabela como `PDF sem texto selecionável (escaneado)`, com todos os campos vazios e status `REVISAR`. A spec de 2026-10-09 deixou o OCR para uma versão futura, "se aparecerem PDFs escaneados reais". Eles apareceram: o operador já recebe os formulários da origem como digitalização do CamScanner (imagem, sem texto) e não tem como obter outra versão.

Objetivo: para PDFs escaneados, o sistema preenche a mesma tabela de sempre (município, CPF, NIS, NIB, nome, motivo e demais campos) usando OCR, para que o operador só confira e corrija, em vez de digitar tudo.

Quem usa: operadores que processam lotes de formulários de desligamento do Cartão Mais Infância Ceará. Os formulários contêm CPF, NIS e endereço de beneficiários, que são dados pessoais.

## 2. Decisões tomadas

Acordadas na conversa de brainstorming:

- **OCR roda no navegador**, com `tesseract.js`. Nenhum dado, imagem ou texto sai do computador do usuário. A promessa de privacidade do README continua valendo sem exceção. Serviço de OCR na nuvem foi descartado por esse motivo.
- **Sem agente de IA para validar.** Ele exigiria enviar os dados para fora e poderia "corrigir" um dígito com confiança. A validação é feita por regras locais (seção 6) mais conferência visual (seção 7).
- **A tabela de resultado é a mesma.** Nenhum campo novo na tabela, na exportação XLSX/CSV ou no arquivo de trabalho, salvo a marcação de origem OCR descrita na seção 5.
- **Todo registro lido por OCR fica `REVISAR` até o operador confirmar**, mesmo quando todas as validações passam e mesmo depois de editar células. A confirmação é marcar o checkbox "validado" que já existe, que para registros de OCR passa a significar "conferi com a imagem" e é o único jeito de o registro sair de `REVISAR`. Editar uma célula não conta como revisão.
- **Validações de nome no cartão, datas e quantidade de motivos marcados rodam uma vez, na hora do OCR**, e os avisos ficam guardados como texto no registro. A validação do NIB contra o CPF continua ao vivo, porque só usa campos que o registro já tem. Guardar os dados extras no registro foi descartado porque mudaria o formato do arquivo de trabalho.

Evidência que sustenta a decisão (teste descartável de 2026-11-11, fora do projeto): `tesseract.js` v5, idioma `por`, página rasterizada a 300 dpi, nos 5 formulários reais de Aracati. Cerca de 6 s por página, confiança média 79 a 82%. Nome, CPF, NIB, NIS e o motivo marcado foram lidos corretamente nos 5; os 5 CPFs passam no dígito verificador. Erros observados: o rótulo `NIS:` saiu como `Ints:` e `NIs:`; o cabeçalho com logotipo sai com lixo; a assinatura sai com lixo. Um NIB (DINA) não bate com o CPF, mas o erro está no próprio formulário, não no OCR.

## 3. Metas, não metas e anti-metas

Metas:

- Os 5 PDFs de exemplo produzem uma linha preenchida e correta na tabela, marcada `REVISAR`.
- OCR só roda quando o PDF não tem texto. PDFs com texto seguem o caminho atual, sem mudança de comportamento nem de velocidade.
- O operador consegue conferir cada campo lido por OCR contra a imagem original, sem sair da tela.
- Nenhuma requisição de rede nova com dados do usuário. `connect-src` continua `'self'`.

Não metas:

- OCR na nuvem ou qualquer serviço externo.
- Agente de IA ou modelo de linguagem para validar ou corrigir valores.
- Ler assinaturas, carimbos ou texto manuscrito.
- Corrigir valores automaticamente. O sistema avisa; quem decide é o operador.
- Aumentar o limite de 10 páginas por PDF ou de 20 MB.
- Fotos de formulário tiradas em ângulo ou com dobras. O caso alvo são digitalizações de scanner ou CamScanner como os exemplos.

Anti-metas (falha mesmo que "funcione"):

- Qualquer dado pessoal saindo do computador.
- Um registro lido por OCR aparecer como `OK` sem revisão.
- Um valor lido errado ser aceito em silêncio, por exemplo CPF com dígito trocado sem aviso.
- Piorar o tempo ou o tamanho do carregamento para quem só usa PDFs com texto.

## 4. Como funciona

Fluxo em `processarArquivo` (`frontend/src/lib/processar.ts`):

1. Extração de texto como hoje. Se houver texto, o caminho atual segue sem alteração.
2. Se o texto extraído for vazio, em vez de devolver o registro vazio com `PDF sem texto selecionável (escaneado)`, o sistema rasteriza cada página (até o limite de páginas) com o pdf.js, a cerca de 300 dpi, e roda o OCR em português.
3. O texto do OCR passa por uma normalização específica de OCR (seção 5) e depois pelo mesmo `parseText` e `inconsistencies` atuais.
4. O registro sai com status `REVISAR`, a pendência de origem OCR e as inconsistências das validações da seção 6.

Arquivos e infraestrutura do OCR:

- `tesseract.js`, o núcleo WASM e o arquivo de idioma `por` são servidos pelo próprio site (mesma origem), nunca de CDN. Versão fixa de `tesseract.js`.
- Carregamento tardio: o código do OCR e os dados de idioma só são baixados na primeira vez que aparece um PDF escaneado no lote. Quem só processa PDFs com texto não paga esse custo.
- Os arquivos do OCR (núcleo WASM e idioma `por`, da ordem de 10 MB ou mais) são copiados de `node_modules` para a pasta publicada no build, e não entram no git (decisão minha).
- O CSP em `frontend/vercel.json` precisa ser ajustado para o WASM e o worker do OCR (por exemplo `wasm-unsafe-eval` em `script-src`, e `worker-src` se o worker não puder ser da mesma origem sem `blob:`). Decisão minha: aplicar `wasm-unsafe-eval` só aos caminhos dos arquivos do OCR, já que o CSP de um worker vem dos cabeçalhos do próprio script do worker; se o navegador não aceitar assim, vira regra global. Deve ser o ajuste mínimo, `connect-src` fica `'self'`, e o teste de cabeçalhos `vercel.test.ts` é atualizado junto. A fonte única de cabeçalhos (`vercel.json` lido também pelo `vite preview`) é mantida.
- Os PDFs seguem processados em sequência, como hoje. O progresso mostrado ao operador indica quando um arquivo está em OCR, porque demora vários segundos por página.

## 5. Normalização do texto do OCR e marcação de origem

O parser atual espera rótulos exatos. O texto do OCR traz rótulos deformados, quebras de linha diferentes e lixo. Antes do `parseText`, o texto do OCR passa por uma etapa de normalização que:

- reconhece variações do rótulo do NIS (`Ints:`, `NIs:`, `N1S:` e similares) a partir do contexto, por exemplo "NIB: dígitos, seguido de rótulo deformado e 11 dígitos";
- tolera marcadores de motivo como `( x)`, `(X )`, `( x |`, `(/ )` e remove ruído de barras verticais (`|`) das bordas das linhas;
- não inventa nem altera dígitos.

O que entra na normalização é decidido a partir dos erros reais observados, com testes que reproduzem esses erros em dados sintéticos (seção 9). Pontos fora dessa lista só entram se um teste mostrar o erro.

Marcação de origem (decisão do operador): o `DesligamentoRecord` ganha uma marca persistente "lido por OCR". Ela vai para o arquivo de trabalho (`.json`), por isso o formato e a versão do arquivo de trabalho mudam, com leitura compatível de arquivos antigos (sem a marca, valem como não-OCR). Regras:

- Hoje `recalcular` (`frontend/src/lib/parser/campos.ts`) refaz as inconsistências só a partir dos campos, então qualquer edição apagaria uma pendência comum. Para registros com a marca de OCR, o status é `REVISAR` enquanto o checkbox "validado" não estiver marcado, independentemente de edições e das inconsistências.
- Com a marca de OCR e "validado" marcado, o status segue a regra normal: `OK` se não houver inconsistências, `REVISAR` se houver.
- O registro também recebe a pendência `PDF lido por OCR: conferir os campos` (prefixo `PDF `, que é a convenção de `frontend/src/lib/trabalho.ts` para pendências de leitura). O construtor verifica o que `trabalho.ts` faz com essa pendência ao reabrir um arquivo de trabalho, para o aviso não sumir nem travar a revalidação.
- A exportação XLSX/CSV não ganha coluna nova. O construtor decide se a marca de OCR aparece na exportação, partindo de "não aparece" por padrão.

## 6. Validações (regras locais)

Todas rodam no resultado do OCR e geram mensagens na lista de inconsistências do registro. Nenhuma altera valores. As regras 1 e 2 usam só campos do registro e são recalculadas a cada edição. As regras 3 e 4 dependem de dados que o registro não guarda (nome no cartão, datas, marcadores de motivo): rodam uma única vez, na hora do OCR, e seus avisos ficam como texto no registro até o operador confirmar. Esses avisos podem ficar desatualizados se a linha for editada, o que é aceito porque o operador confere de qualquer forma.

1. **Dígito verificador de CPF e NIS.** Já existe em `inconsistencies()`. Passa a valer também para o texto vindo de OCR, sem mudança.
2. **NIB contra CPF.** Nos 5 formulários, o NIB é igual aos 10 primeiros dígitos do CPF; em 4 bate, e na DINA não bate, por erro do formulário. Se divergir, o sistema avisa. É apenas aviso, porque a regra foi observada nesses 5 arquivos e não é documentada. Vale só para registros de OCR (decisão minha), para não alterar `inconsistencies()` nem os testes dos PDFs com texto.
3. **Nome no cartão CMIC contra nome do responsável familiar.** Avisa se forem diferentes.
4. **Coerência dos demais campos.** Datas em formato válido (data de nascimento, última atualização, validação CMIC, saída do perfil, data do município) e exatamente um motivo de desligamento marcado. A regra atual "OUTRO exige detalhe" continua.

## 7. Conferência visual na revisão

Para registros lidos por OCR, a tela de revisão mostra a imagem da página do PDF original ao lado dos campos lidos, para o operador comparar. É a validação mais forte para OCR.

- A imagem existe só em memória, durante a sessão. Não vai para o arquivo de trabalho (`.json`), porque o tornaria grande e levaria imagem de documento pessoal para dentro dele. Não vai para exportação nem para armazenamento do navegador. Decisão minha, marcada como tal.
- Memória (decisão minha): guarda-se só a página que serviu de fonte dos campos, reduzida para exibição, e não as imagens de todas as páginas a 300 dpi. Há um limite de quantas imagens ficam na memória no lote; ao passar do limite, as mais antigas são descartadas e o registro mostra que a imagem não está disponível, com a opção de recarregar o PDF. O valor do limite fica para o construtor.
- Ao reabrir um arquivo de trabalho, os registros de OCR continuam com a pendência, mas sem imagem, a menos que o operador carregue o PDF de novo. Como a tela deve se comportar nesse caso fica para o construtor, com a mensagem clara de que a imagem não está disponível.
- A forma exata da exibição (painel ao lado, janela, ampliação de um trecho) fica para o construtor, seguindo o visual e os requisitos de acessibilidade já existentes (teclado, foco, `axe-core`).

## 8. Limites e desempenho

- Os limites atuais de 20 MB e 10 páginas continuam.
- O tempo máximo atual por arquivo é de 20 s. O OCR leva cerca de 6 s por página no teste, então um PDF escaneado de 10 páginas estouraria. Decisão minha: arquivos em OCR têm um orçamento de tempo próprio, proporcional ao número de páginas, e o relógio só começa depois que o modelo do OCR terminou de carregar (o primeiro download não conta). Estourar o orçamento encerra e recria o worker do OCR, como o limite atual faz com o worker do pdf.js, e usa a mensagem de limite excedido existente. O operador pode cancelar o lote a qualquer momento. Os valores do orçamento ficam para o construtor.
- O worker do OCR é reutilizado entre arquivos do mesmo lote para não recarregar o modelo a cada PDF.
- Cancelar o lote cancela o OCR em andamento.

## 9. Testes e documentação

- **Sem PDFs reais no repositório.** Os 5 exemplos têm dados pessoais reais e ficam fora do git (`archives-models/` já é ignorado). Fixtures de teste são sintéticas.
- **Parser e normalização:** testes unitários com textos sintéticos que reproduzem os erros observados (rótulo `Ints:` e `NIs:`, marcador `( x)` e `(X )`, barras nas bordas, linhas com lixo de logotipo e assinatura).
- **Validações:** testes unitários para cada regra da seção 6, inclusive o caso em que o NIB diverge do CPF.
- **Confirmação:** testes de que um registro de OCR continua `REVISAR` depois de editar células, só sai de `REVISAR` com "validado" marcado e sem inconsistências, e de que o arquivo de trabalho com a marca de OCR é salvo e reaberto, inclusive arquivos antigos sem a marca.
- **Caminho de OCR:** teste de integração e e2e com um PDF sintético sem camada de texto, só imagem (hoje `criarPdf` só gera texto, então precisa de uma variante com imagem renderizada de um formulário fictício). O e2e confirma que a linha sai preenchida, `REVISAR`, e que nenhuma requisição sai da origem do site.
- **CSP:** `vercel.test.ts` atualizado para os novos cabeçalhos.
- **CI** (lint, testes, build, e2e) continua passando.
- **README:** atualizar a linha sobre PDFs escaneados e a seção Privacidade (o OCR roda no computador, nada é enviado). Atualizar a nota de "sem OCR" na spec de 2026-10-09 para apontar para este documento.

## 10. Deixado para o construtor

- Biblioteca e forma de rasterizar a página (canvas na thread principal ou `OffscreenCanvas` no worker) e a resolução exata.
- Como empacotar e servir o núcleo WASM e os dados de idioma com Vite, e o ajuste mínimo do CSP.
- Estrutura interna da normalização do texto e da conferência visual.
- Valores do orçamento de tempo do OCR, do limite de imagens em memória e o texto das mensagens de progresso.
- Se a marca de OCR aparece na exportação (padrão: não).
- Como a tela se comporta quando a imagem da página não está disponível (arquivo de trabalho reaberto ou imagem descartada).

## 11. Decisões minhas, para conferir

Estas escolhas foram minhas, não do operador:

- Rasterizar a cerca de 300 dpi, como no teste.
- Orçamento de tempo do OCR proporcional às páginas, com relógio iniciado depois do carregamento do modelo.
- Guardar só a imagem da página-fonte, reduzida, com limite no lote.
- Validação do NIB contra o CPF só para OCR, como aviso.
- `wasm-unsafe-eval` restrito aos arquivos do OCR, se funcionar.
- WASM e idioma copiados de `node_modules` no build, fora do git.
- Imagem da página nunca persistida (arquivo de trabalho, exportação, armazenamento do navegador).
