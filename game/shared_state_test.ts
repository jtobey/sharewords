import { describe, test, expect } from 'bun:test'
import { SharedState } from './shared_state.js'
import { Settings } from './settings.js'
import type { GameId } from './settings.js'
import { Player } from './player.js'
import { Board } from './board.js'
import { HonorSystemTilesState } from './honor_system_tiles_state.js'
import { Turn, toTurnNumber } from './turn.js'
import { makeTiles } from './tile.js'
import { PlayRejectedError } from './dictionary.js'

describe('shared state', () => {
  test('can create a shared state', () => {
    const settings = new Settings()
    const gameId = 'test' as GameId
    const board = new Board(...settings.boardLayout)
    const tilesState = new HonorSystemTilesState(
      settings.players,
      {seed: '1'},
      makeTiles({ letterCounts: settings.letterCounts, letterValues: settings.letterValues }),
      settings.rackCapacity,
    )
    const sharedState = new SharedState(settings, gameId, board, tilesState)
    expect(sharedState.gameId).toBe(gameId)
    expect(sharedState.nextTurnNumber).toBe(toTurnNumber(1))
  })

  test('can take gameId from settings', () => {
    const settings = new Settings()
    const gameId = 'settings gid' as GameId
    settings.gameId = gameId
    const sharedState = new SharedState(settings)
    expect(sharedState.gameId).toEqual(gameId)
  })

  test('throws on bad player ID', () => {
    const settings = new Settings()
    settings.players = [new Player({ id: '2', name: 'p1' }), new Player({ id: '3', name: 'p2' })]
    expect(() => new SharedState(settings)).toThrow('players[0] should have ID "1", not "2".')
  })

  test('can play a turn', async () => {
    const settings = new Settings()
    const sharedState = new SharedState(settings)
    const player1Id = settings.players[0]!.id
    const player1Tiles = await sharedState.tilesState.getTiles(player1Id)
    const turn = new Turn(
      player1Id,
      toTurnNumber(1),
      {
        playTiles: [
          { tile: player1Tiles[0]!, row: 7, col: 7 },
          { tile: player1Tiles[1]!, row: 7, col: 8 },
        ]
      }
    )

    await sharedState.playTurns(turn)

    expect(sharedState.nextTurnNumber).toBe(toTurnNumber(2))
    expect(sharedState.board.squares[7]![7]!.tile).toEqual(player1Tiles[0]!)
    expect(sharedState.board.squares[7]![8]!.tile).toEqual(player1Tiles[1]!)
  })

  test('rejects invalid words', async () => {
    const settings = new Settings()
    settings.letterCounts = {A:100}
    const sharedState = new SharedState(settings)
    sharedState['checkWords'] = async (...words: Array<string>) => {
      for (const word of words) {
        if (word !== 'AA') throw new PlayRejectedError(`${word} is not a word in test dictionary.`)
      }
    }
    const player1Id = settings.players[0]!.id
    const player1Tiles = await sharedState.tilesState.getTiles(player1Id)
    let turn = new Turn(
      player1Id,
      toTurnNumber(1),
      {
        playTiles: [
          { tile: player1Tiles[0]!, row: 7, col: 7 },
          { tile: player1Tiles[1]!, row: 7, col: 8 },
        ]
      }
    )

    await sharedState.playTurns(turn)

    const player2Id = settings.players[1]!.id
    const player2Tiles = await sharedState.tilesState.getTiles(player1Id)
    turn = new Turn(
      settings.players[1]!.id,
      toTurnNumber(2),
      {
        playTiles: [
          { tile: player2Tiles[0]!, row: 7, col: 9 },
        ]
      }
    )

    expect(sharedState.playTurns(turn)).rejects.toThrow('AAA is not a word in test dictionary. Play rejected.')
  })

  test('throws on duplicate turn number', async () => {
    const settings = new Settings()
    const sharedState = new SharedState(settings)
    const player1Id = settings.players[0]!.id
    const turn = new Turn(player1Id, toTurnNumber(1), { exchangeTileIndices: [] })
    const turn2 = new Turn(player1Id, toTurnNumber(1), { exchangeTileIndices: [] })
    await expect(sharedState.playTurns(turn, turn2)).rejects.toThrow('playTurns received duplicate turn number 1.')
  })

  test('throws on wrong player ID', async () => {
    const settings = new Settings()
    const sharedState = new SharedState(settings)
    const player2Id = settings.players[1]!.id
    const turn = new Turn(player2Id, toTurnNumber(1), { exchangeTileIndices: [] })
    await expect(sharedState.playTurns(turn)).rejects.toThrow('Turn number 1 belongs to player "1", not "2".')
  })

  test('throws on unsupported dictionary', () => {
    const settings = new Settings()
    settings.dictionaryType = 'strict' as any
    expect(() => new SharedState(settings)).toThrow('dictionaryType strict is not supported.')
  })

  test('throws on exchanging too many tiles', async () => {
    const settings = new Settings()
    settings.players = [new Player({ id: '1' })]
    settings.letterCounts = { 'A': 8 } // Player 1 gets 7 tiles, bag has 1
    const sharedState = new SharedState(settings)
    const player1Id = settings.players[0]!.id
    const turn = new Turn(player1Id, toTurnNumber(1), { exchangeTileIndices: [0, 1, 2, 3, 4, 5, 6] })
    await expect(sharedState.playTurns(turn)).rejects.toThrow('Player 1 attempted to exchange 7 but the bag holds only 1.')
  })

  test('throws on invalid turn move', async () => {
    const settings = new Settings()
    const sharedState = new SharedState(settings)
    const player1Id = settings.players[0]!.id
    const turn = new Turn(player1Id, toTurnNumber(1), {} as any)
    await expect(sharedState.playTurns(turn)).rejects.toThrow('Turn number 1 is not a play or exchange.')
  })

  test('throws on unsupported tileSystemType', () => {
    const settings = new Settings()
    settings.tileSystemType = 'invalid' as any
    expect(() => new SharedState(settings)).toThrow('Unsupported tileSystemType: invalid')
  })

  describe('json', () => {
    test('can serialize and deserialize', () => {
      const settings = new Settings()
      const sharedState = new SharedState(settings)
      const json = sharedState.toJSON()
      const sharedState2 = SharedState.fromJSON(json)
      expect(sharedState2.gameId).toBe(sharedState.gameId)
      expect(sharedState2.nextTurnNumber).toBe(sharedState.nextTurnNumber)
      expect(sharedState2.settings).toEqual(sharedState.settings)
      expect(sharedState2.board).toEqual(sharedState.board)
      expect(sharedState2.tilesState.toJSON()).toEqual(sharedState.tilesState.toJSON())
    })

    test('throws on invalid json', () => {
      expect(() => SharedState.fromJSON(1)).toThrow('Not an object in SharedState serialization: 1')
      expect(() => SharedState.fromJSON({}))
        .toThrow('Wrong keys or key order in SharedState serialization: {}')
      const board = new Board('.')
      const template = {
        gameId: '1',
        nextTurnNumber: 1,
        settings: new Settings().toJSON(),
        board: board.toJSON(),
        tilesState: new HonorSystemTilesState(
          new Settings().players,
          {seed: '1'},
          makeTiles({letterCounts: {A: 20}, letterValues: {A: 1}}),
          7,
        ).toJSON(),
      }
      expect(() => SharedState.fromJSON({ ...template, gameId: 1 }))
        .toThrow('Game ID is not a string in SharedState serialization: {"gameId":1,"nextTurnNumber":1,')
      expect(() => SharedState.fromJSON({ ...template, nextTurnNumber: '1' }))
        .toThrow('Next turn number is not a number in SharedState serialization: {"gameId":"1","nextTurnNumber":"1",')
    })

    test('throws on unknown tileSystemType in fromJSON', () => {
      const settings = new Settings()
      const sharedState = new SharedState(settings)
      const json = sharedState.toJSON()
      json.settings.tileSystemType = 'invalid' as any
      expect(() => SharedState.fromJSON(json)).toThrow('Invalid Settings serialization:')
    })
  })
})
