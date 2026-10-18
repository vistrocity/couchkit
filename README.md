# Couchkit

A friendly toolbox for your **Google TV** or **Android TV**, for Windows (Mac version coming).
Connect over Wi-Fi and use plain buttons instead of commands: a remote, app manager, file browser, screenshots, tune-ups, cleanup, backup and more.

## Download

**Windows:** get `Couchkit.Setup.….exe` from the **[Releases page](../../releases/latest)** and run it.
Couchkit isn't code-signed yet, so if SmartScreen warns about an unknown publisher, press **More info**, then **Run anyway**.

**Mac:** an installer isn't ready yet. On recent versions of macOS (Sequoia and Tahoe), an installed app can fail to get the "Local Network" permission it needs to find and talk to your TV. Couchkit works on a Mac when run from source, so for now see "For developers" below. A proper Mac download will come once this is solved.

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
