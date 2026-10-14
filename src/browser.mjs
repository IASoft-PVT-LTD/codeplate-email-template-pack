// Opening emails in a real browser engine (Playwright driving a local Chrome, Edge or Chromium).
//
// The browser is found by checks/shared/find-tool.mjs (CHROME_PATH, PATH, the usual install
// folders, Playwright's own Chromium); nothing is downloaded. Emails are loaded the way a mail
// client would show them, except that image URLs under brand.json's assetBaseUrl are served from
// assets/images/ (so the sample works before you upload anything), and every other request is
// blocked and recorded: an email must not depend on anything else (web fonts, trackers, CSS files).
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright-core';
import { requireTool } from '../checks/shared/find-tool.mjs';
import { ROOT } from './render.mjs';

export function browserPath() {
  return requireTool('browser').path;
}

export async function launch(executablePath = browserPath()) {
  // Playwright starts Chromium without its sandbox by default; we only open our own files.
  return chromium.launch({ executablePath, headless: true });
}

const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

// A page (in its own context) at the given viewport and colour scheme, with the asset route.
// Returns { page, context, external } where `external` collects blocked request URLs.
export async function openPage(browser, { brand, width = 680, height = 900, colorScheme = 'light', root = ROOT, deviceScaleFactor = 1 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme, deviceScaleFactor, javaScriptEnabled: true });
  const page = await context.newPage();
  const external = [];
  const missing = [];
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('data:') || url === 'about:blank') return route.continue();
    if (brand && url.startsWith(brand.assetBaseUrl)) {
      const name = decodeURIComponent(url.slice(brand.assetBaseUrl.length).split(/[?#]/)[0]);
      const file = join(root, 'assets', 'images', name);
      if (existsSync(file)) return route.fulfill({ status: 200, contentType: TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', body: readFileSync(file) });
      missing.push(url);
      return route.fulfill({ status: 404, body: '' });
    }
    external.push(url);
    return route.abort();
  });
  return { page, context, external, missing };
}

// Loads HTML into the page and waits for its images to settle.
export async function showHtml(page, html) {
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
  });
}
