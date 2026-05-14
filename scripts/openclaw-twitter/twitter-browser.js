'use strict';

// twitter-browser.js — Playwright browser automation for X (Twitter).
// Handles persistent sessions, tweet posting with images, and engagement.

require('dotenv').config({ path: `${__dirname}/.env` });
const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const SESSION_DIR = process.env.SESSION_DIR || `${process.env.HOME}/.kodelyth/twitter-session`;
const HEADLESS    = process.env.HEADLESS !== 'false';
const BASE_URL    = 'https://x.com';

// Random delay between min and max ms — simulates human typing/interaction pace
function delay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(r => setTimeout(r, ms));
}

// Type text with per-character delays to look human
async function humanType(locator, text) {
  await locator.click();
  for (const char of text) {
    await locator.type(char, { delay: Math.floor(Math.random() * 60) + 30 });
  }
}

// Return a persistent browser context. Creates session dir on first run.
async function getBrowserContext() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless:          HEADLESS,
    viewport:          { width: 1280, height: 900 },
    userAgent:         'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale:            'en-US',
    timezoneId:        'America/Los_Angeles',
    args:              ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  return browser;
}

// Check whether the persisted session is still logged in.
async function isLoggedIn(context) {
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/home`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await delay(1500, 2500);
    const url = page.url();
    return url.includes('/home') || url.includes('/i/timeline');
  } catch {
    return false;
  } finally {
    await page.close();
  }
}

// Post a tweet. imagePath is optional — pass null to post text-only.
// Returns { success: boolean, tweetUrl: string|null, error: string|null }
async function postTweet(text, imagePath = null) {
  const context = await getBrowserContext();
  const page    = await context.newPage();
  let result    = { success: false, tweetUrl: null, error: null };

  try {
    // Navigate to compose
    await page.goto(`${BASE_URL}/compose/tweet`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2000, 3500);

    // Some sessions redirect to home first — try the compose modal button
    if (!page.url().includes('compose')) {
      await page.goto(`${BASE_URL}/home`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await delay(2000, 3000);
      const composeBtnSel = '[data-testid="SideNav_NewTweet_Button"], [aria-label="Post"], a[href="/compose/tweet"]';
      const btn = page.locator(composeBtnSel).first();
      if (await btn.isVisible({ timeout: 5000 })) {
        await btn.click();
        await delay(1500, 2500);
      }
    }

    // Locate the tweet text area
    const editorSel = '[data-testid="tweetTextarea_0"], [role="textbox"][aria-label]';
    await page.waitForSelector(editorSel, { timeout: 15000 });
    const editor = page.locator(editorSel).first();

    // Type the tweet text
    await editor.click();
    await delay(500, 1000);

    // Split into lines and type — preserves newlines
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        await page.keyboard.press('Shift+Enter');
        await delay(80, 160);
      }
      for (const char of lines[i]) {
        await editor.type(char, { delay: Math.floor(Math.random() * 55) + 25 });
      }
    }
    await delay(800, 1400);

    // Upload image if provided
    if (imagePath && fs.existsSync(imagePath)) {
      const fileInputSel = 'input[type="file"][accept]';
      const fileInput    = page.locator(fileInputSel).first();

      // Click the media button to expose the file input
      const mediaBtnSel  = '[data-testid="attachments"], [aria-label="Add photos or video"], [aria-label="Media"]';
      const mediaBtn     = page.locator(mediaBtnSel).first();
      if (await mediaBtn.isVisible({ timeout: 3000 })) {
        await mediaBtn.click();
        await delay(600, 1000);
      }

      await fileInput.setInputFiles(imagePath);
      await delay(2500, 4000); // wait for upload + processing

      // Dismiss alt text prompt if it appears
      const skipAlt = page.locator('[data-testid="Alt_text_skip_btn"], button:has-text("Skip")').first();
      if (await skipAlt.isVisible({ timeout: 3000 })) {
        await skipAlt.click();
        await delay(400, 800);
      }
    }

    // Submit
    const submitSel = '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]';
    const submitBtn = page.locator(submitSel).first();
    await submitBtn.waitFor({ state: 'visible', timeout: 10000 });

    // Verify button is enabled (not grayed out)
    const isDisabled = await submitBtn.getAttribute('disabled');
    if (isDisabled) {
      throw new Error('Submit button is disabled — tweet may be empty or too long');
    }

    await submitBtn.click();
    await delay(3000, 5000);

    // Try to capture the resulting tweet URL
    const currentUrl = page.url();
    if (currentUrl.includes('/status/')) {
      result.tweetUrl = currentUrl;
    }

    result.success = true;
    console.log(`[openclaw] tweet posted${result.tweetUrl ? ': ' + result.tweetUrl : ''}`);

  } catch (err) {
    result.error = err.message;
    console.error('[openclaw] postTweet error:', err.message);
  } finally {
    await page.close();
    await context.close();
  }

  return result;
}

// Like tweets matching a search query.
// Returns number of likes given this call.
async function likeTweets(query, maxLikes = 10) {
  const context = await getBrowserContext();
  const page    = await context.newPage();
  let liked     = 0;

  try {
    const encoded = encodeURIComponent(query);
    await page.goto(`${BASE_URL}/search?q=${encoded}&f=live`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2500, 4000);

    // Scroll a couple of times to load tweets
    for (let s = 0; s < 2; s++) {
      await page.keyboard.press('End');
      await delay(1200, 2000);
    }

    const unlikedBtns = await page.locator('[data-testid="like"]').all();

    for (const btn of unlikedBtns) {
      if (liked >= maxLikes) break;
      try {
        const isVisible = await btn.isVisible({ timeout: 1000 });
        if (!isVisible) continue;
        await btn.scrollIntoViewIfNeeded();
        await delay(300, 700);
        await btn.click();
        await delay(800, 1600);
        liked++;
      } catch {
        // skip this tweet — might have scrolled away
      }
    }

    console.log(`[openclaw] liked ${liked} tweets for query: ${query}`);
  } catch (err) {
    console.error('[openclaw] likeTweets error:', err.message);
  } finally {
    await page.close();
    await context.close();
  }

  return liked;
}

// Reply to a tweet identified by its URL.
// commentText is the pre-generated reply string.
async function replyToTweet(tweetUrl, commentText) {
  const context = await getBrowserContext();
  const page    = await context.newPage();
  let success   = false;

  try {
    await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2500, 4000);

    // Click the reply button on the tweet
    const replyBtnSel = '[data-testid="reply"]';
    const replyBtn    = page.locator(replyBtnSel).first();
    await replyBtn.waitFor({ state: 'visible', timeout: 10000 });
    await replyBtn.click();
    await delay(1200, 2000);

    // Type into the reply editor
    const editorSel = '[data-testid="tweetTextarea_0"][role="textbox"]';
    await page.waitForSelector(editorSel, { timeout: 10000 });
    const editor = page.locator(editorSel).first();

    const lines = commentText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        await page.keyboard.press('Shift+Enter');
        await delay(80, 160);
      }
      for (const char of lines[i]) {
        await editor.type(char, { delay: Math.floor(Math.random() * 55) + 25 });
      }
    }
    await delay(800, 1400);

    // Submit reply
    const submitSel = '[data-testid="tweetButtonInline"]';
    const submitBtn = page.locator(submitSel).first();
    await submitBtn.waitFor({ state: 'visible', timeout: 8000 });
    await submitBtn.click();
    await delay(2500, 4000);

    success = true;
    console.log(`[openclaw] replied to ${tweetUrl}`);
  } catch (err) {
    console.error('[openclaw] replyToTweet error:', err.message);
  } finally {
    await page.close();
    await context.close();
  }

  return success;
}

// Fetch tweet text from a search result — returns array of { url, text } objects.
// Used by engagement.js to pick which tweets to reply to.
async function fetchTweetsFromSearch(query, limit = 10) {
  const context = await getBrowserContext();
  const page    = await context.newPage();
  const tweets  = [];

  try {
    const encoded = encodeURIComponent(query);
    await page.goto(`${BASE_URL}/search?q=${encoded}&f=live`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await delay(2500, 4000);

    // Scroll to load more
    await page.keyboard.press('End');
    await delay(1500, 2500);

    const articles = await page.locator('article[data-testid="tweet"]').all();

    for (const article of articles) {
      if (tweets.length >= limit) break;
      try {
        // Get tweet text
        const textEl  = article.locator('[data-testid="tweetText"]').first();
        const text    = await textEl.innerText({ timeout: 2000 });

        // Get tweet permalink
        const linkEl  = article.locator('a[href*="/status/"]').first();
        const href    = await linkEl.getAttribute('href', { timeout: 2000 });
        const url     = href ? `${BASE_URL}${href}` : null;

        if (text && url) {
          tweets.push({ url, text: text.trim() });
        }
      } catch {
        // skip unparseable tweet
      }
    }
  } catch (err) {
    console.error('[openclaw] fetchTweetsFromSearch error:', err.message);
  } finally {
    await page.close();
    await context.close();
  }

  return tweets;
}

module.exports = { getBrowserContext, isLoggedIn, postTweet, likeTweets, replyToTweet, fetchTweetsFromSearch };
