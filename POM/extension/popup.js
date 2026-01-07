document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generateBtn');
    const classNameInput = document.getElementById('className');
    const resultArea = document.getElementById('resultArea');
    const outputCode = document.getElementById('outputCode');
    const outputTable = document.getElementById('outputTable');
    const copyBtn = document.getElementById('copyBtn');
    const aiBtn = document.getElementById('aiBtn');
    const locatorsBtn = document.getElementById('locatorsBtn');

    const sourceRadios = document.getElementsByName('source');
    const pasteDomGroup = document.getElementById('pasteDomGroup');
    const pastedDomInput = document.getElementById('pastedDom');
    const languageSelect = document.getElementById('languageSelect');
    const statusMessage = document.getElementById('statusMessage');

    // ========== DRAG AND RESIZE FUNCTIONALITY ==========
    const draggableHeader = document.querySelector('.draggable-header');
    const resizeHandles = document.querySelectorAll('.resize-handle');

    let isDragging = false;
    let isResizing = false;
    let currentHandle = null;
    let startX, startY, startWidth, startHeight;

    // Load saved dimensions and apply them
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['popupWidth', 'popupHeight'], (result) => {
            if (result.popupWidth) {
                document.body.style.width = result.popupWidth + 'px';
            }
            if (result.popupHeight) {
                document.body.style.height = result.popupHeight + 'px';
            }
        });
    }

    // Drag functionality
    draggableHeader.addEventListener('mousedown', (e) => {
        // Only drag if clicking on header area or drag handle, not on buttons or settings
        if (e.target.tagName === 'BUTTON' ||
            e.target.closest('button') ||
            e.target.closest('.header-actions')) {
            return;
        }
        isDragging = true;
        draggableHeader.classList.add('dragging');
        startX = e.clientX;
        startY = e.clientY;
        e.preventDefault();
    });

    // Resize functionality
    resizeHandles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            currentHandle = handle.dataset.direction;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = document.body.offsetWidth;
            startHeight = document.body.offsetHeight;
            document.body.classList.add('resizing');
            e.preventDefault();
            e.stopPropagation();
        });
    });

    let resizeAnimationFrame;
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault();
            // Attempt to move the window (works in detached panels/windows)
            window.moveBy(e.movementX, e.movementY);
        }

        if (isResizing && currentHandle) {
            e.preventDefault();

            if (resizeAnimationFrame) cancelAnimationFrame(resizeAnimationFrame);

            resizeAnimationFrame = requestAnimationFrame(() => {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                let newWidth = startWidth;
                let newHeight = startHeight;

                // Calculate new dimensions based on resize direction
                if (currentHandle.includes('e')) {
                    newWidth = startWidth + deltaX;
                }
                if (currentHandle.includes('w')) {
                    newWidth = startWidth - deltaX;
                }
                if (currentHandle.includes('s')) {
                    newHeight = startHeight + deltaY;
                }
                if (currentHandle.includes('n')) {
                    newHeight = startHeight - deltaY;
                }

                // Apply constraints
                const minWidth = 350;
                const minHeight = 400;
                const maxWidth = 800;
                const maxHeight = 900;

                newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
                newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

                // Apply new dimensions
                document.body.style.width = newWidth + 'px';
                document.body.style.height = newHeight + 'px';
            });
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            draggableHeader.classList.remove('dragging');
        }

        if (isResizing) {
            isResizing = false;
            currentHandle = null;
            document.body.classList.remove('resizing');

            // Save dimensions
            if (chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({
                    popupWidth: document.body.offsetWidth,
                    popupHeight: document.body.offsetHeight
                });
            }
        }
    });
    // ========== END DRAG AND RESIZE FUNCTIONALITY ==========


    function showStatus() {
        if (statusMessage) {
            statusMessage.classList.remove('hidden');
            setTimeout(() => {
                statusMessage.classList.add('hidden');
            }, 3000);
        }
    }

    sourceRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) {
                pasteDomGroup.classList.toggle('hidden', radio.value !== 'paste');
            }
        });
    });

    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const aiProviderSelect = document.getElementById('aiProvider');
    const apiKeyInput = document.getElementById('apiKey');
    const baseUrlInput = document.getElementById('baseUrl');
    const baseUrlGroup = document.getElementById('baseUrlGroup');

    // Load settings
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['aiProvider', 'apiKey', 'baseUrl'], (result) => {
            if (result.aiProvider) aiProviderSelect.value = result.aiProvider;
            if (result.apiKey) apiKeyInput.value = result.apiKey;
            if (result.baseUrl) baseUrlInput.value = result.baseUrl;
            toggleBaseUrlVisibility();
        });
    } else {
        console.warn('chrome.storage.local is not available.');
    }

    if (aiProviderSelect) {
        aiProviderSelect.addEventListener('change', toggleBaseUrlVisibility);
    }

    function toggleBaseUrlVisibility() {
        if (baseUrlGroup && aiProviderSelect) {
            baseUrlGroup.style.display = aiProviderSelect.value === 'local' ? 'block' : 'none';
        }
    }

    if (settingsBtn && settingsPanel) {
        settingsBtn.addEventListener('click', () => {
            settingsPanel.classList.toggle('hidden');
        });
    }

    saveSettingsBtn.addEventListener('click', () => {
        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
                aiProvider: aiProviderSelect.value,
                apiKey: apiKeyInput.value,
                baseUrl: baseUrlInput.value
            }, () => {
                alert('Settings saved!');
                settingsPanel.classList.add('hidden');
            });
        } else {
            alert('Storage is not available. Please ensure the extension is installed correctly.');
        }
    });

    aiBtn.addEventListener('click', async () => {
        const className = classNameInput.value.trim() || 'MyPage';
        const language = languageSelect.value;
        aiBtn.innerHTML = '<span class="icon">⏳</span> Thinking...';
        aiBtn.disabled = true;
        aiBtn.classList.add('active');
        generateBtn.classList.remove('active');

        // Reset UI state
        outputTable.classList.add('hidden');
        outputCode.classList.remove('hidden');

        // Check settings
        let settings = { aiProvider: 'openai', apiKey: '', baseUrl: '' };
        if (chrome.storage && chrome.storage.local) {
            settings = await chrome.storage.local.get(['aiProvider', 'apiKey', 'baseUrl']);
        }
        if (!settings.apiKey && settings.aiProvider !== 'local') {
            alert('Please configure your API Key in settings.');
            settingsPanel.classList.remove('hidden');
            resetBtns();
            return;
        }

        // Determine source
        const selectedSource = Array.from(sourceRadios).find(r => r.checked)?.value;

        try {
            let html;
            if (selectedSource === 'paste') {
                html = pastedDomInput.value;
            } else {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: captureHTML
                });
                html = results[0].result;
            }

            // Use generatePOM_Logic to extract robust locators
            // passing 'json' as returnMode
            const elements = generatePOM_Logic(className, html, language, false, 'json');

            const code = await callAI(className, settings, elements, language);
            if (code) {
                outputCode.textContent = code;
                resultArea.classList.remove('hidden');
                showStatus();
            }
        } catch (err) {
            outputCode.textContent = '// AI Error: ' + err.message;
            resultArea.classList.remove('hidden');
        } finally {
            resetBtns();
        }
    });

    generateBtn.addEventListener('click', async () => {
        const className = classNameInput.value.trim() || 'MyPage';
        const language = languageSelect.value;
        generateBtn.innerHTML = '<span class="icon">⏳</span> Generating...';
        generateBtn.disabled = true;
        generateBtn.classList.add('active');
        aiBtn.classList.remove('active');

        // Reset UI state
        outputTable.classList.add('hidden');
        outputCode.classList.remove('hidden');

        // Determine source
        const selectedSource = Array.from(sourceRadios).find(r => r.checked)?.value;

        try {
            let results;
            if (selectedSource === 'paste') {
                const html = pastedDomInput.value;
                const code = generatePOM_Logic(className, html, language);
                results = [{ result: code }];
            } else {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab.id) throw new Error('Cannot access current tab.');
                const injectionResults = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: captureHTML
                });
                const html = injectionResults[0].result;
                const code = generatePOM_Logic(className, html, language);
                results = [{ result: code }];
            }

            if (results && results[0] && results[0].result) {
                const code = results[0].result;
                outputCode.textContent = code;
                resultArea.classList.remove('hidden');
                showStatus();
            } else {
                outputCode.textContent = '// Error: No content generated.';
                resultArea.classList.remove('hidden');
            }
        } catch (err) {
            outputCode.textContent = '// Error: ' + err.message;
            resultArea.classList.remove('hidden');
        } finally {
            resetBtns();
        }
    });

    locatorsBtn.addEventListener('click', async () => {
        const className = classNameInput.value.trim() || 'MyPage';
        const language = languageSelect.value;
        locatorsBtn.innerHTML = '<span class="icon">⏳</span> Analyzing...';
        locatorsBtn.disabled = true;
        locatorsBtn.classList.add('active');
        generateBtn.classList.remove('active');
        aiBtn.classList.remove('active');

        const selectedSource = Array.from(sourceRadios).find(r => r.checked)?.value;

        try {
            let results;
            if (selectedSource === 'paste') {
                const html = pastedDomInput.value.trim();
                if (!html) throw new Error('Please paste some HTML/DOM snippet first.');
                const code = generatePOM_Logic(className, html, language, true);
                results = [{ result: code }];
            } else {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                const injectionResults = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: captureHTML
                });
                const html = injectionResults[0].result;
                const code = generatePOM_Logic(className, html, language, true);
                results = [{ result: code }];
            }

            if (results && results[0] && results[0].result && results[0].result.trim() !== '') {
                // If it's a table (starts with <table), show in outputTable, else show in outputCode
                if (results[0].result.includes('id="locatorsTable"')) {
                    outputTable.innerHTML = results[0].result;
                    outputTable.classList.remove('hidden');
                    outputCode.classList.add('hidden');
                } else {
                    outputCode.textContent = results[0].result;
                    outputCode.classList.remove('hidden');
                    outputTable.classList.add('hidden');
                }
                resultArea.classList.remove('hidden');
                showStatus();
            } else {
                outputCode.textContent = '// Info: No interactive elements (buttons, inputs, etc.) detected in the provided source.';
                outputCode.classList.remove('hidden');
                outputTable.classList.add('hidden');
                resultArea.classList.remove('hidden');
            }
        } catch (err) {
            outputCode.textContent = '// Error: ' + err.message;
            resultArea.classList.remove('hidden');
        } finally {
            resetBtns();
        }
    });

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (outputCode) {
                const code = outputCode.textContent;
                navigator.clipboard.writeText(code).then(() => {
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                    }, 2000);
                });
            }
        });
    }

    // Listener for Table clicks (Copy Code Snippets)
    if (outputTable) {
        outputTable.addEventListener('click', (e) => {
            const cell = e.target.closest('.copy-cell');
            if (cell) {
                const checkbox = document.getElementById('copyRawCheckbox');
                const useRaw = checkbox && checkbox.checked;

                const textToCopy = useRaw ? cell.dataset.value : cell.dataset.code;

                if (textToCopy) {
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        const typeLabel = useRaw ? 'raw value' : 'code';
                        showStatus(`Copied ${typeLabel} to clipboard!`, 'success');

                        // Visual feedback on cell
                        const originalBg = cell.style.backgroundColor;
                        cell.style.backgroundColor = 'rgba(0, 255, 136, 0.2)';
                        setTimeout(() => {
                            cell.style.backgroundColor = originalBg;
                        }, 300);
                    }).catch(err => {
                        console.error('Copy failed', err);
                        showStatus('Copy failed', 'error');
                    });
                }
            }
        });
    }

    function showStatus(msg, type = 'success') {
        if (!statusMessage) return;
        statusMessage.textContent = msg || '';
        statusMessage.style.color = type === 'error' ? '#ff6b6b' : '#00ff88';
        // Ensure visibility
        statusMessage.style.display = 'block';
        if (msg) {
            setTimeout(() => {
                statusMessage.textContent = '';
            }, 3000);
        }
    }

    function resetBtns() {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<span class="icon">⚡</span> Generate POM';
        generateBtn.classList.remove('active');
        aiBtn.disabled = false;
        aiBtn.innerHTML = '<span class="icon">🤖</span> AI Agent';
        aiBtn.classList.remove('active');
        locatorsBtn.disabled = false;
        locatorsBtn.innerHTML = '<span class="icon">🔍</span> Locators Only';
        locatorsBtn.classList.remove('active');
    }

    /**
     * Parses raw HTML string and extracts element info for AI
     */
    function parseHTML(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const elements = [];

        doc.querySelectorAll('button, input, select, textarea, a').forEach(el => {
            elements.push({
                role: el.getAttribute('role') || el.tagName.toLowerCase(),
                name: el.getAttribute('aria-label') || (el.labels && el.labels[0]?.innerText) || el.placeholder || el.innerText?.trim() || '',
                type: el.type || undefined,
                id: el.id || undefined,
                class: el.className || undefined
            });
        });
        return elements;
    }

    /**
     * Runs heuristic generation logic on a specific root element/document
     */
    function generatePOM_Logic(className, source, language = 'typescript', locatorsOnly = false, returnMode = 'code') {
        let root = source;
        if (typeof source === 'string') {
            const parser = new DOMParser();
            root = parser.parseFromString(source, 'text/html');
        }

        const escape = (str) => str.replace(/'/g, "\\'").replace(/"/g, '\\"');

        function isDynamic(value) {
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

        // --- NEW REFERENCE LOGIC START ---
        function generateGetByRole(element) {
            const role = element.getAttribute('role') || getImplicitRole(element);
            if (!role) return null;
            let name = element.textContent?.trim() ||
                element.getAttribute('aria-label') ||
                element.getAttribute('title') ||
                (element.tagName === 'INPUT' ? element.value : '') || '';

            // Refined check for useful roles
            if (['button', 'link', 'heading', 'checkbox', 'radio', 'img', 'textbox', 'searchbox', 'spinbutton', 'combobox', 'listbox', 'listitem', 'list', 'tab', 'switch'].includes(role)) {
                if (name && name.length < 50) {
                    // Clean name (simple version without advanced unicode regex if not supported, but basic is fine)
                    const cleanName = name.replace(/[\n\r\t]/g, ' ').trim();
                    if (cleanName) {
                        return `role=${role}[name="${escape(cleanName)}"]`;
                    }
                }
                // Return role without name if explicit name not found but role is valid interactive element
                // But usually we want strict locators. 
                return `role=${role}`;
            }
            return null;
        }

        function getImplicitRole(el) {
            const tag = el.tagName.toLowerCase();
            if (tag === 'button') return 'button';
            if (tag === 'a' && el.href) return 'link';
            if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return 'heading';
            if (tag === 'img') return 'img'; // Explicitly handled in Playwright
            if (tag === 'ul' || tag === 'ol') return 'list';
            if (tag === 'li') return 'listitem';
            if (tag === 'input') {
                const type = (el.type || 'text').toLowerCase();
                if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
                if (type === 'checkbox') return 'checkbox';
                if (type === 'radio') return 'radio';
                if (type === 'search') return 'searchbox';
                if (type === 'number') return 'spinbutton';
                if (['text', 'email', 'password', 'tel', 'url'].includes(type)) return 'textbox';
            }
            if (tag === 'textarea') return 'textbox';
            if (tag === 'select') return (el.hasAttribute('multiple') || el.size > 1) ? 'listbox' : 'combobox';
            return null;
        }

        function generateGetByText(element) {
            const text = element.textContent?.trim();
            if (text && text.length > 0 && text.length < 50) {
                return `text="${escape(text)}"`;
            }
            return null;
        }

        function generateGetByLabel(element) {
            let labelText = null;
            if (element.id) {
                // We are in a parsed DOM, so document.querySelector might not work if root is fragment.
                // Using root.querySelector
                const label = root.querySelector(`label[for="${element.id}"]`);
                if (label) labelText = label.textContent.trim();
            }
            if (!labelText) labelText = element.getAttribute('aria-label');

            if (labelText) {
                return `label="${escape(labelText)}"`;
            }
            return null;
        }

        function generateGetByPlaceholder(element) {
            const val = element.getAttribute('placeholder');
            if (val) return `placeholder="${escape(val)}"`;
            return null;
        }

        function generateGetByAltText(element) {
            const val = element.getAttribute('alt');
            if (val) return `alt="${escape(val)}"`;
            return null;
        }

        function generateGetByTitle(element) {
            const val = element.getAttribute('title');
            if (val) return `title="${escape(val)}"`;
            return null;
        }

        function generateGetByTestId(element) {
            const val = element.getAttribute('data-testid') || element.getAttribute('data-test-id') || element.getAttribute('data-test');
            if (val) return `testid="${escape(val)}"`;
            return null;
        }

        function generateCSSSelector(element) {
            // Basic fallback if no robust logic (or use the one from reference if needed)
            const testId = element.getAttribute('data-testid') || element.getAttribute('data-test');
            if (testId && !isDynamic(testId)) return `[data-testid="${testId}"]`;
            if (element.id && !isDynamic(element.id)) return `#${element.id}`;
            if (element.name && !isDynamic(element.name)) return `[name="${element.name}"]`;

            const classes = Array.from(element.classList).filter(c => !isDynamic(c)).join('.');
            if (classes) return `${element.tagName.toLowerCase()}.${classes}`;
            return element.tagName.toLowerCase();
        }

        function getXPath(element) {
            // ... reusing existing simplistic XPath or using reference logic?
            // Reference logic is DOM dependent and heavy. Stick to simple for now unless requested.
            if (element.id && !isDynamic(element.id)) return `//*[@id="${element.id}"]`;
            return `/html/body/...`; // Placeholder or simplistic logic
        }
        // --- NEW REFERENCE LOGIC END ---

        // --- CODE GENERATION HELPERS ---
        function getActionStr(lang, action) {
            if (action === 'click') return '.click()';
            if (action === 'check') return '.check()';
            if (action === 'fill') return lang === 'java' ? '.fill("value")' : ".fill('value')";
            if (action === 'selectOption') return lang === 'java' ? '.selectOption("value")' : ".selectOption('value')";
            return '.click()';
        }

        function generatePythonCode(best, action) {
            const { method, value } = best;
            const act = getActionStr('python', action);
            if (method === 'locator') return `page.locator('${escape(value)}')${act}`;
            if (method === 'getByRole' && value.includes('|')) {
                const [role, name] = value.split('|');
                return `page.get_by_role('${role}', name='${escape(name)}')${act}`;
            }
            const pyMethod = method.replace(/([A-Z])/g, "_$1").toLowerCase();
            return `page.${pyMethod}('${escape(value)}')${act}`;
        }

        function generateJSCode(best, action) {
            const { method, value } = best;
            const act = getActionStr('javascript', action).replace(/\)$/, ');');
            if (method === 'locator') return `await page.locator('${escape(value)}')${act}`;
            if (method === 'getByRole' && value.includes('|')) {
                const [role, name] = value.split('|');
                return `await page.getByRole('${role}', { name: '${escape(name)}' })${act}`;
            }
            return `await page.${method}('${escape(value)}')${act}`;
        }

        function generateJavaCode(best, action) {
            const { method, value } = best;
            const act = getActionStr('java', action) + ';';
            if (method === 'locator') return `page.locator("${escape(value)}")${act}`;
            if (method === 'getByRole' && value.includes('|')) {
                const [role, name] = value.split('|');
                return `page.getByRole(AriaRole.${role.toUpperCase()}, new Page.GetByRoleOptions().setName("${escape(name)}"))${act}`;
            }
            if (method === 'getByRole') {
                // value is just role
                return `page.getByRole(AriaRole.${value.toUpperCase()})${act}`;
            }
            return `page.${method}("${escape(value)}")${act}`;
        }

        function deriveAction(el) {
            const tag = el.tagName.toLowerCase();
            const inputType = el.type ? el.type.toLowerCase() : '';
            if (tag === 'select') return 'selectOption';
            if (tag === 'textarea') return 'fill';
            if (tag === 'input') {
                if (['checkbox', 'radio'].includes(inputType)) return 'check';
                if (['text', 'password', 'email', 'search', 'tel', 'url', 'number', 'date', 'datetime-local'].includes(inputType)) return 'fill';
            }
            return 'click';
        }

        function getBestSelectorObject(el) {
            const role = generateGetByRole(el);
            // role format: role=BUTTON[name="foo"] or role=BUTTON
            if (role) {
                if (role.includes('name=')) {
                    // Parse role=type[name="val"]
                    const match = role.match(/^role=([a-z]+)\[name="(.+)"\]$/);
                    if (match) {
                        return { type: 'role', value: `${match[1]}|${match[2]}`, method: 'getByRole' };
                    }
                } else {
                    const match = role.match(/^role=([a-z]+)$/);
                    if (match) {
                        return { type: 'role', value: match[1], method: 'getByRole' };
                    }
                }
                // If complex parsing fails, fallthru or return locator
            }

            const testId = generateGetByTestId(el);
            if (testId) return { type: 'testid', value: testId.replace('testid="', '').replace('"', ''), method: 'getByTestId' };

            const text = generateGetByText(el);
            if (text) return { type: 'text', value: text.replace('text="', '').replace('"', ''), method: 'getByText' };

            const label = generateGetByLabel(el);
            if (label) return { type: 'label', value: label.replace('label="', '').replace('"', ''), method: 'getByLabel' };

            const placeholder = generateGetByPlaceholder(el);
            if (placeholder) return { type: 'placeholder', value: placeholder.replace('placeholder="', '').replace('"', ''), method: 'getByPlaceholder' };

            const alt = generateGetByAltText(el);
            if (alt) return { type: 'alt', value: alt.replace('alt="', '').replace('"', ''), method: 'getByAltText' };

            const title = generateGetByTitle(el);
            if (title) return { type: 'title', value: title.replace('title="', '').replace('"', ''), method: 'getByTitle' };

            // Fallbacks
            if (role) return { type: 'role', value: role, method: 'locator' }; // Should cover fallback

            return { type: 'css', value: generateCSSSelector(el), method: 'locator' };
        }

        function getBestSelector(el) {
            const obj = getBestSelectorObject(el);
            // Reconstruct string representation if needed, or just use what we had
            if (obj.method === 'getByRole' && obj.value.includes('|')) {
                const parts = obj.value.split('|');
                return `role=${parts[0]}[name="${parts[1]}"]`;
            }
            if (obj.method === 'getByRole') return `role=${obj.value}`;
            if (obj.method === 'getByTestId') return `[data-testid="${obj.value}"]`;
            if (obj.method === 'getByText') return `text="${obj.value}"`;
            if (obj.method === 'getByLabel') return `label="${obj.value}"`;
            if (obj.method === 'getByPlaceholder') return `placeholder="${obj.value}"`;
            if (obj.method === 'getByAltText') return `alt="${obj.value}"`;
            if (obj.method === 'getByTitle') return `title="${obj.value}"`;
            return obj.value;
        }

        const names = new Set();
        function makeUnique(baseName) {
            let name = baseName;
            let counter = 2;
            while (names.has(name)) {
                name = `${baseName}_${counter++}`;
            }
            names.add(name);
            return name;
        }

        function getSuffix(el) {
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

        const elements = [];
        const searchRoot = root.body || root;

        // Helper to collect data
        const collectData = (el, type) => {
            const role = generateGetByRole(el);
            const text = generateGetByText(el);
            const label = generateGetByLabel(el);
            const placeholder = generateGetByPlaceholder(el);
            const alt = generateGetByAltText(el);
            const title = generateGetByTitle(el);
            const testId = generateGetByTestId(el);
            const css = generateCSSSelector(el);
            const xpath = getXPath(el);
            const best = getBestSelector(el);
            const bestObj = getBestSelectorObject(el);

            return { role, text, label, placeholder, alt, title, testId, css, xpath, best, bestObj };
        };

        searchRoot.querySelectorAll('input, textarea, select').forEach(el => {
            if (el.type === 'hidden') return;

            const data = collectData(el, 'input');

            let rawName = el.name || el.id || el.placeholder || el.getAttribute('aria-label') || 'input';
            rawName = rawName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            if (/^\d+$/.test(rawName)) return;
            const nameWithSuffix = rawName + getSuffix(el);
            const name = makeUnique(nameWithSuffix);

            elements.push({ name, selector: data.best, ...data, type: 'input', element: el });
        });

        searchRoot.querySelectorAll('button, input[type="submit"], input[type="button"], a, [role="button"], [role="link"], [onclick], img').forEach(el => {
            if (el.tagName.toLowerCase() === 'a' && !el.href && !el.onclick && !el.getAttribute('role')) return;
            // Avoid duplication if an input button was already caught
            if (el.tagName.toLowerCase() === 'input' && ['submit', 'button', 'image', 'reset'].includes(el.type)) {
                // Check if already in elements by checking for exact match or similar
                // But inputs loop caught them.
                // Actually inputs loop query: 'input, textarea, select'. 
                // So inputs loop caught input[type=submit] etc. 
                // We should avoid duplicating.
                return;
            }

            const data = collectData(el, 'button');
            if (elements.some(e => e.selector === data.best)) return;

            const textContent = el.innerText ? el.innerText.trim() : '';
            let rawName = textContent || el.id || el.getAttribute('aria-label') || el.title || el.tagName.toLowerCase();
            rawName = rawName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            if (/^\d+$/.test(rawName)) return;
            if (rawName.length > 20) rawName = rawName.substring(0, 20);

            const nameWithSuffix = (rawName || 'element') + getSuffix(el);
            const name = makeUnique(nameWithSuffix);

            elements.push({ name, selector: data.best, ...data, type: 'button', element: el });
        });

        if (returnMode === 'json') {
            return elements.map(el => {
                const action = deriveAction(el.element);
                let bestSnippet = '';
                if (language === 'java') bestSnippet = generateJavaCode(el.bestObj, action);
                else if (language === 'python') bestSnippet = generatePythonCode(el.bestObj, action);
                else bestSnippet = generateJSCode(el.bestObj, action);

                return {
                    name: el.name,
                    type: el.type,
                    role: el.role,
                    text: el.text,
                    label: el.label,
                    placeholder: el.placeholder,
                    bestSelectorRaw: el.selector,
                    bestSelectorSnippet: bestSnippet
                };
            });
        }

        if (locatorsOnly) {
            const escapeHtml = (str) => {
                if (!str) return '';
                return str.replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            };

            let html = `
            <div style="padding: 8px; margin-bottom: 5px; background: #262626; border-radius: 4px; display: flex; align-items: center;">
                <label style="cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 13px; color: #ddd;">
                    <input type="checkbox" id="copyRawCheckbox" style="cursor: pointer;"> 
                    <span>Copy Raw Selector Value (e.g. <code>role=button</code>) instead of Code</span>
                </label>
            </div>
            <table class="data-table" id="locatorsTable"><thead><tr>`;
            html += '<th>Name</th>';
            html += '<th>Snippet (' + language + ')</th>';
            html += '<th>Role</th>';
            html += '<th>Text</th>';
            html += '<th>Label</th>';
            html += '<th>Placeholder</th>';
            html += '<th>AltText</th>';
            html += '<th>Title</th>';
            html += '<th>TestId</th>';
            html += '<th>CSS</th>';
            html += '<th>XPath</th>';
            html += '</tr></thead><tbody>';

            elements.forEach(el => {
                const action = deriveAction(el.element);

                // Helper to generate code for a specific strategy
                const getCode = (strategy, val) => {
                    if (!val || val === '-') return '';
                    let obj = { type: strategy, value: val, method: 'locator' }; // default

                    // Parse based on strategy
                    if (strategy === 'role') {
                        if (val.includes('name=')) {
                            const match = val.match(/^role=([a-z]+)\[name="(.+)"\]$/);
                            if (match) obj = { type: 'role', value: `${match[1]}|${match[2]}`, method: 'getByRole' };
                        } else {
                            const match = val.match(/^role=([a-z]+)$/);
                            if (match) obj = { type: 'role', value: match[1], method: 'getByRole' };
                        }
                    } else if (strategy === 'text') {
                        obj = { type: 'text', value: val.replace(/^text="|"/g, ''), method: 'getByText' };
                    } else if (strategy === 'label') {
                        obj = { type: 'label', value: val.replace(/^label="|"/g, ''), method: 'getByLabel' };
                    } else if (strategy === 'placeholder') {
                        obj = { type: 'placeholder', value: val.replace(/^placeholder="|"/g, ''), method: 'getByPlaceholder' };
                    } else if (strategy === 'alt') {
                        obj = { type: 'alt', value: val.replace(/^alt="|"/g, ''), method: 'getByAltText' };
                    } else if (strategy === 'title') {
                        obj = { type: 'title', value: val.replace(/^title="|"/g, ''), method: 'getByTitle' };
                    } else if (strategy === 'testid') {
                        obj = { type: 'testid', value: val.replace(/^testid="|"/g, ''), method: 'getByTestId' };
                    } else if (strategy === 'css') {
                        obj = { type: 'css', value: val, method: 'locator' };
                    } else if (strategy === 'xpath') {
                        obj = { type: 'xpath', value: val, method: 'locator' };
                    }

                    if (language === 'java') return generateJavaCode(obj, action);
                    if (language === 'python') return generatePythonCode(obj, action);
                    return generateJSCode(obj, action);
                };

                const mainSnippet = getCode('best', el.bestObj.value);
                let bestSnippet = '';
                if (language === 'java') bestSnippet = generateJavaCode(el.bestObj, action);
                else if (language === 'python') bestSnippet = generatePythonCode(el.bestObj, action);
                else bestSnippet = generateJSCode(el.bestObj, action);

                // Helper to create cell
                const cell = (strategy, val) => {
                    if (!val || val === '-') return '<td><div class="scroll-cell">-</div></td>';
                    const code = getCode(strategy, val);
                    return `<td class="copy-cell" data-code="${escapeHtml(code)}" data-value="${escapeHtml(val)}" title="Click to copy">
                        <div class="scroll-cell">${val}</div>
                     </td>`;
                };

                html += `<tr>
                    <td>${el.name}</td>
                    <td class="copy-cell best-cell" data-code="${escapeHtml(bestSnippet)}" data-value="${escapeHtml(el.selector)}" title="Click to copy"><div class="scroll-cell" style="font-weight:bold; color:#d9f99d; font-family:monospace;">${bestSnippet}</div></td>
                    ${cell('role', el.role)}
                    ${cell('text', el.text)}
                    ${cell('label', el.label)}
                    ${cell('placeholder', el.placeholder)}
                    ${cell('alt', el.alt)}
                    ${cell('title', el.title)}
                    ${cell('testid', el.testId)}
                    ${cell('css', el.css)}
                    ${cell('xpath', el.xpath)}
                </tr>`;
            });
            html += '</tbody></table>';

            // We need to attach the listener AFTER the table is injected.
            // Since this function returns string and populates innerHTML later, we can't attach here.
            // But we can attach a delegated listener to the outputTable container once.
            // We'll rely on the existing setup or add a global listener check.
            return html;
        }

        const lines = [];
        if (language === 'typescript') {
            lines.push(`import { BasePage } from './BasePage';\nimport { Page } from '@playwright/test';\n\nexport class ${className} extends BasePage {`);
            elements.forEach(el => lines.push(`    readonly ${el.name}: string = '${el.selector.replace(/'/g, "\\'")}';`));
            lines.push(`\n    constructor(page: Page) {\n        super(page);\n    }`);
        } else if (language === 'java') {
            lines.push(`package pages;\nimport com.microsoft.playwright.*;\nimport com.microsoft.playwright.options.AriaRole;\n\npublic class ${className} extends BasePage {`);
            lines.push(`    private final Page page;`);

            lines.push(`\n    public ${className}(Page page) {\n        super(page);\n        this.page = page;\n    }`);

            const toCamelCase = (str) => {
                return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            };

            elements.forEach(el => {
                const methodName = toCamelCase(el.name);
                let locatorCode = '';

                if (el.selector.startsWith('role=')) {
                    // content format: role=type[name="value"] or role=type
                    const match = el.selector.match(/^role=([a-z]+)(?:\[name="(.+)"\])?$/);
                    if (match) {
                        const role = match[1].toUpperCase();
                        const name = match[2] ? match[2].replace(/\\"/g, '"') : null; // Unescape quotes if any

                        // Map specific roles if needed, otherwise rely on direct uppercase mapping for AriaRole enum
                        // AriaRole enums: BUTTON, CHECKBOX, LINK, TEXTBOX, HEADING, etc.
                        let ariaRole = role;
                        if (role === 'IMAGE') ariaRole = 'IMG';

                        if (name) {
                            locatorCode = `return page.getByRole(AriaRole.${ariaRole}, new Page.GetByRoleOptions().setName("${name}"));`;
                        } else {
                            locatorCode = `return page.getByRole(AriaRole.${ariaRole});`;
                        }
                    } else {
                        // Fallback if parsing fails (shouldn't happen with current logic)
                        locatorCode = `return page.locator("${el.selector.replace(/"/g, "\\\"")}");`;
                    }
                } else {
                    // CSS/XPath/ID
                    locatorCode = `return page.locator("${el.selector.replace(/"/g, "\\\"")}");`;
                }

                lines.push(`\n    private Locator ${methodName}() {\n        ${locatorCode}\n    }`);
            });
        } else if (language === 'python') {
            lines.push(`from .base_page import BasePage\nfrom playwright.sync_api import Page\n\nclass ${className}(BasePage):`);
            lines.push(`    def __init__(self, page: Page):`);
            lines.push(`        super().__init__(page)`);
            elements.forEach(el => lines.push(`        self.${el.name} = '${el.selector.replace(/'/g, "\\'")}'`));
        }

        // Methods
        const searchEl = elements.find(el => el.name.includes('search'));
        if (searchEl) {
            if (language === 'typescript') {
                lines.push(`\n    async search(query: string) {\n        await this.fill(this.${searchEl.name}, query);\n        await this.pressKey(this.${searchEl.name}, 'Enter');\n    }`);
            } else if (language === 'java') {
                const toCamelCase = (str) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                const methodName = toCamelCase(searchEl.name);
                lines.push(`\n    public void search(String query) {\n        ${methodName}().fill(query);\n        ${methodName}().press("Enter");\n    }`);
            } else if (language === 'python') {
                lines.push(`\n    async def search(self, query: str):\n        await self.fill(self.${searchEl.name}, query)\n        await self.press_key(self.${searchEl.name}, 'Enter')`);
            }
        }
        lines.push(`}`);
        return lines.join('\n');
    }
});

/**
 * Extraction function to get tab HTML
 */
function captureHTML() {
    return document.documentElement.outerHTML;
}

/**
 * Extraction function called in the tab context
 */
function captureAccessibilityTree() {
    function getAccessibilityInfo(el) {
        return {
            role: el.getAttribute('role') || el.tagName.toLowerCase(),
            name: el.getAttribute('aria-label') || (el.labels && el.labels[0]?.innerText) || el.placeholder || el.innerText?.trim() || '',
            type: el.type || undefined,
            id: el.id || undefined,
            class: el.className || undefined
        };
    }
    const elements = [];
    document.querySelectorAll('button, input, select, textarea, a').forEach(el => {
        if (el.offsetWidth > 0 && el.offsetHeight > 0) {
            elements.push(getAccessibilityInfo(el));
        }
    });
    return elements;
}

/**
 * Perform AI API call in the popup context (Prevents CSP issues)
 */
async function callAI(className, settings, elements, language = 'typescript') {
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
     "private Locator myButton() { return page.getByRole(AriaRole.BUTTON, ...); }"

3. Locator Strategy (CRITICAL):
   - I have provided a list of detected elements. Each element contains a "bestSelectorRaw" and a "bestSelectorSnippet".
   - "bestSelectorSnippet" contains the recommended, heuristically verified Playwright code for that element.
   - FOR JAVA: You MUST copy the logic from "bestSelectorSnippet" into the method body.
   - FOR TYPESCRIPT/PYTHON: Use the "bestSelectorRaw" value. If it is a "role=..." selector, Playwright supports it directly. prefer using the raw selector string.
   
4. Naming:
   - Use descriptive names based on the element's "name" or "text" property.
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
        let body = {
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }]
        };

        if (settings.aiProvider === 'anthropic') {
            endpoint = 'https://api.anthropic.com/v1/messages';
            body = {
                model: "claude-3-haiku-20240307",
                max_tokens: 4096,
                messages: [{ role: "user", content: prompt }]
            };
        } else if (settings.aiProvider === 'local') {
            endpoint = settings.baseUrl || 'http://localhost:11434/v1/chat/completions';
            body = {
                model: "local-model",
                messages: [{ role: "user", content: prompt }]
            };
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`,
                'x-api-key': settings.apiKey // For Anthropic
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        let code = '';
        if (settings.aiProvider === 'openai' || settings.aiProvider === 'local') {
            code = data.choices[0].message.content;
        } else if (settings.aiProvider === 'anthropic') {
            code = data.content[0].text;
        }
        return code.replace(/```[a-z]*/g, '').trim();
    } catch (e) {
        throw new Error("AI Request Failed: " + e.message);
    }
}

/**
 * Heuristic POM Generation (No longer injected directly)
 * We now use generatePOM_Logic in the popup with captured HTML
 */
