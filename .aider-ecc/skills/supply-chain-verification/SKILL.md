---
name: supply-chain-verification
description: Generate CycloneDX SBOMs, content manifests, and verify installed copies of kodelyth-ecc against shipped manifests. Use when an enterprise / security team asks "where does this code come from, is it tampered, and where is the SBOM".
trigger:
  - supply chain
  - SBOM
  - CycloneDX
  - SLSA
  - provenance
  - manifest
  - tamper
  - integrity check
  - verify install
---

# Skill: supply-chain-verification

## What this skill does

Phase 2.9 of the Devil Roadmap. Three pure-function libraries plus three CLI subcommands give every kodelyth-ecc release **enterprise-grade supply-chain credentials**:

| Capability | What it produces | Format |
|---|---|---|
| **SBOM** | CycloneDX 1.5 software bill of materials for the package + every transitive dep in the lockfile | JSON |
| **Manifest** | sha256 content manifest of every shipped asset (agents, skills, commands, rules, hooks, scripts, bin, bundles, root files) | JSON |
| **Verify** | Compares an installed copy against a manifest and reports `ok` / `modified` / `missing` / `extra` | JSON or pretty |

Plus, every release published via `.github/workflows/publish.yml` ships with **SLSA Level 3 build provenance** courtesy of `npm publish --provenance` (sigstore-backed).

---

## When to use this skill

Use **explicitly** by name when:

- An enterprise / SOC 2 / FedRAMP-adjacent team asks for an SBOM to ingest into Dependency-Track, Snyk, or Anchore.
- A user reports a suspicious install — verify against the shipped manifest to confirm tamper or local mod.
- You're preparing an audit response and need provenance + bill-of-materials in one shot.
- You want to ship a third-party reproducibility check for a downstream consumer.

```bash
use supply-chain-verification

# Generate a CycloneDX 1.5 SBOM
npx kodelyth-ecc sbom --out sbom.cdx.json

# Generate a content manifest
npx kodelyth-ecc manifest --out manifest.json

# Verify a downloaded / installed copy
npx kodelyth-ecc verify --manifest manifest.json
```

Implicit triggers (the AI should route here automatically):

- "is my install of kodelyth-ecc tampered?"
- "give me an SBOM"
- "where is the SLSA provenance for this release?"
- "compliance team needs supply-chain attestation for this package"

---

## CLI surface

### `kodelyth-ecc sbom`

```
kodelyth-ecc sbom [--root DIR] [--out FILE] [--json]
```

Produces a CycloneDX 1.5 BOM:

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "serialNumber": "urn:uuid:...",
  "metadata": {
    "timestamp": "2026-05-10T17:00:00Z",
    "tools": [{ "vendor": "kodelyth-ecc", "name": "kodelyth-ecc-sbom", "version": "1.7.0" }],
    "component": { "type": "application", "name": "kodelyth-ecc", "version": "1.7.0", "purl": "pkg:npm/kodelyth-ecc@1.7.0" }
  },
  "components": [/* one per lockfile entry */],
  "dependencies": [{ "ref": "kodelyth-ecc@1.7.0", "dependsOn": [/* direct deps */] }]
}
```

Pure: no network, no exec. Reads `package.json` + `package-lock.json` only. Components carry purl, license, and SHA-512 hash from npm SRI when present.

### `kodelyth-ecc manifest`

```
kodelyth-ecc manifest [--root DIR] [--out FILE] [--json]
```

Walks every shipped directory + root file. Produces:

```json
{
  "schema": "kodelyth.content-manifest/v1",
  "package": "kodelyth-ecc",
  "pkg_version": "1.7.0",
  "generated_at": "2026-05-10T17:00:00Z",
  "file_count": 730,
  "digest": "<sha256 over deterministic JSON of the entries array>",
  "files": [
    { "path": "agents/code-reviewer.md", "size": 4521, "sha256": "…" },
    …
  ]
}
```

Output is deterministic (sorted by path, stable sha256), so two runs against the same source tree produce identical files modulo `generated_at`.

### `kodelyth-ecc verify`

```
kodelyth-ecc verify [--root DIR] [--manifest FILE] [--json]
```

Compares disk against manifest:

| Category | Meaning | Fails verify? |
|---|---|---|
| `ok` | sha256 matches | No |
| `modified` | file present, hash differs | **Yes** |
| `missing` | file in manifest but not on disk | **Yes** |
| `extra` | file on disk not in manifest | No (advisory) |

Exits **0** if `ok=true`, **1** otherwise. Pair with `--json` for CI gates.

---

## What ships with each release

The `.github/workflows/publish.yml` pipeline does **all five** of:

1. Verify `package.json.version` matches the release tag.
2. Run the full test suite (255 tests).
3. `npm publish --provenance` → **SLSA Level 3** build provenance via npm + sigstore.
4. Generate `kodelyth-ecc-sbom.cdx.json` and attach to the GitHub release.
5. Generate `kodelyth-ecc-manifest.json` and attach to the GitHub release.

Three artifacts ship with every release:

```
v1.X.Y/
├── kodelyth-ecc-sbom.cdx.json    ← CycloneDX 1.5
├── kodelyth-ecc-manifest.json    ← sha256 content manifest
└── (npm sigstore provenance)     ← visible on npmjs.com
```

---

## Programmatic API

```js
const { generateSBOM }       = require('kodelyth-ecc/scripts/supply-chain/sbom.js');
const { generateManifest }   = require('kodelyth-ecc/scripts/supply-chain/manifest.js');
const { verifyAgainstManifest } = require('kodelyth-ecc/scripts/supply-chain/verify.js');

const bom = generateSBOM({ rootDir: '/path/to/installed/kodelyth-ecc' });
const m   = generateManifest({ rootDir: '/path/to/installed/kodelyth-ecc' });
const r   = verifyAgainstManifest({ rootDir: '/path/to/installed/kodelyth-ecc', manifest: m });

if (!r.ok) {
  console.error('Tamper detected:', r.summary);
  process.exit(1);
}
```

All three are pure functions. Safe to call from a CI step, an MCP tool, or any external automation.

---

## Hard rules

1. **Never** weaken `verify`. Modified or missing files MUST exit non-zero. Extras stay advisory.
2. SBOM `serialNumber` is derived deterministically from `name@version + timestamp`. If you need a true random UUID per build, set `timestamp` to the build timestamp.
3. Manifest `digest` is the sha256 of the deterministic JSON of `files`. Reproducible across runs at the same source state.
4. Don't include `node_modules/`, `.git/`, `.DS_Store`, `__pycache__/`, or `*.pyc` in the manifest. The skip list is in `scripts/supply-chain/manifest.js`.
5. Treat the published manifest as authoritative for tamper detection of an installed copy. Don't substitute a freshly-generated one.

---

## Pairing with other ECC features

| Pair with | What you get |
|---|---|
| **Phase 2.10 safety hooks** | The token-budget hook + this skill cover "trust" (no PII leakage + no tampered code). |
| **MCP server (Phase 2.1)** | Expose `verify` as an MCP tool downstream agents can call to confirm their toolkit is clean. |
| **Swarm orchestrator (Phase 2.7)** | Run `verify` as a pre-flight check before spawning N parallel workers. |
| **Replay (Phase 2.8)** | Bundles can carry the manifest of the source ECC version that produced them, enabling reproducible replays. |

---

## See also

- `commands/verify-supply-chain.md` — `/verify-supply-chain` slash command form
- `docs/supply-chain.md` — full reference + downstream verification guide
- `.github/workflows/publish.yml` — release pipeline that issues all three artifacts
