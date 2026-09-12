import { LocalDataOwner } from './local-data-owner';

function deferred() {
  let resolve = (): void => {};
  let reject = (_error: Error): void => {};
  const promise = new Promise<void>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

it('does not authorize repositories before successful validation', async () => {
  const owner = new LocalDataOwner();
  const validation = deferred();
  expect(() => owner.require()).toThrow('not been validated');
  const pending = owner.activate('alice', () => validation.promise);
  expect(owner.get()).toBeNull();
  validation.resolve();
  await pending;
  expect(owner.require()).toBe('alice');
});

it('cannot reactivate a deactivated owner from a late validation result', async () => {
  const owner = new LocalDataOwner();
  const validation = deferred();
  const pending = owner.activate('alice', () => validation.promise);
  owner.deactivate();
  validation.resolve();
  await expect(pending).rejects.toThrow('superseded');
  expect(owner.get()).toBeNull();
  expect(() => owner.require()).toThrow('not been validated');
});

it.each(['old-first', 'new-first'])(
  'only the latest activation publishes when %s resolves',
  async (order) => {
    const owner = new LocalDataOwner();
    const first = deferred();
    const second = deferred();
    const oldActivation = owner.activate('alice', () => first.promise);
    const newActivation = owner.activate('bob', () => second.promise);
    const rejected = expect(oldActivation).rejects.toThrow('superseded');
    if (order === 'old-first') {
      first.resolve();
      await rejected;
      expect(owner.get()).toBeNull();
      second.resolve();
    } else {
      second.resolve();
      await newActivation;
      first.resolve();
    }
    await Promise.all([rejected, newActivation]);
    expect(owner.require()).toBe('bob');
  }
);

it('keeps the partition unavailable while replacing a validated owner', async () => {
  const owner = new LocalDataOwner();
  await owner.activate('alice', async () => {});
  const validation = deferred();
  const pending = owner.activate('bob', () => validation.promise);
  expect(owner.get()).toBeNull();
  expect(() => owner.require()).toThrow('not been validated');
  validation.resolve();
  await pending;
  expect(owner.require()).toBe('bob');
});

it('does not restore an older owner if the latest activation fails', async () => {
  const owner = new LocalDataOwner();
  const validation = deferred();
  const pending = owner.activate('alice', () => validation.promise);
  await expect(
    owner.activate('bob', async () => {
      throw new Error('disk unavailable');
    })
  ).rejects.toThrow('disk unavailable');
  validation.resolve();
  await expect(pending).rejects.toThrow('superseded');
  expect(owner.get()).toBeNull();
});

it('a rejected old activation cannot clear a newer validated owner', async () => {
  const owner = new LocalDataOwner();
  const validation = deferred();
  const pending = owner.activate('alice', () => validation.promise);
  await owner.activate('bob', async () => {});
  validation.reject(new Error('old disk failure'));
  await expect(pending).rejects.toThrow('old disk failure');
  expect(owner.require()).toBe('bob');
});

it('treats two activations of the same account as distinct attempts', async () => {
  const owner = new LocalDataOwner();
  const validation = deferred();
  const pending = owner.activate('alice', () => validation.promise);
  await owner.activate('alice', async () => {});
  validation.resolve();
  await expect(pending).rejects.toThrow('superseded');
  expect(owner.require()).toBe('alice');
});

it('allows a fresh activation after deactivation and failure', async () => {
  const owner = new LocalDataOwner();
  await owner.activate('alice', async () => {});
  owner.deactivate();
  await expect(
    owner.activate('bob', async () => {
      throw new Error('retry later');
    })
  ).rejects.toThrow('retry later');
  expect(owner.get()).toBeNull();
  await owner.activate('bob', async () => {});
  expect(owner.require()).toBe('bob');
});

it.each(['', '  ', '\n\t'])(
  'rejects invalid input %j without running validation',
  async (userId) => {
    const owner = new LocalDataOwner();
    const validate = jest.fn(async () => {});
    await expect(owner.activate(userId, validate)).rejects.toThrow('non-empty');
    expect(validate).not.toHaveBeenCalled();
    expect(owner.get()).toBeNull();
  }
);

it('preserves the exact validated identity instead of normalizing a partition key', async () => {
  const owner = new LocalDataOwner();
  await owner.activate(' alice ', async () => {});
  expect(owner.require()).toBe(' alice ');
});

it('handles a synchronous validator failure without retaining the old partition', async () => {
  const owner = new LocalDataOwner();
  await owner.activate('alice', async () => {});
  await expect(
    owner.activate('bob', () => {
      throw new Error('native failure');
    })
  ).rejects.toThrow('native failure');
  expect(owner.get()).toBeNull();
});

it('isolates separate owner controllers', async () => {
  const first = new LocalDataOwner();
  const second = new LocalDataOwner();
  await first.activate('alice', async () => {});
  await second.activate('bob', async () => {});
  first.deactivate();
  expect(first.get()).toBeNull();
  expect(second.require()).toBe('bob');
});
