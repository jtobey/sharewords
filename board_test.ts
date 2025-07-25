import { expect, describe, it } from 'bun:test'
import { Board, Square } from './board.js'
import { Tile } from './tile.js'
import { parseBoards, diffBoards } from './test_support.js'

function _sq(row: number, col: number, letterBonus=1, wordBonus=1) {
  return new Square({row, col, letterBonus, wordBonus})
}

function _t(row: number, col: number, letter: string, value: number) {
  return { row, col, tile: new Tile({letter, value}) }
}

describe('board', () => {
  it('should initialize', () => {
    const board = new Board('.d', 'T.')
    expect(board.squares).toEqual([
      [_sq(0,0),     _sq(0,1,2)],
      [_sq(1,0,1,3), _sq(1,1)],
    ])
  })

  it('should play CAT', () => {
    const board = new Board(
      '..T',
      'd..',
      '...',
    )
    expect(board.checkWordPlacement(
      _t(1, 0, 'C', 3),
      _t(1, 1, 'A', 1),
      _t(1, 2, 'T', 1),
    )).toEqual({
      score: 8,
      wordsFormed: ['CAT'],
    })
  })

  it('should score cross words', () => {
    const board = new Board(
      '..T',
      'd..',
      '...',
    )
    board.placeTiles(
      _t(1, 0, 'C', 3),
      _t(1, 1, 'A', 1),
      _t(1, 2, 'T', 1),
    )
    expect(board.checkWordPlacement(
      _t(0, 2, 'U', 2),
      _t(0, 1, 'M', 3),
    )).toEqual({
      score: 28,
      wordsFormed: ['MU', 'MA', 'UT'],
    })
  })

  it('should score bridges', () => {
    // @ts-ignore
    const [oldBoard, newBoard] = parseBoards(`

        . . . .     . . . .
        A₁2 E₁²     A₁G₃E₁D₁
        N₁O₁T₁.     N₁O₁T₁.
        . . . .     . . . .

    `)[0]
    const diff = diffBoards(oldBoard, newBoard)
    expect(oldBoard.checkWordPlacement(...diff)).toEqual({
      score: 22,
      wordsFormed: ['AGED', 'GO'],
    })
  })

  // TODO: Test validation.

  describe('json', () => {
    it('should roundtrip to and from JSON', () => {
      const board = new Board('.d', 'T.')
      const boardAsJson = JSON.parse(JSON.stringify(board))
      const boardFromJson = Board.fromJSON(boardAsJson)
      expect(boardFromJson).toEqual(board)
    })

    it('should roundtrip a board with tiles', () => {
      const board = new Board('.d', 'T.')
      board.placeTiles(
        _t(0, 0, 'A', 1),
        {..._t(0, 1, 'B', 2), assignedLetter: 'C'},
      )
      const boardAsJson = JSON.parse(JSON.stringify(board))
      const boardFromJson = Board.fromJSON(boardAsJson)
      expect(boardFromJson).toEqual(board)
    })

    it('should reject an invalid object', () => {
      expect(() => Board.fromJSON('frob')).toThrow(TypeError)
    })

    it('should reject a missing rows', () => {
      expect(() => Board.fromJSON({tiles: []})).toThrow(TypeError)
    })

    it('should reject a non-array rows', () => {
      expect(() => Board.fromJSON({rows: 'frob', tiles: []})).toThrow(TypeError)
    })

    it('should reject a non-string row', () => {
      expect(() => Board.fromJSON({rows: [null], tiles: []})).toThrow(TypeError)
    })

    it('should reject a missing tiles', () => {
      expect(() => Board.fromJSON({rows: []})).toThrow(TypeError)
    })

    it('should reject a non-array tiles', () => {
      expect(() => Board.fromJSON({rows: [], tiles: 'frob'})).toThrow(TypeError)
    })

    it('should reject an invalid tile', () => {
      expect(() => Board.fromJSON({rows: [], tiles: [null]})).toThrow(TypeError)
    })

    it('should reject an invalid tile row', () => {
      expect(() => Board.fromJSON({rows: [], tiles: [['a', 1, 'A:1']]})).toThrow(TypeError)
    })

    it('should reject an invalid tile col', () => {
      expect(() => Board.fromJSON({rows: [], tiles: [[0, 'b', 'A:1']]})).toThrow(TypeError)
    })

    it('should reject out-of-bounds tile placement', () => {
      expect(() => Board.fromJSON({rows: ['..'], tiles: [[0, 2, 'A:1']]})).toThrow(TypeError)
    })
  })
})
