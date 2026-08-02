const baseUrlValue = process.env['PRODUCTION_URL'];
if (!baseUrlValue) {
  console.error(
    'production route check failed: set PRODUCTION_URL to the promoted origin (for example https://gravityroom.app)'
  );
  process.exit(2);
}

const baseUrl = new URL(baseUrlValue);
if (baseUrl.protocol !== 'https:' || baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash) {
  console.error('production route check failed: PRODUCTION_URL must be an HTTPS origin');
  process.exit(2);
}

const htmlRoutes = [
  '/',
  '/login',
  '/app',
  '/app/programs',
  '/app/profile',
  '/reset-password',
  '/verify-email',
] as const;
const actionRoutes = new Set(['/reset-password', '/verify-email']);
const failures: string[] = [];

for (const route of htmlRoutes) {
  const response = await fetch(new URL(route, baseUrl), {
    redirect: 'manual',
    headers: { 'user-agent': 'gravity-room-production-route-check/1.0' },
  });
  const contentType = response.headers.get('content-type') ?? '';

  if (response.status !== 200) failures.push(`${route}: expected 200, got ${response.status}`);
  if (!contentType.toLowerCase().includes('text/html')) {
    failures.push(`${route}: expected text/html, got ${contentType || '<missing>'}`);
  }
  if (
    actionRoutes.has(route) &&
    response.headers.get('referrer-policy')?.toLowerCase() !== 'no-referrer'
  ) {
    failures.push(
      `${route}: expected Referrer-Policy no-referrer, got ${response.headers.get('referrer-policy') ?? '<missing>'}`
    );
  }
}

if (failures.length > 0) {
  console.error(`production route check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`production routes OK: ${baseUrl.origin} (${htmlRoutes.length} routes)`);
