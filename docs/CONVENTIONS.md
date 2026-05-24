# Coding Conventions

> **Source of truth** for how to write code in this framework.
> If a rule changes, update this file. Other docs link here.

## Imports

- All step files import from `../core/support/base-step` — never directly from `@cucumber/cucumber` or `@playwright/test`.
- POMs extend `SelfHealingBasePage` from `../core/base/SelfHealingBasePage`.
- Use relative paths. Don't introduce path aliases unless you also configure them in `tsconfig.json` and `cucumber.js`.

## Step definitions

- Use `Given` / `When` / `Then` / `Before` / `After` from `base-step`.
- The first argument to a step callback **must use a destructuring pattern** (`{ page }` or `{}`). `playwright-bdd` parses fixture names from the source — non-destructured arguments throw at generate time.
- Type `this` as `any` in step callbacks. `playwright-bdd` types `this` as `Record<string, any>` even though the runtime value is the `TestContext` World.
- Call `testContextStorage.enterWith(this)` at the top of every step that constructs a POM.
- Keep step bodies thin — delegate logic to a POM under `src/pages/`. Steps should read like prose:
  ```typescript
  When('I navigate to the {string} section', async function (this: any, {}: any, name: string) {
      testContextStorage.enterWith(this);
      const page = new StudentEnquiryPage();
      await page.navigateToSection(name);
  });
  ```
- Add every new step file to the `require` array in `playwright.config.ts` (`defineBddConfig`) and register it in [`COMPONENTS.md`](COMPONENTS.md).

## Page Objects

- Extend `SelfHealingBasePage`. Construct with `super(testContext.page!, globalHealingEngine!)`.
- Prefer healed helpers (`clickHealed`, `fillHealed`, `selectOptionHealed`, `getTextHealed`, `forceClickHealed`, `doubleClickHealed`, etc.) over raw Playwright calls. Each takes a `locatorName` (used for healing metadata) and a `selector` (the primary attempt).
- Build resilient primary selectors. Comma-separated multi-strategy CSS often succeeds without involving healing:
  ```typescript
  const selector = [
      `label:has-text("${label}") ~ select`,
      `label:has-text("${label}") + select`,
      `[aria-label="${label}"]`,
  ].join(', ');
  ```
- Annotate methods with `@step` JSDoc tags so the Gherkin → POM mapping stays discoverable.
- Page Objects must be registered in [`COMPONENTS.md`](COMPONENTS.md).

## Locators

- Logical names live in `resources/locators.json`. Schema is `resources/locators.schema.json` (`name` + `selector` required, `description` recommended for OCR healing).
- Use namespaced slug keys (`field.dropdown.admission_type`, `sidebar.section.student_management`). Never reuse a key across pages.
- Don't hard-code selectors that are likely to change inside step files — put them in a POM and route through a healed helper.

## Hooks

- Framework-level hooks live in `src/core/support/hooks.ts`. Don't register additional `Before` / `After` from user code unless absolutely necessary.
- The `Before` hook runs the auth freshness gate (`AuthCache.ensureFresh()` + `applyToContext`) — never bypass it. See [`AUTHORING/auth-storageState.md`](AUTHORING/auth-storageState.md).

## Async, error handling, logging

- Every Playwright and healing call is `async`. Always `await`.
- Wrap healing-dependent code in `try/catch` so primary failures fall through cleanly to recovery.
- Use `logger` (re-exported from `base-step`) for general step traces. The healing engine writes its own audit events through `AuditLogger` — don't duplicate them.

## Framework vs user-defined code

- `src/core/` is framework code. Modify only when changing framework behavior; PRs touching `src/core/` should describe the framework-level rationale.
- `src/pages/`, `src/steps/`, `features/`, `resources/locators.json`: user-defined. Most test work happens here.

## Documentation responsibility

When you change the framework, update **one** doc:

| Change | Update |
| ------ | ------ |
| Add/remove top-level folder | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Add/remove POM, step file, healing strategy, core service | [`COMPONENTS.md`](COMPONENTS.md) |
| Change a coding rule, naming pattern, or hook contract | this file |
| Add/change npm scripts or env vars | [`RUNNING.md`](RUNNING.md) |
| Change recorder, healing, API, or auth workflow | the matching `AUTHORING/*.md` |
| Add an agent prompt or skill workflow | [`AGENTS.md`](AGENTS.md) |

Skill manifests in `.agent/skills/<skill>/SKILL.md` should remain thin entry points that link to a doc — never restate facts that live in `docs/`.
