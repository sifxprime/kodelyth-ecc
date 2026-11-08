// scripts/lib/redact.js
//
// One place to scrub credentials out of text before it is stored or logged.
// Used by the memory capture path (so a leaked key is never written into
// memories.jsonl, where it would then be surfaced by recall and injected into a
// future session) and by the bash-command logger.
//
// Two rule families:
//   - High-confidence provider token FORMATS, matched anywhere (prose or a
//     command line) — AWS, GitHub, OpenAI/Anthropic, Stripe, Slack, Google, npm,
//     JWTs, PEM private-key blocks.
//   - Assignment / header forms — `--token=`, `Authorization:`, `password=`,
//     `api_key=`, etc.
//
// Every pattern is linear (no nested quantifiers, no adjacent `\s*\s*`) so none
// can backtrack catastrophically on hostile input — the ReDoS lesson from the
// prompt-injection guard applies here too.
'use strict';

const RULES = [
  // ── Provider token formats (match anywhere) ──
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g, '<REDACTED:private-key>'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '<REDACTED:aws-key>'],
  [/\bASIA[0-9A-Z]{16}\b/g, '<REDACTED:aws-temp-key>'],
  [/\bghp_[A-Za-z0-9]{20,}\b/g, '<REDACTED:github-token>'],
  [/\bgho_[A-Za-z0-9]{20,}\b/g, '<REDACTED:github-token>'],
  [/\bghs_[A-Za-z0-9]{20,}\b/g, '<REDACTED:github-token>'],
  [/\bghr_[A-Za-z0-9]{20,}\b/g, '<REDACTED:github-token>'],
  [/\bgithub_pat_[A-Za-z0-9_]{22,}\b/g, '<REDACTED:github-pat>'],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/g, '<REDACTED:anthropic-key>'],
  [/\bsk-[A-Za-z0-9_-]{20,}/g, '<REDACTED:openai-key>'],
  [/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g, '<REDACTED:stripe-key>'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, '<REDACTED:slack-token>'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, '<REDACTED:google-key>'],
  [/\bnpm_[A-Za-z0-9]{36}\b/g, '<REDACTED:npm-token>'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '<REDACTED:jwt>'],
  // ── Assignment / header forms ──
  [/(--token[= ])\S+/g, '$1<REDACTED>'],
  [/(Authorization:\s*)(?:Bearer\s+)?\S+/gi, '$1<REDACTED>'],
  [/(\bpassword\s*[=:]\s*)\S+/gi, '$1<REDACTED>'],
  [/(\b(?:api[_-]?key|secret|access[_-]?token|auth[_-]?token)\s*[=:]\s*)["']?[A-Za-z0-9\-_.]{8,}["']?/gi, '$1<REDACTED>'],
];

// Replace any credentials in `text` with labelled placeholders. Non-strings pass
// through unchanged (null/undefined stay as they are).
function redact(text) {
  if (typeof text !== 'string') return text;
  let out = text;
  for (const [re, repl] of RULES) out = out.replace(re, repl);
  return out;
}

// True when redaction would change the text — i.e. a credential is present.
function hasSecret(text) {
  return typeof text === 'string' && redact(text) !== text;
}

module.exports = { redact, hasSecret, RULES };
