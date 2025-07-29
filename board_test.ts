import { expect, describe, it } from 'bun:test'
import { Board, Square } from './board.js'
import type { BoardPlacement } from './tile.js'
import { Tile } from './tile.js'
import { parseBoards, diffBoards } from './test_support.js'

function _sq(row: number, col: number, letterBonus=1, wordBonus=1) {
  return new Square({row, col, letterBonus, wordBonus})
}

function _t(row: number, col: number, letter: string, value: number, assignedLetter=null as string | null) {
  const tile = { row, col, tile: new Tile({letter, value})} as BoardPlacement
  if (assignedLetter !== null) tile.assignedLetter = assignedLetter
  return tile
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
      mainWord: 'CAT',
      row: 1,
      col: 0,
      vertical: false,
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
      mainWord: 'MU',
      row: 0,
      col: 1,
      vertical: false,
    })
  })

  it('should score bridges', () => {
    const [oldBoard, newBoard] = parseBoards(`

        . . . .     . . . .
        A₁2 E₁²     A₁G₃E₁D₁
        N₁O₁T₁.     N₁O₁T₁.
        . . . .     . . . .

    `)[0]!
    const diff = diffBoards(oldBoard!, newBoard!)
    expect(oldBoard!.checkWordPlacement(...diff)).toEqual({
      score: 22,
      wordsFormed: ['AGED', 'GO'],
      mainWord: 'AGED',
      row: 1,
      col: 0,
      vertical: false,
    })
  })

  describe('validation', () => {
    it('should throw if no tiles are provided', () => {
      const board = new Board('.')
      expect(() => board.checkWordPlacement()).toThrow('No tiles.')
    })

    it('should throw if tiles are not in a line', () => {
      const [oldBoard, newBoard] = parseBoards(`

          . . . .     A1. . .
          . . . .     . B1. .

      `)[0]!
      const diff = diffBoards(oldBoard!, newBoard!)
      expect(() => oldBoard!.checkWordPlacement(...diff))
        .toThrow('Tiles are not in a line.')
    })

    it('should throw if a tile is placed on an occupied square', () => {
      const board = new Board('.')
      board.placeTiles(_t(0, 0, 'A', 1))
      expect(() => board.checkWordPlacement(_t(0, 0, 'B', 1)))
        .toThrow('Square 0,0 is occupied.')
    })

    it('should throw if tiles form a line with gaps', () => {
      const [oldBoard, newBoard] = parseBoards(`

          . . .     A1. B2

      `)[0]!
      const diff = diffBoards(oldBoard!, newBoard!)
      expect(() => oldBoard!.checkWordPlacement(...diff))
        .toThrow('Tiles form a line with gaps between them.')
    })

    it('should throw if only a single letter word is formed', () => {
      const [oldBoard, newBoard] = parseBoards(`

          . . .     . . .
          . . .     . A1.
          . . .     . . .

      `)[0]!
      const diff = diffBoards(oldBoard!, newBoard!)
      expect(() => oldBoard!.checkWordPlacement(...diff))
        .toThrow('No single-letter words accepted.')
    })

    it('should throw if the first word is not on the center square', () => {
      const [oldBoard, newBoard] = parseBoards(`

          . . .     J₉. .
          . . .     A₁. .
          . . .     M₃. .

      `)[0]!
      const diff = diffBoards(oldBoard!, newBoard!)
      expect(() => oldBoard!.checkWordPlacement(...diff))
        .toThrow('Tiles must connect to existing words or cover the center square.')
    })

    it('should throw if subsequent words are not connected', () => {
      const [oldBoard, newBoard] = parseBoards(`

          . M₃. .   . M₃. .
          . A₁. .   . A₁. O₁
          . . . .   . . . H₃

      `)[0]!
      const diff = diffBoards(oldBoard!, newBoard!)
      expect(() => oldBoard!.checkWordPlacement(...diff))
        .toThrow('Tiles must connect to existing words or cover the center square.')
    })

    it('should throw if a blank tile is not assigned a letter.', () => {
      const board = new Board('...')
      expect(() => board.checkWordPlacement(_t(0, 0, '', 0), _t(0, 1, 'I', 1)))
        .toThrow('Blank tiles must be assigned letters.')
    })

    it('should throw if a non-blank tile is assigned a letter.', () => {
      const board = new Board('...')
      expect(() => board.checkWordPlacement(_t(0, 1, 'A', 1), _t(0, 2, 'T', 1, 'N')))
        .toThrow('Non-blank tiles cannot be assigned letters.')
    })
  })

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
        _t(0, 1, '', 0, 'C'),
      )
      const boardAsJson = JSON.parse(JSON.stringify(board))
      const boardFromJson = Board.fromJSON(boardAsJson)
      expect(boardFromJson).toEqual(board)
    })

    it('should roundtrip a board with scores', () => {
      const board = new Board('.d', 'T.')
      board.scores.set('player', 10)
      const boardAsJson = JSON.parse(JSON.stringify(board))
      const boardFromJson = Board.fromJSON(boardAsJson)
      expect(boardFromJson).toEqual(board)
    })

    it('should reject an invalid object', () => {
      expect(() => Board.fromJSON('frob')).toThrow(TypeError)
    })

    it('should reject a missing rows', () => {
      expect(() => Board.fromJSON({tiles: [], scores: []})).toThrow(TypeError)
    })

    it('should reject a non-array rows', () => {
      expect(() => Board.fromJSON({rows: 'frob', tiles: [], scores: []})).toThrow(TypeError)
    })

    it('should reject a non-string row', () => {
      expect(() => Board.fromJSON({rows: [null], tiles: [], scores: []})).toThrow(TypeError)
    })

    it('should reject a missing tiles', () => {
      expect(() => Board.fromJSON({rows: [], scores: []})).toThrow(TypeError)
    })

    it('should reject a non-array tiles', () => {
      expect(() => Board.fromJSON({rows: [], tiles: 'frob', scores: []})).toThrow(TypeError)
    })

    it('should reject an invalid tile', () => {
      expect(() => Board.fromJSON({rows: [], tiles: [null], scores: []})).toThrow(TypeError)
    })

    it('should reject an invalid tile row', () => {
      expect(() => Board.fromJSON({rows: [], tiles: [['a', 1, 'A:1']], scores: []})).toThrow(TypeError)
    })

    it('should reject an invalid tile col', () => {
      expect(() => Board.fromJSON({rows: [], tiles: [[0, 'b', 'A:1']], scores: []})).toThrow(TypeError)
    })

    it('should reject out-of-bounds tile placement', () => {
      expect(() => Board.fromJSON({rows: ['..'], tiles: [[0, 2, 'A:1']], scores: []})).toThrow(TypeError)
    })

    it('should reject a non-array scores', () => {
      expect(() => Board.fromJSON({rows: ['..'], tiles: [], scores: 'quux'})).toThrow(TypeError)
    })

    it('should reject a non-array score', () => {
      expect(() => Board.fromJSON({rows: ['..'], tiles: [], scores: ['quux']})).toThrow(TypeError)
    })

    it('should reject a short score array', () => {
      expect(() => Board.fromJSON({rows: ['..'], tiles: [], scores: [['p']]})).toThrow(TypeError)
    })

    it('should reject a long score array', () => {
      expect(() => Board.fromJSON({rows: ['..'], tiles: [], scores: [['p', 0, 0]]})).toThrow(TypeError)
    })

    it('should reject a non-string playerId', () => {
      expect(() => Board.fromJSON({rows: ['..'], tiles: [], scores: [[16, 0]]})).toThrow(TypeError)
    })

    it('should reject a non-numeric score', () => {
      expect(() => Board.fromJSON({rows: ['..'], tiles: [], scores: [['p', '0']]})).toThrow(TypeError)
    })

    it('should reject duplicate scores', () => {
      expect(() => Board.fromJSON({rows: ['..'], tiles: [], scores: [['p', 0], ['q', 1], ['p', 0]]})).toThrow(TypeError)
    })

    it('should accept valid JSON', () => {
      const board = Board.fromJSON({rows: ['.d'], tiles: [[0, 0, 'A:1']], scores: [['p', 0], ['q', 1]]})
      expect(board.squares.length).toEqual(1)
      expect(board.squares[0]?.length).toEqual(2)
      expect(board.squares[0]?.[0]?.tile).toEqual(new Tile({letter:'A', value:1}))
      expect(board.squares[0]?.[1]).toEqual(_sq(0, 1, 2, 1))
      expect([...board.scores.entries()]).toEqual([['p', 0], ['q', 1]])
    })
  })
})
