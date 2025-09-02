/*
Copyright 2025 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
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

  it('should return Spanish defaults', () => {
    const defaults = getBagDefaults('es', 100)
    expect(defaults).not.toBeNull()
    expect(defaults!.letterCounts.get('A')).toBe(12)
    expect(defaults!.letterValues.get('A')).toBe(1)
  })

  it('should scale letter counts deterministically', () => {
    const defaults = getBagDefaults('en', 50)
    expect(defaults).not.toBeNull()
    const totalTiles = [...defaults!.letterCounts.values()].reduce((a, b) => a + b, 0)
    expect(totalTiles).toBe(50)
    // These values are calculated based on the deterministic algorithm
    expect(defaults!.letterCounts.get('')).toBe(1)
    expect(defaults!.letterCounts.get('A')).toBe(4)
    expect(defaults!.letterCounts.get('E')).toBe(6)
  })

  it('should scale letter counts up deterministically', () => {
    const defaults = getBagDefaults('en', 200)
    expect(defaults).not.toBeNull()
    const totalTiles = [...defaults!.letterCounts.values()].reduce((a, b) => a + b, 0)
    expect(totalTiles).toBe(200)
    // These values are calculated based on the deterministic algorithm
    expect(defaults!.letterCounts.get('')).toBe(4)
    expect(defaults!.letterCounts.get('A')).toBe(18)
    expect(defaults!.letterCounts.get('E')).toBe(24)
  })

  it('should handle zero tile count', () => {
    const defaults = getBagDefaults('en', 0)
    expect(defaults).not.toBeNull()
    const totalTiles = [...defaults!.letterCounts.values()].reduce((a, b) => a + b, 0)
    expect(totalTiles).toBe(0)
  })
})
