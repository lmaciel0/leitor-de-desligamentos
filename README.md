# Leitor de Desligamentos (Java + React)

[![Testes](https://github.com/lmaciel0/leitor-de-desligamentos/actions/workflows/testes.yml/badge.svg)](https://github.com/lmaciel0/leitor-de-desligamentos/actions/workflows/testes.yml)

Aplicação local para extrair, revisar e exportar dados de formulários PDF de desligamento, com backend Java e interface React.

## Funcionalidades

- Upload de vários PDFs e processamento de todas as páginas.
- Extração nativa com Apache PDFBox e fallback de OCR com Tess4J/Tesseract.
- Colunas `Arquivo`, `Referencia`, `Município`, `CPF`, `NIS`, `Nome` e `Motivo` em tabela editável.
- Data de referência preenchida com o dia do processamento e botão para limpar a seleção e os resultados.
- CPF e NIS preservados como texto, incluindo zeros à esquerda.
- Status automático `OK` ou `REVISAR` e lista de inconsistências por arquivo.
- Filtros por município, motivo e status.
- Download em XLSX, CSV UTF-8 separado por ponto e vírgula e XLSX apenas dos registros `REVISAR`.
- Sem banco de dados: os PDFs são gravados só em arquivos temporários durante o processamento e removidos ao final.

## Stack

- **Backend:** Java 21 + Spring Boot 3.3.5 (Maven)
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **PDF:** Apache PDFBox 3
- **OCR (opcional):** Tess4J + Tesseract OCR (`por`)
- **Planilha:** Apache POI

## Endpoints

```
GET  /api/saude
POST /api/processar            multipart: files, ocrEnabled
POST /api/recalcular           JSON da tabela editada
POST /api/exportar/csv
POST /api/exportar/xlsx
POST /api/exportar/xlsx-revisar
```

## Como executar

### Pré-requisitos

- Java 21+
- Maven
- Node.js 18+
- Para OCR no Windows: Tesseract OCR com idioma `por`. PDFs com texto selecionável não precisam disso.

### Inicialização rápida

**Windows:** dê dois cliques em `Iniciar Leitor.bat` na raiz do projeto.

O script gera o frontend (`npm run build`), inicia o backend numa única janela servindo a interface e a API em `http://localhost:8080` e abre o navegador. Para encerrar, feche a janela.

**Linux/macOS** (modo desenvolvimento, dois servidores):

```bash
chmod +x scripts/iniciar-projeto.sh
./scripts/iniciar-projeto.sh
```

- API: `http://localhost:8080`
- Interface: `http://localhost:5173`

### Inicialização manual

**Backend:**

```powershell
cd backend
mvn test
mvn spring-boot:run
```

**Frontend:**

```powershell
cd frontend
npm install
npm run dev
```

## Observações

O aplicativo não inventa valores ausentes. Um CPF com menos de 11 dígitos, ou qualquer campo obrigatório não identificado, marca o registro como `REVISAR` para correção manual.
