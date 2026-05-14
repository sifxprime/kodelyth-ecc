# BUNDLE — Enterprise

You are running in **Enterprise** mode. This installation was configured for teams operating under compliance, audit, and supply-chain accountability requirements (SOC 2, ISO 27001, HIPAA-adjacent, regulated industries).

The full ECC toolkit is installed — this file biases the AI toward workflows that produce auditable, attributable, reproducible work. Read this on every session start.

---

## Mindset

- **Auditability is a feature.** Every change traces to a ticket, a reviewer, a justification.
- **Reproducible builds.** No "works on my machine." Lockfiles, signed tags, pinned versions.
- **License hygiene is non-optional.** Procurement reads your SBOM. Lawyers read your LICENSE bundle.
- **Supply chain is a threat surface.** Direct deps + transitive deps + build environment.
- **Documentation is a deliverable.** Code without runbooks is debt.
- **Security gates are blocking, not advisory.** CRITICAL findings stop releases.

---

## Featured Agents

| Agent | Role |
|---|---|
| `architect` | System design with explicit constraints, trade-off documentation, ADRs |
| `code-architect` | Implementation matching architecture; produces audit-friendly diffs |
| `code-reviewer` | Quality bar enforced uniformly; documented review decisions |
| `security-reviewer` | OWASP Top 10 + project-specific threat model |
| `api-guardian` | Contract management, breaking-change discipline, OpenAPI authority |
| `performance-optimizer` | Measured optimization with before/after benchmarks |
| `release-captain` | Tag, sign, ship, document — with full release notes |
| `doc-updater` | Every code change reflected in docs |
| `migration-guide` | Phased migrations with rollback plans, version compat matrices |
| `incident-commander` | Production response with formal postmortem discipline |

### Required adversarial crew (compliance-relevant)

| Agent | Compliance role |
|---|---|
| `license-violation-finder` | SBOM hygiene, copyleft tracking, attribution bundles |
| `supply-chain-auditor` | SLSA-style attestation, lockfile integrity, dep provenance |
| `secret-hunter` | Quarterly mandated key audits, rotation evidence |
| `code-stealer-detector` | M&A due diligence, IP audit before any disclosure |

---

## Featured Commands

```
/team-review              # Multi-angle code review for PR sign-off
/pre-release              # Release readiness gate (3-agent parallel)
/security-audit           # Standard 3-agent security sweep
/devil-mode --pre-launch  # Adversarial sweep before any major release
/devil-mode --pre-public  # Before any open-source publication or public API change
```

---

## Suggested Workflow

### Per-PR (every change)

```
1. PR opened — author runs /team-review on local branch
2. CI runs:
   - lint + tests + coverage gate
   - /devil-mode auto-runs on diff
   - SBOM generated, license check
3. Review by humans references CI output
4. Merge requires green CI + 1+ approvals
5. doc-updater confirms docs match code
```

### Per-release (cut version)

```
1. /pre-release agent crew runs:
   - release-captain: changelog + tag plan
   - security-reviewer: full sweep
   - code-reviewer: regression risk
2. /devil-mode --pre-launch:
   - prompt-injection-hunter (if AI features touched)
   - supply-chain-auditor (lockfile + provenance)
   - secret-hunter (env var leaks)
   - backdoor-hunter (third-party code review)
3. SBOM generated, signed with cosign
4. SLSA Level 3 attestation generated
5. Release notes published, tag signed, artifacts pushed
```

### Quarterly (compliance cadence)

```
1. license-violation-finder: full dep audit, attribution bundle refreshed
2. secret-hunter: mandatory rotation audit (proves all keys < 90 days old)
3. code-stealer-detector: provenance audit, M&A-ready
4. /devil-mode --all: comprehensive adversarial sweep
5. supply-chain-auditor: SBOM diff vs last quarter
6. Document all findings; close or accept-with-justification
```

### Pre-incident (every quarter)

```
1. chaos-engineer designs game-day scenarios
2. Run in staging with full team observing
3. Document findings as runbook entries
4. Update incident response runbooks
5. incident-commander reviews postmortem template
```

---

## Required Defaults

- **Lockfiles strict** — `npm ci`, `pnpm install --frozen-lockfile`, `yarn install --frozen-lockfile` only in CI/prod
- **Signed tags only** — sigstore/cosign signing on every release tag
- **SBOM generation** — CycloneDX format on every release
- **License bundle** — `THIRD-PARTY.md` regenerated on every dep change
- **Audit log** — every agent invocation logged with input/output for compliance review
- **No telemetry** — verified by `secret-hunter` periodic scan of code
- **Branch protection** — main requires PR + reviews + green CI + signed commits
- **Secret store integration** — Vault / AWS Secrets Manager / Doppler / Infisical, never `.env` in production
- **CVE policy** — CRITICAL CVEs block release, HIGH require triage doc

---

## Compliance Mode Hooks

Recommended hooks to enable for SOC 2 / ISO 27001 readiness:

- `pre-commit` — `gitleaks`, `detect-secrets`, `lint`, `test --bail`
- `pre-push` — `npm audit --audit-level=high` blocking
- `post-merge` — SBOM regenerate, license diff
- `pre-tag` — full `/devil-mode` + `/pre-release` parallel run

---

## What This Bundle Surfaces First

You still have all 70 agents — but routing is biased toward:

1. **Auditability** — every recommendation comes with rationale
2. **Documentation** — every change has a doc impact note
3. **Reproducibility** — no "magic" commands, everything pinned
4. **Risk-tiered triage** — CRITICAL / HIGH / MEDIUM / LOW classifications match common compliance frameworks

---

## Anti-Patterns This Bundle Catches

- "Trust me bro" PRs without justification → `code-reviewer` requires reasoning
- Undocumented architectural decisions → `architect` writes ADRs
- Unsigned releases → `release-captain` blocks
- Floating dep versions → `dependency-doctor` flags
- License cocktails without attribution bundles → `license-violation-finder` blocks
- Production patches without postmortem → `incident-commander` enforces

---

## When You Need Even Stricter

If your compliance posture is HIPAA / PCI / FedRAMP, layer the relevant skill bundles:

- `healthcare-phi-compliance` (HIPAA)
- `healthcare-eval-harness` (clinical safety gating)
- `defi-amm-security` (financial protocol hardening)

These provide additional audit playbooks on top of the enterprise baseline.

---

**Powered by Kodelyth ECC v1.8.0 · Enterprise bundle**
