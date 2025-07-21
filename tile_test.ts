import { expect, describe, it } from "bun:test"
import { Tile } from './tile.js'

describe("tile", () => {
  it("should recognize a non-blank tile", () => {
    expect(new Tile("A", 1).isBlank).toBe(false)
  })
  it("should recognize a blank tile", () => {
    expect(new Tile("", 0).isBlank).toBe(true)
  })
  it("should serialize", () => {
    expect(new Tile("B", 3).toJSON()).toEqual({letter: "B", value: 3})
  })
  it("should deserialize", () => {
    expect(Tile.fromJSON({letter: "D", value: 2})).toEqual(new Tile("D", 2))
  })
})
