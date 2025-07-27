import { expect, describe, it } from "bun:test"
import { Mulberry32Prng } from './mulberry32_prng.js'

describe('Mulberry32 PRNG', () => {
  it('should generate pseudorandom numbers', () => {
    const prng = new Mulberry32Prng(17777)
    expect(prng.random()).toEqual(0x3D838AC1 / 0x100000000)
    expect(prng.random()).toEqual(0xD510621D / 0x100000000)
    expect(prng.random()).toEqual(0xDC59BB95 / 0x100000000)
  })
  it("should reject a negative seed", () => {
    expect(() => new Mulberry32Prng(-1)).toThrow(RangeError)
  })
  it("should reject a huge seed", () => {
    expect(() => new Mulberry32Prng(0x100000000)).toThrow(RangeError)
  })
  it("should reject a fractional seed", () => {
    expect(() => new Mulberry32Prng(1.5)).toThrow(RangeError)
  })
  describe('json', () => {
    it("should roundtrip to and from JSON", () => {
      const prng = new Mulberry32Prng(12345)
      const prngAsJson = JSON.parse(JSON.stringify(prng))
      const prngFromJson = Mulberry32Prng.fromJSON(prngAsJson)
      expect(prngFromJson).toEqual(prng)
      const random = prng.random()
      expect(prngFromJson).not.toEqual(prng)
      expect(prngFromJson.random()).toEqual(random)
    })
    it('should serialize', () => {
      const prng = new Mulberry32Prng(3)
      expect(prng.toJSON()).toEqual(3)
    })
    it('should deserialize', () => {
      const prng = Mulberry32Prng.fromJSON(42)
      expect(prng.random()).toEqual(new Mulberry32Prng(42).random())
    })
    it("should reject a non-numeric seed", () => {
      expect(() => Mulberry32Prng.fromJSON('frob')).toThrow(TypeError)
    })
  })
})
