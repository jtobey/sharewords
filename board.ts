import { arraysEqual } from './validation.js'
import { Tile } from './tile.js'
import type { BoardPlacement } from './tile.js'

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
  get letter() {
    return this.assignedLetter || this.tile?.letter
  }
  get value() { return this.tile?.value }
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
    throw new InvalidBonusSquareLayout(`Row strings do not form a rectangle: ${rowStrings.join('\n')}.`)
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

class WordPlacementError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'WordPlacementError'
  }
}

export class Board {
  readonly squares: ReadonlyArray<ReadonlyArray<Square>>
  readonly scores = new Map<string, number>
  constructor(...rowStrings: Array<string>) {
    this.squares = parseRowStrings(rowStrings)
  }

  /**
   * @param placements - A list of tiles to play this turn, their locations, and
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
  checkWordPlacement(...placements: Array<BoardPlacement>): {
    wordsFormed: Array<string>,
    score: number,
    mainWord: string,
    row: number,
    col: number,
    vertical: boolean,
  } {
    const anyPlacement = placements[0]
    if (!anyPlacement) throw new WordPlacementError('No tiles.')
    for (const placement of placements) {
      if (placement.tile.isBlank && !placement.assignedLetter) {
        throw new WordPlacementError('Blank tiles must be assigned letters.')
      }
      if (!placement.tile.isBlank && placement.assignedLetter) {
        throw new WordPlacementError('Non-blank tiles cannot be assigned letters.')
      }
    }
    // Find the direction of a line along which all placements lie.
    // Order the tiles by their position along this line.
    const mainDir = {x: 0, y: 0}
    const tilesInOneRow = placements.every(tile => tile.row === anyPlacement.row)
    if (tilesInOneRow && (
      placements.length > 1 ||
        this.squares[anyPlacement.row]?.[anyPlacement.col - 1]?.tile ||
        this.squares[anyPlacement.row]?.[anyPlacement.col + 1]?.tile
    )) {
      mainDir.x = 1  // Left to right.
      placements.sort((a, b) => a.col - b.col)
    } else if (placements.every(tile => tile.col === anyPlacement.col)) {
      mainDir.y = 1  // Top to bottom.
      placements.sort((a, b) => a.row - b.row)
    } else {
      throw new WordPlacementError('Tiles are not in a line.')
    }
    const crossDir = {x: mainDir.y, y: mainDir.x}  // Flip along the main diagonal.

    // Find the start of the new word along the direction chosen above.
    // Adjacent old tiles are part of the word.
    const firstPlacement = placements[0]
    if (!firstPlacement) throw new Error('Lost a tile.')
    let mainRow = firstPlacement.row, mainCol = firstPlacement.col
    while (this.squares[mainRow-mainDir.y]?.[mainCol-mainDir.x]?.tile) {
      mainRow -= mainDir.y
      mainCol -= mainDir.x
    }
    const mainStartRow = mainRow
    const mainStartCol = mainCol
    let mainWord = '', crossWords: Array<string> = []
    let placementIndex = 0
    let mainWordMultiplier = 1, mainWordScore = 0, crossWordsScore = 0
    while (true) {
      const mainSquare = this.squares[mainRow]?.[mainCol]
      if (!mainSquare) break
      let mainLetter: string, mainValue: number, wordMultiplier: number
      const placement = placements[placementIndex]
      if (placement && placement.row === mainRow && placement.col === mainCol) {
        if (mainSquare.tile) {
          throw new WordPlacementError(`Square ${mainRow},${mainCol} is occupied.`)
        }
        placementIndex += 1
        mainLetter = placement.assignedLetter || placement.tile.letter
        mainValue = mainSquare.letterBonus * placement.tile.value
        wordMultiplier = mainSquare.wordBonus
        mainWordMultiplier *= wordMultiplier

        // Find the start of the word that crosses this square, if any.
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
            crossWord += crossSquare.letter
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
      } else if (mainSquare.tile) {
        // A previously played tile within the main word.
        mainLetter = mainSquare.assignedLetter || mainSquare.tile.letter
        mainValue = mainSquare.tile.value
        wordMultiplier = 1
      } else {
        break
      }
      mainWord += mainLetter
      mainWordScore += mainValue
      mainRow += mainDir.y
      mainCol += mainDir.x
    }
    if (placementIndex < placements.length) {
      throw new WordPlacementError('Tiles form a line with gaps between them.')
    }
    if (mainWord.length === 1) {
      throw new WordPlacementError('No single-letter words accepted.')
    }
    if (!crossWords.length && mainWord.length === placements.length) {
      const centerRow = this.squares.length >> 1
      const centerCol = (this.squares[0]?.length || 0) >> 1
      if (!placements.some(tile => tile.row === centerRow && tile.col === centerCol)) {
        throw new WordPlacementError('Tiles must connect to existing words or cover the center square.')
      }
    }
    mainWordScore *= mainWordMultiplier
    return {
      wordsFormed: [mainWord, ...crossWords],
      score: mainWordScore + crossWordsScore,
      mainWord,
      row: mainStartRow,
      col: mainStartCol,
      vertical: Boolean(mainDir.y),
    }
  }

  placeTiles(...tiles: Array<BoardPlacement>): void {
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
    const tiles: Array<any> = []
    this.squares.forEach(row => row.forEach(square => {
      if (square.tile) {
        const result: Array<any> = [square.row, square.col, square.tile.toJSON()]
        if (square.assignedLetter) result.push(square.assignedLetter)
        tiles.push(result)
      }
    }))
    const scores = [...this.scores.entries()]
    return {rows, tiles, scores}
  }

  static fromJSON(json: any) {
    function fail(msg: string): never {
      throw new TypeError(`${msg} in Board serialization: ${JSON.stringify(json)}`)
    }
    if (!(typeof json === 'object')) fail('Not an object')
    if (!arraysEqual([...Object.keys(json)], ['rows', 'tiles', 'scores'])) fail('Wrong keys or key order')
    if (!Array.isArray(json.rows)) fail('Rows are not an array')
    if (!json.rows.every((row: any) => typeof row === 'string')) fail('Row element is not a string')
    if (!Array.isArray(json.tiles)) fail('Tiles are not an array')
    if (!Array.isArray(json.scores)) fail('Scores are not an array')
    try {
      const board = new Board(...json.rows)
      for (const tile of json.tiles) {
        if (!Array.isArray(tile)) fail('Tile is not an array')
        if (tile.length > 4) fail('Wrong size array for tile')
        const [row, col, tileJson, assignedLetter] = tile
        if (!(typeof row === 'number')) fail('Tile row is not a number')
        if (!(typeof col === 'number')) fail('Tile col is not a number')
        const square = board.squares[row]?.[col]
        if (!square) fail('Tile coordinates are off the board')
        square.tile = Tile.fromJSON(tileJson)
        if (assignedLetter) square.assignedLetter = assignedLetter
      }
      for (const element of json.scores) {
        if (!Array.isArray(element)) fail('Score is not an array')
        if (element.length !== 2) fail('Wrong size array for score')
        const [playerId, score] = element
        if (!(typeof playerId === 'string')) fail('Player ID is not a string')
        if (!(typeof score === 'number')) fail('Score is not a number')
        if (board.scores.has(playerId)) fail('Duplicate Player ID in scores array')
        board.scores.set(playerId, score)
      }
      return board
    } catch (e: unknown) {
      if (e instanceof InvalidBonusSquareLayout) fail('Invalid board layout')
      throw e
    }
  }
}
