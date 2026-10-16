import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { ABOUT_LINKS } from '@shared/about'
import { platform } from './platform'

/**
 * Application menu, kept short on purpose. On Windows: File, View, Help. Developer items appear
 * only if the app is run from source with COUCHKIT_DEV=1. macOS gets the system menu bar
 * with the standard app menu; Windows gets an in-window menu.
 */
export function buildMenu(): Menu {
  const template: MenuItemConstructorOptions[] = []

  const dev = !app.isPackaged && process.env['COUCHKIT_DEV'] === '1'
  const view: MenuItemConstructorOptions[] = [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }]
  if (dev) view.push({ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' })

  const help: MenuItemConstructorOptions = {
    role: 'help',
    submenu: ABOUT_LINKS.filter((l) => l.id === 'github' || l.id === 'issues' || l.id === 'support').map((l) => ({
      label: l.label,
      click: (): void => void shell.openExternal(l.url)
    }))
  }

  if (platform.isMac) {
    // macOS needs its Edit menu for copy and paste to work in text boxes.
    template.push({ role: 'appMenu' }, { role: 'editMenu' })
  } else {
    template.push({ label: 'File', submenu: [{ role: 'quit' }] })
  }
  template.push({ label: 'View', submenu: view })
  if (platform.isMac) template.push({ role: 'windowMenu' })
  template.push(help)

  return Menu.buildFromTemplate(template)
}
