export class InvalidApiPathIdentifierError extends Error {
  constructor() {
    super('Invalid API path identifier');
    this.name = 'InvalidApiPathIdentifierError';
  }
}

/** Encode one identifier without allowing it to become URL syntax or a dot segment. */
export function encodeApiPathIdentifier(value: string): string {
  if (value.trim().length === 0 || value === '.' || value === '..') {
    throw new InvalidApiPathIdentifierError();
  }
  try {
    return encodeURIComponent(value);
  } catch {
    throw new InvalidApiPathIdentifierError();
  }
}
