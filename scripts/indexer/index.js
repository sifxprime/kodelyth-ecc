// =============================================================================
// Kodelyth ECC — Bundled Codebase Indexer
//
// Zero-dep, cross-language, incremental indexer. Produces a knowledge graph
// {nodes: Symbol[], edges: (Import|Call|Contains)[]} persisted to
// <project>/.kodelythecc/graph.json with a per-file hash manifest.
//
// Languages: TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin
// (regex-based — fast, no runtime deps, deliberately approximate. Trade-off
// is accepted; the graph is a hint layer, not a formal AST.)
//
// Rebuild policy: on run, we hash every source file; only re-parse files
// whose hash changed since last run. First run indexes everything.
// =============================================================================

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const fabric    = require('../lib/fabric');
const telemetry = require('../lib/telemetry');

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', '.venv', 'venv',
  '__pycache__', '.pytest_cache', '.turbo', '.svelte-kit', 'target',
  '.kodelythecc', '.kodelyth', 'coverage', '.nyc_output', '.cache',
  '.vercel', 'out', 'tmp', 'temp',
]);

const LANG_BY_EXT = {
  '.ts':'ts', '.tsx':'ts', '.mts':'ts', '.cts':'ts',
  '.js':'js', '.jsx':'js', '.mjs':'js', '.cjs':'js',
  '.py':'py',
  '.go':'go',
  '.rs':'rs',
  '.java':'java',
  '.kt':'kt', '.kts':'kt',
};

const MAX_FILE_BYTES = 500 * 1024; // skip files > 500KB

// ── Main entry ──────────────────────────────────────────────────────────────
function indexRepo(projectRoot, { incremental = true } = {}) {
  const started = Date.now();
  const paths   = fabric.project(projectRoot);
  fabric.ensureProject(projectRoot);

  const existing = fabric.readJson(paths.graph, { nodes: [], edges: [] });
  const manifest = incremental
    ? fabric.readJson(paths.graphManifest, { files: {}, indexed_at: null })
    : { files: {}, indexed_at: null };

  const files = walk(projectRoot);
  const newManifest = { files: {}, indexed_at: new Date().toISOString(), project: projectRoot };
  const changedFiles = [];
  const unchanged = [];

  for (const file of files) {
    let stat;
    try { stat = fs.statSync(file); } catch { continue; }
    if (stat.size > MAX_FILE_BYTES) continue;

    const hash = hashFile(file);
    if (!hash) continue;
    newManifest.files[file] = { hash, size: stat.size };

    if (manifest.files[file] && manifest.files[file].hash === hash) {
      unchanged.push(file);
    } else {
      changedFiles.push(file);
    }
  }

  // For unchanged files, keep existing nodes/edges belonging to them.
  const filesToRemove = new Set(
    Object.keys(manifest.files).filter(f => !newManifest.files[f])
  );
  const keptNodes = existing.nodes.filter(n =>
    unchanged.includes(n.file) && !filesToRemove.has(n.file)
  );
  const keptEdges = existing.edges.filter(e =>
    unchanged.includes(e.file) && !filesToRemove.has(e.file)
  );

  // Parse changed files.
  const freshNodes = [];
  const freshEdges = [];
  for (const file of changedFiles) {
    try {
      const parsed = parseFile(file, projectRoot);
      freshNodes.push(...parsed.nodes);
      freshEdges.push(...parsed.edges);
    } catch (err) {
      // Never fail the index over a single file.
    }
  }

  const graph = {
    project:  projectRoot,
    version:  2,
    indexed_at: newManifest.indexed_at,
    nodes:    [...keptNodes, ...freshNodes],
    edges:    [...keptEdges, ...freshEdges],
    stats:    {
      files_total:     files.length,
      files_indexed:   Object.keys(newManifest.files).length,
      files_changed:   changedFiles.length,
      files_unchanged: unchanged.length,
      nodes_total:     keptNodes.length + freshNodes.length,
      edges_total:     keptEdges.length + freshEdges.length,
      duration_ms:     Date.now() - started,
    },
  };

  fabric.writeJson(paths.graph, graph);
  fabric.writeJson(paths.graphManifest, newManifest);

  telemetry.record('index.run', {
    project: projectRoot,
    incremental,
    ...graph.stats,
  });

  return graph;
}

// ── File walk ───────────────────────────────────────────────────────────────
function walk(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      if (ent.name.startsWith('.') && IGNORE_DIRS.has(ent.name)) continue;
      if (ent.isDirectory()) {
        if (IGNORE_DIRS.has(ent.name)) continue;
        stack.push(path.join(dir, ent.name));
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (LANG_BY_EXT[ext]) out.push(path.join(dir, ent.name));
      }
    }
  }
  return out;
}

function hashFile(file) {
  try {
    const buf = fs.readFileSync(file);
    return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
  } catch { return null; }
}

// ── Language-aware parsing ──────────────────────────────────────────────────
function parseFile(file, projectRoot) {
  const ext  = path.extname(file).toLowerCase();
  const lang = LANG_BY_EXT[ext];
  const rel  = path.relative(projectRoot, file);
  let source;
  try { source = fs.readFileSync(file, 'utf8'); } catch { return { nodes: [], edges: [] }; }

  switch (lang) {
    case 'ts':
    case 'js':
      return parseJsTs(source, file, rel, lang);
    case 'py':
      return parsePython(source, file, rel);
    case 'go':
      return parseGo(source, file, rel);
    case 'rs':
      return parseRust(source, file, rel);
    case 'java':
    case 'kt':
      return parseJvm(source, file, rel, lang);
    default:
      return { nodes: [], edges: [] };
  }
}

function mkNode(kind, name, file, rel, line, extra = {}) {
  return { id: `${rel}#${kind}:${name}:${line}`, kind, name, file, rel, line, ...extra };
}

function mkEdge(type, from, to, file, meta = {}) {
  return { type, from, to, file, meta };
}

// ── JS/TS parser ────────────────────────────────────────────────────────────
function parseJsTs(src, file, rel, lang) {
  const nodes = [];
  const edges = [];
  const lines = src.split('\n');

  const rx = {
    importFrom:   /^\s*import\s+(?:[^'"`]+?\s+from\s+)?['"]([^'"`]+)['"]/,
    requireCall:  /require\(['"]([^'"`]+)['"]\)/g,
    fnDecl:       /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
    arrowConst:   /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?[^)]*\)?\s*=>/,
    classDecl:    /^\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
    method:       /^\s*(?:public|private|protected|static|async|readonly|\s)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/,
    reactComp:    /^\s*(?:export\s+(?:default\s+)?)?function\s+([A-Z][A-Za-z0-9_$]*)\s*\(/,
    apiRoute:     /^\s*export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS)\s*\(/,
    typeDecl:     /^\s*(?:export\s+)?(?:type|interface)\s+([A-Za-z_$][\w$]*)/,
    callSite:     /\b([A-Za-z_$][\w$]*)\s*\(/g,
  };

  let currentClass = null;
  lines.forEach((line, i) => {
    const ln = i + 1;

    let m;
    if ((m = rx.importFrom.exec(line))) {
      const target = m[1];
      const importNode = mkNode('import', target, file, rel, ln);
      nodes.push(importNode);
      edges.push(mkEdge('IMPORTS', rel, target, file, { line: ln }));
      return;
    }

    // ES require()
    let rm;
    while ((rm = rx.requireCall.exec(line)) !== null) {
      const target = rm[1];
      edges.push(mkEdge('REQUIRES', rel, target, file, { line: ln }));
    }

    if ((m = rx.apiRoute.exec(line))) {
      nodes.push(mkNode('route', m[1], file, rel, ln, { httpMethod: m[1] }));
      return;
    }
    if ((m = rx.reactComp.exec(line))) {
      nodes.push(mkNode('component', m[1], file, rel, ln));
      return;
    }
    if ((m = rx.fnDecl.exec(line))) {
      nodes.push(mkNode('function', m[1], file, rel, ln));
      return;
    }
    if ((m = rx.arrowConst.exec(line))) {
      nodes.push(mkNode('function', m[1], file, rel, ln, { style: 'arrow' }));
      return;
    }
    if ((m = rx.classDecl.exec(line))) {
      currentClass = m[1];
      nodes.push(mkNode('class', m[1], file, rel, ln));
      return;
    }
    if ((m = rx.typeDecl.exec(line))) {
      nodes.push(mkNode('type', m[1], file, rel, ln));
      return;
    }
    // Class methods (only when inside a class context on the current top-level)
    if (currentClass && (m = rx.method.exec(line))) {
      const name = m[1];
      if (!['if','for','while','switch','return','function','const','let','var','import','export'].includes(name)) {
        nodes.push(mkNode('method', `${currentClass}.${name}`, file, rel, ln, { class: currentClass }));
      }
    }
    if (/^\s*}\s*$/.test(line)) currentClass = null; // very loose scope tracking
  });

  // Call edges (approximate — same-file only, filtered by known local symbols)
  const localNames = new Set(nodes.filter(n => ['function','method','component'].includes(n.kind)).map(n => n.name.split('.').pop()));
  lines.forEach((line, i) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    let m;
    while ((m = rx.callSite.exec(line)) !== null) {
      const callee = m[1];
      if (['if','for','while','switch','return','typeof','new','function','async','await','import','export','require','console'].includes(callee)) continue;
      if (localNames.has(callee)) {
        edges.push(mkEdge('CALLS', rel, callee, file, { line: i + 1 }));
      }
    }
  });

  return { nodes, edges };
}

// ── Python parser ───────────────────────────────────────────────────────────
function parsePython(src, file, rel) {
  const nodes = [], edges = [];
  const lines = src.split('\n');
  const rx = {
    imp:      /^\s*(?:from\s+([\w.]+)\s+import\s+|import\s+([\w.]+))/,
    fnDecl:   /^\s*def\s+([A-Za-z_][\w]*)/,
    asyncFn:  /^\s*async\s+def\s+([A-Za-z_][\w]*)/,
    classDecl:/^\s*class\s+([A-Za-z_][\w]*)/,
    decorator:/^\s*@([\w.]+)/,
  };
  lines.forEach((line, i) => {
    const ln = i + 1;
    let m;
    if ((m = rx.imp.exec(line))) {
      const target = m[1] || m[2];
      nodes.push(mkNode('import', target, file, rel, ln));
      edges.push(mkEdge('IMPORTS', rel, target, file, { line: ln }));
    }
    if ((m = rx.fnDecl.exec(line)) || (m = rx.asyncFn.exec(line))) {
      nodes.push(mkNode('function', m[1], file, rel, ln));
    }
    if ((m = rx.classDecl.exec(line))) {
      nodes.push(mkNode('class', m[1], file, rel, ln));
    }
  });
  return { nodes, edges };
}

function parseGo(src, file, rel) {
  const nodes = [], edges = [];
  const lines = src.split('\n');
  const rx = {
    imp:       /^\s*import\s+"([^"]+)"/,
    fnDecl:    /^\s*func\s+(?:\([^)]*\)\s+)?([A-Za-z_][\w]*)\s*\(/,
    typeDecl:  /^\s*type\s+([A-Za-z_][\w]*)\s+(struct|interface)/,
  };
  lines.forEach((line, i) => {
    const ln = i + 1;
    let m;
    if ((m = rx.imp.exec(line))) {
      nodes.push(mkNode('import', m[1], file, rel, ln));
      edges.push(mkEdge('IMPORTS', rel, m[1], file, { line: ln }));
    }
    if ((m = rx.fnDecl.exec(line))) nodes.push(mkNode('function', m[1], file, rel, ln));
    if ((m = rx.typeDecl.exec(line))) nodes.push(mkNode(m[2] === 'interface' ? 'interface' : 'struct', m[1], file, rel, ln));
  });
  return { nodes, edges };
}

function parseRust(src, file, rel) {
  const nodes = [], edges = [];
  const lines = src.split('\n');
  const rx = {
    use:      /^\s*use\s+([\w:]+)/,
    fnDecl:   /^\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_][\w]*)/,
    structDecl:/^\s*(?:pub\s+)?struct\s+([A-Za-z_][\w]*)/,
    traitDecl:/^\s*(?:pub\s+)?trait\s+([A-Za-z_][\w]*)/,
  };
  lines.forEach((line, i) => {
    const ln = i + 1;
    let m;
    if ((m = rx.use.exec(line))) edges.push(mkEdge('USES', rel, m[1], file, { line: ln }));
    if ((m = rx.fnDecl.exec(line))) nodes.push(mkNode('function', m[1], file, rel, ln));
    if ((m = rx.structDecl.exec(line))) nodes.push(mkNode('struct', m[1], file, rel, ln));
    if ((m = rx.traitDecl.exec(line))) nodes.push(mkNode('trait', m[1], file, rel, ln));
  });
  return { nodes, edges };
}

function parseJvm(src, file, rel, lang) {
  const nodes = [], edges = [];
  const lines = src.split('\n');
  const rx = {
    imp:       /^\s*import\s+([\w.]+)/,
    classDecl: /^\s*(?:public\s+|private\s+|internal\s+|open\s+|abstract\s+|final\s+|data\s+)*class\s+([A-Za-z_][\w]*)/,
    fnDecl:    lang === 'kt'
                 ? /^\s*(?:public\s+|private\s+|internal\s+|suspend\s+|open\s+|override\s+)*fun\s+([A-Za-z_][\w]*)/
                 : /^\s*(?:public|private|protected|static|final|abstract|synchronized|\s)+\s*(?:<[^>]+>\s+)?[A-Za-z_<>[\],\s]+\s+([A-Za-z_][\w]*)\s*\(/,
  };
  lines.forEach((line, i) => {
    const ln = i + 1;
    let m;
    if ((m = rx.imp.exec(line))) edges.push(mkEdge('IMPORTS', rel, m[1], file, { line: ln }));
    if ((m = rx.classDecl.exec(line))) nodes.push(mkNode('class', m[1], file, rel, ln));
    if ((m = rx.fnDecl.exec(line))) nodes.push(mkNode('function', m[1], file, rel, ln));
  });
  return { nodes, edges };
}

// ── Graph queries ───────────────────────────────────────────────────────────
function loadGraph(projectRoot) {
  const paths = fabric.project(projectRoot);
  return fabric.readJson(paths.graph, null);
}

function searchGraph(projectRoot, { name, kind, limit = 50 } = {}) {
  const g = loadGraph(projectRoot);
  if (!g) return [];
  let results = g.nodes;
  if (kind) results = results.filter(n => n.kind === kind);
  if (name) {
    const rx = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    results = results.filter(n => rx.test(n.name));
  }
  return results.slice(0, limit);
}

function callersOf(projectRoot, name) {
  const g = loadGraph(projectRoot);
  if (!g) return [];
  return g.edges.filter(e => e.type === 'CALLS' && e.to === name);
}

function calleesOf(projectRoot, fromRel) {
  const g = loadGraph(projectRoot);
  if (!g) return [];
  return g.edges.filter(e => e.type === 'CALLS' && e.from === fromRel);
}

function architecture(projectRoot) {
  const g = loadGraph(projectRoot);
  if (!g) return null;
  const byKind = {};
  const byLang = {};
  const topFiles = {};
  for (const n of g.nodes) {
    byKind[n.kind] = (byKind[n.kind] || 0) + 1;
    const ext = path.extname(n.file).toLowerCase();
    const lang = LANG_BY_EXT[ext] || 'other';
    byLang[lang] = (byLang[lang] || 0) + 1;
    topFiles[n.rel] = (topFiles[n.rel] || 0) + 1;
  }
  const top = Object.entries(topFiles).sort(([, a], [, b]) => b - a).slice(0, 20);
  return {
    stats:    g.stats,
    byKind, byLang,
    topFiles: top,
    indexed_at: g.indexed_at,
  };
}

module.exports = {
  indexRepo, loadGraph, searchGraph, callersOf, calleesOf, architecture,
  LANG_BY_EXT,
};
