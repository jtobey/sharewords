/**
 * @file Settings for starting new games.
 */

import type { Serializable } from './serializable.js'
import { arraysEqual } from './validation.js'
import { getBagDefaults, type BagDefaults } from './bag_defaults.js'
import { Player } from './player.js'
import { PROTOCOL_VERSION } from './version.js'
import type { DictionaryType } from './dictionary.js'

export type GameId = string & { '__brand': 'GameId' }

export function toGameId(gameIdStr: string) {
  return gameIdStr as GameId
}

export function fromGameId(gameId: GameId) {
  return gameId as string
}

export function makeGameId(
  now = Date.now()
) {
  const ALPHABET = '123456789BCDFGHJKLMNPQRSTVWXYZbcdfghjkmnpqrstvwxyz'
  const base = BigInt(ALPHABET.length)
  let n = BigInt(Math.floor(now))
  let id = ''
  while (id.length < 7) {
    id = ALPHABET[Number(n % base)]! + id
    n /= base
  }
  return toGameId(id)
}

export let DEFAULT_BOARD_LAYOUT = [
  'D..d..T......T.', // Row 0
  '.D...D...t.t..T', // Row 1
  '..D.....t...t..',
  'd..D...t.....t.',
  '....D.t...D....',
  '.D...t.d.....t.',
  'T...d...d...t..',
  '...d.t...d.t...',
  '..d...t...t...T',
  '.d.....t.d...D.',
  '....D...d.D....',
  '.d.....d...D..d',
  '..d...d.....D..',
  'T..d.d...D...D.',
  '.T......T..d..D', // Row 14
]

export let DEFAULT_BINGO_BONUS = 42
export let DEFAULT_RACK_CAPACITY = 7

export class Settings {
  gameId: GameId | undefined  // Not serialized with Settings.
  baseUrl = 'http://nonet/'  // Not serialized with Settings.
  version = PROTOCOL_VERSION
  players = ['1', '2'].map(id => new Player({id}))
  maxPlayerNameLength = 50
  boardLayout = [...DEFAULT_BOARD_LAYOUT]
  bingoBonus = DEFAULT_BINGO_BONUS
  rackCapacity = DEFAULT_RACK_CAPACITY
  tileSystemType = 'honor' as 'honor'
  tileSystemSettings = {seed: '1'}
  dictionaryType: DictionaryType = 'permissive'
  dictionarySettings = null as Serializable

  private constructor(
    bagDefaults: BagDefaults,
    public letterCounts = bagDefaults.letterCounts,
    public letterValues = bagDefaults.letterValues,
  ) {}

  static forLanguage(bagLanguage: string): Settings | null;
  static forLanguage(bagLanguage: ''): Settings;
  static forLanguage(bagLanguage: 'en'): Settings;

  static forLanguage(bagLanguage: string) {
    const boardSize = DEFAULT_BOARD_LAYOUT.reduce((acc, row) => acc + row.length, 0);
    const tileCount = Math.round(boardSize / (15 * 15) * 100);
    const defaults = getBagDefaults(bagLanguage, tileCount)
    return defaults && new Settings(defaults)
  }

  toJSON() {
    return {
      version: this.version,
      players: this.players.map(p => p.toJSON()),
      letterCounts: mapToJSON(this.letterCounts),
      letterValues: mapToJSON(this.letterValues),
      boardLayout: this.boardLayout,
      bingoBonus: this.bingoBonus,
      rackCapacity: this.rackCapacity,
      tileSystemType: this.tileSystemType,
      tileSystemSettings: this.tileSystemSettings,
      dictionaryType: this.dictionaryType,
      dictionarySettings: this.dictionarySettings,
    }
  }

  static fromJSON(json: any) {
    if (!(typeof json === 'object'
      && arraysEqual([...Object.keys(json)], [
        'version', 'players', 'letterCounts', 'letterValues', 'boardLayout',
        'bingoBonus', 'rackCapacity', 'tileSystemType', 'tileSystemSettings',
        'dictionaryType', 'dictionarySettings',
      ])
      && json.version === PROTOCOL_VERSION
      && Array.isArray(json.players)
      && Array.isArray(json.boardLayout)
      && json.boardLayout.every((s: any) => typeof s === 'string')
      && typeof json.bingoBonus === 'number'
      && typeof json.rackCapacity === 'number'
      && json.tileSystemType === 'honor'
      && typeof json.tileSystemSettings === 'object'
      && typeof json.tileSystemSettings.seed === 'string'
      && ['permissive', 'freeapi', 'custom'].includes(json.dictionaryType))) {
        throw new TypeError(`Invalid Settings serialization: ${JSON.stringify(json)}`)
      }
    const settings = Settings.forLanguage('')
    settings.version = json.version
    settings.players = json.players.map(Player.fromJSON)
    settings.letterCounts = checkLetterToNumberMap('letterCounts', json.letterCounts)
    settings.letterValues = checkLetterToNumberMap('letterValues', json.letterValues)
    settings.boardLayout = json.boardLayout
    settings.bingoBonus = json.bingoBonus
    settings.rackCapacity = json.rackCapacity
    settings.tileSystemType = json.tileSystemType
    settings.tileSystemSettings = json.tileSystemSettings
    settings.dictionaryType = json.dictionaryType
    settings.dictionarySettings = json.dictionarySettings
    return settings
  }
}

function checkLetterToNumberMap(name: string, json: any): Map<string, number> {
  function fail(msg: string): never {
    throw new TypeError(`Invalid Settings.${name} serialization: ${msg}`)
  }
  if (!Array.isArray(json)) {
    if (typeof json !== 'object') fail(`Type is "${typeof json}", not "object" as expected.`)
    // Compatibility with peoples' localStorage.
    json = [...Object.entries(json)]
  }
  json.forEach(([k, v]: any) => {
    if (typeof k !== 'string') fail(`Letter ${k} has type "${typeof k}", not "string" as expected.`)
    if (typeof v !== 'number') fail(`Letter ${k} has value ${v}, not a number as expected.`)
  })
  return new Map(json)
}

function mapToJSON(map: ReadonlyMap<string, number> | object) {
  // TODO - Remove this object-compatibility code.
  if (!(map instanceof Map)) return Object.entries(map)
  return [...map.entries()]
}
