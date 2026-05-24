# Running Tests

> **Source of truth** for how to install, configure, and run the test suite.
> Add new npm scripts here, not anywhere else.

## Install

```bash
npm install
npx playwright install
```

## Quick run

```bash
npx bddgen
npx playwright test
```

`npx bddgen` regenerates `.features-gen/` from `features/`. `npx playwright test` runs the generated specs.

## npm scripts

| Command | What it does |
| ------- | ------------ |
| `npm test` | `npx bddgen` + `npx playwright test` + open the HTML report. |
| `npm run test:noReport` | bddgen + playwright test, no report. |
| `npm run test:dev` | Sets `ENV=dev` then runs the full pipeline. |
| `npm run test:staging` | Sets `ENV=staging` then runs the full pipeline. |
| `npm run test:dev:noReport` / `test:staging:noReport` | Same as above without opening the report. |
| `npm run test:recording` | Runs only `@recording`-tagged scenarios. |
| `npm run test:recording:report` | `test:recording` + open report. |
| `npm run bddgen` | Regenerate `.features-gen/` from `features/`. |
| `npm run report` | Open the last HTML report. |
| `npm run clean` | Wipe `reports/`, `.features-gen/`, logs. |
| `npm run recorder:start` | Stage 1 — orchestrator PS1 (recorder server + normalize + delete temp raw). |
| `npm run recorder:to-feature -- <normalized-json> --name <FeatureName>` | Stage 2b — generate `features/<FeatureName>Recorded.feature` from the normalized recording, reusing existing step definitions where possible. Format reference: [`AUTHORING/writing-features.md`](AUTHORING/writing-features.md). |
| `npm run recorder:generate-pom -- <normalized-json>` | Stage 3 — generate POM + locator entries (run only after operator approves the feature). |

## Environment variables

Resolved in order: `process.env` → `config/.env.UB.<env>` → defaults in `config/testConfig.ts`.

| Variable | Default | Effect |
| -------- | ------- | ------ |
| `ENV` | `dev` | Selects which `.env.UB.<env>` to load. Registry: `config/environments.ts`. |
| `BROWSER_NAME` | `chromium` | `chromium`, `firefox`, or `webkit`. |
| `HEADLESS` | `false` | `true` to run invisible. |
| `WORKERS` | `3` | Number of Playwright workers. CI hardcodes `1`. |
| `BASE_URL` | empty | Application URL. Falls back to a hard default in `LoginPage` / `AuthCache`. |
| `HEALING_AUDIT` | `true` | Set to `false` to disable healing audit logs. |
| `PLAYWRIGHT_TIMEOUT` | `120000` | Per-test timeout in ms. |

## Reports

- HTML report: `reports/html-report/index.html`. Open with `npm run report` or `npx playwright show-report reports/html-report`.
- Healing audit: `healing-logs/healing-audit.log` (JSON-lines). Format and usage in [`AUTHORING/self-healing.md`](AUTHORING/self-healing.md).
- Healing reports (JSON + HTML): generated on demand by `HealingReporter`.

## Authentication

`AuthCache` persists a Playwright `storageState` to `.auth/user.json` (gitignored) and refreshes it every 29 minutes. See [`AUTHORING/auth-storageState.md`](AUTHORING/auth-storageState.md) for the full flow, including how to force a refresh during development.
