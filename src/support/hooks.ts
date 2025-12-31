import { Before, After, BeforeAll, TestContext, testContextStorage, logger } from './base-step';
import { Browser } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { BROWSER_NAME } from '../../playwright.config';

import { testConfig } from '../config/testConfig';

let globalConfig: Record<string, string> = {};

// BeforeAll hook - runs once before all scenarios (per worker)
BeforeAll(async () => {
    // Log browser and execution configuration from master file
    logger.info(`>> [CONFIG] Environment: ${testConfig.env}`);
    logger.info(`>> [CONFIG] Browser: ${testConfig.browser}`);
    logger.info(`>> [CONFIG] Headless: ${testConfig.headless}`);
    logger.info(`>> [CONFIG] Workers: ${testConfig.workers ?? 'Auto (All Cores)'}`);

    // Load environment configuration
    if (Object.keys(globalConfig).length === 0) {
        const ENV = testConfig.env;
        let envFile = `.env.${ENV}`;

        // Flexible resolution: Check .env.ENV, then .env_ENV
        if (!fs.existsSync(path.resolve(process.cwd(), envFile))) {
            const altEnvFile = `.env_${ENV}`;
            if (fs.existsSync(path.resolve(process.cwd(), altEnvFile))) {
                envFile = altEnvFile;
            }
        }

        const envPath = path.resolve(process.cwd(), envFile);

        if (fs.existsSync(envPath)) {
            logger.info(`>> [ENV] Loading variables from: ${envFile}`);
            globalConfig = dotenv.parse(fs.readFileSync(envPath));
        }
    }
});

Before(async (fixtures: any) => {
    // In playwright-bdd 8.x, 'this' in Before hook is the world instance if defined with createBdd<TestContext>()
    // But since we are using arrow functions, we should check if fixtures contains it or use the scenario arg if available.
});

// Actually, let's use traditional functions to have access to 'this' if playwright-bdd supports it.
// Or just use the fixtures.

Before(async function (this: any, { page, context, request, $testInfo }: any) {
    logger.info(`>> [SCENARIO] Starting: ${$testInfo.title}`);

    // Log viewport configuration (from playwright.config.ts)
    const viewportSize = page.viewportSize();
    if (viewportSize) {
        logger.info(`>> [VIEWPORT] Set to: ${viewportSize.width}x${viewportSize.height}`);
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
