# Security Testing (OWASP ZAP, passive)

> How to run the Playwright suite with OWASP ZAP listening as an HTTP proxy
> so every test doubles as a passive security scan. Active (intrusive) ZAP
> scans are intentionally not part of this integration today — see "Out of
> scope" at the bottom.

## What "passive" means

ZAP sits between Playwright and the application as an HTTP proxy. It
**observes** every request and response and runs its passive-scan rule
set: header analysis, cookie flag checks, info-disclosure patterns,
mixed-content detection, and so on. It never modifies traffic, never
sends extra requests, and never attacks the target. The tests run
exactly as they would without ZAP.

The output is a report (`reports/security/zap-report-<ts>.html` and
`.json`) listing the findings ZAP saw across the entire test session.

## Pieces

| Component | Role |
| --------- | ---- |
| `scripts/Start-Zap.ps1` | Boots `ghcr.io/zaproxy/zaproxy:stable` in Docker, waits for the daemon API to be reachable on `127.0.0.1:8090`, persists the runtime state (port + API key) to `.zap/session.json`. |
| `scripts/Stop-Zap.ps1` | Applies suppressions from `resources/zap-baseline.conf`, asks ZAP to render the HTML + JSON reports into `reports/security/`, stops the container, exits non-zero when findings cross the configured severity threshold. |
| `scripts/Test-WithZap.ps1` | Composer that does start → bddgen → playwright test → stop in one command. |
| `src/core/support/fixtures.ts` | Reads `testConfig.zapProxyEnabled`. When `ZAP_PROXY=1`, every worker `BrowserContext` is created with `proxy: { server: 'http://127.0.0.1:8090' }`. |
| `config/testConfig.ts` | New fields: `zapProxyEnabled`, `zapProxyHost`, `zapProxyPort`. |
| `resources/zap-baseline.conf` | Operator-curated suppression list (one ZAP alert id per line + a comment with the rationale). |

## Prerequisites

- **Docker Desktop** (or Linux Docker daemon) running and reachable.
- The ZAP image is pulled the first time you run `Start-Zap.ps1`. ~600 MB.
- No JRE required on the host — ZAP runs inside the container.

## Operator workflow

The integration is **opt-in per scenario** via the `@security` tag. Tag the scenarios you want scanned, then:

```
npm run test:security
```

That runs every `@security`-tagged scenario through ZAP and emits the report. The intent is "scan flows I've already automated and decided are worth scanning", not "scan the whole suite every time".

### Tagging a scenario

```gherkin
@StudentEnquiry @recording @security
Feature: 1 Campus Student Information System

  Background:
    Given the application is open

  Scenario: Recorded user flow
    When I navigate to the "Student Management" section
    ...
```

You can tag at the `Feature` level (every scenario in the file gets scanned) or per-`Scenario` to scan only specific ones. The recording pipeline doesn't add `@security` automatically — it's a deliberate operator decision.

### What `npm run test:security` actually does

```
1. Pull/start ghcr.io/zaproxy/zaproxy:stable in daemon mode.
2. Run `npx bddgen && npx playwright test --grep '@security'` with ZAP_PROXY=1.
3. Render reports/security/zap-report-<ts>.html + .json.
4. Stop the container.
5. Exit non-zero if any High finding survived suppressions (default; configurable via -FailOn).
```

### Variants

| Command | What it scans |
| ------- | ------------- |
| `npm run test:security` | Default. All `@security`-tagged scenarios. |
| `npm run test:security -- -Tag '@StudentEnquiry'` | Scenarios tagged `@StudentEnquiry`. Useful when the feature already has a functional tag and you want to scan it ad-hoc without editing the feature file. |
| `npm run test:security -- -Tag '@security\|@smoke' -FailOn Medium` | Two tag groups, fail on Medium-or-higher. Note the escaped `\|` for PowerShell. |
| `npm run test:security -- --all` | Bypass the tag filter and scan every scenario. Slow; useful before a release. |
| `npm run security:start` then manual run | Full manual control. Set `ZAP_PROXY=1` and `--grep` whatever you want, then `npm run security:stop`. |

### Manual lifecycle

```bash
npm run security:start
ZAP_PROXY=1 npx bddgen && npx playwright test --grep '@security'
npm run security:stop
```

## Configuration

| Env var | Default | Effect |
| ------- | ------- | ------ |
| `ZAP_PROXY` | unset | When `1` / `true`, the worker context routes through ZAP. |
| `ZAP_PROXY_HOST` | `127.0.0.1` | Where to reach the daemon. |
| `ZAP_PROXY_PORT` | `8090` | Daemon port. Match the `-Port` flag on `Start-Zap.ps1` if you change it. |

## Severity gate

`Stop-Zap.ps1 -FailOn High|Medium|Low|Off` (default `High`).

| Setting | Exit non-zero on … |
| ------- | ------------------ |
| `High` | Any High finding. **Recommended for CI.** |
| `Medium` | High or Medium. Use after the High baseline is clean. |
| `Low` | High, Medium, or Low. Aspirational. |
| `Off` | Never (report only). Useful while tuning. |

## Suppressions: `resources/zap-baseline.conf`

When ZAP flags something you've consciously decided to accept (or accept
*for now*), add a line:

```
10038	Content Security Policy header missing — accepted while CSP rollout is in progress
10020	X-Frame-Options header missing — internal-only app, click-jacking risk minimal
```

- One alert id per line.
- After a tab, add a free-text rationale. Required by convention; the
  loader doesn't enforce it but reviewers should reject lines without one.
- Find the alert id in the JSON report's `pluginid` field, or in the URL
  path inside the HTML report's alert detail.
- Remove the line when the underlying issue is fixed so future regressions
  are caught immediately.

## What this catches on the SIS today

Without authoring any extra scenarios, passive scanning surfaces:

- Missing security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options).
- Cookies missing `Secure` / `HttpOnly` / `SameSite` flags.
- Auth tokens or session ids leaked into URLs or logs.
- `Cache-Control` misconfiguration on sensitive endpoints.
- Server-version banners and stack traces (info disclosure).
- Mixed content (HTTPS pages loading HTTP assets).

The dev SIS at `http://145.241.185.96/app` is plain HTTP. ZAP will flag the lack of TLS as a Medium finding immediately. That's accurate; suppress it via `zap-baseline.conf` while you're targeting the dev host so it doesn't drown out real findings.

## What it does NOT catch

Honest framing — these need other tools:

- **Authorisation logic.** ZAP doesn't know that `/api/admin/*` should
  reject non-admin users. Write role-based scenarios in the suite.
- **Business-logic flaws.** ZAP can't tell if a "Save Changes" actually
  persisted the right values. That's still a Playwright assertion.
- **Dependency vulnerabilities.** ZAP scans runtime traffic, not your
  `package.json`. Use `npm audit` / Dependabot.
- **Source-level issues.** ZAP is black-box. Pair with CodeQL, SonarQube,
  or similar SAST.

## Out of scope (intentionally)

**Active scanning** — ZAP also has `active scan` mode that replays observed
requests with attack payloads (XSS, SQLi, path traversal, etc.). It is
**destructive by default**: it will create test enquiries, attempt to
delete records, post junk data. Active scanning belongs against a
dedicated security test environment, never the shared dev SIS. If we
add it later it lives behind a separate `npm run test:security:active`
script and a different env, so this passive integration is the
always-on baseline.

## Trouble-shooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| `Docker is required but not reachable` | Docker Desktop not running. | Start Docker, retry. |
| `ZAP did not become ready within 90s` | Image still downloading on first run, or container failed to start. | `docker logs playwright-bdd-zap` to inspect. |
| Tests pass but `reports/security/` is empty | `Stop-Zap.ps1` couldn't reach the daemon (different port). | Match `ZAP_PROXY_PORT` to the `-Port` you used in `Start-Zap.ps1`. |
| Browser shows TLS warnings on HTTPS sites | Operating through ZAP's dynamic CA. | Either accept inline, or import ZAP's CA cert (see ZAP docs); the proxy itself works regardless. |
| First-run `docker pull` is slow | ~600 MB image download. | Run `docker pull ghcr.io/zaproxy/zaproxy:stable` ahead of time and you'll never wait again on this machine. |
