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
 *   - name
 *   - number of tiles on rack
 *   - score
 *
 * With the honor system, "shared tile state" contains the identities of all
 * tiles in the bag and on each player's rack. A secure tile manager configured
 * with a deck server URL could instead use an opaque identifier as the shared
 * tile state.
 */

import { arraysEqual, objectsEqual } from './validation.js'
import { Settings, makeGameId, fromGameId, toGameId, type GameId } from './settings.js'
import { type TilesState, checkIndicesForExchange } from './tiles_state.js'
import { Turn, toTurnNumber, fromTurnNumber, nextTurnNumber } from './turn.js'
import type { TurnNumber, TurnData } from './turn.js'
import { HonorSystemTilesState } from './honor_system_tiles_state.js'
import { Board } from './board.ts'
import { Tile, type BoardPlacement, makeTiles } from './tile.js'
import { makeDictionary } from './dictionary.js'
import { Player } from './player.js'

export class UrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UrlError'
  }
}

export class SharedState {
  constructor(
    readonly settings: Readonly<Settings>,
    readonly gameId = settings.gameId ?? makeGameId() as GameId,
    readonly board = new Board(...settings.boardLayout),
    readonly tilesState = makeTilesState(settings),
    public nextTurnNumber = toTurnNumber(1),
    private checkWords = makeDictionary(settings.dictionaryType, settings.dictionarySettings),
    readonly gameParams = gameParamsFromSettings(settings),
  ) {
    this.settings.players.forEach((player, index) => {
      const expected = String(index + 1)
      if (player.id !== expected) {
        throw new Error(`players[${index}] should have ID "${expected}", not "${player.id}".`)
      }
    })
  }

  copyFrom(other: SharedState) {
    // Assume that constant fields are equal.
    this.board.copyFrom(other.board)
    this.tilesState.copyFrom(other.tilesState)
    this.nextTurnNumber = other.nextTurnNumber
    this.players.forEach((player, index) => {
      player.name = other.players[index]!.name
    })
  }

  get players() { return this.settings.players }
  get isGameOver() { return this.tilesState.isGameOver }

  getPlayerForTurnNumber(turnNumber: TurnNumber) {
    return this.players[(fromTurnNumber(turnNumber) - 1) % this.players.length]!
  }

  getTurnUrlParams(turnHistory: ReadonlyArray<TurnData>) {
    const entries = [['gid', fromGameId(this.gameId)]]
    const firstHistoryTurnNumber = turnHistory[0]?.turnNumber
    // Include game settings in the URL at the start of the game.
    if (firstHistoryTurnNumber === undefined || firstHistoryTurnNumber === toTurnNumber(1)) {
      entries.push(...this.gameParams)
    }
    if (turnHistory.length) {
      entries.push(['tn', String(firstHistoryTurnNumber)])
      turnHistory.forEach((turnData: TurnData) => {
        entries.push(...new URLSearchParams(turnData.paramsStr))
      })
    } else {
      entries.push(['tn', '1'])
    }
    return new URLSearchParams(entries)
  }

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
    const turnsToPlayNow: Array<Turn> = []
    const boardChanges: Array<{playerId: string, score: number, placements: ReadonlyArray<BoardPlacement>}> = []
    const wordsToCheck = new Set<string>
    let turnNumber = this.nextTurnNumber
    for (const turn of seen.filter(t => t)) {
      if (turn.turnNumber !== turnNumber) {
        // TODO: Remember the turn.
        console.warn(`Ignoring out-of-order turn number ${turn.turnNumber}; expected ${turnNumber}.`)
        break
      }
      const playerId = this.players[(fromTurnNumber(turnNumber) - 1) % this.players.length]!.id
      if (turn.playerId !== playerId) {
        throw new Error(`Turn number ${turn.turnNumber} belongs to player "${playerId}", not "${turn.playerId}".`)
      }
      if ('playTiles' in turn.move) {
        const {score, wordsFormed, row, col, vertical, blanks} = this.board.checkWordPlacement(...turn.move.playTiles)
        wordsFormed.forEach((w: string) => wordsToCheck.add(w))
        const bingoBonus = (turn.move.playTiles.length === this.tilesState.rackCapacity ? this.settings.bingoBonus : 0)
        boardChanges.push({playerId, score: score + bingoBonus, placements: turn.move.playTiles})
        turn.mainWord = wordsFormed[0]!
        turn.row = row
        turn.col = col
        turn.vertical = vertical
        turn.blanks = blanks
        console.log(`Player ${playerId} plays ${wordsFormed[0]} for ${score}`)
      } else if ('exchangeTileIndices' in turn.move) {
        checkIndicesForExchange(this.tilesState.countTiles(playerId), ...turn.move.exchangeTileIndices)
        const numAttempted = turn.move.exchangeTileIndices.length
        const numInBag = this.tilesState.numberOfTilesInBag
        if (numAttempted > numInBag) {
          throw new Error(`Player ${playerId} attempted to exchange ${numAttempted} but the bag holds only ${numInBag}.`)
        }
        if (numAttempted) {
          console.log(`Player ${playerId} exchanges ${numAttempted} tiles.`)
        } else {
          console.log(`Player ${playerId} passes.`)
        }
      } else {
        throw new Error(`Turn number ${turn.turnNumber} is not a play or exchange.`)
      }
      turnsToPlayNow.push(turn)
      turnNumber = nextTurnNumber(turnNumber)
    }
    if (wordsToCheck.size) await this.checkWords(...wordsToCheck)
    if (turnsToPlayNow.length === 0) return turnsToPlayNow
    console.debug(`Turn validation success.`)
    for (const {playerId, score, placements} of boardChanges) {
      this.board.placeTiles(...placements)
      this.board.scores.set(playerId, (this.board.scores.get(playerId) ?? 0) + score)
    }
    this.nextTurnNumber = turnNumber
    return turnsToPlayNow
  }

  *turnsFromParams(params: Iterable<[string, string]>, turnNumber: TurnNumber) {
    let wordLocationStr: string | null = null
    let blankTileIndicesStr: string | null = null
    let direction: null | 'wv' | 'wh' = null
    let wordPlayed: string | null = null
    let exchangeIndicesStr: string | null = null

    function* processPendingMoveIfAny(this: SharedState) {
      const playerId = this.getPlayerForTurnNumber(turnNumber).id

      if (wordPlayed && direction && wordLocationStr) {
        if (exchangeIndicesStr) {
          throw new UrlError(`Found both word and exchange data for turn ${turnNumber}.`)
        }

        const blankTileAssignments = [] as Array<string>
        if (blankTileIndicesStr) {
          blankTileIndicesStr.split('.').forEach((s: string) => {
            const match = s.match(/^(\d+)$/)
            if (!match) { throw new UrlError(`Invalid "bt" parameter component: "${s}"`) }
            const index = parseInt(match[1]!)
            if (index in blankTileAssignments) {
              throw new UrlError(`Duplicate blank tile assignment index: bt=${blankTileIndicesStr}`)
            }
            const assignedLetter = wordPlayed![index]
            if (!assignedLetter) {
              throw new UrlError(`Blank tile assignment index out of range: no "${wordPlayed}"[${index}].`)
            }
            blankTileAssignments[index] = assignedLetter
          })
        }

        const match = wordLocationStr.match(/^(\d+)\.(\d+)$/)
        if (!match) { throw new UrlError(`Invalid "wl" parameter: "${wordLocationStr}"`) }
        let row = parseInt(match[1]!)
        let col = parseInt(match[2]!)

        const placements = [] as Array<BoardPlacement>
        wordPlayed.split('').map((letter, letterIndex) => {
          const square = this.board.squares[row]?.[col]
          if (!square) throw new UrlError(`Attempted to play a word out of bounds: ${row},${col}.`)
          if (!square.tile) {
            // It must be a new tile from the player's rack.
            const assignedLetter = blankTileAssignments[letterIndex] ?? ''
            if (assignedLetter) {
              placements.push({tile: new Tile({letter: '', value: 0}), row, col, assignedLetter})
            } else {
              const value = this.settings.letterValues[letter]
              if (value === undefined) throw new UrlError(`Attempt to play an invalid letter: "${letter}"`)
              placements.push({tile: new Tile({letter, value}), row, col})
            }
          } else if (square.letter !== letter) {
            throw new UrlError(`Word requires "${letter}" at ${row},${col}, but "${square.letter}" is there.`)
          }
          if (direction === 'wv') { row += 1 }
          else { col += 1 }
        })
        if (blankTileAssignments.length > wordPlayed!.length) {
          throw new UrlError(
            `"bt" parameter has index ${blankTileAssignments.length - 1} out of range 0-${wordPlayed!.length - 1}.`
          )
        }
        yield new Turn(playerId, turnNumber, {playTiles: placements})

      } else if (exchangeIndicesStr != null) {
        if (wordPlayed || direction || wordLocationStr || blankTileIndicesStr) {
          throw new UrlError(
            `Incomplete data for turn ${turnNumber}: wl=${wordLocationStr} ${direction}=${wordPlayed} bt=${blankTileIndicesStr}`)
        }
        const exchangeIndexStrs = exchangeIndicesStr ? exchangeIndicesStr.split('.') : []
        const numberOfTilesInRack = this.tilesState.countTiles(playerId)
        const exchangeTileIndices: Array<number> = []
        exchangeIndexStrs.forEach(s => {
          const index = parseInt(s)
          if (isNaN(index) || index < 0 || index >= numberOfTilesInRack) {
            throw new UrlError(`Invalid exchange tile index: "${s}"`)
          }
          exchangeTileIndices.push(index)
        })
        yield new Turn(playerId, turnNumber, {exchangeTileIndices})
      } else {
        // Nothing to see here, don't bump the turn number.
        return
      }
      turnNumber = nextTurnNumber(turnNumber)
      wordLocationStr = null
      blankTileIndicesStr = null
      direction = null
      wordPlayed = null
      exchangeIndicesStr = null
    }

    for (const [key, value] of params) {
      const pnMatch = key.match(/^p(\d+)n$/)
      if (pnMatch) {
        const playerIndex = parseInt(pnMatch[1]!) - 1
        const player = this.players[playerIndex]
        if (player) {
          player.name = value
        } else {
          throw new UrlError(`Invalid turn URL: Player ID "${pnMatch[1]}" should be in 1-${this.players.length}.`)
        }
      } else if (key === 'wl') {
        // `wl` marks a new word play move.
        yield* processPendingMoveIfAny.call(this)
        wordLocationStr = value
      } else if (key === 'ex') {
        // `ex` marks a new pass/exchange move.
        yield* processPendingMoveIfAny.call(this)
        exchangeIndicesStr = value
      } else if (key === 'bt') {
        if (blankTileIndicesStr) {
          throw new UrlError(`Duplicate "bt" parameter for turn ${turnNumber}.`)
        }
        blankTileIndicesStr = value
      } else if (key === 'wv' || key === 'wh') {
        if (direction) {
          throw new UrlError(`Duplicate word parameters for turn ${turnNumber}.`)
        }
        direction = key
        wordPlayed = value
      } else {
        throw new UrlError(`Unrecognized parameter name: "${key}"`)
      }
    }
    // We are out of turn params.
    yield* processPendingMoveIfAny.call(this)
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
    function fail(msg: string): never {
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
      toTurnNumber(json.nextTurnNumber),
    )
  }
}

function gameParamsFromSettings(settings: Settings) {
  const params = new URLSearchParams
  // Not all players have played. Include any non-default game settings.
  const defaults = new Settings
  params.set('v', settings.version)
  if (!playersEqual(settings.players, defaults.players)) {
    settings.players.forEach((p, index) => {
      params.set(`p${index + 1}n`, p.name)
    })
  }
  if (!arraysEqual(settings.boardLayout, defaults.boardLayout, false)) {
    params.set('board', settings.boardLayout.join('-'))
  }
  if (settings.bingoBonus !== defaults.bingoBonus) {
    params.set('bingo', String(settings.bingoBonus))
  }
  if (!(
    objectsEqual(settings.letterCounts, defaults.letterCounts) &&
      objectsEqual(settings.letterValues, defaults.letterValues)
  )) {
    const bagParam = Object.entries(settings.letterCounts).map(
      ([letter, count]) => `${letter}-${count}-${settings.letterValues[letter] ?? 0}`
    ).join('.')
    params.set('bag', bagParam)
  }
  if (settings.rackCapacity !== defaults.rackCapacity) {
    params.set('racksize', String(settings.rackCapacity))
  }
  if (settings.tileSystemType === 'honor') {
    params.set('seed', settings.tileSystemSettings.seed)
  }
  if (settings.dictionaryType !== defaults.dictionaryType) {
    params.set('dt', settings.dictionaryType)
  }
  if (typeof settings.dictionarySettings === 'string') {
    params.set('ds', settings.dictionarySettings)
  }
  return params
}

export async function parseGameParams(allParams: Readonly<URLSearchParams>, playerId?: string) {
  // Everything up to `tn` is a game param. Everything after `tn` is a turn param.
  const gameParams = new URLSearchParams
  const turnParams = new URLSearchParams
  for (const [name, value] of allParams) {
    if (turnParams.size || name === 'tn') {
      turnParams.append(name, value)
    } else {
      gameParams.append(name, value)
    }
  }
  const settings = new Settings
  const vParam = gameParams.get('v')
  if (vParam && vParam !== settings.version) {
    throw new Error(`Protocol version not supported: ${vParam}`)
  }
  const gidParam = gameParams.get('gid')
  if (gidParam) settings.gameId = toGameId(gidParam)
  const newPlayers: Array<Player> = []
  for (let playerNumber = 1; ; ++playerNumber) {
    const pnParam = gameParams.get(`p${playerNumber}n`)
    if (!pnParam) break
    newPlayers.push(new Player({id: String(playerNumber), name: pnParam.slice(0, settings.maxPlayerNameLength)}))
  }
  if (newPlayers.length) settings.players = newPlayers
  const bagParam = gameParams.get('bag')
  if (bagParam) {
    const letterCounts: {[key: string]: number} = {}
    const letterValues: {[key: string]: number} = {}
    bagParam.split('.').map((letterCountAndValue: string) => {
      if (!letterCountAndValue.match(/^(.*)-(\d+)-(\d+)$/)) {
        throw new Error(`Invalid letter configuration in URL: ${letterCountAndValue}`)
      }
      const parts = letterCountAndValue.split('-')
      letterCounts[parts[0]!] = parseInt(parts[1]!)
      letterValues[parts[0]!] = parseInt(parts[2]!)
    })
    settings.letterCounts = letterCounts
    settings.letterValues = letterValues
  }
  const boardParam = gameParams.get('board')
  if (boardParam) settings.boardLayout = boardParam.split('-')
  const bingoParam = gameParams.get('bingo')
  if (bingoParam) settings.bingoBonus = parseInt(bingoParam)
  const racksizeParam = gameParams.get('racksize')
  if (racksizeParam) settings.rackCapacity = parseInt(racksizeParam)
  const seedParam = gameParams.get('seed')
  if (!seedParam) throw new Error('No random seed in URL.')
  settings.tileSystemSettings = {seed: seedParam}
  const dtParam = gameParams.get('dt')
  if (dtParam === 'permissive' || dtParam === 'freeapi' || dtParam === 'custom') {
    settings.dictionaryType = dtParam
  } else if (dtParam) {
    throw new Error(`Unknown dictionary type: "${dtParam}".`)
  }
  const dsParam = gameParams.get('ds')
  if (dsParam) settings.dictionarySettings = dsParam
  else if (settings.dictionaryType === 'custom') {
    throw new Error('Custom dictionary requires a URL.')
  }
  if (!playerId) {
    const urlTurnNumber = parseInt(turnParams.get('tn')!) || 1
    const turnNumber = urlTurnNumber + turnParams.getAll('wl').length + turnParams.getAll('ex').length
    playerId = settings.players[(turnNumber - 1) % settings.players.length]!.id
    console.log(`Joining as Player ${playerId}.`)
  }
  return { settings, playerId, turnParams }
}

function makeTilesState(settings: Settings): TilesState {
  if (settings.tileSystemType === 'honor') {
    return new HonorSystemTilesState(
      settings.players,
      settings.tileSystemSettings,
      makeTiles(settings),
      settings.rackCapacity,
    )
  }
  throw new Error(`Unsupported tileSystemType: ${settings.tileSystemType}`)
}

function rehydrateTilesState(tileSystemType: string, tilesStateJson: any) {
  if (tileSystemType === 'honor') return HonorSystemTilesState.fromJSON(tilesStateJson)
  throw new TypeError(`Unknown tileSystemType: ${tileSystemType}`)
}

function playersEqual(ps1: ReadonlyArray<Player>, ps2: ReadonlyArray<Player>) {
  if (ps1.length !== ps2.length) return false
  for (const index in ps1) {
    if (!ps1[index]!.equals(ps2[index])) return false
  }
  return true
}
