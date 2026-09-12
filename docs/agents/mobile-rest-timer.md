# Rest timer lifecycle

`src/lib/rest/rest-timer.ts` is the countdown controller. It samples an injected
wall clock, so suspended JavaScript does not accumulate interval drift. Keep
React, Expo permissions, notification channels and haptics outside this module.
`rest-alerts.native.ts` owns platform effects; `shell/rest-timer-provider.tsx`
owns foreground subscriptions and rendering.

Every start, skip, completion and disposal advances a generation. Async alert
results may update status only for the generation that requested them. A late
scheduled notification must still be cancelled, even after logout; its failure
must not overwrite a newer timer's status. Cleanup releases a notification
under its original generation before transitioning to the next one.

Platform effects may reject or throw synchronously. Both are handled at the
controller boundary, while the countdown remains usable and current failures
set `alertUnavailable`. Invalid durations or dates reject before changing an
existing timer or releasing its notification.

Run `pnpm --filter mobile exec jest --runInBand src/lib/rest` for countdown,
platform adapter and lifecycle regressions. Use deferred promises to reproduce
late results rather than timing-dependent sleeps. Native permission dialogs and
background notification delivery require device verification when those
platform adapters change.
