export function ehPdf(arquivo: File): boolean {
  return arquivo.type === 'application/pdf' || arquivo.name.toLowerCase().endsWith('.pdf');
}

const hashes = new WeakMap<File, Promise<string>>();

/** SHA-256 do conteúdo, em hexadecimal (guardado por arquivo para não reler). */
export function hashDoArquivo(arquivo: File): Promise<string> {
  let hash = hashes.get(arquivo);
  if (!hash) {
    hash = (async () => {
      const resumo = await crypto.subtle.digest('SHA-256', await arquivo.arrayBuffer());
      return [...new Uint8Array(resumo)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    })();
    hashes.set(arquivo, hash);
  }
  return hash;
}

/** Separa os arquivos novos entre aceitos e repetidos (mesmo conteúdo de um já existente ou de um novo anterior). */
export async function separarDuplicados(
  existentes: File[],
  novos: File[],
): Promise<{ aceitos: File[]; repetidos: File[] }> {
  const vistos = new Set<string>();
  for (const arquivo of existentes) vistos.add(await hashDoArquivo(arquivo));
  const aceitos: File[] = [];
  const repetidos: File[] = [];
  for (const arquivo of novos) {
    const hash = await hashDoArquivo(arquivo);
    if (vistos.has(hash)) {
      repetidos.push(arquivo);
    } else {
      vistos.add(hash);
      aceitos.push(arquivo);
    }
  }
  return { aceitos, repetidos };
}
