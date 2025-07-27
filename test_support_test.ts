// @ts-nocheck

import { expect, describe, it } from 'bun:test'
import { TestBoard, parseBoards, diffBoards } from './test_support.js'
import { Tile } from './tile.ts'

describe('test support', () => {
  it('should parse a board', () => {
    const boardsStr = `
    . ² Z₉.
    3 . A0.
    . 2 . ³`
    const expected = new TestBoard(
      '.d..',
      'T...',
      '.D.t',
    )
    expected.placeTiles(
      {row: 0, col: 2, tile: new Tile({letter: 'Z', value: 9})},
      {row: 1, col: 2, tile: new Tile({letter: '', value: 0}), assignedLetter: 'A'},
    )
    const parsed = parseBoards(boardsStr)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toHaveLength(1)
    const board = parsed[0]?.[0]
    expect(board).toBeInstanceOf(TestBoard)
    expect(board as unknown as TestBoard).toEqual(expected)
  })

  it('should parse rows of boards', () => {
    const boardsStr = `
    . .   . .
    . .   . .

    X8`
    const parsed = parseBoards(boardsStr)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toHaveLength(2)
    expect(parsed[1]).toHaveLength(1)
    parsed[0].forEach(board => {
      expect(board).toBeInstanceOf(TestBoard)
      expect(board.squares).toHaveLength(2)
      board.squares.forEach(row => expect(row).toHaveLength(2))
    })
    expect(parsed[1][0].squares[0][0].tile.letter).toEqual('X')
  })

  it('should diff boards', () => {
    const boardsStr = `
    2 . .   2 Q9I0
    X8I1.   X8I1.
    . . 3   . . 3
    `
    const [oldBoard, newBoard] = parseBoards(boardsStr)[0]
    expect(oldBoard).not.toEqual(newBoard)
    const expected = [
      {row: 0, col: 1, tile: new Tile({letter: 'Q', value: 9})},
      {row: 0, col: 2, tile: new Tile({letter: '', value: 0}), assignedLetter: 'I'},
    ]
    const diff = diffBoards(oldBoard, newBoard)
    expect(diff).toEqual(expected)
    oldBoard.placeTiles(...diff)
    expect(oldBoard).toEqual(newBoard)
  })
})
