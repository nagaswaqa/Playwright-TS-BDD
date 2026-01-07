import { chromium, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Argument parsing
const args = process.argv.slice(2);
const help = args.includes('--help') || args.includes('-h');

if (help || args.length === 0) {
    console.log(`
Usage: npx ts-node POM/generate.ts --url <url> [options]

Options:
  --url <url>       The URL to generate a POM for (Required)
  --name <name>     The name of the class (Default: Derived from URL)
  --lang <lang>     Output language: typescript, java, python (Default: typescript)
  --ai              Use AI Agent to generate the POM
  --provider <p>    AI Provider: openai, anthropic (Default: openai)
  --api-key <key>   API Key (Fallback: OPENAI_API_KEY env var)
  --out <dir>       Output directory (Default: src/pages)
    `);
    process.exit(0);
}

const getArg = (name: string) => {
    const index = args.findIndex(arg => arg === name || arg.startsWith(`${name}=`));
    if (index === -1) return null;
    const arg = args[index];
    if (arg.includes('=')) {
        return arg.split('=')[1];
    }
    return args[index + 1] || null;
};

const hasArg = (name: string) => args.some(arg => arg === name || arg.startsWith(`${name}=`));

const url = getArg('--url');
if (!url) {
    console.error('Error: --url is required');
    process.exit(1);
}

const aiMode = hasArg('--ai');
const aiProvider = getArg('--provider') || 'openai';
const apiKey = getArg('--api-key') || process.env.OPENAI_API_KEY;
let className = getArg('--name');
const outDir = getArg('--out') || 'src/pages';

const lang = getArg('--lang') || 'typescript';

if (aiMode && !apiKey) {
    console.warn('⚠️ No API Key provided for AI mode. Pass --api-key or set OPENAI_API_KEY env var.');
}

if (!className) {
    try {
        const urlObj = new URL(url);
        const hostParts = urlObj.hostname.split('.');
        let mainPart = hostParts.length > 2 ? hostParts[hostParts.length - 2] : hostParts[0];
        mainPart = mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
        className = `${mainPart}Page`;
    } catch (e) {
        className = 'GeneratedPage';
    }
}

async function run() {
    console.log(`🚀 Launching Playwright for ${url}...`);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(url!, { waitUntil: 'load', timeout: 60000 });
        console.log('✅ Page loaded');

        let code = '';

        if (aiMode && apiKey) {
            console.log(`🤖 AI Agent Mode activated (${aiProvider}) [${lang.toUpperCase()}]...`);
            code = await generateWithAI(page, className!, lang);
        } else {
            console.log(`⚡ Heuristic Mode activated [${lang.toUpperCase()}]...`);
            code = await generateHeuristically(page, className!, lang);
        }

        const ext = lang === 'java' ? '.java' : (lang === 'python' ? '.py' : '.ts');
        const filePath = path.join(process.cwd(), outDir, `${className}${ext}`);
        const targetDir = path.dirname(filePath);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        fs.writeFileSync(filePath, code);
        console.log(`✨ POM generated at: ${filePath}`);

    } catch (error) {
        console.error('❌ Error generating POM:', error);
    } finally {
        await browser.close();
    }
}

async function generateWithAI(page: Page, className: string, language: string): Promise<string> {
    if (!apiKey) {
        console.warn('⚠️ Falling back to heuristic mode due to missing API key.');
        return generateHeuristically(page, className, language) as Promise<string>;
    }

    console.log('🧠 Capturing robust elements via heuristic analysis...');
    // Use the robust heuristic engine to identify elements first
    const elements = await generateHeuristically(page, className, language, 'json');
    const treeStr = JSON.stringify(elements, null, 2);

    const prompt = `
Generate a Playwright Page Object Model class in ${language.toUpperCase()}.
Class Name: ${className}
Base Class: BasePage

Rules:
1. Use ${language} syntax correctly.
2. Class Structure:
   - TypeScript: Define locators as readonly string properties: "readonly myButton: string = 'selector';"
   - Python: Define locators in __init__: "self.my_button = 'selector'"
   - Java: Define locators as private methods using 'SDET' style:
     "private Locator myButton() { return page.locator('selector'); }" (OR use getByRole/getByText if the selector string suggests it).

3. Locator Strategy (CRITICAL):
   - I have provided a list of detected elements in the "Elements detected" section.
   - Each element has a "selector" property which is a verify robust Playwright locator string (e.g. "role=button[name='Submit']", "text='Login'", "#id").
   - YOU MUST use this provided "selector" as the locator.
   - For Java, if the selector starts with "role=", try to generate `page.getByRole(...)` code if possible, or just use `page.locator("role=...")` as Playwright supports it.
   
4. Naming:
   - Use descriptive names based on the element's "name" property in the list.
   - Suffixes: _input, _button, _link, _checkbox, _select.
   - Ensure uniqueness (append _1, _2 if needed).

5. Methods:
   - Generate helper methods for obvious interactions (search, login) if elements are present.

6. Output:
   - Return ONLY clean ${language} code, no markdown blocks.

Elements detected:
${treeStr}
`;

    try {
        let endpoint = 'https://api.openai.com/v1/chat/completions';
        let body: any = {
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }]
        };

        if (aiProvider === 'anthropic') {
            endpoint = 'https://api.anthropic.com/v1/messages';
            body = {
                model: "claude-3-haiku-20240307",
                max_tokens: 4096,
                messages: [{ role: "user", content: prompt }]
            };
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'x-api-key': apiKey // For Anthropic
            },
            body: JSON.stringify(body)
        });

        const data: any = await response.json();
        let code = '';

        if (aiProvider === 'openai') {
            if (data.error) throw new Error(data.error.message);
            code = data.choices[0].message.content;
        } else if (aiProvider === 'anthropic') {
            if (data.error) throw new Error(data.error.message);
            code = data.content[0].text;
        }

        return code.replace(/```[a-z]*/g, '').trim();

    } catch (error) {
        console.error('❌ AI Generation failed:', error);
        return generateHeuristically(page, className, language) as Promise<string>;
    }
}

async function generateHeuristically(page: Page, className: string, language: string, mode: 'code' | 'json' = 'code'): Promise<string | any[]> {
    return await page.evaluate(({ clsName, lang, mode }) => {
        const elements: any[] = [];
        const escape = (str: string) => str.replace(/'/g, "\\'").replace(/"/g, '\\"');

        function isDynamic(value: string | null): boolean {
            if (!value) return false;
            const dynamicPatterns = [
                /[a-z0-9]{32}/i,                // Large hash
                /[0-9]{8,}/,                    // 8+ consecutive digits
                /^[0-9]+$/,                     // Purely numeric
                /[a-f0-9]{8,}/i,               // GUID-like hex strings
                /^(ember|ng-|__|_|auto-|id-|view-|v-|jss|css-)/i, // Framework prefixes
                /[_-][0-9]+$/                  // Suffix with numbers
            ];
            return dynamicPatterns.some(p => p.test(value));
        }

        // --- NEW EXTENSION LOGIC ---
        function generateGetByRole(element: Element): string | null {
            const role = element.getAttribute('role') || getImplicitRole(element);
            if (!role) return null;
            let name = element.textContent?.trim() ||
                element.getAttribute('aria-label') ||
                element.getAttribute('title') ||
                ((element as HTMLInputElement).value) || '';

            if (['button', 'link', 'heading', 'checkbox', 'radio', 'img', 'textbox', 'searchbox', 'spinbutton', 'combobox', 'listbox', 'listitem', 'list', 'tab', 'switch'].includes(role)) {
                if (name && name.length < 50) {
                    const cleanName = name.replace(/[\n\r\t]/g, ' ').trim();
                    if (cleanName) {
                        return `role=${role}[name="${escape(cleanName)}"]`;
                    }
                }
                return `role=${role}`;
            }
            return null;
        }

        function getImplicitRole(el: Element): string | null {
            const tag = el.tagName.toLowerCase();
            if (tag === 'button') return 'button';
            if (tag === 'a' && (el as HTMLAnchorElement).href) return 'link';
            if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return 'heading';
            if (tag === 'img') return 'img';
            if (tag === 'ul' || tag === 'ol') return 'list';
            if (tag === 'li') return 'listitem';
            if (tag === 'input') {
                const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
                if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
                if (type === 'checkbox') return 'checkbox';
                if (type === 'radio') return 'radio';
                if (type === 'search') return 'searchbox';
                if (type === 'number') return 'spinbutton';
                if (['text', 'email', 'password', 'tel', 'url'].includes(type)) return 'textbox';
            }
            if (tag === 'textarea') return 'textbox';
            if (tag === 'select') return (el.hasAttribute('multiple') || (el as HTMLSelectElement).size > 1) ? 'listbox' : 'combobox';
            return null;
        }

        function generateGetByText(element: Element): string | null {
            const text = element.textContent?.trim();
            if (text && text.length > 0 && text.length < 50) {
                return `text="${escape(text)}"`;
            }
            return null;
        }

        function generateGetByLabel(element: Element): string | null {
            let labelText: string | null = null;
            if (element.id) {
                const label = document.querySelector(`label[for="${element.id}"]`);
                if (label) labelText = label.textContent?.trim() || null;
            }
            if (!labelText) labelText = element.getAttribute('aria-label');

            if (labelText) {
                return `label="${escape(labelText)}"`;
            }
            return null;
        }

        function generateGetByPlaceholder(element: Element): string | null {
            const val = element.getAttribute('placeholder');
            if (val) return `placeholder="${escape(val)}"`;
            return null;
        }

        function generateGetByAltText(element: Element): string | null {
            const val = element.getAttribute('alt');
            if (val) return `alt="${escape(val)}"`;
            return null;
        }

        function generateGetByTitle(element: Element): string | null {
            const val = element.getAttribute('title');
            if (val) return `title="${escape(val)}"`;
            return null;
        }

        function generateGetByTestId(element: Element): string | null {
            const val = element.getAttribute('data-testid') || element.getAttribute('data-test-id') || element.getAttribute('data-test');
            if (val) return `testid="${escape(val)}"`;
            return null;
        }

        function generateCSSSelector(element: Element): string {
            const testId = element.getAttribute('data-testid') || element.getAttribute('data-test');
            if (testId && !isDynamic(testId)) return `[data-testid="${testId}"]`;
            if (element.id && !isDynamic(element.id)) return `#${element.id}`;
            const name = element.getAttribute('name');
            if (name && !isDynamic(name)) return `[name="${name}"]`;

            const classes = Array.from(element.classList).filter(c => !isDynamic(c)).join('.');
            if (classes) return `${element.tagName.toLowerCase()}.${classes}`;
            return element.tagName.toLowerCase();
        }

        function getXPath(element: Element): string {
            if (element.id && !isDynamic(element.id)) return `//*[@id="${element.id}"]`;
            if (element.getAttribute('data-testid')) return `//*[@data-testid="${element.getAttribute('data-testid')}"]`;
            if (element === document.body) return '/html/body';

            let ix = 0;
            const siblings = element.parentNode?.childNodes;
            if (!siblings) return '';
            for (let i = 0; i < siblings.length; i++) {
                const sibling = siblings[i] as Element;
                if (sibling === element) return `${getXPath(element.parentNode as Element)}/${element.tagName.toLowerCase()}[${ix + 1}]`;
                if (sibling.nodeType === 1 && sibling.tagName === element.tagName) ix++;
            }
            return '';
        }

        function getBestSelector(el: any): string {
            const role = generateGetByRole(el);
            if (role && role.includes('name=')) return role;

            const testId = generateGetByTestId(el);
            if (testId) return `[data-testid="${testId.replace('testid="', '').replace('"', '')}"]`;

            const text = generateGetByText(el);
            if (text) return text;

            const label = generateGetByLabel(el);
            if (label) return label;

            const placeholder = generateGetByPlaceholder(el);
            if (placeholder) return `[${placeholder}]`;

            const alt = generateGetByAltText(el);
            if (alt) return `[${alt}]`;

            const title = generateGetByTitle(el);
            if (title) return `[${title}]`;

            if (role) return role;
            return generateCSSSelector(el);
        }

        const names = new Set();
        function makeUnique(baseName: string) {
            let name = baseName;
            let counter = 2;
            while (names.has(name)) {
                name = `${baseName}_${counter++}`;
            }
            names.add(name);
            return name;
        }

        function getSuffix(el: any) {
            const tagName = el.tagName.toLowerCase();
            if (tagName === 'input') {
                const type = el.type ? el.type.toLowerCase() : 'text';
                if (['text', 'email', 'password', 'tel', 'url', 'number', 'search'].includes(type)) return '_input';
                if (type === 'checkbox') return '_checkbox';
                if (type === 'radio') return '_radio';
                if (type === 'submit' || type === 'button') return '_button';
                return '_input';
            }
            if (tagName === 'textarea') return '_input';
            if (tagName === 'select') return '_select';
            if (tagName === 'button') return '_button';
            if (tagName === 'a') return '_link';
            return '_elem';
        }

        document.querySelectorAll('input, textarea, select').forEach((el: any) => {
            if (el.type === 'hidden') return;
            const selector = getBestSelector(el);
            let rawName = el.name || el.id || el.placeholder || el.getAttribute('aria-label') || 'input';
            rawName = rawName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            if (/^\d+$/.test(rawName)) return;
            const nameWithSuffix = rawName + getSuffix(el);
            const name = makeUnique(nameWithSuffix);
            elements.push({ name, selector });
        });

        document.querySelectorAll('button, input[type="submit"], input[type="button"], a').forEach((el: any) => {
            if (el.tagName.toLowerCase() === 'a' && !el.href && !el.onclick && !el.getAttribute('role')) return;
            const selector = getBestSelector(el);
            if (elements.some(e => e.selector === selector)) return;
            const text = el.innerText ? el.innerText.trim() : '';
            let rawName = text || el.id || el.getAttribute('aria-label') || el.title || el.tagName.toLowerCase();
            rawName = rawName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            if (/^\d+$/.test(rawName)) return;
            if (rawName.length > 20) rawName = rawName.substring(0, 20);

            const nameWithSuffix = (rawName || 'element') + getSuffix(el);
            const name = makeUnique(nameWithSuffix);
            elements.push({ name, selector });
        });

        if (mode === 'json') {
            return elements;
        }

        const lines: string[] = [];
        if (lang === 'typescript') {
            lines.push(`import { BasePage } from './BasePage';\nimport { Page } from '@playwright/test';\n\nexport class ${clsName} extends BasePage {`);
            elements.forEach(el => lines.push(`    readonly ${el.name}: string = '${el.selector.replace(/'/g, "\\'")}';`));
            lines.push(`\n    constructor(page: Page) {\n        super(page);\n    }`);
        } else if (lang === 'java') {
            lines.push(`package pages;\nimport com.microsoft.playwright.*;\nimport com.microsoft.playwright.options.AriaRole;\n\npublic class ${clsName} extends BasePage {`);
            lines.push(`    private final Page page;`);

            lines.push(`\n    public ${clsName}(Page page) {\n        super(page);\n        this.page = page;\n    }`);

            const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

            elements.forEach(el => {
                const methodName = toCamelCase(el.name);
                let locatorCode = '';

                if (el.selector.startsWith('role=')) {
                    const match = el.selector.match(/^role=([a-z]+)(?:\[name="(.+)"\])?$/);
                    if (match) {
                        const role = match[1].toUpperCase();
                        const name = match[2] ? match[2].replace(/\\"/g, '"') : null;
                        let ariaRole = role;
                        if (role === 'IMAGE') ariaRole = 'IMG';

                        if (name) {
                            locatorCode = `return page.getByRole(AriaRole.${ariaRole}, new Page.GetByRoleOptions().setName("${name}"));`;
                        } else {
                            locatorCode = `return page.getByRole(AriaRole.${ariaRole});`;
                        }
                    } else {
                        locatorCode = `return page.locator("${el.selector.replace(/"/g, "\\\"")}");`;
                    }
                } else if (el.selector.startsWith('text=')) {
                    const text = el.selector.match(/text="(.+)"/)[1];
                    locatorCode = `return page.getByText("${text.replace(/"/g, "\\\"")}");`;
                } else if (el.selector.startsWith('label=')) {
                    const label = el.selector.match(/label="(.+)"/)[1];
                    locatorCode = `return page.getByLabel("${label.replace(/"/g, "\\\"")}");`;
                } else if (el.selector.startsWith('placeholder=')) {
                    const val = el.selector.match(/placeholder="(.+)"/)[1];
                    locatorCode = `return page.getByPlaceholder("${val.replace(/"/g, "\\\"")}");`;
                } else if (el.selector.startsWith('alt=')) {
                    const val = el.selector.match(/alt="(.+)"/)[1];
                    locatorCode = `return page.getByAltText("${val.replace(/"/g, "\\\"")}");`;
                } else if (el.selector.startsWith('title=')) {
                    const val = el.selector.match(/title="(.+)"/)[1];
                    locatorCode = `return page.getByTitle("${val.replace(/"/g, "\\\"")}");`;
                } else if (el.selector.startsWith('testid=')) {
                    const val = el.selector.match(/testid="(.+)"/)[1];
                    locatorCode = `return page.getByTestId("${val.replace(/"/g, "\\\"")}");`;
                } else {
                    locatorCode = `return page.locator("${el.selector.replace(/"/g, "\\\"")}");`;
                }

                lines.push(`\n    private Locator ${methodName}() {\n        ${locatorCode}\n    }`);
            });
        } else if (lang === 'python') {
            lines.push(`from .base_page import BasePage\nfrom playwright.sync_api import Page\n\nclass ${clsName}(BasePage):`);
            lines.push(`    def __init__(self, page: Page):`);
            lines.push(`        super().__init__(page)`);
            elements.forEach(el => lines.push(`        self.${el.name} = '${el.selector.replace(/'/g, "\\'")}'`));
        }

        // Methods
        const searchEl = elements.find(el => el.name.includes('search'));
        if (searchEl) {
            if (lang === 'typescript') {
                lines.push(`\n    async search(query: string) {\n        await this.fill(this.${searchEl.name}, query);\n        await this.pressKey(this.${searchEl.name}, 'Enter');\n    }`);
            } else if (lang === 'java') {
                const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                const methodName = toCamelCase(searchEl.name);
                lines.push(`\n    public void search(String query) {\n        ${methodName}().fill(query);\n        ${methodName}().press("Enter");\n    }`);
            } else if (lang === 'python') {
                lines.push(`\n    async def search(self, query: str):\n        await self.fill(self.${searchEl.name}, query)\n        await self.press_key(self.${searchEl.name}, 'Enter')`);
            }
        }
        lines.push(`}`);
        return lines.join('\n');
    }, { clsName: className, lang: language, mode });
}

run();
