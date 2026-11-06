// Renders dishloopr-claim-gids.html to Dishloopr-claim-je-pagina.pdf (A4) with the local Chrome.
// Usage from the repo root: node marketing/claim-brochure/render.mjs
// Change the launch date in data-launch on the cover; the text switches to "Live sinds" after it.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('file://' + path.join(dir, 'dishloopr-claim-gids.html'), { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: path.join(dir, 'Dishloopr-claim-je-pagina.pdf'), preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log('PDF written to', path.join(dir, 'Dishloopr-claim-je-pagina.pdf'));
