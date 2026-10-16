import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { ABOUT_LINKS } from '@shared/about'
import { platform } from './platform'

/**
 * Application menu, kept short on purpose. Developer items (Reload, Developer Tools) appear
 * only when running from source, never in the installed app. macOS gets the system menu bar
 * with the standard app menu; Windows gets an in-window menu.
 */
export function buildMenu(): Menu {
  const template: MenuItemConstructorOptions[] = []

  if (platform.isMac) {
    template.push({ role: 'appMenu' })
  } else {
    template.push({ label: 'File', submenu: [{ role: 'quit' }] })
  }

  const view: MenuItemConstructorOptions[] = [
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { type: 'separator' },
    { role: 'togglefullscreen' }
  ]
  if (!app.isPackaged) {
    view.push({ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' })
  }

  const helpLinks = ABOUT_LINKS.filter((l) => l.id === 'github' || l.id === 'issues')

  template.push(
    {
      label: 'Edit',
      submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }]
    },
    { label: 'View', submenu: view },
    {
      role: 'help',
      submenu: helpLinks.map((l) => ({ label: l.label, click: (): void => void shell.openExternal(l.url) }))
    }
  )

  return Menu.buildFromTemplate(template)
}
