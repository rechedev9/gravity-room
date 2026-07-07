import { describe, it, expect } from 'vitest';
import { groupByConsecutive } from './group-by-consecutive';

// ---------------------------------------------------------------------------
// groupByConsecutive — run-length grouping by a derived label
// ---------------------------------------------------------------------------

interface Item {
  readonly id: number;
  readonly label: string | null | undefined;
}

function item(id: number, label: string | null | undefined): Item {
  return { id, label };
}

const getLabel = (i: Item): string | null | undefined => i.label;

describe('groupByConsecutive', () => {
  it('returns [] for empty input', () => {
    expect(groupByConsecutive([], getLabel)).toEqual([]);
  });

  it('merges consecutive items with the same label into one group', () => {
    const items = [item(1, 'a'), item(2, 'a'), item(3, 'a')];

    const groups = groupByConsecutive(items, getLabel);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe('a');
    expect(groups[0]?.items).toEqual(items);
  });

  it('starts a new group when the label changes', () => {
    const items = [item(1, 'a'), item(2, 'a'), item(3, 'b'), item(4, 'c'), item(5, 'c')];

    const groups = groupByConsecutive(items, getLabel);

    expect(groups.map((g) => g.label)).toEqual(['a', 'b', 'c']);
    expect(groups.map((g) => g.items.length)).toEqual([2, 1, 2]);
  });

  it('does not merge non-adjacent runs of the same label', () => {
    const items = [item(1, 'a'), item(2, 'b'), item(3, 'a')];

    const groups = groupByConsecutive(items, getLabel);

    expect(groups.map((g) => g.label)).toEqual(['a', 'b', 'a']);
  });

  it('preserves item order within and across groups', () => {
    const items = [item(1, 'a'), item(2, 'a'), item(3, 'b')];

    const groups = groupByConsecutive(items, getLabel);

    expect(groups.flatMap((g) => g.items.map((i) => i.id))).toEqual([1, 2, 3]);
  });

  it('normalizes an undefined label to null', () => {
    const groups = groupByConsecutive([item(1, undefined)], getLabel);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBeNull();
  });

  it('groups consecutive null and undefined labels together', () => {
    const items = [item(1, null), item(2, undefined), item(3, null)];

    const groups = groupByConsecutive(items, getLabel);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBeNull();
    expect(groups[0]?.items.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('separates null-label runs from labelled runs', () => {
    const items = [item(1, null), item(2, 'a'), item(3, undefined)];

    const groups = groupByConsecutive(items, getLabel);

    expect(groups.map((g) => g.label)).toEqual([null, 'a', null]);
  });

  it('handles a single item', () => {
    const groups = groupByConsecutive([item(7, 'solo')], getLabel);

    expect(groups).toEqual([{ label: 'solo', items: [item(7, 'solo')] }]);
  });
});
