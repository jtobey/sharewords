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

export type TurnData = { turnNumber: TurnNumber, paramsStr: string }

/**
 * @returns {{ wroteHistory: boolean }}
 */
export function updateTurnHistory({
  history, nextTurnNumber, finalTurnNumber, turns
}: {
  history: Array<Readonly<TurnData>>,
  nextTurnNumber: TurnNumber,
  finalTurnNumber: TurnNumber | null,
  turns: ReadonlyArray<Turn>,
}) {
  let wroteHistory = false
  for (const turn of turns) {
    // Convert {playerId, turnNumber, move} to TurnData.
    if (fromTurnNumber(turn.turnNumber) >= nextTurnNumber) {
      // `gameState.shared.playTurns` must have returned early.
      break
    }
    if (history.length) {
      const latestTurnNumber = fromTurnNumber(history.slice(-1)[0]!.turnNumber)
      if (fromTurnNumber(turn.turnNumber) <= latestTurnNumber) continue
    }
    const params = new URLSearchParams
    const addExtra = () => {
      if (turn.extraParams) {
        for (const [key, value] of turn.extraParams) {
          params.set(key, value)
        }
      }
    }
    if ('playTiles' in turn.move) {
      params.set('wl', `${turn.row}.${turn.col}`)
      addExtra()
      if (turn.blanks?.length) params.set('bt', turn.blanks.join('.'))
      // Keep the word last so that it stands out in the URL.
      params.set(turn.vertical ? 'wv' : 'wh', turn.mainWord!)
    } else if ('exchangeTileIndices' in turn.move) {
      params.set('ex', turn.move.exchangeTileIndices.join('.'))
      addExtra()
    }
    history.push({turnNumber: turn.turnNumber, paramsStr: String(params)})
    wroteHistory = true
    if (turn.turnNumber === finalTurnNumber) break
  }
  return {wroteHistory}
}
