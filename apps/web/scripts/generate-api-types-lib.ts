function stripRuntimeClient(content: string): string {
  let next = content.replace(
    /^import \{ makeApi, Zodios, type ZodiosOptions \} from '@zodios\/core';\n/m,
    ''
  );

  next = next.replace(/\nexport const api = new Zodios\(endpoints\);\n?/m, '\n');
  next = next.replace(/\nexport function createApiClient\([\s\S]*?\n\}\n?/m, '\n');

  return next;
}

function normalizeEndpoints(content: string): string {
  return content.replace(/const endpoints = makeApi\(\[([\s\S]*?)\]\);/m, (_, body: string) => {
    const withoutAliases = body.replace(/\n\s+alias: '([^']+)',/g, '');
    return `export const endpoints = [${withoutAliases}\n] as const;`;
  });
}

export function buildGeneratedArtifact(rawContent: string): string {
  let content = rawContent.replace(/from 'zod'/g, "from 'zod/v4'");
  content = stripRuntimeClient(content);
  content = normalizeEndpoints(content);
  return content.trimEnd() + '\n';
}
