/** UI recovery policy, matching the web timer (not progression math). */
export function restSecondsForRole(role: string | undefined): number {
  if (role === 'primary') return 180;
  if (role === 'secondary') return 120;
  return 90;
}

export interface RestTimerEffects {
  schedule(endsAt: number): Promise<string | null>;
  cancel(id: string): Promise<void>;
  complete(): Promise<void>;
}

export interface RestTimerState {
  readonly endsAt: number | null;
  readonly remainingSeconds: number;
  readonly alertUnavailable: boolean;
}

/**
 * One authenticated shell owns one timer. Ticks sample wall time; suspended JS
 * never accumulates drift. A generation owns each async notification request,
 * including requests that finish after skip, replacement, or disposal.
 */
export class RestTimer {
  private state: RestTimerState = { endsAt: null, remainingSeconds: 0, alertUnavailable: false };
  private generation = 0;
  private disposed = false;
  private notificationId: string | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly effects: RestTimerEffects,
    private readonly now = Date.now
  ) {}

  getSnapshot = (): RestTimerState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(state: RestTimerState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  private async cancelNotification(id: string): Promise<void> {
    try {
      await this.effects.cancel(id);
    } catch {
      this.publish({ ...this.state, alertUnavailable: true });
    }
  }

  private releaseNotification(): void {
    const id = this.notificationId;
    this.notificationId = null;
    if (id !== null) void this.cancelNotification(id);
  }

  start(seconds: number): void {
    if (this.disposed) return;
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error('Rest duration must be a positive number');
    }
    const generation = ++this.generation;
    this.releaseNotification();
    const endsAt = this.now() + seconds * 1000;
    this.publish({ endsAt, remainingSeconds: Math.ceil(seconds), alertUnavailable: false });
    void this.effects
      .schedule(endsAt)
      .then(async (id) => {
        if (generation !== this.generation) {
          if (id !== null) await this.cancelNotification(id);
          return;
        }
        this.notificationId = id;
        if (id === null) this.publish({ ...this.state, alertUnavailable: true });
      })
      .catch(() => {
        if (generation === this.generation) this.publish({ ...this.state, alertUnavailable: true });
      });
  }

  tick(): void {
    if (this.state.endsAt === null) return;
    const remainingSeconds = Math.max(0, Math.ceil((this.state.endsAt - this.now()) / 1000));
    if (remainingSeconds === 0) {
      ++this.generation;
      this.releaseNotification();
      this.publish({ ...this.state, endsAt: null, remainingSeconds: 0 });
      void this.effects.complete().catch(() => {
        this.publish({ ...this.state, alertUnavailable: true });
      });
    } else if (remainingSeconds !== this.state.remainingSeconds) {
      this.publish({ ...this.state, remainingSeconds });
    }
  }

  skip = (): void => {
    ++this.generation;
    this.releaseNotification();
    this.publish({ endsAt: null, remainingSeconds: 0, alertUnavailable: false });
  };

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
    this.skip();
  }

  /** React can replay an effect setup after its cleanup in development. */
  activate(): void {
    this.disposed = false;
  }
}
