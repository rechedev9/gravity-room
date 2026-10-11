/**
 * Stable code the UI localizes (`login.errors.*`) for a failed auth call. The
 * server's own code wins; the status only fills in when the body carried none.
 */
export function authErrorCode(status: number, bodyCode: string | undefined): string {
  if (bodyCode) return bodyCode;
  if (status === 429) return 'RATE_LIMITED';
  if (status === 401) return 'INVALID_CREDENTIALS';
  if (status === 403) return 'EMAIL_NOT_VERIFIED';
  if (status === 409) return 'EMAIL_TAKEN';
  return 'generic';
}
