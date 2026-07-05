---
title: "Supply Chain Verification — SBOM, Manifest, SLSA L3 Provenance"
description: "CycloneDX 1.5 SBOM, sha256 content manifest, SLSA L3 provenance verification for Kodelyth ECC. Verify your installed toolkit hasn't been tampered with."
keywords:
  - SBOM
  - CycloneDX
  - SLSA L3
  - supply chain security
  - AI toolkit verify
  - manifest verify
  - sha256 verification
og_title: "Supply Chain Verification — SBOM, Manifest, SLSA L3 Provenance"
og_description: "CycloneDX 1.5 SBOM, sha256 content manifest, SLSA L3 provenance verification for Kodelyth ECC. Verify your installed toolkit hasn't been tampered with."
og_image: /social/hype-devil-mode.svg
og_type: article
twitter_card: summary_large_image
canonical: /docs/supply-chain/
last_updated: 2026-07-04
version: 2.4.1
category: feature
---
# Supply chain — SBOM, manifest, SLSA provenance

> Phase 2.9 of the Devil Roadmap. Every kodelyth-ecc release ships with three independent supply-chain artifacts so any consumer (audit team, downstream agent, security tool) can answer "where does this code come from, can I trust it, and has it been tampered" without trusting kodelyth-ecc.

---

## What ships with every release

| Artifact | Format | Where to find it | Issued by |
|---|---|---|---|
| **SLSA build provenance** | sigstore-signed npm provenance | npmjs.com/package/kodelyth-ecc → "Provenance" tab | npm + GitHub OIDC (`npm publish --provenance`) |
| **CycloneDX SBOM** | CycloneDX 1.5 JSON | GitHub release page → `kodelyth-ecc-sbom.cdx.json` | `kodelyth-ecc sbom` |
| **Content manifest** | sha256 manifest JSON | GitHub release page → `kodelyth-ecc-manifest.json` | `kodelyth-ecc manifest` |

All three are emitted by `.github/workflows/publish.yml` on every tagged release.

---

## CLI

### `kodelyth-ecc sbom`

```
kodelyth-ecc sbom [--root DIR] [--out FILE] [--json]
```

Generates a CycloneDX 1.5 software bill of materials.

| Field | Source | Notes |
|---|---|---|
| `metadata.component` | `package.json` | The kodelyth-ecc package itself |
| `components[]` | `package-lock.json` v3 | One entry per locked dependency, including dev + transitive |
| `purl` | `pkg:npm/<name>@<version>` | scoped packages keep the leading `@` |
| `licenses` | lockfile `license` | normalized to CycloneDX shape |
| `hashes` | npm SRI (`integrity`) | base64 → hex, algo mapped to `SHA-256/384/512` |
| `dependencies[]` | root entry's `dependencies` + `optionalDependencies` | Direct edges only |
| `serialNumber` | `urn:uuid:<sha256("name@version|timestamp")>` | Stable for same inputs |

**Pure function. No network. No exec.**

### `kodelyth-ecc manifest`

```
kodelyth-ecc manifest [--root DIR] [--out FILE] [--json]
```

Generates a sha256 content manifest of every shipped asset.

```json
{
  "schema": "kodelyth.content-manifest/v1",
  "package": "kodelyth-ecc",
  "pkg_version": "1.7.0",
  "generated_at": "2026-05-10T17:00:00Z",
  "file_count": 730,
  "digest": "20813125…",
  "files": [
    { "path": "agents/code-reviewer.md", "size": 4521, "sha256": "…" }
  ]
}
```

Walks: `agents/`, `skills/`, `commands/`, `rules/`, `hooks/`, `scripts/`, `bin/`, `parallel-commands/`, `bundles/`, plus root files (`package.json`, `README.md`, `CHANGELOG.md`, `VERSION`, `install.sh`, `install.ps1`).

Skips: `node_modules/`, `.git/`, `.DS_Store`, `__pycache__/`, `*.pyc`.

The top-level `digest` is the sha256 over the deterministic JSON of `files[]`. Two runs against the same source state produce the same digest.

### `kodelyth-ecc verify`

```
kodelyth-ecc verify [--root DIR] [--manifest FILE] [--json]
```

Compares disk against the manifest:

| Category | Means | Fails verify? |
|---|---|---|
| `ok` | sha256 matches | No |
| `modified` | hash differs | **Yes** |
| `missing` | not on disk | **Yes** |
| `extra` | on disk but not in manifest | No (advisory) |

Exits `0` on `ok=true`, `1` otherwise. With `--json`, prints the full report:

```json
{
  "ok": false,
  "summary": { "total_in_manifest": 730, "ok": 729, "modified": 1, "missing": 0, "extra": 0 },
  "details": {
    "ok": ["agents/api-guardian.md", …],
    "modified": [{ "path": "agents/code-reviewer.md", "expected_sha256": "…", "actual_sha256": "…" }],
    "missing": [],
    "extra": []
  }
}
```

---

## Verifying a downstream install

```bash
# 1) Download the manifest from the GitHub release that matches your installed version.
gh release download v1.7.3 -p kodelyth-ecc-manifest.json -O /tmp/manifest.json

# 2) Run verify against your installed copy.
npx kodelyth-ecc verify --root "$(npm root -g)/kodelyth-ecc" --manifest /tmp/manifest.json
```

Or, if you cloned the repo:

```bash
cd ~/path/to/kodelyth-ecc
node bin/kodelyth-ecc.js verify --manifest /tmp/manifest.json
```

A successful run looks like:

```
Kodelyth ECC supply-chain verify
  package:           kodelyth-ecc@1.7.0
  manifest digest:   20813125baad127bb578e4cbad6b72e2c4721d71cd236b6c039e7c155cd322ef
  files in manifest: 730
    ✓ ok:       730
    ✗ modified: 0
    ✗ missing:  0
    ⚠ extra:    0 (advisory)

✓ verify OK
```

---

## SLSA provenance

`.github/workflows/publish.yml` runs `npm publish --provenance --access public`. This requires `id-token: write` (set on the job) and uses GitHub's OIDC token to sign a sigstore-backed provenance statement that:

1. Pins the workflow file SHA + commit SHA that produced the build.
2. Pins the GitHub repo + ref.
3. Pins the npm package name + version.

Result: **SLSA Level 3** by npm's published criteria (hosted build platform, signed provenance, verifiable from npm registry metadata).

To verify a downloaded tarball matches the npm-published provenance:

```bash
npm audit signatures kodelyth-ecc
# or
npm view kodelyth-ecc --json | jq .dist.signatures
```

---

## Programmatic API

```js
const { generateSBOM }          = require('kodelyth-ecc/scripts/supply-chain/sbom.js');
const { generateManifest }      = require('kodelyth-ecc/scripts/supply-chain/manifest.js');
const { verifyAgainstManifest } = require('kodelyth-ecc/scripts/supply-chain/verify.js');

const bom      = generateSBOM({ rootDir });
const manifest = generateManifest({ rootDir });
const report   = verifyAgainstManifest({ rootDir, manifest });
```

All three are pure functions. Safe to call from a CI step, an MCP tool, or any external automation. They never spawn subprocesses, never make network calls, and never write to disk.

---

## When to call which surface

| Situation | Use |
|---|---|
| Compliance team wants an SBOM for Dependency-Track / Snyk ingestion | `sbom --out` |
| Need to ship a tamper-detection seal with a release artifact | `manifest --out` |
| Validating a downstream install hasn't been edited | `verify` |
| CI gate that should fail on tamper | `verify --json` + script that checks `.ok` |
| Reproducibility check between two release archives | `manifest` on both, diff `digest` |

---

## Composition with other phases

| Pair | Effect |
|---|---|
| **2.7 swarm + verify** | Run `verify` as a pre-flight before spawning workers. Refuse to spawn from a tampered toolkit. |
| **2.8 replay + manifest** | Embed the manifest digest of the producing toolkit into a session bundle. Replays then verify they're being run by the same toolkit version. |
| **2.10 safety hooks + verify** | The token-budget hook can read the manifest digest at session start to surface a "you're running tampered tooling" warning. |
| **2.1 MCP server + verify** | Expose `verify` as an MCP tool. Downstream agents can call it before trusting any other ECC tool's output. |

---

## Hard rules

1. Treat the manifest published with a release as authoritative. **Do not** regenerate locally and pretend it's the same.
2. **Do not** suppress a non-zero exit from `verify` in CI. Modified or missing files mean a tamper or a partial install — both are blocking.
3. **Do not** include `node_modules/` or `.git/` in the manifest. The skip list is in `scripts/supply-chain/manifest.js`; extend deliberately if needed.
4. **Do not** store secrets in any file under the shipped directory list. Anything that's manifested gets its sha256 published.

---

## See also

- `skills/supply-chain-verification/SKILL.md` — explicit-invocation skill
- `commands/verify-supply-chain.md` — `/verify-supply-chain` slash command
- `.github/workflows/publish.yml` — release pipeline (npm provenance + SBOM + manifest upload)
