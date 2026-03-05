import { Page } from '@playwright/test';
import { IHealingStrategy } from './IHealingStrategy';

export class DomHealingStrategy implements IHealingStrategy {
    readonly name = 'DOM';

    async attempt(
        page: Page,
        locatorName: string,
        originalSelector: string,
        metadata?: any
    ): Promise<{ selector: string; confidence: number } | null> {
        try {
            const html = await page.content();

            console.log(`[DOM Healing] Requesting healing from external API for '${locatorName}'...`);
            const apiUrl = process.env.HEALING_API_URL || 'https://self-healing-api-rxvd.onrender.com/heal';
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy: 'dom',
                    locatorName,
                    originalSelector,
                    html
                })
            });

            if (!response.ok) {
                console.warn(`[DOM Healing] External API returned ${response.status}`);
                return null;
            }

            const data = await response.json();
            if (data && data.selector) {
                // Verify the healed selector works in the current page
                try {
                    await page.waitForSelector(data.selector, { state: 'attached', timeout: 1000 });
                    return { selector: data.selector, confidence: data.confidence };
                } catch {
                    console.warn(`[DOM Healing] Healed selector '${data.selector}' failed verification.`);
                }
            }

            return null;
        } catch (error) {
            console.warn('[DOM Healing] Error contacting external healing API:', error);
            return null;
        }
    }
}
