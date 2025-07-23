import { expect, describe, it } from "bun:test"
import { HonorSystemBag } from './honor_system_bag.ts'
import { Tile } from './tile.ts'

function _tiles(...nums: Array<number>) {
  return nums.map(num => new Tile({letter: 'A', value: num}))
}

describe("honor system bag", () => {
  it("should support an empty bag", () => {
    const bag = HonorSystemBag.create({tiles: [], randomSeed: 1})
    expect(bag.size).toEqual(0)
  })
  it("should shuffle", () => {
    const bag = HonorSystemBag.create({tiles: _tiles(1, 2, 3, 5, 8), randomSeed: 1})
    expect(bag.toJSON()).toEqual({prng: {seed: 0xb4ade7d5}, tiles: _tiles(2, 3, 1, 5, 8)})
  })
  it("should draw 1", () => {
    const bag = HonorSystemBag.create({tiles: _tiles(1, 2, 3, 5, 8), randomSeed: 1})
    expect(bag.draw(1)).toEqual(_tiles(8))
    expect(bag.toJSON()).toEqual({prng: {seed: 0xb4ade7d5}, tiles: _tiles(2, 3, 1, 5)})
  })
  it("should draw all", () => {
    const bag = HonorSystemBag.create({tiles: _tiles(1, 2, 3, 5, 8), randomSeed: 1})
    expect(bag.draw(5)).toEqual(_tiles(2, 3, 1, 5, 8))
    expect(bag.toJSON()).toEqual({prng: {seed: 0xb4ade7d5}, tiles: _tiles()})
  })
  it("should not underflow in draw", () => {
    const bag = HonorSystemBag.create({tiles: _tiles(1, 2, 3, 5, 8), randomSeed: 1})
    expect(async () => bag.draw(6)).toThrow(RangeError)
    expect(bag.toJSON()).toEqual({prng: {seed: 0xb4ade7d5}, tiles: _tiles(2, 3, 1, 5, 8)})
  })
  it("should exchange 2", () => {
    const bag = HonorSystemBag.create({tiles: _tiles(1, 2, 3, 5, 8), randomSeed: 1})
    expect(bag.exchange(_tiles(6, 7))).toEqual(_tiles(5, 8))
    expect(bag.toJSON()).toEqual({prng: {seed: 0x8f04dbbf}, tiles: _tiles(2, 6, 1, 3, 7)})
  })
  it("should exchange all", () => {
    const bag = HonorSystemBag.create({tiles: _tiles(1, 2, 3, 5, 8), randomSeed: 1})
    expect(bag.exchange(_tiles(0, 4, 6, 7, 9))).toEqual(_tiles(2, 3, 1, 5, 8))
    expect(bag.toJSON()).toEqual({prng: {seed: 0x695bcfa9}, tiles: _tiles(4, 6, 7, 0, 9)})
  })
  it("should not underflow in exchange", () => {
    const bag = HonorSystemBag.create({tiles: _tiles(1, 2, 3, 5, 8), randomSeed: 1})
    expect(async () => bag.exchange(_tiles(1, 2, 3, 4, 5, 6))).toThrow(RangeError)
    expect(bag.toJSON()).toEqual({prng: {seed: 0xb4ade7d5}, tiles: _tiles(2, 3, 1, 5, 8)})
  })
  it("should support duplicates", () => {
    const bag = HonorSystemBag.create({tiles: _tiles(3, 3, 3, 3), randomSeed: 99})
    expect(bag.exchange(_tiles(4, 4))).toEqual(_tiles(3, 3))
    expect(bag.toJSON()).toEqual({prng: {seed: 0x21d9622c}, tiles: _tiles(4, 3, 3, 4)})
  })
  describe("json", () => {
    it("should roundtrip to and from JSON", () => {
      const bag = HonorSystemBag.create({tiles: _tiles(1, 2, 3, 5, 8), randomSeed: 1})
      const bag2 = HonorSystemBag.fromJSON(bag.toJSON())
      expect(bag2 instanceof HonorSystemBag).toBe(true)
      expect(bag2).toEqual(bag)
      expect(bag2.draw(1)).toEqual(_tiles(8))
      expect(bag2).not.toEqual(bag)
    })
    it("should deserialize an empty bag", () => {
      const bag = HonorSystemBag.fromJSON({prng: {seed: 7}, tiles: []})
      expect(bag.toJSON()).toEqual({prng: {seed: 7}, tiles: []})
    })
    it("should deserialize a non-empty bag", () => {
      const bag = HonorSystemBag.fromJSON({prng: {seed: 7}, tiles: [{letter: 'Q', value: 10}]})
      expect(bag.toJSON()).toEqual({prng: {seed: 7}, tiles: [{letter: 'Q', value: 10}]})
    })
    it("should reject an invalid object", () => {
      expect(() => HonorSystemBag.fromJSON('frob')).toThrow(TypeError)
    })
    it("should reject a non-numeric seed", () => {
      expect(() => HonorSystemBag.fromJSON({prng: {seed: 'x'}, tiles: []})).toThrow(TypeError)
    })
    it("should reject a non-array tiles", () => {
      expect(() => HonorSystemBag.fromJSON({prng: {seed: 123}, tiles: null})).toThrow(TypeError)
    })
    it("should reject an invalid tile", () => {
      expect(() => HonorSystemBag.fromJSON({prng: {seed: 7}, tiles: [null]})).toThrow(TypeError)
    })
  })
})
