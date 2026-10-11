// One browser, all scoped static screens, and exact fit measurements. Always closes in finally.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.env.REA_PLAYWRIGHT_MODULE).href);
const screens = JSON.parse(readFileSync('jobs/P21-pong-party/screens.json', 'utf8'));
const directory = resolve('jobs/P21-pong-party/media');
const browser = await chromium.launch({
  executablePath: process.env.REA_CHROMIUM,
  headless: true,
});
const report = [];
try {
  const page = await browser.newPage();
  for (const screen of screens) {
    await page.setViewportSize({ width: screen.width, height: screen.height });
    await page.goto(pathToFileURL(join(directory, screen.file)).href, { waitUntil: 'load' });
    const measure = await page.evaluate(() => {
      const viewport = { width: innerWidth, height: innerHeight };
      const clipped = [...document.querySelectorAll('h2,p,input,li')]
        .filter((element) => !element.closest('svg'))
        .flatMap((element) => {
          const rect = element.getBoundingClientRect();
          if (!rect.width || !rect.height) return [];
          return rect.left < -1 ||
            rect.top < -1 ||
            rect.right > innerWidth + 1 ||
            rect.bottom > innerHeight + 1
            ? [
                {
                  tag: element.tagName,
                  text: element.textContent?.trim(),
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                },
              ]
            : [];
        });
      const slider = document.querySelector('input[type="range"]');
      const arena = document.querySelector('svg');
      const timer = document.querySelector('[role="timer"]');
      const box = (element) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height, x: rect.x, y: rect.y };
      };
      const textSizes = [...document.querySelectorAll('h2,p,li b')]
        .filter((element) => !element.closest('svg'))
        .map((element) => ({
          text: element.textContent?.trim(),
          px: parseFloat(getComputedStyle(element).fontSize),
        }));
      return {
        viewport,
        clipped,
        slider: box(slider),
        arena: box(arena),
        timerPx: timer
          ? parseFloat(getComputedStyle(timer.lastElementChild ?? timer).fontSize)
          : null,
        textSizes,
      };
    });
    let keyboard = null;
    if (measure.slider) {
      const slider = page.locator('input[type="range"]');
      const before = Number(await slider.inputValue());
      await slider.focus();
      await page.keyboard.press('ArrowRight');
      const after = Number(await slider.inputValue());
      keyboard = { before, after, changed: after > before };
    }
    await page.screenshot({
      path: join(directory, screen.file.replace('.html', '.png')),
      fullPage: false,
    });
    const readableTv =
      screen.surface !== 'tv' ||
      (measure.textSizes.every((text) => text.px >= 32) &&
        (screen.phase !== 'play' || measure.timerPx >= 96));
    const usableSlider =
      !measure.slider ||
      (measure.slider.width >= 44 && measure.slider.height >= 44 && keyboard?.changed);
    const sizedArena =
      screen.surface !== 'tv' || (measure.arena?.width >= 400 && measure.arena?.height >= 400);
    report.push({ file: screen.file, ...measure, keyboard, readableTv, usableSlider, sizedArena });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(pathToFileURL(join(directory, 'play-phone-only.html')).href);
  report.push({
    file: 'play-phone-only.html',
    additional: '320x568 reduced motion',
    sliderCount: await page.locator('input[type="range"]').count(),
  });
} finally {
  await browser.close();
}
const totalMediaBytes = readdirSync(directory).reduce(
  (sum, name) => sum + statSync(join(directory, name)).size,
  0,
);
const summary = { browserInstances: 1, closedInFinally: true, totalMediaBytes, screens: report };
writeFileSync('jobs/P21-pong-party/capture.json', JSON.stringify(summary, null, 2) + '\n');
console.log(
  JSON.stringify({
    screens: report.length,
    clipped: report.flatMap((screen) => screen.clipped ?? []).length,
    totalMediaBytes,
  }),
);
if (
  report.some(
    (screen) =>
      screen.clipped?.length ||
      screen.readableTv === false ||
      screen.usableSlider === false ||
      screen.sizedArena === false,
  ) ||
  totalMediaBytes >= 10 * 1024 * 1024
)
  process.exitCode = 1;
