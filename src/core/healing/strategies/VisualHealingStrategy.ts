import fs from 'fs';
import path from 'path';
import { Page } from '@playwright/test';
import { IHealingStrategy } from './IHealingStrategy';
import { LocatorData } from '../LocatorRepository';

let opencvPromise: Promise<any> | null = null;
let opencvLoadFailed = false;

async function loadOpenCv(): Promise<any> {
    if (opencvLoadFailed) return null;
    if (!opencvPromise) {
        opencvPromise = (async () => {
            try {
                const mod = await import('opencv-wasm');
                const cv = (mod as any).cv || (mod as any).default || mod;
                if (typeof cv?.imread !== 'function' && typeof cv?.matFromArray !== 'function') {
                    throw new Error('opencv-wasm module did not expose expected API');
                }
                return cv;
            } catch (err) {
                opencvLoadFailed = true;
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(`[Visual Healing] opencv-wasm unavailable: ${msg}. Strategy will skip.`);
                return null;
            }
        })();
    }
    return opencvPromise;
}

let jimpPromise: Promise<any> | null = null;
async function loadJimp(): Promise<any> {
    if (!jimpPromise) {
        jimpPromise = (async () => {
            try {
                const mod = await import('jimp');
                return (mod as any).default || (mod as any).Jimp || mod;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(`[Visual Healing] jimp unavailable: ${msg}. Strategy will skip.`);
                return null;
            }
        })();
    }
    return jimpPromise;
}

/**
 * Visual healing strategy — local template matching, no external API.
 *
 * Looks for a PNG template at `<resourcesPath>/templates/<locatorName>.png`.
 * When found, runs OpenCV TM_CCOEFF_NORMED template matching against a fresh
 * page screenshot and returns an XPath selector that points at the centre of
 * the best match (when confidence ≥ 0.75).
 *
 * Strategy returns null when:
 *   - no template exists for the locator (the common case until templates are
 *     curated under `resources/templates/`).
 *   - jimp or opencv-wasm fails to load.
 *   - the best match's confidence is below 0.75.
 */
export class VisualHealingStrategy implements IHealingStrategy {
    readonly name = 'VISUAL';

    private readonly minConfidence = 0.75;
    private readonly templatesDir: string;

    constructor(resourcesPath: string = 'resources') {
        this.templatesDir = path.resolve(resourcesPath, 'templates');
    }

    async attempt(
        page: Page,
        locatorName: string,
        originalSelector: string,
        metadata?: LocatorData,
    ): Promise<{ selector: string; confidence: number } | null> {
        const templatePath = this.resolveTemplate(locatorName);
        if (!templatePath) return null;

        const cv = await loadOpenCv();
        if (!cv) return null;

        const Jimp = await loadJimp();
        if (!Jimp) return null;

        let screenshotBuffer: Buffer;
        try {
            screenshotBuffer = await page.screenshot({ fullPage: false });
        } catch (err) {
            console.warn('[Visual Healing] Screenshot failed:', err);
            return null;
        }

        try {
            const screenImg = await Jimp.read(screenshotBuffer);
            const templateImg = await Jimp.read(templatePath);

            const screenMat = imageToMat(cv, screenImg);
            const templateMat = imageToMat(cv, templateImg);
            const result = new cv.Mat();
            const mask = new cv.Mat();
            cv.matchTemplate(screenMat, templateMat, result, cv.TM_CCOEFF_NORMED, mask);
            const minMax = cv.minMaxLoc(result, mask);
            const confidence: number = minMax.maxVal;
            const matchPoint = minMax.maxLoc;
            const tplWidth = templateMat.cols;
            const tplHeight = templateMat.rows;

            screenMat.delete?.();
            templateMat.delete?.();
            result.delete?.();
            mask.delete?.();

            if (!Number.isFinite(confidence) || confidence < this.minConfidence) {
                return null;
            }

            const centreX = Math.round(matchPoint.x + tplWidth / 2);
            const centreY = Math.round(matchPoint.y + tplHeight / 2);

            // Resolve to a Playwright xpath selector keyed off the element under
            // the centre of the matched region.
            const selector = await locatorAtPoint(page, centreX, centreY);
            if (!selector) return null;
            if (!(await selectorResolves(page, selector, 1500))) return null;
            return { selector, confidence };
        } catch (err) {
            console.warn('[Visual Healing] Template match failed:', err);
            return null;
        }
    }

    private resolveTemplate(locatorName: string): string | null {
        if (!fs.existsSync(this.templatesDir)) return null;
        const candidates = [
            `${locatorName}.png`,
            `${locatorName.replace(/[^a-zA-Z0-9._-]+/g, '_')}.png`,
            `${(locatorName.split('.').pop() || locatorName)}.png`,
        ];
        for (const c of candidates) {
            const fullPath = path.resolve(this.templatesDir, c);
            if (fs.existsSync(fullPath)) return fullPath;
        }
        return null;
    }
}

function imageToMat(cv: any, image: any): any {
    // jimp Image -> { width, height, bitmap.data: Uint8Array RGBA }
    const { width, height, data } = image.bitmap;
    return cv.matFromImageData({
        data,
        width,
        height,
    });
}

async function locatorAtPoint(page: Page, x: number, y: number): Promise<string | null> {
    try {
        return await page.evaluate(
            ({ x, y }: { x: number; y: number }) => {
                const target = document.elementFromPoint(x, y);
                if (!target) return null;
                const segments: string[] = [];
                let current: Element | null = target;
                while (current && current !== document.body) {
                    const parent: Element | null = current.parentElement;
                    if (!parent) break;
                    const idx = Array.prototype.indexOf.call(parent.children, current) + 1;
                    segments.unshift(`*[${idx}]`);
                    current = parent;
                }
                return segments.length ? `xpath=//body/${segments.join('/')}` : null;
            },
            { x, y },
        );
    } catch {
        return null;
    }
}

async function selectorResolves(page: Page, selector: string, timeoutMs: number): Promise<boolean> {
    try {
        await page.waitForSelector(selector, { state: 'attached', timeout: timeoutMs });
        return true;
    } catch {
        return false;
    }
}
