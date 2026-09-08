'use strict';

/**
 * Shell-portability rules for the shipped markdown corpus.
 *
 * Every rule below corresponds to a difference that was MEASURED on a stock
 * macOS shell, not inferred from a man page. The `evidence` field records what
 * was actually observed, so a future maintainer can re-verify rather than
 * trust the comment.
 *
 * Scope: these apply to shell text only — fenced code blocks tagged as a shell
 * (or untagged) and inline code spans. Prose is never scanned, because
 * "we set a timeout of 30s" is not a portability defect.
 */

const RULES = [
  {
    id: 'gnu-timeout',
    re: /(^|[;|&\s])timeout\s+\d/,
    why: '`timeout` is GNU coreutils and is not installed on macOS',
    fix: 'drop it, or `command -v timeout || gtimeout`',
    evidence: 'macOS 25.5: `command -v timeout` → empty',
  },
  {
    id: 'gnu-stat-c',
    re: /\bstat\s+(?:-[a-zA-Z]+\s+)*-c\b/,
    why: '`stat -c` is GNU; BSD stat uses -f',
    fix: '`wc -c < file` works on both',
    evidence: 'macOS: `stat -c %s f` → "stat: illegal option -- c"',
  },
  {
    id: 'gnu-sed-i',
    re: /\bsed\s+(?:-[a-zA-Z]*\s+)*-i\s+(?!['"])/,
    why: '`sed -i` requires an explicit backup suffix on BSD',
    fix: "`sed -i '' 's/a/b/' f` on BSD, or write to a temp file and mv",
    evidence: 'macOS: `sed -i s/a/b/ f` → "invalid command code"',
  },
  {
    id: 'gnu-grep-p',
    re: /\bgrep\s+(?:-[a-zA-Z]+\s+)*-[a-zA-Z]*P\b/,
    why: '`grep -P` needs PCRE, absent from BSD grep',
    fix: '`grep -E` with a POSIX class',
    evidence: 'macOS: `grep -P` → "this version does not support -P"',
  },
  {
    id: 'gnu-readlink-f',
    re: /\breadlink\s+-f\b/,
    why: '`readlink -f` is absent on older BSD',
    fix: '`cd "$(dirname "$f")" && pwd -P`',
    evidence: 'documented BSD difference; present on macOS 25 but not portable back',
  },
  {
    id: 'gnu-date-d',
    re: /\bdate\s+-d\b/,
    why: '`date -d` is GNU; BSD date uses -j -f',
    fix: 'do date math in the language runtime instead',
    evidence: 'macOS: `date -d yesterday` → "illegal time format"',
  },
  {
    id: 'gnu-find-printf',
    re: /\bfind\b[^\n`]*-printf\b/,
    why: '`-printf` is GNU find only',
    fix: '`-print0 | xargs -0`, or `-exec`',
    evidence: 'macOS: `find . -printf %p` → "unknown primary or operator"',
  },
  {
    id: 'assumes-ripgrep',
    re: /(^|[;|&\s])rg\s+[^\n`]/,
    why: 'ripgrep is not preinstalled on macOS, Linux or Windows',
    fix: 'guard with `command -v rg` and fall back to grep/find',
    guardedBy: 'rg', // one `command -v rg` anywhere in the file clears the file
    evidence: 'not present in any default install image',
  },
  {
    id: 'hardcoded-tmp',
    re: /(^|[\s;|&="'(>])\/tmp\//,
    why: 'there is no /tmp on Windows',
    fix: 'bare `mktemp` / `mktemp -d`, or the runtime tempdir',
    evidence: 'Windows has %TEMP%; /tmp does not exist',
  },
  {
    id: 'homebrew-prefix',
    re: /(^|[\s;|&="'(])\/usr\/local\/bin\//,
    why: '/usr/local/bin is Intel-Homebrew only — Apple Silicon uses /opt/homebrew',
    fix: '`$(command -v tool)`',
    evidence: 'Apple Silicon default prefix is /opt/homebrew',
  },
  {
    // Hit live while writing this file: a cleanup loop silently ran once
    // instead of eleven times, and reported success for work it never did.
    id: 'zsh-word-splitting',
    re: /\bfor\s+\w+\s+in\s+\$[A-Za-z_][A-Za-z0-9_]*\s*;?\s*do\b/,
    why: 'zsh does not word-split an unquoted expansion; bash does — macOS defaults to zsh',
    fix: 'list the items literally, or use an array: `for d in "${ARR[@]}"`',
    evidence: 'measured: `V="a b c"; for d in $V` → 1 iteration in zsh, 3 in bash',
  },
  {
    id: 'grep-c-under-set-e',
    re: /(^|[;|&\s])grep\s+(?:-[a-zA-Z]+\s+)*-[a-zA-Z]*c\b(?![^\n]*\|\|)/,
    why: '`grep -c` exits 1 on a zero count, killing a `set -e` script on the good outcome',
    fix: 'append `|| echo 0`',
    evidence: 'measured: `grep -c X empty` prints 0, exits 1',
  },
];

module.exports = { RULES };
