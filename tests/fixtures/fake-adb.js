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
} else if (args[0] === '-s' && args[2] === 'shell' && args[3] === 'input') {
  require('fs').appendFileSync(process.env.FAKE_ADB_LOG || require('os').devNull, args.slice(4).join(' ') + '\n')
} else if (args[0] === '-s' && args[2] === 'shell' && args[3] === 'pm' && args[4] === 'list') {
  const flag = args[6]
  if (flag === '-3') out('package:com.example.user')
  else if (flag === '-d') out('package:com.example.off')
  else out('package:com.example.user  installer=com.android.vending  versionCode:12\npackage:com.example.off  installer=null  versionCode:3\npackage:com.android.tv  installer=null  versionCode:30')
} else if (args[0] === '-s' && args[2] === 'shell' && /dumpsys/.test(args[3] || '')) {
  out('  Package [com.example.user] (a1):\n    versionName=1.2.3\n  Package [com.android.tv] (b2):\n    versionName=9')
} else if (args[0] === '-s' && args[2] === 'shell' && args[3] === 'pm') {
  out(args[4] === 'disable-user' ? 'Package ' + args[7] + ' new state: disabled-user' : args[4] === 'enable' ? 'Package ' + args[5] + ' new state: enabled' : 'Success')
} else if (args[0] === '-s' && args[2] === 'install') {
  if (/bad/.test(args[4])) out('Performing Streamed Install\nadb: failed to install ' + args[4] + ': Failure [INSTALL_FAILED_VERSION_DOWNGRADE]')
  else out('Performing Streamed Install\nSuccess')
} else if (args[0] === '-s' && args[2] === 'uninstall') {
  out('Success')
} else if (args[0] === 'disconnect') {
  out(`disconnected ${args[1]}`)
} else {
  process.stderr.write('unknown command: ' + args.join(' ') + '\n')
  process.exit(1)
}
