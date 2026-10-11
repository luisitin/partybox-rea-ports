// Deterministic hashing of state (ADR-015): stable key order + FNV-1a. Used by the contract
// suite (replay twice, compare) and by the sim's invariants.
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort())
        sorted[k] = (v as Record<string, unknown>)[k];
      return sorted;
    }
    return v;
  });
}

export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function hashState(state: unknown): string {
  return fnv1a(stableStringify(state));
}

/** UTF-8 byte size of the JSON form (what goes over the wire / into fixtures). */
export function jsonSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
