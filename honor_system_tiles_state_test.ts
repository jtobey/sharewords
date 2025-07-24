import { expect, describe, it } from 'bun:test'
import { Tile, makeTiles } from './tile.ts'
import { HonorSystemTilesState } from './honor_system_tiles_state.js'

interface LetterCounts { [key: string]: number }

function makeTestTiles(letterCounts: LetterCounts) {
  return makeTiles({letterCounts, letterValues: {}})
}

function getAllTiles(tilesState: HonorSystemTilesState) {
  const tiles = [...(tilesState as unknown as {bag: {tiles: Iterable<Tile>}}).bag.tiles]
  for (const rack of (tilesState as unknown as {racks: Map<any, Iterable<Tile>>}).racks.values()) {
    tiles.push(...rack)
  }
  return tiles
}

describe('honor system tiles state', () => {
  it('should be serializable to and from JSON', () => {
    const tiles = makeTestTiles({A:9, B:2})
    const state = new HonorSystemTilesState({
      rackCapacity: 4,
      tiles,
      randomSeed: 1,
      playerIds: ['John', 'Dave']
    })
    const stateAsJson = JSON.parse(JSON.stringify(state))
    const stateFromJson = HonorSystemTilesState.fromJSON(stateAsJson)
    expect(stateFromJson).toEqual(state)
  })

  it('should initialize', () => {
    const tiles = makeTestTiles({A:9, B:2})
    const state = new HonorSystemTilesState({
      rackCapacity: 4,
      tiles,
      randomSeed: 1,
      playerIds: ['John', 'Dave']
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
      rackCapacity: 4,
      tiles,
      randomSeed: 1,
      playerIds: ['John', 'Dave']
    })
    const daveWord = makeTestTiles({A:3, B:1})
    const stateId = await state.playTurns(
      {playerId: 'John', exchangeTileIndices: []},
      {playerId: 'Dave', playTiles: daveWord},
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
        rackCapacity: 1,
        tiles,
        randomSeed: 1,
        playerIds: ['John', 'John']
      })).toThrow('The player IDs are not unique: John,John')
    })

    it('should throw on unknown player ID in countTiles', () => {
      const tiles = makeTestTiles({A:1})
      const state = new HonorSystemTilesState({
        rackCapacity: 1,
        tiles,
        randomSeed: 1,
        playerIds: ['John']
      })
      expect(() => state.countTiles('Dave')).toThrow('Unknown playerId: Dave')
    })

    it('should throw on unknown player ID in getTiles', async () => {
      const tiles = makeTestTiles({A:1})
      const state = new HonorSystemTilesState({
        rackCapacity: 1,
        tiles,
        randomSeed: 1,
        playerIds: ['John']
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
        rackCapacity: 4,
        tiles,
        randomSeed: 1,
        playerIds: ['John']
      })
      const tileToPlay = new Tile({letter: 'B', value: 1})
      try {
        await state.playTurns({playerId: 'John', playTiles: [tileToPlay]})
        expect.unreachable()
      } catch (e: any) {
        expect(e.message).toBe(`Player John does not hold tile ${tileToPlay.toString()}`)
      }
    })

    it('should throw when exchanging tiles with invalid indices', async () => {
      const tiles = makeTestTiles({A:5})
      const state = new HonorSystemTilesState({
        rackCapacity: 4,
        tiles,
        randomSeed: 1,
        playerIds: ['John']
      })
      try {
        await state.playTurns({playerId: 'John', exchangeTileIndices: [0, 0]})
        expect.unreachable()
      } catch (e: any) {
        expect(e.message).toBe('exchangeTileIndices contains duplicates: 0,0')
      }
      try {
        await state.playTurns({playerId: 'John', exchangeTileIndices: [-1]})
        expect.unreachable()
      } catch (e: any) {
        expect(e.message).toBe('Index -1 is out of rack range 0..3.')
      }
      try {
        await state.playTurns({playerId: 'John', exchangeTileIndices: [4]})
        expect.unreachable()
      } catch (e: any) {
        expect(e.message).toBe('Index 4 is out of rack range 0..3.')
      }
    })

    it('should throw on unknown player ID in playTurns', async () => {
      const tiles = makeTestTiles({A:1})
      const state = new HonorSystemTilesState({
        rackCapacity: 1,
        tiles,
        randomSeed: 1,
        playerIds: ['John']
      })
      try {
        await state.playTurns({playerId: 'Dave', exchangeTileIndices: []})
        expect.unreachable()
      } catch (e: any) {
        expect(e.message).toBe('Unknown playerId: Dave')
      }
    })
  })
})
