/** Immutable objects representing tiles with `letter` and `value` properties. Empty string as letter represents blank. */

const MIN_TILE_VALUE = 0
const MAX_TILE_VALUE = 999999

export class Tile {
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

export type TilePlacementRow = number | 'rack' | 'exchange'

export function isBoardPlacementRow(row: TilePlacementRow): row is number {
  return typeof row === 'number'
}

// A Tile positioned on the rack, exchange pile, or game board.
export interface TilePlacement {
  row: TilePlacementRow
  col: number
  tile: Tile
  assignedLetter?: string  // For blank tiles on the board.
}

// A Tile positioned on the game board.
export type BoardPlacement = TilePlacement & { row: number }

export function isBoardPlacement(tilePlacement: TilePlacement): tilePlacement is BoardPlacement {
  return isBoardPlacementRow(tilePlacement.row)
}

/**
 * @returns The given numbers of tiles with the given letters and values, all in one array.
 */
export function makeTiles({letterCounts, letterValues}: {
  letterCounts: ReadonlyMap<string, number>
  letterValues: ReadonlyMap<string, number>
}) {
  const tiles: Array<Tile> = []
  for (const [letter, count] of letterCounts) {
    tiles.push(...Array(count).fill(new Tile({letter, value: letterValues.get(letter) || 0})))
  }
  return tiles
}
