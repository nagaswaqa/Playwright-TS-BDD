import fs from 'fs';
import path from 'path';
import {
    BrowserContext,
    Page,
    chromium,
    Cookie,
} from '@playwright/test';
import {
    LOGIN_BYPASS_SEQUENCE,
    DASHBOARD_READY_SELECTOR,
} from '../../pages/LoginPage';
import { testConfig } from '../../../config/testConfig';

/**
 * Shape of Playwright's `BrowserContext.storageState()` payload.
 * Inlined locally so we don't need a runtime dep on the `@playwright/test`
 * type internals.
 */
export interface StorageState {
    cookies: Cookie[];
    origins: Array<{
        origin: string;
        localStorage: Array<{ name: string; value: string }>;
        sessionStorage?: Array<{ name: string; value: string }>;
    }>;
}

/** Path on disk where the cached storage state lives. */
export const STATE_FILE = path.resolve(process.cwd(), '.auth', 'user.json');

/**
 * Time-to-live for the cached state. The demo SIS expires sessions after 30
 * minutes; we refresh at 29 to leave a safety margin and absorb clock skew.
 */
export const STATE_TTL_MS = 29 * 60 * 1000;

/** Resolve the application's base URL (env-driven, with a sensible default). */
export function resolveBaseUrl(): string {
    return (
        process.env.BASE_URL ||
        testConfig.baseUrl ||
        'http://145.241.185.96/app'
    );
}

/** True when `.auth/user.json` exists and is younger than the TTL. */
export function isFresh(): boolean {
    if (!fs.existsSync(STATE_FILE)) {
        return false;
    }
    const ageMs = Date.now() - fs.statSync(STATE_FILE).mtimeMs;
    return ageMs < STATE_TTL_MS;
}

/** Age of the cached state in milliseconds, or `Infinity` when missing. */
export function ageMs(): number {
    if (!fs.existsSync(STATE_FILE)) {
        return Infinity;
    }
    return Date.now() - fs.statSync(STATE_FILE).mtimeMs;
}

/** Remove the cached state file, if present. */
export function clear(): void {
    if (fs.existsSync(STATE_FILE)) {
        fs.unlinkSync(STATE_FILE);
    }
}

/**
 * Run the recorded login bypass in a one-shot headless context and persist
 * the resulting cookies/localStorage to `.auth/user.json`.
 *
 * Always launches a fresh chromium so it never disturbs the worker's running
 * browser context.
 */
export async function refresh(): Promise<StorageState | null> {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const baseUrl = resolveBaseUrl();
    console.log(`[AuthCache] Refreshing storageState against ${baseUrl}`);

    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext({
            viewport: testConfig.viewport,
            ignoreHTTPSErrors: true,
            locale: 'en-US',
        });
        const page = await context.newPage();
        try {
            await page.goto(baseUrl, { waitUntil: 'networkidle' });
            for (const step of LOGIN_BYPASS_SEQUENCE) {
                await page.locator(step.selector).first().click({ timeout: 30000 });
            }
            await page
                .locator(DASHBOARD_READY_SELECTOR)
                .first()
                .waitFor({ state: 'visible', timeout: 15000 });
            const state = (await context.storageState({
                path: STATE_FILE,
            })) as StorageState;
            console.log(`[AuthCache] storageState saved to ${STATE_FILE}`);
            return state;
        } finally {
            await context.close();
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[AuthCache] Refresh failed: ${msg}`);
        // Avoid leaving a half-written or stale file behind.
        clear();
        return null;
    } finally {
        await browser.close();
    }
}

/**
 * Refresh the cached state when it's missing or older than the TTL.
 * Returns true when a refresh actually ran (so callers can re-apply state).
 */
export async function ensureFresh(): Promise<boolean> {
    if (isFresh()) {
        return false;
    }
    const result = await refresh();
    return result !== null;
}

/** Read the cached state file, or `null` when absent / unreadable. */
export function load(): StorageState | null {
    if (!fs.existsSync(STATE_FILE)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as StorageState;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[AuthCache] Could not read ${STATE_FILE}: ${msg}`);
        return null;
    }
}

/**
 * Push the cached cookies + localStorage into a live browser context so the
 * already-running session picks up a refreshed login without needing the
 * worker to be torn down.
 *
 * If a `page` is provided we reload it at the end so the app re-evaluates the
 * new cookies/storage on its next render.
 */
export async function applyToContext(
    context: BrowserContext,
    page?: Page,
): Promise<void> {
    const state = load();
    if (!state) {
        return;
    }

    if (state.cookies?.length) {
        await context.clearCookies();
        await context.addCookies(state.cookies);
    }

    if (state.origins?.length && page && !page.isClosed()) {
        const currentUrl = page.url();
        for (const origin of state.origins) {
            try {
                await page.goto(origin.origin, { waitUntil: 'domcontentloaded' });
                await page.evaluate(
                    (entries) => {
                        for (const { name, value } of entries) {
                            window.localStorage.setItem(name, value);
                        }
                    },
                    origin.localStorage || [],
                );
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(
                    `[AuthCache] Failed seeding storage for ${origin.origin}: ${msg}`,
                );
            }
        }
        // Best-effort: return to wherever the test was. Skip blank pages.
        if (currentUrl && currentUrl !== 'about:blank') {
            await page
                .goto(currentUrl, { waitUntil: 'domcontentloaded' })
                .catch(() => undefined);
        }
    } else if (page && !page.isClosed()) {
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
    }
}
