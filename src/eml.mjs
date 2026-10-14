// A .eml file (one email message, MIME) to open in a real mail app: Outlook, Apple Mail,
// Thunderbird. Double-click out/<id>.eml to see how that app draws the email, without sending
// anything. Images under brand.json's assetBaseUrl are attached inline (cid:), so they show
// before you have uploaded them; the HTML you send keeps the https:// addresses.
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { ROOT } from './render.mjs';

const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif' };

const b64lines = (buf) => buf.toString('base64').replace(/.{76}/g, '$&\r\n');
// RFC 2047 for headers with non-ASCII text (subjects with "·" or accents).
const header = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`);

export function buildEml({ from, to, subject, html, text, headers = {}, brand, root = ROOT, boundarySeed = 'codeplate' }) {
  const images = [];
  let i = 0;
  const htmlInline = brand?.assetBaseUrl
    ? html.replace(/(src=")([^"]+)(")/g, (all, a, url, b) => {
      if (!url.startsWith(brand.assetBaseUrl)) return all;
      const name = decodeURIComponent(url.slice(brand.assetBaseUrl.length).split(/[?#]/)[0]);
      const file = join(root, 'assets', 'images', name);
      if (!existsSync(file)) return all;
      let img = images.find((x) => x.file === file);
      if (!img) {
        img = { file, name, cid: `img${++i}.${boundarySeed}@preview`, type: TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' };
        images.push(img);
      }
      return `${a}cid:${img.cid}${b}`;
    })
    : html;
  const alt = `alt-${boundarySeed}`;
  const rel = `rel-${boundarySeed}`;
  const lines = [
    `From: ${header(from)}`,
    `To: ${header(to)}`,
    `Subject: ${header(subject)}`,
    'MIME-Version: 1.0',
    'X-Preview: built by npm run build (not sent)',
    ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`),
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    `--${alt}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64lines(Buffer.from(text, 'utf8')),
    `--${alt}`,
    `Content-Type: multipart/related; boundary="${rel}"`,
    '',
    `--${rel}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64lines(Buffer.from(htmlInline, 'utf8')),
    ...images.flatMap((img) => [
      `--${rel}`,
      `Content-Type: ${img.type}; name="${img.name}"`,
      'Content-Transfer-Encoding: base64',
      `Content-ID: <${img.cid}>`,
      `Content-Disposition: inline; filename="${img.name}"`,
      '',
      b64lines(readFileSync(img.file)),
    ]),
    `--${rel}--`,
    `--${alt}--`,
    '',
  ];
  return lines.join('\r\n');
}
