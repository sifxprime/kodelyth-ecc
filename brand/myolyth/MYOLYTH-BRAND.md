# Myolyth — Brand

AI fitness platform by Kodelyth LLC. Workout programming, nutrition, and AI technique coaching.

**Name:** `myo-` (muscle) + `-lyth` (the Kodelyth suffix). Pronounced **MY-oh-lith**.
`-lith` is Greek for stone — "muscle made solid." The promise is durable physical change,
not a 30-day cycle.

---

## The mark — Ascent

A **ghost-depth chevron pointing up**: a solid `^` driving upward, with a faint second
chevron trailing below it. The ghost is the signature of the entire Kodelyth system —
**never drop it.**

### Where it sits in the family

Every Kodelyth brand is the same two-polyline construction, rotated to encode meaning:

| Brand | Mark | Meaning |
|---|---|---|
| Kodelyth | ghost `>` trailing solid `>` | forward motion, depth |
| Veltix | ghost `v` above solid `v` | **Descent**-V — routing down to providers |
| Payth | ghost `<` + solid `>`, apexes outward | the payment loop (send + receive) |
| **Myolyth** | **ghost `^` trailing below solid `^`** | **Ascent** — the lift, the gain |

Myolyth is the exact vertical inverse of the Veltix Descent-V. That inversion is deliberate.

---

## Exact geometry — copy this, do not redraw

The recurring failure on this brand is hand-recreating polylines from memory and getting
them wrong. **Always copy from the files in this folder.**

### Standalone mark (`myolyth-mark.svg`, 400×400)

```xml
<g stroke-linecap="round" stroke-linejoin="round" fill="none" stroke="#EA580C">
  <polyline points="125,255 200,211 275,255" stroke-width="10" stroke-opacity="0.30"/>
  <polyline points="119,214 200,145 281,214" stroke-width="32"/>
</g>
```

### App icon (`myolyth-icon.svg`, 512×512, rounded tile rx=112 on `#0a0a0a`)

```xml
<g stroke-linecap="round" stroke-linejoin="round" fill="none" stroke="#F97316">
  <polyline points="160,326 256,270 352,326" stroke-width="13" stroke-opacity="0.50"/>
  <polyline points="152,274 256,186 360,274" stroke-width="40"/>
</g>
```

### Lockup mark (`myolyth-light.svg` / `-dark.svg`, mark axis centered y=60)

Same geometry in both; only the ghost's colour treatment differs.

```xml
<!-- light: ghost as opacity over white -->
<polyline points="56,83 73,57 90,83" stroke-width="4" stroke-opacity="0.30"/>
<polyline points="50,74 73,37 96,74" stroke-width="12"/>   <!-- solid #EA580C -->

<!-- dark: ghost as an explicit tint, NOT opacity (see below) -->
<polyline points="56,83 73,57 90,83" stroke-width="4" stroke="#F0B585"/>
<polyline points="50,74 73,37 96,74" stroke-width="12"/>   <!-- solid #F97316 -->
```

Wordmark: `x=126 y=73`, Space Grotesk 700, `font-size=36`, `letter-spacing=3`, text `MYOLYTH`.
Measured width 181.2px → viewBox `400 × 120`.

---

## Colour

Orange, chosen to sit apart from Payth's emerald and Kodelyth's navy. Two shades:

| Use | Hex | Token |
|---|---|---|
| On **light** backgrounds | `#EA580C` | orange-600 |
| On **dark** backgrounds, app icon | `#F97316` | orange-500 |
| Wordmark on light | `#0f172a` | slate-900 |
| Wordmark on dark | `#F4F6F5` | off-white |
| Dark tile | `#0a0a0a` | |

> **Note:** Payth uses its *light* shade (`#34D399`) on a white rect in `payth-mark.svg`,
> which contradicts its own lockup (`#059669` on light). That's an inconsistency in those
> files, not a convention. Myolyth uses the clean rule: **deeper on light, lighter on dark.**

### Ghost treatment — opacity on light, explicit tint on dark

Opacity is **not** transferable between brands, because a light/warm hue disappears at a
value where navy still reads. These were set by rendering a ladder against the siblings,
not by guesswork:

| Context | Value | Why |
|---|---|---|
| Orange on light | opacity `0.30` | matches how Kodelyth's navy reads at `0.15` |
| Orange on **any dark surface** | tint **`#F0B585`** | see below — opacity fails here |

One value, `#F0B585`, now covers the dark lockup, the app icon and the favicon.

#### Why the dark lockup breaks the opacity rule

`stroke-opacity` composites toward **whatever is behind it**. On white that lightens the
orange into a pale peach, which recedes and reads exactly as intended. On near-black the
same rule darkens it into a muddy brown that reads as a **shadow**, not a ghost — so the
light and dark lockups looked like two different logos sitting side by side.

No opacity value fixes this. Lower goes muddier; higher collapses into the solid. The
ghost on dark has to be set as an explicit lighter tint of the same hue. An opacity ladder
(0.30 / 0.40 / 0.50 / 0.62 / 0.72 / 0.82) and a tint ladder (`#C9814A` / `#DE9A64` /
`#F0B585` / `#F9CCB6`) were rendered at 3x against the light lockup; `#F0B585` matched its
relationship without competing with the solid. `#F9CCB6` — the light ghost's exact
composited value — is too bright on black and pulls the eye off the apex.

This supersedes "the ghost is the solid's colour at opacity" **on dark surfaces**.
Everything else in that rule still holds: never drop the ghost, never thicken the solid,
never shift its hue. On light, opacity `0.30` is unchanged and still correct.

### Applied everywhere dark

`myolyth-dark.svg`, `myolyth-icon.svg` and `myolyth-favicon.svg` all use `#F0B585`, and
every PNG raster was re-rendered from them through one Chrome pipeline so the set cannot
drift. The old favicon opacity of `0.58` existed to keep the ghost alive at 16px; the tint
is brighter than that, so the downscale is no longer marginal — the ghost is legible at
16, 32 and 180.

Both lockup PNGs were re-rendered together and measure identical content extents
(x=132..933). Re-render the pair together if either changes; Space Grotesk must resolve or
the wordmark shifts.

### Still on opacity

`myolyth-mark.svg` keeps opacity `0.30` — it sits on a white rect, where the rule works.

---

## Typography

Space Grotesk 700, `letter-spacing: 3`. Falls back to Inter, then system-ui.
Self-hosted at `assets/css/font-files/SpaceGrotesk.woff2` (variable, weight 100–900).

---

## Files

| File | Purpose |
|---|---|
| `myolyth-mark.svg` / `.png` | standalone mark, 400×400 (PNG 2400²) |
| `myolyth-light.svg` / `.png` | lockup, orange + navy, transparent |
| `myolyth-dark.svg` / `.png` | lockup, orange + off-white, transparent |
| `myolyth-icon.svg` | app icon, rounded dark tile |
| `myolyth-icon-1024/512/192.png` | app icon rasters |
| `myolyth-favicon.svg` | small-size variant — bolder solid, lifted ghost, rx=96 |
| `myolyth-favicon-32/16.png` | favicon rasters |
| `myolyth-apple-touch-180.png` | iOS home screen |

Lockup SVGs are **transparent** (no background rect) — place them on your own surface.
The standalone mark keeps a white rect, matching `kodelyth-mark.svg`.

---

## Rules

- **Never hand-draw the mark.** Copy the geometry above or reference the file.
- **Never drop the ghost** — not in favicons, not "because it's small." It is the system.
- Don't thicken the solid or recolour the ghost; the ghost is the solid's colour at opacity.
- Dark background → use the dark lockup and the `#F97316` shade, never the light pair.
- Don't put the orange mark on a mid-grey or coloured surface; it needs white or near-black.

---

## Regenerating the PNGs

Rendered with headless Chrome (the font must be embedded as a data URI, or the wordmark
falls back and the metrics shift):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --allow-file-access-from-files --default-background-color=00000000 \
  --virtual-time-budget=5000 --window-size=W,H --screenshot=out.png file://<wrapper>.html
```

---

## Status

Name selected 2026-10-18. Domains `myolyth.com` / `.ai` / `.fit` / `.co` and the
`myolith.com` misspelling were all available at that date — **register before spending
further on brand work.**

**Not yet cleared for trademark.** `myo-` is heavily used in supplements and fitness
equipment (Myprotein, MYOS, MyoRep). Run a USPTO TESS search on `myolyth` + `myolith`
across Class 41 (fitness training), Class 9 (software) and Class 5 (supplements) before
committing. A coined mark like this sits in the strongest protection tier — worth clearing
properly.
