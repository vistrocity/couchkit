import { Menu, type MenuItemConstructorOptions } from 'electron'
import { platform } from './platform'

/**
 * Application menu. macOS gets the system menu bar with the standard app menu;
 * Windows gets an in-window menu. Shortcuts use the right modifier on each system
 * automatically through Electron's CommandOrControl.
 */
export function buildMenu(): Menu {
  const template: MenuItemConstructorOptions[] = []

  if (platform.isMac) {
    template.push({ role: 'appMenu' })
  } else {
    template.push({
      label: 'File',
      submenu: [{ role: 'quit' }]
    })
  }

  template.push(
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  )

  return Menu.buildFromTemplate(template)
}
