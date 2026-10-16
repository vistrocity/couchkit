import { describe, expect, it } from 'vitest'
import { explainFailure } from '../src/shared/explain'
import type { ErrorCategory } from '../src/shared/types'

describe('explainFailure', () => {
  const all: ErrorCategory[] = ['unreachable', 'unauthorized', 'offline', 'no_space', 'bad_apk', 'tool_missing', 'timeout', 'other']
  it.each(all)('has a message and a fix for %s', (category) => {
    const { message, fix } = explainFailure(category)
    expect(message.length).toBeGreaterThan(5)
    expect(fix.length).toBeGreaterThan(5)
  })
})
