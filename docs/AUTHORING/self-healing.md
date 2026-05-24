# Self-Healing Engine

> How the locator recovery pipeline works, how to extend it, and how to read the audit log.

## Pipeline order

When a primary selector fails, `SelfHealingBasePage.performWithHealing()` invokes `HealingEngine.heal()`. The engine first checks the cache (`resources/healing-cache.json`), then iterates strategies until one returns a healed selector:

1. **Cached** — `LocatorRepository` checks `resources/healing-cache.json` for a previously healed selector.
2. **Custom attribute** — `CustomAttributeStrategy` looks for `data-test-id` (or any attribute set via `CUSTOM_HEALING_ATTRIBUTE`) keyed off the locator name. Pure DOM, very fast.
3. **OCR** — `OcrHealingStrategy` (`tesseract.js`, **local**) reads the screenshot, fuzzy-matches the locator's `description`, returns a Playwright `text=` selector. Confidence ≥ 0.7.
4. **DOM** — `DomHealingStrategy` runs in-page heuristics: test attributes derived from the locator name, exact text, ARIA labels, role lookups, then a last-resort visible-text scan. No external calls.
5. **Visual** — `VisualHealingStrategy` (`opencv-wasm` + `jimp`, **local**) does template matching against `resources/templates/<locatorName>.png`. Confidence ≥ 0.75. No-op when the template doesn't exist.
6. **LLM** — `LlmHealingStrategy` is the last resort. Calls OpenAI's `chat.completions` API directly with `OPENAI_API_KEY`. Off (silently) when the env var is absent.

A successful repair is persisted back to `resources/locators.json` and `resources/healing-cache.json`.

## Configuring the pipeline

Strategies and their order are wired in `src/core/healing/HealingUtils.ts` (`initializeHealing()`). Pass a `HealerConfig`:

```typescript
await initializeHealing({
    enabledStrategies: ['CUSTOM_ATTR', 'OCR', 'DOM'], // skip Visual + LLM
    strategyOrder:    ['DOM', 'OCR'],                 // OCR after DOM
});
```

`hooks.ts` calls `initializeHealing()` with defaults during `BeforeAll`. Override that call only when you genuinely need to.

## Custom attribute strategy

- Default attribute set: `data-test-id`, `data-testid`, `data-test`, `data-cy`, `data-qa`.
- Override globally with `CUSTOM_HEALING_ATTRIBUTE` (comma-separated list, e.g. `CUSTOM_HEALING_ATTRIBUTE=data-qa,data-cy`).
- Confidence is fixed at 0.9 — these attributes are intended to be stable, so a match is a strong signal.

## OCR healing

- Uses `tesseract.js` locally. No external API.
- Configured for English (`eng`). For multi-language apps, instantiate with extra packs.
- Healing only succeeds when the locator's `description` field is actually present on screen as text. **Make `description` the visible label** rather than a generic engineering name.
- Common failure: low contrast or small fonts → low confidence. Improve template/font or rely on DOM healing.

## DOM healing

- Runs entirely in-process; no network.
- Heuristic order: test attributes → exact visible text → ARIA accessible name → role-based lookup → fuzzy-text scan across interactive elements.
- The locator's tail token (e.g. `field.dropdown.major` → `major`) drives role inference (`combobox` for dropdown/select, `button` for button, `link` for link, etc.).

## Visual healing

- Templates live in `resources/templates/<locatorName>.png`. Capture a clean snippet of the element (no surrounding chrome).
- Avoid visual healing for elements that change appearance often (charts, badges, animated buttons).
- If templates are missing the strategy returns immediately — no error, no cost.
- Confidence threshold: 0.75 (TM_CCOEFF_NORMED). Adjust by editing `VisualHealingStrategy.minConfidence`.

## LLM healing

- Sends Playwright's accessibility-tree snapshot (`page.locator('body').ariaSnapshot()`) plus a viewport screenshot to OpenAI. The snapshot is the same payload Microsoft's Playwright MCP server produces, computed locally so we never spawn a second browser.
- Snapshots are typically 1–3KB versus 50–500KB of HTML, so prompts stay cheap and the model produces semantic Playwright selectors (`role=button[name="Save Changes"]`, `text="..."`) instead of brittle CSS.
- Requires `OPENAI_API_KEY`. Disable globally with `LLM_HEALING_ENABLED=false`.
- Configurable via env:
  - `OPENAI_API_KEY` — required.
  - `LLM_HEALING_MODEL` — default `gpt-4o-mini`. Use `gpt-4o` for harder pages.
  - `LLM_HEALING_BASE_URL` — alternate OpenAI-compatible endpoint (e.g. an Azure proxy).
  - `LLM_HEALING_TIMEOUT_MS` — default 30000.
- The model is asked for `{ "selector": ..., "confidence": ... }`. The selector is verified on the live page before being accepted.
- Avoid using LLM healing as a primary path — it is slow and non-deterministic.

## Audit log

`AuditLogger` writes a JSON-lines file at `healing-logs/healing-audit.log`. Each entry includes:

| Field | Meaning |
| ----- | ------- |
| `timestamp` | ISO event time. |
| `locatorName` | Logical name from `locators.json`. |
| `oldSelector` | The selector that failed. |
| `newSelector` | The healed selector, or `NONE`. |
| `confidence` | 0.0 – 1.0. |
| `method` | `CUSTOM_ATTR`, `DOM`, `VISUAL`, `OCR`, `LLM`, or `NONE`. |
| `success` | Whether healing produced a working selector. |

### Reading the log

- A test that passed but felt slow → check whether a locator is constantly being healed. Update `locators.json` with the healed selector to skip recovery on the next run.
- High frequency of `OCR` healing → DOM and Visual probably need refinement; OCR is the slowest deterministic fallback.
- `success: false` with `confidence: 0` → all strategies declined. Add a clean primary selector or capture a visual template.

## Disabling at runtime

```bash
HEALING_AUDIT=false npm run test:noReport
```

This stops audit writes but does not disable the engine itself. To skip healing entirely, route actions through `BasePage` helpers (non-healed) instead of `SelfHealingBasePage` ones.

## Adding a new strategy

1. Implement `IHealingStrategy` (`src/core/healing/strategies/IHealingStrategy.ts`).
2. Register it in `HealingUtils.ts` `defaultMap`, give it a name in `StrategyName`, and place it in the default `order`.
3. Update [`docs/COMPONENTS.md`](../COMPONENTS.md) and this file with the new strategy's behavior and confidence threshold.
