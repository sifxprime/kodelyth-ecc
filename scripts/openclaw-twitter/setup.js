'use strict';

// setup.js — One-time interactive login for OpenClaw.
// Opens a real visible browser window so you can log in to X manually.
// Your session cookies are saved to SESSION_DIR and reused by all future runs.
//
// Usage:
//   node setup.js
//   npm run setup

require('dotenv').config({ path: `${__dirname}/.env` });
const { chromium } = require('playwright');
const readline     = require('readline');
const fs           = require('fs');

const SESSION_DIR = process.env.SESSION_DIR || `${process.env.HOME}/.kodelythecc/twitter-session`;

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function main() {
  console.log('\nOpenClaw Setup — Interactive Login');
  console.log('===================================');
  console.log(`Session will be saved to: ${SESSION_DIR}\n`);

  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    console.log('[setup] Created session directory.');
  }

  console.log('[setup] Opening browser — log in to x.com in the window that appears.');
  console.log('[setup] Complete the full login including any 2FA or verification steps.');
  console.log('[setup] Come back here and press Enter when you are fully logged in.\n');

  // Always headless=false for setup so the user can interact
  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless:          false,
    viewport:          { width: 1280, height: 900 },
    userAgent:         'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale:            'en-US',
    timezoneId:        'America/Los_Angeles',
    args:              ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = await context.newPage();
  await page.goto('https://x.com/login', { waitUntil: 'domcontentloaded' });

  await prompt('Press Enter once you have logged in and can see your X home feed...');

  // Verify login
  const currentUrl = page.url();
  const loggedIn   = currentUrl.includes('/home') || currentUrl.includes('/i/timeline') || currentUrl.includes('x.com/home');

  if (loggedIn) {
    console.log('\n[setup] Login confirmed. Session saved.');
    console.log('[setup] You can now run:');
    console.log('          npm start        — start the full cron schedule');
    console.log('          npm run post     — post one tweet immediately');
    console.log('          npm run engage   — run one engagement pass');
  } else {
    console.log('\n[setup] Warning: could not confirm login (URL:', currentUrl, ')');
    console.log('[setup] If you see your feed in the browser, the session was likely still saved.');
    console.log('[setup] Try npm run post to test it.');
  }

  await page.close();
  await context.close();
  process.exit(0);
}

main().catch(err => {
  console.error('[setup] Fatal error:', err.message);
  process.exit(1);
});
