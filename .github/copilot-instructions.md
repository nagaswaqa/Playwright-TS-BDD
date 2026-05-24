# GitHub Copilot Instructions

You are an expert software engineer working in a Playwright + TypeScript + BDD (`playwright-bdd`) framework with a self-healing locator engine.

## Where to look first

Before generating or modifying code, consult the canonical docs (each declares what it owns):

- [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) — directory layout and runtime pipeline.
- [`docs/COMPONENTS.md`](../docs/COMPONENTS.md) — every POM, step file, healing strategy, and core service in the project.
- [`docs/CONVENTIONS.md`](../docs/CONVENTIONS.md) — coding rules (imports, step signatures, POM patterns, locator naming).
- [`docs/RUNNING.md`](../docs/RUNNING.md) — npm scripts and environment variables.
- [`docs/AUTHORING/writing-features.md`](../docs/AUTHORING/writing-features.md) — full feature → POM → step lifecycle.
- [`docs/AUTHORING/self-healing.md`](../docs/AUTHORING/self-healing.md) — healing pipeline and audit log.
- [`docs/AUTHORING/auth-storageState.md`](../docs/AUTHORING/auth-storageState.md) — cached login flow.
- [`docs/AGENTS.md`](../docs/AGENTS.md) — skill registry and agent prompts.

If a fact is in those docs, do not restate it here — link to it. If a fact is not in those docs and is needed, add it to the appropriate canonical doc and reference it.

## Hard rules

1. **Step callback signature.** The first argument must be a destructuring pattern (`{}` or `{ page, request, ... }`). `playwright-bdd` parses fixture names from the source. Type `this` as `any`.
2. **Import surface.** Step files import `Given` / `When` / `Then` / `Before` / `After` / `BeforeAll` / `AfterAll` / `testContext` / `testContextStorage` / `RestApiClient` / `expect` / `logger` / `test` from `../core/support/base-step`. Never import directly from `@cucumber/cucumber` or `@playwright/test`.
3. **POM base class.** All page objects extend `SelfHealingBasePage` and construct with `super(testContext.page!, globalHealingEngine!)`. Use the `*Healed` helpers (`clickHealed`, `fillHealed`, `selectOptionHealed`, …) instead of raw Playwright calls.
4. **Locators.** Logical names live in `resources/locators.json`, keyed by namespaced slugs (e.g., `field.dropdown.admission_type`). Each entry needs `name` and `selector`; add a `description` to enable OCR healing.
5. **Hooks.** Don't add `Before` / `After` from user code. The framework's `Before` runs the auth freshness gate — bypassing it breaks long suites.
6. **Singleton-Page-per-worker.** Don't create extra browser contexts in tests. The `fixtures.ts` worker-scoped fixtures already handle that.
7. **Documentation responsibility.** When you add or change a Page Object, step file, healing strategy, npm script, env var, or agent prompt, update the canonical doc that owns it (table at the bottom of `docs/CONVENTIONS.md`). Do not duplicate facts across files.

## When the user asks you to add code

- New POM → create under `src/pages/`, register in [`docs/COMPONENTS.md`](../docs/COMPONENTS.md).
- New step file → create under `src/steps/`, add to the `require` array in `playwright.config.ts`, register in [`docs/COMPONENTS.md`](../docs/COMPONENTS.md).
- New healing strategy → implement `IHealingStrategy`, register in `HealingUtils.ts` and in [`docs/AUTHORING/self-healing.md`](../docs/AUTHORING/self-healing.md) + [`docs/COMPONENTS.md`](../docs/COMPONENTS.md).
- New npm script or env var → update [`docs/RUNNING.md`](../docs/RUNNING.md).

## Coding standards

- TypeScript with explicit types on parameters, members, and return values.
- Async/await for every Playwright and healing call.
- Wrap healing-dependent code in `try/catch` so primary failures fall through to recovery.
- Use `logger` for trace, `AuditLogger` is owned by the healing engine — don't write to it from user code.
- Framework code lives under `src/core/`. Modify it only when the change is genuinely framework-level.
