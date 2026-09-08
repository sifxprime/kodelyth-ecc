---
description: Scan any codebase for the bug classes the arena has actually confirmed — executable detectors, each pinned to the commit that proves it.
argument-hint: "[path]"
---

# /immune — the arena's findings, made executable

The arena finds bugs one repository at a time and remembers them as prose. Prose
does not scan a codebase. `/immune` turns each **confirmed** class into a
detector that runs, so a bug proven here can be found anywhere — including in
repositories that never ran the arena.

```bash
kodelythecc immune              # scan the current directory
kodelythecc immune scripts/     # scan a subtree
kodelythecc immune --json       # machine-readable
kodelythecc immune --tests      # include test files (normally skipped)
```

Exits non-zero when anything **high** is found, so it drops straight into CI.

## What it looks for

Every detector below encodes a class that was reproduced with a real repro
during an arena run. Nothing here is hypothetical.

| Detector | Confirmed | What it catches |
|---|---|---|
| `lexical-containment` | 5× | `startsWith(root)` with no `realpath` — a symlink inside the root passes while pointing anywhere on disk |
| `prototype-key-map` | 1× | `map['constructor']` is truthy, so `if (!map[k])` never fires |
| `truncate-then-write` | 3× | `writeFileSync` on durable state truncates to zero before writing |
| `predictable-temp-name` | 1× | a pid-derived temp path can be pre-planted with a symlink |

## How each detector earns its place

A detector ships only if it does **both**:

1. **FIRES** on the exact source the arena found the bug in
2. Goes **SILENT** on the source after the fix

Both halves matter. A detector that misses the real bug is decoration; one that
still fires after the fix is a false positive. The fixtures in
`tests/immune/detectors.test.js` are real code quoted from this repository at
v2.7.0 — the last release before any arena fix landed.

## Two classes were deliberately NOT shipped

This matters more than the four that were.

**ReDoS.** The class is real: an unbounded quantifier cost 7.6 s on 293 KB. But
arena run #1 *measured* five structurally identical regexes in one file — the
fenced-code, inline-code, bare-URL and file-path patterns were all linear, and
only the link-target pattern was quadratic. The difference is whether the
closing delimiter is commonly absent in real input: a property of the data, not
the pattern, and invisible to a scanner. A detector would have flagged all five
and been wrong about four.

**Unbounded input.** Also real — 4.9 MB allocated ~417 MB and OOMed under a
256 MB heap. But the detectable shape is "this module reads a file", which
described 57 of 165 files here. The actual bug is reading *untrusted* input
without a cap, and a scanner cannot tell which reads are untrusted.

Both stay where they were actually caught: measurement under `/arena`, and human
review under `security-reviewer`.

> A scanner that is wrong four times out of five gets muted, and a muted scanner
> protects nothing. Precision over recall, deliberately.

## What a clean result means

```
Clean. 165 files scanned, none matched a known class.
```

That is **not** proof of correctness. It means none of the specific classes the
arena has confirmed are present. New classes are found by running `/arena`, and
each new confirmation is a candidate for a new detector.

## The loop this closes

```
/arena  ──▶  confirmed findings  ──▶  memories  ──▶  detectors  ──▶  /immune
   ▲                                                                     │
   └──────────────  new classes found in new code  ◀────────────────────┘
```

`/arena` is expensive and thorough — agents, rounds, real repros. `/immune` is
instant and narrow. Use the arena to *discover* a class; use immune to make sure
it never comes back, anywhere.
