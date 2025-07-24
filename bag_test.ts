import { expect, describe, it } from "bun:test"
import { createBag } from './bag.js'
import type { RandomGenerator } from './random_generator.js'
import { Tile } from './tile.ts'

function _tiles(...nums: Array<number>) {
  return nums.map(num => new Tile({letter: 'A', value: num}))
}

class TestPrng implements RandomGenerator {
  constructor(public seed: number) {}
  random() { return (this.seed = (this.seed + 61) % 100) / 100 }
  toJSON() { return this.seed }
  static fromJSON(json: any) { return new TestPrng(json) }
}
function _prng(seed=1) {
  return {randomGenerator: new TestPrng(seed)}
}

function _constructors() {
  return {constructors: {tile: Tile.fromJSON, randomGenerator: TestPrng.fromJSON}}
}

class MyExpect {
  constructor(public value: any) {}
  toEqualShuffled(array: any) {
    expect(this.value).toEqual(expect.arrayContaining(array))
    expect(this.value).not.toEqual(array)
  }
}
const _expect = (value: any) => new MyExpect(value)

describe("bag", () => {
  it("should know its size", () => {
    const bag = createBag({tiles: _tiles(1, 1, 2, 3, 5), ..._prng()})
    expect(bag.size).toEqual(5)
  })
  it("should shuffle", () => {
    const bag = createBag({tiles: _tiles(1, 1, 2, 3, 5, 8, 13, 21, 34, 55), ..._prng()})
    expect(bag.draw(bag.size)).toEqual(_tiles(5, 55, 2, 1, 34, 1, 3, 21, 8, 13))
  })
  it("should not shuffle", () => {
    const bag = createBag({tiles: _tiles(1, 1, 2, 3, 5, 8, 13, 21, 34, 55), ..._prng(), shuffle: false})
    expect(bag.draw(bag.size)).toEqual(_tiles(1, 1, 2, 3, 5, 8, 13, 21, 34, 55))
  })
  it("should draw 1", () => {
    const bag = createBag({tiles: _tiles(1, 1, 2, 3, 5), ..._prng()})
    const one = bag.draw(1)
    expect(one).toHaveLength(1)
    expect(bag.size).toEqual(4)
    const all = [...one, ...bag.draw(bag.size)]
    expect(bag.size).toEqual(0)
    _expect(all).toEqualShuffled(_tiles(1, 1, 2, 3, 5))
  })
  it("should not underflow in draw", () => {
    const randomGenerator = new TestPrng(33)
    const bag = createBag({tiles: _tiles(1, 1, 2, 3, 5), ..._prng()})
    expect(() => bag.draw(6)).toThrow(RangeError)
    expect(randomGenerator.seed).toEqual(33)
    expect(bag.size).toEqual(5)
  })
  it("should exchange 2", () => {
    const bag = createBag({tiles: _tiles(1, 1, 2, 3, 5), ..._prng(77)})
    expect(bag.exchange(_tiles(6, 7))).toEqual(expect.arrayContaining(_tiles(1, 5)))
    expect(bag.size).toEqual(5)
    _expect(bag.draw(5)).toEqualShuffled(_tiles(2, 3, 6, 1, 7))
  })
  it("should exchange all", () => {
    const bag = createBag({tiles: _tiles(1, 1, 2, 3, 5), ..._prng(44)})
    const replacements = bag.exchange(_tiles(0, 4, 6, 7, 9))
    expect(replacements).toHaveLength(5)
    _expect(replacements).toEqualShuffled(_tiles(1, 1, 2, 3, 5))
    _expect(bag.draw(bag.size)).toEqualShuffled(_tiles(0, 4, 6, 7, 9))
  })
  it("should not underflow in exchange", () => {
    const randomGenerator = new TestPrng(17)
    const bag = createBag({tiles: _tiles(1, 1, 2, 3, 5), randomGenerator})
    const seedBeforeFailedExchange = randomGenerator.seed
    expect(() => bag.exchange(_tiles(1, 2, 3, 4, 5, 6))).toThrow(RangeError)
    expect(randomGenerator.seed).toEqual(seedBeforeFailedExchange)
    expect(bag.size).toEqual(5)
  })
  it("should support an empty bag", () => {
    const bag = createBag({tiles: [], ..._prng()})
    expect(bag.size).toEqual(0)
  })
  describe("json", () => {
    it("should roundtrip to and from JSON", () => {
      const bag = createBag({tiles: _tiles(1, 1, 2, 3, 5), ..._prng()})
      const bagAsJson = JSON.parse(JSON.stringify(bag))
      const bagFromJson = createBag({json: bagAsJson, ..._constructors()})
      expect(bagFromJson).toEqual(bag)
    })
    it("should deserialize an empty bag", () => {
      const bag = createBag({json: {prng: 7, tiles: []}, ..._constructors()})
      expect(bag.toJSON()).toEqual({prng: 7, tiles: []})
    })
    it("should deserialize a non-empty bag", () => {
      const bag = createBag({json: {prng: {seed: 7}, tiles: _tiles(35)}, ..._constructors()})
      expect(bag.toJSON()).toEqual({prng: {seed: 7}, tiles: _tiles(35)})
    })
    it("should reject an invalid object", () => {
      expect(() => createBag({json: 'frob', ..._constructors()})).toThrow(TypeError)
    })
    it("should reject a non-array tiles", () => {
      expect(() => createBag({json: {prng: {seed: 123}, tiles: null}, ..._constructors()})).toThrow(TypeError)
    })
    it("should reject an invalid tile", () => {
      expect(() => createBag({json: {prng: {seed: 7}, tiles: [null]}, ..._constructors()})).toThrow(TypeError)
    })
  })
})
