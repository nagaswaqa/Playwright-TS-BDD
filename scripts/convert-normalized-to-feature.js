const fs = require('fs');
const path = require('path');

// Usage: node scripts/convert-normalized-to-feature.js <normalized-recording.json>
const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/convert-normalized-to-feature.js <normalized-recording.json>');
  process.exit(1);
}

const absoluteInput = path.resolve(process.cwd(), inputPath);
if (!fs.existsSync(absoluteInput)) {
  console.error('File not found:', absoluteInput);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(absoluteInput, 'utf8'));

function escapeText(text) {
  if (!text) return '';
  return String(text).replace(/"/g, '\\"');
}

function mapActionToStep(action) {
  const selector = action.selector || '';
  const value = action.value || '';
  const lower = selector.toLowerCase();

  // Simple mapping using existing step definitions where possible
  if (action.type === 'click') {
    if (lower.includes('login')) return `When I click the login button`;
    if (lower.includes('#username-input')) return `When I click the username input field`;
    if (lower.includes('#react-increment-btn')) return `When I click the React increment button`;
    if (lower.includes('#react-reset-btn')) return `When I click the React reset button`;
    return `When I click the element "${escapeText(selector)}"`;
  }
  if (action.type === 'input' || action.type === 'change') {
    if (lower.includes('#username-input')) {
      return `When I enter the username "${escapeText(value)}"`;
    }
    return `When I fill the element "${escapeText(selector)}" with "${escapeText(value)}"`;
  }
  return `# Unsupported action: ${action.type} (${escapeText(selector)})`;
}

function inferPreconditions(actions, url) {
  const pre = [];
  if (url && url.includes('demo.html')) {
    pre.push('Given I navigate to the demo page');
  } else if (url) {
    pre.push(`Given I open the application at "${url}"`);
  } else {
    pre.push('Given the application is open');
  }
  // Additional generic preconditions
  const selectors = actions.map(a => (a.selector || '').toLowerCase());
  if (selectors.some(s => s.includes('#username-input'))) {
    pre.push('And the username field is visible');
  }
  return pre;
}

function inferCleanup(actions) {
  const clean = [];
  const selectors = actions.map(a => (a.selector || '').toLowerCase());
  if (selectors.some(s => s.includes('#react-increment-btn') || s.includes('#react-reset-btn'))) {
    clean.push('Reset the React counter to its default state');
  }
  if (selectors.some(s => s.includes('#username-input'))) {
    clean.push('Clear the username field');
  }
  return clean;
}

const steps = (raw.actions || []).map(mapActionToStep).filter(Boolean);
const preconditions = inferPreconditions(raw.actions || [], raw.metadata?.url);
const cleanups = inferCleanup(raw.actions || []);

const featureName = raw.metadata?.title ? raw.metadata.title.replace(/[^a-zA-Z0-9 ]/g, '').trim() : 'Recorded Flow';
const filename = `recorded-${Date.now()}.feature`;
const featurePath = path.resolve(__dirname, '../features', filename);

let featureContent = `@recording\nFeature: ${featureName}\n\n  Background:\n    ${preconditions.join('\n    ')}\n\n  @recorded\n  Scenario: Recorded user flow\n`;
if (steps.length) {
  featureContent += `    ${steps.join('\n    ')}`;
}
if (cleanups.length) {
  featureContent += `\n\n    # Cleanup\n    ${cleanups.map(c => `And ${c}`).join('\n    ')}`;
}
featureContent += '\n';

fs.writeFileSync(featurePath, featureContent, 'utf8');
console.log('Generated feature file:', featurePath);
