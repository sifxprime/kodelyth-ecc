'use strict';

// index.js — OpenClaw main orchestrator.
// Manages the cron schedule, ties content-gen + image-gen + twitter-browser together.
//
// Usage:
//   node index.js              — start full cron schedule (runs until killed)
//   node index.js --once       — post one tweet immediately, then exit
//   node index.js --preview    — generate + print tweet content without posting
//   npm start                  — same as node index.js
//   npm run post               — same as node index.js --once

require('dotenv').config({ path: `${__dirname}/.env` });
const cron = require('node-cron');

const { generateTweet } = require('./content-gen.js');
const { generateImage }  = require('./image-gen.js');
const { postTweet }      = require('./twitter-browser.js');
const { runEngagement }  = require('./engagement.js');

// ── Config ──────────────────────────────────────────────────────────────────

// Default schedule: 9am / 1pm / 5pm / 9pm Pacific → 17 / 21 / 01 / 05 UTC
const POST_CRONS = [
  process.env.CRON_POST_1 || '0 17 * * *',
  process.env.CRON_POST_2 || '0 21 * * *',
  process.env.CRON_POST_3 || '0 1  * * *',
  process.env.CRON_POST_4 || '0 5  * * *',
];

// Engagement pass: 11am Pacific = 19 UTC
const ENGAGE_CRON = process.env.CRON_ENGAGE || '0 19 * * *';

// ── Helpers ─────────────────────────────────────────────────────────────────

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(msg) {
  console.log(`[${timestamp()}] ${msg}`);
}

// ── Core job ─────────────────────────────────────────────────────────────────

async function runPost(options = {}) {
  const preview = options.preview || false;

  log('Generating tweet content...');
  const tweetData = await generateTweet();

  // Always attach an image
  log(`Type: ${tweetData.type} | Feature: ${tweetData.feature.name}`);

  let imagePath = null;
  try {
    log('Generating image...');
    imagePath = await generateImage(tweetData);
    log(`Image ready: ${imagePath}`);
  } catch (err) {
    log(`Image generation failed (posting text-only): ${err.message}`);
  }

  if (tweetData.isThread) {
    // For threads: post each part in sequence, image on the first only
    log(`Thread detected: ${tweetData.parts.length} parts`);

    if (preview) {
      tweetData.parts.forEach((p, i) => {
        console.log(`\n--- Thread part ${i + 1}/${tweetData.parts.length} (${p.length} chars) ---`);
        console.log(p);
      });
      if (imagePath) console.log(`Image: ${imagePath}`);
      return;
    }

    let firstTweetUrl = null;
    for (let i = 0; i < tweetData.parts.length; i++) {
      const part  = tweetData.parts[i];
      const img   = i === 0 ? imagePath : null;
      const result = await postTweet(part, img);

      if (!result.success) {
        log(`Thread part ${i + 1} failed: ${result.error}`);
        break;
      }
      if (i === 0) firstTweetUrl = result.tweetUrl;
      log(`Thread part ${i + 1} posted${result.tweetUrl ? ': ' + result.tweetUrl : ''}`);

      // Brief pause between thread parts to avoid spam detection
      if (i < tweetData.parts.length - 1) {
        await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
      }
    }

    return firstTweetUrl;
  }

  // Single tweet
  const text = tweetData.parts[0];

  if (preview) {
    console.log(`\n--- Tweet (${text.length} chars) ---`);
    console.log(text);
    if (imagePath) console.log(`Image: ${imagePath}`);
    return;
  }

  const result = await postTweet(text, imagePath);
  if (result.success) {
    log(`Posted successfully${result.tweetUrl ? ': ' + result.tweetUrl : ''}`);
  } else {
    log(`Post failed: ${result.error}`);
  }

  return result.tweetUrl;
}

// ── CLI flags ─────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const ONCE    = args.includes('--once');
const PREVIEW = args.includes('--preview');

if (ONCE || PREVIEW) {
  runPost({ preview: PREVIEW })
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[openclaw] fatal:', err.message);
      process.exit(1);
    });
} else {
  // ── Cron schedule ───────────────────────────────────────────────────────────
  log('OpenClaw starting — registering cron schedules');

  POST_CRONS.forEach((expr, i) => {
    if (!cron.validate(expr)) {
      log(`Warning: CRON_POST_${i + 1} expression invalid ("${expr}") — skipping`);
      return;
    }
    cron.schedule(expr, async () => {
      log(`Post cron ${i + 1} fired`);
      try {
        await runPost();
      } catch (err) {
        log(`Post cron ${i + 1} error: ${err.message}`);
      }
    }, { timezone: 'UTC' });
    log(`Post cron ${i + 1} scheduled: ${expr}`);
  });

  if (cron.validate(ENGAGE_CRON)) {
    cron.schedule(ENGAGE_CRON, async () => {
      log('Engagement cron fired');
      try {
        await runEngagement();
      } catch (err) {
        log(`Engagement cron error: ${err.message}`);
      }
    }, { timezone: 'UTC' });
    log(`Engagement cron scheduled: ${ENGAGE_CRON}`);
  } else {
    log(`Warning: CRON_ENGAGE expression invalid ("${ENGAGE_CRON}") — engagement cron disabled`);
  }

  log('OpenClaw running. Press Ctrl+C to stop.');

  // Keep process alive
  process.on('SIGINT', () => {
    log('Shutting down...');
    process.exit(0);
  });
}
