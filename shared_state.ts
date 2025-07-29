/**
 * @file Game state shared by all players.
 * @description
 * This logically includes:
 *
 * - game settings
 *   - protocol version
 *   - board dimensions
 *   - bonus square types and positions
 *   - tile manager configuration
 *   - bingo bonus value
 *   - letter and blank distribution
 *   - letter values
 *   - rack size
 *   - optional dictionary
 *   - player IDs, names, and turn order
 * - game ID
 * - shared tile state
 * - number of turns played
 * - tiles played on the board
 * - letter assignments to blank tiles played
 * - number of tiles in the bag
 * - each player's shared state
 *   - number of tiles on rack
 *   - score
 *
 * With the honor system, "shared tile state" contains the identities of all
 * tiles in the bag and on each player's rack. A secure tile manager configured
 * with a deck server URL could instead use an opaque identifier as the shared
 * tile state.
 */

import { arraysEqual } from './serializable.js'
import { Settings } from './settings.js'
import type { GameId } from './settings.js'
import { checkIndices } from './tiles_state.js'
import type { TilesState } from './tiles_state.js'
import { Turn, nextTurnNumber } from './turn.js'
import type { TurnNumber } from './turn.js'
import { HonorSystemTilesState } from './honor_system_tiles_state.js'
import { Board } from './board.ts'
import type { TilePlacement } from './tile.ts'
import { makeTiles } from './tile.js'

export class SharedState {
  constructor(
    readonly settings: Readonly<Settings>,
    readonly gameId = settings.gameId ?? `game-${Date.now()}` as GameId,
    readonly board = new Board(...settings.boardLayout),
    readonly tilesState = makeTilesState(settings),
    public nextTurnNumber = 1 as TurnNumber,
  ) {
    this.settings.players.forEach((player, index) => {
      const expected = String(index + 1)
      if (player.id !== expected) {
        throw new Error(`players[${index}] should have ID "${expected}", not "${player.id}".`)
      }
    })
  }

  get players() { return this.settings.players }

  async playTurns(...turns: Array<Turn>) {
    const seen = []
    for (const turn of turns) {
      if (turn.turnNumber < this.nextTurnNumber) {
        console.log(`Ignoring old turn number ${turn.turnNumber}`)
      } else if (turn.turnNumber in seen) {
        throw new Error(`playTurns received duplicate turn number ${turn.turnNumber}.`)
      } else {
        seen[turn.turnNumber] = turn
      }
    }
    const turnsToPlayNow = [] as Array<Turn>
    for (const turn of seen.filter(t => t)) {
      if (turn.turnNumber !== this.nextTurnNumber) {
        // TODO: Remember the turn.
        console.warn(`Ignoring out-of-order turn number ${turn.turnNumber}; expected ${this.nextTurnNumber}.`)
        break
      }
      const playerId = this.players[(this.nextTurnNumber - 1) % this.players.length]!.id
      if (turn.playerId !== playerId) {
        throw new Error(`Turn number ${turn.turnNumber} belongs to player "${playerId}", not "${turn.playerId}".`)
      }
      if ('playTiles' in turn.move) {
        const {score, wordsFormed, row, col, vertical} = this.board.checkWordPlacement(...turn.move.playTiles)
        if (this.settings.dictionaryType === 'permissive') {
          // Nothing to check - anything is a word.
        } else {
          // TODO - Validate words *after* the turn loop.
          throw new Error(`${this.settings.dictionaryType} dictionary is not yet supported.`)
        }
        const bingoBonus = (turn.move.playTiles.length === this.tilesState.rackCapacity ? this.settings.bingoBonus : 0)
        this.board.placeTiles(...turn.move.playTiles)
        this.board.scores.set(playerId, (this.board.scores.get(playerId) ?? 0) + score + bingoBonus)
        turn.mainWord = wordsFormed[0]!
        turn.row = row
        turn.col = col
        turn.vertical = vertical
        console.log(`Player ${playerId} played ${wordsFormed[0]} for ${score}`)
      } else if ('exchangeTileIndices' in turn.move) {
        checkIndices(turn.move.exchangeTileIndices, this.tilesState.countTiles(playerId))
        const numAttempted = turn.move.exchangeTileIndices.length
        const numInBag = this.tilesState.numberOfTilesInBag
        if (numAttempted > numInBag) {
          throw new Error(`Player ${playerId} attempted to exchange ${numAttempted} but the bag holds only ${numInBag}.`)
        }
        if (numAttempted) {
          console.log(`Player ${playerId} exchanged ${numAttempted} tiles.`)
        } else {
          console.log(`Player ${playerId} passed.`)
        }
      } else {
        throw new Error(`Turn number ${turn.turnNumber} is not a play or exchange.`)
      }
      turnsToPlayNow.push(turn)
      this.nextTurnNumber = nextTurnNumber(this.nextTurnNumber)
    }
    return this.tilesState.playTurns(...turnsToPlayNow)
  }

  toJSON() {
    return {
      gameId: this.gameId,
      nextTurnNumber: this.nextTurnNumber,
      settings: this.settings.toJSON(),
      board: this.board.toJSON(),
      tilesState: this.tilesState.toJSON(),
    }
  }

  static fromJSON(json: any) {
    function fail(msg: string) {
      throw new TypeError(`${msg} in SharedState serialization: ${JSON.stringify(json)}`)
    }
    if (typeof json !== 'object') fail('Not an object')
    if (!arraysEqual([...Object.keys(json)], [
      'gameId', 'nextTurnNumber', 'settings', 'board', 'tilesState',
    ])) fail('Wrong keys or key order')
    if (typeof json.gameId !== 'string') fail('Game ID is not a string')
    if (typeof json.nextTurnNumber !== 'number') fail('Next turn number is not a number')
    const settings = Settings.fromJSON(json.settings)
    return new SharedState(
      settings,
      json.gameId as GameId,
      Board.fromJSON(json.board),
      rehydrateTilesState(settings.tileSystemType, json.tilesState),
      json.nextTurnNumber as TurnNumber,
    )
  }
}

function makeTilesState(settings: Settings): TilesState {
  if (settings.tileSystemType === 'honor') {
    return new HonorSystemTilesState({...settings, tiles: makeTiles(settings)})
  }
  throw new Error(`Unsupported tileSystemType: ${settings.tileSystemType}`)
}

function rehydrateTilesState(tileSystemType: string, tilesStateJson: any) {
  if (tileSystemType === 'honor') return HonorSystemTilesState.fromJSON(tilesStateJson)
  throw new TypeError(`Unknown tileSystemType: ${tileSystemType}`)
}
