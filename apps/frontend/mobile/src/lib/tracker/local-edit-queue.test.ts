import { queueLocalEdit, waitForLocalEdits } from './local-edit-queue';

it('drains later edits after a failed write while returning the failure to its caller', async () => {
  const failure = queueLocalEdit('owner', 'plan', async () => {
    throw new Error('Disk full');
  });
  const rejected = expect(failure).rejects.toThrow('Disk full');
  const next = jest.fn(async () => undefined);
  const success = queueLocalEdit('owner', 'plan', next);
  await rejected;
  await waitForLocalEdits('owner', 'plan');
  await success;
  expect(next).toHaveBeenCalledTimes(1);
});

it('does not block another owner behind a pending write to the same program ID', async () => {
  let release = () => {};
  const pending = queueLocalEdit(
    'owner-a',
    'plan',
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      })
  );
  await Promise.resolve();
  const other = jest.fn(async () => undefined);
  await queueLocalEdit('owner-b', 'plan', other);
  expect(other).toHaveBeenCalledTimes(1);
  release();
  await pending;
  await waitForLocalEdits('owner-a', 'plan');
});
