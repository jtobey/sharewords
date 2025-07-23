/**
 * @file Abstract tuple of bag and player racks.
 *
 * @description
 * A TilesState represents information about how many and which tiles are in
 * the bag and in each player's rack. It does not know about tiles committed
 * to the board.
 */

import type { Serializable } from './serializable.js'

export interface TilesState<Tile extends Serializable> extends Serializable {
  /** A rack's capacity, for example 7 tiles. All racks have the same capacity. */
  readonly rackCapacity: number
  /** The number of unheld tiles remaining in the bag, for example 86. */
  readonly numberOfTilesInBag: number
  /**
   * Returns the number of tiles currently in the given player's rack, assuming that all outstanding promises are fulfilled.
   */
  countTiles({playerId}: Readonly<{playerId: string}>)
  /**
   * Records the given player attempting to place the given tiles on the board.
   *
   * On success, transfers tiles from the bag to the player's rack until either the rack reaches capacity or the bag empties.
   *
   * @throws Will throw if it is not the specified player's turn.
   * @throws Will throw if the player does not hold such tiles.
   */
  playTiles({playerId, tilesToPlay}: Readonly<{playerId: string, tilesToPlay: ReadonlyArray<Tile>}>): Promise<void>
  /**
   * Records the given player returning the specified tiles to the bag and drawing replacements.
   *
   * @throws Will throw if it is not the specified player's turn.
   * @throws Will throw if the player holds fewer tiles than specified.
   * @throws Will throw if the bag holds fewer tiles than specified.
   */
  exchangeTiles({playerId, tileIndicesInRack}: Readonly<{playerId: string, tileIndicesInRack}>): void
  /**
   * Returns the given player's tiles.
   * @throws Will throw if not permitted.
   */
  getTiles({playerId}: Readonly<{playerId: string}>): Promise<Array<Tile>>
}
