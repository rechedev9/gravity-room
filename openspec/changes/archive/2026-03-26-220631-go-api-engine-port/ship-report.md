---
summary: Ship record for go-api-engine-port
read_when: reviewing what was shipped
---

# Ship: go-api-engine-port

- [x] Changes committed to branch go-api
- [x] Go engine package: internal/engine (types, engine, stats, graduation, hydrate)
- [x] Service: internal/service/catalog.go (preview rate limit, config resolution, validation)
- [x] Handler: internal/handler/catalog.go (HandlePreview)
- [x] Server: POST /api/catalog/preview wired with RequireAuth
- [x] Harness: schemas/catalog.ts + tests/catalog.test.ts (4 new contract tests)
- [x] lefthook.yml: go-vet + go-build pre-commit, go-test pre-push
