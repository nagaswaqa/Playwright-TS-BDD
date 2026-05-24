(function () {
    if (window.__PLAYWRIGHT_RECORDER__) {
        console.warn('Recorder already injected.');
        return;
    }

    window.__PLAYWRIGHT_RECORDER__ = true;
    window.__RECORDER_ACTIONS__ = [];

    function getElementPath(el) {
        if (!el) return '';
        const path = [];
        while (el && el.nodeType === Node.ELEMENT_NODE && el.tagName !== 'HTML') {
            let selector = el.tagName.toLowerCase();
            if (el.id) {
                selector += `#${el.id}`;
                path.unshift(selector);
                break;
            }
            const cls = Array.from(el.classList || []).filter(Boolean);
            if (cls.length) {
                selector += `.${cls.join('.')}`;
            }
            const parent = el.parentNode;
            if (parent) {
                const siblings = Array.from(parent.children).filter((child) => child.tagName === el.tagName);
                if (siblings.length > 1) {
                    const index = siblings.indexOf(el) + 1;
                    selector += `:nth-of-type(${index})`;
                }
            }
            path.unshift(selector);
            el = el.parentElement;
        }
        return path.join(' > ');
    }

    /**
     * Best-effort label resolution for an interactive element. Tries:
     *   1. wrapping <label> ancestor
     *   2. <label for="<id>"> elsewhere in the document
     *   3. preceding-sibling <label>
     *   4. element's own visible text
     */
    function resolveFormLabel(el) {
        if (!el) return '';
        try {
            const wrappingLabel = el.closest && el.closest('label');
            if (wrappingLabel) {
                return (wrappingLabel.textContent || '').trim();
            }
            if (el.id) {
                const linked = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
                if (linked) return (linked.textContent || '').trim();
            }
            let prev = el.previousElementSibling;
            while (prev) {
                if (prev.tagName === 'LABEL') return (prev.textContent || '').trim();
                prev = prev.previousElementSibling;
            }
            const parent = el.parentElement;
            if (parent) {
                const siblingLabel = parent.querySelector('label');
                if (siblingLabel && siblingLabel !== el) {
                    return (siblingLabel.textContent || '').trim();
                }
            }
        } catch (_) {
            /* ignore — best effort only */
        }
        return '';
    }

    /**
     * Capture per-action metadata that downstream scripts can use to match
     * recorded events to existing step definitions (e.g., distinguishing a
     * sidebar nav link from a button, or recognising a date picker).
     */
    function describeElement(el) {
        if (!el) return {};
        const tag = el.tagName ? el.tagName.toLowerCase() : '';
        const role = el.getAttribute ? el.getAttribute('role') || '' : '';
        const ariaLabel = el.getAttribute ? el.getAttribute('aria-label') || '' : '';
        const placeholder = el.getAttribute ? el.getAttribute('placeholder') || '' : '';
        const inputType = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : '';
        const name = el.getAttribute ? el.getAttribute('name') || '' : '';
        const formLabel = ['input', 'select', 'textarea'].includes(tag) ? resolveFormLabel(el) : '';
        const inSidebar = !!(el.closest && (el.closest('aside') || el.closest('nav.sidebar-nav') || el.closest('[role="navigation"]')));
        return { tag, role, ariaLabel, placeholder, inputType, name, formLabel, inSidebar };
    }

    function recordAction(action) {
        window.__RECORDER_ACTIONS__.push({
            timestamp: new Date().toISOString(),
            ...action,
        });
        console.debug('[Recorder] action recorded:', action);
    }

    document.addEventListener('click', function (event) {
        const target = event.target;
        if (!target || !target.closest) return;
        const interactive = target.closest('button, a, input, textarea, select, label, [role]') || target;
        const selector = getElementPath(interactive) || getElementPath(target);
        recordAction({
            type: 'click',
            selector,
            label: target.textContent && target.textContent.trim(),
            element: describeElement(interactive),
        });
    }, true);

    document.addEventListener('input', function (event) {
        const target = event.target;
        if (!target || !('value' in target)) return;
        const selector = getElementPath(target);
        recordAction({
            type: 'input',
            selector,
            value: target.value,
            element: describeElement(target),
        });
    }, true);

    document.addEventListener('change', function (event) {
        const target = event.target;
        if (!target || !('value' in target)) return;
        const selector = getElementPath(target);
        recordAction({
            type: 'change',
            selector,
            value: target.value,
            element: describeElement(target),
        });
    }, true);

    window.__RECORDER_EXPORT__ = function () {
        return JSON.stringify({
            metadata: {
                url: window.location.href,
                title: document.title,
                exportedAt: new Date().toISOString(),
            },
            actions: window.__RECORDER_ACTIONS__,
        }, null, 2);
    };

    console.log('[Recorder] Injected successfully. Call window.__RECORDER_EXPORT__() to get the recorded actions.');
})();
