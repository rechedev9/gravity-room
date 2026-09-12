/**
 * In-memory authorization for offline repositories. Validation may await native
 * storage, but only the latest activation is allowed to publish an owner.
 * Credentials and durable owner markers remain the auth layer's responsibility.
 */
export class LocalDataOwner {
  private ownerId: string | null = null;
  private generation = 0;

  async activate(userId: string, validate: () => Promise<void>): Promise<void> {
    if (userId.trim().length === 0) {
      throw new Error('Local data owner must be a non-empty user id');
    }
    const generation = ++this.generation;
    this.ownerId = null;
    await validate();
    if (generation !== this.generation) {
      throw new Error('Local data owner activation was superseded');
    }
    this.ownerId = userId;
  }

  deactivate(): void {
    ++this.generation;
    this.ownerId = null;
  }

  require(): string {
    if (this.ownerId === null) {
      throw new Error('Local data owner has not been validated');
    }
    return this.ownerId;
  }

  get(): string | null {
    return this.ownerId;
  }
}
