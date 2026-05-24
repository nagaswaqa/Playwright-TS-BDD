// scripts/run-env.js
/**
 * Cross‑platform launcher that:
 *   1️⃣ Ensures a .env file exists for the requested environment.
 *   2️⃣ Sets the ENV variable so testConfig picks the correct file.
 *   3️⃣ Executes the standard test runner (run-tests-with-report.js).
 *
 * Usage:  npm run test:env -- <env>
 *   where <env> is one of dev, qa, uat, staging, prod, etc.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ------------------------------------------------------------
// 1️⃣ Resolve requested environment (default: dev)
// ------------------------------------------------------------
const args = process.argv.slice(2);
const requestedEnv = (args[0] || 'dev').toLowerCase();
const envFileName = `.env.UB.${requestedEnv}`;
const envFilePath = path.resolve(process.cwd(), 'config', envFileName);

// ------------------------------------------------------------
// 2️⃣ Auto‑create placeholder if missing
// ------------------------------------------------------------
if (!fs.existsSync(envFilePath)) {
  const placeholder = `# Auto‑generated .env for ${requestedEnv}\n# Add your variables below\n`;
  fs.writeFileSync(envFilePath, placeholder, { encoding: 'utf8' });
  console.log(`✅ Created missing env file: ${envFilePath}`);
}

// ------------------------------------------------------------
// 3️⃣ Spawn the regular test runner with proper ENV variable
// ------------------------------------------------------------
const isWindows = process.platform === 'win32';
const shell = isWindows ? 'cmd' : 'sh';
const shellArgs = isWindows ? ['/c'] : ['-c'];

// Build the command that runs the existing test script
const testCommand = isWindows
  ? 'node scripts/run-tests-with-report.js'
  : 'node scripts/run-tests-with-report.js';

const child = spawn(shell, [...shellArgs, testCommand], {
  cwd: process.cwd(),
  env: { ...process.env, ENV: requestedEnv }, // inject ENV for testConfig
  stdio: 'inherit',
  shell: true,
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('🚀 Tests finished successfully');
  } else {
    console.warn(`⚠️ Tests exited with code ${code}`);
  }
});

child.on('error', (err) => {
  console.error('❌ Failed to start test process:', err);
});
