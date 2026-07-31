/** Limpa rascunhos antigos que ficavam só no navegador (pré-API multi-usuário). */
const LEGACY_PREFIX = 'sgq_pesquisa_lote_draft:';

export function clearLegacySgqLoteDrafts(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(LEGACY_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
}
