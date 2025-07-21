import { expect, describe, it } from "bun:test"
import type { Serializable } from './serializable.js'
import { HonorSystemBag } from './honor_system_bag.js'

class TestTile implements Serializable {
  constructor(public readonly num: number) {}
  toJSON() { return this.num }
  static fromJSON(json: any) { return new TestTile(json) }
}

function _tiles(...nums: Array<number>) {
  return nums.map(TestTile.fromJSON)
}

describe("honor system bag", () => {
  it("should shuffle", () => {
    const bag = new HonorSystemBag(_tiles(1, 2, 3, 5, 8), 1)
    expect(bag.toJSON()).toEqual({randomSeed: 0xb4ade7d5, tiles: [2, 3, 1, 5, 8]})
  })
  it("should draw 1", () => {
    const bag = new HonorSystemBag(_tiles(1, 2, 3, 5, 8), 1)
    expect(bag.draw(1)).toEqual(_tiles(8))
    expect(bag.toJSON()).toEqual({randomSeed: 0xb4ade7d5, tiles: [2, 3, 1, 5]})
  })
  it("should draw all", () => {
    const bag = new HonorSystemBag(_tiles(1, 2, 3, 5, 8), 1)
    expect(bag.draw(5)).toEqual(_tiles(2, 3, 1, 5, 8))
    expect(bag.toJSON()).toEqual({randomSeed: 0xb4ade7d5, tiles: []})
  })
  it("should not underflow in draw", () => {
    const bag = new HonorSystemBag(_tiles(1, 2, 3, 5, 8), 1)
    expect(() => bag.draw(6)).toThrow(RangeError)
    expect(bag.toJSON()).toEqual({randomSeed: 0xb4ade7d5, tiles: [2, 3, 1, 5, 8]})
  })
  it("should exchange 2", () => {
    const bag = new HonorSystemBag(_tiles(1, 2, 3, 5, 8), 1)
    expect(bag.exchange(_tiles(6, 7))).toEqual(_tiles(5, 8))
    expect(bag.toJSON()).toEqual({randomSeed: 0x8f04dbbf, tiles: [2, 6, 1, 3, 7]})
  })
  it("should exchange all", () => {
    const bag = new HonorSystemBag(_tiles(1, 2, 3, 5, 8), 1)
    expect(bag.exchange(_tiles(0, 4, 6, 7, 9))).toEqual(_tiles(2, 3, 1, 5, 8))
    expect(bag.toJSON()).toEqual({randomSeed: 0x695bcfa9, tiles: [4, 6, 7, 0, 9]})
  })
  it("should not underflow in exchange", () => {
    const bag = new HonorSystemBag(_tiles(1, 2, 3, 5, 8), 1)
    expect(() => bag.exchange(_tiles(1, 2, 3, 4, 5, 6))).toThrow(RangeError)
    expect(bag.toJSON()).toEqual({randomSeed: 0xb4ade7d5, tiles: [2, 3, 1, 5, 8]})
  })
  it("should support duplicates", () => {
    const bag = new HonorSystemBag(_tiles(3, 3, 3, 3), 99)
    expect(bag.exchange(_tiles(4, 4))).toEqual(_tiles(3, 3))
    expect(bag.toJSON()).toEqual({randomSeed: 0x21d9622c, tiles: [4, 3, 3, 4]})
  })
})
