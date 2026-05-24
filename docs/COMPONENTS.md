# Component Map

> **Source of truth** for individual files in the framework.
> Whenever you add a Page Object, step file, healing strategy, or top-level service, update this map.

## Page Objects (`src/pages/`)

| Component | File | Purpose |
| --------- | ---- | ------- |
| `LoginPage` | [src/pages/LoginPage.ts](../src/pages/LoginPage.ts) | Demo SIS credential-less login bypass. Exports `LOGIN_BYPASS_SEQUENCE` and `DASHBOARD_READY_SELECTOR` for `AuthCache`. |
| `StudentEnquiryPage` | [src/pages/StudentEnquiryPage.ts](../src/pages/StudentEnquiryPage.ts) | Student Information System flow (sidebar nav, modal, dropdown, datepicker) with healed actions. |

## Step definitions (`src/steps/`)

| Component | File | Purpose |
| --------- | ---- | ------- |
| `recordedSteps.ts` | [src/steps/recordedSteps.ts](../src/steps/recordedSteps.ts) | Generic steps used by recorded scenarios (`I open the application at`, `I click the element`, `I fill the element`). |
| `studentEnquirySteps.ts` | [src/steps/studentEnquirySteps.ts](../src/steps/studentEnquirySteps.ts) | High-level Student Enquiry steps backed by `StudentEnquiryPage` and `LoginPage`. |

> Every new step file must be added to the `require` array in `playwright.config.ts` (`defineBddConfig`), otherwise its steps will not load.

## Core services (`src/core/`)

| Component | File | Purpose |
| --------- | ---- | ------- |
| `BasePage` | `src/core/base/BasePage.ts` | Abstract Playwright `Page` wrapper with navigation, locator, interaction, wait, and screenshot helpers. |
| `SelfHealingBasePage` | `src/core/base/SelfHealingBasePage.ts` | Adds `*Healed` helpers (`clickHealed`, `fillHealed`, `getTextHealed`, etc.) plus the `performWithHealing` orchestrator. |
| `RestApiClient` | `src/core/api/RestApiClient.ts` | Wrapper around Playwright `request` for hybrid API+UI steps. Re-exported by `base-step`. |
| `AuthCache` | `src/core/auth/AuthCache.ts` | Single source of truth for cached `storageState`. Exposes `isFresh`, `ensureFresh`, `refresh`, `applyToContext`. 29-min TTL. |
| `HealingEngine` | `src/core/healing/HealingEngine.ts` | Orchestrates healing strategies. |
| `LocatorRepository` | `src/core/healing/LocatorRepository.ts` | Loads `resources/locators.json`, persists healed selectors, manages `healing-cache.json`. |
| `AuditLogger` | `src/core/healing/AuditLogger.ts` | Writes healing events with confidence scores to `healing-logs/healing-audit.log`. |
| `HealingReporter` | `src/core/healing/HealingReporter.ts` | Generates JSON and HTML reports from the audit log. |
| `HealingUtils` | `src/core/healing/HealingUtils.ts` | `initializeHealing()` (called from `BeforeAll`), `globalHealingEngine`, helpers. |
| `SelfHealingPage` | `src/core/healing/SelfHealingPage.ts` | Page-level wrapper used internally by POMs. |

## Healing strategies (`src/core/healing/strategies/`)

| Strategy | File | When it runs |
| -------- | ---- | ------------ |
| `IHealingStrategy` | `IHealingStrategy.ts` | Interface contract. |
| `DomHealingStrategy` | `DomHealingStrategy.ts` | First. Tries DOM-based recovery (alternate attributes, structural neighbours). |
| `VisualHealingStrategy` | `VisualHealingStrategy.ts` | Second. Image template match with `opencv-wasm` + `jimp`. Confidence ≥ 0.75 to succeed. |
| `OcrHealingStrategy` | `OcrHealingStrategy.ts` | Third. `tesseract.js` reads the screenshot, fuzzy-matches the locator's `description`. Confidence ≥ 0.7. |
| `CustomAttributeStrategy` | `CustomAttributeStrategy.ts` | Custom attribute lookups configured by the team. |
| `LlmHealingStrategy` | `LlmHealingStrategy.ts` | Last resort. GPT-4o vision call. Requires an external endpoint (currently unconfigured by default). |

## BDD support (`src/core/support/`)

| File | Role |
| ---- | ---- |
| `base-step.ts` | The single import surface for step files. Re-exports `Given`, `When`, `Then`, `Before`, `After`, `BeforeAll`, `AfterAll`, `testContext`, `testContextStorage`, `RestApiClient`, `expect`, `logger`, `test`. |
| `test-context.ts` | `TestContext` (Cucumber `World`), `testContextStorage` (`AsyncLocalStorage`), proxy `testContext` for ambient access from POMs. |
| `fixtures.ts` | Singleton-Page-per-worker fixture overrides. Loads `.auth/user.json` as `storageState` when present. |
| `hooks.ts` | `BeforeAll` config logging + healing init. `Before` runs the auth freshness gate, enters context storage, attaches Playwright `page`/`context`/`request`. `After` captures a screenshot on failure. |
| `logger.ts` | `log4js` wrapper. |

## Setup (`src/setup/`)

| File | Role |
| ---- | ---- |
| `global-setup.ts` | Playwright `globalSetup`. Delegates to `AuthCache.ensureFresh()`. |

## Security testing (`scripts/`, `resources/`)

| Component | File | Purpose |
| --------- | ---- | ------- |
| `Start-Zap.ps1` | `scripts/Start-Zap.ps1` | Boots OWASP ZAP in Docker as a daemon, persists session metadata to `.zap/session.json`. |
| `Stop-Zap.ps1` | `scripts/Stop-Zap.ps1` | Generates HTML+JSON reports under `reports/security/`, stops the container, applies the `-FailOn` severity gate. |
| `Test-WithZap.ps1` | `scripts/Test-WithZap.ps1` | Lifecycle wrapper: start → bddgen → playwright test → stop. Backs `npm run test:security`. |
| `zap-baseline.conf` | `resources/zap-baseline.conf` | Operator-curated suppression list (one alert id per line + tab-separated rationale). |

See [`docs/AUTHORING/security-testing.md`](AUTHORING/security-testing.md) for the operator workflow. Worker-context proxy wiring lives in `src/core/support/fixtures.ts` and `config/testConfig.ts` (`zapProxyEnabled`, `zapProxyHost`, `zapProxyPort`).

## Configuration (`config/`)

| File | Role |
| ---- | ---- |
| `testConfig.ts` | Master config. Resolves `ENV` against the registry, loads `.env.UB.<env>`, exposes `browser`, `headless`, `workers`, `viewport`, `enableHealingAudit`, `baseUrl`. |
| `environments.ts` | Registry of supported environments (`dev`, `qa`, `uat`, `staging`, `prod`). |
| `.env.UB.<env>` | Per-environment variables. Auto-created if missing. |

## Resources (`resources/`)

| File | Role |
| ---- | ---- |
| `locators.json` | Logical-name → selector map. Healed selectors are written back here. |
| `locators.schema.json` | JSON Schema validation for `locators.json` entries. |
| `healing-cache.json` | Runtime cache of healed selectors (read first by the engine). |
| `recorder-script.js` | Browser-side script injected by `recorder-server.js`. |

## Locator entry shape

Every entry in `resources/locators.json` must conform to `resources/locators.schema.json`:

```json
"field.dropdown.admission_type": {
    "name": "Dropdown: Admission Type",
    "selector": "label:has-text(\"Admission Type\") ~ select",
    "description": "Admission Type dropdown inside the Student Details modal"
}
```

`name` and `selector` are required. `description` powers OCR-based healing — when present, it should match the visible text on screen.
