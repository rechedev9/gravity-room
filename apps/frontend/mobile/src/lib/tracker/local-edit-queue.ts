// Pending operations own these entries across screen remounts. The final tail
// releases its entry on settlement; idle programs retain no queue resources.
const tails = new Map<string, Promise<void>>();

function key(ownerId: string | null, instanceId: string): string {
  return JSON.stringify([ownerId, instanceId]);
}

export function waitForLocalEdits(ownerId: string | null, instanceId: string): Promise<void> {
  return tails.get(key(ownerId, instanceId)) ?? Promise.resolve();
}

export function queueLocalEdit(
  ownerId: string | null,
  instanceId: string,
  edit: () => Promise<void>
): Promise<void> {
  const partition = key(ownerId, instanceId);
  const operation = (tails.get(partition) ?? Promise.resolve()).then(edit);
  const settled = operation
    .catch(() => undefined)
    .finally(() => {
      if (tails.get(partition) === settled) tails.delete(partition);
    });
  tails.set(partition, settled);
  return operation;
}
