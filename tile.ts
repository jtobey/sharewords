/** Immutable objects representing tiles with `letter` and `value` properties. Empty string as letter represents blank. */

import type { Serializable } from './serializable.js'

export class Tile implements Serializable {
  readonly letter: string
  readonly value: number
  constructor({letter, value}: Readonly<{letter: string; value: number}>) {
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
    const result = {}
    result[this.letter] = this.value
    return result
  }
  static fromJSON(json: any): Tile {
    if (typeof json === 'object') {
      const entries = Object.entries(json)
      if (entries.length === 1 &&
        typeof Array.isArray(entries[0]) &&
        typeof entries[0][0] === 'string' &&
        typeof entries[0][1] === 'number')
        {
          return new Tile({letter: entries[0][0], value: entries[0][1]})
        }
    }
    throw new TypeError(`invalid Tile serialization: ${JSON.serialize(json)}`)
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
