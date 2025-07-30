import { expect, describe, it } from 'bun:test'
import { GameState } from './game_state.js'
import { Settings } from './settings.js'
import type { GameId } from './settings.js'
import { parseBoards, diffBoards } from './test_support.js'
import { generateRowStrings } from './board.js'
import { Turn, nextTurnNumber } from './turn.js'
import { toTurnNumber } from './turn.js'

describe('game state', () => {
  it('should take turns', async () => {
    const settings = new Settings
    settings.gameId = 'test' as GameId
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
    let turnNumber = toTurnNumber(1)
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

  it('should exchange tiles', async () => {
    const settings = new Settings
    settings.gameId = 'test' as GameId
    settings.tileSystemSettings = 2  // Random seed.
    const player1GameState = new GameState('1', settings)
    await player1GameState.initRack()
    const initialRack = player1GameState.tilesHeld.map(t => t.tile.letter)
    expect(initialRack.join('')).toEqual('WTIUTNC')

    // Exchange the first, third, and last tiles.
    const exchangeIndices = [0, 2, 6]
    const turn = new Turn('1', toTurnNumber(1), { exchangeTileIndices: exchangeIndices })
    await player1GameState.playTurns(turn)

    // The rack should have new tiles.
    const newRack = player1GameState.tilesHeld.map(t => t.tile.letter)
    expect(newRack.join('')).toEqual('TUTNKEE')

    // The turnUrlParams should contain the exchange.
    const params = player1GameState.turnUrlParams
    expect(params.get('ex')).toEqual('0.2.6')

    // A new game state created from the params should have the same rack.
    const player2GameState = await GameState.fromParams(params, '2')
    const player2Rack = await player2GameState.getTiles('1')
    expect(player2Rack.map(t => t.letter).join('')).toEqual('TUTNKEE')
  })

  it('should apply the bingo bonus', async () => {
    const settings = new Settings
    settings.letterCounts = {A: 20}
    settings.letterValues = {A: 1}
    settings.bingoBonus = 10
    let [[before, after]] = parseBoards(`

          . . . . . . .        . . . . . . .
          . . . . . . .        . . . . . . .
          . . . . . . .        . . . . . . .
          . . . . . . .        A₁A₁A₁A₁A₁A₁A₁
          . . . . . . .        . . . . . . .
          . . . . . . .        . . . . . . .
          . . . . . . .        . . . . . . .

      `) as any
    settings.boardLayout = generateRowStrings(before.squares)
    console.log(settings.boardLayout)
    const gameState = new GameState('1', settings)
    const placements = diffBoards(before, after)
    await gameState.playTurns(new Turn('1', toTurnNumber(1), {playTiles: placements}))
    expect(gameState.turnUrlParams.get('wh')).toEqual('AAAAAAA')
    expect(gameState.board.scores.get('1')).toEqual(17)
  })

  it('should play a word', async () => {
    const settings = new Settings
    settings.letterCounts = {A: 4, B: 4, C: 4, D: 4, E: 4, F: 4, G: 4}
    settings.letterValues = {A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2}
    const gameState = new GameState('1', settings)
    await gameState.initRack()

    // Move tiles to the board
    gameState.moveTile('rack', 0, 7, 7)
    gameState.moveTile('rack', 1, 7, 8)

    await gameState.playWord()

    expect(gameState.board.squares[7]?.[7]?.tile?.letter).toBe('B')
    expect(gameState.board.squares[7]?.[8]?.tile?.letter).toBe('A')
    expect(gameState.board.scores.get('1')).toEqual(4)
  })

  it('should pass or exchange', async () => {
    const settings = new Settings
    settings.tileSystemSettings = 3
    const player1GameState = new GameState('1', settings)
    await player1GameState.initRack()
    const initialRack = player1GameState.tilesHeld.map(t => t.tile.letter).join('')
    expect(initialRack).toBe('ESOQTSI')

    // Pass (exchange no tiles)
    await player1GameState.passOrExchange()
    const rackAfterPass = player1GameState.tilesHeld.map(t => t.tile.letter).join('')
    expect(rackAfterPass).toBe('ESOQTSI')
  })
})
