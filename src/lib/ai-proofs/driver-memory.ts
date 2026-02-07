type MemDB = {
  kv: Map<string, any>;
};

function getMemDB(): MemDB {
  const g = globalThis as any;
  if (!g.__ONE_AI_PROOFS_MEM__) g.__ONE_AI_PROOFS_MEM__ = { kv: new Map() };
  return g.__ONE_AI_PROOFS_MEM__;
}

export async function memGet(key: string) {
  return getMemDB().kv.get(key);
}

export async function memSet(key: string, val: any) {
  getMemDB().kv.set(key, val);
}

export async function memDel(key: string) {
  getMemDB().kv.delete(key);
}
