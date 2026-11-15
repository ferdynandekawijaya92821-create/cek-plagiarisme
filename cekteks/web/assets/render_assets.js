// Membuat og-image.png (pratinjau tautan) dan ikon PNG dari sumber HTML/SVG.
// Jalankan: node render_assets.js   (butuh Playwright)
const { chromium } = require('playwright');
const path = require('path');
const DIR = __dirname;
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#0e6a86"/><g transform="translate(4 4) scale(.75)"><path d="M9 7h10l5 5v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" fill="#fff"/><path d="M11 14h8M11 17h6M11 20h4" stroke="#0e6a86" stroke-width="1.6" stroke-linecap="round"/><circle cx="20.5" cy="20.5" r="3.3" fill="none" stroke="#0f1b2a" stroke-width="1.6"/><path d="M23 23l2.6 2.6" stroke="#0f1b2a" stroke-width="1.8" stroke-linecap="round"/></g></svg>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(DIR, 'og.html'), { waitUntil: 'networkidle' }).catch(() => {});
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(DIR, 'og-image.png') });
  for (const s of [180, 192, 512]) {
    const q = await b.newPage({ viewport: { width: s, height: s }, deviceScaleFactor: 1 });
    await q.setContent(`<style>*{margin:0}svg{display:block;width:${s}px;height:${s}px}</style>` + ICON);
    await q.screenshot({ path: path.join(DIR, `icon-${s}.png`) });
  }
  await b.close();
})();
