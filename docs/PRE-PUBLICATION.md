# Before making the repository public

Checked 17 October 2026.

## Name "Couchkit"
- No npm package called `couchkit` exists.
- Web searches found no app or company using "Couchkit". Near matches are unrelated (Couchbase, CouchDB helper libraries).
- Not checked (these sites cannot be searched automatically): the US trademark database (USPTO), India's trademark registry and the EU registry (EUIPO). Searching "Couchkit" there takes a few minutes and is the owner's call.
- A clean web search is not legal clearance. If the name matters commercially, ask a trademark attorney.

## Google's adb (platform-tools)
- Couchkit does not include adb. It downloads it from Google on the person's request, checks the file's checksum, and keeps it in Couchkit's own folder.
- Google's Android SDK licence restricts copying and redistributing the SDK and is not sublicensable. Because Couchkit never ships the files and the person downloads them themselves, this stays on the safe side, but the download card now tells the person that downloading means accepting Google's licence, with a link.
- Not legal advice. If Couchkit is ever sold or bundled with adb, get proper advice first.

## Repository contents
- No tokens, keys or passwords in the files or history (scanned).
- Git history authors are "Claude" and "Couchkit" with a no-reply address; no personal email addresses.
- LICENSE (Apache-2.0), NOTICE, TRADEMARKS.md, CONTRIBUTING.md and AUTHORS are in place.
- Nothing is copied from the original Windows tool.

## Known limits to say plainly in the README
- Installers are not code-signed (Mac needs Open Anyway; Windows shows a SmartScreen warning).
- Mirroring and "Pair with code" are not built yet.
