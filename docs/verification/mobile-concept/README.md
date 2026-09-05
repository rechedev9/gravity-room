# Templates: screenshot → generated concept → implementation

2026-09-04. Built-in image generation via the imagegen skill.

- [Before](./before.webp): tall paragraphs, repeated start actions, stale i18n key.
- [Generated concept](./concept.png), [exact generation prompt](./prompt.txt).
- [Implemented screen](./after.webp): searchable catalog, level filters, featured
  GZCLP, compact program rows and a detail sheet containing the start action.
- [Native filter](./filter.webp): beginner selection reduced 18 entries to 5.
- [Native detail](./detail.webp), [successful creation](./started.webp): starting
  GZCLP closed the sheet and opened its first workout. No overlay remained.

The generated concept is a design reference. The real app uses native controls,
actual catalog values and code-drawn decorative plates, not a flattened mockup.
Second iteration refined the plate shape and rounded the sheet corners.
No sorting control was added because that behavior was not implemented.

The i18n singleton now replaces resource bundles after module refresh and
subscribes to resource updates. The missing intro key in the supplied screenshot
was stale runtime data; the new screen rendered its translations without a cold
restart during verification.

Validation: mobile typecheck; 26 suites / 236 mobile tests passed. New tests cover
combined search/level filtering and keeping the sheet open after failed creation.
The router integration test now opens program details before starting it.

Playwright CLI inspected and captured the mobile web login. Attempting Dev Login
revealed two console errors from local API CORS (localhost:8081 → :3001), so web
preview was not used as evidence for authenticated catalog behavior. Android
provided the real functional verification. Browser session was closed.

This is a design iteration within #121, not completion of the remaining issues.
