import { Square, generateRowStrings, Board } from './board.ts'
import { Tile } from './tile.ts'

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉'
const DIGITS = '0123456789' + SUBSCRIPTS
// const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

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
    else if (char0 === '2') wordBonus = 2
    else if (char0 === '3') wordBonus = 3
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
    .replace(/^\n+|\n+$/sg, '')
    .replace(/\n\n\n+/g, '\n\n')
    .split('\n\n')
  return strings.map(parseRowOfBoards)
}

const SQUARE_PATTERN = /\S(?:.|$)/g
const SQUARE_ROW_PATTERN = /( +)((?:\S(?:.|$))+)/g

function getSpacing(rowOfSquareRows: string) {
  const spacing: Array<number> = []
  let match
  while ((match = SQUARE_ROW_PATTERN.exec(rowOfSquareRows)) !== null) {
    spacing.push((match[1] as string).length)
  }
  return spacing
}

function parseRowOfBoards(rowOfBoardsStr: string) {
  const lines = rowOfBoardsStr.split('\n')
  const line1 = lines[0]
  if (!line1) throw new Error;
  const lineSpacing = getSpacing(line1)
  if (!lines.every(line => String(getSpacing(line)) === String(lineSpacing))) {
    throw new Error(`Inconsistent spacing:\n${rowOfBoardsStr}\n`)
  }
  const boardStrings = lineSpacing.map(n => [] as Array<string>)
  lines.map(line => {
    boardStrings.keys().forEach(index => {
      const match = SQUARE_ROW_PATTERN.exec(line)
      if (!match) throw new Error
      boardStrings[index]?.push(match[2] as string)
    })
    if (SQUARE_ROW_PATTERN.exec(line)) throw new Error
  })
  return boardStrings.map(parseBoard)
}

function parseBoard(boardStrings: Array<string>) {
  const squares = boardStrings.map(parseRowOfSquares)
  const board = new Board(...generateRowStrings(squares))
  squares.map((row, rowNumber) => {
    row.map((square, colNumber) => {
      const boardSquare = board.squares[rowNumber]?.[colNumber] as Square
      if (square.tile) boardSquare.tile = square.tile
      if (square.assignedLetter) boardSquare.assignedLetter = square.assignedLetter
    })
  })
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
