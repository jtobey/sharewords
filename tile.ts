/** Immutable objects representing tiles with `letter` and `value` properties. Empty string as letter represents blank. */

import type { Serializable } from './serializable.js'

const MIN_TILE_VALUE = 0
const MAX_TILE_VALUE = 999999

export class Tile implements Serializable {
  readonly letter: string
  readonly value: number
  constructor({letter, value}: Readonly<{letter: string; value: number}>) {
    if (value !== Math.floor(value) || value < MIN_TILE_VALUE || value > MAX_TILE_VALUE) {
      throw new RangeError(`Invalid Tile value: ${value}`)
    }
    this.letter = letter
    this.value = value
  }
  get isBlank() { return this.letter === '' }
  equals(other: Tile) {
    return this.letter === other.letter && this.value === other.value
  }
  toString() {
    return JSON.stringify(this.toJSON())
  }
  toJSON() {
    return `${this.letter}:${this.value}`
  }
  static fromJSON(json: any): Tile {
    if (typeof json === 'string') {
      const match = json.match(/(.*):([0-9]+)$/s)
      if (match) {
        const letter = match[1] as string
        const value = parseInt(match[2] as string)
        return new Tile({letter, value})
      }
    }
    throw new TypeError(`invalid Tile serialization: ${JSON.stringify(json)}`)
  }
}

interface StringNumbers { [key: string]: number }

/**
 * @returns The given numbers of tiles with the given letters and values, all in one array.
 */
export function makeTiles({letterCounts, letterValues}: {
  letterCounts: StringNumbers | ReadonlyMap<string, number>
  letterValues: StringNumbers | ReadonlyMap<string, number>
}) {
  const tiles: Array<Tile> = []
  const countsEntries = (letterCounts instanceof Map ? letterCounts.entries() : Object.entries(letterCounts))
  if (!(letterValues instanceof Map)) letterValues = new Map(Object.entries(letterValues))
  for (const [letter, count] of countsEntries) {
    tiles.push(...Array(count).fill(new Tile({letter, value: letterValues.get(letter) || 0})))
  }
  return tiles
}
