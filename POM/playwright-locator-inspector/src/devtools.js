// DevTools entry point
// This creates the panel in Chrome DevTools

chrome.devtools.panels.create(
    "PW Inspector",  // Panel title
    "icons/icon48.png",  // Icon path
    "src/devtools-panel.html",  // Panel HTML
    function (panel) {
        console.log('Playwright Inspector panel created');
    }
);
