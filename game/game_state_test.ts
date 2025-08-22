import { expect, describe, it, beforeAll } from 'bun:test'
import { GameState } from './game_state.js'
import { Settings, type GameId } from './settings.js'
import { loadTranslations } from '../i18n.js'
import { TestStorage } from '../test_storage.js'
import { parseBoards, diffBoards } from './test_support.js'
import { generateRowStrings } from './board.js'
import { Player } from './player.js'
import { Tile, type TilePlacement } from './tile.js'

describe('game state', () => {
  beforeAll(async () => {
    await loadTranslations('en')
  })

  it('should exchange tiles 1', async () => {
    const settings = new Settings
    settings.gameId = 'test' as GameId
    settings.tileSystemSettings = {seed: '2'}  // Random seed.
    const player1GameState = new GameState('1', settings)
    await player1GameState.init()
    const initialRack = player1GameState.tilesHeld.map(t => t.tile.letter)
    expect(initialRack.join('')).toEqual('WTIUTNC')

    // Exchange the first, third, and last tiles.
    player1GameState.moveTile('rack', 0, 'exchange', 0)
    player1GameState.moveTile('rack', 2, 'exchange', 0)
    player1GameState.moveTile('rack', 6, 'exchange', 0)
    await player1GameState.passOrExchange()

    // The rack should have new tiles.
    const newRack = player1GameState.tilesHeld.map(t => t.tile.letter)
    expect(newRack.join('')).toEqual('TUTNKEE')

    // The turnUrlParams should contain the exchange.
    const params = player1GameState.turnUrlParams
    expect(params.get('ex')).toEqual('0.2.6')

    // A new game state created from the params should have the same rack.
    const player2GameState = await GameState.fromParams(params)
    const player2Rack = await player2GameState.getTiles('1')
    expect(player2Rack.map(t => t.letter).join('')).toEqual('TUTNKEE')
  })

  it('should apply the bingo bonus', async () => {
    const settings = new Settings
    settings.letterCounts = new Map([['A', 20]])
    settings.letterValues = new Map([['A', 1]])
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
    const gameState = new GameState('1', settings)
    await gameState.init()
    for (const placement of diffBoards(before, after)) {
      const fromCol = gameState.tilesHeld.findIndex(p => p.row === 'rack' && p.tile.equals(placement.tile))
      gameState.moveTile(
        'rack', fromCol,
        placement.row, placement.col
      )
    }
    await gameState.playWord()
    expect(gameState.turnUrlParams.get('wh')).toEqual('AAAAAAA')
    expect(gameState.board.scores.get('1')).toEqual(17)
  })

  it('should play a word', async () => {
    const settings = new Settings
    settings.letterCounts = new Map([['A', 4], ['B', 4], ['C', 4], ['D', 4], ['E', 4], ['F', 4], ['G', 4]])
    settings.letterValues = new Map([['A', 1], ['B', 3], ['C', 3], ['D', 2], ['E', 1], ['F', 4], ['G', 2]])
    const gameState = new GameState('1', settings)
    await gameState.init()

    // Move tiles to the board
    gameState.moveTile('rack', 0, 7, 7)
    gameState.moveTile('rack', 1, 7, 8)

    await gameState.playWord()

    expect(gameState.board.squares[7]?.[7]?.tile?.letter).toBe('B')
    expect(gameState.board.squares[7]?.[8]?.tile?.letter).toBe('A')
    expect(gameState.board.scores.get('1')).toEqual(4)
  })

  it('should pass turn', async () => {
    const settings = new Settings
    settings.tileSystemSettings = {seed: '3'}
    const player1GameState = new GameState('1', settings)
    await player1GameState.init()
    const initialRack = player1GameState.tilesHeld.map(t => t.tile.letter).join('')
    expect(initialRack).toBe('ESOQTSI')

    // Pass (exchange no tiles)
    await player1GameState.passOrExchange()
    const rackAfterPass = player1GameState.tilesHeld.map(t => t.tile.letter).join('')
    expect(rackAfterPass).toBe('ESOQTSI')
  })

  it('should exchange tiles 2', async () => {
    const settings = new Settings
    settings.tileSystemSettings = {seed: '1'}
    const gameState = new GameState('1', settings)
    await gameState.init()
    const initialRack = gameState.tilesHeld.map(t => t.tile.letter).join('')
    expect(initialRack).toBe('MLRVTSE')

    // Move tiles to the exchange area.
    gameState.moveTile('rack', 0, 'exchange', 0)
    gameState.moveTile('rack', 1, 'exchange', 0)

    // Exchange tiles.
    await gameState.passOrExchange()
    const rackAfterPass = gameState.tilesHeld.map(t => t.tile.letter).join('')
    expect(rackAfterPass).toBe('RVTSEIR')
  })

  describe('params', () => {
    it('should be added for non-default settings', () => {
      const settings = new Settings
      settings.players = [new Player({id: '1', name: 'player1'}), new Player({id: '2', name: 'player2'})]
      settings.boardLayout = ['T..', '.d.', '..T']
      settings.bingoBonus = 100
      settings.letterCounts = new Map([['A', 10], ['B', 10]])
      settings.letterValues = new Map([['A', 1], ['B', 2]])
      settings.tileSystemType = 'honor'
      settings.tileSystemSettings = {seed: '123'}
      settings.dictionaryType = 'permissive'
      settings.dictionarySettings = 'http://example.com'
      const gameState = new GameState('1', settings)
      const params = gameState.shared.gameParams
      expect(params.get('v')).toEqual(settings.version)
      expect(params.get('p1n')).toEqual('player1')
      expect(params.get('p2n')).toEqual('player2')
      expect(params.get('board')).toEqual('T..-.d.-..T')
      expect(params.get('bingo')).toEqual('100')
      expect(params.get('bag')).toEqual('A-10-1.B-10-2')
      expect(params.get('seed')).toEqual('123')
      expect(params.get('ds')).toEqual('http://example.com')
    })

    it('should be parsed for non-default settings', async () => {
      const params = new URLSearchParams
      params.set('v', '0')
      params.set('p1n', 'player1')
      params.set('p2n', 'player2')
      params.set('board', 'T..-.d.-..T')
      params.set('bingo', '100')
      params.set('bag', 'A-10-1.B-10-2')
      params.set('seed', '123')
      params.set('dt', 'permissive')
      params.set('ds', 'http://example.com')
      params.set('tn', '1')

      const gameState = await GameState.fromParams(params)
      const settings = gameState.settings

      expect(settings.version).toEqual('0')
      expect(settings.players.map(p => p.name)).toEqual(['player1', 'player2'])
      expect(settings.boardLayout).toEqual(['T..', '.d.', '..T'])
      expect(settings.bingoBonus).toEqual(100)
      expect(settings.letterCounts).toEqual(new Map([['A', 10], ['B', 10]]))
      expect(settings.letterValues).toEqual(new Map([['A', 1], ['B', 2]]))
      expect(settings.tileSystemType).toEqual('honor')
      expect(settings.tileSystemSettings).toEqual({seed: '123'})
      expect(settings.dictionaryType).toEqual('permissive')
      expect(settings.dictionarySettings).toEqual('http://example.com')
    })

    it('should throw on invalid bag param', async () => {
      const params = new URLSearchParams
      params.set('bag', 'A-10-B')
      params.set('seed', '123')
      params.set('tn', '1')
      await expect(GameState.fromParams(params)).rejects.toThrow('Invalid letter configuration in URL: A-10-B')
    })

    it('should throw on missing seed param', async () => {
      const params = new URLSearchParams
      params.set('tn', '1')
      await expect(GameState.fromParams(params)).rejects.toThrow('No random seed in URL.')
    })

    it('should throw on custom dictionary without URL', async () => {
      const params = new URLSearchParams
      params.set('dt', 'custom')
      params.set('seed', '123')
      params.set('tn', '1')
      await expect(GameState.fromParams(params)).rejects.toThrow('Custom dictionary requires a URL.')
    })
  })

  it('should return a displaced tile to the rack', async () => {
    const settings = new Settings
    settings.letterCounts = new Map([['A', 4], ['B', 4], ['C', 4], ['D', 4], ['E', 4], ['F', 4], ['G', 4]])
    settings.letterValues = new Map([['A', 1], ['B', 3], ['C', 3], ['D', 2], ['E', 1], ['F', 4], ['G', 2]])
    const gameState = new GameState('1', settings)
    await gameState.init()

    const tileToPlace = gameState.tilesHeld[0]!
    expect(tileToPlace.tile.letter).toBe('B')

    // Move a tile to the board
    gameState.moveTile('rack', 0, 7, 7)
    expect(gameState.tilesHeld.find(p => p.row === 7 && p.col === 7)).toBe(tileToPlace)

    // Simulate another player's move by placing a tile on the same square
    const otherPlayerTile = {tile: new Tile({letter: 'X', value: 8}), row: 7, col: 7}
    gameState.board.placeTiles(otherPlayerTile)

    // The tile should be moved back to the rack
    expect(gameState.tilesHeld.find(p => p.row === 7 && p.col === 7)).toBeUndefined()
    expect(gameState.tilesHeld.find(p => p.tile.equals(tileToPlace.tile))?.row).toBe('rack')
  })

  it('should clear assigned letter on recall', async () => {
    const settings = new Settings
    const gameState = new GameState('1', settings, false, undefined, [])

    const blankTilePlacement: TilePlacement = {
      tile: new Tile({letter: '', value: 0}),
      row: 7,
      col: 7,
      assignedLetter: 'Z'
    }
    gameState.tilesHeld.push(blankTilePlacement)

    // Recall the tile
    gameState.recallTiles()

    // The tile should be back in the rack and its assignedLetter should be cleared
    expect(blankTilePlacement.row).toBe('rack')
    expect(blankTilePlacement.assignedLetter).toBeUndefined()
  })

  it('should roll back transaction if setItem throws', async () => {
    const settings = new Settings
    settings.letterCounts = new Map([['A', 20], ['B', 20]])
    settings.letterValues = new Map([['A', 1], ['B', 1]])
    settings.gameId = 'test-rollback' as GameId
    const gameState = new GameState('1', settings)
    await gameState.init()

    // Set up storage with zero capacity.
    const testStorage = new TestStorage(0)
    gameState.storage = testStorage

    // Move tiles to the board to prepare for a move
    gameState.moveTile('rack', 0, 7, 7)
    gameState.moveTile('rack', 1, 7, 8)

    // Capture initial state (before the transaction starts)
    const initialTilesHeld = JSON.stringify(gameState.tilesHeld)
    const initialHistoryLength = gameState.history.length
    const initialNextTurnNumber = gameState.nextTurnNumber

    // playWord will call playTurns, which will call save, which will throw
    try {
      await gameState.playWord()
      // We should not reach here.
      expect(true).toBe(false)
    } catch (e: any) {
      expect(e.name).toEqual('QuotaExceededError')
    }

    // Verify that the state has been rolled back
    expect(JSON.stringify(gameState.tilesHeld)).toEqual(initialTilesHeld)
    expect(gameState.history.length).toEqual(initialHistoryLength)
    expect(gameState.nextTurnNumber).toEqual(initialNextTurnNumber)

    // Also check that the board is empty as it was initially
    expect(gameState.board.squares[7]?.[7]?.tile).toBeUndefined()
    expect(gameState.board.squares[7]?.[8]?.tile).toBeUndefined()

    // And check that the storage mock was not successfully written to
    expect(testStorage.getItem('sharewords_test-rollback')).toBeNull()
  })
})
