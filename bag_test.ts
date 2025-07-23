import { expect, describe, it } from "bun:test"
import type { Serializable } from './serializable.js'
import { Bag, createBag } from './bag.js'
import { Mulberry32Prng } from './mulberry32_prng.js'

class TestTile implements Serializable {
  constructor(public readonly num: number) {}
  toJSON() { return this.num }
  static fromJSON(json: any) {
    if (typeof json !== 'number') throw new TypeError(`not a number: ${json}`)
    return new TestTile(json)
  }
}

function _tiles(...nums: Array<number>) {
  return nums.map(TestTile.fromJSON)
}

function _prng(seed=1) {
  return {randomGenerator: new Mulberry32Prng({randomSeed: seed})}
}

function _constructors() {
  return {constructors: {tile: TestTile.fromJSON, randomGenerator: Mulberry32Prng.fromJSON}}
}

describe("bag", () => {
  it("should shuffle", () => {
    const bag = createBag({tiles: _tiles(1, 2, 3, 5, 8), ..._prng()})
    expect(bag.toJSON()).toEqual({prng: {seed: 0xb4ade7d5}, tiles: [2, 3, 1, 5, 8]})
  })
  it("should draw 1", () => {
    const bag = createBag({tiles: _tiles(1, 2, 3, 5, 8), ..._prng()})
    expect(bag.draw(1)).toEqual(_tiles(8))
    expect(bag.toJSON()).toEqual({prng: {seed: 0xb4ade7d5}, tiles: [2, 3, 1, 5]})
  })
  it("should draw all", () => {
    const bag = createBag({tiles: _tiles(1, 2, 3, 5, 8), ..._prng()})
    expect(bag.draw(5)).toEqual(_tiles(2, 3, 1, 5, 8))
    expect(bag.toJSON()).toEqual({prng: {seed: 0xb4ade7d5}, tiles: []})
  })
  it("should not underflow in draw", () => {
    const bag = createBag({tiles: _tiles(1, 2, 3, 5, 8), ..._prng()})
    expect(async () => bag.draw(6)).toThrow(RangeError)
    expect(bag.toJSON()).toEqual({prng: {seed: 0xb4ade7d5}, tiles: [2, 3, 1, 5, 8]})
  })
  it("should exchange 2", () => {
    const bag = createBag({tiles: _tiles(1, 2, 3, 5, 8), ..._prng()})
    expect(bag.exchange(_tiles(6, 7))).toEqual(_tiles(5, 8))
    expect(bag.toJSON()).toEqual({prng: {seed: 0x8f04dbbf}, tiles: [2, 6, 1, 3, 7]})
  })
  it("should exchange all", () => {
    const bag = createBag({tiles: _tiles(1, 2, 3, 5, 8), ..._prng()})
    expect(bag.exchange(_tiles(0, 4, 6, 7, 9))).toEqual(_tiles(2, 3, 1, 5, 8))
    expect(bag.toJSON()).toEqual({prng: {seed: 0x695bcfa9}, tiles: [4, 6, 7, 0, 9]})
  })
  it("should not underflow in exchange", () => {
    const bag = createBag({tiles: _tiles(1, 2, 3, 5, 8), ..._prng()})
    expect(async () => bag.exchange(_tiles(1, 2, 3, 4, 5, 6))).toThrow(RangeError)
    expect(bag.toJSON()).toEqual({prng: {seed: 0xb4ade7d5}, tiles: [2, 3, 1, 5, 8]})
  })
  it("should support duplicates", () => {
    const bag = createBag({tiles: _tiles(3, 3, 3, 3), ..._prng(99)})
    expect(bag.exchange(_tiles(4, 4))).toEqual(_tiles(3, 3))
    expect(bag.toJSON()).toEqual({prng: {seed: 0x21d9622c}, tiles: [4, 3, 3, 4]})
  })
  it("should support an empty bag", () => {
    const bag = createBag({tiles: _tiles(), ..._prng(12)})
    expect(bag.toJSON()).toEqual({prng: {seed: 12}, tiles: []})
  })
  describe("json", () => {
    it("should roundtrip to and from JSON", () => {
      const bag = createBag({tiles: _tiles(1, 2, 3, 5, 8), ..._prng()})
      const bag2 = Bag.fromJsonAndConstructors({json: bag.toJSON(), ..._constructors()})
      expect(bag2).toEqual(bag)
      expect(bag2.draw(1)).toEqual(_tiles(8))
      expect(bag2).not.toEqual(bag)
    })
    it("should deserialize an empty bag", () => {
      const bag = Bag.fromJsonAndConstructors({json: {prng: {seed: 7}, tiles: []}, ..._constructors()})
      expect(bag.toJSON()).toEqual({prng: {seed: 7}, tiles: []})
    })
    it("should deserialize a non-empty bag", () => {
      const bag = Bag.fromJsonAndConstructors({json: {prng: {seed: 7}, tiles: [35]}, ..._constructors()})
      expect(bag.toJSON()).toEqual({prng: {seed: 7}, tiles: [35]})
    })
    it("should reject an invalid object", () => {
      expect(() => Bag.fromJsonAndConstructors({json: 'frob', ..._constructors()})).toThrow(TypeError)
    })
    it("should reject a non-numeric seed", () => {
      expect(() => Bag.fromJsonAndConstructors({json: {prng: {seed: 'x'}, tiles: []}, ..._constructors()})).toThrow(TypeError)
    })
    it("should reject a non-array tiles", () => {
      expect(() => Bag.fromJsonAndConstructors({json: {prng: {seed: 123}, tiles: null}, ..._constructors()})).toThrow(TypeError)
    })
    it("should reject an invalid tile", () => {
      expect(() => Bag.fromJsonAndConstructors({json: {prng: {seed: 7}, tiles: [null]}, ..._constructors()})).toThrow(TypeError)
    })
  })
})
