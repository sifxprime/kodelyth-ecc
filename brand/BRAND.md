# Kodelyth & Veltix — Brand Reference

Single source of truth for the marks, colors, and type. Read this before making any
Kodelyth/Veltix graphic so the logos and palette are always correct.

---

## The marks

### CANONICAL SOURCE — always use this, no exceptions
The one true Kodelyth mark lives at:

    /Users/shofiqulislam/github-repo/kodelyth-ecc/brand/kodelyth-mark.svg

**Every** Kodelyth mark — cards, letterhead, posters, favicons, app icons, social —
MUST use this exact geometry. Do not hand-approximate it, do not eyeball proportions,
do not use a "close enough" chevron. When placing it at a new size, scale the exact
polylines below; never redraw them.

> KNOWN INCONSISTENCY (fix when touched): `kodelyth-light.svg` / `kodelyth-dark.svg`
> (the wordmark lockups) currently carry a **flatter, wider** chevron
> (solid arm vector `-31,-25`) that does NOT match the canonical mark
> (arm vector `-88,-100`, tall/pointed). The cards were corrected to canonical.
> The lockups and anything derived from them still need regenerating to canonical.

Both marks are a single chevron drawn as a `polyline` with a **ghost echo** behind
it (a lighter, thinner offset copy that creates depth). The ghost is part of the
logo — **never draw the chevron alone**. The ghost is a THIN trail (stroke ratio
solid:ghost = 32:10 ≈ 3.2:1) — it must read as a faint echo, not a second full
chevron. Rounded caps + joins always.

### Kodelyth mark — forward chevron `»`
A chevron pointing **right**, with the ghost echo to its **left**. Reads as `»` / `>>`.
Geometry on a `0 0 400 400` viewBox:
- solid: `polyline points="172,100 260,200 172,300"` stroke-width `32`
- ghost: `polyline points="128,104 184,200 128,296"` stroke-width `10` stroke-opacity `0.15`

Apex-relative form (apex at 0,0, opening right) for scaling into any layout —
`transform="translate(apexX, apexY) scale(s)"`:
- solid: `polyline points="-88,-100 0,0 -88,100"` stroke-width `32`
- ghost: `polyline points="-132,-96 -76,0 -132,96"` stroke-width `10`
- ghost opacity: `0.15` on light grounds; **`0.30–0.34` on dark grounds** so the `»` still reads.

### Veltix mark — "Descent V"
The Kodelyth chevron **rotated to point down**, with the ghost trail **above**.
Geometry on a `0 0 400 400` viewBox:
- solid: `polyline points="100,200 200,288 300,200"` stroke-width `32`
- ghost: `polyline points="104,156 200,212 296,156"` stroke-width `10` stroke-opacity `0.15`

Stroke color: `#ffffff` on dark grounds, `#0f172a` on light grounds. (Accent emerald is
allowed for the Veltix mark when it is the product hero — see palette.)

---

## Palette

| Role | Hex | Notes |
|------|-----|-------|
| Ground (dark) | `#0a0a0a` | primary background for all brand graphics |
| Ink (light bg) | `#0f172a` | slate, marks/text on white |
| Off-white text | `#F4F6F5` | body/headline on dark |
| Muted text | `#8A9691` / `#64748B` | secondary/labels |
| Emerald — primary | `#059669` | site primary |
| Emerald — light | `#10B981` | fills, accents |
| Emerald — bright | `#34D399` | the accent moment (eyebrows, one word, rules) |
| Emerald — dark | `#047857` | gradient stop |
| Emerald — pale | `#6EE7B7` | gradient highlight |
| Hero gradient | `#10B981 → #2563EB` | emerald→blue, use sparingly |

**Combination rule:** dark ground + off-white type + **one** emerald accent moment.
Do not scatter emerald everywhere or stack multiple glows. Boldness goes in one place;
keep everything else quiet. When both marks appear together, Kodelyth mark = white
(the company), Veltix mark = emerald `#34D399` (the product) — this differentiates them
and is the sanctioned splash of color.

---

## Type

- Family: `'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif`
- Wordmark: weight **700**, letter-spacing **3–8** (bigger mark = wider spacing)
- Sub/tagline: weight **400**, opacity ~`0.55`, letter-spacing **5**
- Wordmarks: `KODELYTH`, `VELTIX`
- Product line: `VELTIX V1` (standard), `VELTIX V1 PRO` (flagship)
- Taglines: `by Kodelyth` · `Built to build everything.`

---

## Company facts (for copy — never invent beyond these)

**Business type:** AI Research, Infrastructure & Engineering Company.
Descriptor line (letterhead / sub-brand): `AI Research · AI Infrastructure · Software Engineering`.

**Official description (canonical — use this wording; do not spin new claims from it):**
> Kodelyth is an artificial intelligence research and engineering company building intelligent models, developer platforms, AI infrastructure, and production-ready software that help developers and businesses build everything.

**Brand & legal entities:**
- **Brand: Kodelyth** — everywhere (web, social, cards, marketing); no legal suffix.
- **United States: Kodelyth LLC** — the registered US company (Denver, CO). Global/US contracts, payments, clients.
- **Bangladesh: Kodelyth Limited** — *planned* RJSC private-limited company. **Do NOT put "Kodelyth Limited" on any document until it is actually registered with RJSC** — using "Limited" before incorporation is misrepresentation. Until then, the Bangladesh side is the current **Trade License / DBID** (proprietorship trading as "Kodelyth").
- Suffixes (`LLC` / `Ltd.`) appear only on legal documents, invoices, contracts, and registration papers — never in marketing.

- Founder & CEO: **Shofiqul Islam**.
- Tagline: **Build Everything.**
- Products: the Veltix AI models — **Veltix V1** and **Veltix V1 Pro**.
- Website: **kodelyth.com**

**Registration identifiers (for legal footers only):**
- US — Kodelyth LLC · 1500 N Grant St Ste N, Denver, CO 80203 · Filing No `20251658053` · EIN `<pending>`
- Bangladesh — office 57/5 East Kazipara, Mirpur, Dhaka 1216 · DBID `227372954` · TL `2026694181001621` · TIN/BIN `<pending>`
- Registered — Nazirpur Hat, Gurudaspur, Natore, Rajshahi 6440 · Cloud: Helsinki, Finland
- After RJSC incorporation, add: Kodelyth Limited · RJSC Reg No `<pending>`

---

## Asset inventory (this folder)

- `kodelyth-mark.svg` · `kodelyth-light.svg` · `kodelyth-dark.svg` — Kodelyth mark + lockups
- `veltix-mark.svg` · `veltix-icon.svg` · `veltix-light.svg` · `veltix-dark.svg` — Veltix mark + lockups
- `veltix-og.svg` · `veltix-fb-cover.svg` · `veltix-fb-profile.svg` — Veltix social cards
- `*-8k.png`, `*-512.png`, etc. — rasterized masters
- `veltix-convert.js` — headless-Chrome rasterizer (SVG → PNG incl. 8K). `rsvg-convert` also available for quick renders.

## Rasterizing to PNG
- Quick: `rsvg-convert -w <W> -h <H> in.svg -o out.png`
- 8K masters / font-accurate: `node veltix-convert.js` (puppeteer-core, uses installed Chrome)
