# Code Quality (SonarCloud quality gate)

> How the SonarCloud quality gate is wired into pull requests, what it checks,
> and how to react when it fails. Coverage is intentionally **not** part of
> the gate — see "Coverage" at the bottom for when to add it.

## What runs

`.github/workflows/sonarcloud.yml` triggers on every pull-request open /
synchronize / reopen against `main`. It uses
`SonarSource/sonarqube-scan-action@v6` to analyse the diff and post the
result back as a PR check.

A failed quality gate fails the workflow. When branch protection on `main`
requires the SonarCloud check, a failed gate blocks the merge.

## Files

| Path | Purpose |
| ---- | ------- |
| `.github/workflows/sonarcloud.yml` | The workflow. PR-only triggers; runs the SonarSource scan action. |
| `sonar-project.properties` | Project metadata: `sonar.projectKey`, `sonar.organization`, `sonar.sources`, `sonar.tests`, `sonar.exclusions`. The single source of truth for what gets analysed. |
| `docs/AUTHORING/code-quality.md` | This doc. |

## Repository secret you must add once

SonarCloud needs an access token to receive analyses. Generate one and add
it as a GitHub repo secret:

1. https://sonarcloud.io → log in with the GitHub account that owns the
   repo.
2. **My Account → Security → Generate Token**. Give it any name. Copy the
   value once — SonarCloud only shows it on creation.
3. GitHub repo → **Settings → Secrets and variables → Actions → New
   repository secret**. Name: `SONAR_TOKEN`. Value: the token from step 2.

The workflow reads it via `${{ secrets.SONAR_TOKEN }}`.

## What the gate checks

Sonar's "Sonar way" gate, applied to **new code only** (the diff in the PR):

- **0 new bugs**.
- **0 new vulnerabilities**.
- **0 new security hotspots requiring review**.
- **≤ 3% duplicated lines** introduced by the PR.
- **Reliability rating ≤ A**, **Security rating ≤ A**, **Maintainability
  rating ≤ A** on new code.

Coverage on new code is **disabled** in this project's quality gate. When
the suite gains a coverage layer (see bottom), re-enable it on SonarCloud →
Project Settings → Quality Gate.

## What it does NOT check

- **Existing technical debt** — only the diff matters. PRs aren't
  responsible for legacy issues.
- **Generated specs** — `.features-gen/**` and the recorded artefacts are
  excluded by `sonar.exclusions`.
- **Test runtime correctness** — Sonar reads code, it doesn't execute it.
  Use Playwright + ZAP for that side of the story.

## When the gate fails

The PR's "Checks" tab will show a failed `SonarCloud / Quality gate`
entry, plus inline comments on the changed files showing the exact issue
and a fix recommendation. Three real options:

1. **Fix the issue.** The recommendation Sonar inlines on the line is
   usually concrete and small.
2. **Mark a hotspot as reviewed.** Security hotspots aren't bugs; they're
   things Sonar wants a human to confirm are intentional. Click into
   SonarCloud, set the hotspot to "Reviewed → Safe" with a comment.
   Re-run the workflow on the PR to re-evaluate.
3. **Disagree with Sonar.** If a finding is wrong (false positive, by-design
   choice), mark the issue as "False Positive" or "Won't Fix" inside
   SonarCloud. Add a rationale comment. The next scan will treat it as
   accepted.

What we do **not** do: silently disable rules at the project level. Each
exception lives at the issue level so the audit trail is clear.

## Excluded paths

`sonar-project.properties` excludes:

- `.features-gen/**`, `**/*.feature.spec.{ts,js}` — generated specs.
- `recordings/**` — operator-curated normalized JSON.
- `reports/**`, `healing-logs/**`, `logs/**` — generated artefacts.
- `node_modules/**`, `dist/**` — vendored / built code.
- `.auth/**`, `.zap/**`, `.playwright-mcp/**`, `eng.traineddata`,
  `resources/healing-cache.json` — runtime state, not source.

When you add a new generated path, **also add it to
`sonar-project.properties`** — otherwise duplication and smell metrics
get polluted.

## Coverage (deferred)

The framework's tests are end-to-end, not unit tests. Adding code coverage
means either:

- A separate unit-test layer (Vitest / Jest) covering POM logic, the
  recorder, healing strategies, etc. Then `sonar.javascript.lcov.reportPaths`
  picks up the LCOV output.
- A Playwright coverage exporter that records `Coverage` API output during
  E2E runs and emits LCOV. Less mature; flaky for E2E suites.

Pick a path when ready, then:

1. Wire the test command to emit `coverage/lcov.info`.
2. Add `sonar.javascript.lcov.reportPaths=coverage/lcov.info` to
   `sonar-project.properties`.
3. Re-enable "Coverage on New Code" in the SonarCloud quality gate.

## CI compatibility

The workflow runs on `ubuntu-latest`. It does not need Docker, browsers,
or any of the Playwright tooling — Sonar analyses code statically.
Independent of the Playwright-bdd, healing, or ZAP integrations.

## Branch protection (one-time setup on GitHub)

After the first SonarCloud run completes successfully on a PR:

1. GitHub repo → **Settings → Branches → Branch protection rules → Add
   rule**.
2. Branch name pattern: `main`.
3. Tick **Require status checks to pass before merging**.
4. Search for `SonarCloud` in the status-checks search and select it.
5. Save.

From this point on, no PR merges to `main` without a green Sonar gate.
