/**
 * @file Abstract, shuffled bag from which tiles may be drawn and exchanged.
 */

import type { Serializable } from './serializable.js'

export interface Bag<Tile extends Serializable> extends Serializable {
  /** Number of tiles in the bag. */
  readonly size: number
  /** Removes tiles from the bag. */
  draw(numberOfTiles: number): Promise<Array<Tile>>
  /** Swaps a group of tiles with a like number chosen from the bag. */
  exchange(tilesToExhange: ReadonlyArray<Tile>): Promise<Array<Tile>>
}
