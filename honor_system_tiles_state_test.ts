import { expect, describe, it } from 'bun:test'
import { Tile } from './tile.ts'
import { HonorSystemTilesState } from './honor_system_tiles_state.js'

function tileDistribution(...countsLettersAndValues: Array<[number, string, number]>) {
  const tiles: Array<Tile> = []
  for (const [count, letter, value] of countsLettersAndValues) {
    tiles.push(...Array(count).fill(new Tile({letter, value})))
  }
  return tiles
}

function allTiles(tilesState: HonorSystemTilesState) {
  const tiles = [...(tilesState as unknown as {bag: {tiles: Iterable<Tile>}}).bag.tiles]
  for (const rack of (tilesState as unknown as {racks: Map<any, Iterable<Tile>>}).racks.values()) {
    tiles.push(...rack)
  }
  return tiles
}

describe('honor system tiles state', () => {
  it('should initialize', () => {
    const tiles = tileDistribution([9, 'A', 1], [2, 'B', 3])
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
    expect(allTiles(state)).toEqual(expect.arrayContaining(tiles))
  })
  it('should play turns', async () => {
    const tiles = tileDistribution([9, 'A', 1], [2, 'B', 3])
    const state = new HonorSystemTilesState({
      rackCapacity: 4,
      tiles,
      randomSeed: 1,
      playerIds: ['John', 'Dave']
    })
    const daveWord = tileDistribution([3, 'A', 1], [1, 'B', 3])
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
    expect([...allTiles(state), ...daveWord]).toEqual(expect.arrayContaining(tiles))
  })
  // TODO: Test validation.
})
