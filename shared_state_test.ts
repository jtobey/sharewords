import { SharedState } from './shared_state.js'
import type { GameId } from './shared_state.js'
import { Settings } from './settings.js'
import { Board } from './board.js'
import { HonorSystemTilesState } from './honor_system_tiles_state.js'
import { Turn } from './turn.js'
import type { TurnNumber } from './turn.js'
import { makeTiles } from './tile.js'
import { test, expect } from 'bun:test'

test('can create a shared state', () => {
  const settings = new Settings()
  const board = new Board(...settings.boardLayout)
  const tilesState = new HonorSystemTilesState({
    players: settings.players,
    rackCapacity: settings.rackCapacity,
    tiles: makeTiles({ letterCounts: settings.letterCounts, letterValues: settings.letterValues }),
    tileSystemSettings: 1
  })
  const sharedState = new SharedState(settings, 'test' as GameId, board, tilesState)
  expect(sharedState.nextTurnNumber).toBe(1 as TurnNumber)
})

test('can play a turn', async () => {
  const settings = new Settings()
  const board = new Board(...settings.boardLayout)
  const letterCounts = { 'A': 2, 'B': 2, 'C': 2, 'D': 2, 'E': 2, 'F': 2, 'G': 2 }
  const letterValues = { 'A': 1, 'B': 1, 'C': 1, 'D': 1, 'E': 1, 'F': 1, 'G': 1 }
  const tilesState = new HonorSystemTilesState({
    players: settings.players,
    rackCapacity: settings.rackCapacity,
    tiles: makeTiles({ letterCounts, letterValues }),
    tileSystemSettings: 1
  })
  const sharedState = new SharedState(settings, 'test' as GameId, board, tilesState)

  const player1Id = settings.players[0]!.id
  const player1Tiles = await tilesState.getTiles(player1Id)
  const turn = new Turn(
    player1Id,
    1 as TurnNumber,
    {
      playTiles: [
        { tile: player1Tiles[0]!, row: 7, col: 7 },
        { tile: player1Tiles[1]!, row: 7, col: 8 },
      ]
    }
  )

  await sharedState.playTurns(turn)

  expect(sharedState.nextTurnNumber).toBe(2 as TurnNumber)
  expect(board.squares[7]![7]!.tile).toBe(player1Tiles[0]!)
  expect(board.squares[7]![8]!.tile).toBe(player1Tiles[1]!)
  expect(board.scores.get(player1Id)).toBe(2) // Assuming tile values are 1
})

test('can serialize and deserialize a shared state', () => {
  const settings = new Settings()
  const board = new Board(...settings.boardLayout)
  const tilesState = new HonorSystemTilesState({
    players: settings.players,
    rackCapacity: settings.rackCapacity,
    tiles: makeTiles({ letterCounts: settings.letterCounts, letterValues: settings.letterValues }),
    tileSystemSettings: 1
  })
  const sharedState = new SharedState(settings, 'test' as GameId, board, tilesState)
  const json = sharedState.toJSON()
  const sharedState2 = SharedState.fromJSON(json)
  expect(sharedState2.gameId).toBe(sharedState.gameId)
  expect(sharedState2.nextTurnNumber).toBe(sharedState.nextTurnNumber)
  expect(sharedState2.settings).toEqual(sharedState.settings)
  expect(sharedState2.board).toEqual(sharedState.board)
  expect(sharedState2.tilesState).toEqual(sharedState.tilesState)
})
