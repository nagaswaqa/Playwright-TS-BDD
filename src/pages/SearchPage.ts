import { BasePage } from './BasePage';
import { logger } from '../support/logger';

export class SearchPage extends BasePage {
    private readonly searchInput = 'input#searchInput';

    async goto(url: string) {
        logger.info(`Navigating to search page: ${url}`);
        await this.navigateTo(url);
    }

    async searchFor(text: string) {
        logger.info(`Searching for text: ${text}`);
        const input = this.page.locator(this.searchInput);
        await input.fill(text);

        // Wikipedia search button
        const searchButton = this.page.locator('button.pure-button');
        if (await searchButton.isVisible()) {
            await searchButton.click();
        } else {
            await input.press('Enter');
        }

        // Wait for results page to load
        try {
            // Wikipedia redirects to the article page, e.g. /wiki/Leanne_Graham
            // Or a search results page
            await this.page.waitForURL(/.*(wikipedia\.org\/wiki\/|w\/index\.php).*/, { timeout: 10000 });
        } catch (e) {
            logger.warn(`Results page wait timed out. Current URL: ${this.page.url()}`);
        }
    }
}
