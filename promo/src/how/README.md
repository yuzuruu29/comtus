# How Comtus works (explainer)

A 35-second Remotion film for people who have never seen Comtus. It walks through the four steps a student takes, Add, Ask, Practice and Plan, and closes on privacy and the call to action. It plays at the top of the repository README.

| Scene | Frames | What happens |
|---|---|---|
| Hook and 01 | 0 to 285 | "Exam on Friday." Six files tumble into a pile, then file themselves into a Biology 101 notebook. |
| 02 Ask | 270 to 495 | A question is typed, the reasoning shows, the answer inks in and cites page 12, and the page lifts onto the desk with the passage highlighted. |
| 03 Practice | 480 to 705 | A wrong quiz answer turns into a new flashcard, a mock exam timer runs, the score ring fills and a weak topic is flagged. |
| 04 Plan | 690 to 825 | A five-day exam plan fills in and ticks off before Friday. |
| Trust | 810 to 930 | Notes stay on your device, and the three ways to connect a model. |
| Finale | 915 to 1065 | Compad, the wordmark, the tagline and the URL. |

## Sources of truth

- Colours mirror `src/styles/tokens.css` in `theme.ts`. Fonts are the app's own @fontsource files, imported from the root `node_modules`, so run `pnpm install` at the repo root first.
- Compad is drawn from `src/components/pixel/pixelBatteryFrames.tsx`.
- Every claim is a shipped feature. Check `src/studio/SourcesPane.tsx` (accepted file types) before changing the sources list.
- This folder has its own entry point (`index.ts`), separate from the brand film's `src/Root.tsx`.

## Commands

Run from `promo/`:

```bash
npx remotion studio src/how/index.ts
npx remotion render src/how/index.ts ComtusHowItWorks out/how/comtus-how-it-works.mp4 --crf=20
```

Publish to the README (from the repo root):

```bash
ffmpeg -i promo/out/how/comtus-how-it-works.mp4 -an -c:v copy -movflags +faststart docs/media/comtus-how-it-works.mp4
ffmpeg -i promo/out/how/comtus-how-it-works.mp4 -vf "fps=12,scale=880:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -loop 0 docs/media/comtus-how-it-works.gif
```
