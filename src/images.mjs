// `npm run images`: draws every assets/src/<name>.svg into assets/images/<name>.png at the pixel
// size assets.json gives that PNG (twice the size it is shown at, for sharp phone screens).
//
// Why PNG: Gmail, Outlook and most webmail don't show SVG in emails. Edit the SVG (it's text),
// run this, and look at the PNG. Pictures you get as PNG or JPG go straight into assets/images/.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { launch } from './browser.mjs';
import { ROOT } from './render.mjs';

export async function renderImages({ root = ROOT, only = null, browser: given } = {}) {
  const assets = JSON.parse(readFileSync(join(root, 'assets.json'), 'utf8')).assets;
  const srcDir = join(root, 'assets', 'src');
  const sources = existsSync(srcDir) ? readdirSync(srcDir).filter((f) => f.endsWith('.svg')) : [];
  const done = [];
  const problems = [];
  const browser = given ?? await launch();
  try {
    for (const f of sources) {
      const name = basename(f, '.svg');
      if (only && !only.includes(name)) continue;
      const target = `assets/images/${name}.png`;
      const entry = assets.find((a) => a.path === target);
      if (!entry) {
        problems.push(`assets/src/${f}: add ${target} to assets.json (with its width and height in pixels) so it can be drawn`);
        continue;
      }
      const page = await browser.newPage({ viewport: { width: entry.width, height: entry.height } });
      const svg = readFileSync(join(srcDir, f), 'utf8');
      await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:${entry.width}px;height:${entry.height}px}</style></head><body>${svg}</body></html>`);
      writeFileSync(join(root, target), await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: entry.width, height: entry.height } }));
      await page.close();
      done.push(`${target} (${entry.width}x${entry.height})`);
    }
  } finally {
    if (!given) await browser.close();
  }
  return { done, problems };
}
