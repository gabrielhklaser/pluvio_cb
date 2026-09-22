/** Converte texto numérico (aceita vírgula decimal) em número; vazio/inválido -> null. */
export function paraNumero(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function paraInteiro(v: string | null | undefined): number | null {
  const n = paraNumero(v);
  return n === null ? null : Math.trunc(n);
}

export function arred(v: number, casas = 2): number {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}

export function media(valores: (number | null)[]): number | null {
  let soma = 0;
  let n = 0;
  for (const v of valores) {
    if (v !== null && Number.isFinite(v)) {
      soma += v;
      n++;
    }
  }
  return n ? soma / n : null;
}

/** Executa `fn` sobre os itens com no máximo `limite` promessas simultâneas. */
export async function mapLimit<T, R>(
  itens: T[],
  limite: number,
  fn: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const resultados = new Array<R>(itens.length);
  let proximo = 0;
  async function trabalhador() {
    while (proximo < itens.length) {
      const i = proximo++;
      resultados[i] = await fn(itens[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador));
  return resultados;
}

export function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}
