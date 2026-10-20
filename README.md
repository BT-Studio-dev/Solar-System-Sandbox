# Solar System Sandbox — Aero Simulator

**Version 2.0** is a major offline simulator update inspired by your Aero Night screenshots. Explore 41 solar-system bodies plus the seven worlds of the TRAPPIST-1 exoplanet system; choose from seven scenarios; create worlds; save portable JSON experiments; browse local planet presets; and switch among six themes, including dark frosted Aero Glass. Select 1D radial, 2D flat, 3D spatial, or an explicitly illustrative 4D-inspired time projection. The original gravity sandbox remains available as **Classic sandbox**.

## Try it now

Requires Node.js 22 or newer. No downloaded art, CDN, network calls, account or remote assets are required:

```sh
npm start
```

Open `http://localhost:3000`. In Arena, use the **Solar System Sandbox · Aero** live preview. Aero is the default; the top-right **Classic sandbox** link opens the original sandbox at `classic.html`.

## Version 2.0 highlights

This major release adds the TRAPPIST-1 exoplanet system, the interstellar visitor 1I/Oumuamua, portable versioned JSON experiment files, safer validated imports, Left/Right body selection, and updated Android/Windows package numbering. See [CHANGELOG.md](CHANGELOG.md).

## Features

- Seven scenarios: Solar System, Inner System, Jupiter & Saturn, Outer System, Binary Star, Empty Sandbox and TRAPPIST-1.
- Forty-one Solar System catalog bodies: Sun, eight planets, Ceres, Pluto, 21 moons, the interstellar visitor 1I/Oumuamua, two periodic comets and five named asteroids.
- A TRAPPIST-1 exoplanet system with seven worlds, approximate published sizes, masses and periods, around an ultracool red dwarf.
- Inspect body distance, orbital period, rotation, radius, mass, description and satellites. Search/select via the body picker; **Focus** and **Follow** work on distant bodies too.
- Create stars, terrestrial planets, gas/ice giants, dwarf planets, asteroids, comets and black holes. Set name, mass, radius and orbital radius. Custom bodies are integrated with live softened Newtonian gravity.
- Live gravity for primaries, separately released bodies, approximate dated Keplerian rails, speed/pause and UTC epoch controls.
- Orbit and motion-trail visibility, moon names, axes, true display sizes, auto tracking, distance measurement, zoom, pan and 3D view orbit.
- Local, validated save/load plus portable, versioned JSON import/export to move experiments between devices. Invalid imports are rejected without replacing your current session.
- A persistent, bounded local library of user planet parts. Three built-in sample parts.
- Theme-colour, Deep Blue and Warm Dusk procedural color packs. Six UI themes: dark frosted Aero Glass, Aero Night/Day, Luna Blue, Aurora and High Contrast.
- Four switchable dimensional projections: 1D radial line, 2D flat plane, 3D spatial camera, and a 4D-inspired time-axis visualization. The fourth-axis projection is illustrative, not a claim about physical 4D motion.
- Responsive mouse, keyboard and touch layouts; context help; no off-device requests.

## Windows EXE and Android APK

Open [Build Windows and Android](https://github.com/BT-Studio-dev/Solar-System-Sandbox/actions/workflows/build.yml), select a successful run for your branch/commit, and download its artifacts. GitHub may require sign-in; workflow artifacts expire after 30 days.

| Artifact                                    | Target                | Details                                                      |
| ------------------------------------------- | --------------------- | ------------------------------------------------------------ |
| `Solar-System-Sandbox-Windows-10-11-x64`    | Windows 10/11, 64-bit | Portable, unsigned EXE, Electron 44.9                        |
| `Solar-System-Sandbox-Windows-7-legacy-x64` | Windows 7 SP1, 64-bit | Separate portable, unsigned EXE, Electron 22.3.27            |
| `Solar-System-Sandbox-Android-preview`      | Android 8.0+          | Installable debug-signed preview APK; Android System WebView |

Each downloaded ZIP contains its executable/APK and SHA-256 checksum. Unzip before running. The unsigned Windows executable can display an unknown-publisher notice; do not disable system security. Android may require allowing installs from the APK-opening app. The app has no Internet or broad storage permission; Android's system document picker is used only when you explicitly import or export a JSON experiment. This is not a Play Store release; no release key is included.

**Windows 7 warning:** Windows 7 and Electron 22 are end-of-life and no longer receive security fixes. The legacy build is intended for compatibility, not secure general-purpose use. It is smoke-tested on a current CI runner, not certified/tested on Windows 7 hardware; try it on your target Win7 SP1 machine before relying on it. The modern Electron build is not the Win7 build.

## Controls

- Click/tap a body to inspect it. Use the inspector body picker to select any body, including planets outside the current camera view.
- Left drag pans; right drag rotates the viewing plane; wheel/pinch zooms. Focus zooms to the selection, Follow keeps it centered, and the reset-camera button restores the overview.
- **Space** play/pause; **C** simulation controls; **F1** help; **F3** theme; **Escape** closes popovers; **+ / −** zoom.
- Set a UTC date in simulation controls. Dates evaluate approximate orbital elements; they are not observed, precision real-time ephemerides.
- The **Create** tab selects the body type and adjusts mass/radius/orbit before adding. New bodies interact with gravity; original planets remain on rails unless released or global gravity is enabled.
- **Inspect** lists a body's satellites and quick actions. **Library** inserts sample/custom presets and switches procedural palettes. User presets and themes remain local to this browser/app profile.
- Save/Load stores one validated Aero scenario locally. It does not copy data between devices.

## Model limitations

The procedural orbital elements and descriptive reference data are an educational visualization, not a professional ephemeris or scientific guarantee. Major planets use approximate heliocentric ellipses; moons use parent-relative circular rails at their physical separation, drawn with exaggerated offsets for visibility. TRAPPIST-1 planet values and other orbital estimates are rounded references, not observed live positions. Sphere sizes are enlarged unless **True sizes** is enabled. Comet tails and surface textures are stylized procedural graphics. Placing or releasing a body uses a softened Newtonian N-body integrator; this is not a high-precision integrator, collision/merger engine, relativistic model, or a guarantee of stable long-term orbits. The seven scenarios and orbital estimates are approximations. Binary Star is a stylized educational preset.

## Develop and test

```sh
npm ci --ignore-scripts
npm test        # original physics/save plus Aero model validation
npm run test:ui # headless Chromium desktop/mobile interaction tests
```

The browser test launches its own server and checks both Aero and Classic, touch UI, offline-only requests, scenarios, themes, local parts, save/load, creation and simulation controls. Test screenshots are written to ignored `.tools/`. Native desktop/Android apps reuse the same `web/` directory and are packaged in CI. `npm audit --omit=dev` checks the zero-dependency runtime.

### Windows builds

On Windows, `npm ci && npm run build:windows` produces a portable EXE. CI separately selects Electron 22.3.27 for the Win7 legacy version; afterwards `npm ci` restores the current runtime.

### Android preview

Install Java 17, Gradle 8.11.1, Android platform 35 and build tools 35.0.0; set `ANDROID_HOME`. Then run:

```sh
npm run build:android-assets
gradle -p android assembleDebug
```

A production app-store release requires secure release signing and physical-device testing. Never commit signing keys.
