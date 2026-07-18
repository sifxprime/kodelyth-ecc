// scripts/router/signals.js
// Curated high-signal phrase → agent map, distilled from the 10-tier routing
// rule (rules/common/agent-intent-routing.md). route_intent uses these as a
// strong prior on top of token-overlap, because "TypeError" should route to
// debug-detective even though that word isn't in the agent's description.
//
// Each entry: { agent, weight, patterns: [regex...] }. Higher weight wins ties.
// Order does not matter; the scorer sums all matches. Keep patterns specific —
// a false match here directly lowers routing accuracy (measured by the eval).
'use strict';

const SIGNALS = [
  // ── Priority 2 — active pain ──────────────────────────────────────────────
  { agent: 'debug-detective', weight: 3, patterns: [
    /\btype ?error\b/i, /\bnull ?pointer\b/i, /\bundefined\b/i, /\bstack ?trace\b/i,
    /\bexception\b/i, /\bcrash(?:ed|ing)?\b/i, /\bcannot read propert/i, /\bsegfault\b/i,
    /\bpanic\b/i, /\btraceback\b/i, /\bthrows? an? error\b/i, /\bbug\b/i, /\bbroken\b/i,
    /\bblow(?:s|ing)? up\b/i, /\bis not a function\b/i, /\bkeeps? (?:failing|erroring)\b/i,
  ] },
  { agent: 'silent-failure-hunter', weight: 4, patterns: [
    /\bno error\b/i, /\bwrong (?:data|result|output|value)\b/i, /\bworks but\b/i,
    /\bsilently fails?\b/i, /\breturns? (?:null|wrong)\b/i, /\brace condition\b/i,
  ] },
  { agent: 'build-error-resolver', weight: 4, patterns: [
    /\bbuild (?:is )?fail/i, /\bwon'?t compile\b/i, /\bcompile error\b/i, /\bTS\d{3,}\b/,
    /\btype mismatch\b/i, /\bmodule not found\b/i, /\bcannot resolve\b/i, /\bnpm run build\b/i,
  ] },
  // ── Priority 3 — quality & review ─────────────────────────────────────────
  { agent: 'security-reviewer', weight: 4, patterns: [
    /\bsecur(?:e|ity)\b/i, /\bvulnerab/i, /\bsql injection\b/i, /\bxss\b/i, /\bcsrf\b/i,
    /\bauth(?:entication)? (?:flow|bypass)\b/i, /\bjwt\b/i, /\bexploit/i, /\bowasp\b/i,
  ] },
  { agent: 'api-guardian', weight: 4, patterns: [
    /\bbreaking change\b/i, /\bapi (?:change|version|contract)\b/i, /\bbreak (?:existing )?consumers?\b/i,
    /\bbackwards? compat/i, /\bdeprecat/i, /\bopenapi\b/i, /\bgraphql schema\b/i,
  ] },
  { agent: 'ux-reviewer', weight: 4, patterns: [
    /\ba11y\b/i, /\baccessib/i, /\bscreen reader\b/i, /\bwcag\b/i, /\baria\b/i,
    /\bkeyboard (?:nav|access|only|user|trap)/i, /\b(?:only|just) (?:use|using) (?:a |the )?keyboard\b/i,
    /\bmobile\b/i, /\bresponsive\b/i, /\bcolor contrast\b/i, /\btouch target\b/i,
    /\bunreachable\b/i, /\bcan'?t (?:click|tab|reach)\b/i,
  ] },
  { agent: 'code-reviewer', weight: 2, patterns: [
    /\breview (?:this|my) (?:code|pr|change)\b/i, /\bcode review\b/i, /\blgtm\b/i,
    /\bis this (?:good|clean)\b/i,
  ] },
  // ── Priority 4 — performance & scale ──────────────────────────────────────
  { agent: 'incident-commander', weight: 5, patterns: [
    /\bproduction (?:is )?down\b/i, /\boutage\b/i, /\bsite (?:is )?down\b/i, /\bp0\b/i, /\bp1\b/i,
    /\bincident\b/i, /\bon.?call\b/i, /\b500 error/i, /\busers? (?:can'?t|getting)\b.*\b(?:login|error)/i,
  ] },
  { agent: 'load-tester', weight: 4, patterns: [
    /\bload test/i, /\bstress test/i, /\bconcurrent users?\b/i, /\bbreaking point\b/i,
    /\bmax rps\b/i, /\bhandle \d+[k]? (?:users|requests)/i, /\bwill (?:it|this) scale\b/i,
  ] },
  { agent: 'performance-optimizer', weight: 3, patterns: [
    /\bslow\b/i, /\bsluggish\b/i, /\btoo slow\b/i, /\btiming out\b/i, /\bmemory leak\b/i,
    /\boom\b/i, /\bhigh cpu\b/i, /\bn\+1\b/i, /\bbottleneck\b/i, /\boptimize\b/i, /\bmake (?:this|it) faster\b/i,
    /\btakes forever\b/i, /\bgets? (?:slow|slower)\b/i, /\bwhen (?:the )?(?:table|data|list) (?:gets?|is) (?:big|large)/i,
  ] },
  // ── Priority 5 — planning & architecture ──────────────────────────────────
  { agent: 'architect', weight: 3, patterns: [
    /\barchitecture\b/i, /\bsystem design\b/i, /\bmicroservices?\b/i, /\bhow should (?:the )?services\b/i,
    /\bmonorepo vs\b/i, /\bshould i use (?:postgres|mongo|redis)\b/i,
  ] },
  { agent: 'planner', weight: 2, patterns: [
    /\bplan (?:this|the|out)\b/i, /\broadmap\b/i, /\bbreak (?:this )?down\b/i, /\bsprint plan\b/i, /\bmilestones?\b/i,
  ] },
  { agent: 'migration-guide', weight: 4, patterns: [
    /\bmigrat(?:e|ion)\b/i, /\bupgrade from\b/i, /\b(?:next\.?js|react|node|python|vue) \d+ (?:to|→) \d+/i,
    /\bmajor version\b/i,
  ] },
  // ── Priority 6 — testing ──────────────────────────────────────────────────
  { agent: 'tdd-guide', weight: 4, patterns: [
    /\bwrite (?:a )?(?:unit |integration )?tests?\b/i, /\btdd\b/i, /\btest.driven\b/i,
    /\btests? for (?:this|the)\b/i, /\bcoverage\b/i, /\bred.green.refactor\b/i,
  ] },
  { agent: 'e2e-runner', weight: 4, patterns: [
    /\bplaywright\b/i, /\be2e\b/i, /\bend.to.end\b/i, /\bbrowser test\b/i, /\buser flow test\b/i,
  ] },
  { agent: 'flake-hunter', weight: 5, patterns: [
    /\bflak(?:y|e)\b/i, /\bpasses? locally but fails?\b/i, /\bfails? (?:randomly|intermittent|on ci)\b/i,
    /\bci is red\b/i,
  ] },
  // ── Priority 7 — code hygiene ─────────────────────────────────────────────
  { agent: 'refactor-cleaner', weight: 4, patterns: [
    /\bdead code\b/i, /\bunused (?:code|imports?|vars?)\b/i, /\bclean ?up\b/i, /\btech debt\b/i,
    /\bremove (?:old|duplicate)\b/i,
  ] },
  { agent: 'code-simplifier', weight: 4, patterns: [
    /\btoo complex\b/i, /\bhard to read\b/i, /\bsimplif(?:y|ies)\b/i, /\bconvoluted\b/i,
    /\bmore readable\b/i, /\beasier to (?:read|follow)\b/i, /\btangled\b/i, /\b(?:a |is a )mess\b/i,
    /\bspaghetti\b/i, /\bnobody can understand\b/i,
  ] },
  { agent: 'type-design-analyzer', weight: 4, patterns: [
    /\btype safety\b/i, /\bstricter types?\b/i, /\bremove (?:all )?(?:the )?any\b/i,
    /\bdiscriminated union\b/i, /\bbetter types?\b/i,
  ] },
  // ── Priority 8 — docs & exploration ───────────────────────────────────────
  { agent: 'doc-updater', weight: 3, patterns: [
    /\bupdate (?:the )?readme\b/i, /\bwrite (?:the )?(?:docs|documentation)\b/i, /\bdocument this\b/i,
    /\bjsdoc\b/i, /\bdocstring\b/i,
  ] },
  { agent: 'code-explorer', weight: 4, patterns: [
    /\bexplain how this (?:code|codebase|project)\b/i, /\bunfamiliar codebase\b/i,
    /\bhow (?:is|does) this (?:structured|work)\b/i, /\bwalk me through\b/i, /\bwhat is all this\b/i,
  ] },
  // ── Ops & dependency ──────────────────────────────────────────────────────
  { agent: 'dependency-doctor', weight: 4, patterns: [
    /\bpeer dependenc/i, /\bnpm install (?:keeps )?fail/i, /\bdependency (?:hell|conflict)\b/i,
    /\blockfile\b/i, /\bcve\b/i, /\boutdated packages?\b/i,
  ] },
  { agent: 'git-rescue', weight: 5, patterns: [
    // rebase only counts as a rescue signal alongside a trouble word — plain
    // "document how to rebase" is docs, not a broken-git emergency.
    /\brebase\b.*\b(?:sideways|wrong|bad|lost|broke|broken|mess|stuck|fail|help)/i,
    /\b(?:bad|failed|broken|botched) rebase\b/i,
    /\blost (?:my )?commits?\b/i, /\bdetached head\b/i,
    /\bgit (?:is )?(?:broken|messed up)\b/i, /\bforce.push(?:ed)?\b/i, /\brecover (?:my )?commits?\b/i,
    /\bwork (?:vanished|disappeared|gone)\b/i, /\bwent sideways\b/i,
  ] },
  { agent: 'release-captain', weight: 4, patterns: [
    /\bcut (?:a )?(?:new )?release\b/i, /\btag (?:a )?(?:new )?version\b/i, /\bchangelog\b/i,
    /\bsemver\b/i, /\bship(?:ping)? (?:a )?(?:release|version)\b/i,
  ] },
  { agent: 'env-debugger', weight: 4, patterns: [
    /\bworks on my machine\b/i, /\bworks locally (?:but )?(?:not|fails)\b/i, /\benv(?:ironment)? var/i,
    /\bmissing (?:env|secret|config)\b/i, /\bdifferent (?:in|on) (?:prod|staging|ci)\b/i,
  ] },
  // ── Devil-mode adversarial crew ───────────────────────────────────────────
  { agent: 'supply-chain-auditor', weight: 5, patterns: [
    /\btyposquat\b/i, /\bmalicious (?:dep|package|dependency)\b/i, /\bdependency confusion\b/i,
    /\bcould (?:this )?(?:dep|package) be malicious\b/i, /\bpost.?install script\b/i,
    /\bpackage.*(?:steal|stealing|malicious|suspicious)\b/i, /\b(?:steal|stealing) data\b/i,
    /\bis (?:this|that) (?:package|dependency|dep) safe\b/i,
  ] },
  { agent: 'secret-hunter', weight: 5, patterns: [
    /\bleak(?:ed)? (?:secrets?|api keys?|credentials?|tokens?)\b/i, /\bscan.*(?:secrets?|api keys?)\b/i,
    /\bsecrets? in (?:code|git|history)\b/i, /\bexposed (?:credential|key|token)\b/i,
    /\bhardcoded (?:password|secret|key|token|credential)/i, /\bpasswords? (?:committed|in the repo)\b/i,
  ] },
  { agent: 'prompt-injection-hunter', weight: 5, patterns: [
    /\bprompt injection\b/i, /\bjailbroken?\b/i, /\bjailbreak\b/i, /\bmy (?:ai|llm|chatbot|agent) (?:feature )?(?:be )?safe\b/i,
    /\bsystem.prompt leak\b/i, /\bmcp server safe\b/i,
  ] },
  { agent: 'backdoor-hunter', weight: 5, patterns: [
    /\bbackdoor\b/i, /\bobfuscated (?:code|payload)\b/i, /\bhidden payload\b/i,
    /\bwhat does this eval\b/i, /\bvendored (?:library|code)\b.*\baudit\b/i, /\baudit.*\bbackdoor/i,
  ] },
  { agent: 'chaos-engineer', weight: 4, patterns: [
    /\bchaos engineer/i, /\bfault injection\b/i, /\bwhat happens if .* dies\b/i, /\bresilience\b/i,
    /\bfailure modes?\b/i,
  ] },
];

// Score every agent by summing weights of matched signal patterns.
// Returns [{ agent, signalScore, hits }] sorted desc, only positives.
function scoreSignals(message) {
  if (!message || typeof message !== 'string') return [];
  const acc = {};
  for (const entry of SIGNALS) {
    let hits = 0;
    for (const rx of entry.patterns) {
      if (rx.test(message)) hits++;
    }
    if (hits > 0) {
      const gain = entry.weight * hits;
      if (!acc[entry.agent]) acc[entry.agent] = { agent: entry.agent, signalScore: 0, hits: 0 };
      acc[entry.agent].signalScore += gain;
      acc[entry.agent].hits += hits;
    }
  }
  return Object.values(acc).sort((a, b) => b.signalScore - a.signalScore);
}

module.exports = { SIGNALS, scoreSignals };
