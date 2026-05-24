# Agents & Skills

> Single source of truth for agent prompts, skill registry, and the orchestration workflow.

## Skill registry

Each skill in `.agent/skills/<skill>/SKILL.md` is a thin entry point. Detailed guidance lives in the canonical docs listed below.

| Skill | What it covers | Canonical doc |
| ----- | -------------- | ------------- |
| `playwright-mcp` | Playwright BDD wiring and how to reason about this repo. | [`docs/COMPONENTS.md`](COMPONENTS.md), [`docs/CONVENTIONS.md`](CONVENTIONS.md) |
| `bdd-support` | Step DSL surface, fixtures, hooks, `testContextStorage`. | [`docs/CONVENTIONS.md`](CONVENTIONS.md), [`docs/AUTHORING/writing-features.md`](AUTHORING/writing-features.md) |
| `page-object-model` | POM layout, healed helpers, locator naming. | [`docs/CONVENTIONS.md`](CONVENTIONS.md), [`docs/AUTHORING/writing-features.md`](AUTHORING/writing-features.md) |
| `self-healing` | Multi-stage healing pipeline and audit. | [`docs/AUTHORING/self-healing.md`](AUTHORING/self-healing.md) |
| `healing-engine` | Engine internals, locator repository, strategies. | [`docs/AUTHORING/self-healing.md`](AUTHORING/self-healing.md), [`docs/COMPONENTS.md`](COMPONENTS.md) |
| `api-testing` | `RestApiClient` and hybrid scenarios. | [`docs/AUTHORING/api-testing.md`](AUTHORING/api-testing.md) |
| `security-testing` | Passive OWASP ZAP scan running alongside the Playwright suite. | [`docs/AUTHORING/security-testing.md`](AUTHORING/security-testing.md) |
| `code-quality` | SonarCloud quality gate on PRs (bugs, vulnerabilities, smells, hotspots, duplication). | [`docs/AUTHORING/code-quality.md`](AUTHORING/code-quality.md) |
| `recording-workflow` | Three sub-agents (recorder / exporter / automation) — third stage gated on operator approval. | [`docs/AUTHORING/recording-workflow.md`](AUTHORING/recording-workflow.md) |
| `tc-gen` | Generate BDD scenarios from ADO + dev code + business reqs. | `.agent/workflows/test-automation-agent.md` |
| `ado-mcp` | Azure DevOps pipeline guidance. | this file (no Pipeline YAML committed yet). |

When a skill changes, update the canonical doc — not the SKILL.md.

## Workflows

`.agent/workflows/test-automation-agent.md` — End-to-end orchestration for an AI agent: pull dev repo → query ADO via MCP → ingest business reqs → author `.feature` → user approval → generate steps/POM/locators → run + open report.

## Prompt reference

These prompts trigger predefined agent flows.

### Flow 1 — Recorder → Export → Review → Automate

The recording flow is owned by three sub-agents. Stages 1 and 2 produce review-only artefacts (no source code is touched). Stage 3 runs only after the operator approves the generated feature with `automate it`. See [`docs/AUTHORING/recording-workflow.md`](AUTHORING/recording-workflow.md) for the full contracts and [`docs/AUTHORING/writing-features.md`](AUTHORING/writing-features.md) for the feature format the generator targets.

| Sub-agent | Prompt | What it does |
| --------- | ------ | ------------ |
| recorder-agent | `open browser and inject recorder` (optional `<url>`) | Resolves the URL (parameter > `BASE_URL` from `config/.env.UB.<env>`), runs `pwsh ./scripts/Start-Recorder.ps1`, launches Chromium, injects `resources/recorder-script.js`, waits for the operator to type `export`, normalizes the payload **in process**, writes `recordings/normalized-<ts>.json`. **No raw JSON is ever persisted.** |
| exporter-agent | `export <normalized-json-path> <FeatureName>` | Reads the normalized JSON and `resources/recorder-step-rules.json`. Writes `features/<FeatureName>Recorded.feature` with `@<FeatureName>` + `@recording` tags using only rule-matched high-level steps. **Strict by default**: refuses (exit 2) and lists unmatched actions if any rule is missing. **Halts here for operator review.** Touches no source code. |
| (operator review) | — | Read the generated feature. If a rule is missing, add a step to `src/steps/` and a matching entry to `resources/recorder-step-rules.json`, then re-run the exporter. If it's right, say `automate it`. |
| automation-agent | `automate it` | Reads the same normalized JSON, creates/updates `src/pages/<Inferred>Page.ts`, appends new entries to `resources/locators.json`. |
| (operator) | — | Run `npx bddgen && npx playwright test` and open the HTML report. |

The orchestrator runs them in sequence. If the operator does not approve the feature, the automation agent never runs and no source code is mutated. Never blur sub-agent contracts.

#### Recorder flags worth knowing

- `npm run recorder:start` — wraps `pwsh ./scripts/Start-Recorder.ps1`. Accepts `-Url <url>` and `-Environment <env>` after a `--` separator (e.g. `npm run recorder:start -- -Environment qa`).
- `npm run recorder:to-feature -- <normalized-json> <FeatureName>` — strict by default. Add `--allow-fallback` only for spike work (it bypasses self-healing because the selector ends up in the Gherkin instead of `resources/locators.json`). Add `--force` to overwrite an existing feature file; default behaviour is to write a timestamped sibling.
- `npm run recorder:generate-pom -- <normalized-json>` — runs the automation agent. Triggered by the operator's `automate it` after review.

### Flow 2 — ADO → Generate → Automate

| Prompt | What the agent does |
| ------ | ------------------ |
| `generate from <ADO-ID>` | Uses ADO MCP to fetch ticket details, pulls latest dev code, optionally reads a BRD link, synthesises BDD scenarios, writes the feature, replies "Feature generated, please review." |
| `automate it` | Executes the suite for the new feature and launches the HTML report. |

### Helper prompts

| Prompt | Effect |
| ------ | ------ |
| `show env` | Prints the loaded `.env` values. |
| `list steps` | Catalogues existing step definitions for reuse. |
| `reset recorder` | Clears in-memory recording data. |
| `set base url <url>` | Overrides the URL for the next browser launch. |

## Adding a new agent flow

1. Define the prompt phrasing and the deterministic action it triggers.
2. Add a row to the table above.
3. If the flow needs new code (a new script, a new step file), register it in [`docs/COMPONENTS.md`](COMPONENTS.md).
4. Don't duplicate the prompt list anywhere else. Skills and steering files should link here.
