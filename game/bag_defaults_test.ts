import { expect, describe, it } from 'bun:test'
import { getBagDefaults } from './bag_defaults.js'

describe('getBagDefaults', () => {
  it('should return null for unknown languages', () => {
    expect(getBagDefaults('xx')).toBeNull()
  })

  it('should return English defaults', () => {
    const defaults = getBagDefaults('en')
    expect(defaults).not.toBeNull()
    expect(defaults!.letterCounts.get('A')).toBe(9)
    expect(defaults!.letterValues.get('A')).toBe(1)
  })

  it('should scale letter counts', () => {
    const defaults = getBagDefaults('en', 50)
    expect(defaults).not.toBeNull()
    const totalTiles = [...defaults!.letterCounts.values()].reduce((a, b) => a + b, 0)
    expect(totalTiles).toBe(50)
  })

  it('should scale letter counts up', () => {
    const defaults = getBagDefaults('en', 200)
    expect(defaults).not.toBeNull()
    const totalTiles = [...defaults!.letterCounts.values()].reduce((a, b) => a + b, 0)
    expect(totalTiles).toBe(200)
  })

  it('should handle zero tile count', () => {
    const defaults = getBagDefaults('en', 0)
    expect(defaults).not.toBeNull()
    const totalTiles = [...defaults!.letterCounts.values()].reduce((a, b) => a + b, 0)
    expect(totalTiles).toBe(0)
  })
})
