import { Square, generateRowStrings, Board } from './board.ts'
import type { TilePlacement } from './tile.ts'
import { Tile } from './tile.ts'

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉'
const DIGITS = '0123456789' + SUBSCRIPTS
// const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

export class TestBoard extends Board {
  headers = {} as {[key: string]: string}
}

/**
 * Inflates a compact Square representation.
 * - '. ' => empty square
 * - '² ' => empty square with double-letter bonus
 * - '³ ' => empty square with triple-letter bonus
 * - '2 ' => empty square with double-word bonus
 * - '3 ' => empty square with triple-word bonus
 * - 'A₁' => tile with 'A' worth 1 point
 * - 'A₀' => blank tile assigned 'A' worth 0 points
 */
function parseSquare(squareStr: string, row: number, col: number) {
  if (squareStr.length === 1) squareStr += ' '
  if (squareStr.length !== 2) throw new Error(`Not length 2: "${squareStr}"`)
  let letterBonus = 1, wordBonus = 1
  let tile: Tile | undefined
  let assignedLetter: string | undefined

  const char0 = squareStr[0] as string
  const char1 = squareStr[1] as string
  const index = DIGITS.indexOf(char1 as string)
  if (index !== -1) {
    const value = index % 10
    const letter = char0
    if (value === 0) {
      tile = new Tile({letter: '', value})
      assignedLetter = letter
    } else {
      tile = new Tile({letter, value})
    }
  }
  else {
    if (char1 !== ' ') {
      throw new Error(`Invalid tile value in square: "${squareStr}"`)
    }
    else if (char0 === '²') letterBonus = 2
    else if (char0 === '³') letterBonus = 3
    else if (char0 === '2' || char0 === '₂') wordBonus = 2
    else if (char0 === '3' || char0 === '₃') wordBonus = 3
    else if (char0 !== '.') {
      throw new Error(`Unknown bonus type in square: "${squareStr}".`)
    }
  }

  const square = new Square({row, col, letterBonus, wordBonus})
  if (tile) square.tile = tile
  if (assignedLetter) square.assignedLetter = assignedLetter
  return square
}

const S = `
. .     . .     . .
. .     . .     . .
`

export function parseBoards(...strings: Array<string>) {
  strings = strings
    .join('\n')
    .replace(/^\n+|\s+$/sg, '')
    .replace(/\n\n\n+/g, '\n\n')
    .split('\n\n')
  return strings.map(parseRowOfBoards)
}

const SQUARE_PATTERN = /\S(?:.|$)/g
const SQUARE_ROW_PATTERN = /( +)((?:\S(?:.|$))+)/g

function getStartColumns(rowOfSquareRows: string) {
  const columns: Array<number> = []
  let col = 0, match
  while ((match = SQUARE_ROW_PATTERN.exec(rowOfSquareRows)) !== null) {
    col += (match[1] as string).length
    columns.push(col)
    col += (match[2] as string).length
  }
  return columns
}

function parseRowOfBoards(rowOfBoardsStr: string) {
  const lines = rowOfBoardsStr.split('\n')
  const header_lines = [] as Array<string>
  const board_lines = [] as Array<string>
  let line1 = ''
  for (const line of lines) {
    if (board_lines.length) {
      board_lines.push(line)
    } else if (line.includes(':')) {
      header_lines.push(line)
    } else {
      line1 = line
      board_lines.push(line)
    }
  }
  if (!line1) throw new Error;
  const startColumns = getStartColumns(line1)
  const startColumnsComma = `${startColumns},`
  if (!board_lines.every(line => startColumnsComma.startsWith(`${getStartColumns(line)},`))) {
    throw new Error(`Inconsistent spacing:\n${board_lines.join('\n')}\n`)
  }
  const boardStrings = new Map(startColumns.map(startColumn => [
    startColumn,
    {
      headers: {} as {[key: string]: string},
      body: [] as Array<string>,
    }
  ]))
  board_lines.forEach(line => {
    startColumns.forEach(startColumn => {
      if (startColumn < line.length) {
        const match = SQUARE_ROW_PATTERN.exec(line)
        if (!match) throw new Error
        boardStrings.get(startColumn)?.body.push(match[2] as string)
      }
    })
    if (SQUARE_ROW_PATTERN.exec(line)) throw new Error
  })
  header_lines.forEach(line => {
    startColumns.forEach((startColumn, index) => {
      let header
      const endColumn = startColumns[index + 1]
      if (endColumn) {
        header = line.substr(startColumn, endColumn - startColumn)
      } else {
        header = line.substr(startColumn)
      }
      header = header.trim()
      if (header) {
        const colon = header.indexOf(':')
        if (colon === -1) {
          throw new Error(`Invalid TestBoard header: ${header}`)
        }
        const headers = boardStrings.get(startColumn)?.headers
        if (headers) {
          const header_name = header.substr(0, colon)
          const header_value = header.substr(colon + 1).trim()
          if (header_name in headers) headers[header_name] += '\n' + header_value
          else headers[header_name] = header_value
        }
      }
    })
  })
  return [...boardStrings.values().map(parseBoard)]
}

function parseBoard({headers, body}: {headers: {[key: string]: string}, body: Array<string>}) {
  const squares = body.map(parseRowOfSquares)
  const board = new TestBoard(...generateRowStrings(squares))
  squares.map((row, rowNumber) => {
    row.map((square, colNumber) => {
      const boardSquare = board.squares[rowNumber]?.[colNumber] as Square
      if (square.tile) boardSquare.tile = square.tile
      if (square.assignedLetter) boardSquare.assignedLetter = square.assignedLetter
    })
  })
  board.headers = headers
  return board
}

function parseRowOfSquares(rowOfSquaresStr: string, row: number) {
  const squares: Array<Square> = []
  let match
  while ((match = SQUARE_PATTERN.exec(rowOfSquaresStr)) !== null) {
    squares.push(parseSquare(match[0], row, squares.length))
  }
  return squares
}

export function diffBoards(a: Board, b: Board): Array<TilePlacement> {
  if (a.squares.length !== b.squares.length) throw new Error(`Mismatched board heights.`)
  if (a.squares[0]?.length !== b.squares[0]?.length) throw new Error(`Mismatched board widths.`)
  const result = [] as Array<TilePlacement>
  a.squares.forEach((rowOfSquares, row) => {
    rowOfSquares.forEach((square, col) => {
      const diff = diffSquares(square, b.squares[row]?.[col] as Square)
      if (diff) result.push(diff)
    })
  })
  return result
}

function diffSquares(a: Square, b: Square): TilePlacement | null {
  if (a.tile && b.tile) {
    if (
      a.tile.letter !== b.tile.letter ||
        a.tile.value !== b.tile.value ||
        a.assignedLetter !== b.assignedLetter
    ) {
      throw new Error(`diffBoards: tile or assignment difference at ${a.row},${a.col}`)
    }
    return null
  }
  if (a.tile) throw new Error(`diffBoards: tile removed at ${a.row},${a.col}`)
  if (!b.tile) {
    if (a.letterBonus !== b.letterBonus || a.wordBonus !== b.wordBonus) {
      throw new Error(`diffBoards: bonus difference at ${a.row},${a.col}`)
    }
    return null
  }
  const diff: TilePlacement = {row: a.row, col: a.col, tile: b.tile}
  if (b.assignedLetter) diff.assignedLetter = b.assignedLetter
  return diff
}
