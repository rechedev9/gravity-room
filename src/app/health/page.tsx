import type { Metadata } from 'next';
import { APP_VERSION } from '@/lib/version';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const commitSha: string | null = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
const buildTime: string = new Date().toISOString();

const healthData: Record<string, string | null> = {
  status: 'ok',
  version: APP_VERSION,
  buildTime,
  commit: commitSha,
};

export default function HealthPage(): React.JSX.Element {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        color: '#e5e5e5',
        fontFamily: 'monospace',
      }}
    >
      <pre
        style={{
          fontSize: '14px',
          lineHeight: 1.6,
          padding: '24px',
        }}
      >
        {JSON.stringify(healthData, null, 2)}
      </pre>
    </div>
  );
}
