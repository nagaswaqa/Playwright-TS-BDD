// Playwright AutoLocator & CodeGen - DevTools Panel Script
// This creates the UI for the DevTools panel

let selectedElement = null;
let pollingInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    updateStatus('Select an element in the Elements panel, or click the button below');
});

function setupEventListeners() {
    // Inspect button - inject element picker
    document.getElementById('toggleInspect').addEventListener('click', startElementPicker);

    // Clear button
    document.getElementById('clearBtn').addEventListener('click', clearLocators);

    // Listen for element selection changes in Elements panel
    chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
        extractLocatorsFromSelectedElement();
    });

    // Copy buttons
    setupCopyButtons();

    // Code language toggles
    document.querySelectorAll('input[name="codeLanguage"]').forEach(radio => {
        radio.addEventListener('change', updateCodeBlock);
    });
}

function clearLocators() {
    selectedElement = null;
    document.getElementById('elementInfo').classList.add('hidden');
    updateStatus('Cleared. Select an element to inspect.');
    console.log('🗑️ Locators cleared');
}

function startElementPicker() {
    const btn = document.getElementById('toggleInspect');

    // Inject a picker that supports iframes and shadow DOM
    chrome.devtools.inspectedWindow.eval(`
        (function() {
            // Cleanup any existing picker
            if (window.__pwPickerCleanup) {
                window.__pwPickerCleanup();
                return 'cancelled';
            }
            
            // Create highlight element only (no overlay!)
            const highlight = document.createElement('div');
            highlight.id = '__pw-highlight';
            highlight.style.cssText = \`
                position: fixed;
                border: 2px solid #667eea;
                background: rgba(102, 126, 234, 0.1);
                pointer-events: none;
                display: none;
                z-index: 2147483646;
                box-shadow: 0 0 0 1px rgba(255,255,255,0.5);
            \`;
            document.body.appendChild(highlight);
            
            let hoveredElement = null;
            
            // Helper to get element at point, checking iframes and shadow DOM
            function getElementAtPoint(x, y) {
                let element = document.elementFromPoint(x, y);
                
                // Check if we're over an iframe
                if (element && element.tagName === 'IFRAME') {
                    try {
                        const iframeDoc = element.contentDocument || element.contentWindow.document;
                        const rect = element.getBoundingClientRect();
                        const relX = x - rect.left;
                        const relY = y - rect.top;
                        const innerElement = iframeDoc.elementFromPoint(relX, relY);
                        if (innerElement) {
                            return innerElement;
                        }
                    } catch (e) {
                        // Cross-origin iframe, can't access
                        console.warn('Cannot access iframe content (cross-origin)');
                    }
                }
                
                // Check shadow DOM
                while (element && element.shadowRoot) {
                    const shadowElement = element.shadowRoot.elementFromPoint(x, y);
                    if (shadowElement) {
                        element = shadowElement;
                    } else {
                        break;
                    }
                }
                
                return element;
            }
            
            function updateHighlight(e) {
                const el = getElementAtPoint(e.clientX, e.clientY);
                if (el === highlight || !el) return;
                
                hoveredElement = el;
                const rect = el.getBoundingClientRect();
                highlight.style.display = 'block';
                highlight.style.top = rect.top + 'px';
                highlight.style.left = rect.left + 'px';
                highlight.style.width = rect.width + 'px';
                highlight.style.height = rect.height + 'px';
            }
            
            function selectElement(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Store the selected element
                window.__pwSelectedElement = hoveredElement;
                
                // Cleanup
                window.__pwPickerCleanup();
                
                return 'selected';
            }
            
            window.__pwPickerCleanup = function() {
                document.removeEventListener('mousemove', updateHighlight, true);
                document.removeEventListener('click', selectElement, true);
                document.body.style.cursor = '';
                if (highlight && highlight.parentNode) {
                    highlight.remove();
                }
                delete window.__pwPickerCleanup;
                delete window.__pwPickerActive;
            };
            
            // Attach listeners
            document.addEventListener('mousemove', updateHighlight, true);
            document.addEventListener('click', selectElement, true);
            document.body.style.cursor = 'crosshair';
            window.__pwPickerActive = true;
            
            return 'started';
        })();
    `, (result, error) => {
        if (error) {
            console.error('Picker injection error:', error);
            updateStatus('Failed to start picker');
            return;
        }

        if (result === 'cancelled') {
            updateStatus('Picker cancelled');
            btn.textContent = '🔍 Select Element in Page';
            return;
        }

        if (result === 'started') {
            updateStatus('Hover over any element and click to select it...');
            btn.textContent = '⏹ Cancel Selection';
            startPolling();
        }
    });
}

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);

    pollingInterval = setInterval(() => {
        const extractionScript = `
            (function() {
                if (window.__pwSelectedElement) {
                    const el = window.__pwSelectedElement;
                    delete window.__pwSelectedElement;
                    
                    ` + getExtractionFunctions() + `
                    
                    return extractElementData(el);
                }
                return window.__pwPickerActive ? 'active' : 'inactive';
            })();
        `;

        chrome.devtools.inspectedWindow.eval(extractionScript, (result, error) => {
            if (error) {
                console.error('Polling error:', error);
                stopPolling();
                return;
            }

            if (result && typeof result === 'object') {
                // Got element data directly
                stopPolling();
                document.getElementById('toggleInspect').textContent = '🔍 Select Element in Page';
                selectedElement = result;
                console.log('🔄 Updating selectedElement with new data:', result);
                console.log('✅ selectedElement is now:', selectedElement);
                updateUI(result);
                updateStatus(`Selected: <${result.tag}>`);
            } else if (result === 'inactive') {
                stopPolling();
                document.getElementById('toggleInspect').textContent = '🔍 Select Element in Page';
            }
        });
    }, 100);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

function extractLocatorsFromSelectedElement() {
    // Use $0 (the currently selected element in DevTools)
    const extractionScript = `
        (function() {
            const el = $0;
            if (!el) return null;
            
            ${getExtractionFunctions()}
            
            return extractElementData(el);
        })();
    `;

    chrome.devtools.inspectedWindow.eval(extractionScript, (result, error) => {
        if (error) {
            console.error('Extraction error:', error);
            updateStatus('Error extracting locators');
        } else if (result) {
            console.log('🔄 Updating selectedElement with new data:', result);
            selectedElement = result;
            console.log('✅ selectedElement is now:', selectedElement);
            updateUI(result);
            updateStatus(`Selected: <${result.tag}>`);
        } else {
            updateStatus('No element selected');
        }
    });
}

function getExtractionFunctions() {
    return `
        function extractElementData(element) {
            return {
                tag: element.tagName.toLowerCase(),
                id: element.id || '',
                getByRole: generateGetByRole(element),
                getByText: generateGetByText(element),
                getByLabel: generateGetByLabel(element),
                getByPlaceholder: generateGetByPlaceholder(element),
                getByAltText: generateGetByAltText(element),
                getByTitle: generateGetByTitle(element),
                getByTestId: generateGetByTestId(element),
                inputType: element.type || '',
                cssSelector: generateCSSSelector(element),
                xpath: generateRelativeXPath(element),
                xpathAbsolute: generateAbsoluteXPath(element),
                outerHTML: getCleanOuterHTML(element)
            };
        }

        function generateGetByRole(element) {
            const role = element.getAttribute('role') || getImplicitRole(element);
            if (!role) return null;
            let name = element.textContent?.trim() ||
                element.getAttribute('aria-label') ||
                element.getAttribute('title') ||
                (element.tagName === 'INPUT' ? element.value : '') || '';
            
            if (['button', 'link', 'heading', 'checkbox', 'radio'].includes(role) && name && name.length < 50) {
                // Remove emojis from name for cleaner locators
                // Using double backslash for \p to survive string interpolation
                const cleanName = name.replace(/\\p{Extended_Pictographic}/gu, '').trim();
                if (cleanName) {
                    return role + '|' + cleanName;
                }
            }
            return null;
        }

        function getImplicitRole(el) {
            const tag = el.tagName.toLowerCase();
            if (tag === 'button') return 'button';
            if (tag === 'a' && el.href) return 'link';
            if (['h1', 'h2', 'h3'].includes(tag)) return 'heading';
            if (tag === 'input') {
                if (['button', 'submit'].includes(el.type)) return 'button';
                if (el.type === 'checkbox') return 'checkbox';
                if (el.type === 'radio') return 'radio';
                if (el.type === 'text') return 'textbox';
            }
            return null;
        }

        function isDynamic(val) {
            if (!val) return false;
            const dynamicPatterns = [
                /[0-9]{5,}/,              // Long numeric sequences
                /^[0-9]+$/,               // Purely numeric
                /[a-f0-9]{8,}/i,          // GUID-like hex strings
                /^(ember|ng-|__|_|auto-|id-|view-|v-|jss|css-)/i, // Framework prefixes
                /[_-][0-9]+$/             // Suffix with numbers
            ];
            return dynamicPatterns.some(p => p.test(val));
        }

        function generateGetByText(element) {
            const text = element.textContent?.trim();
            if (text && text.length > 0 && text.length < 50) {
                // Strip emojis for cleaner locator
                const cleanText = text.replace(/\\p{Extended_Pictographic}/gu, '').trim();
                return cleanText.length > 0 ? cleanText : text;
            }
            return null;
        }

        function generateGetByLabel(element) {
            let labelText = null;
            if (element.id) {
                const label = document.querySelector('label[for="' + element.id + '"]');
                if (label) labelText = label.textContent.trim();
            }
            if (!labelText) labelText = element.getAttribute('aria-label');
            
            if (labelText) {
                const cleanText = labelText.replace(/\\p{Extended_Pictographic}/gu, '').trim();
                return cleanText.length > 0 ? cleanText : labelText;
            }
            return null;
        }

        function generateGetByPlaceholder(element) { 
            const val = element.getAttribute('placeholder');
            if (val) {
                const cleanText = val.replace(/\\p{Extended_Pictographic}/gu, '').trim();
                return cleanText.length > 0 ? cleanText : val;
            }
            return null;
        }
        
        function generateGetByAltText(element) { 
            const val = element.getAttribute('alt');
            if (val) {
                const cleanText = val.replace(/\\p{Extended_Pictographic}/gu, '').trim();
                return cleanText.length > 0 ? cleanText : val;
            }
            return null;
        }
        
        function generateGetByTitle(element) { 
            const val = element.getAttribute('title');
            if (val) {
                const cleanText = val.replace(/\\p{Extended_Pictographic}/gu, '').trim();
                return cleanText.length > 0 ? cleanText : val;
            }
            return null;
        }
        
        function generateGetByTestId(element) {
            return element.getAttribute('data-testid') || element.getAttribute('data-test-id') || null;
        }

        function generateCSSSelector(element) {
            // Strategy 1: Global Unique ID (only if not dynamic)
            if (element.id && !isDynamic(element.id)) {
                const idSelector = '#' + CSS.escape(element.id);
                if (document.querySelectorAll(idSelector).length === 1) {
                    return idSelector;
                }
            }

            path = [];
            let curr = element;
            while (curr && curr.nodeType === Node.ELEMENT_NODE) {
                let selector = curr.tagName.toLowerCase();
                
                // Stop if we hit a unique stable ID
                if (curr.id && !isDynamic(curr.id)) {
                    const idSelector = '#' + CSS.escape(curr.id);
                    if (document.querySelectorAll(idSelector).length === 1) {
                        path.unshift(idSelector);
                        break;
                    }
                }
                
                // Determine best selector for this node relative to parent (or broadly)
                let foundUnique = false;
                const parent = curr.parentNode;
                
                if (parent) {
                    // Strategy 2: Unique Class among siblings (skip dynamic classes)
                    if (curr.className && typeof curr.className === 'string') {
                        const classes = curr.className.trim().split(/\s+/).filter(c => c);
                        for (const cls of classes) {
                            if (isDynamic(cls)) continue;
                            const clsSelector = '.' + CSS.escape(cls);
                            // Check uniqueness among siblings
                            if (parent.querySelectorAll(':scope > ' + selector + clsSelector).length === 1) {
                                selector += clsSelector;
                                foundUnique = true;
                                break;
                            }
                        }
                    }

                    // Strategy 3: Unique Attributes among siblings (name, placeholder, type, data-testid)
                    if (!foundUnique) {
                        const attrs = ['name', 'placeholder', 'data-testid', 'data-test-id', 'type', 'aria-label'];
                        for (const attr of attrs) {
                            const val = curr.getAttribute(attr);
                            if (val) {
                                const attrSelector = '[' + attr + '="' + CSS.escape(val) + '"]';
                                if (parent.querySelectorAll(':scope > ' + selector + attrSelector).length === 1) {
                                    selector += attrSelector;
                                    foundUnique = true;
                                    break;
                                }
                            }
                        }
                    }
                }
                
                // Strategy 4: Fallback to nth-of-type
                if (!foundUnique) {
                    let sibling = curr;
                    let nth = 1;
                    while (sibling = sibling.previousElementSibling) {
                        if (sibling.tagName.toLowerCase() === curr.tagName.toLowerCase()) nth++;
                    }
                    
                    // Check for next siblings to see if we need explicit :nth-of-type(1)
                    if (nth === 1) {
                        let nextSibling = curr;
                        while (nextSibling = nextSibling.nextElementSibling) {
                            if (nextSibling.tagName.toLowerCase() === curr.tagName.toLowerCase()) {
                                selector += ':nth-of-type(1)';
                                break;
                            }
                        }
                    } else {
                        selector += ':nth-of-type(' + nth + ')';
                    }
                }
                
                path.unshift(selector);
                curr = curr.parentNode;
            }
            return path.join(' > ');
        }

        function generateRelativeXPath(element) {
            const tagName = element.tagName.toLowerCase();
            const isUnique = (path) => {
                try {
                    return document.evaluate(path, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength === 1;
                } catch (e) { return false; }
            };
            
            // Priority 1: ID attribute (most reliable if not dynamic)
            if (element.id && !isDynamic(element.id)) {
                const path = '//*[@id="' + element.id + '"]';
                if (isUnique(path)) return path;
                const pathTag = '//' + tagName + '[@id="' + element.id + '"]';
                if (isUnique(pathTag)) return pathTag;
            }
            
            // Priority 2: Unique Attributes (Name, Placeholder, TestId, Alt, Title, Type, Aria-Label, Role)
            const uniqueAttrs = ['name', 'placeholder', 'data-testid', 'data-test-id', 'aria-label', 'alt', 'title', 'type', 'role'];
            for (const attr of uniqueAttrs) {
                const val = element.getAttribute(attr);
                if (val) {
                    const path = '//' + tagName + '[@' + attr + '="' + val.replace(/"/g, '\\"') + '"]';
                    if (isUnique(path)) return path;
                }
            }
            
            // Priority 2.5: Scan ANY other attribute for uniqueness
            for (let i = 0; i < element.attributes.length; i++) {
                const attr = element.attributes[i];
                if (['id', 'class', 'style'].includes(attr.name) || uniqueAttrs.includes(attr.name)) continue;
                
                const val = attr.value;
                // Avoid extremely long attributes or inline JS/CSS
                if (val && val.length > 0 && val.length < 60) {
                    const path = '//' + tagName + '[@' + attr.name + '="' + val.replace(/"/g, '\\"') + '"]';
                    if (isUnique(path)) return path;
                }
            }
            
            // Priority 3: Unique text content
            const text = element.textContent?.trim();
            if (text && text.length > 0 && text.length < 50 && !text.includes('\\n')) {
                // Check for emojis using Unicode Property Escapes
                const emojiRegex = /\\p{Extended_Pictographic}/u;
                
                if (emojiRegex.test(text)) {
                    const cleanText = text.replace(/\\p{Extended_Pictographic}/gu, '').trim();
                    if (cleanText.length > 0) {
                        const escapedCleanText = cleanText.replace(/'/g, "\\\\'");
                        const path = '//' + tagName + '[contains(text(), "' + escapedCleanText + '")]';
                        if (isUnique(path)) return path;
                    }
                } else {
                    const escapedText = text.replace(/'/g, "\\\\'");
                    const path = '//' + tagName + '[text()="' + escapedText + '"]';
                    if (isUnique(path)) return path;
                }
            }
            
            // Priority 4: Class attribute (try combination of classes if single class not unique)
            if (element.className && typeof element.className === 'string') {
                const classes = element.className.trim().split(/\\s+/).filter(c => c);
                // Try single classes
                for (const cls of classes) {
                    const path = '//' + tagName + '[contains(@class, "' + cls + '")]';
                    if (isUnique(path)) return path;
                }
                // Try checking 2 classes combined if available
                if (classes.length >= 2) {
                    const path = '//' + tagName + '[contains(@class, "' + classes[0] + '") and contains(@class, "' + classes[1] + '")]';
                    if (isUnique(path)) return path;
                }
            }
            
            // Priority 5: Multiple attributes with AND condition
            {
                const conditions = [];
                if (element.type) conditions.push('@type="' + element.type + '"');
                if (element.name) conditions.push('@name="' + element.name + '"');
                if (element.placeholder) conditions.push('@placeholder="' + element.placeholder + '"');
                if (conditions.length >= 2) {
                    const path = '//' + tagName + '[' + conditions.join(' and ') + ']';
                    if (isUnique(path)) return path;
                }
            }

            // Priority 6: Unique Descendant Text (e.g. card with specific title)
            try {
                const interestingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'span', 'p', 'label'];
                for (const tag of interestingTags) {
                   const children = element.getElementsByTagName(tag);
                   for (let i = 0; i < Math.min(children.length, 3); i++) {
                       const child = children[i];
                       const childText = child.textContent?.trim();
                       if (childText && childText.length > 0 && childText.length < 50 && !childText.includes('\\n')) {
                           const escaped = childText.replace(/'/g, "\\\\'");
                           const path = '//' + tagName + '[.//' + tag + '[text()="' + escaped + '"]]';
                           if (isUnique(path)) return path;
                           
                           const pathContains = '//' + tagName + '[.//' + tag + '[contains(text(), "' + escaped + '")]]';
                           if (isUnique(pathContains)) return pathContains;
                       }
                   }
                }
            } catch (e) {}

            // Priority 7: Unique Parental Context (Grid/Card Stabilization)
            try {
                let parentRef = element.parentElement;
                let pDepth = 0;
                while (parentRef && pDepth < 6) { 
                    const pTag = parentRef.tagName.toLowerCase();
                    const identifyingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'a', 'label', 'span'];
                    
                    for (const hTag of identifyingTags) {
                        const identifiers = parentRef.getElementsByTagName(hTag);
                        for (let i = 0; i < Math.min(identifiers.length, 10); i++) {
                            const iden = identifiers[i];
                            if (iden === element || iden.contains(element)) continue;
                            
                            const idenText = iden.textContent?.trim();
                            if (idenText && idenText.length > 2 && idenText.length < 100) {
                                const escIden = idenText.replace(/'/g, "\\\\'");
                                
                                // We try to find a parent that contains this unique label
                                // We check if the identifier itself is unique enough to act as an anchor
                                const idenXpath = '//' + hTag + '[text()="' + escIden + '"]';
                                const idenContainsXpath = '//' + hTag + '[contains(text(), "' + escIden + '")]';
                                
                                const basePaths = [];
                                if (isUnique(idenXpath)) basePaths.push(idenXpath);
                                else if (isUnique(idenContainsXpath)) basePaths.push(idenContainsXpath);
                                
                                for (const bPath of basePaths) {
                                    // Target element text
                                    const eText = element.textContent?.trim();
                                    if (eText && eText.length > 0) {
                                        const escE = eText.replace(/'/g, "\\\\'");
                                        
                                        // Strategy: //anchor/ancestor::parentTag[1]//target[text()]
                                        // We try increasing ancestor depths to find the card wrapper
                                        for (let d = 1; d <= 3; d++) {
                                            const full = bPath + '/ancestor::' + pTag + '[' + d + ']//' + tagName + '[text()="' + escE + '"]';
                                            if (isUnique(full)) return full;

                                            const fullContains = bPath + '/ancestor::' + pTag + '[' + d + ']//' + tagName + '[contains(text(), "' + escE + '")]';
                                            if (isUnique(fullContains)) return fullContains;
                                        }
                                    }
                                    
                                    // Target element attributes
                                    const attrs = ['name', 'placeholder', 'data-testid', 'type'];
                                    for (const attr of attrs) {
                                        const val = element.getAttribute(attr);
                                        if (val) {
                                            for (let d = 1; d <= 3; d++) {
                                                const full = bPath + '/ancestor::' + pTag + '[' + d + ']//' + tagName + '[@' + attr + '="' + val + '"]';
                                                if (isUnique(full)) return full;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    parentRef = parentRef.parentElement;
                    pDepth++;
                }
            } catch (e) {}
            
            // Fallback: Positional path with // prefix
            return '//' + getPathSegment(element, false);
        }

        function generateAbsoluteXPath(element) {
            return '/html/' + getPathSegment(element, true);
        }

        function getPathSegment(element, isAbsolute) {
            const paths = [];
            let curr = element;
            
            while (curr && curr.nodeType === Node.ELEMENT_NODE && curr.tagName !== 'HTML') {
                let index = 0;
                let hasSameTagSiblings = false;
                let sibling = curr.previousSibling;
                
                while (sibling) {
                    if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === curr.nodeName) {
                        hasSameTagSiblings = true;
                        index++;
                    }
                    sibling = sibling.previousSibling;
                }
                
                if (!hasSameTagSiblings) {
                    sibling = curr.nextSibling;
                    while (sibling) {
                        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === curr.nodeName) {
                            hasSameTagSiblings = true;
                            break;
                        }
                        sibling = sibling.nextSibling;
                    }
                }
                
                const tagName = curr.nodeName.toLowerCase();
                let path;
                
                // For relative XPath, try to use attributes when available
                if (!isAbsolute) {
                    // Try stable ID first
                    if (curr.id && !isDynamic(curr.id)) {
                        paths.unshift('*[@id="' + curr.id + '"]');
                        return paths.join('/');
                    }
                    
                    // Standard positional logic (for uniqueness)
                    path = (hasSameTagSiblings || index > 0) ? tagName + '[' + (index + 1) + ']' : tagName;
                    paths.unshift(path);
                    curr = curr.parentNode;
                    continue;
                }
                
                // Default: use position
                path = (hasSameTagSiblings || index > 0) ? tagName + '[' + (index + 1) + ']' : tagName;
                paths.unshift(path);
                curr = curr.parentNode;
            }
            
            return paths.join('/');
        }

        function getCleanOuterHTML(element) {
            const clone = element.cloneNode(true);
            if (clone.tagName === 'INPUT') {
                const type = (clone.type || '').toLowerCase();
                if (!['button', 'submit', 'reset', 'checkbox', 'radio', 'image'].includes(type)) {
                    if (clone.hasAttribute('value')) {
                        clone.setAttribute('value', '[REDACTED]');
                    }
                    clone.value = '[REDACTED]';
                }
            }
            let html = clone.outerHTML;
            if (html.length > 2000) {
                html = html.substring(0, 2000) + '... <!-- Truncated -->';
            }
            return html;
        }
    `;
}

function updateUI(data) {
    overrideStrategy = null;
    document.getElementById('elementInfo').classList.remove('hidden');

    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'getByRole' && val && val.includes('|')) {
                el.textContent = val.replace('|', ', name=');
            } else {
                el.textContent = val || '-';
            }
        }

        const rowId = 'row' + id.replace('getBy', '').replace('cssLocator', 'Css')
            .replace('xpathLocator', 'Xpath').replace('xpathAbsLocator', 'XpathAbs');
        const row = document.getElementById(rowId);
        if (row) {
            row.style.opacity = (val && val !== '-') ? '1' : '0.6';
            row.classList.remove('recommended');
        }
    };

    set('getByRole', data.getByRole);
    set('getByText', data.getByText);
    set('getByLabel', data.getByLabel);
    set('getByPlaceholder', data.getByPlaceholder);
    set('getByAltText', data.getByAltText);
    set('getByTitle', data.getByTitle);
    set('getByTestId', data.getByTestId);
    set('cssLocator', data.cssSelector);
    set('xpathLocator', data.xpath);
    set('xpathAbsLocator', data.xpathAbsolute);

    // Highlight best
    const best = getBestLocator(data);
    if (best.type) {
        const suffixMap = {
            'role': 'Role', 'text': 'Text', 'label': 'Label',
            'placeholder': 'Placeholder', 'alt': 'AltText',
            'title': 'Title', 'testid': 'TestId', 'css': 'Css'
        };
        const row = document.getElementById('row' + suffixMap[best.type]);
        if (row) row.classList.add('recommended');
    }

    updateCodeBlock();
}

function getBestLocator(data) {
    if (data.getByRole) return { type: 'role', value: data.getByRole, method: 'getByRole' };
    if (data.getByText) return { type: 'text', value: data.getByText, method: 'getByText' };
    if (data.getByLabel) return { type: 'label', value: data.getByLabel, method: 'getByLabel' };
    if (data.getByPlaceholder) return { type: 'placeholder', value: data.getByPlaceholder, method: 'getByPlaceholder' };
    if (data.getByAltText) return { type: 'alt', value: data.getByAltText, method: 'getByAltText' };
    if (data.getByTitle) return { type: 'title', value: data.getByTitle, method: 'getByTitle' };
    if (data.getByTestId) return { type: 'testid', value: data.getByTestId, method: 'getByTestId' };
    return { type: 'css', value: data.cssSelector, method: 'locator' };
}

let overrideStrategy = null;

function updateCodeBlock() {
    if (!selectedElement) return;
    const lang = document.querySelector('input[name="codeLanguage"]:checked').value;
    const best = overrideStrategy || getBestLocator(selectedElement);
    const tag = selectedElement.tag;
    const inputType = selectedElement.inputType;

    let action = 'click';
    if (tag === 'select') action = 'selectOption';
    else if (tag === 'textarea') action = 'fill';
    else if (tag === 'input') {
        if (['checkbox', 'radio'].includes(inputType)) action = 'check';
        else if (['text', 'password', 'email', 'search', 'tel', 'url', 'number', 'date', 'datetime-local'].includes(inputType)) action = 'fill';
        else if (['button', 'submit', 'reset', 'image'].includes(inputType)) action = 'click';
        else action = 'fill';
    }

    let code = '';
    if (lang === 'python') code = generatePythonCode(best, action);
    else if (lang === 'javascript') code = generateJSCode(best, action);
    else if (lang === 'java') code = generateJavaCode(best, action);

    document.getElementById('codeBlock').textContent = code;
}

function escape(str) { return str.replace(/'/g, "\\'").replace(/"/g, '\\"'); }

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
    if (method === 'locator') return `page.locator('${escape(value)}')${act} `;
    if (method === 'getByRole' && value.includes('|')) {
        const [role, name] = value.split('|');
        return `page.get_by_role('${role}', name = '${escape(name)}')${act} `;
    }
    const pyMethod = method.replace(/([A-Z])/g, "_$1").toLowerCase();
    return `page.${pyMethod} ('${escape(value)}')${act} `;
}

function generateJSCode(best, action) {
    const { method, value } = best;
    const act = getActionStr('js', action).replace(/\)$/, ');');
    if (method === 'locator') return `await page.locator('${escape(value)}')${act} `;
    if (method === 'getByRole' && value.includes('|')) {
        const [role, name] = value.split('|');
        return `await page.getByRole('${role}', { name: '${escape(name)}' })${act} `;
    }
    return `await page.${method} ('${escape(value)}')${act} `;
}

function generateJavaCode(best, action) {
    const { method, value } = best;
    const act = getActionStr('java', action) + ';';
    if (method === 'locator') return `page.locator("${escape(value)}")${act} `;
    if (method === 'getByRole' && value.includes('|')) {
        const [role, name] = value.split('|');
        return `page.getByRole(AriaRole.${role.toUpperCase()}, new Page.GetByRoleOptions().setName("${escape(name)}"))${act} `;
    }
    return `page.${method} ("${escape(value)}")${act} `;
}

// Helper function to copy text (works in DevTools panels)
function copyToClipboard(text) {
    // Create a temporary textarea
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        return successful;
    } catch (err) {
        document.body.removeChild(textarea);
        console.error('Copy failed:', err);
        return false;
    }
}

function setupCopyButtons() {
    console.log('📋 Setting up copy buttons...');

    ['Role', 'Text', 'Label', 'Placeholder', 'AltText', 'Title', 'TestId', 'Css', 'Xpath', 'XpathAbs'].forEach(key => {
        const btn = document.getElementById('copy' + key);
        if (btn) {
            console.log(`✅ Found button: copy${key} `);
            btn.addEventListener('click', () => {
                console.log(`🖱️ Copy button clicked: ${key} `);
                // Always read the current selectedElement
                if (!selectedElement) {
                    console.warn('⚠️ No selectedElement!');
                    showToast('Please select an element first');
                    return;
                }

                const map = {
                    'Role': 'getByRole', 'Text': 'getByText', 'Label': 'getByLabel',
                    'Placeholder': 'getByPlaceholder', 'AltText': 'getByAltText',
                    'Title': 'getByTitle', 'TestId': 'getByTestId',
                    'Css': 'cssSelector', 'Xpath': 'xpath', 'XpathAbs': 'xpathAbsolute'
                };

                const strategyTypeMap = {
                    'Role': { type: 'role', method: 'getByRole' },
                    'Text': { type: 'text', method: 'getByText' },
                    'Label': { type: 'label', method: 'getByLabel' },
                    'Placeholder': { type: 'placeholder', method: 'getByPlaceholder' },
                    'AltText': { type: 'alt', method: 'getByAltText' },
                    'Title': { type: 'title', method: 'getByTitle' },
                    'TestId': { type: 'testid', method: 'getByTestId' },
                    'Css': { type: 'css', method: 'locator' },
                    'Xpath': { type: 'xpath', method: 'locator' },
                    'XpathAbs': { type: 'xpath', method: 'locator' }
                };

                // Read from the CURRENT selectedElement
                const val = selectedElement[map[key]];

                console.log(`📝 Copying ${key}: "${val}" from element: `, selectedElement);

                if (val && val !== '-' && val !== null) {
                    const success = copyToClipboard(val);
                    if (success) {
                        console.log(`✅ Successfully copied: ${val}`);
                        showToast(`Copied ${key}!`);

                        // Update code block to use this strategy
                        overrideStrategy = {
                            type: strategyTypeMap[key].type,
                            value: val,
                            method: strategyTypeMap[key].method
                        };
                        updateCodeBlock();
                    } else {
                        console.error('❌ Copy failed');
                        showToast('Copy failed!');
                    }
                } else {
                    console.warn(`⚠️ No value for ${key}`);
                    showToast(`No ${key} value for this element`);
                }
            });
        } else {
            console.error(`❌ Button NOT found: copy${key} `);
        }
    });

    // Copy code block
    const codeBlock = document.getElementById('codeBlock');
    if (codeBlock) {
        console.log('✅ Found codeBlock');
        codeBlock.addEventListener('click', () => {
            const text = codeBlock.textContent;
            if (text && text !== '// Select an element...') {
                const success = copyToClipboard(text);
                if (success) {
                    showToast('Code copied!');
                }
            }
        });
    } else {
        console.error('❌ codeBlock NOT found');
    }

    console.log('✅ Copy buttons setup complete');
}

function updateStatus(text) {
    document.getElementById('statusText').textContent = text;
}

function showToast(msg) {
    const status = document.getElementById('statusText');
    const original = status.textContent;
    status.textContent = msg;
    status.style.color = 'green';
    setTimeout(() => {
        status.textContent = original;
        status.style.color = '';
    }, 2000);
}
