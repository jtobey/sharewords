import { expect, describe, it } from 'bun:test'
import { Board, Square } from './board.js'
import { Tile } from './tile.js'

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
})
