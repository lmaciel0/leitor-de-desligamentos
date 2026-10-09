import { PDFDocument, StandardFonts } from 'pdf-lib';

export interface TextoNaPagina {
  texto: string;
  x: number;
  y: number;
}

/** Gera um PDF sintético: uma lista de textos posicionados por página. Sem dados reais. */
export async function criarPdf(paginas: TextoNaPagina[][]): Promise<ArrayBuffer> {
  const documento = await PDFDocument.create();
  const fonte = await documento.embedFont(StandardFonts.Helvetica);
  for (const textos of paginas) {
    const pagina = documento.addPage([595, 842]);
    for (const { texto, x, y } of textos) {
      pagina.drawText(texto, { x, y, size: 11, font: fonte });
    }
  }
  const bytes = await documento.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
