import type { Serializable } from './serializable.js'
import type { TilePlacement } from './tile.js'

export type TurnNumber = number & { '__brand': 'TurnNumber' }

export class Turn {
  constructor(readonly playerId: string, readonly turnNumber: TurnNumber, readonly move: {
    playTiles: ReadonlyArray<TilePlacement>
  } | {
    exchangeTileIndices: ReadonlyArray<number>
  }) {
    if ('playTiles' in move && 'exchangeTileIndices' in move) {
      throw new Error(`Can't exchange and play tiles on the same turn. Turn number is ${turnNumber}.`)
    }
  }
}
