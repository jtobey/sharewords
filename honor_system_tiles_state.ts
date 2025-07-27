/**
 * @file TilesState with no strong security against peeking.
 */

import { Player } from './player.js'
import type { TilesState } from './tiles_state.js'
import { Turn } from './turn.js'
import { Tile } from './tile.js'
import { HonorSystemBag } from './honor_system_bag.js'

export class HonorSystemTilesState implements TilesState {
  readonly rackCapacity: number
  private numberOfTurnsPlayed: number
  private readonly bag: HonorSystemBag
  private readonly racks: ReadonlyMap<string, Array<Tile>>
  constructor({players, rackCapacity, tiles, tileSystemSettings}: Readonly<{
    players: ReadonlyArray<Player>
    rackCapacity: number
    tiles: Iterable<Tile>
    tileSystemSettings: any
  }>) {
    const playerIds = players.map(p => p.id)
    if ([...new Set(playerIds)].length !== playerIds.length) {
      throw new Error(`The player IDs are not unique: ${playerIds}`)
    }
    if (typeof tileSystemSettings !== 'number') {
      throw new TypeError('tileSystemSettings should be a number used as a random seed.')
    }
    this.rackCapacity = rackCapacity
    this.numberOfTurnsPlayed = 0
    this.bag = new HonorSystemBag(tiles, tileSystemSettings)
    this.racks = new Map(playerIds.map(playerId => [playerId, []]))
    if (this.bag.size > 0) {
      for (const rack of this.racks.values()) {
        rack.push(...this.bag.draw(this.rackCapacity))
      }
    }
  }
  get numberOfTilesInBag() { return this.bag.size }
  get stateId() { return this.numberOfTurnsPlayed }
  countTiles(playerId: string) { return this.getRack(playerId).length }
  getTiles(playerId: string) {
    return Promise.resolve([...this.getRack(playerId)])
  }
  playTurns(...turnsToPlay: Array<Turn>) {
    for (const turn of turnsToPlay) {
      this.playOneTurn(turn)
    }
    return Promise.resolve(this.stateId)
  }
  private playOneTurn(turn: Turn) {
    const rack = this.getRack(turn.playerId)
    const rackCopy = [...rack]
    if ('playTiles' in turn.move) {
      for (const tileToPlay of turn.move.playTiles) {
        const index = rackCopy.findIndex(rackTile => rackTile.equals(tileToPlay.tile))
        if (index === -1) {
          throw new Error(`Player ${turn.playerId} does not hold tile ${tileToPlay.tile.toString()}`)
        }
        rackCopy.splice(index, 1)
      }
      const numberOfTilesToDraw = Math.min(rack.length - rackCopy.length, this.bag.size)
      rackCopy.push(...this.bag.draw(numberOfTilesToDraw))
    } else if ('exchangeTileIndices' in turn.move) {
      const indicesOfTilesToExchange = checkIndices(turn.move.exchangeTileIndices, rackCopy.length)
      indicesOfTilesToExchange.sort((a, b) => b - a)  // Descending index order for splice.
      const tilesToExchange: Array<Tile> = []
      for (const indexOfTileToExchange of indicesOfTilesToExchange) {
        tilesToExchange.push(...rackCopy.splice(indexOfTileToExchange, 1))
      }
      rackCopy.push(...this.bag.exchange(tilesToExchange))
    }
    rack.splice(0, rack.length, ...rackCopy)
    this.numberOfTurnsPlayed += 1
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
      numberOfTurnsPlayed: this.numberOfTurnsPlayed,
      bag: this.bag.toJSON(),
      racks: Object.fromEntries(this.racks.entries().map(([playerId, rack]) => [playerId, rack.map(tile => tile.toJSON())]))
    }
  }
  static fromJSON(json: any) {
    if (!(typeof json === 'object'
      && typeof json.rackCapacity === 'number'
      && typeof json.numberOfTurnsPlayed === 'number'
      && typeof json.racks === 'object'  // TODO: Make it an array of entries.
      && Object.values(json.racks).every(Array.isArray)
      && typeof json.bag === 'object'
    )) {
        throw new TypeError(`invalid HonorSystemTileState serialization: ${json}`)
      }
    const bag = HonorSystemBag.fromJSON(json.bag)
    const racks = new Map<string, Array<Tile>>
    for (const [playerId, rackJson] of Object.entries(json.racks)) {
      racks.set(playerId, (rackJson as Array<any>).map(Tile.fromJSON))
    }
    const state = Object.create(HonorSystemTilesState.prototype);
    (state as any).rackCapacity = json.rackCapacity;
    (state as any).numberOfTurnsPlayed = json.numberOfTurnsPlayed;
    (state as any).bag = bag;
    (state as any).racks = racks;
    return state;
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
