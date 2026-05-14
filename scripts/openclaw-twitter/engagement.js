'use strict';

// engagement.js — Daily engagement pass: search relevant tweets, like and comment.
// Respects MAX_LIKES_PER_DAY and MAX_COMMENTS_PER_DAY from .env.
// State (today's like/comment counts) is stored in a lightweight JSON file.
//
// Usage:
//   node engagement.js          — runs if called by cron
//   node engagement.js --once   — force-run one pass now

require('dotenv').config({ path: `${__dirname}/.env` });
const fs   = require('fs');
const path = require('path');

const { ENGAGEMENT_SEARCH_QUERIES } = require('./soul.js');
const { generateComment }           = require('./content-gen.js');
const { likeTweets, fetchTweetsFromSearch, replyToTweet } = require('./twitter-browser.js');

const MAX_LIKES    = parseInt(process.env.MAX_LIKES_PER_DAY   || '30', 10);
const MAX_COMMENTS = parseInt(process.env.MAX_COMMENTS_PER_DAY || '5',  10);
const TMP_DIR      = process.env.TMP_DIR || '/tmp/openclaw-twitter';
const STATE_FILE   = path.join(TMP_DIR, 'engagement-state.json');

// Return today's date string YYYY-MM-DD
function today() {
  return new Date().toISOString().slice(0, 10);
}

// Load or initialise today's engagement state
function loadState() {
  const blank = { date: today(), likes: 0, comments: 0 };
  if (!fs.existsSync(STATE_FILE)) return blank;
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (raw.date !== today()) return blank; // new day — reset
    return raw;
  } catch {
    return blank;
  }
}

function saveState(state) {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Shuffle an array in-place (Fisher-Yates)
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Decide if a tweet is worth engaging with:
// - Not our own account
// - Has some substance (> 40 chars)
// - Not a retweet marker
function isEngageable(text) {
  if (!text || text.length < 40)    return false;
  if (text.startsWith('RT @'))       return false;
  return true;
}

async function runEngagement() {
  const state = loadState();
  console.log(`[engage] start — likes today: ${state.likes}/${MAX_LIKES}, comments: ${state.comments}/${MAX_COMMENTS}`);

  if (state.likes >= MAX_LIKES && state.comments >= MAX_COMMENTS) {
    console.log('[engage] daily limits reached — nothing to do');
    return state;
  }

  const queries = shuffle([...ENGAGEMENT_SEARCH_QUERIES]);

  for (const query of queries) {
    if (state.likes >= MAX_LIKES && state.comments >= MAX_COMMENTS) break;

    try {
      // --- Likes ---
      if (state.likes < MAX_LIKES) {
        const likesNeeded  = MAX_LIKES - state.likes;
        const perQuery     = Math.min(5, likesNeeded);       // cap per query to spread across topics
        const given        = await likeTweets(query, perQuery);
        state.likes       += given;
        saveState(state);
        console.log(`[engage] liked ${given} for "${query}" — total today: ${state.likes}`);
        await new Promise(r => setTimeout(r, 4000 + Math.random() * 3000));
      }

      // --- Comments ---
      if (state.comments < MAX_COMMENTS) {
        const tweets = await fetchTweetsFromSearch(query, 8);
        const engageable = tweets.filter(t => isEngageable(t.text));

        if (engageable.length === 0) continue;

        // Pick one tweet to comment on
        const target = engageable[Math.floor(Math.random() * engageable.length)];

        const comment = await generateComment(target.text);
        if (!comment || comment.length < 5) continue;

        const ok = await replyToTweet(target.url, comment);
        if (ok) {
          state.comments++;
          saveState(state);
          console.log(`[engage] commented on ${target.url}`);
          console.log(`[engage] comment: "${comment.slice(0, 80)}..."`);
        }

        await new Promise(r => setTimeout(r, 8000 + Math.random() * 5000));
      }
    } catch (err) {
      console.error(`[engage] error on query "${query}":`, err.message);
    }
  }

  console.log(`[engage] done — likes: ${state.likes}/${MAX_LIKES}, comments: ${state.comments}/${MAX_COMMENTS}`);
  return state;
}

module.exports = { runEngagement };

// CLI entry point
if (require.main === module) {
  runEngagement()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[engage] fatal:', err.message);
      process.exit(1);
    });
}
