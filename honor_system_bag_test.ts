import { expect, describe, it } from "bun:test"
import { HonorSystemBag } from './honor_system_bag.ts'
import { Tile } from './tile.ts'

function _tiles(...nums: Array<number>) {
  return nums.map(num => new Tile({letter: 'A', value: num}))
}

function createHonorSystemBag({tiles, randomSeed}: any) {
  return new HonorSystemBag(tiles, randomSeed)
}

describe("honor system bag", () => {
  it("should support an empty bag", () => {
    const bag = createHonorSystemBag({tiles: [], randomSeed: 1})
    expect(bag.size).toEqual(0)
  })
  it("should shuffle", () => {
    const bag = createHonorSystemBag({tiles: _tiles(1, 2, 3, 5, 8), randomSeed: 0x456789ab})
    expect(bag.draw(bag.size)).toEqual(_tiles(5, 8, 1, 3, 2))
  })
  it("should draw 1", () => {
    const bag = createHonorSystemBag({tiles: _tiles(1, 2, 3, 5, 8), randomSeed: 1})
    expect(bag.draw(1)).toEqual(_tiles(8))
    expect(bag.draw(bag.size)).toEqual(_tiles(2, 3, 1, 5))
  })
  it("should draw all", () => {
    const bag = createHonorSystemBag({tiles: _tiles(1, 2, 3, 5, 8), randomSeed: 1})
    expect(bag.draw(5)).toEqual(_tiles(2, 3, 1, 5, 8))
    expect(bag.draw(bag.size)).toEqual(_tiles())
  })
  it("should not underflow in draw", () => {
    const bag = createHonorSystemBag({tiles: _tiles(1, 2, 3, 5, 8), randomSeed: 1})
    expect(() => bag.draw(6)).toThrow(RangeError)
    expect(bag.draw(bag.size)).toEqual(_tiles(2, 3, 1, 5, 8))
  })
  it("should exchange 2", () => {
    const bag = createHonorSystemBag({tiles: _tiles(1, 2, 3, 5, 8), randomSeed: 1})
    expect(bag.exchange(_tiles(6, 7))).toEqual(_tiles(5, 8))
    expect(bag.draw(bag.size)).toEqual(_tiles(1, 3, 6, 7, 2))
  })
  it("should exchange all", () => {
    const bag = createHonorSystemBag({tiles: _tiles(1, 2, 3, 5, 8), randomSeed: 222222222})
    expect(bag.exchange(_tiles(0, 4, 6, 7, 9))).toEqual(_tiles(2, 1, 5, 8, 3))
    expect(bag.draw(bag.size)).toEqual(_tiles(9, 4, 7, 6, 0))
  })
  it("should not underflow in exchange", () => {
    const bag = createHonorSystemBag({tiles: _tiles(1, 2, 3, 5, 8), randomSeed: 1})
    expect(() => bag.exchange(_tiles(1, 2, 3, 4, 5, 6))).toThrow(RangeError)
    expect(bag.draw(bag.size)).toEqual(_tiles(2, 3, 1, 5, 8))
  })
  it("should support duplicates", () => {
    const bag = createHonorSystemBag({tiles: _tiles(3, 3, 3, 3), randomSeed: 99})
    expect(bag.exchange(_tiles(4, 4))).toEqual(_tiles(3, 3))
    expect(bag.draw(bag.size)).toEqual(_tiles(4, 3, 4, 3))
  })
  describe("json", () => {
    it("should roundtrip to and from JSON", () => {
      const bag = createHonorSystemBag({tiles: _tiles(1, 2, 3, 5, 8), randomSeed: 1})
      const bagAsJson = JSON.parse(JSON.stringify(bag))
      const bagFromJson = HonorSystemBag.fromJSON(bagAsJson)
      expect(bagFromJson instanceof HonorSystemBag).toBe(true)
      expect(bagFromJson).toEqual(bag)
    })
    it("should deserialize an empty bag", () => {
      const bag = HonorSystemBag.fromJSON({tiles: [], prng: 7})
      expect(bag.toJSON()).toEqual({tiles: [], prng: 7})
    })
    it("should deserialize a non-empty bag", () => {
      const bag = HonorSystemBag.fromJSON({tiles: ['Q:10'], prng: 7})
      expect(bag.toJSON()).toEqual({tiles: ['Q:10'], prng: 7})
    })
    it("should reject an invalid object", () => {
      expect(() => HonorSystemBag.fromJSON('frob')).toThrow(TypeError)
    })
    it("should reject a non-numeric seed", () => {
      expect(() => HonorSystemBag.fromJSON({tiles: [], prng: 'x'})).toThrow(TypeError)
    })
    it("should reject a non-array tiles", () => {
      expect(() => HonorSystemBag.fromJSON({tiles: null, prng: 123})).toThrow(TypeError)
    })
    it("should reject an invalid tile", () => {
      expect(() => HonorSystemBag.fromJSON({tiles: [null], prng: 7})).toThrow(TypeError)
    })
  })
})
