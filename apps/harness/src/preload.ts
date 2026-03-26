export {};

const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:3001';
const MAX_WAIT_MS = 30_000;
const POLL_INTERVAL_MS = 500;

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return;
    } catch {
      // Server not up yet
    }
    await Bun.sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Server at ${BASE_URL} did not become healthy within ${MAX_WAIT_MS}ms`);
}

await waitForServer();
