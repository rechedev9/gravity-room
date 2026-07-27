const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const scriptPath = resolve(__dirname, 'generate-route-manifest.mjs');

function runGenerator(arguments_) {
  return spawnSync(process.execPath, [scriptPath, ...arguments_], {
    encoding: 'utf8',
  });
}

describe('Expo Router manifest generator', () => {
  let fixtureDirectory;
  let appDirectory;
  let outputPath;

  beforeEach(() => {
    fixtureDirectory = mkdtempSync(join(tmpdir(), 'gravity-room-routes-'));
    appDirectory = join(fixtureDirectory, 'app');
    outputPath = join(fixtureDirectory, 'route-manifest.generated.ts');
    mkdirSync(join(appDirectory, '(tabs)', 'programs'), { recursive: true });
    writeFileSync(join(appDirectory, '_layout.tsx'), '');
    writeFileSync(join(appDirectory, '(tabs)', 'programs', 'index.tsx'), '');
  });

  afterEach(() => {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  });

  it('generates a deterministic manifest and accepts it in check mode', () => {
    expect(runGenerator(['--app-dir', appDirectory, '--output', outputPath]).status).toBe(0);
    expect(
      runGenerator(['--check', '--app-dir', appDirectory, '--output', outputPath]).status
    ).toBe(0);
  });

  it('fails when a route is added without regenerating the tracked manifest', () => {
    expect(runGenerator(['--app-dir', appDirectory, '--output', outputPath]).status).toBe(0);
    writeFileSync(join(appDirectory, '(tabs)', 'missing.tsx'), '');

    const result = runGenerator(['--check', '--app-dir', appDirectory, '--output', outputPath]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('manifest is missing or stale');
  });
});
