import { Given, When, testContextStorage, logger } from '../core/support/base-step';

/**
 * Generic step definitions used by recorded scenarios.
 * Recorder output emits raw CSS selectors, so these steps act on the selector
 * directly rather than going through a Page Object. Promote stable flows to a
 * POM under `src/pages/` once they have been reviewed.
 */

Given('I open the application at {string}', async function (this: any, { page }: any, url: string) {
    testContextStorage.enterWith(this);
    logger.info(`>> [STEP] Open application at: ${url}`);
    await page.goto(url);
});

When('I click the element {string}', async function (this: any, { page }: any, selector: string) {
    testContextStorage.enterWith(this);
    logger.info(`>> [STEP] Click element: ${selector}`);
    await page.click(selector);
});

When('I fill the element {string} with {string}', async function (this: any, { page }: any, selector: string, value: string) {
    testContextStorage.enterWith(this);
    logger.info(`>> [STEP] Fill element: ${selector} with "${value}"`);
    await page.fill(selector, value);
});
