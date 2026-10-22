# Comtus web app redesign verification

2026-10-03 · Codex · local working tree based on `e2f290e8b9d68f2f197ddbb34aa3337bf7ca6d7c`.

The landing, public information-page layout, library, and notebook were redesigned using the existing Comtus typography, semantic colors, and paper material. Existing dirty accessibility/material changes were preserved. No dependency was added, and no commit, push, or deployment was performed.

## Checks

- `pnpm test --maxWorkers=2`: 101 files, 604 tests passed. See `full-tests.log`. This run preceded the final dialog/public-navigation changes.
- Final focused Vitest run: 6 files, 46 tests passed. See `final-focused-tests.log`. Covers LandingPage, Shelf, shared Dialog, VisionConsentDialog, PixelBatteryCompanion, and SourceReader. The last subsequent edit only removed an unsupported Testing Library type option; it did not change matching behavior.
- `pnpm lint`: passed on the final implementation. See `final-lint.log`.
- `pnpm build`: final TypeScript and Vite production build passed. See `final-build.log`.
- Independent source reviews found no unresolved actionable issues. `git diff --check` passed.

Earlier diagnostic logs (`types.log`, `library-tests.log`, `build.log`, `lint.log`) are retained as history; the `final-*` logs and full-suite log above are the delivery evidence.

## Browser acceptance

- Checked desktop and narrow layouts from 320px to 1440px; no document overflow in the checked mobile states.
- Landing sample question/practice feedback, recall-card flip, mobile navigation/Escape, optional setup, and public reading layout work.
- Library search/no-result recovery, grid/list views, uncropped action menus, and rename/save work. Rename restores focus to its options button; cancelling New notebook restores its opener.
- Pasted source import, source search, inclusion/composer synchronization, mobile source picker, and source reading work. The source-reader body scrolls while its header/actions remain stable.
- Notebook mobile panes, keyboard sidebar resizing, shared full/compact chat drafts, and source-aware welcome were checked without sending an AI request.
- Automatic Compad placement returns to its desktop resting area after mobile resizing. Saved/manual placement remains clamped within the viewport. Independent review checked the reproduction, dark theme, enlarged reading, and motion disabled.
- Footer navigation now opens public pages at their title. Returning home focuses its title; section anchors still scroll to their targets. Regression tests also cover POP navigation.

## Preview and boundaries

Preview: <http://127.0.0.1:5199/>. The preview was restarted after an interruption and is running in a hidden background process. It is a local development preview, not a deployed release.

Screenshots: `landing-desktop.jpg`, `library-desktop.jpg`, `notebook-desktop.jpg`. The explicitly labelled Learning & memory sample notebook remains in this local preview's browser storage.

Existing JSDOM canvas notices and Vite externalization/large-chunk warnings remain non-blocking. Live AI/provider behavior, payment actions, physical mobile devices, and packaged Tauri behavior were not verified by this redesign pass.
