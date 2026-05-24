---
name: page-object-model-playwright
description: Page Object Model layout with self-healing locator support.
---

# Page Object Model Skill

Use this skill when adding or modifying Page Objects.

## Rules in one line

POMs extend `SelfHealingBasePage`, construct with `super(testContext.page!, globalHealingEngine!)`, and prefer `*Healed` helpers over raw Playwright calls.

## Canonical references

- [`docs/CONVENTIONS.md`](../../../docs/CONVENTIONS.md) — POM rules and locator naming.
- [`docs/AUTHORING/writing-features.md`](../../../docs/AUTHORING/writing-features.md) — example POM.
- [`docs/COMPONENTS.md`](../../../docs/COMPONENTS.md) — `BasePage`, `SelfHealingBasePage`, registered POMs.
