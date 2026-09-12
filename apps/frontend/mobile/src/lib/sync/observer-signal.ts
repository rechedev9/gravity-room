/** Synchronous notifications whose observers do not own the durable operation. */
export function createObserverSignal<T>() {
  const listeners = new Map<(value: T) => void, object>();
  return {
    subscribe(listener: (value: T) => void): () => void {
      const registration = listeners.get(listener) ?? {};
      listeners.set(listener, registration);
      return () => {
        if (listeners.get(listener) === registration) listeners.delete(listener);
      };
    },
    publish(value: T): void {
      // New registrations belong to the next publication. Removed registrations
      // cannot be resurrected by reusing the same callback during this delivery.
      for (const [listener, registration] of [...listeners]) {
        if (listeners.get(listener) !== registration) continue;
        try {
          listener(value);
        } catch {
          // A failed observer cannot change an already committed operation.
        }
      }
    },
  };
}
