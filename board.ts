import type { Serializable } from './serializable.js'
import { Tile } from './tile.js'

export class Square {
  readonly row: number
  readonly col: number
  readonly letterBonus: number
  readonly wordBonus: number
  tile?: Tile
  assignedLetter?: string
  constructor({row, col, letterBonus, wordBonus}: {
    row: number,
    col: number,
    letterBonus: number,
    wordBonus: number
  }) {
    this.row = row
    this.col = col
    this.letterBonus = letterBonus
    this.wordBonus = wordBonus
  }
}

const CHAR_TO_BONUS = new Map<string, [number, number]>([
  ['.', [1, 1]],
  ['d', [2, 1]],
  ['t', [3, 1]],
  ['D', [1, 2]],
  ['T', [1, 3]],
])

class InvalidBonusSquareLayout extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'InvalidBonusSquareLayout'
  }
}

function parseRowStrings(rowStrings: Array<string>): Array<Array<Square>> {
  const firstRowString = rowStrings[0]
  if (!firstRowString || !rowStrings.every(s => s.length === firstRowString.length)) {
    throw new InvalidBonusSquareLayout('Row strings do not form a rectangle.')
  }

  return rowStrings.map((rowString, row) => (
    rowString.split('').map((character, col) => {
      const bonus = CHAR_TO_BONUS.get(character)
      if (!bonus) throw new InvalidBonusSquareLayout(`Unrecognized square type: ${character}`)
      const [letterBonus, wordBonus] = bonus
      return new Square({row, col, letterBonus, wordBonus})
    })
  ))
}

export function generateRowStrings(squares: ReadonlyArray<ReadonlyArray<Square>>): Array<string> {
  return squares.map(row => (
    row.map(square => {
      const pair = [square.letterBonus, square.wordBonus]
      const entry = CHAR_TO_BONUS.entries().find(([char, bonus]) => bonus[0] === pair[0] && bonus[1] === pair[1])
      if (entry === undefined) throw new Error(`Unrecognized bonus multiplier pair: ${pair}`)
      return entry[0]
    }).join('')
  ))
}

export interface TileForPlacement {
  row: number
  col: number
  tile: Tile
  assignedLetter?: string  // For when `tile` is a blank.
}

class WordPlacementError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'WordPlacementError'
  }
}

export class Board implements Serializable {
  readonly squares: ReadonlyArray<ReadonlyArray<Square>>
  constructor(...rowStrings: Array<string>) {
    this.squares = parseRowStrings(rowStrings)
  }

  /**
   * @param newTiles - A list of tiles to play this turn, their locations, and
   *        any blank-tile letter assigments.
   * @returns An object containing the `score` for the turn (excluding any seven-tile bonus)
   *          and an array `wordsFormed` of words to check in the dictionary.
   * @throws {WordPlacementError} Will throw if called with an empty list of tiles.
   * @throws {WordPlacementError} Will throw if attempting to place a tile on an occupied square.
   * @throws {WordPlacementError} Will throw if the new tiles are not placed in a straight, unbroken line.
   * @throws {WordPlacementError} Will throw if no new tile is placed either on the center square
   *         or adjacent to a tile played previously.
   * @throws {WordPlacementError} Will throw if only a single tiles is placed, not adjacent to any
   *         other, even if on the center square.
   */
  checkWordPlacement(...newTiles: Array<TileForPlacement>): {
    wordsFormed: Array<string>,
    score: number,
  } {
    const anyNewTile = newTiles[0]
    if (!anyNewTile) throw new WordPlacementError('No tiles.')
    // Find the direction of a line along which all newTiles lie.
    // Order the tiles by their position along this line.
    const mainDir = {x: 0, y: 0}
    if (newTiles.every(tile => tile.row === anyNewTile.row)) {
      mainDir.x = 1  // Left to right.
      newTiles.sort((a, b) => a.col - b.col)
    } else if (newTiles.every(tile => tile.col === anyNewTile.col)) {
      mainDir.y = 1  // Top to bottom.
      newTiles.sort((a, b) => a.row - b.row)
    } else {
      throw new WordPlacementError('Tiles are not in a line.')
    }
    // Find the start of the new word along the direction chosen above.
    // Adjacent old tiles are part of the word.
    const firstNewTile = newTiles[0]
    if (!firstNewTile) throw new Error('Lost a tile.')
    let mainRow = firstNewTile.row, mainCol = firstNewTile.col
    while (this.squares[mainRow-mainDir.y]?.[mainCol-mainDir.x]?.tile) {
      mainRow -= mainDir.y
      mainCol -= mainDir.x
    }
    let mainWord = '', crossWords: Array<string> = []
    let newTileIndex = 0
    let mainWordMultiplier = 1, mainWordScore = 0, crossWordsScore = 0
    while (true) {
      const mainSquare = this.squares[mainRow]?.[mainCol]
      if (!mainSquare) break
      let mainLetter: string, mainValue: number, wordMultiplier: number
      const newTile = newTiles[newTileIndex]
      if (newTile && newTile.row === mainRow && newTile.col === mainCol) {
        if (mainSquare.tile) {
          throw new WordPlacementError(`Square ${mainRow},${mainCol} is occupied.`)
        }
        newTileIndex += 1
        mainLetter = newTile.assignedLetter || newTile.tile.letter
        mainValue = mainSquare.letterBonus * newTile.tile.value
        wordMultiplier = mainSquare.wordBonus
        mainWordMultiplier *= wordMultiplier
      } else if (mainSquare.tile) {
        mainLetter = mainSquare.assignedLetter || mainSquare.tile.letter
        mainValue = mainSquare.tile.value
        wordMultiplier = 1
      } else {
        break
      }
      mainWord += mainLetter
      mainWordScore += mainValue
      // Find the start of the word that crosses this square, if any.
      const crossDir = {x: mainDir.y, y: mainDir.x}  // Flip along the main diagonal.
      let crossRow = mainRow, crossCol = mainCol
      while (this.squares[crossRow-crossDir.y]?.[crossCol-crossDir.x]?.tile) {
        crossRow -= crossDir.y
        crossCol -= crossDir.x
      }
      // Find the cross word letters and score contribution.
      // If the cross "word" turns out to have only one letter, we won't count it.
      let crossWord = '', crossWordScore = 0
      while (true) {
        const crossSquare = this.squares[crossRow]?.[crossCol]
        if (crossRow === mainRow && crossCol === mainCol) {
          crossWord += mainLetter
          crossWordScore += mainValue
        } else if (crossSquare?.tile) {
          crossWord += crossSquare.assignedLetter || crossSquare.tile.letter
          crossWordScore += crossSquare.tile.value
        } else {
          break
        }
        crossRow += crossDir.y
        crossCol += crossDir.x
      }
      if (crossWord.length > 1) {
        crossWords.push(crossWord)
        crossWordsScore += crossWordScore * wordMultiplier
      }
      mainRow += mainDir.y
      mainCol += mainDir.x
    }
    if (newTileIndex < newTiles.length) {
      throw new WordPlacementError('Tiles form a line with gaps between them.')
    }
    if (mainWord.length === 1) {
      throw new WordPlacementError('No single-letter words accepted.')
    }
    if (!crossWords.length && mainWord.length === newTiles.length) {
      const centerRow = this.squares.length >> 1
      const centerCol = (this.squares[0]?.length || 0) >> 1
      if (!newTiles.some(tile => tile.row === centerRow && tile.col === centerCol)) {
        throw new WordPlacementError('Tiles must connect to existing words or cover the center square.')
      }
    }
    mainWordScore *= mainWordMultiplier
    return {
      wordsFormed: [mainWord, ...crossWords],
      score: mainWordScore + crossWordsScore,
    }
  }

  placeTiles(...tiles: Array<TileForPlacement>): void {
    for (const tile of tiles) {
      const square = this.squares[tile.row]?.[tile.col]
      if (!square) throw new Error(`Invalid board coordinates: ${tile.row},${tile.col}.`)
      if (square.tile) throw new Error(`Square ${tile.row}, ${tile.col} is occupied.`)
    }
    for (const tile of tiles) {
      const square = this.squares[tile.row]?.[tile.col]
      if (square) {
        square.tile = tile.tile
        square.assignedLetter = tile.assignedLetter
      }
    }
  }

  toJSON() {
    const rows = generateRowStrings(this.squares)
    const tiles = this.squares.map((row, rowNumber) => {
      row.map((square, colNumber) => {
        if (square.tile) {
          const result: Array<any> = [square.row, square.col, square.tile.toJSON()]
          if (square.assignedLetter) result.push(square.assignedLetter)
          return [result]
        }
        return []
      }).flat()
    }).flat()
    return {rows, tiles}
  }

  static fromJSON(json: any) {
    function bomb(): never {
      throw new TypeError(`invalid Board serialization: ${JSON.stringify(json)}`)
    }
    if (!(typeof json === 'object'
      && Object.keys(json).length === 2
      && Array.isArray(json.rows)
      && json.rows.every((row: any) => typeof row === 'string')
      && Array.isArray(json.tiles))) {
        bomb()
      }
    try {
      const board = new Board(...json.rows)
      for (const tile of json.tiles) {
        if (!Array.isArray(tile)) bomb()
        if (tile.length > 4) bomb()
        const [row, col, tileJson, assignedLetter] = tile
        if (!(typeof row === 'number')) bomb()
        if (!(typeof col === 'number')) bomb()
        const square = board.squares[row]?.[col]
        if (!square) bomb()
        square.tile = Tile.fromJSON(tileJson)
        if (assignedLetter) square.assignedLetter = assignedLetter
      }
      return board
    } catch (e: unknown) {
      if (e instanceof InvalidBonusSquareLayout) bomb()
      throw e
    }
  }
}
