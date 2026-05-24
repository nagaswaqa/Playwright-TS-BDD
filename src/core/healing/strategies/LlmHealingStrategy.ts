import { Page } from '@playwright/test';
import { IHealingStrategy } from './IHealingStrategy';
import { LocatorData } from '../LocatorRepository';

/**
 * LlmHealingStrategy — last-resort selector recovery via OpenAI vision.
 *
 * Sends the live page's *accessibility-tree snapshot* (the same payload
 * Microsoft's Playwright MCP server produces, computed locally with
 * `page.locator('body').ariaSnapshot()`) plus a screenshot to OpenAI's
 * `chat.completions` endpoint. GPT-4o (or another vision model via env
 * override) is asked for a Playwright-native selector.
 *
 * Why a snapshot instead of HTML:
 *   - Semantic: roles, accessible names, and structural refs instead of raw
 *     markup. The model produces `role=button[name="Save Changes"]` style
 *     selectors that flow naturally through Playwright's locator engine.
 *   - Smaller: a typical snapshot is 1-3KB versus 50-500KB of HTML, so the
 *     prompt fits comfortably and tokens stay cheap.
 *   - Identical to what Playwright MCP would expose, without spawning a
 *     separate browser process.
 *
 * Activation rules:
 *   - Off when `LLM_HEALING_ENABLED=false`.
 *   - Off (silently) when `OPENAI_API_KEY` is not set, so dev machines and
 *     CI without an OpenAI subscription don't fail noisily.
 *
 * Configuration:
 *   - `OPENAI_API_KEY`         OpenAI API key (required to enable).
 *   - `LLM_HEALING_ENABLED`    Optional master switch (`true` by default).
 *   - `LLM_HEALING_MODEL`      OpenAI model id (defaults to `gpt-4o-mini`).
 *   - `LLM_HEALING_BASE_URL`   Optional alternate base (e.g. an Azure proxy).
 *   - `LLM_HEALING_TIMEOUT_MS` Request timeout, default 30000.
 */
export class LlmHealingStrategy implements IHealingStrategy {
    readonly name = 'LLM';

    /**
     * Hard cap on accessibility-snapshot characters. Snapshots are dense, so
     * 12000 chars typically covers a screen's worth of UI. We never want the
     * prompt to balloon past one OpenAI request budget.
     */
    private readonly SNAPSHOT_MAX_CHARS = 12000;

    async attempt(
        page: Page,
        locatorName: string,
        originalSelector: string,
        metadata?: LocatorData,
    ): Promise<{ selector: string; confidence: number } | null> {
        if ((process.env.LLM_HEALING_ENABLED || 'true').toLowerCase() === 'false') {
            return null;
        }
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            // Quiet by design — most test machines don't carry an OpenAI key.
            return null;
        }

        // 1. Accessibility-tree snapshot (the Playwright-MCP-shaped payload).
        let ariaSnapshot = '';
        try {
            const snapshotRaw = await page.locator('body').ariaSnapshot();
            ariaSnapshot = truncate(snapshotRaw, this.SNAPSHOT_MAX_CHARS);
        } catch (err) {
            console.warn('[LLM Healing] ariaSnapshot failed, continuing with vision-only:', err);
        }

        // 2. Vision: a screenshot of the current viewport.
        let screenshotBase64 = '';
        try {
            const buffer = await page.screenshot({ fullPage: false });
            screenshotBase64 = buffer.toString('base64');
        } catch (err) {
            console.warn('[LLM Healing] Screenshot failed:', err);
            return null;
        }

        const baseUrl = (process.env.LLM_HEALING_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
        const model = process.env.LLM_HEALING_MODEL || 'gpt-4o-mini';
        const timeoutMs = parseInt(process.env.LLM_HEALING_TIMEOUT_MS || '30000', 10);
        const description = metadata?.description?.trim() || '';

        const userPrompt = [
            'You are repairing a broken Playwright selector.',
            `Logical name: ${locatorName}`,
            `Original selector that failed: ${originalSelector}`,
            description ? `Element description: ${description}` : null,
            'Inspect the screenshot AND the accessibility-tree snapshot below, then return JSON of the form { "selector": "...", "confidence": 0.0..1.0 }.',
            'Prefer Playwright-native selectors when possible:',
            '  - role=<role>[name="<accessible name>"]',
            '  - text="<exact visible text>"',
            '  - label "<label>" :nth-of-type(...) when no role/name fits',
            'Return null when you are not confident: { "selector": null, "confidence": 0 }.',
            '',
            'Accessibility tree (Playwright ariaSnapshot, truncated to 12000 chars):',
            '```yaml',
            ariaSnapshot || '<snapshot unavailable>',
            '```',
        ]
            .filter(Boolean)
            .join('\n');

        let response: Response;
        try {
            response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    response_format: { type: 'json_object' },
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You are an expert at repairing brittle web UI selectors. Always respond with strict JSON of the shape { "selector": string|null, "confidence": number }.',
                        },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: userPrompt },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:image/png;base64,${screenshotBase64}`,
                                    },
                                },
                            ],
                        },
                    ],
                }),
                signal: AbortSignal.timeout(timeoutMs),
            });
        } catch (err: any) {
            if (err?.name === 'TimeoutError') {
                console.warn(`[LLM Healing] Request timed out after ${timeoutMs}ms.`);
            } else {
                console.warn('[LLM Healing] Request failed:', err?.message || err);
            }
            return null;
        }

        if (!response.ok) {
            const body = await response.text().catch(() => '');
            console.warn(`[LLM Healing] OpenAI returned ${response.status}: ${body.slice(0, 200)}`);
            return null;
        }

        let payload: any;
        try {
            payload = await response.json();
        } catch (err) {
            console.warn('[LLM Healing] Could not parse OpenAI response:', err);
            return null;
        }

        const content: string | undefined = payload?.choices?.[0]?.message?.content;
        if (!content) return null;

        const parsed = parseJsonLoose(content);
        const selector = parsed?.selector;
        if (!selector || typeof selector !== 'string') return null;
        const confidence = typeof parsed?.confidence === 'number' ? parsed.confidence : 0.7;

        try {
            await page.waitForSelector(selector, { state: 'attached', timeout: 2000 });
            console.log(`[LLM Healing] ✅ Healed via ${model}: ${selector} (confidence ${confidence})`);
            return { selector, confidence };
        } catch {
            console.warn(`[LLM Healing] Suggested selector failed live verification: ${selector}`);
            return null;
        }
    }
}

function truncate(text: string, max: number): string {
    if (typeof text !== 'string') return '';
    return text.length <= max ? text : `${text.slice(0, max)}\n... [truncated ${text.length - max} chars]`;
}

function parseJsonLoose(text: string): { selector?: string | null; confidence?: number } | null {
    try {
        return JSON.parse(text);
    } catch {
        // Some models wrap JSON in code fences; strip and retry once.
        const stripped = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        try {
            return JSON.parse(stripped);
        } catch {
            return null;
        }
    }
}
