# Mobile outbox changes

The outbox records user intent in SQLite before network delivery. Keep its
responsibilities explicit when changing the mobile app:

| Module in `src/lib/sync`       | Owns                                                                       |
| ------------------------------ | -------------------------------------------------------------------------- |
| `mutation-queue-repository.ts` | Durable rows, owner partitions, deduplication, paging and acknowledgements |
| `mutation-request.ts`          | Pure envelope validation, path encoding, method and body serialization     |
| `mutation-sync-service.ts`     | Authorized delivery, cancellation, retained failures, backoff and draining |
| `foreground-sync.ts`           | App foreground lifecycle, retry timer and session recovery                 |
| `sync-events.ts`               | Owner-scoped notifications after durable operations                        |

The request compiler imports the persisted row type only. It must not open
SQLite, fetch, access credentials, schedule timers, or acknowledge a row.
Changing wire serialization can be tested without loading those systems.

Supported intents are `record-result`, `update-metadata`, and `delete-result`.
Only deletion treats HTTP 404 as completion. Unknown or malformed intents are
retained with `INVALID_OUTBOX` by the worker, never silently discarded. Domain
payloads (set logs, metadata fields, progression inputs) remain unchanged for
validation by the API and shared domain package.

Run `pnpm --filter mobile exec jest --runInBand src/lib/sync` for both compiler
contracts and worker delivery regressions. Add compiler cases when changing
methods, paths or payload envelopes; add worker cases when changing retry,
cancellation, ordering or acknowledgements. Run the complete mobile suite and
typecheck before publishing.

## Failure classification

`sync-failure-policy.ts` owns error-to-diagnostic conversion and HTTP dispositions.
The worker uses the disposition to retain or retry intent. The status repository
uses the same policy to count diagnostics that need attention without loading
every payload into memory.

| Failure                           | Worker behavior                  | Needs attention |
| --------------------------------- | -------------------------------- | --------------- |
| Invalid outbox payload            | Retain rejected intent           | Yes             |
| HTTP 401                          | Stop for authentication recovery | Yes             |
| HTTP 408, 425, 429                | Retry under backoff              | No              |
| Other HTTP 4xx                    | Retain rejected intent           | Yes             |
| Server/transport/timeout failures | Retry under backoff              | No              |

Cancellation remains a lifecycle decision in the worker, not a persisted network
diagnostic. Keep server `Retry-After` deadlines separate from classification.
Policy tests exercise the distinction between authentication and permanent
rejection; `sync-status-repository.test.js` verifies aggregation, owner isolation,
diagnostic updates and acknowledgement against real SQLite.

## Observer delivery

Sync attempts, queue changes and explicit sync requests use separate synchronous
signals in `sync-events.ts`. A publication snapshots registrations in insertion
order. New subscriptions wait for the next publication; removed subscriptions
are skipped even if the same callback is registered again. Cleanup is idempotent
and a stale cleanup cannot remove a replacement registration. Simultaneous
subscriptions of the same callback remain deduplicated.

Observers do not own the durable operation: their exceptions are isolated so a
committed edit or acknowledgement cannot become a reported storage failure.
Callbacks should stay synchronous and short. Nested publications are synchronous
and take their own snapshot; listeners must not recursively publish without a
termination condition. `observer-signal.test.ts` covers these lifecycle contracts.
