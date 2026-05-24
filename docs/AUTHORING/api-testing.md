# API Testing

> How to combine API and UI calls in the same scenario.

## What you have

- `src/core/api/RestApiClient.ts` — wrapper around Playwright's `request` context.
- `src/core/support/base-step.ts` re-exports `RestApiClient` so step files can pull it from a single import.
- `testContext` (`src/core/support/test-context.ts`) carries scenario-scoped data via `setValue` / `getValue`.

## Pattern

```typescript
import { Given, When, testContext, RestApiClient } from '../core/support/base-step';

When('I create a student via API', async function (this: any, { request }: any) {
    testContextStorage.enterWith(this);
    const client = new RestApiClient(request);
    const response = await client.post('/api/students', {
        data: { name: 'Test Student' },
    });
    expect(response.status()).toBe(201);
    this.setValue('studentId', (await response.json()).id);
});

Then('I should see the new student in the UI', async function (this: any, { page }: any) {
    testContextStorage.enterWith(this);
    const id = this.getValue('studentId');
    await page.goto(`/students/${id}`);
    await expect(page.locator('h1')).toContainText('Test Student');
});
```

## Worker-scoped vs scenario-scoped data

- **Scenario-scoped** (`this.setValue` / `this.getValue`) — cleared after each scenario. Use for IDs, tokens, response payloads tied to one test.
- **Worker-scoped** (`this.workerState[key] = value`) — persists across scenarios in the same worker. Use sparingly, for genuinely shared state like a one-time auth token. Be aware that scenario isolation suffers when state leaks across tests.

## Tips

- Don't construct a fresh `RestApiClient` in every step if you can avoid it; build it once per scenario in a `Before` hook and stash it on `this`.
- Validate response shape early — failures inside JSON parsing are easier to read at the API call site than three steps later.
- Keep API-only steps in their own file. Mixed steps (`*-steps.ts`) work but tend to grow into a kitchen sink.

See also: [`docs/CONVENTIONS.md`](../CONVENTIONS.md) for step authoring rules and [`docs/COMPONENTS.md`](../COMPONENTS.md) for the `RestApiClient` registration.
