import path from 'path';
import * as dotenv from 'dotenv';
import fs from 'fs';

// ===========================
// DEFAULT CONFIGURATION VALUES
// ===========================
const DEFAULT_ENV = 'aptl-z1-002.dev';                  // Default environment (dev, qa, etc.)
const DEFAULT_BROWSER = 'chromium';         // Default browser (chromium, firefox, webkit)
const DEFAULT_HEADLESS = false;              // Default to invisible mode (true)
const DEFAULT_WORKERS = 1;          // undefined = Use all available cores
const DEFAULT_VIEWPORT = { width: 1920, height: 1080 }; // Full HD

// ===========================
// CONFIGURATION LOGIC
// ===========================

// 1. Resolve Environment Name
const ENV = process.env.ENV || DEFAULT_ENV;

// 2. Resolve .env file path
let envFile = `.env.${ENV}`;
// Check for .env.ENV, if not found, try .env_ENV (e.g., .env_aptl-z1-002.dev)
if (!path.isAbsolute(envFile) && !fs.existsSync(path.resolve(process.cwd(), envFile))) {
    const altEnvFile = `.env_${ENV}`;
    if (fs.existsSync(path.resolve(process.cwd(), altEnvFile))) {
        envFile = altEnvFile;
    }
}

// 3. Load Environment Variables (Synchronously)
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

/**
 * MASTER CONFIGURATION FILE
 * -------------------------
 * Use this file to configure your test execution settings.
 * You can set defaults by changing the constants at the top of this file.
 */
export const testConfig = {
    // Environment Configuration
    env: ENV,
    envFile: envFile,

    // Browser Configuration
    browser: process.env.BROWSER_NAME || DEFAULT_BROWSER,

    // Headless Mode
    // true = Invisible (faster), false = Visible (for debugging)
    headless: process.env.HEADLESS ? process.env.HEADLESS === 'true' : DEFAULT_HEADLESS,

    // Worker Count
    // undefined = Use all available cores (Playwright default)
    workers: process.env.WORKERS ? parseInt(process.env.WORKERS, 10) : DEFAULT_WORKERS,

    // Viewport Settings
    viewport: DEFAULT_VIEWPORT,

    // Paths
    rootDir: process.cwd(),

    // Helpers
    getEnvPath: function () {
        return this.envFile;
    }
};
