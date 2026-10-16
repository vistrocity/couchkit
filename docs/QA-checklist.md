# Manual QA checklist

Run on **both** macOS and Windows, with a real Google TV or Android TV on the same Wi-Fi.
Tick each box per system. Version tested: ______  Date: ______

## Slice 0 (skeleton)

| # | Check | macOS | Windows |
| - | ----- | :---: | :-----: |
| 1 | The app opens and shows a window titled "Couchkit" | ☐ | ☐ |
| 2 | Home says the correct system name (macOS / Windows) | ☐ | ☐ |
| 3 | Shortcut hint shows **Cmd** on macOS and **Ctrl** on Windows | ☐ | ☐ |
| 4 | Sidebar items switch the page; unfinished pages say "not built yet" | ☐ | ☐ |
| 5 | adb card says adb is ready (if installed) or "not found" (if not) | ☐ | ☐ |
| 6 | Switch the system between light and dark mode: the app follows | ☐ | ☐ |
| 7 | Resize the window to the smallest size: nothing is cut off | ☐ | ☐ |
| 8 | macOS: menu appears in the top bar. Windows: menu appears in the window | ☐ | ☐ |
| 9 | Closing the window: macOS keeps the app in the Dock; Windows quits | ☐ | ☐ |
| 10 | Installer opens without errors (expect an "unidentified developer" / SmartScreen warning, see README) | ☐ | ☐ |

## Slice 1 (adb download, connect, device info, history)

Have the TV's address ready (TV: Settings > System > About > Status, or Settings > Network).
Turn on **Developer options > USB debugging** (and **Wireless debugging** if offered) first.

| # | Check | macOS | Windows |
| - | ----- | :---: | :-----: |
| 11 | Home says adb is "not found" and offers **Download adb** (if you have no adb installed) | ☐ | ☐ |
| 12 | Download adb: a progress bar runs, then Home says "adb 1.x.x is ready" | ☐ | ☐ |
| 13 | Quit and reopen: adb is still ready without downloading again | ☐ | ☐ |
| 14 | Connect: typing nonsense (for example `abc`) shows "does not look like a TV address" | ☐ | ☐ |
| 15 | Connect with the TV's address: the TV asks to allow this computer; choose Allow (always allow) | ☐ | ☐ |
| 16 | The Connected TV card shows model, Android version, resolution, address | ☐ | ☐ |
| 17 | The bar at the top says "Connected to <model>" on every page | ☐ | ☐ |
| 18 | Disconnect works and the bar says "Not connected" | ☐ | ☐ |
| 19 | The TV appears under **Your TVs** with its last-used time | ☐ | ☐ |
| 20 | Rename and Remove work, and the list is still right after reopening the app | ☐ | ☐ |
| 21 | Connecting to a wrong address (for example one number off) shows "Could not reach the TV" with a fix | ☐ | ☐ |
| 22 | With the TV turned off, connecting shows a clear message and no endless spinner | ☐ | ☐ |
| 23 | Activity page lists the adb commands that ran, with their output | ☐ | ☐ |
| 24 | **Cmd+K** (Mac) or **Ctrl+K** (Windows) jumps to the address box | ☐ | ☐ |
