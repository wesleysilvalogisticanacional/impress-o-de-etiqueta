/** localStorage com tolerância a falhas (aba anônima, dados bloqueados). */
export function guardar(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* sem armazenamento: segue sem lembrar */
  }
}

export function ler<T>(k: string, padrao: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
}
