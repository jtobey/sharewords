/**
 * @file TilesState with no strong security against peeking.
 */

import type { TilesState, PlayTurnsArgType } from './tiles_state.js'
import { Tile } from './tile.js'
import { HonorSystemBag, createHonorSystemBag } from './honor_system_bag.js'

export class HonorSystemTilesState implements TilesState {
  readonly rackCapacity: number
  private _numberOfTurnsPlayed: number
  private readonly bag: HonorSystemBag
  private readonly racks: ReadonlyMap<string, Array<Tile>>
  constructor({rackCapacity, tiles, randomSeed, playerIds}: Readonly<{
    rackCapacity: number
    tiles: Iterable<Tile>
    randomSeed: number
    playerIds: ReadonlyArray<string>
  }>) {
    if ([...new Set(playerIds)].length !== playerIds.length) {
      throw new Error(`The player IDs are not unique: ${playerIds}`)
    }
    this.rackCapacity = rackCapacity
    this._numberOfTurnsPlayed = 0
    this.bag = createHonorSystemBag({tiles, randomSeed})
    this.racks = new Map(playerIds.map(playerId => [playerId, this.bag.draw(this.rackCapacity)]))
  }
  get numberOfTilesInBag() { return this.bag.size }
  get numberOfTurnsPlayed() { return this._numberOfTurnsPlayed }
  get stateId() { return this._numberOfTurnsPlayed }
  countTiles(playerId: string) { return this.getRack(playerId).length }
  getTiles(playerId: string) {
    return Promise.resolve([...this.getRack(playerId)])
  }
  playTurns(...turnsToPlay: Array<PlayTurnsArgType>) {
    for (const turn of turnsToPlay) {
      this.playOneTurn(turn)
    }
    return Promise.resolve(this.stateId)
  }
  private playOneTurn(turn: PlayTurnsArgType) {
    const rack = this.getRack(turn.playerId)
    const rackCopy = [...rack]
    if ('playTiles' in turn) {
      for (const tileToPlay of turn.playTiles) {
        const index = rackCopy.findIndex(rackTile => rackTile.equals(tileToPlay))
        if (index === -1) {
          throw new Error(`Player ${turn.playerId} does not hold tile ${tileToPlay.toString()}`)
        }
        rackCopy.splice(index, 1)
      }
      const numberOfTilesToDraw = Math.min(rack.length - rackCopy.length, this.bag.size)
      rackCopy.push(...this.bag.draw(numberOfTilesToDraw))
    } else if ('exchangeTileIndices' in turn) {
      const indicesOfTilesToExchange = checkIndices(turn.exchangeTileIndices, rackCopy.length)
      indicesOfTilesToExchange.sort((a, b) => b - a)  // Descending index order for splice.
      const tilesToExchange: Array<Tile> = []
      for (const indexOfTileToExchange of indicesOfTilesToExchange) {
        tilesToExchange.push(...rackCopy.splice(indexOfTileToExchange, 1))
      }
      rackCopy.push(...this.bag.exchange(tilesToExchange))
    }
    rack.splice(0, rack.length, ...rackCopy)
    this._numberOfTurnsPlayed += 1
  }
  private getRack(playerId: string): Array<Tile> {
    const rack = this.racks.get(playerId)
    if (rack === undefined) {
      throw new Error(`Unknown playerId: ${playerId}`)
    }
    return rack
  }
  toJSON() {
    return {
      bag: this.bag.toJSON(),
      racks: Object.fromEntries(this.racks.entries().map(([playerId, rack]) => [playerId, rack.map(tile => tile.toJSON())]))
    }
  }
}

/**
 * @returns A copy if `indices`.
 * @throws Will throw if `indices` contains duplicates.
 * @throws {RangeError} Will throw if any index is a non-integer or out of range for an array of the given length.
 */
function checkIndices(indices: ReadonlyArray<number>, length: number) {
  if ([...new Set(indices)].length !== indices.length) {
    throw new Error(`exchangeTileIndices contains duplicates: ${indices}`)
  }
  for (const index of indices) {
    if (index !== Math.floor(index) || index < 0 || index >= length) {
      throw new RangeError(`Index ${index} is out of rack range 0..${length - 1}.`)
    }
  }
  return [...indices]
}
