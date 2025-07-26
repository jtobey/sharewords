import { expect, describe, it } from 'bun:test'
import { Tile, makeTiles } from './tile.ts'
import { HonorSystemTilesState } from './honor_system_tiles_state.js'
import { Player } from './player.js'
import { Turn } from './turn.js'
import type { TurnNumber } from './turn.js'

function makePlayers(...ids: Array<string>) {
  return ids.map(id => new Player({id}))
}

interface LetterCounts { [key: string]: number }

function makeTestTiles(letterCounts: LetterCounts) {
  return makeTiles({letterCounts, letterValues: {}})
}

function getAllTiles(tilesState: HonorSystemTilesState) {
  // Read private properties of HonorSystemTilesState and HonorSystemBag for testing.
  const tiles = [...(tilesState as any).bag.tiles]
  for (const rack of (tilesState as any).racks.values()) {
    tiles.push(...rack)
  }
  return tiles
}

describe('honor system tiles state', () => {
  it('should initialize', () => {
    const tiles = makeTestTiles({A:9, B:2})
    const state = new HonorSystemTilesState({
      players: makePlayers('John', 'Dave'),
      rackCapacity: 4,
      tiles,
      tileSystemSettings: 1,
    })
    expect(state.rackCapacity).toEqual(4)
    expect(state.numberOfTilesInBag).toEqual(3)
    expect(state.numberOfTurnsPlayed).toEqual(0)
    expect(state.stateId).toEqual(state.numberOfTurnsPlayed)
    expect(state.countTiles('John')).toEqual(4)
    expect(state.countTiles('Dave')).toEqual(4)
    expect(getAllTiles(state)).toEqual(expect.arrayContaining(tiles))
  })

  it('should play turns', async () => {
    const tiles = makeTestTiles({A:9, B:2})
    const state = new HonorSystemTilesState({
      players: makePlayers('John', 'Dave'),
      rackCapacity: 4,
      tiles,
      tileSystemSettings: 1,
    })
    const daveWord = makeTestTiles({A:3, B:1})
    const stateId = await state.playTurns(
      new Turn('John', 1 as TurnNumber, {exchangeTileIndices: []}),
      new Turn('Dave', 2 as TurnNumber, {playTiles: daveWord}),
    )
    expect(stateId).toEqual(2)
    expect(state.numberOfTilesInBag).toEqual(0)
    expect(state.numberOfTurnsPlayed).toEqual(2)
    expect(state.stateId).toEqual(state.numberOfTurnsPlayed)
    expect(state.countTiles('John')).toEqual(4)
    expect(state.countTiles('Dave')).toEqual(3)
    expect([...getAllTiles(state), ...daveWord]).toEqual(expect.arrayContaining(tiles))
  })

  describe('validation', () => {
    it('should throw on duplicate player IDs', () => {
      const tiles = makeTestTiles({A:1})
      expect(() => new HonorSystemTilesState({
        players: makePlayers('John', 'John'),
        rackCapacity: 1,
        tiles,
        tileSystemSettings: 1,
      })).toThrow('The player IDs are not unique: John,John')
    })

    it('should throw on unknown player ID in countTiles', () => {
      const tiles = makeTestTiles({A:1})
      const state = new HonorSystemTilesState({
        players: makePlayers('John'),
        rackCapacity: 1,
        tiles,
        tileSystemSettings: 1,
      })
      expect(() => state.countTiles('Dave')).toThrow('Unknown playerId: Dave')
    })

    it('should throw on unknown player ID in getTiles', async () => {
      const tiles = makeTestTiles({A:1})
      const state = new HonorSystemTilesState({
        players: makePlayers('John'),
        rackCapacity: 1,
        tiles,
        tileSystemSettings: 1,
      })
      try {
        await state.getTiles('Dave')
        expect.unreachable()
      } catch (e: any) {
        expect(e.message).toBe('Unknown playerId: Dave')
      }
    })

    it('should throw when playing a tile that is not on the rack', async () => {
      const tiles = makeTestTiles({A:5})
      const state = new HonorSystemTilesState({
        players: makePlayers('John'),
        rackCapacity: 4,
        tiles,
        tileSystemSettings: 1,
      })
      const tileToPlay = new Tile({letter: 'B', value: 1})
      try {
        await state.playTurns(new Turn('John', 1 as TurnNumber, {playTiles: [tileToPlay]}))
        expect.unreachable()
      } catch (e: any) {
        expect(e.message).toBe(`Player John does not hold tile ${tileToPlay.toString()}`)
      }
    })

    it('should throw when exchanging tiles with invalid indices', async () => {
      const tiles = makeTestTiles({A:5})
      const state = new HonorSystemTilesState({
        players: makePlayers('John'),
        rackCapacity: 4,
        tiles,
        tileSystemSettings: 1,
      })
      try {
        await state.playTurns(new Turn('John', 1 as TurnNumber, {exchangeTileIndices: [0, 0]}))
        expect.unreachable()
      } catch (e: any) {
        expect(e.message).toBe('exchangeTileIndices contains duplicates: 0,0')
      }
      try {
        await state.playTurns(new Turn('John', 1 as TurnNumber, {exchangeTileIndices: [-1]}))
        expect.unreachable()
      } catch (e: any) {
        expect(e.message).toBe('Index -1 is out of rack range 0..3.')
      }
      try {
        await state.playTurns(new Turn('John', 1 as TurnNumber, {exchangeTileIndices: [4]}))
        expect.unreachable()
      } catch (e: any) {
        expect(e.message).toBe('Index 4 is out of rack range 0..3.')
      }
    })

    it('should throw on unknown player ID in playTurns', async () => {
      const tiles = makeTestTiles({A:1})
      const state = new HonorSystemTilesState({
        players: makePlayers('John'),
        rackCapacity: 1,
        tiles,
        tileSystemSettings: 1,
      })
      try {
        await state.playTurns(new Turn('Dave', 1 as TurnNumber, {exchangeTileIndices: []}))
        expect.unreachable()
      } catch (e: any) {
        expect(e.message).toBe('Unknown playerId: Dave')
      }
    })
  })

  describe('json', () => {
    it('should be serializable to and from JSON', () => {
      const tiles = makeTestTiles({A:9, B:2})
      const state = new HonorSystemTilesState({
        players: makePlayers('John', 'Dave'),
        rackCapacity: 4,
        tiles,
        tileSystemSettings: 1,
      })
      const stateAsJson = JSON.parse(JSON.stringify(state))
      const stateFromJson = HonorSystemTilesState.fromJSON(stateAsJson)
      expect(stateFromJson).toEqual(state)
      const stateWithDifferentRackCapacity = HonorSystemTilesState.fromJSON({
        ...stateAsJson,
        rackCapacity: 7
      })
      expect(stateWithDifferentRackCapacity.rackCapacity).not.toEqual(state.rackCapacity)
    })

    it('should reject invalid json', () => {
      const tiles = makeTestTiles({A:9, B:2})
      const state = new HonorSystemTilesState({
        players: makePlayers('John', 'Dave'),
        rackCapacity: 4,
        tiles,
        tileSystemSettings: 1,
      })
      const stateAsJson = JSON.parse(JSON.stringify(state))
      expect(() => HonorSystemTilesState.fromJSON('frob')).toThrow(TypeError)
      expect(() => HonorSystemTilesState.fromJSON({
        ...stateAsJson,
        bag: 1
      })).toThrow(TypeError)
      expect(() => HonorSystemTilesState.fromJSON({
        ...stateAsJson,
        racks: 'frob'
      })).toThrow(TypeError)
      expect(() => HonorSystemTilesState.fromJSON({
        ...stateAsJson,
        racks: {John: 'frob'}
      })).toThrow(TypeError)
      expect(() => HonorSystemTilesState.fromJSON({
        ...stateAsJson,
        racks: {John: ['frob']}
      })).toThrow(TypeError)
      expect(() => HonorSystemTilesState.fromJSON({
        ...stateAsJson,
        rackCapacity: 'frob'
      })).toThrow(TypeError)
    })
  })    
})
