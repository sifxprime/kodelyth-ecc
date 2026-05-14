// =============================================================================
// Kodelyth ECC — Session Learning Extractor
// Reads a session transcript (JSONL) and extracts capture-worthy memories.
//
// Strategy: heuristic scoring, no LLM call. We look for signals that a real
// problem was solved:
//   1. Edit/Write tool followed by a passing test or successful build
//   2. User saying "that worked", "fixed it", "great", "thanks"
//   3. Same file edited 3+ times in one session (iteration → solution)
//   4. Long Bash output ending in exit code 0 after several failures
//
// Each candidate becomes a draft memory. The user (or the AI) reviews and
// confirms via /memory review. Nothing is auto-stored without confirmation —
// silent capture is how memory systems become noisy and useless.
// =============================================================================

'use strict';

const fs = require('fs');

const SUCCESS_PHRASES = [
  /\bthat worked\b/i,
  /\bfixed it\b/i,
  /\bperfect\b/i,
  /\bnice\b.*\bworks\b/i,
  /\bthanks\b/i,
  /\bgreat\b/i,
  /\bsolved\b/i,
  /\bdone\b/i,
];

const FAILURE_PHRASES = [
  /\bstill broken\b/i,
  /\bdoesn'?t work\b/i,
  /\bnope\b/i,
  /\bsame error\b/i,
];

function readTranscript(jsonlPath) {
  if (!fs.existsSync(jsonlPath)) return [];
  const lines = fs.readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean);
  const events = [];
  for (const line of lines) {
    try { events.push(JSON.parse(line)); } catch { /* skip malformed */ }
  }
  return events;
}

function extractText(event) {
  if (typeof event.content === 'string') return event.content;
  if (Array.isArray(event.content)) {
    return event.content
      .filter(c => c && (c.type === 'text' || typeof c.text === 'string'))
      .map(c => c.text || '')
      .join('\n');
  }
  if (event.message?.content) return extractText({ content: event.message.content });
  return '';
}

function detectLanguage(filesTouched) {
  const exts = filesTouched.map(f => (f.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase());
  if (exts.includes('.ts') || exts.includes('.tsx')) return 'typescript';
  if (exts.includes('.js') || exts.includes('.jsx')) return 'javascript';
  if (exts.includes('.py'))   return 'python';
  if (exts.includes('.go'))   return 'golang';
  if (exts.includes('.rs'))   return 'rust';
  if (exts.includes('.java')) return 'java';
  if (exts.includes('.kt'))   return 'kotlin';
  if (exts.includes('.swift')) return 'swift';
  if (exts.includes('.rb'))   return 'ruby';
  if (exts.includes('.php'))  return 'php';
  return null;
}

function extractTags(text) {
  const tags = new Set();
  const taxonomy = {
    'api-integration':  /\b(api|endpoint|rest|graphql|grpc|webhook)\b/i,
    'authentication':   /\b(auth|jwt|oauth|sso|login|session|token)\b/i,
    'database':         /\b(sql|postgres|mysql|mongo|redis|orm|migration|query)\b/i,
    'testing':          /\b(test|jest|vitest|pytest|playwright|cypress|coverage)\b/i,
    'deployment':       /\b(deploy|vercel|netlify|aws|docker|kubernetes|ci|cd)\b/i,
    'performance':      /\b(slow|optimize|perf|cache|n\+1|memory leak)\b/i,
    'security':         /\b(secure|xss|csrf|injection|vuln|sanitiz)\b/i,
    'state-management': /\b(redux|zustand|context|signal|state|store)\b/i,
    'styling':          /\b(css|tailwind|styled|theme|responsive)\b/i,
    'routing':          /\b(router|navigation|route|next-router|react-router)\b/i,
    'forms':            /\b(form|validation|zod|yup|formik|hook-form)\b/i,
    'streaming':        /\b(stream|sse|websocket|realtime)\b/i,
    'payments':         /\b(stripe|paypal|payment|checkout|billing|subscription)\b/i,
    'ai-llm':           /\b(openai|anthropic|llm|gpt|claude|gemini|prompt)\b/i,
  };
  for (const [tag, pattern] of Object.entries(taxonomy)) {
    if (pattern.test(text)) tags.add(tag);
  }
  return Array.from(tags);
}

function scoreCandidate(events, candidateIdx) {
  let score = 0;
  const around = events.slice(Math.max(0, candidateIdx - 5), candidateIdx + 5);

  for (const ev of around) {
    const text = extractText(ev);
    if (ev.role === 'user' && SUCCESS_PHRASES.some(rx => rx.test(text))) score += 3;
    if (ev.role === 'user' && FAILURE_PHRASES.some(rx => rx.test(text))) score -= 2;
    if (ev.tool_name === 'Bash' && /exit code 0|tests passed|all passed/i.test(text)) score += 2;
    if (ev.tool_name === 'Edit' || ev.tool_name === 'Write') score += 1;
  }
  return score;
}

function extractCandidates(jsonlPath) {
  const events = readTranscript(jsonlPath);
  if (events.length < 4) return [];

  const editsByFile = {};
  const candidates  = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const filePath = ev.tool_input?.file_path || ev.tool_input?.path;
    if ((ev.tool_name === 'Edit' || ev.tool_name === 'Write') && filePath) {
      editsByFile[filePath] = (editsByFile[filePath] || 0) + 1;
    }
  }

  // Find user success messages — those mark candidate moments
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.role !== 'user') continue;
    const text = extractText(ev);
    if (!SUCCESS_PHRASES.some(rx => rx.test(text))) continue;

    const score = scoreCandidate(events, i);
    if (score < 3) continue;

    // Look back to find the problem and approach
    const window = events.slice(Math.max(0, i - 20), i);
    const problemEvent = window.find(e => e.role === 'user');
    const problem = problemEvent ? extractText(problemEvent).split('\n')[0].slice(0, 280) : null;

    const filesTouched = Array.from(new Set(
      window
        .filter(e => e.tool_name === 'Edit' || e.tool_name === 'Write')
        .map(e => e.tool_input?.file_path || e.tool_input?.path)
        .filter(Boolean)
    )).slice(0, 5);

    const lastAssistant = window.reverse().find(e => e.role === 'assistant');
    const approach = lastAssistant ? extractText(lastAssistant).slice(0, 600) : null;

    if (!problem || !approach) continue;

    candidates.push({
      problem,
      approach,
      tags: extractTags(`${problem} ${approach}`),
      files: filesTouched,
      language: detectLanguage(filesTouched),
      score,
    });
  }

  // Dedupe by problem
  const seen = new Set();
  return candidates.filter(c => {
    const key = c.problem.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { extractCandidates };
