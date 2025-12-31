import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { testConfig } from './src/config/testConfig';

// Environment variables are now loaded by testConfig import
const testDir = defineBddConfig({
    paths: ['features/*.feature'],
    require: ['src/steps/steps.ts', 'src/support/hooks.ts'],
});

export const BROWSER_NAME = testConfig.browser;

export default defineConfig({
    testDir,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    // Workers configuration from master config
    workers: process.env.CI ? 1 : testConfig.workers,
    reporter: [
        ['html', { open: 'always' }],
        ['list'],
        ['allure-playwright', { outputFolder: 'allure-results' }]
    ],
    use: {
        baseURL: 'http://localhost:3000',
        headless: testConfig.headless, // Use headless setting from master config
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'on-first-retry',
        // Viewport from master config
        viewport: testConfig.viewport,
        // Add a real user agent to avoid bot detection
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    projects: [
        {
            name: testConfig.browser, // Use browser from master config
            use: { ...devices[testConfig.browser === 'firefox' ? 'Desktop Firefox' : testConfig.browser === 'webkit' ? 'Desktop Safari' : 'Desktop Chrome'] },
        }
    ]
});
