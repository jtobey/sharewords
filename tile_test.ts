import { expect, describe, it } from "bun:test"
import { Tile } from './tile.js'

describe("tile", () => {
  it("should recognize a non-blank tile", () => {
    expect(new Tile({letter: "A", value: 1}).isBlank).toBe(false)
  })
  it("should recognize a blank tile", () => {
    expect(new Tile({letter: "", value: 0}).isBlank).toBe(true)
  })
  describe("json", () => {
    it("should serialize", () => {
      expect(new Tile({letter: "B", value: 3}).toJSON()).toEqual({letter: "B", value: 3})
    })
    it("should deserialize", () => {
      expect(Tile.fromJSON({letter: "D", value: 2})).toEqual(new Tile({letter: "D", value: 2}))
    })
    it("should reject an invalid object", () => {
      expect(() => Tile.fromJSON('frob')).toThrow(TypeError)
    })
    it("should reject a non-numeric value", () => {
      expect(() => Tile.fromJSON({letter: "A", value: 'x'})).toThrow(TypeError)
    })
    it("should reject a non-string letter", () => {
      expect(() => Tile.fromJSON({letter: 7, value: 2})).toThrow(TypeError)
    })
  })
})
