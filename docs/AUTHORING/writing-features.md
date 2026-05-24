# Writing Features

> Workflow guide for turning a user story into a runnable BDD scenario.

## End-to-end flow

```
business requirement
    │
    ▼
features/<name>.feature       (Gherkin, user-authored)
    │
    ▼
src/pages/<Name>Page.ts       (POM, extends SelfHealingBasePage)
    │  ▲
    │  │ uses
    │  │
    ▼  │
src/steps/<name>Steps.ts      (registered in playwright.config.ts)
    │
    ▼
resources/locators.json       (logical-name → selector entries)
    │
    ▼
npx bddgen && npx playwright test
```

## 1. Write the feature

```gherkin
@StudentEnquiry
Feature: Student enrollment intake

  Background:
    Given the application is open

  Scenario: Capture a walk-in enrollment
    When I navigate to the "Student Management" section
    When I open the "Student Details" modal
    When I select "Walk-in" from the "Admission Type" dropdown
    When I select "2026-06-15" from the "Enrollment Date" datepicker
```

## 2. Build the Page Object

Create `src/pages/StudentEnquiryPage.ts` extending `SelfHealingBasePage`. Every action goes through a `*Healed` helper so the healing engine is in the loop:

```typescript
import { SelfHealingBasePage } from '../core/base/SelfHealingBasePage';
import { testContext } from '../core/support/test-context';
import { globalHealingEngine } from '../core/healing/HealingUtils';

export class StudentEnquiryPage extends SelfHealingBasePage {
    constructor() {
        super(testContext.page!, globalHealingEngine!);
    }

    async navigateToSection(name: string): Promise<void> {
        const selector = [
            `nav.sidebar-nav a:has-text("${name}")`,
            `aside.sidebar a:has-text("${name}")`,
            `[role="link"]:has-text("${name}")`,
        ].join(', ');
        await this.clickHealed(`sidebar.section.${slug(name)}`, selector);
    }
}
```

Build resilient primary selectors (multi-strategy CSS) so even the first attempt has a chance before the healing pipeline runs.

## 3. Wire the steps

Create `src/steps/studentEnquirySteps.ts`. The first argument must use a destructuring pattern (`{}` or `{ page }`) — `playwright-bdd` parses fixture names from the source. See [`docs/CONVENTIONS.md`](../CONVENTIONS.md) for the full rules.

```typescript
import { Given, When, testContextStorage, logger } from '../core/support/base-step';
import { StudentEnquiryPage } from '../pages/StudentEnquiryPage';

When('I navigate to the {string} section', async function (
    this: any,
    {}: any,
    name: string,
) {
    testContextStorage.enterWith(this);
    logger.info(`>> [STEP] Navigate to section: ${name}`);
    const page = new StudentEnquiryPage();
    await page.navigateToSection(name);
});
```

## 4. Register the step file

Add `'src/steps/studentEnquirySteps.ts'` to the `require` array in `playwright.config.ts` (`defineBddConfig`). Otherwise the steps will not load.

## 5. Seed locators

Add entries to `resources/locators.json` for every logical name you used. The `description` field powers OCR-based healing — make it match visible text on screen.

```json
"sidebar.section.student_management": {
    "name": "Sidebar: Student Management",
    "selector": "nav.sidebar-nav a:has-text(\"Student Management\")",
    "description": "Sidebar link that opens the Student Management section"
}
```

## 6. Hybrid UI + API

Use `RestApiClient` (re-exported by `base-step`) and `testContext` to share data between API and UI steps:

```typescript
const client = new RestApiClient(request);
const response = await client.get('/api/students/123');
this.setValue('studentId', (await response.json()).id);

// later, in a UI step:
const id = this.getValue('studentId');
await page.fill('#student-id', id);
```

## 7. Run

```bash
npx bddgen
npx playwright test
```

See [`docs/RUNNING.md`](../RUNNING.md) for environment-specific commands.

## 8. Update docs

- Register the new POM and step file in [`docs/COMPONENTS.md`](../COMPONENTS.md).

---

`slug()` here is a small helper that lowercases and replaces non-alphanumerics with `_`; copy from `StudentEnquiryPage` for now.


## Recorded features

Captures produced by the recording pipeline (see [`recording-workflow.md`](recording-workflow.md)) follow the same conventions as hand-authored features, with a few generator-specific rules:

- **Filename.** `features/<Name>Recorded.feature`. The operator supplies `<Name>` as the second positional arg to `recorder:to-feature` (e.g. `StudentEnquiry`). The generator appends the `Recorded` suffix automatically and accepts either form. There is no automatic naming from the page title — slugifying titles produces nonsense like `1CampusStudentInformationSystem`.
- **Tags.** Two are emitted: a functional `@<Name>` tag (e.g. `@StudentEnquiry`) and the framework-wide `@recording` tag.
- **Background.** When `Given the application is open` is registered as a step, the generator uses it (this picks up the cached login bypass). Otherwise the generator falls back to `Given I open the application at "<url>"`.
- **Strict step matching by default.** The generator only emits high-level steps mapped from `resources/recorder-step-rules.json`. If any recorded action has no matching rule, the generator refuses to write the feature, prints the unmatched actions, and exits non-zero. The operator either:
  - Adds a step definition under `src/steps/` and a matching rule to `recorder-step-rules.json`, then re-runs; or
  - Re-records to avoid the unmapped action; or
  - For genuinely throwaway spike work, re-runs with `--allow-fallback` to accept generic `I click the element "<css>"` / `I fill the element "<css>" with "<value>"` steps. **Generic steps bypass the self-healing pipeline because the selector lives in the Gherkin instead of `resources/locators.json` — never use `--allow-fallback` for production captures.**
- **No clobber.** If `<Name>Recorded.feature` already exists the generator writes a timestamped sibling (`<Name>Recorded.<yyyyMMddHHmmss>.feature`) and warns. Pass `--force` to overwrite. Hand-curated features stay safe by default.

Example minimum-viable recorded feature (matches the canonical `StudentEnquiryRecorded.feature`):

```gherkin
@StudentEnquiry
@recording
Feature: 1 Campus Student Information System

  Background:
    Given the application is open

  Scenario: Recorded user flow
    When I navigate to the "Student Management" section
    When I open the "Student Details" modal
    When I select "Walk-in" from the "Admission Type" dropdown
    When I select "2026-06-15" from the "Enrollment Date" datepicker
```

The generator targets exactly this shape. If you want to change the layout (extra tags, scenario outlines, separate recipes per page), update this section first and adjust `scripts/convert-recording-to-feature.js` to match — never the other way around.
