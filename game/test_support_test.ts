/*
Copyright 2025 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
// @ts-nocheck

import { expect, describe, it } from 'bun:test'
import { TestBoard, parseBoards, diffBoards } from './test_support.js'
import { Tile } from './tile.js'

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
    expect(parsed[0][0].headers).toEqual(new URLSearchParams('from=me&to=you'))
    expect(parsed[0][1].squares).toHaveLength(2)
    expect(parsed[0][1].squares[0]).toHaveLength(2)
    expect(parsed[0][1].headers).toEqual(new URLSearchParams([['long-header', 'hello there!']]))
    expect(parsed[0][2].squares).toHaveLength(1)
    expect(parsed[0][2].squares[0]).toHaveLength(2)
    expect(parsed[0][2].headers).toEqual(new URLSearchParams('disjoint=header'))
  })

  it('should parse a header on the second board', () => {
    const boardsStr = `

                  long-header: hello there!
        . ² Z₉.   . .
        3 . A0.   . .
        . 2 . ³

    `
    const parsed = parseBoards(boardsStr)
    expect(parsed[0][0].headers).toEqual(new URLSearchParams)
    expect(parsed[0][1].headers).toEqual(new URLSearchParams([['long-header', 'hello there!']]))
  })

  it('should support multiples in headers', () => {
    const boardsStr = `

        mh: value 1
        mh: value 2
        mh: value 3
        . ² Z₉.
        3 . A0.
        . 2 . ³

    `
    const parsed = parseBoards(boardsStr)
    expect(parsed[0][0].headers.getAll('mh')).toEqual(['value 1', 'value 2', 'value 3'])
  })

  it('should ignore a blank line after headers', () => {
    const boardsStr = `

        header-name: header-value

        . . .
        . . .
        . . .

    `
    const parsed = parseBoards(boardsStr)
    expect(parsed[0][0].headers).toEqual(new URLSearchParams('header-name=header-value'))
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
