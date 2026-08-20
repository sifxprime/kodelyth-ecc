/**
 * brand/veltix-convert.js
 * Renders all Veltix SVG assets to PNG (incl. 8K masters) via headless Chrome.
 * Usage: node brand/veltix-convert.js
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BRAND_DIR = __dirname;

// out = final PNG pixels. Rendered at viewport=out/2 with deviceScaleFactor 2.
const ASSETS = [
  { input:'veltix-mark.svg',         output:'veltix-mark-8k.png',        w:8192, h:8192, label:'Mark 8K' },
  { input:'veltix-light.svg',        output:'veltix-light-8k.png',       w:7680, h:2394, label:'Lockup light 8K' },
  { input:'veltix-dark.svg',         output:'veltix-dark-8k.png',        w:7680, h:2394, label:'Lockup dark 8K' },
  { input:'veltix-icon.svg',         output:'veltix-icon-512.png',       w:512,  h:512,  label:'App icon 512' },
  { input:'veltix-icon.svg',         output:'veltix-icon-192.png',       w:192,  h:192,  label:'App icon 192' },
  { input:'veltix-icon.svg',         output:'veltix-favicon-180.png',    w:180,  h:180,  label:'Apple touch 180' },
  { input:'veltix-icon.svg',         output:'veltix-favicon-32.png',     w:32,   h:32,   label:'Favicon 32' },
  { input:'veltix-fb-profile.svg',   output:'veltix-fb-profile.png',     w:1600, h:1600, label:'FB profile' },
  { input:'veltix-fb-cover.svg',     output:'veltix-fb-cover.png',       w:1640, h:624,  label:'FB cover' },
  { input:'veltix-og.svg',           output:'veltix-og.png',             w:1200, h:630,  label:'OG card 1200x630' },
];

async function convertAsset(page, a) {
  const inputPath = path.join(BRAND_DIR, a.input);
  const outputPath = path.join(BRAND_DIR, a.output);
  if (!fs.existsSync(inputPath)) { console.error(`  SKIP  ${a.input} - not found`); return; }
  const svg = fs.readFileSync(inputPath, 'utf8');
  const cssW = Math.round(a.w/2), cssH = Math.round(a.h/2);
  try {
    await page.setViewport({ width: cssW, height: cssH, deviceScaleFactor: 2 });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{margin:0;padding:0;box-sizing:border-box}
      html,body{width:${cssW}px;height:${cssH}px;overflow:hidden;background:transparent}
      svg{display:block;width:${cssW}px!important;height:${cssH}px!important}
      </style></head><body>${svg}</body></html>`;
    await page.setContent(html, { waitUntil:'domcontentloaded', timeout:15000 });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.screenshot({ path: outputPath, type:'png', clip:{x:0,y:0,width:cssW,height:cssH}, omitBackground:false });
    const kb = Math.round(fs.statSync(outputPath).size/1024);
    console.log(`  [DONE] ${a.output.padEnd(30)} ${a.w}x${a.h}  ${a.label}  (${kb} KB)`);
  } catch (e) {
    console.error(`  [FAIL] ${a.output}: ${e.message}`);
  }
}

(async () => {
  console.log('\nVeltix Brand - SVG -> PNG\n---------------------------');
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless:'new',
    args:['--no-sandbox','--disable-setuid-sandbox','--disable-web-security','--force-device-scale-factor=1'],
  });
  const page = await browser.newPage();
  for (const a of ASSETS) await convertAsset(page, a);
  await browser.close();
  console.log('---------------------------\nDone.\n');
})().catch(e => { console.error('Conversion failed:', e.message); process.exit(1); });
