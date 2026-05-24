# Playwright-TS-BDD Self-Healing Framework

A Playwright + Cucumber (BDD) automation framework with AI-driven self-healing locators, agent-based authoring workflows, and cached authentication for long-running suites.

## Quick start

```bash
npm install
npx playwright install
npx bddgen
npx playwright test
```

## Documentation

| If you want to … | Read |
| ---------------- | ---- |
| Understand the layout and pipeline | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Find a specific component | [`docs/COMPONENTS.md`](docs/COMPONENTS.md) |
| Write code that follows the rules | [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) |
| Run the tests | [`docs/RUNNING.md`](docs/RUNNING.md) |
| Author a new feature end-to-end | [`docs/AUTHORING/writing-features.md`](docs/AUTHORING/writing-features.md) |
| Work with the healing engine | [`docs/AUTHORING/self-healing.md`](docs/AUTHORING/self-healing.md) |
| Capture and convert recordings | [`docs/AUTHORING/recording-workflow.md`](docs/AUTHORING/recording-workflow.md) |
| Combine API and UI in one scenario | [`docs/AUTHORING/api-testing.md`](docs/AUTHORING/api-testing.md) |
| Understand cached login & 29-min TTL | [`docs/AUTHORING/auth-storageState.md`](docs/AUTHORING/auth-storageState.md) |
| Drive the framework with an agent | [`docs/AGENTS.md`](docs/AGENTS.md) |

Each doc declares what it is the source of truth for. When you change the framework, update **one** doc — see the responsibility table at the bottom of `docs/CONVENTIONS.md`.
