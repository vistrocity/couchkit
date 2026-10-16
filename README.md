# Couchkit

A desktop toolbox for **Google TV** and **Android TV** devices, for macOS and Windows.
It talks to your TV over Wi-Fi using Google's `adb` and gives you plain buttons instead of commands.

> **Status: early development (v0.1, sixth slice).** The app can download `adb`, connect to your TV by address,
> remember the TVs you used, show their details, and list every command it ran (Activity page).
> It also has an on-screen remote (with keyboard keys and typing) and an app manager (install .apk files, uninstall,
> disable/enable) and a file browser (upload, download, new folder, delete). It can take screenshots and record the TV screen (saved in your Pictures and Videos folders, in a Couchkit folder). A console runs commands on the TV, with ready-made and saved shortcuts. TV discovery and the extra tools arrive in the next slices.

Couchkit is an independent project. It is not affiliated with or endorsed by Google.
"Android" and "Google TV" are trademarks of Google LLC.

## Get the app (no coding needed)

1. Open the **Actions** tab of this repository and choose the latest successful **Build** run.
2. Under **Artifacts**, download `couchkit-macOS` or `couchkit-Windows` and unzip it.
3. Install:
   - **macOS:** open the `.dmg` and drag Couchkit to Applications. The app is not signed yet, so the first time,
     right-click it and choose **Open**, then **Open** again.
   - **Windows:** run the `.exe` installer. Windows SmartScreen may warn about an unknown publisher:
     choose **More info**, then **Run anyway**.

## Run it from the source (to develop)

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
npm install
npm run dev        # opens the app with live reload
npm test           # unit tests
npm run typecheck
npm run dist       # builds an installer for the system you are on
```

## Prepare your TV

1. On the TV open **Settings > System > About** and tap **Build** seven times to become a developer.
2. Open **Settings > System > Developer options** and turn on **USB debugging** (and **Wireless debugging** if offered).
3. Keep the TV and your computer on the same Wi-Fi network.

## How it is built

- Electron + TypeScript + React.
- One module (`src/main/adb/runner.ts`) starts every external program, with an argument list (never a shell string),
  a timeout, and a log entry. Text you type can never become a command.
- One module (`src/main/platform/`) knows which operating system it is, so the rest of the code does not.

## Signing

Builds are unsigned. For public releases:
- **macOS:** an Apple Developer ID certificate and notarization (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` as repository secrets, then enable notarization in `electron-builder.yml`).
- **Windows:** a code signing certificate (`CSC_LINK`, `CSC_KEY_PASSWORD`).

## License

Apache-2.0. See `LICENSE` and `NOTICE`. `adb` and `scrcpy` are separate programs with their own licenses and are
downloaded by the user, not included.
