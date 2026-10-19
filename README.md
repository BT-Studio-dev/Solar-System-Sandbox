# Solar System Sandbox

An offline, interactive solar system with all eight planets, mutual Newtonian gravity, custom planets, orbit guides, trails, body following, and local save/load. Built for mouse and touch.

## Try it now

Requires Node.js 22 or newer. No installation or downloaded assets are needed for the browser version:

```sh
npm start
```

Open `http://localhost:3000`. In Arena, open the **Solar System Sandbox** live preview.

## Windows EXE and Android APK downloads

Open [Build Windows and Android](https://github.com/BT-Studio-dev/Solar-System-Sandbox/actions/workflows/build.yml), select a **successful run for your branch/commit**, and download its artifacts at the bottom of the run page. The workflow runs automatically on pushes to `main` and `arena/**`, or can be started with **Run workflow**. GitHub may require sign-in to download artifacts. Downloads expire after 30 days; rerun the workflow when necessary.

| Package | Target | Important details |
| --- | --- | --- |
| `Solar-System-Sandbox-Windows-10-11-x64` | Windows 10/11, 64-bit Intel/AMD | Portable `.exe`, Electron 44.9.0 |
| `Solar-System-Sandbox-Windows-7-legacy-x64` | Windows 7 SP1, 64-bit Intel/AMD | Separate portable `.exe`, Electron 22.3.27 |
| `Solar-System-Sandbox-Android-preview` | Android 8.0+ | Installable **debug-signed preview** `.apk`, uses Android System WebView |

Each ZIP contains the executable/APK and `SHA256SUMS.txt`. Unzip before running. No installer is required on Windows. Windows builds are **unsigned**, so Windows may show an unknown-publisher warning. Do not disable system security globally. Android preview installs require allowing installation from the app used to open the APK; no Internet or storage permission is requested. This is **not a Play Store release**, and no release signing key is included.

**Windows 7 warning:** Windows 7 and Electron 22 are end-of-life and do not receive security fixes. The legacy build is provided only for compatibility with an offline sandbox. It blocks network requests, external navigation, permissions, and Node access from the renderer; that does not make an obsolete OS/runtime secure. Windows 7 compatibility is a target, **not a certification**. The CI smoke test runs on a current Windows runner, not a Windows 7 machine. Test the legacy EXE on your intended Windows 7 SP1 machine (with required OS updates) before relying on it.

**Android:** use an up-to-date Android System WebView (Chromium 108+ recommended). This app contains Java and web assets, not native CPU-specific libraries, so the APK works on compatible ARM/ARM64/x86 devices. APK signature verification is automated; physical-device/emulator testing is still required.

## Controls

- Click/tap a planet or select it in **Bodies** to inspect it.
- **Space** pauses/resumes. The speed buttons set simulated years per real second.
- Scroll/pinch or use **+ / −** to zoom; right-drag/two-finger drag to pan.
- **Follow body** locks the view to your selected object; **Fit** returns to the whole system.
- **Add a planet** lets you choose name, type, mass, and circular/reverse/stationary motion, then click/tap a position (0.15–500 AU). Up to 40 bodies.
- **Save / Load** stores one sandbox locally on the current device/profile. Reset does not overwrite the saved sandbox.
- **R** opens reset confirmation; **Esc** cancels placement or closes drawers.
- On small screens, **Body info** opens the inspector; **×** closes it.

## Simulation model

Physics uses AU, years, solar masses, and `G = 4π²`. A velocity-Verlet integrator subdivides each frame into steps no larger than 0.001 years. All bodies, including the Sun, move and gravitationally interact. Initial planet orbits are circular, coplanar approximations, **not** real-time astronomical positions or full orbital elements.

By default, the renderer compresses radial distances with `r^0.54`; turn off **Compress distances** for linear AU spacing. Displayed body sizes are always exaggerated. Orbit guides show approximate reference circles, not trajectory predictions. Orbital period is a circular-orbit estimate at the current Sun distance. Near-contact gravity is softened at 0.0001 AU; there are no collisions/mergers, moons, relativistic effects, or scientific accuracy guarantees. Elapsed time slows under heavy load rather than skipping large unstable steps. Background tabs pause advancement.

## Develop and test

```sh
# Install tooling without fetching Electron's optional desktop runtime:
npm ci --ignore-scripts
npm test        # deterministic physics + save validation
npm run test:ui # Linux headless desktop/mobile interaction tests; starts its own server

# To run the actual desktop application:
npm ci
npm run desktop
```

Browser tests use a Chromium binary distributed via npm; screenshots are written to ignored `.tools/`. Production web code has **zero third-party runtime dependencies**, fonts, trackers, CDN assets, or API calls. Desktop/Android reuse the same `web/` files. Build tools have transitive legacy packages; `npm audit --omit=dev` checks the runtime dependency tree. Never use `npm audit fix --force` blindly, particularly on the intentionally pinned legacy runtime.

### Build Windows locally (on Windows)

Modern build:

```sh
npm ci
npm run build:windows
```

Output: `dist/Solar-System-Sandbox-1.0.0-Windows-x64.exe`.

Legacy build (keep the lockfile unchanged):

```sh
npm ci --ignore-scripts
npm install --no-save --package-lock=false --ignore-scripts electron@22.3.27
node node_modules/electron/install.js
npx electron-builder --win portable --x64 --publish never --config.electronVersion=22.3.27 --config.portable.artifactName=Solar-System-Sandbox-1.0.0-Windows-7-legacy-x64.exe
```

Run `npm ci` afterward to restore the modern runtime. Electron 22 is the last Electron major supporting Windows 7. Do not use the modern build on Windows 7.

### Build Android locally

Install Java 17, Gradle 8.11.1, Android SDK platform 35, and build tools 35.0.0. Set `ANDROID_HOME` (or create ignored `android/local.properties` with `sdk.dir`). Then:

```sh
npm run build:android-assets
gradle -p android assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. Generated assets are deliberately not committed; rerun the assets command after editing the web app. A production/store build requires your own secure release-signing configuration and device testing. Never commit signing keys.

## Repository layout

- `web/` — shared app, canvas renderer, deterministic physics
- `desktop/` — isolated, sandboxed Electron wrapper
- `android/` — native Java offline WebView wrapper, no JavaScript bridge
- `tests/` — physics, saves, and browser interaction checks
- `.github/workflows/build.yml` — Windows modern/legacy + Android build pipeline

### Validation status

Physics/save tests and headless desktop/mobile browser tests run in Arena. Native builds are produced separately by GitHub Actions, and are available only after their jobs succeed. Do not confuse a working browser preview or source checkout with an already-built EXE/APK. Windows 7 hardware and Android device testing are not performed by the build workflow.
