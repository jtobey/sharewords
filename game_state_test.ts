import { expect, describe, it } from 'bun:test'
import { GameState } from './game_state.js'
import { Settings } from './settings.js'
import type { GameId } from './settings.js'
import { parseBoards, diffBoards } from './test_support.js'
import { generateRowStrings } from './board.js'
import { Turn, nextTurnNumber } from './turn.js'
import type { TurnNumber } from './turn.js'

describe('game state', () => {
  it('should take turns', async () => {
    const settings = new Settings
    settings.gameId = 'test' as GameId
    settings.tileSystemSettings = 1  // Random seed.
    let [[sharedBoard], ...pairs] = parseBoards(`

          3 . ² . 3
          . ³ . ³ .
          ² . 2 . ²
          . ³ . ³ .
          3 . ² . 3


          gid: test
          ver: 0
          seed: 1
          board: T.d.T-.t.t.-d.D.d-.t.t.-T.d.T  gid: test
          tn: 1                                 tn: 2
          wl: 2.0                               wl: 1.1
          wh: VET                               wh: HEN

          3 . ² . 3                             3 . ² . 3
          . ³ . ³ .                             . H₄E₁N₁.
          V₅E₁T₁. ²                             V₅E₁T₁. ²
          . ³ . ³ .                             . ³ . ³ .
          3 . ² . 3                             3 . ² . 3


          gid: test                             gid: test
          tn: 3                                 tn: 4
          wl: 1.4                               wl: 4.1
          wv: SIR                               wh: GLUE

          3 . ² . 3                             3 . ² . 3
          . H₄E₁N₁S₁                            . H₄E₁N₁S₁
          V₅E₁T₁. I₁                            V₅E₁T₁. I₁
          . ³ . ³ R₁                            . ³ . ³ R₁
          3 . ² . 3                             3 G₃L₁U₂E₁

      `) as any
    settings.boardLayout = generateRowStrings(sharedBoard.squares)
    const player1GameState = new GameState('1', settings)
    let player2GameState: GameState | undefined
    let turnNumber = 1 as TurnNumber
    for (const [player1Board, player2Board] of pairs) {
      const player1Tiles = diffBoards(sharedBoard, player1Board)
      for (const playerId of ['1', '2']) {
        const tiles = await player1GameState.shared.tilesState.getTiles(playerId)
        const tilesStr = tiles.map(t => `${t.letter}(${t.value})`).join(' ')
        console.log(`player ${playerId} tiles: ${tilesStr}`)
      }
      await player1GameState.playTurns(new Turn('1', turnNumber, {playTiles: player1Tiles}))
      expect(player1GameState.turnUrlParams).toEqual(player1Board.headers)
      expect(diffBoards(player1GameState.board, player1Board)).toHaveLength(0)
      if (player2GameState) {
        await player2GameState.applyTurnParams(player1GameState.turnUrlParams)
      } else {
        player2GameState = await GameState.fromParams(player1GameState.turnUrlParams)
      }
      expect(diffBoards(player2GameState.board, player1Board)).toHaveLength(0)
      turnNumber = nextTurnNumber(turnNumber)
      const player2Tiles = diffBoards(player1Board, player2Board)
      await player2GameState.playTurns(new Turn('2',turnNumber, {playTiles: player2Tiles}))
      expect(player2GameState.turnUrlParams).toEqual(player2Board.headers)
      expect(diffBoards(player2GameState.board, player2Board)).toHaveLength(0)
      await player1GameState.applyTurnParams(player2GameState.turnUrlParams)
      expect(diffBoards(player1GameState.board, player2Board)).toHaveLength(0)
      turnNumber = nextTurnNumber(turnNumber)
      sharedBoard = player2Board
    }
  })
})
