# Recording Workflow

> How to capture manual user actions and convert them into a runnable BDD feature.
> The pipeline is driven by **three specialised sub-agents**. The third agent runs only after the operator approves the generated feature, so `src/pages/` and `resources/locators.json` stay clean during review.

## Pipeline at a glance

```
┌──────────────────────────────────────┐
│ recorder-agent                       │
│   pwsh ./scripts/Start-Recorder.ps1  │
│     → scripts/recorder-server.js     │
│       (normalizes IN-PROCESS — raw   │
│       JSON never hits disk)          │
└─────────────────┬────────────────────┘
                  │ writes recordings/normalized-<ts>.json
                  ▼
┌──────────────────────────────────────┐
│ exporter-agent                       │
│   scripts/convert-recording-to-      │
│   feature.js                         │
│     reuses existing steps via        │
│     resources/recorder-step-rules.   │
│     json                             │
└─────────────────┬────────────────────┘
                  │ writes features/<OperatorName>.feature
                  ▼
        ┌─────────────────────┐
        │ OPERATOR REVIEW     │
        │ feature file looks  │
        │ right? say          │
        │ "automate it"       │
        └──────────┬──────────┘
                  ▼
┌──────────────────────────────────────┐
│ automation-agent                     │
│   scripts/generate-pom-and-          │
│   locators.js                        │
└─────────────────┬────────────────────┘
                  ▼
src/pages/<Inferred>Page.ts
resources/locators.json (entries appended)
```

Two design choices to flag:

1. **Raw recordings are never persisted.** The recorder server normalizes the recorder-script payload in-process and writes a single artefact: `recordings/normalized-<ts>.json`. There is no `raw-recording-*.json` step.
2. **Stages 1 and 2 only produce review artefacts.** Source code under `src/pages/` and the locator manifest at `resources/locators.json` are only mutated by stage 3, which is gated on the operator saying `automate it`. If the operator decides the recorded feature is wrong and re-records, no source code or locator entries need to be reverted.

## Sub-agents

### 1. recorder-agent — open browser & inject script

**Owns:** `scripts/Start-Recorder.ps1` (operator entry point), `scripts/recorder-server.js`, `resources/recorder-script.js`

**Trigger prompt:** `open browser and inject recorder` (optional `<url>` overrides `BASE_URL`).

**Run command (preferred, PowerShell):**

```powershell
pwsh ./scripts/Start-Recorder.ps1                        # uses BASE_URL from config/.env.UB.dev
pwsh ./scripts/Start-Recorder.ps1 -Url https://app.ex    # explicit URL
pwsh ./scripts/Start-Recorder.ps1 -Environment qa        # uses config/.env.UB.qa
```

Or via npm (which delegates to the same PS script): `npm run recorder:start`.

**Behaviour:**

1. The PS script resolves the URL (parameter > `BASE_URL` in `config/.env.UB.<env>`) and forwards it to `scripts/recorder-server.js`.
2. The Node script launches headed Chromium, navigates to the URL, and injects `resources/recorder-script.js`. User interactions populate `window.__RECORDER_ACTIONS__`.
3. The operator types `export` in the recorder terminal. The Node script calls `window.__RECORDER_EXPORT__()`, normalizes the payload **in process** (mapping each action to the framework schema), and writes `recordings/normalized-<ts>.json`. The raw payload is never written to disk.

**Output contract — normalized JSON:**

```jsonc
{
  "metadata": {
    "source": "live-recorder",
    "createdAt": "ISO-8601",
    "url": "http://...",
    "title": "Page title"
  },
  "actions": [
    {
      "type": "click" | "input" | "change",
      "selector": "css string",
      "value": "label or filled value",
      "timestamp": "ISO",
      "metadata": { "page": "Page title or url" }
    }
  ]
}
```

**Boundaries.** The recorder agent only writes `recordings/normalized-*.json`. It does not invoke other agents, never touches `features/`, `src/pages/`, or `resources/`. Its single responsibility is "produce a normalized recording on disk".

### 2. exporter-agent — generate feature for review (reusing existing steps)

**Owns:** `scripts/convert-recording-to-feature.js`, `resources/recorder-step-rules.json`

**Trigger prompt:** `export <normalized-json-path> [<FeatureFileName>]`.

**Run command:**

```bash
npm run recorder:to-feature -- recordings/normalized-<ts>.json StudentEnquiryRecorded
```

Or with the framework-conventional `.feature` suffix included:

```bash
npm run recorder:to-feature -- recordings/normalized-<ts>.json StudentEnquiryRecorded.feature
```

When the file name is omitted, the generator slug-cases the recording's `metadata.title` and suffixes `Recorded` (`<Title>Recorded.feature`).

**Behaviour:**

1. Reads the normalized JSON.
2. Loads `resources/recorder-step-rules.json` — the operator-maintained mapping from recorded actions to existing Gherkin steps.
3. For each action, iterates the rules in declaration order and uses the first match. Rule templates support the tokens `{value}` and `{selector}`.
4. Actions that match no rule fall back to the generic steps in `src/steps/recordedSteps.ts` (`I click the element "<css>"`, `I fill the element "<css>" with "<value>"`). The generator logs each unmatched action with its type and value so the operator can extend `recorder-step-rules.json` next time.
5. Writes `features/<OperatorName>.feature` with two tags:
   - `@<OperatorName>` (a per-feature tag derived from the file name).
   - `@recording`.

**Step-reuse rules file.** `resources/recorder-step-rules.json` looks like this:

```jsonc
{
  "preconditions": [
    { "when": { "urlMatches": ".*" }, "step": "Given the application is open" }
  ],
  "rules": [
    {
      "name": "Student Management sidebar",
      "when": { "type": "click", "valueEquals": "Student Management" },
      "step": "When I navigate to the \"Student Management\" section"
    }
  ]
}
```

`when` predicates supported on a rule: `type`, `selectorContains`, `selectorMatches` (regex), `valueEquals`, `valueContains`. See `resources/recorder-step-rules.schema.json` for the full schema.

**Operator workflow when adding a new step:**

1. Author the step definition in `src/steps/<file>.ts` (per [`docs/CONVENTIONS.md`](../CONVENTIONS.md)).
2. Add a matching rule to `resources/recorder-step-rules.json`.
3. Re-run the generator on the normalized recording — the new rule will be picked up immediately.

**Output contract:**

| Path | Action |
| ---- | ------ |
| `features/<OperatorName>.feature` | created (overwritten if it exists, with a warning) |

**Does NOT:**

- Touch `src/pages/`. POMs are generated by the next agent, after operator review.
- Touch `resources/locators.json`. Locator entries are appended by the next agent.
- Touch `playwright.config.ts`. Generated tests use `recordedSteps.ts`, which is already wired up.
- Run the test suite.

**Boundaries.** The exporter agent never opens a browser. It works purely from disk: takes one normalized JSON and emits one feature file. If the normalized JSON drifts from the schema in section 1, the script fails fast.

### 3. automation-agent — generate POM + locator entries (post-review)

**Owns:** `scripts/generate-pom-and-locators.js`

**Trigger prompt:** `automate it` (after the operator has reviewed the generated `.feature` file).

**Run command:**

```bash
npm run recorder:generate-pom recordings/normalized-<ts>.json
```

**Behaviour:**

1. Reads the normalized JSON (the same file the recorder produced).
2. Generates or replaces `src/pages/<Inferred>Page.ts` extending `SelfHealingBasePage`, with healed methods derived from action types.
3. Appends entries to `resources/locators.json` for any selector that doesn't already have one. Existing entries are left untouched. Description defaults to `"Auto‑generated locator from recording"`.

**Output:**

| Path | Action |
| ---- | ------ |
| `src/pages/<Inferred>Page.ts` | created or replaced |
| `resources/locators.json` | new entries appended; existing left untouched |

**Does NOT:**

- Open a browser.
- Re-run the recorder or feature generator.
- Register the new POM in [`docs/COMPONENTS.md`](../COMPONENTS.md). That requires human review.
- Touch `playwright.config.ts`.
- Run the test suite. The orchestrator triggers `npx bddgen && npx playwright test` separately, after the POM has been reviewed.

**Boundaries.** The automation agent works purely from `recordings/normalized-<ts>.json` and emits two artefacts.

## Orchestration recipe

```
recorder-agent       (await recordings/normalized-<ts>.json)
        ↓
exporter-agent       (await features/<OperatorName>.feature)
        ↓
PAUSE → operator reviews features/<OperatorName>.feature
        ↓
operator says "automate it"
        ↓
automation-agent     (POM + locator entries)
        ↓
operator runs `npx bddgen && npx playwright test`
```

If the operator says the feature is wrong, the automation agent never runs and no source code is mutated. Suggest editing the feature, extending `recorder-step-rules.json`, or re-recording.

## Re-running stages without re-recording

The normalized JSON is the canonical input for both downstream stages. They can be re-run independently:

```bash
# regenerate just the feature with new rules / new file name
npm run recorder:to-feature -- recordings/normalized-<ts>.json StudentEnquiryRecorded

# regenerate just the POM and locators
npm run recorder:generate-pom recordings/normalized-<ts>.json
```

Re-recording is only needed when the underlying flow changes.

## Operator review checklist

After the exporter finishes (stage 2), before saying `automate it`:

1. Read `features/<OperatorName>.feature`. Are the steps semantically meaningful? Read the unmatched-action warnings the generator printed — each one is a candidate for a new entry in `resources/recorder-step-rules.json`.
2. Confirm the action sequence matches the recorded flow.
3. If the feature looks wrong, do **not** say `automate it`. Edit the feature, extend the rules, or delete and re-record. No source code has been touched.

After the automation agent finishes (stage 3):

1. Review `src/pages/<Inferred>Page.ts`. Method names are best-effort; rename them, add JSDoc `@step` annotations, consolidate similar actions.
2. Inspect new `resources/locators.json` entries. Replace generic auto-names (`div_root_div_div_2_form_…`) with namespaced slugs (`field.dropdown.admission_type`) and add a real `description` so OCR healing can kick in.
3. Register the new POM and step file in [`docs/COMPONENTS.md`](../COMPONENTS.md).

## Running only recorded scenarios

```bash
npm run test:recording
```

Filters by the `@recording` tag.

## Keeping artefacts

`recordings/` holds only normalized JSON. Commit it — it lets stages 2 and 3 be replayed deterministically without re-recording, even after the rules file changes.
