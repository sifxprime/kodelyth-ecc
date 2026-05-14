---
description: Generate / verify SBOM, content manifest, and SLSA provenance for kodelyth-ecc. Use for compliance, audit, or tamper checks.
---

# /verify-supply-chain

Run the supply-chain verification surface in one shot.

## Usage

```
/verify-supply-chain                    # quick: verify current install against shipped manifest
/verify-supply-chain --emit              # generate SBOM + manifest in cwd
/verify-supply-chain --root /path/to/ecc --manifest /path/to/manifest.json
```

## Behavior

1. If a manifest is provided (or the default `manifest.json` exists in `--root`), runs `verify` against it. Reports modified, missing, and extra files. Exits **non-zero** on any tamper.
2. If `--emit` is set, generates fresh `kodelyth-ecc-sbom.cdx.json` and `kodelyth-ecc-manifest.json` in the current directory.
3. If neither, prints a quick summary of what's available and what to do next.

## Flags

| Flag | Effect |
|---|---|
| `--root DIR` | Treat DIR as the kodelyth-ecc install root (default: package root). |
| `--manifest FILE` | Path to a manifest to verify against (default: `<root>/manifest.json`). |
| `--emit` | Generate fresh `sbom.cdx.json` + `manifest.json` in cwd. |
| `--json` | Machine-readable output (verify report or generated docs). |

## Use cases

- **Audit response.** Generate fresh SBOM + manifest for a SOC 2 / ISO 27001 review.
- **Tamper check.** Confirm that an installed copy hasn't been modified after install (matches the manifest shipped with the release).
- **Reproducibility check.** Compare the manifest of an arbitrary downloaded release archive against the one published on GitHub.
- **CI gate.** Pair with `--json` to fail a build when an installed dependency is tampered.

## Companion commands

- **`/security-audit`** — full red-team sweep using the devil-mode crew (focuses on app code).
- **`/devil-mode`** — adversarial review of recent changes.
- **`/release`** — release-captain handoff. Should always run `/verify-supply-chain --emit` before tagging.

## Hard rules

1. **Never** suppress a non-zero exit from `verify`. If a tamper is found, escalate.
2. **Don't** publish without the SBOM + manifest attached to the GitHub release. The publish workflow handles this automatically.
3. **Treat** the on-release manifest as authoritative — don't substitute a freshly-generated one when verifying a customer's install.

## Implementation

Backed by:

- `scripts/supply-chain/sbom.js` — CycloneDX 1.5 generator
- `scripts/supply-chain/manifest.js` — sha256 content manifest
- `scripts/supply-chain/verify.js` — pure-function verifier

CLI surface: `kodelyth-ecc sbom`, `kodelyth-ecc manifest`, `kodelyth-ecc verify`. See `docs/supply-chain.md` for the full reference.
