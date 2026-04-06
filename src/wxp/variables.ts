import type { WxpVariable } from "../schemas/wxp.zod.js";

export interface VariableStore {
  set(name: string, value: string, owner?: string): void;
  get(name: string): string | undefined;
  has(name: string): boolean;
  entries(): IterableIterator<[string, WxpVariable]>;
  snapshot(): Record<string, string>;
}

export function createVariableStore(): VariableStore {
  const store = new Map<string, WxpVariable>();

  return {
    set(name, value, owner) {
      const existing = store.get(name);
      if (existing?.owner && owner && existing.owner !== owner) {
        // Collision: prefix both entries with their owner stem
        store.delete(name);
        store.set(`${existing.owner}:${name}`, {
          name: `${existing.owner}:${name}`,
          value: existing.value,
          owner: existing.owner,
        });
        store.set(`${owner}:${name}`, { name: `${owner}:${name}`, value, owner });
      } else {
        store.set(name, { name, value, owner });
      }
    },
    get(name) {
      return store.get(name)?.value;
    },
    has(name) {
      return store.has(name);
    },
    entries() {
      return store.entries();
    },
    snapshot() {
      const out: Record<string, string> = {};
      for (const [k, v] of store) out[k] = v.value;
      return out;
    },
  };
}
