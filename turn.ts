import type { BoardPlacement } from './tile.js'

export type TurnNumber = number & { '__brand': 'TurnNumber' }

export function toTurnNumber(n: number) {
  return n as TurnNumber
}

export function fromTurnNumber(turnNumber: TurnNumber) {
  return turnNumber as number
}

export function nextTurnNumber(turnNumber: TurnNumber) {
  return toTurnNumber(1 + fromTurnNumber(turnNumber))
}

export class Turn {
  mainWord?: string
  row?: number
  col?: number
  vertical?: boolean
  blanks?: ReadonlyArray<number>
  extraParams?: URLSearchParams

  constructor(readonly playerId: string, readonly turnNumber: TurnNumber, readonly move: {
    playTiles: ReadonlyArray<BoardPlacement>
  } | {
    exchangeTileIndices: ReadonlyArray<number>
  }) {
    if ('playTiles' in move && 'exchangeTileIndices' in move) {
      throw new Error(`Can't exchange and play tiles on the same turn. Turn number is ${turnNumber}.`)
    }
  }
}
