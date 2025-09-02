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
import { Tile, makeTiles } from './tile.js'

describe('tile', () => {
  it('should recognize a non-blank tile', () => {
    expect(new Tile({letter: 'A', value: 1}).isBlank).toBe(false)
  })
  it('should recognize a blank tile', () => {
    expect(new Tile({letter: '', value: 0}).isBlank).toBe(true)
  })
  describe('json', () => {
    it('should serialize', () => {
      expect(JSON.parse(JSON.stringify(new Tile({letter: 'B', value: 3})))).toEqual('B:3')
    })
    it('should deserialize', () => {
      expect(Tile.fromJSON('D:2')).toEqual(new Tile({letter: 'D', value: 2}))
    })
    it('should reject an invalid object', () => {
      expect(() => Tile.fromJSON({B:3})).toThrow(TypeError)
    })
    it('should reject a non-numeric value', () => {
      expect(() => Tile.fromJSON('A:x')).toThrow(TypeError)
    })
    it('should reject an invalid string', () => {
      expect(() => Tile.fromJSON('B3')).toThrow(TypeError)
    })
  })

  describe('makeTile', () => {
    it('should work with Maps', () => {
      const letterCounts = new Map([['C', 1], ['D', 2]])
      const letterValues = new Map([['D', 3], ['C', 4]])
      expect(makeTiles({letterCounts, letterValues})).toEqual(expect.arrayContaining([
        new Tile({letter: 'C', value: 4}),
        new Tile({letter: 'D', value: 3}),
        new Tile({letter: 'D', value: 3}),
      ]))
    })

    it('should default to value 0', () => {
      const letterCounts = new Map([['X', 1], ['D', 1]])
      const letterValues = new Map([['D', 3], ['C', 4]])
      expect(makeTiles({letterCounts, letterValues})).toEqual(expect.arrayContaining([
        new Tile({letter: 'X', value: 0}),
        new Tile({letter: 'D', value: 3}),
      ]))
    })

    it('should support blank', () => {
      const letterCounts = new Map([['', 1], ['E', 1]])
      const letterValues = new Map([['E', 1]])
      expect(makeTiles({letterCounts, letterValues})).toEqual(expect.arrayContaining([
        new Tile({letter: '', value: 0}),
        new Tile({letter: 'E', value: 1}),
      ]))
    })
  })
})
