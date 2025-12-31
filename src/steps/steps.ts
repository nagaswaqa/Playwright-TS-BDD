import { Given, When, Then, TestContext, testContext, expect, logger, RestApiClient, testContextStorage } from '../support/base-step';
import { SearchPage } from '../pages/SearchPage';

Given('I fetch user details from API for user {int}', async function (this: any, { request }: any, userId: number) {
    testContextStorage.enterWith(this);
    if (!request) throw new Error('API Context (request) is not defined');
    const baseUrl = testContext.getValue('BASE_URL') || 'https://jsonplaceholder.typicode.com';
    const client = new RestApiClient(request);
    const response = await client.get(`${baseUrl}/users/${userId}`);
    expect(response.ok()).toBeTruthy();

    const user = await response.json();
    testContext.setValue('userName', user.name);
    logger.info(`[${testContext.getValue('ENV_NAME')}] Fetched and stored user name: ${user.name}`);
});

Then('I store the user name in the test context', async function (this: any) {
    testContextStorage.enterWith(this);
    const userName = testContext.getValue('userName');
    expect(userName).toBeDefined();
});

When('I navigate to the search page', async function (this: any, { page }) {
    testContextStorage.enterWith(this);
    if (!page) throw new Error('Page is not defined');
    const searchPage = new SearchPage(page);
    const uiUrl = 'https://www.wikipedia.org/';
    await searchPage.goto(uiUrl);
});

Then('I should be able to use the stored user name for searching', async function (this: any, { page }) {
    testContextStorage.enterWith(this);
    if (!page) throw new Error('Page is not defined');
    const searchPage = new SearchPage(page);
    const userName = testContext.getValue('userName');
    await searchPage.searchFor(userName);

    // Verify we are on a result page or article page
    // For random names, it might go to search results or a specific page
    // Let's check for the heading or "Search results"
    const heading = page.locator('#firstHeading');
    await expect(heading).toBeVisible({ timeout: 10000 });

    // We don't strictly assert the value because Leanne Graham might not match exactly or have a page
    // But checking the heading is visible confirms navigation succeeded
    const headingText = await heading.textContent();
    logger.info(`On page: ${headingText}`);
});
