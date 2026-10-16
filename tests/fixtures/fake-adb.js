// A stand-in for adb used only by the tests. Behaviour is chosen with the FAKE_ADB_MODE
// environment variable, so no TV and no real adb are needed.
const args = process.argv.slice(2)
const mode = process.env.FAKE_ADB_MODE || 'ok'
const out = (text) => process.stdout.write(text + '\n')

if (args[0] === 'version') {
  out('Android Debug Bridge version 1.0.41\nVersion 35.0.2-fake')
} else if (args[0] === 'connect') {
  const fs = require('fs')
  let calls = 0
  if (process.env.FAKE_ADB_STATE) {
    try { calls = Number(fs.readFileSync(process.env.FAKE_ADB_STATE, 'utf8')) } catch {}
    fs.writeFileSync(process.env.FAKE_ADB_STATE, String(calls + 1))
  }
  if (mode === 'authfail') out(`failed to authenticate to ${args[1]}`)
  else if (mode === 'authfail-once' && calls === 0) out(`failed to authenticate to ${args[1]}`)
  else if (mode === 'refused') out(`failed to connect to '${args[1]}': Connection refused`)
  else if (mode === 'winrefused') out(`cannot connect to ${args[1]}: No connection could be made because the target machine actively refused it. (10061)`)
  else out(`connected to ${args[1]}`)
} else if (args[0] === 'devices') {
  const serial = process.env.FAKE_ADB_SERIAL || '192.168.0.105:5555'
  out('* daemon not running; starting now at tcp:5037\n* daemon started successfully\nList of devices attached')
  if (mode === 'unauthorized') out(`${serial}\tunauthorized`)
  else if (mode === 'offline') out(`${serial}\toffline`)
  else if (mode !== 'missing') out(`${serial}\tdevice product:x model:Chromecast device:y`)
} else if (args[0] === '-s' && args[2] === 'shell' && args[3] === 'getprop') {
  out('[ro.product.manufacturer]: [Google]\n[ro.product.model]: [Chromecast]\n[ro.build.version.release]: [12]\n[ro.build.version.sdk]: [31]\n[ro.build.display.id]: [STTE.220210.001]\n[ro.serialno]: [ABC123]\n[ro.empty]: []')
} else if (args[0] === '-s' && args[2] === 'shell' && args[3] === 'wm') {
  out('Physical size: 1920x1080')
} else if (args[0] === '-s' && args[2] === 'shell' && args[3] === 'ls') {
  const dir = args[5]
  if (/nope/.test(dir)) { process.stderr.write("ls: " + dir + ": No such file or directory\n"); process.exit(1) }
  if (/locked/.test(dir)) { process.stderr.write("ls: " + dir + ": Permission denied\n"); process.exit(1) }
  out('total 12\ndrwxrwx--x  4 root sdcard_rw 3452 2026-10-16 10:03 Android\ndrwxrwx---  2 u0_a1 media_rw 4096 2026-10-15 09:00 My Movies\n-rw-rw----  1 u0_a1 media_rw 1536000 2026-10-14 18:30 holiday video.mp4\nlrwxrwxrwx  1 root root 21 2026-01-01 00:00 link -> /storage/self/primary\n-rw-rw----  1 u0_a1 media_rw 12 2026-10-14 18:31 notes.txt')
} else if (args[0] === '-s' && args[2] === 'shell' && (args[3] === 'mkdir' || args[3] === 'rm')) {
  require('fs').appendFileSync(process.env.FAKE_ADB_LOG || require('os').devNull, args.slice(3).join(' ') + '\n')
  if (/exists/.test(args[4])) { process.stderr.write("mkdir: " + args[4] + ": File exists\n"); process.exit(1) }
} else if (args[0] === '-s' && args[2] === 'shell' && args[3] === 'screencap') {
  require('fs').appendFileSync(process.env.FAKE_ADB_LOG || require('os').devNull, 'screencap ' + args.slice(4).join(' ') + '\n')
} else if (args[0] === '-s' && args[2] === 'shell' && args[3] === 'screenrecord') {
  require('fs').appendFileSync(process.env.FAKE_ADB_LOG || require('os').devNull, 'screenrecord ' + args.slice(4).join(' ') + '\n')
  if (process.env.FAKE_ADB_RECFAIL) { process.stderr.write('ERROR: unable to configure encoder\n'); process.exit(1) }
  const stop = process.env.FAKE_ADB_STOPFILE
  const t = setInterval(() => { if (!stop || require('fs').existsSync(stop)) { clearInterval(t); process.exit(0) } }, 30)
} else if (args[0] === '-s' && args[2] === 'shell' && /^kill/.test(args[3] || '')) {
  if (process.env.FAKE_ADB_STOPFILE) require('fs').writeFileSync(process.env.FAKE_ADB_STOPFILE, 'stop')
} else if (args[0] === '-s' && (args[2] === 'pull' || args[2] === 'push')) {
  if (args[2] === 'pull' && /couchkit-shot/.test(args[3])) require('fs').writeFileSync(args[4], Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))
  if (args[2] === 'pull' && /^\/data\/app\//.test(args[3])) require('fs').writeFileSync(args[4], 'fake apk bytes')
  if (args[2] === 'pull' && /couchkit-rec/.test(args[3])) {
    if (process.env.FAKE_ADB_RECFAIL) { process.stderr.write("adb: error: failed to stat remote object '" + args[3] + "': No such file or directory\n"); process.exit(1) }
    require('fs').writeFileSync(args[4], 'fake mp4')
  }
  require('fs').appendFileSync(process.env.FAKE_ADB_LOG || require('os').devNull, args.slice(2).join(' ') + '\n')
  if (/toobig/.test(args.join(' '))) { process.stderr.write('adb: error: failed to copy: remote write failed: No space left on device\n'); process.exit(1) }
  out(args[2] === 'pull' ? args[3] + ': 1 file pulled, 0 skipped. 14.2 MB/s (1536000 bytes in 0.103s)' : args[3] + ': 1 file pushed, 0 skipped. 20.0 MB/s (10 bytes in 0.001s)')
} else if (args[0] === '-s' && args[2] === 'shell' && args[3] === 'input') {
  require('fs').appendFileSync(process.env.FAKE_ADB_LOG || require('os').devNull, args.slice(4).join(' ') + '\n')
} else if (args[0] === '-s' && args[2] === 'shell' && args[3] === 'pm' && args[4] === 'list') {
  const flag = args[6]
  if (flag === '-3') out('package:com.example.user')
  else if (flag === '-d') out('package:com.example.off')
  else out('package:com.example.user  installer=com.android.vending  versionCode:12\npackage:com.example.off  installer=null  versionCode:3\npackage:com.android.tv  installer=null  versionCode:30')
} else if (args[0] === '-s' && args[2] === 'shell' && /dumpsys package packages/.test(args[3] || '')) {
  out('  Package [com.example.user] (a1):\n    versionName=1.2.3\n  Package [com.android.tv] (b2):\n    versionName=9')
} else if (args[0] === '-s' && args[2] === 'shell' && args[3] === 'monkey') {
  require('fs').appendFileSync(process.env.FAKE_ADB_LOG || require('os').devNull, 'shell ' + args.slice(3).join(' ') + '\n')
  if (/com\.noscreen/.test(args[5])) out('** No activities found to run, monkey aborted.')
  else out('Events injected: 1\n## Network stats: elapsed time=5ms')
} else if (args[0] === '-s' && args[2] === 'shell' && args[3] === 'am' && args[4] === 'force-stop') {
  require('fs').appendFileSync(process.env.FAKE_ADB_LOG || require('os').devNull, 'shell ' + args.slice(3).join(' ') + '\n')
} else if (args[0] === '-s' && args[2] === 'shell' && args[3] === 'pm' && args[4] === 'path') {
  const pkg = args[5]
  if (/^com\.missing/.test(pkg)) { out('') }
  else {
    out('package:/data/app/~~abc==/' + pkg + '-xyz==/base.apk')
    if (/split/.test(pkg)) out('package:/data/app/~~abc==/' + pkg + '-xyz==/split_config.en.apk')
  }
} else if (args[0] === '-s' && args[2] === 'install-multiple') {
  require('fs').appendFileSync(process.env.FAKE_ADB_LOG || require('os').devNull, args.slice(2).join(' ') + '\n')
  out('Created parent session ID 1\nSuccess')
} else if (args[0] === '-s' && args[2] === 'shell' && args[3] === 'pm') {
  require('fs').appendFileSync(process.env.FAKE_ADB_LOG || require('os').devNull, 'shell ' + args.slice(3).join(' ') + '\n')
  if (process.env.FAKE_ADB_LAUNCHER && (args[4] === 'disable-user' || args[4] === 'enable')) {
    const fs = require('fs')
    const st = fs.existsSync(process.env.FAKE_ADB_LAUNCHER) ? JSON.parse(fs.readFileSync(process.env.FAKE_ADB_LAUNCHER, 'utf8')) : { default: 'com.google.android.tvlauncher/.MainActivity', disabled: [], idle: [], stopped: [] }
    const pkg = args[4] === 'disable-user' ? args[7] : args[5]
    st.disabled = st.disabled.filter((x) => x !== pkg)
    if (args[4] === 'disable-user') st.disabled.push(pkg)
    fs.writeFileSync(process.env.FAKE_ADB_LAUNCHER, JSON.stringify(st))
  }
  out(args[4] === 'disable-user' ? 'Package ' + args[7] + ' new state: disabled-user' : args[4] === 'enable' ? 'Package ' + args[5] + ' new state: enabled' : 'Success')
} else if (args[0] === '-s' && args[2] === 'install') {
  if (/bad/.test(args[4])) out('Performing Streamed Install\nadb: failed to install ' + args[4] + ': Failure [INSTALL_FAILED_VERSION_DOWNGRADE]')
  else out('Performing Streamed Install\nSuccess')
} else if (args[0] === '-s' && args[2] === 'uninstall') {
  out('Success')
} else if (args[0] === '-s' && args[2] === 'shell' && args.length === 4 && /^(echo '@@lh-|echo @@lh-pid)/.test(args[3])) {
  // Launcher emulator (state in FAKE_ADB_LAUNCHER: {default, disabled[], idle[], stopped[]}).
  const fs = require('fs')
  const file = process.env.FAKE_ADB_LAUNCHER
  const st = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { default: 'com.google.android.tvlauncher/.MainActivity', disabled: [], idle: [], stopped: [] }
  fs.appendFileSync(process.env.FAKE_ADB_LOG || require('os').devNull, 'shell ' + args[3] + '\n')
  const all = ['com.google.android.tvlauncher/.MainActivity', 'com.spocky.projengmenu/.ui.home.MainActivity', 'com.android.tv.settings/.MainSettings']
  const lines = []
  for (const part of args[3].split('; ')) {
    let m
    if ((m = /^echo '(.*)'$/.exec(part))) lines.push(m[1])
    else if ((m = /^echo @@lh-pid (\S+) \$\(pidof \S+\)$/.exec(part))) lines.push('@@lh-pid ' + m[1] + ' ' + (st.disabled.includes(m[1]) || st.stopped.includes(m[1]) ? '' : '4321'))
    else if (part === 'dumpsys activity activities | grep mHomeProcess') { const act = st.active || (st.default || '').split('/')[0]; if (act) lines.push('  mHomeProcess=ProcessRecord{1a2b3c 4321:' + act + '/u0a95}') }
    else if (/^cmd package query-activities/.test(part)) { for (const c of all) if (!st.disabled.includes(c.split('/')[0])) lines.push('priority=0 preferredOrder=0 match=0x108000 specificIndex=-1 isDefault=false', c) }
    else if (/^cmd package resolve-activity/.test(part)) lines.push('priority=0 preferredOrder=0 match=0x108000 specificIndex=-1 isDefault=true', st.default || 'android/com.android.internal.app.ResolverActivity')
    else if (part === 'dumpsys deviceidle whitelist') { lines.push('system-excidle,com.android.shell,2000'); for (const p of st.idle) lines.push('user,' + p + ',10123') }
    else if (part === 'pm list packages -d') { for (const p of st.disabled) lines.push('package:' + p) }
    else if (part === 'pm list packages -s') lines.push('package:com.google.android.tvlauncher', 'package:com.android.shell')
    else lines.push('Error: unknown command: ' + part)
  }
  out(lines.join('\n'))
} else if (args[0] === '-s' && args[2] === 'shell' && args.length === 4 && /^(cmd package set-home-activity|dumpsys deviceidle whitelist [+-]|cmd appops set)/.test(args[3])) {
  const fs = require('fs')
  const file = process.env.FAKE_ADB_LAUNCHER
  const st = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { default: 'com.google.android.tvlauncher/.MainActivity', disabled: [], idle: [], stopped: [] }
  fs.appendFileSync(process.env.FAKE_ADB_LOG || require('os').devNull, 'shell ' + args[3] + '\n')
  let m
  for (const part of args[3].split('; ')) {
    if ((m = /^cmd package set-home-activity '(.+)'$/.exec(part))) { if (!process.env.FAKE_ADB_LAUNCHER_REFUSE) st.default = m[1]; out('Success') }
    else if ((m = /^dumpsys deviceidle whitelist \+(\S+)$/.exec(part))) { if (!st.idle.includes(m[1])) st.idle.push(m[1]); out('Added: ' + m[1]) }
    else if ((m = /^dumpsys deviceidle whitelist -(\S+)$/.exec(part))) { st.idle = st.idle.filter((x) => x !== m[1]); out('Removed: ' + m[1]) }
  }
  if (file) fs.writeFileSync(file, JSON.stringify(st))
} else if (args[0] === '-s' && args[2] === 'shell' && args.length === 4 && /^echo '@@mem'/.test(args[3])) {
  out('@@mem\nMemTotal:        1950340 kB\n@@disk\nFilesystem     1K-blocks    Used Available Use% Mounted on\n/dev/block/dm-12  8000000 6000000 2000000  75% /data\n@@up\n275400.12 900000.00\n@@abi\narm64-v8a\n@@chip\nmt8696\nmt8696\n@@patch\n2022-05-05')
} else if (args[0] === '-s' && args[2] === 'reboot') {
  require('fs').appendFileSync(process.env.FAKE_ADB_LOG || require('os').devNull, 'reboot ' + args.slice(3).join(' ') + '\n')
} else if (args[0] === '-s' && args[2] === 'shell' && args.length === 4 && /^(df -k \/data|pm trim-caches)/.test(args[3])) {
  // Free space that grows after a cache trim (state in FAKE_ADB_DF, a JSON file).
  const fs = require('fs')
  const file = process.env.FAKE_ADB_DF
  const st = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { free: 2000000 }
  fs.appendFileSync(process.env.FAKE_ADB_LOG || require('os').devNull, 'shell ' + args[3] + '\n')
  if (/^pm trim-caches/.test(args[3])) { st.free += 300000; out('') }
  else out('Filesystem     1K-blocks    Used Available Use% Mounted on\n/dev/block/dm-12  8000000 ' + (8000000 - st.free) + ' ' + st.free + '  70% /data')
  if (file) fs.writeFileSync(file, JSON.stringify(st))
} else if (args[0] === '-s' && args[2] === 'shell' && args.length === 4 && /^cmd package query-services/.test(args[3])) {
  out('priority=0 preferredOrder=0 match=0x108000 specificIndex=-1 isDefault=false\ncom.android.deskclock/.Screensaver\npriority=0 preferredOrder=0 match=0x108000 specificIndex=-1 isDefault=false\ncom.neilturner.aerialviews/.service.DreamActivity')
} else if (args[0] === '-s' && args[2] === 'shell' && args.length === 4 && /^(settings |wm density|echo '@@)/.test(args[3])) {
  // A tiny stateful settings emulator for the Tune-ups tests (state in FAKE_ADB_SETTINGS, a JSON file).
  const fs = require('fs')
  const file = process.env.FAKE_ADB_SETTINGS
  const st = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { settings: {}, density: { physical: 320 } }
  fs.appendFileSync(process.env.FAKE_ADB_LOG || require('os').devNull, 'shell ' + args[3] + '\n')
  const lines = []
  for (const part of args[3].split('; ')) {
    let m
    if ((m = /^echo '(.*)'$/.exec(part))) lines.push(m[1])
    else if ((m = /^settings get (\w+) (\w+)$/.exec(part))) lines.push(st.settings[m[1] + '.' + m[2]] ?? 'null')
    else if ((m = /^settings put (\w+) (\w+) (.+)$/.exec(part))) st.settings[m[1] + '.' + m[2]] = m[3].replace(/^'|'$/g, '')
    else if ((m = /^settings delete (\w+) (\w+)$/.exec(part))) delete st.settings[m[1] + '.' + m[2]]
    else if (part === 'wm density') lines.push('Physical density: ' + st.density.physical + (st.density.override ? '\nOverride density: ' + st.density.override : ''))
    else if (part === 'wm density reset') delete st.density.override
    else if ((m = /^wm density (\d+)$/.exec(part))) st.density.override = Number(m[1])
    else lines.push('Error: unknown command: ' + part)
  }
  if (file) fs.writeFileSync(file, JSON.stringify(st))
  out(lines.join('\n'))
} else if (args[0] === '-s' && args[2] === 'shell' && args.length === 4) {
  const cmd = args[3]
  require('fs').appendFileSync(process.env.FAKE_ADB_LOG || require('os').devNull, 'shell ' + cmd + '\n')
  if (/^hang/.test(cmd)) setInterval(() => {}, 1000)
  else if (/^fail/.test(cmd)) { process.stderr.write('/system/bin/sh: fail: inaccessible or not found\n'); process.exit(127) }
  else if (/^huge/.test(cmd)) out('x'.repeat(300000))
  else out('ran: ' + cmd)
} else if (args[0] === 'disconnect') {
  out(`disconnected ${args[1]}`)
} else {
  process.stderr.write('unknown command: ' + args.join(' ') + '\n')
  process.exit(1)
}
