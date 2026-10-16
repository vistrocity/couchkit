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
