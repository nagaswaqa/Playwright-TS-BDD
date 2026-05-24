# Auth & storageState

> How the framework keeps long-running suites authenticated.

## Why this exists

The demo Student Information System expires sessions after 30 minutes. Without intervention, any suite that runs longer than that — or any second worker created later in the run — fails on the first protected request. `AuthCache` solves this by caching a Playwright `storageState` and refreshing it before it can expire.

## Components

| Component | Role |
| --------- | ---- |
| `src/core/auth/AuthCache.ts` | Single source of truth. Manages `.auth/user.json`, exposes `isFresh`, `ensureFresh`, `refresh`, `applyToContext`. |
| `src/setup/global-setup.ts` | Playwright `globalSetup` hook. Calls `AuthCache.ensureFresh()` once before the suite starts. |
| `src/core/support/fixtures.ts` | Worker-scoped context creation. Loads `.auth/user.json` as `storageState` when present. |
| `src/core/support/hooks.ts` | `Before` hook re-checks freshness on every scenario and re-applies refreshed state to the live context. |
| `src/pages/LoginPage.ts` | Owns the recorded login bypass (`LOGIN_BYPASS_SEQUENCE` and `DASHBOARD_READY_SELECTOR`). `AuthCache` reuses these constants. |

## Configuration

| Constant | Default | Where |
| -------- | ------- | ----- |
| `STATE_FILE` | `<repo>/.auth/user.json` | `AuthCache.ts` |
| `STATE_TTL_MS` | `29 * 60 * 1000` (29 min, 1 min safety margin) | `AuthCache.ts` |

`.auth/` is gitignored.

## Lifecycle

```
suite start
    │
    ▼
globalSetup → AuthCache.ensureFresh()
    │
    ├─ fresh   → no-op
    └─ stale   → refresh()  (isolated headless chromium, runs login bypass)
                            │
                            ▼
                            persists cookies + per-origin localStorage
                            to .auth/user.json
    │
    ▼
worker created → newContext({ storageState: '.auth/user.json' })
    │
    ▼
scenario starts → Before hook → AuthCache.ensureFresh()
    │
    ├─ fresh   → no-op
    └─ stale   → refresh() + applyToContext(context, page)
                            │
                            ▼
                            re-injects cookies + localStorage,
                            reloads the page so the running session
                            picks up the new auth without restarting
                            the worker
```

`refresh()` always uses an isolated browser. It never touches the worker's running context, so a refresh in flight doesn't perturb whatever scenario is currently running.

`applyToContext()` reapplies cookies via `addCookies` and walks each origin in the saved state to inject `localStorage` (browser security requires being on the origin to write to its storage).

## Operations

### Force a refresh

```bash
rm .auth/user.json
```

The next `globalSetup` (or `Before` hook) will rebuild it.

### Test the refresh path during development

Edit `STATE_TTL_MS` in `src/core/auth/AuthCache.ts` to something tiny (e.g. `10 * 1000`) and run a multi-scenario suite. You should see this in the logs:

```
[AUTH] storageState refreshed, re-applying to worker context
```

### Disable cached auth

Delete `.auth/user.json` and don't run `globalSetup`. With no cache file, `fixtures.ts` falls back to creating contexts without `storageState`. Scenarios that need auth must perform login themselves (typically via `LoginPage.loginAndOpenDashboard()`).

## When the bypass changes

If the login flow gains or loses steps, edit `LOGIN_BYPASS_SEQUENCE` in `src/pages/LoginPage.ts` only. `AuthCache` and the global setup pull from that one constant.

If credentials become required:

1. Rename `LOGIN_BYPASS_SEQUENCE` to something honest (e.g., `LOGIN_FLOW`).
2. Add credential reads from environment variables (`process.env.TEST_USER`, `process.env.TEST_PASSWORD`) in `LoginPage`.
3. Update `AuthCache.refresh()` to pass the same credentials.
4. Document the new env vars in [`docs/RUNNING.md`](../RUNNING.md).

## Failure modes

- **Refresh times out** — `refresh()` swallows the error, deletes any half-written file, and logs `[AuthCache] Refresh failed`. The next `Before` hook will try again.
- **`applyToContext()` fails on an origin** — logged and skipped. Other origins still get their state. The page may not reflect the refresh until the next reload.
- **`globalSetup` exits silently when fresh** — by design. The first scenario's `Before` hook is the safety net.
