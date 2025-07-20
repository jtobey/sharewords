/**
 * @file Abstract, shuffled bag from which tiles may be drawn and exchanged.
 */

import type { Serializable } from './serializable.js'

export interface Bag<Tile extends Serializable> extends Serializable {
  /** Number of tiles in the bag. */
  size: number
  /** Removes tiles from the bag. */
  draw(numberOfElements: number): Array<Tile>
  /** Swaps a group of tiles with a like number chosen from the bag. */
  exchange(elementsToExhange: ReadonlyArray<Tile>): Array<Tile>
}
