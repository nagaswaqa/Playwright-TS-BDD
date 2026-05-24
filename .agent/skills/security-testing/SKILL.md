---
name: security-testing-zap
description: Passive OWASP ZAP scan that observes Playwright traffic during normal test runs.
---

# Security Testing Skill

Use this skill when wiring or troubleshooting passive security scanning.
The integration adds an HTTP proxy in front of the Playwright browser so
ZAP can analyse every request the test issues, without changing test
behaviour.

## Canonical references

- [`docs/AUTHORING/security-testing.md`](../../../docs/AUTHORING/security-testing.md) — full operator workflow, severity gate, suppression model, troubleshooting.
- [`docs/RUNNING.md`](../../../docs/RUNNING.md) — `npm run test:security`, `security:start`, `security:stop`.
- [`docs/COMPONENTS.md`](../../../docs/COMPONENTS.md) — entries for the proxy hookup in `fixtures.ts` and `testConfig.ts`.

## Boundaries

- This skill is *passive* only. Active (intrusive) scanning is intentionally out of scope until a dedicated security test environment exists.
- ZAP findings are advisory; tests do not fail by default. Severity gate is configured per run via `-FailOn`.
