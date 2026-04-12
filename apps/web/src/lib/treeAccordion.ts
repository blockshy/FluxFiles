import type { Key } from 'react';

interface TreeNodeLike {
  key?: Key;
  value?: Key;
  children?: TreeNodeLike[];
}

export interface AccordionTreeMaps {
  parentByKey: Map<string, string | null>;
  depthByKey: Map<string, number>;
}

function normalizeKey(value: Key | undefined) {
  if (value === undefined || value === null) {
    return null;
  }
  return String(value);
}

export function buildAccordionTreeMaps(nodes: TreeNodeLike[], keyField: 'key' | 'value' = 'key'): AccordionTreeMaps {
  const parentByKey = new Map<string, string | null>();
  const depthByKey = new Map<string, number>();

  function visit(items: TreeNodeLike[], parent: string | null, depth: number) {
    items.forEach((item) => {
      const rawKey = keyField === 'value' ? item.value : item.key;
      const key = normalizeKey(rawKey);
      if (!key) {
        return;
      }
      parentByKey.set(key, parent);
      depthByKey.set(key, depth);
      visit(item.children ?? [], key, depth + 1);
    });
  }

  visit(nodes, null, 0);
  return { parentByKey, depthByKey };
}

function toExpansionMap(expandedKeys: string[], parentByKey: Map<string, string | null>, depthByKey: Map<string, number>) {
  const map = new Map<string | null, string>();
  [...expandedKeys]
    .sort((left, right) => (depthByKey.get(left) ?? 0) - (depthByKey.get(right) ?? 0))
    .forEach((key) => {
      const parent = parentByKey.get(key);
      if (parent !== undefined) {
        map.set(parent, key);
      }
    });
  return map;
}

function isSameOrDescendant(candidate: string, ancestor: string, parentByKey: Map<string, string | null>) {
  let cursor: string | null | undefined = candidate;
  while (cursor) {
    if (cursor === ancestor) {
      return true;
    }
    cursor = parentByKey.get(cursor);
  }
  return false;
}

export function toggleAccordionExpandedKeys(
  previousExpandedKeys: Key[],
  key: Key,
  expanded: boolean,
  maps: AccordionTreeMaps,
) {
  const targetKey = String(key);
  const previousKeys = previousExpandedKeys.map(String).filter((item) => maps.parentByKey.has(item));
  const expansionMap = toExpansionMap(previousKeys, maps.parentByKey, maps.depthByKey);

  if (expanded) {
    let cursor: string | null = targetKey;
    while (cursor) {
      const parent = maps.parentByKey.get(cursor);
      if (parent === undefined) {
        break;
      }
      expansionMap.set(parent, cursor);
      cursor = parent;
    }
  } else {
    Array.from(expansionMap.entries()).forEach(([parent, value]) => {
      if (value === targetKey || isSameOrDescendant(value, targetKey, maps.parentByKey)) {
        expansionMap.delete(parent);
      }
    });
  }

  return Array.from(new Set(expansionMap.values()));
}
