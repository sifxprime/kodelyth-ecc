# Shell Portability — commands that work on the user's machine, not just yours

> Always-on. Every agent that runs a shell command loads this.

An agent that suggests `timeout 30 npm test` on macOS has wasted the user's turn:
`timeout` is GNU coreutils and **is not installed on macOS by default**. The same
goes for half the flags people reach for by habit.

The rule is simple: **assume nothing about the user's OS or installed tools.**
Detect, or use the portable form.

## Verified differences

Every row below was checked on a stock macOS shell. These are not theoretical.

| You reach for | Breaks on | Portable form |
|---|---|---|
| `timeout 30 cmd` | **macOS** — not installed | run without it, or `command -v timeout \|\| gtimeout` |
| `stat -c %s f` | **macOS/BSD** | `stat -f %z f` on BSD; `wc -c < f` works everywhere |
| `sed -i 's/a/b/' f` | **macOS/BSD** — needs an arg | `sed -i '' 's/a/b/' f` on BSD; or write to a temp and `mv` |
| `grep -P '\d'` | **macOS/BSD** — no PCRE | `grep -E '[0-9]'` |
| `readlink -f` | older BSD | `cd "$(dirname "$f")" && pwd -P` |
| `rg` | **any OS** — ripgrep is not preinstalled | `grep -rn` |
| `date -d` | **macOS/BSD** | `date -j` on BSD, or do date math in the language |
| `find -printf` | **macOS/BSD** | `find ... -exec stat ...` or `-print0 \| xargs` |
| `TMPDIR=x mktemp` | **macOS** — mktemp ignores TMPDIR entirely | pass a template path, or use the runtime's tempdir |
| `/tmp/foo` hardcoded | **Windows** — no /tmp | bare `mktemp` / `mktemp -d`, or `os.tmpdir()` |
| `grep -c` under `set -e` | **any OS** — exits 1 on zero matches | `grep -c x f \|\| echo 0` |
| `for x in $VAR` | **macOS/zsh** — no word splitting, loops once | list items literally, or `for x in "${ARR[@]}"` |
| `execFileSync('npm', …)` | **Windows** — ENOENT bare (no PATHEXT), EINVAL on `.cmd` since Node 18.20.2 | `execSync` with one literal command string |

## Measured, not assumed

The `TMPDIR` row above surprised us, so here is the evidence. On macOS the
subprocess receives the variable and every runtime honours it — but `mktemp`
does not:

```bash
$ env TMPDIR=/tmp/probe sh -c 'echo $TMPDIR'
/tmp/probe                                     # the process sees it
$ env TMPDIR=/tmp/probe sh -c 'mktemp'
/var/folders/90/.../T/tmp.AlQWd6r4T9           # mktemp ignores it
$ env TMPDIR=/tmp/probe node -e 'console.log(require("os").tmpdir())'
/tmp/probe                                     # Node honours it
$ env TMPDIR=/tmp/probe python3 -c 'import tempfile;print(tempfile.gettempdir())'
/tmp/probe                                     # Python honours it
```

The practical consequence: a test harness that sets `TMPDIR` to isolate itself
will isolate its Node and Python code but **not** its shell `mktemp` calls. If
isolation matters, pass an explicit template path to `mktemp` rather than
setting the variable and trusting it.

`grep -c` is the other one worth internalising: it prints `0` and exits `1` when
nothing matches. Under `set -e`, a "count the failures" line kills the script on
the outcome you were hoping for.

### The one that cost us a release

`zsh` does not word-split an unquoted parameter expansion. `bash` does. macOS
has defaulted to zsh since Catalina, so the same loop does two different things:

```bash
$ zsh  -c 'V="a b c"; for d in $V; do echo "[$d]"; done'
[a b c]                      # one iteration
$ bash -c 'V="a b c"; for d in $V; do echo "[$d]"; done'
[a] [b] [c]                  # three iterations
```

The failure is quiet. A cleanup loop written this way runs once against a
nonsense path, every command inside it succeeds, and the script reports done
having removed nothing. Write the list literally, or use a real array.

## Before running a tool that may be absent

```bash
command -v rg >/dev/null 2>&1 || echo "ripgrep not installed — using grep"
```

Prefer a single command that works everywhere over a clever one that works on
yours. `grep -rn "pattern" .` is slower than `rg pattern` and it runs on every
machine on earth.

## Windows

Windows users on PowerShell have neither `grep`, `sed`, nor `find` in the Unix
sense. When a task can be done by the language runtime instead of the shell,
**do it in the runtime** — `node -e`, `python -c` — which behaves identically on
all three platforms.

```bash
# Fragile: three different behaviours on three platforms
find . -name "*.js" -newermt "1 day ago"

# Portable: one behaviour everywhere Node runs
node -e "…"
```

## Paths

- Never hardcode `/` as a separator in code — use the language's path join.
- Never assume `$HOME` exists in a spawned process; on Windows it is `%USERPROFILE%`.
- Quote every path variable: `"$file"`, not `$file`. Spaces in paths are normal
  on macOS and Windows.

## When the user reports "works on my machine"

This table is the first thing to check, before deeper debugging. A surprising
share of "the command did nothing" reports are a BSD/GNU flag difference, and
`env-debugger` should reach for this rule immediately.

## Checklist before suggesting a shell command

- [ ] Does the binary exist on macOS, Linux, and Windows by default?
- [ ] Are the flags the same across BSD and GNU?
- [ ] Are all paths quoted?
- [ ] Could the language runtime do this identically on all three instead?
