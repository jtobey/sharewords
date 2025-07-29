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
    const board = parsed[0][0]
    expect(board).toBeInstanceOf(TestBoard)
    expect(board).toEqual(expected)
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

  it('should parse headers', () => {
    const boardsStr = `

        from:me                             disjoint: header
        to: you   long-header: hello there!
        . ² Z₉.   . .                       . .
        3 . A0.   . .
        . 2 . ³

    `
    const parsed = parseBoards(boardsStr)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toHaveLength(3)
    expect(parsed[0][0].squares).toHaveLength(3)
    expect(parsed[0][0].squares[0]).toHaveLength(4)
    expect(parsed[0][0].headers).toEqual({from:'me', to:'you'})
    expect(parsed[0][1].squares).toHaveLength(2)
    expect(parsed[0][1].squares[0]).toHaveLength(2)
    expect(parsed[0][1].headers).toEqual({'long-header': 'hello there!'})
    expect(parsed[0][2].squares).toHaveLength(1)
    expect(parsed[0][2].squares[0]).toHaveLength(2)
    expect(parsed[0][2].headers).toEqual({disjoint:'header'})
  })

  it('should parse a header on the second board', () => {
    const boardsStr = `

                  long-header: hello there!
        . ² Z₉.   . .
        3 . A0.   . .
        . 2 . ³

    `
    const parsed = parseBoards(boardsStr)
    expect(parsed[0][0].headers).toEqual({})
    expect(parsed[0][1].headers).toEqual({'long-header': 'hello there!'})
  })

  it('should concatenate a multi-line header', () => {
    const boardsStr = `

        mlh: line 1
        mlh: line 2
        mlh: line 3
        . ² Z₉.
        3 . A0.
        . 2 . ³

    `
    const parsed = parseBoards(boardsStr)
    expect(parsed[0][0].headers).toEqual({'mlh': 'line 1\nline 2\nline 3'})
  })

  it('should ignore a blank line after headers', () => {
    const boardsStr = `

        header-name: header-value

        . . .
        . . .
        . . .

    `
    const parsed = parseBoards(boardsStr)
    expect(parsed[0][0].headers).toEqual({'header-name': 'header-value'})
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
