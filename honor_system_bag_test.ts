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
    const bag = new HonorSystemBag({tiles: _tiles(1, 2, 3, 5, 8), seed: 1})
    expect(bag.toJSON()).toEqual({randomSeed: 0xb4ade7d5, tiles: [2, 3, 1, 5, 8]})
  })
  it("should draw 1", async () => {
    const bag = new HonorSystemBag({tiles: _tiles(1, 2, 3, 5, 8), seed: 1})
    expect(await bag.draw(1)).toEqual(_tiles(8))
    expect(bag.toJSON()).toEqual({randomSeed: 0xb4ade7d5, tiles: [2, 3, 1, 5]})
  })
  it("should draw all", async () => {
    const bag = new HonorSystemBag({tiles: _tiles(1, 2, 3, 5, 8), seed: 1})
    expect(await bag.draw(5)).toEqual(_tiles(2, 3, 1, 5, 8))
    expect(bag.toJSON()).toEqual({randomSeed: 0xb4ade7d5, tiles: []})
  })
  it("should not underflow in draw", async () => {
    const bag = new HonorSystemBag({tiles: _tiles(1, 2, 3, 5, 8), seed: 1})
    expect(async () => await bag.draw(6)).toThrow(RangeError)
    expect(bag.toJSON()).toEqual({randomSeed: 0xb4ade7d5, tiles: [2, 3, 1, 5, 8]})
  })
  it("should exchange 2", async () => {
    const bag = new HonorSystemBag({tiles: _tiles(1, 2, 3, 5, 8), seed: 1})
    expect(await bag.exchange(_tiles(6, 7))).toEqual(_tiles(5, 8))
    expect(bag.toJSON()).toEqual({randomSeed: 0x8f04dbbf, tiles: [2, 6, 1, 3, 7]})
  })
  it("should exchange all", async () => {
    const bag = new HonorSystemBag({tiles: _tiles(1, 2, 3, 5, 8), seed: 1})
    expect(await bag.exchange(_tiles(0, 4, 6, 7, 9))).toEqual(_tiles(2, 3, 1, 5, 8))
    expect(bag.toJSON()).toEqual({randomSeed: 0x695bcfa9, tiles: [4, 6, 7, 0, 9]})
  })
  it("should not underflow in exchange", async () => {
    const bag = new HonorSystemBag({tiles: _tiles(1, 2, 3, 5, 8), seed: 1})
    expect(async () => await bag.exchange(_tiles(1, 2, 3, 4, 5, 6))).toThrow(RangeError)
    expect(bag.toJSON()).toEqual({randomSeed: 0xb4ade7d5, tiles: [2, 3, 1, 5, 8]})
  })
  it("should support duplicates", async () => {
    const bag = new HonorSystemBag({tiles: _tiles(3, 3, 3, 3), seed: 99})
    expect(await bag.exchange(_tiles(4, 4))).toEqual(_tiles(3, 3))
    expect(bag.toJSON()).toEqual({randomSeed: 0x21d9622c, tiles: [4, 3, 3, 4]})
  })
  it("should support empty bag", () => {
    const bag = new HonorSystemBag({tiles: _tiles(), seed: 12})
    expect(bag.toJSON()).toEqual({randomSeed: 12, tiles: []})
  })
  it("should reject negative seed", () => {
    expect(() => new HonorSystemBag({tiles: _tiles(), seed: -1})).toThrow(RangeError)
  })
  it("should reject huge seed", () => {
    expect(() => new HonorSystemBag({tiles: _tiles(), seed: 0x100000000})).toThrow(RangeError)
  })
  it("should reject fractional seed", () => {
    expect(() => new HonorSystemBag({tiles: _tiles(), seed: 1.5})).toThrow(RangeError)
  })
  describe("json", () => {
    it("should roundtrip", async () => {
      const bag = new HonorSystemBag({tiles: _tiles(1, 2, 3, 5, 8), seed: 1})
      const bag2 = HonorSystemBag.fromJSON(bag.toJSON(), TestTile.fromJSON)
      expect(bag2).toEqual(bag)
      expect(await bag2.draw(1)).toEqual(_tiles(8))
      expect(bag2).not.toEqual(bag)
    })
    it("should deserialize empty bag", () => {
      const bag = HonorSystemBag.fromJSON({randomSeed: 7, tiles: []}, TestTile.fromJSON)
      expect(bag.toJSON()).toEqual({randomSeed: 7, tiles: []})
    })
    it("should reject invalid object", () => {
      expect(() => HonorSystemBag.fromJSON('frob', TestTile.fromJSON)).toThrow(TypeError)
    })
    it("should reject non-numeric seed", () => {
      expect(() => HonorSystemBag.fromJSON({randomSeed: 'x', tiles: []}, TestTile.fromJSON)).toThrow(TypeError)
    })
    it("should reject non-array tiles", () => {
      expect(() => HonorSystemBag.fromJSON({randomSeed: 123, tiles: null}, TestTile.fromJSON)).toThrow(TypeError)
    })
  })
})
