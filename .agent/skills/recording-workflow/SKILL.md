---
name: recording-workflow-agent
description: Three-stage recording pipeline (recorder → exporter → automation). The third stage is gated on operator approval of the generated feature.
---

# Recording Workflow Skill

The recording flow is split across three specialised sub-agents. Stages 1 and 2 produce review-only artefacts (raw JSON, normalized JSON, `.feature`). Stage 3 is the only one that mutates source code (`src/pages/`) or the locator manifest (`resources/locators.json`), and runs only after the operator approves the generated feature with `automate it`.

## Pipeline at a glance

```
┌────────────────────────────┐
│ 1. Recorder Agent          │  invokes scripts/recorder-server.js
│    open browser, inject    │
│    recorder-script.js      │
└──────────────┬─────────────┘
               │ writes recordings/raw-recording-<ts>.json
               ▼
┌────────────────────────────┐
│ 2. Exporter Agent          │  invokes scripts/normalize-recording.js
│    normalize raw JSON,     │  then scripts/convert-recording-to-feature.js
│    generate feature for    │
│    operator review         │
└──────────────┬─────────────┘
               │ writes normalized JSON + feature file
               ▼
        operator review →
        say "automate it"
               │
               ▼
┌────────────────────────────┐
│ 3. Automation Agent        │  invokes scripts/generate-pom-and-locators.js
│    generate POM + locator  │
│    entries from approved   │
│    feature                 │
└────────────────────────────┘
```

All contracts and prompts are documented in [`docs/AUTHORING/recording-workflow.md`](../../../docs/AUTHORING/recording-workflow.md). Always read the canonical doc before invoking a stage.

## Sub-agents

| Sub-agent | Owns | Trigger prompt | Input | Output |
| --------- | ---- | -------------- | ----- | ------ |
| `recorder-agent` | `scripts/recorder-server.js` + `resources/recorder-script.js` | `open browser and inject recorder` | Optional URL or `BASE_URL` from `.env.UB.<env>` | `recordings/raw-recording-<ts>.json` |
| `exporter-agent` | `scripts/normalize-recording.js` + `scripts/convert-recording-to-feature.js` | `export <raw-json>` | `recordings/raw-recording-<ts>.json` | `recordings/normalized-<ts>.json`, `features/recorded-<ts>.feature` |
| `automation-agent` | `scripts/generate-pom-and-locators.js` | `automate it` (after operator approves the feature file) | `recordings/normalized-<ts>.json` | `src/pages/<Inferred>Page.ts`, new entries in `resources/locators.json` |

## Sub-agent details

### 1. recorder-agent

**Purpose.** Open an embedded Chromium, navigate to the target URL, and inject `resources/recorder-script.js` so user actions are captured into `window.__RECORDER_ACTIONS__`.

**Trigger prompt:** `open browser and inject recorder` (optional `<url>` arg overrides `BASE_URL`).

**What it does:**

1. Reads `BASE_URL` from `config/.env.UB.<env>` (or accepts a CLI arg / agent argument).
2. Runs `npm run recorder:start [<url>]` (which executes `node scripts/recorder-server.js`).
3. Waits for the human to type `export` in the terminal. The script then calls `window.__RECORDER_EXPORT__()` and writes the raw JSON to `recordings/raw-recording-<ts>.json`.

**Output contract — raw JSON:**

```jsonc
{
  "metadata": {
    "url": "http://...",
    "title": "Page title",
    "exportedAt": "ISO-8601 timestamp"
  },
  "actions": [
    { "timestamp": "ISO", "type": "click" | "input" | "change", "selector": "css", "label": "visible text or value" }
  ]
}
```

**Stops when:** the export file is written. Hands off the path to the exporter agent.

### 2. exporter-agent

**Purpose.** Take the raw recording from disk and produce review artefacts: a normalized JSON and a Gherkin `.feature` file. Source code and locator metadata stay untouched until the operator approves.

**Trigger prompt:** `export <raw-json-path>`.

**What it does — runs two scripts back-to-back:**

1. **Normalize.** Invokes `scripts/normalize-recording.js <raw-json>`.
   - Maps each `action` to the framework schema (`{ type, selector, value, timestamp, metadata: { page } }`).
   - Wraps with a `metadata` block (`source`, `createdAt`, `url`, `title`).
   - Writes `recordings/normalized-<ts>.json`.
2. **Generate feature.** Invokes `scripts/convert-recording-to-feature.js <normalized-json>` against the file just produced.
   - Writes `features/recorded-<ts>.feature` (`@recording @recorded` tags, `Background` with inferred preconditions, one `Scenario` mapping to `recordedSteps.ts` steps).

If step 1 errors the agent halts — it never invokes step 2 against a missing or malformed normalized file.

**Output contract:**

| Path | Action |
| ---- | ------ |
| `recordings/normalized-<ts>.json` | created |
| `features/recorded-<ts>.feature` | created |

**Normalized JSON schema (intermediate artefact, not throwaway):**

```jsonc
{
  "metadata": {
    "source": "recordings/raw-recording-<ts>.json",
    "createdAt": "ISO-8601",
    "url": "http://...",
    "title": "Page title"
  },
  "actions": [
    {
      "type": "click" | "input" | "change",
      "selector": "css",
      "value": "label or filled value",
      "timestamp": "ISO",
      "metadata": { "page": "Page title or url" }
    }
  ]
}
```

**Does NOT:**

- Touch `src/pages/`. POMs are generated by the automation agent, after operator review.
- Touch `resources/locators.json`. Locator entries are appended by the automation agent.
- Touch `playwright.config.ts`. Generated tests use `recordedSteps.ts`, which is already wired up.
- Run the test suite.

**Stops when:** the feature file is written. Hands off control to the operator for review.

### 3. automation-agent

**Purpose.** Once the operator approves the generated `.feature` file, scaffold the supporting Page Object and append any missing locator entries.

**Trigger prompt:** `automate it`.

**What it does:**

1. Reads the same `recordings/normalized-<ts>.json` the exporter produced.
2. Generates / replaces `src/pages/<Inferred>Page.ts` extending `SelfHealingBasePage`, with healed methods derived from action types.
3. Reads `resources/locators.json` directly (the script intentionally avoids requiring the TypeScript `LocatorRepository` from a Node script). For every selector seen, appends a logical-name entry if one doesn't already exist. Existing entries are left untouched.

Implementation: `scripts/generate-pom-and-locators.js`. Run via `npm run recorder:generate-pom <normalized-json>`.

**Output contract:**

| Path | Action |
| ---- | ------ |
| `src/pages/<Inferred>Page.ts` | created or replaced |
| `resources/locators.json` | new entries appended; existing entries untouched |

**Does NOT:**

- Open a browser.
- Read the raw recording (it works only from the normalized JSON).
- Register the POM in [`docs/COMPONENTS.md`](../../../docs/COMPONENTS.md).
- Touch `playwright.config.ts`.
- Run the test suite.

**Stops when:** the POM file is written. Hands off control to the operator to review the POM, register it, then run `npx bddgen && npx playwright test` manually.

## Orchestration recipe (full pipeline)

When the operator asks for the entire flow, run sub-agents in order with a hard gate on operator approval:

1. **recorder-agent.** Wait until the raw file exists.
2. **exporter-agent.** Pass the raw path. Internally normalizes, then writes the feature file. **STOP** — surface the feature file path and ask the operator to review it.
3. **operator says `automate it`.** Only then run **automation-agent** with the normalized path.

If the operator says the feature is wrong, do not run the automation agent. Suggest editing the feature or re-recording. Because stages 1 and 2 never touch `src/pages/` or `resources/locators.json`, no clean-up is needed — the workspace stays clean.

## Boundaries between sub-agents

- The recorder agent only writes `recordings/raw-recording-*.json`.
- The exporter agent only writes `recordings/normalized-*.json` and `features/recorded-*.feature`.
- The automation agent only writes `src/pages/<Inferred>Page.ts` and entries in `resources/locators.json`.

If a feature change crosses a boundary (for example, "make the exporter generate the POM directly"), update [`docs/AUTHORING/recording-workflow.md`](../../../docs/AUTHORING/recording-workflow.md) and this skill rather than blurring contracts in code.

## Canonical references

- [`docs/AUTHORING/recording-workflow.md`](../../../docs/AUTHORING/recording-workflow.md) — full pipeline and operator instructions.
- [`docs/AGENTS.md`](../../../docs/AGENTS.md) — Flow 1 prompts.
- [`docs/COMPONENTS.md`](../../../docs/COMPONENTS.md) — `recordedSteps.ts`, `SelfHealingBasePage`.
