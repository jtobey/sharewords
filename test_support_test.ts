import { expect, describe, it } from 'bun:test'
import { parseBoards } from './test_support.js'
import { Tile } from './tile.ts'
import { Board } from './board.ts'

describe('test support', () => {
  it('should parse a board', () => {
    const boardsStr = `
    . ² Z₉.
    3 . A0.
    . 2 . ³`
    const expected = new Board(
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
    expect(board).toBeInstanceOf(Board)
    expect(board as unknown as Board).toEqual(expected)
  })
})
