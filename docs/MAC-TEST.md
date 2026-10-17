# Couchkit on a Mac: test guide

Nothing here can harm the Mac or the TV. Takes about 20 minutes the first time.

## 1. Get it running

Open **Terminal** (press Cmd+Space, type Terminal, press Enter) and run these one at a time.

1. `node -v` - if it prints a number starting with 22 or higher, skip to step 3. If it says "command not found", install the **LTS** version from https://nodejs.org, then close and reopen Terminal.
2. `git --version` - if macOS offers to install "command line developer tools", accept; it takes a few minutes.
3. `mkdir -p ~/Documents/Couchkit` - makes the folder (harmless if it already exists).
4. `cd ~/Documents/Couchkit`
5. `git clone https://github.com/vistrocity/couchkit.git .` - note the dot at the end: it puts the files straight into `/Users/steverozario/Documents/Couchkit` instead of creating another folder inside it. If it says the folder is not empty, tell me what is in it (`ls -la`) and I'll adjust.
6. `npm install`
7. `npm run dev`

The Couchkit window opens. Leave Terminal open while you test; press Ctrl+C in it to stop.

Next time, to start it again: `cd ~/Documents/Couchkit` then `npm run dev`. To get my latest fixes first, run `git pull` and `npm install` before `npm run dev`.

Note: macOS may ask whether Terminal can access your Documents folder. Press **Allow**.

## 2. Mac-specific checks

Tick each one and tell me anything that looks wrong.

1. The menu bar at the top of the screen says **Couchkit** (File is not there; that is a Windows thing) and has Couchkit, Edit, View, Window and Help menus.
2. The Home page tip says **Cmd + K**, and pressing Cmd+K jumps to the Connect page address box.
3. The Dock shows the dark "Ck" icon.
4. Home -> adb: if adb is missing, press **Download adb**. Afterwards Home says the file matched Google's checksum.
5. Connect page -> **Find my TV**. macOS may ask to allow Couchkit to find devices on the local network: press **Allow**. If you pressed Don't Allow, enable it in System Settings -> Privacy & Security -> Local Network. The TV should be listed. Typing the address by hand (for example 192.168.1.190) must also work.
6. Connect to the TV and accept the prompt on the TV (tick "Always allow"). The strip at the top shows the TV details and a "Connected" pop-up appears bottom-right.
7. Remote: arrow keys, Enter, Esc (Back) control the TV. Type a word in the text box.
8. Apps: drag a small .apk from **Finder** onto the Apps page; it installs. Also try the **Choose files...** button.
9. Files: upload a file with a space and an accent in its name (for example "café menu.txt"), then download it back. Press **Show in folder**: Finder opens with the file selected.
10. Capture: take a screenshot; Show in folder opens Finder.
11. Tune-ups: change animation speed, see the 15-second Keep/Undo banner, press Undo.
12. Appearance: choose Dark, then "Match my computer", then switch macOS between Light and Dark in System Settings: Couchkit follows.
13. Close the window with the red button: Couchkit stays in the Dock (normal on Mac). Click the Dock icon: the window comes back. Quit with Cmd+Q.
14. Copy and paste (Cmd+C / Cmd+V) work in the Console box and the address box.
15. Window size: it opens large and nothing is cut off. Resize it smaller: the page scrolls instead of breaking.

## 3. Try the real installer (optional)

From `~/Documents/Couchkit`, `npm run dist` builds an installer in its `dist` folder (a .dmg and a .zip). It is **not signed**, so macOS blocks the first open:

- Drag Couchkit to Applications, then **right-click it -> Open -> Open**.
- If that is not offered (newer macOS): try to open it once, then go to System Settings -> Privacy & Security, scroll down and press **Open Anyway**.

This is expected until the app is signed with an Apple Developer account (US$99 a year, needed only for public release).

## 4. What to send me

For each failed item: its number, what you saw, and a screenshot if possible.
