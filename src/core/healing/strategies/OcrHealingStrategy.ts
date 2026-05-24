import { Page } from '@playwright/test';
import { IHealingStrategy } from './IHealingStrategy';
import { LocatorData } from '../LocatorRepository';

let cachedTesseract: any = null;
let tesseractInitFailed = false;

async function loadTesseract() {
    if (cachedTesseract || tesseractInitFailed) return cachedTesseract;
    try {
        const mod = await import('tesseract.js');
        cachedTesseract = (mod as any).default || mod;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[OCR Healing] tesseract.js unavailable: ${message}. Strategy will skip.`);
        tesseractInitFailed = true;
    }
    return cachedTesseract;
}

/**
 * OCR healing strategy — local, no external API.
 *
 * Uses `tesseract.js` to read on-screen text from a page screenshot, then
 * fuzzy-matches the captured words against the locator's description (or the
 * locator name when no description is set). When a sufficiently confident
 * match is found, returns a Playwright `text=...` selector centred on the
 * matched word/phrase.
 *
 * Confidence is a blend of:
 *   - Tesseract's own per-word confidence (0–100, normalised to 0–1).
 *   - The fraction of description-words found in the OCR result.
 *
 * Strategy returns null when:
 *   - tesseract.js is missing or fails to initialise.
 *   - the locator has neither a description nor a useful name.
 *   - confidence is below 0.7.
 */
export class OcrHealingStrategy implements IHealingStrategy {
    readonly name = 'OCR';

    private readonly minConfidence = 0.7;

    async attempt(
        page: Page,
        locatorName: string,
        originalSelector: string,
        metadata?: LocatorData,
    ): Promise<{ selector: string; confidence: number } | null> {
        const phrase = pickPhrase(locatorName, metadata);
        if (!phrase) return null;

        const tesseract = await loadTesseract();
        if (!tesseract || typeof tesseract.recognize !== 'function') {
            return null;
        }

        let buffer: Buffer;
        try {
            buffer = await page.screenshot({ fullPage: false });
        } catch (err) {
            console.warn('[OCR Healing] Screenshot failed:', err);
            return null;
        }

        let recognition: any;
        try {
            recognition = await tesseract.recognize(buffer, 'eng');
        } catch (err) {
            console.warn('[OCR Healing] Tesseract recognition failed:', err);
            return null;
        }

        const words: Array<{ text: string; confidence: number }> = (
            recognition?.data?.words || []
        )
            .map((w: any) => ({ text: String(w?.text || '').trim(), confidence: Number(w?.confidence) || 0 }))
            .filter((w: { text: string }) => w.text.length > 0);

        if (!words.length) return null;

        const haystack = words.map((w) => w.text).join(' ').toLowerCase();
        const phraseLower = phrase.toLowerCase();
        const phraseWords = phraseLower.split(/\s+/).filter(Boolean);

        // Fraction of description words present in the OCR text.
        const matchedWords = phraseWords.filter((w) => haystack.includes(w));
        const wordCoverage = matchedWords.length / Math.max(1, phraseWords.length);
        if (wordCoverage < 0.5) return null;

        // Average tesseract confidence across the matched words.
        const matched = words.filter((w) =>
            phraseWords.some((needle) => w.text.toLowerCase().includes(needle)),
        );
        const avgTesseract = matched.length
            ? matched.reduce((acc, w) => acc + w.confidence, 0) / matched.length / 100
            : 0;

        const confidence = Math.min(1, (wordCoverage * 0.6) + (avgTesseract * 0.4));
        if (confidence < this.minConfidence) return null;

        // If the page actually contains the literal phrase as visible text, a
        // text= selector will resolve cleanly. Otherwise return the longest
        // matched word that exists on the page.
        const candidates: string[] = [];
        if (haystack.includes(phraseLower)) {
            candidates.push(buildTextSelector(phrase));
        }
        const longestMatchedWord = matched
            .map((w) => w.text)
            .filter(Boolean)
            .sort((a, b) => b.length - a.length)[0];
        if (longestMatchedWord) {
            candidates.push(buildTextSelector(longestMatchedWord));
        }

        for (const sel of candidates) {
            const ok = await selectorResolves(page, sel, 1500);
            if (ok) {
                return { selector: sel, confidence };
            }
        }

        return null;
    }
}

function pickPhrase(locatorName: string, metadata?: LocatorData): string | null {
    const candidates = [
        (metadata as any)?.ocrText,
        metadata?.description,
        humanizeLocatorName(locatorName),
    ];
    for (const c of candidates) {
        if (typeof c === 'string' && c.trim().length > 0) {
            return c.trim();
        }
    }
    return null;
}

function humanizeLocatorName(name: string): string {
    const tail = name.split('.').pop() || name;
    return tail.replace(/[_-]+/g, ' ').trim();
}

function buildTextSelector(phrase: string): string {
    if (phrase.includes('"')) {
        return `text='${phrase.replace(/'/g, "\\'")}'`;
    }
    return `text="${phrase}"`;
}

async function selectorResolves(page: Page, selector: string, timeoutMs: number): Promise<boolean> {
    try {
        await page.waitForSelector(selector, { state: 'attached', timeout: timeoutMs });
        return true;
    } catch {
        return false;
    }
}
