/**
 * @file Abstract tuple of bag and player racks.
 *
 * @description
 * A TilesState represents information about how many and which tiles are in
 * the bag in each player's rack. It does not know about tiles committed to the
 * board.
 */

import type { Serializable } from './serializable.js'
import type { Bag } from './bag.js'

export class TilesState<Tile extends Serializable> implements Serializable {
  readonly rackSize: number
  private readonly bag: Bag<Tile>
  private readonly racks: ReadonlyMap<string, Array<Tile>>
  constructor({rackSize, bag, playerIds}: Readonly<{rackSize: number, bag: Bag<Tile>; playerIds: ReadonlyArray<string>}>) {
    this.rackSize = rackSize
    this.bag = bag
    this.racks = new Map(playerIds.map(playerId => [playerId, []]))
  }
  private getRack(playerId: string) {
    const rack = this.racks.get(playerId)
    if (rack === undefined) {
      throw new Error(`Unknown playerId: ${playerId}`)
    }
    return rack
  }
  async drawForPlayer(playerId: string) {
    const rack = this.getRack(playerId)
    const numberOfTiles = Math.min(this.rackSize - rack.length, this.bag.size)
    const newTiles = await this.bag.draw(numberOfTiles)
    rack.push(...newTiles)
    return newTiles
  }
  async exchangeForPlayer({playerId, tilesToExchange}: Readonly<{playerId: string; tilesToExchange: ReadonlyArray<Tile>}>) {
    const rack = this.getRack(playerId)
    const rackCopy = [...rack]
    for (const tileToExchange of tilesToExchange) {
      const index = rackCopy.lastIndexOf(tileToExchange)
      if (index === -1) {
        throw new Error(`Player ${playerId} attempted to exchange an unheld tile: ${tileToExchange}`)
      }
      rackCopy.splice(index, 1)
    }
    const newTiles = await this.bag.exchange(tilesToExchange)
    rack.push(...newTiles)
    return newTiles
  }
  toJSON() {
    return {
      bag: this.bag.toJSON(),
      racks: Object.fromEntries(this.racks.entries().map(([playerId, rack]) => [playerId, rack.map(tile => tile.toJSON())]))
    }
  }
}
