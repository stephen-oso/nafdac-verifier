const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 480, height: 900 } });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  // Wait for cards to render
  await page.waitForTimeout(1000);

  // Screenshot all three cards
  await page.screenshot({ path: 'C:/Users/Stephen/nafdac-verifier/cards-all.png', fullPage: true });
  console.log('Shot 1: all three cards saved.');

  // Test MultipleMatchesCard expand: click the first candidate button
  const buttons = await page.getByText('› Amox 250mg').all();
  if (buttons.length > 0) {
    await buttons[0].click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'C:/Users/Stephen/nafdac-verifier/cards-expanded.png', fullPage: true });
    console.log('Shot 2: expanded VerifiedCard saved.');

    // Test back button
    const backBtn = page.getByText('← Back to matches');
    await backBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'C:/Users/Stephen/nafdac-verifier/cards-back.png', fullPage: true });
    console.log('Shot 3: back to matches saved.');
  } else {
    console.log('Could not find Amox 250mg button - listing all button texts:');
    const allBtns = await page.locator('button').allTextContents();
    console.log(allBtns);
  }

  await browser.close();
  console.log('Done.');
})();
