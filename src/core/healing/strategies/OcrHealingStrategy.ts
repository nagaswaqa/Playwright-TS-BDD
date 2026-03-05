import { Page } from '@playwright/test';
import { IHealingStrategy } from './IHealingStrategy';
export class OcrHealingStrategy implements IHealingStrategy {
    readonly name = 'OCR';

    constructor() {
    }

    async attempt(
        page: Page,
        locatorName: string,
        originalSelector: string,
        metadata?: any
    ): Promise<{ selector: string; confidence: number } | null> {
        try {
            const searchText = metadata?.ocrText || metadata?.description || locatorName || originalSelector;
            const screenshotBuffer = await page.screenshot();
            const base64Image = screenshotBuffer.toString('base64');
            const dataUri = `data:image/png;base64,${base64Image}`;

            console.log(`[OCR Healing] Requesting healing from external API for '${locatorName}'...`);
            const apiUrl = process.env.HEALING_API_URL || 'https://self-healing-api-rxvd.onrender.com/heal';
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy: 'ocr',
                    locatorName,
                    originalSelector,
                    base64Image: dataUri,
                    expectedText: searchText
                })
            });

            if (!response.ok) {
                console.warn(`[OCR Healing] External API returned ${response.status}`);
                return null;
            }

            const data = await response.json();
            if (data && data.selector) {
                return { selector: data.selector, confidence: data.confidence };
            }
        } catch (error) {
            console.warn('[OCR Healing] Failed to extract text via external API', error);
        }
        return null;
    }
}
