function buildKey(instanceId: string, workoutIndex: number, slotKey: string): string {
  return `notes:${instanceId}:${workoutIndex}:${slotKey}`;
}

export function getNote(
  instanceId: string,
  workoutIndex: number,
  slotKey: string
): string | undefined {
  return localStorage.getItem(buildKey(instanceId, workoutIndex, slotKey)) ?? undefined;
}

export function setNote(
  instanceId: string,
  workoutIndex: number,
  slotKey: string,
  text: string
): void {
  if (text === '') {
    deleteNote(instanceId, workoutIndex, slotKey);
    return;
  }
  localStorage.setItem(buildKey(instanceId, workoutIndex, slotKey), text);
}

export function deleteNote(instanceId: string, workoutIndex: number, slotKey: string): void {
  localStorage.removeItem(buildKey(instanceId, workoutIndex, slotKey));
}
