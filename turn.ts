import type { Serializable } from './serializable.js'
import { Tile } from './tile.js'

export type TurnNumber = number & { '__brand': 'TurnNumber' }

export class Turn {
  constructor(readonly playerId: string, readonly turnNumber: TurnNumber, readonly move: {
    playTiles: ReadonlyArray<Tile>
  } | {
    exchangeTileIndices: ReadonlyArray<number>
  }) {}
}
