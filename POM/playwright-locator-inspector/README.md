# Playwright Locator Inspector

A powerful Chrome extension that generates Playwright element locators for any web element. Perfect for developers automating web applications with Playwright.

## Features

### 🎯 Element Inspection
- Click any element on a web page to inspect it
- Real-time visual highlighting with blue outline
- Hover preview of hovered elements

### 🔍 12 Locator Generation Strategies
**Traditional Locators (Fallback):**
1. **CSS Selector** - Standard CSS path (ID-based when available)
2. **XPath** - Full absolute XPath with sibling counting
3. **Data Attributes** - Targets `data-*` attributes
4. **Text Content** - Text-based locator for text matching
5. **Role-Based** - ARIA role locators for accessibility
6. **Attribute Matching** - Smart attribute selection

**Resilient Locator:**
7. **🎯 Resilient Locator** - Intelligent multi-strategy selection (Recommended!)

**Playwright Native Locators (Recommended by Playwright):**
8. **getByTestId()** - Locates by `data-testid` attribute (most resilient)
9. **getByLabel()** - Locates form controls by associated label
10. **getByPlaceholder()** - Locates inputs by placeholder text
11. **getByAltText()** - Locates images by alt text
12. **getByTitle()** - Locates elements by title attribute

### 💻 Code Generation (Now with Java!)
- **Python** - Generate Playwright Python code with native locators
- **JavaScript** - Generate Playwright JavaScript code with native locators
- **Java** - Generate Playwright Java code with native locators
- Automatically uses Playwright native locators when available
- Falls back to resilient CSS/XPath selectors
- Copy code blocks directly to clipboard
- Syntax highlighting for easy reading

### 🛠️ Element Details
- Tag name and element ID
- CSS classes
- Element text content
- Input type (for form elements)
- Enabled/disabled state
- Visibility status

## Installation

### Method 1: Manual Installation (Developer Mode)

1. **Extract the extension files**
   - Ensure you have all files in the `playwright-locator-inspector` folder

2. **Generate Icon Files** (if not already present)
   ```bash
   node generate-icons.js
   ```
   This creates the required 16x16, 48x48, and 128x128 PNG icons.

3. **Open Chrome Developer Mode**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top right corner)

4. **Load the Extension**
   - Click "Load unpacked"
   - Navigate to and select the `playwright-locator-inspector` folder
   - The extension should now appear in your extensions list

5. **Pin the Extension** (Optional)
   - Click the extensions icon in the Chrome toolbar
   - Find "Playwright Locator Inspector"
   - Click the pin icon to add it to your toolbar

### Method 2: From Source Code

If you have Node.js installed:

```bash
cd playwright-locator-inspector
npm init -y  # If package.json doesn't exist
node generate-icons.js  # Generate icons
```

Then follow steps 3-5 from Method 1.

## Usage Guide

### 🏆 AI Optimization (New in v1.8.0)
The extension now integrates with **Google Gemini AI** to "heal" and optimize your locators. It analyzes the context and HTML structure to suggest the most robust locator possible (e.g., finding semantic meaning where only div soup exists).

**Setup:**
1.  **Get a Free API Key**: 
    - Go to [Google AI Studio](https://aistudio.google.com/app/apikey) and click "Create API Key".
2.  **Configure Extension**:
    - Right-click the **extension icon** in your toolbar.
    - Select **Options**.
    - Paste your API Key and click **Save**.
3.  **Use**:
    - Inspect any element.
    - Click the **"✨ Optimize with AI"** button in the inspector panel.
    - Wait a moment for the AI to analyze and suggest a better locator.

### Starting Element Inspection

1.  **Click the extension icon** in your Chrome toolbar.
2.  A **floating inspector panel** will appear in the top-right corner of the web page.
3.  Click the **"🔍 Inspect"** button on this panel.
4.  The button turns active/blue, indicating inspection mode is on.

### Inspecting Elements

1.  **With inspector active**, hover over any element on the page.
    - The element highlights with a blue outline.
2.  **Click on an element** to select it.
    - The inspection mode pauses automatically.
    - The overlay panel displays unique locators for the clicked element.
    - **Note**: The panel **stays open** (now movable and resizable!) so you can copy locators or start inspecting again immediately.

### Copying Locators

1.  **In the floating panel**:
    - Click the **📋 clipboard icon** next to any locator to copy it.
    - **Native Locators** (Role, Text, etc.) are prioritized at the top.
    - **Rel XPath** (Smart) and **Abs XPath** (Full) are also available.

### Generating Code

1.  **In the panel's code section**:
    - Toggle between **Python**, **JavaScript**, or **Java**.
    - The code block updates instantly with the click/fill command using the best locator.
    - **Smart Actions**: Inputs generate `.fill()`, checkboxes `.check()`, and buttons `.click()`.
    - Click the code block itself to copy the full statement.

## Locator Examples

### CSS Selector
```css
#login-form > button.submit-btn
```

### XPath
```xpath
/html/body/div[1]/form[@id='login-form']/button[2]
```

### Data Attribute
```
[data-testid="submit-button"]
```

### Text Content
```
//*[text()="Login"]
```

### Role-Based
```
[role="button"]
```

### Attribute Matching
```
[name="submitBtn"]
```

## Generated Code Examples

### Python
```python
# Playwright Python code
# Element: <input>
# Using best-available locator

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto('https://example.com')

    # Click element - uses native getByLabel if available
    page.get_by_label('User Name').click()

    # Or falls back to resilient selector
    element = page.locator('[data-testid="username"]')

    # Interact
    element.fill('text')
    text = element.text_content()

    browser.close()
```

### JavaScript
```javascript
// Playwright JavaScript code
// Element: <input>
// Using best-available locator

const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://example.com');

    // Click element - uses native getByLabel if available
    await page.getByLabel('User Name').click();

    // Or falls back to resilient selector
    const element = page.locator('[data-testid="username"]');

    // Interact
    await element.fill('text');
    const text = await element.textContent();

    await browser.close();
})();
```

### Java
```java
// Playwright Java code
// Element: <input>
// Using best-available locator

import com.microsoft.playwright.*;

public class PlaywrightTest {
    public static void main(String[] args) {
        try (Playwright playwright = Playwright.create()) {
            Browser browser = playwright.chromium().launch();
            Page page = browser.newPage();
            page.navigate("https://example.com");

            // Click element - uses native getByLabel if available
            page.getByLabel("User Name").click();

            // Or falls back to resilient selector
            Locator element = page.locator("[data-testid=\"username\"]");

            // Interact
            element.fill("text");
            String text = element.textContent();

            browser.close();
        }
    }
}
```

### JavaScript
```javascript
// Generated by Playwright Locator Inspector
const page = await context.newPage();
await page.goto('https://example.com');

// Using CSS Selector
const element = page.locator('#login-form > button.submit-btn');
await element.click();

// Using XPath
const element = page.locator('/html/body/div[1]/form[@id="login-form"]/button[2]');
await element.click();

// Using Data Attribute
const element = page.locator('[data-testid="submit-button"]');
await element.click();
```

## Keyboard Shortcuts

- **None yet** - The extension uses button clicks for all interactions
- Future versions may include keyboard shortcuts

## Troubleshooting

### Extension doesn't appear in toolbar
- Make sure you're in Developer mode in `chrome://extensions/`
- Click "Load unpacked" and select the correct folder
- Refresh the page with the extension loaded

### Locators not generating
- Make sure the element is visible on the page
- Try a different locator type if one isn't working
- Some elements (like iframes) may need special handling
## Browser Support

- **Chrome** 88+ (Manifest v3 support required)
- **Edge** 88+ (Chromium-based)
- **Brave** (Chromium-based)
- Other Chromium browsers with MV3 support

## Language Support

Generated code works with:
- **Python 3.7+** - Playwright Python library
- **Node.js 12+** - Playwright JavaScript/TypeScript
- **Java 8+** - Playwright Java library
### Icons not showing
- Run `node generate-icons.js` to create icon files
- Reload the extension in `chrome://extensions/`

## File Structure

```
playwright-locator-inspector/
├── manifest.json          # Chrome extension manifest (v3)
├── src/
│   ├── popup.html         # Extension popup UI (400+ lines)
│   ├── popup.css          # Styling (400+ lines, professional design)
│   ├── popup.js           # Popup logic and interactions (200+ lines)
│   ├── content.js         # Element inspection logic (300+ lines)
│   ├── background.js      # Service worker for MV3
│   └── icons/
│       ├── icon16.png     # 16x16 icon
│       ├── icon48.png     # 48x48 icon
│       └── icon128.png    # 128x128 icon
├── generate-icons.js      # Icon generation script
└── README.md              # This file
```

## Technical Details

### Permissions Used
- `scripting` - Inject content scripts for element inspection
- `activeTab` - Access the active tab for content injection
- `<all_urls>` - Enable inspection on any website

### Architecture
## Locator Strategy

### Priority Order (Best to Worst)

1.  **🏆 Playwright Native Locators** (getByRole, getByText, etc.)
    - Official Playwright recommendation.
    - Most resilient to DOM changes.
2.  **🥈 AI Optimized Locator**
    - Semantically analyzed by LLM.
3.  **🥉 Resilient CSS & XPath**
    - Fallback strategies like `:nth-of-type` or relative paths.
- Chrome Extension API v3
- HTML5 and CSS3
- Playwright element selector strategies

## Browser Support

- **Chrome** 88+ (Manifest v3 support required)
- **Edge** 88+ (Chromium-based)
- **Brave** (Chromium-based)
- Other Chromium browsers with MV3 support

## Development

### Adding New Features

To add new locator types:
1. Edit `src/content.js` - Add new `generate*Locator()` function
2. Edit `src/popup.html` - Add new locator display section
3. Edit `src/popup.css` - Add styling for new section
4. Edit `src/popup.js` - Add display logic for new locator type

### Modifying Styling

The extension uses a purple theme:
- Primary: `#667eea` (lighter purple)
- Secondary: `#764ba2` (darker purple)
- Edit `src/popup.css` to customize colors

## Common Playwright Selectors

The extension generates these types of selectors that work directly with Playwright:

```python
# All these methods work with generated locators
page.locator('css=selector')
page.locator('xpath=/path')
page.locator('[data-testid="value"]')
page.locator('text=Button Text')
page.locator('[role="button"]')
```

## Version History

- **v3.0** (CURRENT) - Full Playwright Native Locator Support
  - Added support for 5 Playwright native locators (getByTestId, getByLabel, etc.)
  - Automatic selection between native locators and resilient fallbacks
  - Updated code generation to use native locators when available
  - 12 total locator strategies (5 native + 7 traditional)
  - Better priority-based locator selection
  - Improved documentation with Playwright official recommendations
  - Follows Playwright best practices exactly

- **v2.0** - Enhanced with resilient locators and Java support
  - Intelligent multi-strategy resilient locator generation
  - Priority-based locator selection (data-testid, ID, ARIA, text, CSS)
  - Java code generation support
  - Improved code examples for all languages
  - Enhanced reliability for modern test frameworks
  - Better handling of dynamic content

- **v1.0** - Initial release with 6 locator generation strategies
  - CSS selector generation
  - XPath generation
  - Data attribute extraction
  - Text-based locators
  - Role-based selectors
  - Attribute matching
  - Python code generation
  - JavaScript code generation
  - Professional UI with status indicator
  - Element details and visibility detection
  - Element details and visibility detectionllow element inspection

## Privacy & Security

- **Local Operation**: Standard inspection happens entirely on your machine.
- **AI Privacy**: When using "Optimize with AI", the *specific element's HTML snippet* is sent to the Google Gemini API for analysis. Requires your own API Key.

## License

This extension is provided as-is for personal use.

## Contributing

Found a bug or have a feature request? 

To improve the extension:
1. Edit the relevant source file
2. Reload the extension in `chrome://extensions/`
3. Test your changes

## Version History

- **v1.0** - Initial release with 6 locator generation strategies
  - CSS selector generation
  - XPath generation
  - Data attribute extraction
  - Text-based locators
  - Role-based selectors
  - Attribute matching
  - Python code generation
  - JavaScript code generation
  - Professional UI with status indicator
  - Element details and visibility detection

## Support

For issues or questions:
1. Check the Troubleshooting section
2. Verify all files are present
3. Run `node generate-icons.js` to ensure icons exist
4. Reload the extension and try again

## Future Enhancements

Planned features for future versions:
- [ ] iframe content script injection
- [ ] Shadow DOM element support
- [ ] Locator reliability scoring
- [ ] Custom locator strategies
- [ ] Element screenshot capture
- [ ] Keyboard shortcut support
- [ ] Locator history/favorites
- [ ] Direct integration with test files

---
**Happy automating with Playwright!** 🎭
