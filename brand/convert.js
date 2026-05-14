/**
 * brand/convert.js
 * Converts all Kodelyth SVG brand assets to high-quality PNG
 * Uses Chrome (puppeteer-core) for pixel-perfect font + geometry rendering
 *
 * Usage: node brand/convert.js
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BRAND_DIR = __dirname;

const ASSETS = [
  // Facebook social assets — 2× for retina sharpness
  {
    input:  'fb-profile.svg',
    output: 'fb-profile.png',
    width:  800,
    height: 800,
    label:  'Facebook profile picture (800×800 @2x)',
  },
  {
    input:  'fb-cover.svg',
    output: 'fb-cover.png',
    width:  1640,
    height: 624,
    label:  'Facebook cover photo (1640×624 @2x)',
  },

  // Standalone mark — 3× for print + high-res usage
  {
    input:  'kodelyth-mark.svg',
    output: 'kodelyth-mark.png',
    width:  1200,
    height: 1200,
    label:  'Kodelyth mark (1200×1200 @3x)',
  },

  // Horizontal lockups — 3×
  {
    input:  'kodelyth-dark.svg',
    output: 'kodelyth-dark.png',
    width:  1380,
    height: 360,
    label:  'Lockup dark (1380×360 @3x)',
  },
  {
    input:  'kodelyth-light.svg',
    output: 'kodelyth-light.png',
    width:  1380,
    height: 360,
    label:  'Lockup light (1380×360 @3x)',
  },

  // Favicon — all required sizes
  {
    input:  'favicon.svg',
    output: 'favicon-16.png',
    width:  16,
    height: 16,
    label:  'Favicon 16×16',
  },
  {
    input:  'favicon.svg',
    output: 'favicon-32.png',
    width:  32,
    height: 32,
    label:  'Favicon 32×32',
  },
  {
    input:  'favicon.svg',
    output: 'favicon-180.png',
    width:  180,
    height: 180,
    label:  'Apple Touch Icon 180×180',
  },
];

async function convertAsset(page, asset) {
  const inputPath = path.join(BRAND_DIR, asset.input);
  const outputPath = path.join(BRAND_DIR, asset.output);

  if (!fs.existsSync(inputPath)) {
    console.error(`  SKIP  ${asset.input} — file not found`);
    return;
  }

  const svgContent = fs.readFileSync(inputPath, 'utf8');

  await page.setViewport({
    width:             asset.width,
    height:            asset.height,
    deviceScaleFactor: 2,          // render at 2× internal resolution for anti-aliasing
  });

  // Wrap SVG in a minimal HTML page — more reliable than opening SVG directly
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${asset.width}px; height: ${asset.height}px; overflow: hidden; background: transparent; }
  svg { display: block; width: ${asset.width}px !important; height: ${asset.height}px !important; }
</style>
</head>
<body>${svgContent}</body>
</html>`;

  await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });

  await page.screenshot({
    path:           outputPath,
    type:           'png',
    clip:           { x: 0, y: 0, width: asset.width, height: asset.height },
    omitBackground: false,
  });

  const kb = Math.round(fs.statSync(outputPath).size / 1024);
  console.log(`  [DONE]  ${asset.output.padEnd(28)} ${asset.label}  (${kb} KB)`);
}

async function main() {
  console.log('\nKodelyth Brand — SVG → PNG Converter');
  console.log('--------------------------------------');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless:       'new',
    args:           [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',       // allow file:// access
      '--force-device-scale-factor=1',
    ],
  });

  const page = await browser.newPage();

  // Disable all animations so screenshots are clean
  await page.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
  });

  for (const asset of ASSETS) {
    await convertAsset(page, asset);
  }

  await browser.close();

  console.log('\nAll PNGs written to brand/');
  console.log('--------------------------------------\n');
}

main().catch(err => {
  console.error('Conversion failed:', err.message);
  process.exit(1);
});
