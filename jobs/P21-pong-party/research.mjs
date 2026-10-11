// Read-only live practice inspection. No public matchmaking or original assets are saved.
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

const { chromium } = await import(pathToFileURL(process.env.REA_PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({
  executablePath: process.env.REA_CHROMIUM,
  headless: true,
  args: ['--disable-gpu', '--disable-dev-shm-usage'],
});
const report = { url: 'https://html-classic.itch.zone/html/19694061/index.html', observations: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(report.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  report.observations.push({
    stage: 'landing',
    text: (await page.locator('body').innerText()).slice(0, 6500),
  });
  const practice = page.getByRole('button', { name: /practice|offline/i }).first();
  if (await practice.count()) {
    await practice.click({ timeout: 3000 });
    await page.waitForTimeout(1500);
    report.observations.push({
      stage: 'practice',
      text: (await page.locator('body').innerText()).slice(0, 6500),
    });
    const start = page.getByRole('button', { name: /start|play/i }).first();
    if (await start.count()) {
      await start.click({ timeout: 3000 });
      await page.mouse.move(900, 500);
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(8000);
      report.observations.push({
        stage: 'practice-play',
        text: (await page.locator('body').innerText()).slice(0, 6500),
      });
    }
  } else
    report.observations.push({
      stage: 'access',
      text: 'No accessible practice button; public matchmaking was not entered.',
    });
  report.errors = errors;
} catch (error) {
  report.accessFailure = String(error);
} finally {
  await browser.close();
}
writeFileSync(
  new URL('./research-live.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report));
