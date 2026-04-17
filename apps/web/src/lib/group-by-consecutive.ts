export interface ConsecutiveGroup<T> {
  readonly label: string | null;
  readonly items: readonly T[];
}

export function groupByConsecutive<T>(
  items: readonly T[],
  getLabel: (item: T) => string | null | undefined
): readonly ConsecutiveGroup<T>[] {
  const groups: { label: string | null; items: T[] }[] = [];
  let pending: { label: string | null; items: T[] } | null = null;

  for (const item of items) {
    const label = getLabel(item) ?? null;
    if (!pending || pending.label !== label) {
      if (pending) groups.push(pending);
      pending = { label, items: [item] };
    } else {
      pending.items.push(item);
    }
  }
  if (pending) groups.push(pending);

  return groups;
}
