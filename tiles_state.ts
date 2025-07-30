/**
 * @file Abstract tuple of bag and player racks.
 *
 * @description
 * A TilesState represents information about how many and which tiles are in
 * the bag and in each player's rack. It does not know about tiles committed
 * to the board.
 */

import { Tile } from './tile.js'
import { Turn } from './turn.js'
import { checkIndices } from './validation.ts'

export interface TilesState {
  /**
   * A rack's capacity, for example 7 tiles.
   * Within a game, all racks have the same capacity.
   */
  readonly rackCapacity: number
  /** The last value returned by `playTurns`. May be an opaque identifier. */
  readonly stateId: any
  /** The number of unheld tiles remaining in the bag, for example 86. */
  readonly numberOfTilesInBag: number
  /** True whenever the bag and any rack are empty. */
  readonly isGameOver: boolean

  /**
   * @returns The number of tiles currently in the given player's rack.
   */
  countTiles(playerId: string): number
  /**
   * @returns The given player's tiles.
   * @throws Will throw if not permitted.
   */
  getTiles(playerId: string): Promise<Array<Tile>>
  /**
   * Records turns played in the order given.
   *
   * `stateId = await tilesState.playTurns(...turnsToPlay)` is equivalent to:
   * ```
   * for (const turn of turnsToPlay) {
   *   await tilesState.playTurns(turn)
   * }
   * stateId = tilesState.stateId
   * ```
   *
   * When a `playTiles` turn succeeds, tiles are transferred from the bag to the player's rack
   * until either the rack reaches capacity or the bag empties.
   *
   * When an `exchangeTileIndices` turn succeeds, replacement tiles are drawn from the bag to
   * the player's rack, and the exchanged tiles are shuffled into the bag.
   *
   * @returns {any} The resulting {@link stateId} value.
   * @throws Will throw if it is not a specified player's turn.
   * @throws Will throw if the player does not hold tiles specified to play.
   * @throws {RangeError} Will throw if a return tile index is out of range.
   * @throws Will throw if the exchange tile indices contain duplicates.
   * @throws Will throw if the bag holds fewer tiles than specified for exchange.
   */
  playTurns(...turnsToPlay: Array<Turn>): Promise<any>
  toJSON(): any
}

/**
 * @returns A copy of `indices`.
 * @throws Will throw if `indices` contains duplicates.
 * @throws {RangeError} Will throw if any index is a non-integer or out of range for an array of the given length.
 */
export function checkIndicesForExchange(length: number, ...indices: ReadonlyArray<number>) {
  if ([...new Set(indices)].length !== indices.length) {
    throw new Error(`exchangeTileIndices contains duplicates: ${indices}`)
  }
  checkIndices(length, ...indices)
  return [...indices]
}
