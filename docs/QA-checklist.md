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

## Slice 2 (remote and apps) - test on a real TV

25. Remote page before connecting says "Connect to your TV first".
26. After connecting, click Up/Down/Left/Right/OK: the highlight moves on the TV.
27. Back, Home, Menu work. Play/Pause, Vol +/-, Mute work while media plays.
28. Keyboard: arrow keys, Enter, Esc, H, M, Space act as the remote (not while typing in the text box).
29. Power asks "Turn the TV on or off?" first; Yes sends it, Cancel does nothing.
30. Select a search box on the TV, type "hello world" and press Send: the text appears.
31. Apps page lists apps you installed (with version and store); switching to "All apps" adds system apps.
32. Search filters the list. Refresh reloads it.
33. Drop a real .apk onto the box (and use "Choose files..."): it installs and shows "Installed."
34. Drop a non-.apk file: it says it is not an .apk file.
35. Disable an app you installed: it shows "(disabled)" after refresh; Enable brings it back.
36. Uninstall asks to confirm; after Yes the app disappears from the list.
37. Activity page shows each command, including install and uninstall.
38. On a Mac, repeat 25-37 (also check that drag and drop works there).

## Slice 3 (files) - test on a real TV

39. Files page before connecting says "Connect to your TV first".
40. After connecting it opens Storage (/sdcard) and lists folders first, then files, with size and date.
41. Click a folder to open it; the path bar and "Up" work; the shortcut chips (Download, Movies, Pictures, DCIM) jump there.
42. Names with spaces and symbols show correctly and open correctly.
43. "Upload files..." copies a small file into the open folder; it then appears after the automatic refresh.
44. Drag a file from File Explorer onto the page: it uploads. Also try dragging a whole folder.
45. "Upload folder..." copies a folder with its contents.
46. Download on a file asks where to save it, then the file appears there with the right contents.
47. Download on a folder copies the folder and everything in it.
48. "New folder..." creates a folder (also try a name with a space and an apostrophe).
49. Delete asks Yes/No; Yes removes it. Storage itself and the Android folder cannot be deleted.
50. A big file (500 MB or more) copies without freezing the app (the window shows "Copying 1 of 1...").
51. Opening a protected folder (type nothing; click a link or go "Up" to "/") shows a plain message, not a crash.
52. On a Mac, repeat 39-51.
