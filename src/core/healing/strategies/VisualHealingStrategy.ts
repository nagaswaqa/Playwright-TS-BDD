import { Page } from '@playwright/test';
import { IHealingStrategy } from './IHealingStrategy';
export class VisualHealingStrategy implements IHealingStrategy {
    readonly name = 'VISUAL';

    constructor(resourcesPath: string = 'resources') {
    }

    async attempt(
        page: Page,
        locatorName: string,
        originalSelector: string,
        metadata?: any
    ): Promise<{ selector: string; confidence: number } | null> {
        try {
            const screenshotBuffer = await page.screenshot();
            const base64Image = screenshotBuffer.toString('base64');
            const dataUri = `data:image/png;base64,${base64Image}`;

            console.log(`[Visual Healing] Requesting healing from external API for '${locatorName}'...`);
            const apiUrl = process.env.HEALING_API_URL || 'https://self-healing-api-rxvd.onrender.com/heal';
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy: 'visual',
                    locatorName,
                    originalSelector,
                    base64Image: dataUri,
                    templateName: locatorName
                })
            });

            if (!response.ok) {
                console.warn(`[Visual Healing] External API returned ${response.status}`);
                return null;
            }

            const data = await response.json();
            if (data && data.selector) {
                return { selector: data.selector, confidence: data.confidence };
            }
        } catch (error) {
            console.warn('[Visual Healing] Unexpected error from external API', error);
        }
        return null;
    }
}
