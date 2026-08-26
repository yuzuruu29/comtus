# Comtus Promo (Remotion)

Programmatic brand film for **Comtus AI** — Lamplight Study palette, Fraunces / Inter / JetBrains Mono, warm scholar voice from `BRAND.md`.

## Compositions

| ID | Size | Use |
|---|---|---|
| `ComtusPromo` | 1920×1080 | YouTube / web |
| `ComtusPromoSquare` | 1080×1080 | Feed |
| `ComtusPromoVertical` | 1080×1920 | Reels / Shorts / TikTok |

~28s at 30fps. Scenes: Hook → Tagline → Manifesto → Features → Trust → CTA.

## Commands

```bash
cd promo
npm i
npm run dev          # Remotion Studio
npx remotion still ComtusPromo --frame=90 --scale=0.5
npx remotion render ComtusPromo out/comtus-promo.mp4
```

## Brand rules honored

- Tagline: *Rough thought, polished.*
- CTA: *Open the studio. Think tonight.*
- No hype words; motion uses house ease-out `cubic-bezier(0.22, 1, 0.36, 1)`
- Film grain ~4.5%; lamp glow + dust motes
