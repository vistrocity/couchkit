import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  HistoryStore,
  MAX_NICKNAME,
  removeEntry,
  renameEntry,
  sanitize,
  upsertConnection
} from '../src/main/store/history'
import type { DeviceInfo } from '../src/shared/types'

const tv = (host: string, model?: string): DeviceInfo => ({
  serial: `${host}:5555`,
  host,
  port: 5555,
  ...(model !== undefined ? { model } : {})
})

describe('history list', () => {
  it('adds a TV using its model as the first nickname', () => {
    const list = upsertConnection([], tv('10.0.0.2', 'Chromecast'), 100)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: '10.0.0.2:5555', nickname: 'Chromecast', lastConnectedAt: 100 })
  })
  it('falls back to the address when there is no model', () => {
    expect(upsertConnection([], tv('10.0.0.2'), 1)[0]?.nickname).toBe('10.0.0.2')
  })
  it('keeps a nickname the user chose when the same TV connects again', () => {
    let list = upsertConnection([], tv('10.0.0.2', 'Chromecast'), 100)
    list = renameEntry(list, '10.0.0.2:5555', 'Living room')
    list = upsertConnection(list, tv('10.0.0.2', 'Chromecast'), 200)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ nickname: 'Living room', lastConnectedAt: 200 })
  })
  it('lists the most recent first', () => {
    let list = upsertConnection([], tv('10.0.0.2'), 100)
    list = upsertConnection(list, tv('10.0.0.3'), 200)
    expect(list.map((e) => e.host)).toEqual(['10.0.0.3', '10.0.0.2'])
  })
  it('ignores an empty nickname and shortens a long one', () => {
    const list = upsertConnection([], tv('10.0.0.2', 'A'), 1)
    expect(renameEntry(list, '10.0.0.2:5555', '   ')[0]?.nickname).toBe('A')
    expect(renameEntry(list, '10.0.0.2:5555', 'x'.repeat(100))[0]?.nickname).toHaveLength(MAX_NICKNAME)
  })
  it('removes an entry', () => {
    const list = upsertConnection([], tv('10.0.0.2'), 1)
    expect(removeEntry(list, '10.0.0.2:5555')).toEqual([])
  })
})

describe('sanitize', () => {
  it('drops malformed entries instead of crashing', () => {
    expect(sanitize('nonsense')).toEqual([])
    expect(sanitize([null, 5, { id: 1 }, { id: 'a:1', host: 'a', port: 1, nickname: 'n', lastConnectedAt: 1 }])).toHaveLength(1)
  })
})

describe('HistoryStore', () => {
  it('saves and loads, and survives a missing or damaged file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'couchkit-'))
    const path = join(dir, 'nested', 'history.json')
    const store = new HistoryStore(path)
    expect(await store.load()).toEqual([])

    const list = upsertConnection([], tv('10.0.0.2', 'Chromecast'), 5)
    await store.save(list)
    expect(await store.load()).toEqual(list)
    expect(JSON.parse(await readFile(path, 'utf8'))).toHaveLength(1)

    await writeFile(path, '{ not json', 'utf8')
    expect(await store.load()).toEqual([])
  })
})
