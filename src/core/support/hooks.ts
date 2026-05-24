import { Before, After, BeforeAll, AfterAll, TestContext, testContextStorage, logger } from './base-step';
import { Browser, BrowserContext, Page, chromium, firefox, webkit } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { initializeHealing } from '../healing/HealingUtils';
import * as AuthCache from '../auth/AuthCache';

import { testConfig } from '../../../config/testConfig';

let globalConfig: Record<string, string> = {};

// ─── Shared browser-level globals (initialized once per worker in BeforeAll) ───
export let globalBrowser: Browser | null = null;

BeforeAll(async ({ browser }: { browser: Browser }) => {
    // ── 1. Log execution configuration from master config file ──────────────
    logger.info(`>> [CONFIG] Environment : ${testConfig.env}`);
    logger.info(`>> [CONFIG] Browser     : ${testConfig.browser}`);
    logger.info(`>> [CONFIG] Headless    : ${testConfig.headless}`);
    logger.info(`>> [CONFIG] Workers     : ${testConfig.workers ?? 'Auto (All Cores)'}`);
    logger.info(`>> [CONFIG] Viewport    : ${testConfig.viewport.width}x${testConfig.viewport.height}`);

    // ── 2. Load environment variables from .env file (once per worker) ──────
    if (Object.keys(globalConfig).length === 0) {
        const envPath = testConfig.envFile;
        if (fs.existsSync(envPath)) {
            logger.info(`>> [ENV] Loading variables from: ${path.basename(envPath)}`);
            globalConfig = dotenv.parse(fs.readFileSync(envPath));
        } else {
            logger.warn(`>> [ENV] No env file found at: ${envPath}`);
        }
    }

    // ── 3. Store global Browser reference ─────────────────────────
    globalBrowser = browser;

    // ── 4. Initialize Self-Healing Engine ────────────────────────────────────
    await initializeHealing();
    logger.info('>> [HEALING] Healing framework initialized globally');
});

// ─── AfterAll: tear down the shared context and page ─────────────────────────
AfterAll(async () => {
    // Note: playwright-bdd manages the Browser lifecycle — do NOT call browser.close() here.
    globalBrowser = null;
});

// We use traditional functions to have access to 'this' (the World instance)
Before(async function (this: any, { page, context, request, $testInfo }: any) {
    logger.info(`>> [SCENARIO] Starting: ${$testInfo.title}`);

    // ── Auth freshness gate ─────────────────────────────────────────────────
    // Server session expires at 30 min. We refresh at 29 (TTL configured in
    // AuthCache) and re-apply the new state to the live worker context so
    // long-running suites don't fall off the auth cliff mid-run.
    try {
        const refreshed = await AuthCache.ensureFresh();
        if (refreshed) {
            logger.info('>> [AUTH] storageState refreshed, re-applying to worker context');
            await AuthCache.applyToContext(context, page);
        }
    } catch (err) {
        logger.warn(`>> [AUTH] Freshness check failed: ${(err as Error).message}`);
    }

    // In playwright-bdd, 'this' is the world instance
    const world = this;

    if (world instanceof TestContext) {
        testContextStorage.enterWith(world);
        world.page = page;
        world.context = context;
        world.apiContext = request;

        for (const [key, value] of Object.entries(globalConfig)) {
            world.setValue(key, value);
        }
    } else {
        // Fallback if instanceof fails but 'this' is still the world object
        testContextStorage.enterWith(world);
        world.page = page;
        world.context = context;
        world.apiContext = request;

        // If it's a plain object, add helper methods if they don't exist
        if (typeof world.setValue !== 'function') {
            world.testData = world.testData || {};
            world.setValue = function (key: string, value: any) { this.testData[key] = value; };
            world.getValue = function (key: string) { return this.testData[key]; };
        }

        for (const [key, value] of Object.entries(globalConfig)) {
            world.setValue(key, value);
        }
    }
});

After(async function (this: any, { page, $testInfo }: any) {
    const world = this;
    const status = $testInfo.status;

    logger.info(`>> [SCENARIO] Finished: ${$testInfo.title} [Status: ${status}]`);

    if (status === 'failed' && page) {
        logger.error('>> [UI] Failure detected, taking screenshot...');
        const image = await page.screenshot();
        if (typeof world.attach === 'function') {
            await world.attach(image, 'image/png');
        }
    }
});
