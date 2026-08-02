import { describe, expect, it } from 'vitest';
import type * as SentryReact from '@sentry/react';
import { sanitizeSentryBreadcrumb, sanitizeSentryEvent, sanitizeSentryUrl } from './sentry';

describe('Sentry privacy sanitization', () => {
  it.each([
    [
      'https://gravityroom.app/reset-password?token=secret&utm_source=email#form',
      'https://gravityroom.app/reset-password',
    ],
    ['/verify-email?token=secret#status', '/verify-email'],
    ['./verify-email?token=secret#status', './verify-email'],
    ['../reset-password?token=secret#status', '../reset-password'],
  ])('strips query and fragment from %s', (input, expected) => {
    expect(sanitizeSentryUrl(input)).toBe(expected);
  });

  it('removes request query, body, cookies, headers, user PII, and nested secrets', () => {
    const event: SentryReact.Event = {
      message: 'Failed at https://gravityroom.app/reset-password?token=secret#form',
      request: {
        url: 'https://gravityroom.app/reset-password?token=secret#form',
        query_string: { token: 'secret' },
        data: { password: 'new-password' },
        cookies: { refresh_token: 'refresh-secret' },
        headers: { Referer: 'https://gravityroom.app/reset-password?token=secret' },
      },
      user: {
        id: 'account-id',
        email: 'user@example.com',
        ip_address: '127.0.0.1',
      },
      extra: {
        safe: 'kept',
        body: { credential: 'google-token' },
        nested: {
          url: 'https://gravityroom.app/programs?owner=user@example.com',
          refreshToken: 'refresh-secret',
        },
      },
      contexts: {
        response: {
          status_code: 400,
          body: 'sensitive response',
        },
      },
    };

    const sanitized = sanitizeSentryEvent(event);

    expect(sanitized.request).toEqual({ url: 'https://gravityroom.app/reset-password' });
    expect(sanitized.user).toEqual({ id: 'account-id' });
    expect(sanitized.message).toBe('Failed at https://gravityroom.app/reset-password');
    expect(sanitized.extra).toEqual({
      safe: 'kept',
      nested: { url: 'https://gravityroom.app/programs' },
    });
    expect(sanitized.contexts?.response).toEqual({ status_code: 400 });
  });

  it('sanitizes relative sensitive URLs across textual and nested event fields', () => {
    const relativeUrl = '/verify-email?token=relative-secret#status';
    const event = {
      message: `Verification failed at ${relativeUrl}`,
      logentry: {
        message: `Log ${relativeUrl}`,
        params: [relativeUrl, { nested: [relativeUrl] }],
      },
      transaction: `route ${relativeUrl}`,
      fingerprint: [`failure ${relativeUrl}`],
      tags: {
        route: relativeUrl,
        token: 'relative-secret',
      },
      request: {
        url: relativeUrl,
        env: { location: relativeUrl },
      },
      breadcrumbs: [
        {
          category: `navigation ${relativeUrl}`,
          message: `Opened ${relativeUrl}`,
          data: { nested: { href: relativeUrl } },
        },
      ],
      extra: { nested: { values: [relativeUrl] } },
      contexts: { navigation: { relativeUrl } },
      exception: {
        values: [
          {
            value: `Thrown from ${relativeUrl}`,
            stacktrace: { frames: [{ filename: relativeUrl }] },
          },
        ],
      },
      spans: [
        {
          description: `POST ${relativeUrl}`,
          data: { url: relativeUrl, nested: { href: relativeUrl }, token: 'relative-secret' },
        },
      ],
    } as unknown as SentryReact.Event;

    const sanitized = sanitizeSentryEvent(event);
    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.toContain('relative-secret');
    expect(serialized).not.toContain('?token=');
    expect(sanitized.message).toBe('Verification failed at /verify-email');
    expect(sanitized.tags).toEqual({ route: '/verify-email' });
    expect(sanitized.breadcrumbs?.[0]).toMatchObject({
      category: 'navigation /verify-email',
      message: 'Opened /verify-email',
      data: { nested: { href: '/verify-email' } },
    });
    expect(sanitized.extra).toEqual({ nested: { values: ['/verify-email'] } });
    expect(sanitized.spans?.[0]?.data).toEqual({
      url: '/verify-email',
      nested: { href: '/verify-email' },
    });
  });

  it('sanitizes breadcrumb URLs and removes payload metadata', () => {
    const breadcrumb: SentryReact.Breadcrumb = {
      message: 'POST https://gravityroom.app/api/auth/reset-password?token=secret',
      data: {
        url: 'https://gravityroom.app/api/auth/reset-password?token=secret',
        request_body: { token: 'secret', password: 'password' },
        status_code: 400,
      },
    };

    expect(sanitizeSentryBreadcrumb(breadcrumb)).toEqual({
      message: 'POST https://gravityroom.app/api/auth/reset-password',
      data: {
        url: 'https://gravityroom.app/api/auth/reset-password',
        status_code: 400,
      },
    });
  });
});
