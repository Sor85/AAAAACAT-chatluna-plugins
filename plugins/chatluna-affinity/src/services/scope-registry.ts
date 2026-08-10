/**
 * 活跃作用域协调器
 * 在同一 Koishi 根上下文中协调固定名称的 ChatLuna 工具注册权
 */

import type { Context } from "koishi";

export interface ScopeRegistrationState {
  isOnlyScope: boolean;
  isOwner: boolean;
}

interface ScopeEntry {
  scopeId: string;
  notify: (state: ScopeRegistrationState) => void;
}

interface ScopeRegistry {
  entries: ScopeEntry[];
}

const registries = new WeakMap<object, ScopeRegistry>();

function getRegistry(root: object): ScopeRegistry {
  let registry = registries.get(root);
  if (!registry) {
    registry = { entries: [] };
    registries.set(root, registry);
  }
  return registry;
}

function notifyEntries(registry: ScopeRegistry): void {
  const scopeIds = new Set(registry.entries.map((entry) => entry.scopeId));
  const isOnlyScope = scopeIds.size === 1;
  const owner = isOnlyScope ? registry.entries[0] : undefined;

  for (const entry of registry.entries) {
    entry.notify({
      isOnlyScope,
      isOwner: entry === owner,
    });
  }
}

export function registerActiveScope(
  ctx: Context,
  scopeId: string,
  notify: (state: ScopeRegistrationState) => void,
): () => void {
  const root = ctx.root as unknown as object;
  const registry = getRegistry(root);
  const entry: ScopeEntry = { scopeId, notify };
  registry.entries.push(entry);
  notifyEntries(registry);

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;

    const index = registry.entries.indexOf(entry);
    if (index >= 0) registry.entries.splice(index, 1);
    if (registry.entries.length === 0) {
      registries.delete(root);
      return;
    }
    notifyEntries(registry);
  };
}
