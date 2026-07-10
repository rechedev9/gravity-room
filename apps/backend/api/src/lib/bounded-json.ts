export const MAX_PROVIDER_JSON_BYTES = 256 * 1024;

/** Parse JSON without allowing a remote peer to make response buffering unbounded. */
export async function readBoundedJson(
  response: Response,
  maxBytes: number,
  errorFactory: () => Error
): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isSafeInteger(declaredLength) && declaredLength > maxBytes) {
    throw errorFactory();
  }
  if (!response.body) throw errorFactory();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw errorFactory();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw errorFactory();
  }
}
