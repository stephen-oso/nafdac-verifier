import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 480, height: 900 } });

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

// Wait for cards to render
await page.waitForSelector('div[style*="border-radius"]', { timeout: 10000 });

// Screenshot all three cards
await page.screenshot({ path: 'C:/Users/Stephen/nafdac-verifier/cards-all.png', fullPage: true });

// Test MultipleMatchesCard expand: click the first candidate button
const candidateButtons = await page.locator('button').filter({ hasText: '› Amox 250mg' });
await candidateButtons.first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'C:/Users/Stephen/nafdac-verifier/cards-expanded.png', fullPage: true });

// Test back button
await page.locator('button', { hasText: '← Back to matches' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'C:/Users/Stephen/nafdac-verifier/cards-back.png', fullPage: true });

await browser.close();
console.log('Screenshots saved.');
