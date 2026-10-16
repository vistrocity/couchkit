# Couchkit smoke test (about 10 minutes, on a real TV)

Before you start: `git pull`, `npm install`, `npm run dev`. Connect to your TV.
Tick each line. Note anything that looks wrong and send it to me.

1. **Connect** – TV shows as connected, device card shows model, RAM, storage.
2. **Remote** – D-pad, OK, Back, Home, volume work. Type a word in the text box.
3. **Apps** – list loads. Press *Open* then *Force stop* on one app. *Clear cache* on one app.
4. **Drag and drop** – drag a small .apk from a normal (non-admin) window onto Apps; a result appears. Try a file that is not an APK; it should say so.
5. **Files** – upload a small file (name with a space), then download it back and open it.
6. **Capture** – take a screenshot; "Show in folder" opens it.
7. **Tune-ups** – change animation speed; the 15-second undo banner appears. Press *Undo*. Do the same for text size.
8. **Cleanup** – read storage numbers, run *Trim caches*. Do NOT try Optimise or Clear data yet.
9. **Backup** – back up ONE small app, then restore it.
10. **Launcher** – press *Test: press Home on the TV*; result matches what the TV shows.
11. **Restart** – use the normal restart only (not recovery/bootloader).
12. **Console** – run `getprop ro.product.model`; press the up arrow to recall it.
13. **Activity** – off by default; turn it on, run a command, see it listed; turn off and clear.
14. **Error cases** – turn the TV off, press a Remote button: a clear message, no freeze. Connect to a wrong IP (e.g. 192.168.1.199): "cannot reach" within ~10 s.

Optional deeper: Optimise apps, Freeze apps, clock setting, screensaver chooser, Wake/Sleep.
