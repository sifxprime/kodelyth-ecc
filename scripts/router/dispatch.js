// =============================================================================
// Kodelyth ECC — Intent Dispatcher
//
// Reads a user prompt, classifies intent → picks an agent + confidence,
// and returns a directive block the model should follow: the transparency
// line + persona-adoption instructions. This turns intent routing from
// documentation into an actionable behavior.
//
// Design principle: NEVER silent. Every dispatch emits a "→ Routing to X"
// line so the user always knows what happened. Low-confidence prompts
// suggest rather than force.
// =============================================================================

'use strict';

const fabric    = require('../lib/fabric');
const telemetry = require('../lib/telemetry');

// ── Signal → agent map (highest priority first) ─────────────────────────────
// Kept small and precise. The full routing table lives in
// rules/common/agent-intent-routing.md — this dispatcher is the executor.
const RULES = [
  // Priority 1 — Crisis / production
  { agent: 'incident-commander', priority: 100, patterns: [
    /\b(production|prod|live)\s+(?:is\s+)?(down|broken|degraded|outage|throwing\s+500s?)\b/i,
    /\b500s?\s+(?:in\s+)?prod(?:uction)?\b/i,
    /\busers?\s+cannot\s+(?:login|access|use)\b/i,
    /\bincident\b/i, /\bpage(rduty)?\s+fired\b/i,
    /\bp0\b/i, /\bp1\b/i, /\bsev[12]\b/i,
    /\boutage\b/i, /\bwoke\s+up\s+to\s+alerts\b/i,
  ]},

  // Priority 2 — Active pain
  { agent: 'debug-detective', priority: 90, patterns: [
    /\b(bug|broken|crash(?:ed)?|exception|stack\s*trace|traceback|error)\b/i,
    /\btypeerror\b/i, /\bnullpointer/i, /\bpanic\b/i, /\bsegfault\b/i,
    /\bcannot\s+read\s+prop(?:erty)?/i, /\bassertion\s+failed\b/i,
    /\bwhy\s+is\s+this\b/i, /\btest\s+fail/i,
  ]},

  { agent: 'silent-failure-hunter', priority: 85, patterns: [
    /\bno\s+error\s+but\b/i,
    /\bdata\s+is\s+wrong\b/i,
    /\blooks\s+fine\s+but\b/i,
    /\bnot\s+what\s+i\s+expected\b/i,
    /\bwrong\s+output\b/i,
  ]},

  { agent: 'build-error-resolver', priority: 88, patterns: [
    /\bbuild\s+fail(?:ed|s|ing)?\b/i,
    /\bcompile\s+error\b/i,
    /\bwon(?:'|)t\s+compile\b/i,
    /\bmodule\s+not\s+found\b/i,
    /\bcannot\s+resolve\b/i,
    /\bts\d{4}\b/i,
    /\btype\s+error\b/i,
  ]},

  // Priority 3 — Quality/security
  { agent: 'security-reviewer', priority: 82, patterns: [
    /\bis\s+(?:this|my|the|our)\b.*\bsecure\b/i,
    /\bsecurity\s+(?:review|audit|question)\b/i,
    /\bvulnerabilit/i, /\bcve\b/i,
    /\bsql\s+injection\b/i, /\bxss\b/i, /\bcsrf\b/i, /\bssrf\b/i,
    /\bauth\s+(?:bypass|flaw)\b/i,
    /\brce\b/i, /\bpath\s+traversal\b/i,
    /\bapi\s+key\s+in\s+code\b/i, /\bleaked\s+(?:secret|credential|token)\b/i,
    /\bjwt\b.*\b(?:secure|sign|verify|validat)/i,
    /\b(?:jwt|token|password)\b.*\b(?:hash|crypto|encrypt|salt)\b/i,
  ]},

  { agent: 'api-guardian', priority: 70, patterns: [
    /\bbreaking\s+change\b/i,
    /\bdeprecat/i,
    /\bapi\s+version\b/i,
    /\bbackwards?\s+compat/i,
    /\bwill\s+this\s+break\s+clients?\b/i,
  ]},

  { agent: 'code-reviewer', priority: 60, patterns: [
    /\breview\s+(?:this|my|the)\b/i,
    /\blgtm\??/i, /\bcode\s+review\b/i,
    /\banything\s+wrong\b/i,
    /\bis\s+this\s+(?:good|clean)\b/i,
  ]},

  { agent: 'ux-reviewer', priority: 60, patterns: [
    /\ba11y\b/i, /\baccessibilit/i, /\bwcag\b/i,
    /\bscreen\s+reader\b/i, /\baria\b/i,
    /\bkeyboard\s+nav/i,
    /\b(?:mobile|responsive|viewport)\b.*\b(?:not\s+looking?|broken|off)\b/i,
    /\bfeels\s+off\b/i, /\blooks\s+weird\b/i,
  ]},

  // Priority 4 — Performance
  { agent: 'performance-optimizer', priority: 65, patterns: [
    /\b(slow|sluggish|laggy|takes\s+forever|timing\s+out)\b/i,
    /\bhigh\s+cpu\b/i, /\bmemory\s+leak\b/i, /\boom\b/i,
    /\bn\+1\b/i, /\bslow\s+query\b/i,
    /\bp99\b/i, /\bp95\b/i,
    /\bmake\s+this\s+faster\b/i, /\boptimi[sz]e\s+this\b/i,
  ]},

  { agent: 'load-tester', priority: 65, patterns: [
    /\bload\s+test/i, /\bstress\s+test/i, /\bcapacity\s+test/i,
    /\bk6\b/i, /\blocust\b/i, /\bartillery\b/i, /\bgatling\b/i,
    /\bhow\s+many\s+users\b/i, /\bwill\s+it\s+scale\b/i,
  ]},

  // Priority 5 — Planning
  { agent: 'planner', priority: 50, patterns: [
    /\bplan\s+(?:this|the|a)\b/i, /\broadmap\b/i,
    /\bbreak\s+(?:this|it)\s+down\b/i, /\bsprint\s+plan\b/i,
  ]},

  { agent: 'architect', priority: 55, patterns: [
    /\barchitect(?:ure|ural)?\b/i,
    /\bsystem\s+design\b/i,
    /\b(postgres|mongo)\s+or\s+\w+\b/i,
    /\bmonorepo\s+vs\s+polyrepo\b/i,
    /\bhorizontal\s+scaling\b/i,
    /\bsharding\b/i,
  ]},

  // Priority 6 — Tests
  { agent: 'tdd-guide', priority: 50, patterns: [
    /\bwrite\s+(?:a\s+)?tests?\b/i,
    /\bunit\s+test\b/i, /\bintegration\s+test\b/i,
    /\btdd\b/i, /\btest\s+driven\b/i, /\bred\s+green\s+refactor\b/i,
    /\bcoverage\s+gap\b/i,
  ]},

  // Priority 7 — Hygiene
  { agent: 'refactor-cleaner', priority: 45, patterns: [
    /\bclean\s+up\b/i, /\bdead\s+code\b/i, /\bunused\b/i,
    /\btech\s+debt\b/i, /\brefactor\s+(?:this|the)\b/i,
  ]},
  { agent: 'code-simplifier', priority: 40, patterns: [
    /\bsimpler\b/i, /\btoo\s+complex\b/i, /\bhard\s+to\s+read\b/i,
    /\bconvoluted\b/i, /\bmore\s+readable\b/i,
  ]},

  // Priority 8 — Docs
  { agent: 'doc-updater', priority: 40, patterns: [
    /\bupdate\s+readme\b/i, /\bdocument\s+this\b/i,
    /\badd\s+docs?\b/i, /\bjsdoc\b/i, /\bdocstring\b/i,
  ]},

  // Priority 1 (fallback) — Overwhelmed
  { agent: 'kodelyth-advisor', priority: 30, patterns: [
    /\bi(?:'m|\s+am)?\s+(?:stuck|lost)\b/i,
    /\bno\s+idea\b/i,
    /\bi\s+don(?:'|)t\s+know\s+where\s+to\s+start\b/i,
    /\bwhere\s+do\s+i\s+(?:even\s+)?begin\b/i,
    /\bwhat\s+should\s+i\s+do\b/i,
    /\bam\s+i\s+doing\s+this\s+right\b/i,
  ]},

  // Priority — Pre-implementation
  { agent: 'pair-programmer', priority: 35, patterns: [
    /\bi\s+want\s+to\s+build\b/i,
    /\bi(?:'m|\s+am)\s+going\s+to\s+add\b/i,
    /\bhow\s+should\s+i\s+implement\b/i,
    /\bwhat(?:'|)s\s+the\s+best\s+way\s+to\b/i,
    /\bbefore\s+i\s+start\b/i,
  ]},
];

// ── Counter-signals — never route on these ──────────────────────────────────
const COUNTER = [
  /^\s*(?:use|invoke)\s+[a-z\-]+/i,   // explicit `use <agent>`
  /^\s*@[a-z]/i,                       // @agent handle
  /^\s*\//,                            // slash command
  /^\s*(?:hi|hey|hello|thanks?|thx|ok|yes|no|sure|k|cool)\s*[!.]?$/i,
  /^\s*just\s+answer\s+me\b/i,
  /^\s*don(?:'|)t\s+route\b/i,
];

// Trivial prompts we do not classify.
const TRIVIAL_MIN_CHARS = 10;
const TRIVIAL_MIN_TOKENS = 2;

function classify(prompt) {
  if (!prompt || typeof prompt !== 'string') return null;
  const text = prompt.trim();
  if (text.length < TRIVIAL_MIN_CHARS) return null;
  for (const cx of COUNTER) if (cx.test(text)) return null;

  const wordCount = text.toLowerCase().split(/\s+/).filter(w => w.length >= 3).length;
  if (wordCount < TRIVIAL_MIN_TOKENS) return null;

  const hits = [];
  for (const rule of RULES) {
    let matches = 0;
    for (const p of rule.patterns) if (p.test(text)) matches++;
    if (matches === 0) continue;
    hits.push({ agent: rule.agent, priority: rule.priority, matches });
  }
  if (hits.length === 0) return null;

  hits.sort((a, b) => (b.priority + b.matches * 5) - (a.priority + a.matches * 5));
  const top = hits[0];

  // Confidence: priority + match density, normalized to [0..1]
  const confidence = Math.min(1, (top.priority + top.matches * 8) / 130);

  return {
    agent:      top.agent,
    confidence: Number(confidence.toFixed(2)),
    matches:    top.matches,
    priority:   top.priority,
    runners_up: hits.slice(1, 3).map(h => h.agent),
  };
}

// Build the directive block the AI sees. Explicit persona adoption, transparent to user.
function directive(prompt, projectRoot = null) {
  const decision = classify(prompt);
  if (!decision) return null;

  const CONFIDENT = 0.55;
  const kind      = decision.confidence >= CONFIDENT ? 'route' : 'suggest';

  telemetry.record('intent.dispatch', {
    project:    projectRoot,
    agent:      decision.agent,
    confidence: decision.confidence,
    priority:   decision.priority,
    matches:    decision.matches,
    kind,
    prompt_head: prompt.slice(0, 120),
  });

  // Cache the decision in the project spine.
  if (projectRoot) {
    try {
      const paths = fabric.project(projectRoot);
      fabric.ensureProject(projectRoot);
      const cache = fabric.readJson(paths.intentCache, { decisions: [] });
      cache.decisions.push({
        ts:         new Date().toISOString(),
        agent:      decision.agent,
        confidence: decision.confidence,
        kind,
        prompt_head: prompt.slice(0, 120),
      });
      cache.decisions = cache.decisions.slice(-500);
      fabric.writeJson(paths.intentCache, cache);
    } catch {}
  }

  if (kind === 'route') {
    return {
      kind:  'route',
      agent: decision.agent,
      block: buildRouteBlock(decision),
    };
  }
  return {
    kind:  'suggest',
    agent: decision.agent,
    block: buildSuggestBlock(decision),
  };
}

function buildRouteBlock(decision) {
  return [
    '## Kodelyth Intent Routing',
    '',
    `→ Routing to **${decision.agent}** (confidence ${Math.round(decision.confidence * 100)}%)`,
    '',
    `Behave as the **${decision.agent}** specialist for this turn. Apply its methodology, tone, and constraints. Start your reply with a single line acknowledging the routing so the user sees it, then act as that agent.`,
    '',
    `Tip: next time, type "use ${decision.agent}" to invoke it directly.`,
    '',
  ].join('\n');
}

function buildSuggestBlock(decision) {
  const others = decision.runners_up.length
    ? ` Runners-up: ${decision.runners_up.join(', ')}.`
    : '';
  return [
    '## Kodelyth Intent Routing (suggestion)',
    '',
    `This prompt looks like a job for **${decision.agent}** (confidence ${Math.round(decision.confidence * 100)}%).${others}`,
    '',
    `Not high enough confidence to auto-route. Answer normally, but consider naming the agent you would use if you were the user: "you could try 'use ${decision.agent}'".`,
    '',
  ].join('\n');
}

module.exports = { classify, directive, RULES };
