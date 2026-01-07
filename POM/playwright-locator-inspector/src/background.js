// Background service worker for the extension
console.log('Playwright AutoLocator & CodeGen - Service Worker initialized');

// Handle messages from DevTools panel if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request.type);

    // Placeholder for future background communication
    sendResponse({ received: true });
});

