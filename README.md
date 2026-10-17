# Couchkit

A friendly toolbox for your **Google TV** or **Android TV**, for Mac and Windows.
Connect over Wi-Fi and use plain buttons instead of commands: a remote, app manager, file browser, screenshots, tune-ups, cleanup, backup and more.

## Download

Get the latest version from the **[Releases page](../../releases/latest)**.

| Your computer | Download |
| --- | --- |
| Mac with Apple chip (M1, M2, M3, M4...) | `Couchkit-…-arm64.dmg` |
| Mac with Intel chip | `Couchkit-….dmg` (the one without "arm64") |
| Windows | `Couchkit.Setup.….exe` |

Not sure which Mac you have? Apple menu > **About This Mac**.

**First open:** Couchkit isn't code-signed yet, so your computer will ask you to confirm.
- **Mac:** drag Couchkit to Applications and try to open it once. Then open **System Settings > Privacy & Security**, scroll down and press **Open Anyway**.
- **Windows:** if SmartScreen warns about an unknown publisher, press **More info**, then **Run anyway**.

## Set up your TV

1. On the TV open **Settings > System > About** and tap **Build** seven times.
2. Open **Settings > System > Developer options** and turn on **USB debugging** (and **Wireless debugging** if you see it).
3. Keep the TV and your computer on the same Wi-Fi.
4. Open Couchkit. It offers to download Google's `adb` tool for you the first time.

## Privacy

No accounts, no tracking, nothing leaves your computer. Couchkit only downloads Google's adb when you ask it to.

## Created by Steve Rozario

Free and open source under the [Apache License 2.0](LICENSE). Copyright 2026 Steve Rozario.
If you share or modify it, keep the copyright notice and the [NOTICE](NOTICE) file. The Couchkit name and logo are not part of the licence ([TRADEMARKS.md](TRADEMARKS.md)).

Built with Claude as my AI sidekick. If Couchkit saved you time, you can [buy me a coffee](https://buymeacoffee.com/vistrocity). It's optional; the app is free either way.

Couchkit is an independent project, not affiliated with or endorsed by Google. "Android" and "Google TV" are trademarks of Google LLC. `adb` is a separate Google program with its own licence and is not included.

## For developers

Needs [Node.js](https://nodejs.org) 22 or newer.

```bash
npm install
npm run dev    # run the app
npm test
npm run dist   # build an installer for your system
```

Built with Electron, TypeScript and React. See [CONTRIBUTING.md](CONTRIBUTING.md).
