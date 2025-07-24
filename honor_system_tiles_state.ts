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
      rackCapacity: this.rackCapacity,
      numberOfTurnsPlayed: this._numberOfTurnsPlayed,
      bag: this.bag.toJSON(),
      racks: Object.fromEntries(this.racks.entries().map(([playerId, rack]) => [playerId, rack.map(tile => tile.toJSON())]))
    }
  }
  static fromJSON(json: any) {
    if (!(typeof json === 'object'
      && typeof json.rackCapacity === 'number'
      && typeof json.numberOfTurnsPlayed === 'number'
      && typeof json.racks === 'object'
      && Object.values(json.racks).every(Array.isArray))) {
        throw new TypeError(`invalid HonorSystemTileState serialization: ${json}`)
      }
    const bag = HonorSystemBag.fromJSON(json.bag)
    const racks = new Map<string, Array<Tile>>
    for (const [playerId, rackJson] of Object.entries(json.racks)) {
      racks.set(playerId, (rackJson as Array<any>).map(Tile.fromJSON))
    }
    const state = new HonorSystemTilesState({
      rackCapacity: json.rackCapacity,
      tiles: [],      // Filled in via `bag` and `racks` below.
      randomSeed: 0,  // Filled in via `bag` below.
      playerIds: [],  // Filled in via `racks` below.
    });  // semicolon required
    (state as unknown as {bag: HonorSystemBag}).bag = bag;
    (state as unknown as {racks: Map<string, Array<Tile>>}).racks = racks;
    (state as unknown as {_numberOfTurnsPlayed: number})._numberOfTurnsPlayed = json.numberOfTurnsPlayed
    return state
  }
}

/**
 * @returns A copy of `indices`.
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
