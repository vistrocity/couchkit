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

## Slice 4 (capture, and icons on Files) - test on a real TV

53. Files page: the buttons (Up, Refresh, Upload files, Upload folder, New folder, Download, Delete) show a small icon, and folders and files have icons in the list.
54. Capture page before connecting says "Connect to your TV first".
55. "Take screenshot" saves a PNG in Pictures > Couchkit and shows a preview; "Show in folder" opens it.
56. Screenshot while a normal app or the home screen is shown looks correct (not black).
57. Screenshot while a streaming app plays protected video: it may be black. That is expected, not a bug.
58. "Start recording" (720p) shows a red dot and a running timer; the TV keeps working normally.
59. "Stop and save" after about 10 seconds saves an MP4 in Videos > Couchkit; it plays on your computer with the right picture.
60. Try "TV's own resolution". The file is bigger but plays.
61. Let a recording run past 3 minutes: the page says "Stopped by the TV after 3:00" and "Save recording" still saves it.
62. If your TV does not allow recording, a plain message appears with technical details (send me the Activity log).
63. On a Mac, repeat 54-61 (the folders are Pictures/Couchkit and Movies/Couchkit).

## Slice 5 (console, and dark dropdowns) - test on a real TV

64. In dark mode, every dropdown list (Apps filter, Capture quality) shows readable text on every row.
65. Console page before connecting says "Connect to your TV first".
66. Click "Android version", "Battery and power", "Free storage": each prints real information from your TV.
67. "App on screen now" shows the app currently open on the TV (change app and run it again).
68. Type `getprop ro.product.model` and press Enter: the model name appears. "Copy" copies the output.
69. Type `rm -rf /sdcard/test` : it asks "Yes, run it / No" first. Press No: nothing runs.
70. "Restart the TV" asks first; do NOT press Yes unless you want to restart.
71. Type a command, click "Save as shortcut...", name it, and see it under "Yours". Restart Couchkit: it is still there. The x removes it.
72. Run `logcat` (it never ends): it stops after 30 seconds with a clear message.
73. "Open Settings" opens the Settings app on the TV.
74. On a Mac, repeat 65-73.

## Slice 6 (terminal look, Find my TV) - test on a real network

75. Console results show in a dark green terminal window with a title bar (couchkit@your-TV), a `$ command` line, a blinking cursor, and orange text for errors. It looks the same in light and dark mode.
76. Connect page: "Find my TV" searches for about 4 seconds, then lists your TV with its name (if it has one) and "ready to connect".
77. Click Connect on the found TV: it connects like typing the address.
78. If Windows shows a firewall question the first time, choose Allow (private networks), then search again.
79. With USB debugging turned OFF on the TV, the TV is listed with "debugging is off" and the steps to turn it on (or not listed at all, which is also acceptable).
80. With the computer on a different network than the TV (or Wi-Fi off) a plain message appears, not an error.
81. Other devices on your network (phones, speakers) are NOT listed unless they accept connections on port 5555.
82. On a Mac, allow "Local Network" access when macOS asks, then repeat 76-77.
83. Tune-ups: with no TV connected it says "Connect to your TV first." After connecting, four groups appear (Speed, Display, System, Network) and the current choice in each card is highlighted blue.
84. Animation speed: choose Fast, then Off. Open any menu on the TV; it moves faster or not at all. Choose Normal to put it back.
85. Text size: choose Large. A banner says "keep this change? Undoing in N s". Press Keep: it stays. Choose Extra large and do nothing: after 15 seconds the TV goes back to Large by itself.
86. Screen density: try Smaller (−20%). The TV picture shrinks; press Undo now to return it. "TV default" puts the TV's own value back.
87. Rotate the screen: choose 90° and let the 15 seconds run out; the picture returns to normal by itself. (If the TV ignores rotation, nothing changes, which is fine.)
88. Close Couchkit (or press Disconnect) while a change is waiting: the TV is put back first.
89. Screen-off timeout, screensaver, location, automatic time and Private DNS: choose each option and Refresh; the highlighted choice matches what you picked. Private DNS: pick AdGuard, check the TV still opens an app that needs internet, then choose Automatic to put it back.
90. If a setting is refused by the TV, a plain red message appears with the technical details folded below.
91. Tune-ups: "Animation speed" buttons show numbers (Off · 0, Fast · 0.5×, Normal · 1×, Slow · 1.5×).
92. "Date and time" is one block holding automatic time, the time server and "Set the clock yourself".
93. Turn automatic time Off, then press "Set TV clock to this computer": the TV clock and time zone match the computer (Settings > Date and time on the TV). While automatic time is On the button is greyed out. If your TV refuses, a plain message says so.
94. "Screen off and screen saver" is one block. Under "Screen saver app" every screen saver installed on the TV is listed (for example Aerial Views, if installed) with the current one highlighted. Choose another and check it on the TV (Settings > Device Preferences > Screen saver).
95. Cleanup page: Storage shows free space and a bar; Refresh updates it.
96. "Clear caches": says how much was freed (or that nothing extra was reported). Apps still keep their logins.
97. "Close background apps": a plain "Done" message appears.
98. Apps page: "Clear data" asks "Delete all of this app's data?" with Yes/No. After Yes, open that app on the TV: it starts like new (logged out). Try it on a harmless app first.
99. Apps page: "Clear data" on a protected system app (for example com.android.providers.settings, in the "all apps" filter) is refused with a plain message.
100. Apps page: each app has a "Clear cache" button. It says "Cache cleared." (or explains that this TV does not allow it). The app keeps its login.
101. Backup page: the list shows apps you installed. Tick the "only apps not from the Play Store" box to hide Play Store apps.
102. Tick one or two small apps and press "Back up". It says how many are done. "Show backup folder" opens a folder named Couchkit-backup-<date> (inside Documents > Couchkit > Backups) with one sub-folder per app holding its .apk file(s).
103. Uninstall one of those apps from the Apps page, then on Backup press "Choose backup folder…", pick the backup, tick the app and press "Restore". The app is back on the TV (it opens logged out, because only the app is saved, not its data).
104. Restoring an app that is already on the TV at the same version just reinstalls it; restoring an older version over a newer one says "A newer version of this app is already on the TV."
105. An app that cannot be saved (for example one that came with the TV) is listed with a plain reason.
106. Connect page: the Connected TV box now shows Memory (RAM) and Storage (free of total). "More details" folds out Processor, Running for, Security update, Serial number and Build. "Refresh details" re-reads them.
107. Activity page: it starts OFF with a short explanation. "Turn on the activity log" starts the list; "Clear" empties it; "Turn off" stops and empties it. The choice is remembered when you restart Couchkit.
108. Restart page: "Restart" asks Yes/No, then the TV restarts, the status bar says "Not connected", and you can reconnect from Connect once the TV is back (about a minute).
109. "Restart into recovery" and "Restart into bootloader" show a warning first. Only try recovery if you are ready to use the TV remote in its menu (choose the option that reboots normally to leave it). Many TVs do not support bootloader mode; skip it unless you know why you need it.
110. App ideas page: seven apps, each with "Open project page", which opens the project's own web page in your browser. Nothing is installed by Couchkit.
111. Restart page: "Restart into recovery" and "Restart into bootloader" now take three steps: press the button, read the warning and tick "I understand, and I have the TV remote in my hand" (Continue stays greyed until you tick), then a "Last check" with "Yes, restart into ..." or "No, go back". Cancel or No returns to the start without touching the TV.
112. Tune-ups > Speed: "Freeze cached apps" (TV default / On / Off). Restart the TV after changing. It may change nothing on your TV; that is expected.
113. Cleanup > "Optimise apps": asks Yes/No, then shows "Working…" with minutes so far. You can switch to other pages and come back. When finished it says "Apps were optimised." This can take 5-30+ minutes; keep the TV on. "Put apps back" returns the apps to the TV's own settings.
114. Launcher page (between Backup and Restart): lists every launcher on the TV with "Came with the TV" or "Installed by you", whether the Home button opens it, and whether it is running right now.
115. Install your launcher first (Apps page or App ideas), press Refresh, then "Make this the default" on it. Press Home on the TV remote: your launcher opens. (If the TV ignores it, a plain message says so.)
116. "Keep it running: On" on your launcher. Then use the TV normally for a while and press Home again: it should still be your launcher. Refresh shows "running now" or "not running now" so we can see whether it was closed.
117. "Turn off the stock launcher" is greyed until your own launcher is the default. After Yes, press Home: your launcher opens. If anything is wrong, "Turn back on" (same page) restores it. Check the TV settings screen and input switching still work.
118. Tune-ups > System > HDMI-CEC block: three On/Off switches (HDMI-CEC, turn TV on when a device starts, turn devices off with the TV). Try turning the TV on with a console, with the switch On and Off.
119. Apps page: "Open" launches the app on the TV; "Force stop" stops it. Force stop on a core system app (for example com.android.systemui in the all-apps list) is refused.
120. Launcher page: "com.android.tv.settings" and setup screens are no longer listed as launchers.
121. If your TV shows one launcher when you press Home but Android's list names another default, a note says so. The card of the launcher actually in charge says "Home button shows this now". Check this matches what you see on the TV.
122. Launcher page: "Test: press Home on the TV" presses Home on the TV and says which app opened (for example ca.dstudio.atvlauncher.pro). That launcher's card then says "Home button shows this now".
123. After a successful Home test (valid for 10 minutes), "Turn off the stock launcher" unlocks if your own launcher answered Home. Without a test, it stays greyed on TVs that do not report the running launcher.


## Look and Home (items 124-127)
124. Appearance page: Light, Dark and Match my computer all change the colours straight away.
125. Each accent colour changes buttons and highlights, in both light and dark.
126. Close and reopen the app: your theme and accent are remembered.
127. Home page: tiles jump to their pages; the links open the right web pages; the Help menu has two links; in the installed app the View menu has no Reload or Developer Tools.
128. Window and taskbar show the Couchkit icon (blue-green screen with a C).
129. When connected, a slim strip on every page shows the TV name, model, address, Android version, screen, RAM and free storage. A "Connected to ..." pop-up appears bottom-right for 4 seconds.
130. Problems (wrong IP, TV off) show the same orange card with "What to try" and a Copy details button.
131. Light theme: every page is readable with every accent colour.
132. Logo: the sidebar shows the Ck mark; the window/taskbar icon is the dark Ck tile; Home shows the TV-and-toolbox picture.
133. Permissions: pick an app, block then allow Camera; the status changes each time. A permission marked "Fixed by the TV" has no button.
134. Permissions: "Who can use... Camera" lists the apps you installed that have it; clicking one opens its permissions.
135. Permissions: a core system app (for example Settings, with "Include apps that came with the TV" ticked) cannot be changed.
136. Download adb on a computer that has none: afterwards the Home page says the file matched Google's checksum (or says it could not be checked).
