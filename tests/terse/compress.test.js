// Tests for scripts/terse/compress.js — the markdown compressor.
//
// Every test below pins a bug that actually shipped. The module went out with
// no tests, and an adversarial pass found six real defects — the worst of them
// silently destroyed every URL in the user's file. Each `regression:` test names
// the defect it prevents from coming back.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { compressText, compressFile } = require('../../scripts/terse/compress');

// POSIX file semantics do not exist on Windows: chmod only toggles the
// read-only bit, statSync().mode is synthesized rather than real, umask is
// meaningless, and symlinkSync needs administrator rights or Developer Mode.
// Tests that assert those semantics are skipped there — the behaviour they
// guard is real on Linux and macOS, which is where CI proves it.
const POSIX_ONLY = { skip: process.platform === 'win32' ? 'POSIX file semantics only' : false };


const out = (s) => compressText(s).output;

// ── Guard rails: preserved regions must survive byte-for-byte ────────────────

test('regression: markdown link URLs survive compression', () => {
  // Shipped bug: the URL inside `](...)` was masked by the bare-URL rule and
  // then re-masked by the link rule, nesting one sentinel inside another.
  // String.replace does not rescan its replacement text, so the inner sentinel
  // leaked out and the real URL was destroyed.
  const src = 'Read [the docs](https://example.com/a/b?c=1&d=2) now.';
  assert.equal(out(src), src);
});

test('regression: relative, anchor, and query link targets all survive', () => {
  for (const src of [
    'See [x](./y.md) here.',
    'Go [z](#anchor) now.',
    'Try [q](../up/one.md) too.',
    'Hit [a](https://ex.com/p?b=1&c=2) ok.',
  ]) {
    assert.equal(out(src), src, src);
  }
});

test('regression: output never contains NUL bytes', () => {
  // The sentinel framing uses NUL. A leak meant writing raw control bytes into
  // the user's markdown file.
  const src = 'A [link](https://a.co/x) and `code` and /abs/path here.';
  assert.ok(!out(src).includes('\u0000'), 'sentinel leaked into output');
});

test('fenced code blocks are byte-exact', () => {
  const src = '```js\nconst x = 1;   // in order to keep spacing\n```\n';
  assert.equal(out(src), src);
});

test('inline code is preserved verbatim', () => {
  const src = 'Call `doThing(a,  b)` please.';
  assert.equal(out(src), src);
});

test('file paths are preserved verbatim', () => {
  const src = 'Open /Users/a/b_c-d.txt and ~/.config/x now.';
  assert.equal(out(src), src);
});

test('YAML frontmatter is preserved verbatim', () => {
  const src = '---\ntitle:  My Doc\ntags:   [a, b]\n---\n\nBody text.\n';
  assert.ok(out(src).startsWith('---\ntitle:  My Doc\ntags:   [a, b]\n---'));
});

// ── Prose transforms ────────────────────────────────────────────────────────

test('regression: REPLACE substitutions are reachable', () => {
  // Shipped bug: FILLERS duplicated several REPLACE patterns. Deletions ran
  // after substitutions, so "in order to" was deleted outright instead of
  // becoming "to", leaving "Run it deploy."
  const cases = [
    ['Run it in order to deploy.',              'Run it to deploy.'],
    ['It failed due to the fact that x.',       'It failed because x.'],
    ['We have a number of options.',            'We have many options.'],
    ['A note with regard to timing.',           'A note about timing.'],
    ['Built for the purpose of speed.',         'Built to speed.'],
    ['Stop at this point in time.',             'Stop now.'],
  ];
  for (const [src, want] of cases) {
    assert.equal(out(src), want, src);
  }
});

test('regression: words that carry a threshold are never deleted', () => {
  // Shipped bug: FILLERS deleted very/extremely/highly/super/totally and
  // just/simply/quite/really. This tool's documented target is CLAUDE.md,
  // rules/, and lessons.md — governance prose, where those words ARE the
  // policy. "approval unless the risk is extremely low" became "...is low",
  // silently widening a permission gate.
  const mustSurviveIntact = [
    'This action requires human approval unless the risk is extremely low.',
    'Auto-merge is allowed only for very minor changes such as typo fixes.',
    'This is a highly sensitive endpoint.',
    'Only very experienced maintainers may force-push.',
    'Run just the failing test, not the whole suite.',
    'You cannot simply skip the review step.',
    'The blast radius is quite large.',
    'This is a really critical path.',
  ];
  for (const src of mustSurviveIntact) {
    assert.equal(out(src), src, `meaning-bearing word dropped from: ${src}`);
  }
});

test('regression: negations and scope words survive compression', () => {
  // Verified alongside the above: nothing in the tables matches not/never/
  // must/only, so directives are not inverted. Pinned so a future filler
  // addition cannot quietly introduce one.
  for (const src of [
    "It's important to note that you must not push to main.",
    'You should never delete files without asking.',
    'Do not run this without approval.',
    'Never commit secrets, and always rotate exposed keys.',
    'You can only deploy after the tests pass.',
  ]) {
    const got = out(src);
    for (const word of ['not', 'never', 'only', 'always']) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(src)) {
        assert.match(got, new RegExp(`\\b${word}\\b`, 'i'), `"${word}" lost from: ${src}`);
      }
    }
  }
});

test('contentless hedges are still removed', () => {
  // The fix above must not turn the compressor into a no-op on real filler.
  assert.equal(out('Basically, the parser is recursive.'), 'the parser is recursive.');
  assert.equal(out('Obviously, this needs a test.'), 'this needs a test.');
  assert.equal(out('That actually works fine.'), 'That works fine.');
});

test('compression is idempotent', () => {
  // Shipped bug: stripFillers ran a single ordered pass, so removing one filler
  // could expose a pattern an earlier rule would have matched. A second run
  // produced different output than the first.
  const src = 'Basically, I think that you can just simply run it in order to win.';
  const once = out(src);
  assert.equal(out(once), once, 'second pass changed the text');
});

test('compression actually removes filler', () => {
  const src = 'Great question! Basically, I would recommend that you use the API.';
  const got = out(src);
  assert.ok(got.length < src.length, 'nothing was removed');
  assert.ok(!/Great question/i.test(got));
});

test('stats report real byte counts', () => {
  const { output, stats } = compressText('Absolutely! Just run it.');
  assert.equal(stats.originalBytes, Buffer.byteLength('Absolutely! Just run it.', 'utf8'));
  assert.equal(stats.newBytes, Buffer.byteLength(output, 'utf8'));
  assert.equal(stats.saved, stats.originalBytes - stats.newBytes);
});

// ── Input rejection ─────────────────────────────────────────────────────────

test('NUL in the input is rejected, not silently mangled', () => {
  assert.throws(() => compressText('a\u0000b'), /NUL/);
});

test('non-string input is rejected', () => {
  assert.throws(() => compressText(null), TypeError);
  assert.throws(() => compressText(Buffer.from('x')), TypeError);
});

test('regression: oversized input is refused rather than processed', () => {
  assert.throws(() => compressText("a".repeat(3 * 1024 * 1024)), /over the 2 MB limit/);
});

// ── Performance: the ReDoS that shipped ─────────────────────────────────────

test('regression: unbalanced link parens do not trigger quadratic backtracking', () => {
  // Shipped bug: `/(\]\()([^)]+)(\))/g` is unanchored and unbounded, so at every
  // `](` the engine scanned to EOF hunting a `)`, failed, and backtracked.
  // A 293 KB document with one unclosed paren took 7.6 seconds. Note that
  // excluding `\n` alone does NOT fix it — the length bound is what matters.
  const src = '[x](y '.repeat(50000); // ~293 KB, never closes a paren
  const started = Date.now();
  compressText(src);
  const elapsed = Date.now() - started;
  // Bounded version measures ~230ms. A regression to the unbounded form blows
  // past 7s, so this threshold is far from the noise floor.
  assert.ok(elapsed < 2000, `took ${elapsed}ms — the length bound is gone`);
});

// ── File handling ───────────────────────────────────────────────────────────

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'terse-test-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('dry run does not touch the file', () => {
  withTempDir((dir) => {
    const f = path.join(dir, 'a.md');
    const src = 'Basically, just run it.';
    fs.writeFileSync(f, src);
    const res = compressFile(f, { write: false });
    assert.equal(res.wrote, false);
    assert.equal(fs.readFileSync(f, 'utf8'), src, 'file was modified during a dry run');
  });
});

test('regression: a second run never clobbers the original backup', () => {
  // Shipped bug: the backup path was fixed, so run 2 overwrote the only copy of
  // the true original with already-compressed text. The original was gone.
  withTempDir((dir) => {
    const f = path.join(dir, 'a.md');
    const src = 'Basically, I would recommend that you read [docs](https://ex.com/x).';
    fs.writeFileSync(f, src);

    const first = compressFile(f, { write: true });
    assert.equal(first.wrote, true);
    assert.equal(fs.readFileSync(first.backupPath, 'utf8'), src, 'backup is not the original');

    // Second run finds nothing left to save and must leave everything alone.
    const second = compressFile(f, { write: true });
    assert.equal(second.wrote, false);
    assert.equal(second.skipped, 'no savings');
    assert.equal(fs.readFileSync(first.backupPath, 'utf8'), src, 'backup was clobbered');
  });
});

test('no temp files are left behind after a write', () => {
  withTempDir((dir) => {
    const f = path.join(dir, 'a.md');
    fs.writeFileSync(f, 'Basically, just run it now please.');
    compressFile(f, { write: true });
    const leftovers = fs.readdirSync(dir).filter((n) => n.includes('terse-tmp'));
    assert.deepEqual(leftovers, [], `temp files left: ${leftovers.join(', ')}`);
  });
});

test('a missing file reports a clear error', () => {
  assert.throws(() => compressFile('/definitely/not/here.md'), /file not found/);
});

// ── File permissions and symlinks: the adversarial pass ─────────────────────

const FILLER = 'Basically, I would recommend that you read this document now.';
const modeOf = (p) => fs.lstatSync(p).mode & 0o777;

test("regression: original file permissions are preserved exactly", POSIX_ONLY, () => {
  // Shipped bug: the replacement and the backup were created fresh under the
  // process umask, so compressing a 0600 file silently republished it as 0644 —
  // no attacker needed, just `terse compress` on a private CLAUDE.md.
  withTempDir((dir) => {
    const f = path.join(dir, 'priv.md');
    fs.writeFileSync(f, FILLER);
    fs.chmodSync(f, 0o600);
    const res = compressFile(f, { write: true, backup: true });
    assert.equal(modeOf(f), 0o600, 'file mode was widened');
    assert.equal(modeOf(res.backupPath), 0o600, 'backup mode was widened');
  });
});

test("regression: mode preservation is not distorted by the umask", POSIX_ONLY, () => {
  // `open`'s mode argument is filtered through the umask, so a 0644 original
  // came back 0600 under `umask 077`. fchmod after the write ignores the umask.
  const prev = process.umask(0o077);
  try {
    withTempDir((dir) => {
      const f = path.join(dir, 'shared.md');
      fs.writeFileSync(f, FILLER);
      fs.chmodSync(f, 0o644);
      compressFile(f, { write: true, backup: false });
      assert.equal(modeOf(f), 0o644, 'umask leaked into the preserved mode');
    });
  } finally {
    process.umask(prev);
  }
});

test('regression: symlinked targets are refused, not followed', () => {
  // Shipped bug: readFileSync followed the link, so a 0600 secret's contents
  // were copied into a backup sitting beside the (public) link.
  withTempDir((dir) => {
    const secret = path.join(dir, 'secret.md');
    const link = path.join(dir, 'readme.md');
    fs.writeFileSync(secret, FILLER);
    fs.chmodSync(secret, 0o600);
    fs.symlinkSync(secret, link);

    assert.throws(() => compressFile(link, { write: true }), /symlink/);
    assert.ok(!fs.existsSync(`${link}.pre-terse.bak`), 'a backup was created from a symlink');
  });
});

test("regression: a planted dangling backup symlink is not written through", POSIX_ONLY, () => {
  // Shipped bug: fs.existsSync reports a DANGLING symlink as absent, so the
  // no-clobber check was skipped and the plain write followed the link to a
  // path the attacker chose. O_EXCL fails on the link itself instead.
  withTempDir((dir) => {
    const f = path.join(dir, 'doc.md');
    const victim = path.join(dir, 'victim.md');
    fs.writeFileSync(f, FILLER);
    fs.symlinkSync(victim, `${f}.pre-terse.bak`); // dangling: victim does not exist

    const res = compressFile(f, { write: true, backup: true });
    assert.ok(!fs.existsSync(victim), 'wrote through the planted symlink');
    assert.notEqual(res.backupPath, `${f}.pre-terse.bak`, 'reused the symlinked path');
  });
});

test('regression: a failed rename leaves no temp file behind', () => {
  // Shipped bug: no try/finally around write+rename, and the temp name was
  // `<file>.terse-tmp-<pid>` — predictable enough to pre-plant a symlink on.
  withTempDir((dir) => {
    const f = path.join(dir, 'crash.md');
    fs.writeFileSync(f, FILLER);

    const realRename = fs.renameSync;
    fs.renameSync = () => { throw new Error('simulated crash'); };
    try {
      assert.throws(() => compressFile(f, { write: true, backup: false }), /simulated crash/);
    } finally {
      fs.renameSync = realRename;
    }

    const strays = fs.readdirSync(dir).filter((n) => n.includes('terse-tmp'));
    assert.deepEqual(strays, [], `temp file survived the crash: ${strays.join(', ')}`);
  });
});

test('regression: temp filenames are unpredictable', () => {
  // A pid-based suffix lets another process pre-plant a symlink there.
  withTempDir((dir) => {
    const seen = new Set();
    for (let i = 0; i < 3; i++) {
      const f = path.join(dir, `d${i}.md`);
      fs.writeFileSync(f, FILLER);
      const realRename = fs.renameSync;
      fs.renameSync = (tmp) => { seen.add(path.basename(tmp).replace(/^d\d+\.md/, '')); throw new Error('stop'); };
      try { compressFile(f, { write: true, backup: false }); } catch { /* expected */ }
      finally { fs.renameSync = realRename; }
    }
    assert.equal(seen.size, 3, 'temp suffix repeated across runs');
    for (const s of seen) assert.ok(!s.includes(String(process.pid)), 'temp name contains the pid');
  });
});

test('an oversized file is refused without being read into memory', () => {
  // The cap lives in compressText, which runs after the read — so compressFile
  // pulled the whole file in only to reject it a line later. The stat is already
  // in hand from the lstat guard; use it.
  withTempDir((dir) => {
    const f = path.join(dir, 'big.md');
    fs.writeFileSync(f, 'a'.repeat(3 * 1024 * 1024));
    assert.throws(() => compressFile(f, { write: false }), /over the 2 MB limit/);
  });
});

test('a directory is refused rather than read', () => {
  withTempDir((dir) => {
    assert.throws(() => compressFile(dir, { write: true }), /not a regular file/);
  });
});
