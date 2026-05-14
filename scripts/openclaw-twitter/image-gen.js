'use strict';

// image-gen.js — Generates a branded PNG image for each tweet.
// Picks a template based on tweet type, fills in dynamic content,
// renders SVG → PNG via rsvg-convert (already installed on this Mac).

require('dotenv').config({ path: `${__dirname}/.env` });
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execFileSync } = require('child_process');

const RSVG  = process.env.RSVG_CONVERT || '/opt/homebrew/bin/rsvg-convert';
const TMP   = process.env.TMP_DIR || path.join(os.tmpdir(), 'openclaw-twitter');

fs.mkdirSync(TMP, { recursive: true });

// Escape text for safe SVG embedding
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Wrap text into lines of maxWidth characters (SVG has no text wrapping)
function wrapText(text, maxWidth) {
  const words  = text.split(' ');
  const lines  = [];
  let current  = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxWidth) {
      if (current) lines.push(current.trim());
      current = w;
    } else {
      current = (current + ' ' + w).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

// Ghost Depth Mark — Kodelyth brand watermark
const GHOST_MARK = `
  <g transform="translate(1044, 262) scale(0.55)" opacity="0.14">
    <polyline points="-44,4 12,100 -44,196"
              stroke="#ffffff" stroke-width="10"
              stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <polyline points="0,0 88,100 0,200"
              stroke="#ffffff" stroke-width="32"
              stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>`;

// ── Templates ──────────────────────────────────────────────────────────────

function templateFeature({ title, body, command, accentColor = '#a78bfa' }) {
  const lines    = wrapText(body, 52);
  const lineEls  = lines.slice(0, 3).map((l, i) =>
    `<text x="80" y="${300 + i * 30}" font-size="18" fill="#c9d1d9">${esc(l)}</text>`
  ).join('\n  ');
  const cmdEl    = command
    ? `<rect x="80" y="${300 + lines.slice(0,3).length * 30 + 20}" width="${command.length * 11.5 + 32}" height="36" rx="6" fill="${accentColor}" fill-opacity="0.15" stroke="${accentColor}" stroke-opacity="0.5" stroke-width="1"/>
       <text x="96" y="${300 + lines.slice(0,3).length * 30 + 44}" font-size="15" fill="${accentColor}" font-family="'Consolas','SF Mono',monospace">${esc(command)}</text>`
    : '';

  return `<svg width="1200" height="675" viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg"
     font-family="'Segoe UI', system-ui, -apple-system, sans-serif">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#050811"/>
      <stop offset="100%" style="stop-color:#0d1117"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <circle cx="1050" cy="460" r="260" fill="${accentColor}" opacity="0.04"/>
  <circle cx="80"   cy="80"  r="180" fill="${accentColor}" opacity="0.03"/>
  ${GHOST_MARK}

  <!-- Version badge -->
  <rect x="80" y="40" width="76" height="24" rx="12" fill="${accentColor}" fill-opacity="0.15" stroke="${accentColor}" stroke-opacity="0.5" stroke-width="1"/>
  <text x="118" y="56" font-size="11" fill="${accentColor}" text-anchor="middle" font-weight="700" letter-spacing="0.5">v1.8.0</text>

  <!-- Left accent bar -->
  <rect x="0" y="0" width="4" height="675" fill="${accentColor}" opacity="0.8"/>

  <!-- Feature label -->
  <rect x="80" y="90" width="180" height="26" rx="4" fill="${accentColor}" fill-opacity="0.12" stroke="${accentColor}" stroke-opacity="0.4" stroke-width="1"/>
  <text x="90" y="108" font-size="11" font-weight="700" fill="${accentColor}" letter-spacing="1.5">KODELYTH ECC</text>

  <!-- Title -->
  <text x="80" y="210" font-size="52" font-weight="900" letter-spacing="-1.5" fill="#ffffff">${esc(title.slice(0, 30))}</text>
  ${title.length > 30 ? `<text x="80" y="268" font-size="52" font-weight="900" letter-spacing="-1.5" fill="#ffffff">${esc(title.slice(30, 60))}</text>` : ''}

  <!-- Body lines -->
  ${lineEls}

  <!-- Command -->
  ${cmdEl}

  <!-- Bottom bar -->
  <rect x="0" y="637" width="1200" height="38" fill="#07080f"/>
  <line x1="0" y1="637" x2="1200" y2="637" stroke="#1e1e2e" stroke-width="1"/>
  <text x="80" y="661" font-size="13" fill="${accentColor}" font-weight="600" font-family="'Consolas','SF Mono',monospace">npx kodelyth-ecc</text>
  <text x="248" y="661" font-size="13" fill="#30363d">·</text>
  <text x="264" y="661" font-size="13" fill="#484f58">github.com/sifxprime/kodelyth-ecc</text>
  <text x="680" y="661" font-size="13" fill="#30363d">·</text>
  <text x="696" y="661" font-size="13" fill="#484f58">MIT · zero cloud · zero telemetry</text>
</svg>`;
}

function templateStats() {
  return `<svg width="1200" height="675" viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg"
     font-family="'Segoe UI', system-ui, -apple-system, sans-serif">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#050811"/>
      <stop offset="100%" style="stop-color:#0d1117"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#a78bfa"/>
      <stop offset="100%" style="stop-color:#38bdf8"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  ${GHOST_MARK}

  <!-- Headline -->
  <text x="600" y="120" font-size="22" fill="url(#accent)" text-anchor="middle" font-weight="400" letter-spacing="0.5">Kodelyth ECC · v1.8.0</text>
  <text x="600" y="175" font-size="44" font-weight="900" letter-spacing="-1.5" fill="#ffffff" text-anchor="middle">Production-grade AI coding toolkit.</text>

  <!-- Separator -->
  <line x1="80" y1="205" x2="1120" y2="205" stroke="#21262d" stroke-width="1"/>

  <!-- Stats row -->
  <text x="200" y="310" font-size="96" font-weight="900" fill="#ffffff" text-anchor="middle">70</text>
  <text x="200" y="342" font-size="12" fill="#484f58" text-anchor="middle" letter-spacing="3">SPECIALIST AGENTS</text>

  <line x1="380" y1="210" x2="380" y2="360" stroke="#21262d" stroke-width="1"/>

  <text x="560" y="310" font-size="96" font-weight="900" fill="#a78bfa" text-anchor="middle">194</text>
  <text x="560" y="342" font-size="12" fill="#484f58" text-anchor="middle" letter-spacing="3">SKILLS</text>

  <line x1="740" y1="210" x2="740" y2="360" stroke="#21262d" stroke-width="1"/>

  <text x="920" y="310" font-size="96" font-weight="900" fill="#38bdf8" text-anchor="middle">97</text>
  <text x="920" y="342" font-size="12" fill="#484f58" text-anchor="middle" letter-spacing="3">COMMANDS</text>

  <line x1="1100" y1="210" x2="1100" y2="360" stroke="#21262d" stroke-width="1"/>

  <text x="1155" y="285" font-size="54" font-weight="900" fill="#f59e0b" text-anchor="middle">22+</text>
  <text x="1155" y="320" font-size="12" fill="#484f58" text-anchor="middle" letter-spacing="3">HOOKS</text>

  <!-- Separator -->
  <line x1="80" y1="380" x2="1120" y2="380" stroke="#21262d" stroke-width="1"/>

  <!-- Pills row -->
  <rect x="80"  y="410" width="195" height="44" rx="8" fill="#161b22" stroke="#30363d" stroke-width="1"/>
  <text x="178" y="428" font-size="13" fill="#ffffff" text-anchor="middle" font-weight="700">Zero Cost</text>
  <text x="178" y="445" font-size="11" fill="#484f58" text-anchor="middle">MIT · local files only</text>

  <rect x="293" y="410" width="195" height="44" rx="8" fill="#161b22" stroke="#30363d" stroke-width="1"/>
  <text x="391" y="428" font-size="13" fill="#ffffff" text-anchor="middle" font-weight="700">11 Platforms</text>
  <text x="391" y="445" font-size="11" fill="#484f58" text-anchor="middle">13 install targets</text>

  <rect x="506" y="410" width="195" height="44" rx="8" fill="#161b22" stroke="#30363d" stroke-width="1"/>
  <text x="604" y="428" font-size="13" fill="#ffffff" text-anchor="middle" font-weight="700">373 Tests</text>
  <text x="604" y="445" font-size="11" fill="#484f58" text-anchor="middle">all passing</text>

  <rect x="719" y="410" width="195" height="44" rx="8" fill="#161b22" stroke="#30363d" stroke-width="1"/>
  <text x="817" y="428" font-size="13" fill="#ffffff" text-anchor="middle" font-weight="700">Self-Learning</text>
  <text x="817" y="445" font-size="11" fill="#484f58" text-anchor="middle">compound memory</text>

  <rect x="932" y="410" width="188" height="44" rx="8" fill="#0d2b1d" stroke="#059669" stroke-opacity="0.5" stroke-width="1"/>
  <text x="1026" y="428" font-size="12" fill="#10b981" text-anchor="middle" font-weight="700">npx kodelyth-ecc</text>
  <text x="1026" y="445" font-size="10" fill="#484f58" text-anchor="middle">sifxprime/kodelyth-ecc</text>

  <!-- Bottom bar -->
  <rect x="0" y="637" width="1200" height="38" fill="#07080f"/>
  <line x1="0" y1="637" x2="1200" y2="637" stroke="#1e1e2e" stroke-width="1"/>
  <text x="600" y="661" font-size="12" fill="#30363d" text-anchor="middle">Claude Code · Windsurf · Cursor · Codex CLI · Antigravity · Cline · Roo Code · Aider · Kimi · Gemini CLI · OpenCode</text>
</svg>`;
}

function templateTip({ tip, command, accentColor = '#10b981' }) {
  const lines   = wrapText(tip, 58);
  const lineEls = lines.slice(0, 4).map((l, i) =>
    `<text x="80" y="${230 + i * 38}" font-size="22" fill="#c9d1d9" font-family="'Consolas','SF Mono',monospace">${esc(l)}</text>`
  ).join('\n  ');

  return `<svg width="1200" height="675" viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg"
     font-family="'Segoe UI', system-ui, -apple-system, sans-serif">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#050d07"/>
      <stop offset="100%" style="stop-color:#020a04"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <rect x="0" y="0" width="3" height="675" fill="${accentColor}"/>
  ${GHOST_MARK}

  <!-- TIP badge -->
  <rect x="80" y="60" width="70" height="28" rx="4" fill="${accentColor}" fill-opacity="0.15" stroke="${accentColor}" stroke-opacity="0.5" stroke-width="1"/>
  <text x="115" y="79" font-size="12" font-weight="700" fill="${accentColor}" text-anchor="middle" letter-spacing="1.5">TIP</text>

  <!-- Kodelyth ECC label -->
  <text x="168" y="79" font-size="13" fill="#484f58" letter-spacing="0.5">Kodelyth ECC · v1.8.0</text>

  <!-- Separator -->
  <line x1="80" y1="108" x2="600" y2="108" stroke="${accentColor}" stroke-width="1" opacity="0.3"/>

  <!-- Tip body -->
  ${lineEls}

  <!-- Command pill -->
  ${command ? `
  <rect x="80" y="${230 + Math.min(lines.length, 4) * 38 + 16}" width="${command.length * 12 + 32}" height="40" rx="6"
        fill="${accentColor}" fill-opacity="0.1" stroke="${accentColor}" stroke-opacity="0.4" stroke-width="1"/>
  <text x="96" y="${230 + Math.min(lines.length, 4) * 38 + 42}" font-size="17"
        fill="${accentColor}" font-family="'Consolas','SF Mono',monospace">${esc(command)}</text>` : ''}

  <!-- Bottom bar -->
  <rect x="0" y="637" width="1200" height="38" fill="#030806"/>
  <line x1="0" y1="637" x2="1200" y2="637" stroke="#0d1a0e" stroke-width="1"/>
  <text x="80" y="661" font-size="13" fill="${accentColor}" font-weight="600" font-family="'Consolas','SF Mono',monospace">npx kodelyth-ecc</text>
  <text x="248" y="661" font-size="13" fill="#1a2e1b">·</text>
  <text x="264" y="661" font-size="13" fill="#2d5a2d">github.com/sifxprime/kodelyth-ecc</text>
  <text x="580" y="661" font-size="13" fill="#1a2e1b">·</text>
  <text x="596" y="661" font-size="13" fill="#2d5a2d">MIT · zero cloud · zero telemetry</text>
</svg>`;
}

// ── Main export ─────────────────────────────────────────────────────────────

async function generateImage(tweetData) {
  const { type, feature } = tweetData;
  let svgSource;

  if (type === 'stats_flex') {
    svgSource = templateStats();
  } else if (type === 'tip') {
    svgSource = templateTip({
      tip:         feature.desc,
      command:     feature.cmd || null,
      accentColor: '#10b981',
    });
  } else {
    // feature_spotlight, pain_point, comparison → feature card
    const colors = {
      feature_spotlight: '#a78bfa',
      pain_point:        '#38bdf8',
      comparison:        '#f59e0b',
    };
    svgSource = templateFeature({
      title:       feature.name,
      body:        feature.desc,
      command:     feature.cmd || null,
      accentColor: colors[type] || '#a78bfa',
    });
  }

  const ts      = Date.now();
  const svgPath = path.join(TMP, `tweet-${ts}.svg`);
  const pngPath = path.join(TMP, `tweet-${ts}.png`);

  fs.writeFileSync(svgPath, svgSource, 'utf8');

  // Render SVG → PNG at 2× using rsvg-convert
  execFileSync(RSVG, ['--zoom', '2', svgPath, '-o', pngPath]);

  // Clean up SVG
  fs.unlinkSync(svgPath);

  return pngPath;
}

module.exports = { generateImage };

// CLI test: node image-gen.js
if (require.main === module) {
  const { pickContentType, pickFeature } = require('./soul.js');
  const type    = process.argv[2] || pickContentType();
  const feature = pickFeature();
  console.log('Generating image — type:', type, '/ feature:', feature.name);
  generateImage({ type, feature }).then(p => {
    console.log('PNG saved to:', p);
  }).catch(console.error);
}
