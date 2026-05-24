/**
 * Stage 1 of the recording pipeline (`recorder-agent`).
 *
 * Launches a headed Chromium pointed at the application URL, injects the
 * recorder script, and on `export` normalizes the raw payload IN PROCESS,
 * writing only `recordings/normalized-<ts>.json`. The raw payload is never
 * persisted — that is by design (see docs/AUTHORING/recording-workflow.md).
 *
 * Two ways to trigger an export:
 *   1. Type `export` + ENTER in this terminal.
 *   2. POST http://127.0.0.1:<RECORDER_HTTP_PORT>/export (or any path).
 *      A `GET /health` endpoint reports the recorder's current state so
 *      external orchestrators (agents, CI) can wait for readiness.
 *
 * Output path resolution (priority order):
 *   1. RECORDER_OUT environment variable.
 *   2. Second CLI argument: `node scripts/recorder-server.js <url> <out-path>`.
 *   3. Default: `recordings/normalized-<ts>.json`.
 *
 * Usage:
 *   node scripts/recorder-server.js [<url>] [<out-path>]
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');
const dotenv = require('dotenv');

const envKey = process.env.ENV || 'dev';
const envFile = path.resolve(process.cwd(), 'config', `.env.UB.${envKey}`);
if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
}

const targetUrl = process.argv[2] || process.env.BASE_URL;
if (!targetUrl) {
    console.error('No target URL provided. Set BASE_URL env variable or pass URL as argument.');
    process.exit(1);
}

const httpPort = (() => {
    const explicit = parseInt(process.env.RECORDER_HTTP_PORT || '', 10);
    if (Number.isInteger(explicit) && explicit > 0) return explicit;
    return 47835; // arbitrary; see /health to discover at runtime
})();

function resolveOutputPath() {
    if (process.env.RECORDER_OUT && process.env.RECORDER_OUT.trim()) {
        return path.resolve(process.env.RECORDER_OUT.trim());
    }
    if (process.argv[3]) {
        return path.resolve(process.argv[3]);
    }
    const stamp = Date.now();
    return path.resolve(__dirname, '../recordings', `normalized-${stamp}.json`);
}

/**
 * Normalize the raw recorder payload into the framework schema. Mirrors the
 * shape declared in `docs/AUTHORING/recording-workflow.md`. Per-action
 * `element` metadata captured by `resources/recorder-script.js` is preserved
 * so the rules-file matcher in `convert-recording-to-feature.js` can do
 * meaningful step reuse.
 */
function normalizePayload(rawString) {
    const raw = JSON.parse(rawString);
    const actions = (raw.actions || []).map((action) => ({
        type: action.type,
        selector: action.selector || '',
        value: action.value || action.label || '',
        timestamp: action.timestamp,
        label: action.label || '',
        element: action.element || {},
        metadata: { page: raw.metadata?.title || raw.metadata?.url || '' },
    }));
    return {
        metadata: {
            source: 'live-recorder',
            createdAt: new Date().toISOString(),
            url: raw.metadata?.url || '',
            title: raw.metadata?.title || '',
        },
        actions,
    };
}

async function main() {
    const recorderPath = path.resolve(__dirname, '../resources/recorder-script.js');
    if (!fs.existsSync(recorderPath)) {
        console.error('Recorder script not found:', recorderPath);
        process.exit(1);
    }

    const outputPath = resolveOutputPath();
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(targetUrl);

    const recorderCode = fs.readFileSync(recorderPath, 'utf8');
    await page.addScriptTag({ content: recorderCode });

    let exporting = false;
    let exported = false;
    let outcome = null; // { ok: boolean, message: string, outputPath?: string }
    let resolveReady;
    const ready = new Promise((resolve) => { resolveReady = resolve; });

    /**
     * Fully encapsulated export routine. Idempotent: a second concurrent or
     * sequential call short-circuits with the cached outcome.
     */
    async function performExport(trigger) {
        if (exported) {
            return outcome;
        }
        if (exporting) {
            // Caller raced with another trigger. Wait for the in-flight one.
            await ready;
            return outcome;
        }
        exporting = true;

        let result;
        try {
            const raw = await page.evaluate(() => {
                return window.__RECORDER_EXPORT__ ? window.__RECORDER_EXPORT__() : null;
            });

            if (!raw) {
                result = {
                    ok: false,
                    message: 'Recorder export not available. Make sure the recorder script is still injected and the page has recorded actions.',
                };
            } else {
                const normalized = normalizePayload(raw);
                fs.writeFileSync(outputPath, JSON.stringify(normalized, null, 2), 'utf8');
                result = {
                    ok: true,
                    message: `Normalized recording written via ${trigger}`,
                    outputPath,
                };
                console.log(`Normalized recording written to: ${outputPath}`);
            }
        } catch (err) {
            result = {
                ok: false,
                message: err && err.message ? err.message : String(err),
            };
            console.error('Failed to export recording:', err);
        }

        outcome = result;
        exported = true;
        resolveReady(result);

        // Tear down browser + HTTP server before exiting.
        try { await browser.close(); } catch (_) { /* already closing */ }
        try {
            await new Promise((resolve) => httpServer.close(() => resolve()));
        } catch (_) { /* already closed */ }
        process.exit(result.ok ? 0 : 1);
    }

    // ── HTTP control surface ────────────────────────────────────────────────
    const httpServer = http.createServer((req, res) => {
        const url = (req.url || '').split('?')[0];

        // Health is GET-only and cheap.
        if (req.method === 'GET' && url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
                JSON.stringify({
                    state: exported ? 'exported' : exporting ? 'exporting' : 'recording',
                    outputPath,
                    targetUrl,
                    httpPort,
                }),
            );
            return;
        }

        // Anything else is treated as an export trigger. Accept POST or GET so
        // the operator can also hit `curl http://127.0.0.1:<port>/export` from
        // a browser tab if they want.
        if (url === '/export') {
            res.writeHead(202, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ accepted: true, outputPath }));
            // Fire-and-forget; performExport is idempotent.
            performExport('http').catch((err) => console.error('export trigger failed:', err));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unknown endpoint', endpoints: ['GET /health', 'POST /export'] }));
    });

    httpServer.on('error', (err) => {
        console.error(`[recorder-server] HTTP server error on port ${httpPort}: ${err.message}`);
    });

    httpServer.listen(httpPort, '127.0.0.1', () => {
        console.log(`[recorder-server] HTTP control surface: http://127.0.0.1:${httpPort}`);
        console.log('[recorder-server]   GET  /health   -> recorder status');
        console.log('[recorder-server]   POST /export   -> finalize and write recording');
    });

    console.log('Recorder injected into:', targetUrl);
    console.log('Normalized recording will be written to:', outputPath);
    console.log('When you are finished, type "export" + ENTER (or POST /export) to save the recording and close the browser.');

    // ── stdin trigger (legacy interactive path) ────────────────────────────
    process.stdin.resume();
    process.stdin.on('data', async (input) => {
        const command = input.toString().trim().toLowerCase();
        if (command !== 'export') {
            console.log('Type "export" and press ENTER (or POST /export) when you are ready to save the recording.');
            return;
        }
        await performExport('stdin');
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
