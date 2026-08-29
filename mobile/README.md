# Comtus Mobile (Expo React Native · Android & iOS)

> Standalone mobile companion for **Comtus** — "Rough thought, polished."
> Powered by Expo SDK 52, React Native, TypeScript, and the 16-color Cozy Pixel Bookshop design system.

---

## 1. Overview & Architecture

Comtus Mobile brings the scholar's desk experience to mobile viewports with native tactile physics:
- **16-Color Master Palette**: Exact token matching (`pxVoid`, `pxGround`, `pxSurface`, `pxBrass`, `pxInk`, `pxSage`, etc.).
- **Mobile-Native Pixel UI Library**:
  - `PixelButton`: Tactile stepped depress (+1px/+1px physical depression on press), Android ripple effect, and high-contrast bevel borders.
  - `PixelCard`: 16-bit bevel border container with book-trim corners and dither backdrops.
  - `PixelBadge`: Jewel-cut status tag and metadata chips.
- **Vertical Storytelling Onboarding**: 3-step swipeable picture-book format adapted for vertical screens (*The Empty Desk* -> *Light the Lamp* -> *Enter the Study*).
- **Shelf & Study Chat**: Grounded notebook shelves, live reasoning panel ("Thinking..."), citation chips, and composer.
- **BYOK & Local-First**: Private API key storage, IndexedDB / SQLite offline storage, zero-telemetry architecture.

---

## 2. Directory Structure

```
mobile/
├── assets/                    # App icons, splash screens, and pixel assets
├── src/
│   ├── components/            # Mobile-native Pixel UI library
│   │   ├── PixelButton.tsx    # Tactile Android ripple button
│   │   ├── PixelCard.tsx      # 16-bit bevel container
│   │   └── PixelBadge.tsx     # Jewel-cut status tag
│   ├── navigation/
│   │   └── RootNavigator.tsx  # Bottom tabs (Shelf, Study, Settings) + Stack navigation
│   ├── screens/
│   │   ├── OnboardingScreen.tsx  # 3-step vertical story
│   │   ├── HomeScreen.tsx        # Notebook shelf with search & tags
│   │   ├── ChatScreen.tsx        # Grounded study chat with visible reasoning
│   │   └── SettingsScreen.tsx    # BYOK, theme, and haptic/audio settings
│   └── theme/
│       ├── colors.ts          # 16-color master palette & semantic themes
│       └── colors.test.ts     # Theme validation unit tests
├── App.tsx                    # Root mobile entry point
├── app.json                   # Expo config (Android package: com.comtus.ai)
├── package.json               # Mobile dependencies
├── tsconfig.json              # TypeScript configuration
└── README.md                  # Mobile architecture documentation
```

---

## 3. Getting Started

### Installation
From the repository root or inside `mobile/`:
```bash
# Install dependencies from root
pnpm install

# Or specifically in mobile
cd mobile && pnpm install
```

### Running in Development
Start the Expo development server:
```bash
# From workspace root
pnpm --prefix mobile start

# Or directly in mobile
npx expo start
```

### Running on Android / iOS
```bash
# Run on connected Android device / emulator
pnpm --prefix mobile android
# or
npx expo run:android

# Run on iOS simulator (macOS required)
pnpm --prefix mobile ios
# or
npx expo run:ios
```

---

## 4. Building Standalone Binaries (EAS Build)

To build standalone `.apk` / `.aab` for Android:
```bash
# Build Android APK for direct testing
eas build --platform android --profile preview

# Build production Android App Bundle (AAB) for Google Play
eas build --platform android --profile production
```

---

## 5. Master Palette Reference

| Token | Hex | Role |
|---|---|---|
| `pxVoid` | `#080B12` | Deepest shadow, recessed backgrounds |
| `pxGround` | `#0F1420` | Warm midnight ink, page ground |
| `pxSurface` | `#171F32` | Raised bookshop surface, cards |
| `pxRaised` | `#222C44` | Elevated tiles, active states |
| `pxBorder` | `#33405F` | 16-bit bevel borders, frame outlines |
| `pxLeather` | `#4A2E1B` | Book-spine brown, binding accents |
| `pxBrassDeep` | `#B88428` | Antiqued brass edge, pressed states |
| `pxBrass` | `#E3B04B` | Signature warm lamplight gold, primary focus |
| `pxBrassLight` | `#F7D486` | Flame highlight, glowing filaments |
| `pxParchment` | `#E8DEC8` | Aged scholar parchment |
| `pxInk` | `#F5F0E6` | Primary high-contrast text |
| `pxMuted` | `#9099B0` | Muted labels, metadata, captions |
| `pxMoon` | `#6C98C2` | Midnight blue secondary accent, thinking tint |
| `pxSage` | `#78B084` | Success indicators, verified marks |
| `pxRust` | `#C85848` | Error, warnings, critical boundaries |
| `pxCandle` | `#FF9E43` | Amber hearth spark, milestone flares |
