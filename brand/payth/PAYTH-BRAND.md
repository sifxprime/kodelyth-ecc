# Payth — Brand Reference

Payth is **Kodelyth's payment gateway** — a flagship product, sibling to the Veltix AI models.
This file is the single source of truth for the Payth mark, colors, and type. Read it before
making any Payth graphic so the logo is always correct.

> Payth is built on the **PipraPay** engine, self-hosted by Kodelyth. "PipraPay" is the upstream
> software; **Payth** is Kodelyth's product brand and the name shown to customers.

---

## This asset set lives in TWO places — keep them in sync

The exact same files exist in both folders. When you change one, copy to the other.

1. **Canonical brand home:** `/Users/shofiqulislam/github-repo/kodelyth-ecc/brand/payth/`
   (lives beside the Kodelyth + Veltix marks — this is the master)
2. **Product repo copy:** `/Users/shofiqulislam/piprapay/brand/`
   (shipped with the PipraPay/Payth app for favicons, app icons, etc.)

Sync command (canonical → product):
```bash
cp /Users/shofiqulislam/github-repo/kodelyth-ecc/brand/payth/*.{svg,png,ico} \
   /Users/shofiqulislam/piprapay/brand/
```

The parent Kodelyth/Veltix system is defined in `../BRAND.md` — Payth inherits its palette,
type, and the ghost-chevron logic from there. Read that file too.

---

## The mark — "Payment Loop"

Payth's mark is the **Kodelyth chevron system** turned into a payment symbol: two chevrons
whose apexes point **outward** from a shared center — a solid forward `>` (send / outgoing)
and a faint mirror `<` ghost (receive / incoming). Together they read as a **loop / exchange**
— money going out and coming back. The overlap leaves a small diamond of negative space in
the middle: the "transaction".

This keeps Payth unmistakably in the Kodelyth family (same chevron, same ghost-echo depth,
same rounded caps) while being its own thing (Kodelyth `»` points one way; Veltix points down;
Payth mirrors outward).

### CANONICAL SOURCE — always use this, no exceptions
    /Users/shofiqulislam/github-repo/kodelyth-ecc/brand/payth/payth-mark.svg

Every Payth mark MUST use this exact geometry. Do not hand-approximate, do not eyeball, do not
use a "close enough" chevron. When placing at a new size, scale the exact polylines below.

### Geometry — viewBox `0 0 400 400`
Two polylines, rounded caps + joins always. The solid is dominant; the ghost is a thin echo
(stroke ratio solid:ghost = 32:10 ≈ 3.2:1). **Never draw the solid chevron alone** — the ghost
mirror is what makes it Payth and not Kodelyth.

- **solid** (forward `>`, apex right): `polyline points="172,100 260,200 172,300"` stroke-width `32`
- **ghost** (mirror `<`, apex left):   `polyline points="228,100 140,200 228,300"` stroke-width `10`

Both apexes sit symmetric around center x=200 (solid apex at 260, ghost apex at 140).

### Apex-relative form (for scaling into any layout)
Center the mark at any point, then scale. Both chevrons about the shared center `(0,0)`:
- **solid**: `polyline points="-28,-100 60,0 -28,100"` stroke-width `32`
- **ghost**: `polyline points="28,-100 -60,0 28,100"` stroke-width `10`
- ghost opacity: **`0.15` on light grounds**; **`0.30–0.34` on dark grounds** so the mirror still reads.

At small sizes (favicon ≤ 32px) use `payth-favicon.svg` instead — it carries a bolder solid
(stroke 52) and a lifted ghost (stroke 16, opacity 0.34) so the mark survives downscaling.

---

## Color

Payth uses **emerald** as its accent — the same sanctioned Kodelyth product green as Veltix.
Green also carries the universal "money / payment / success" meaning, so it fits a gateway.

| Role | Hex | Use |
|------|-----|-----|
| Ground (dark) | `#0a0a0a` | app icon tile, social cards, dark lockup |
| Ground (light) | `#F4F6F5` | light lockup, docs |
| Mark on dark | `#34D399` (emerald-bright) | the mark on `#0a0a0a` |
| Mark on light | `#059669` (emerald-primary) | the mark on `#F4F6F5` |
| Off-white text | `#F4F6F5` | wordmark on dark |
| Ink text | `#0f172a` | wordmark on light |
| Muted sub-line | `#F4F6F5`/`#0f172a` at ~0.5 opacity | "PAYMENTS · BY KODELYTH" |

**Rule:** dark ground + off-white type + the one emerald mark. Do not scatter emerald or stack
glows. When Payth and Veltix ever appear together, differentiate by **geometry** (Payth mirrors
outward, Veltix points down), not by inventing a second hue.

> If a future decision needs Payth to visually separate from Veltix at a glance, the sanctioned
> move is to shift Payth's emerald toward **teal `#14B8A6`** — do NOT introduce a warm color.
> Until that decision is made, Payth = emerald `#34D399` / `#059669`.

---

## Type

Inherits the Kodelyth type system:
- Family: `'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif`
- Wordmark: `PAYTH` — weight **700**, letter-spacing **3–8** (bigger mark = wider spacing)
- **The logo lockup is mark + `PAYTH` only — no sub-line.** Keep it clean. (Social/OG cards
  may carry a descriptor like `Payment gateway · by Kodelyth`, but the logo itself never does.)
- Wordmark is always all-caps `PAYTH`. Never "Payth", "PayTh", "kPay", "K-Pay".

---

## Naming — do / don't

- **Product name:** Payth (always). Customer-facing name of the gateway.
- **Engine:** PipraPay (the self-hosted software underneath). Internal / technical only.
- **Do NOT** use `kPay`, `Kpay`, `K-Pay`, `KodelythPay`, or any `k-` prefix — "KPay" is a real
  Hong Kong wallet brand (trademark collision) and the `k+word` pattern reads generic.
- Legal/company suffixes (`LLC` / `Ltd.`) never appear on Payth marketing — see `../BRAND.md`.

---

## Asset inventory (this folder — identical copy in `piprapay/brand/`)

**Source SVGs**
- `payth-mark.svg` — canonical mark, 400×400, emerald on white
- `payth-icon.svg` — app icon, 512×512 rounded dark tile
- `payth-favicon.svg` — small-size optimized (bolder), for favicons
- `payth-light.svg` / `payth-dark.svg` — wordmark lockups (340×120)
- `payth-og.svg` — Open Graph / social card, 1200×630
- `payth-fb-cover.svg` — Facebook cover, 820×312
- `payth-fb-profile.svg` — square social profile, 512×512

**Rasterized PNG / ICO**
- `payth-icon-512.png` · `payth-icon-192.png` — PWA / Android app icons
- `payth-apple-touch-180.png` — iOS `apple-touch-icon`
- `payth-favicon-32.png` · `payth-favicon-16.png` — browser favicons
- `payth-favicon.ico` — multi-res ICO (16/32/192)
- `payth-mark.png` — 800×800 mark master
- `payth-og.png` · `payth-fb-cover.png` · `payth-fb-profile.png` — social masters

## Web `<head>` snippet (for the Payth / PipraPay app)
```html
<link rel="icon" href="/brand/payth-favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/brand/payth-favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/brand/payth-apple-touch-180.png">
<link rel="icon" type="image/png" sizes="192x192" href="/brand/payth-icon-192.png">
<meta property="og:image" content="https://kodelyth.org/brand/payth-og.png">
```

## Rasterizing (regenerate PNGs from SVG)
```bash
cd /Users/shofiqulislam/github-repo/kodelyth-ecc/brand/payth
rsvg-convert -w 512 -h 512 payth-icon.svg    -o payth-icon-512.png
rsvg-convert -w 192 -h 192 payth-icon.svg    -o payth-icon-192.png
rsvg-convert -w 180 -h 180 payth-icon.svg    -o payth-apple-touch-180.png
rsvg-convert -w 32  -h 32  payth-favicon.svg -o payth-favicon-32.png
rsvg-convert -w 16  -h 16  payth-favicon.svg -o payth-favicon-16.png
rsvg-convert -w 1200 -h 630 payth-og.svg     -o payth-og.png
magick payth-favicon-16.png payth-favicon-32.png payth-icon-192.png payth-favicon.ico
# then sync to piprapay/brand (see top of this file)
```
