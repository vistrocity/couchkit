/**
 * Paths on this computer that the person really chose (in a file dialog, or by dropping a file on the window).
 * Uploads and installs only accept these, so nothing else on the computer can be sent to the TV
 * even if the screen's code were ever tricked into asking.
 */
export class KnownPaths {
  private readonly paths = new Set<string>()

  constructor(private readonly capacity = 2000) {}

  add(path: unknown): void {
    if (typeof path !== 'string' || path === '' || path.length > 4096) return
    this.paths.add(path)
    if (this.paths.size > this.capacity) {
      const oldest = this.paths.values().next().value
      if (oldest !== undefined) this.paths.delete(oldest)
    }
  }

  addAll(paths: readonly string[]): void {
    for (const p of paths) this.add(p)
  }

  has(path: string): boolean {
    return this.paths.has(path)
  }
}
