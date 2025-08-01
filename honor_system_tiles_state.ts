/**
 * @file TilesState with no strong security against peeking.
 */

import { Player } from './player.js'
import type { TilesState } from './tiles_state.js'
import { checkIndicesForExchange } from './tiles_state.js'
import { Turn } from './turn.js'
import { Tile } from './tile.js'
import { HonorSystemBag } from './honor_system_bag.js'

export class HonorSystemTilesState implements TilesState {
  constructor(
    // Args for SharedState.
    players: ReadonlyArray<Player>,
    tileSystemSettings: {seed: string},
    tiles: Iterable<Tile>,
    // Arg for SharedState and fromJSON.
    readonly rackCapacity: number,
    // Args for fromJSON.
    private numberOfTurnsPlayed = 0,
    private readonly racks = new Map(players.map(player => [player.id, [] as Array<Tile>])),
    private readonly bag = makeBag(tiles, tileSystemSettings, rackCapacity, racks),
    public isGameOver: boolean = false,
  ) {
    if (racks.size < players.length) {
      throw new Error(`The player IDs are not unique: ${players.map(player => player.id)}`)
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
      if (rackCopy.length === 0) this.isGameOver = true
    } else if ('exchangeTileIndices' in turn.move) {
      const indicesOfTilesToExchange = checkIndicesForExchange(rackCopy.length, ...turn.move.exchangeTileIndices)
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
    const racks = [...this.racks.entries().map(
      ([playerId, rack]) => [playerId, rack.map(tile => tile.toJSON())]
    )]
    return {
      rackCapacity: this.rackCapacity,
      numberOfTurnsPlayed: this.numberOfTurnsPlayed,
      bag: this.bag.toJSON(),
      racks,
    }
  }

  static fromJSON(json: any) {
    function fail(msg: string): never {
      throw new TypeError(`${msg} in HonorSystemTileState serialization: ${JSON.stringify(json)}`)
    }
    if (!(typeof json === 'object')) fail('Not an object')
    if (typeof json.rackCapacity !== 'number') fail('rackCapacity is not a number')
    if (typeof json.numberOfTurnsPlayed !== 'number') fail('numberOfTurnsPlayed is not a number')
    if (!Array.isArray(json.racks)) fail('Racks are not in an array.')
    const bag = HonorSystemBag.fromJSON(json.bag)
    const racks = new Map<string, Array<Tile>>
    let isGameOver = false
    for (const racksEntry of json.racks) {
      if (!Array.isArray(racksEntry)) fail('Rack list entry is not an array')
      if (racksEntry.length !== 2) fail('Rack list entry length is not 2')
      const [playerId, rackJson] = racksEntry
      if (typeof playerId !== 'string') fail('Rack list playerId is not a string')
      if (!Array.isArray(rackJson)) fail('Rack is not an array')
      if (rackJson.length > json.rackCapacity) fail('Rack length is over capacity')
      if (rackJson.length === 0) isGameOver = true
      racks.set(playerId, rackJson.map(Tile.fromJSON))
    }
    return new HonorSystemTilesState(
      [], {seed: ''}, [],  // Arguments for direct constructor calls.
      json.rackCapacity,
      json.numberOfTurnsPlayed,
      racks,
      bag,
      isGameOver,
    )
  }
}

function makeBag(
  tiles: Iterable<Tile>,
  tileSystemSettings: {seed: string},
  rackCapacity: number,
  racks: Map<string, Array<Tile>>,
) {
  const bag = new HonorSystemBag(tileSystemSettings.seed, tiles)
  for (const rack of racks.values()) {
    rack.push(...bag.draw(rackCapacity))
  }
  return bag
}
