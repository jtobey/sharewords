import { Settings, toGameId } from './settings.js'
import { Player } from './player.js'
import { arraysEqual, mapsEqual } from './validation.js'
import { getPlayerForTurnNumber, toTurnNumber } from './turn.js'

export class UrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UrlError'
  }
}

export function gameParamsFromSettings(settings: Settings) {
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
    mapsEqual(settings.letterCounts, defaults.letterCounts) &&
    mapsEqual(settings.letterValues, defaults.letterValues)
  )) {
    const bagParam = [...settings.letterCounts.entries()].map(
      ([letter, count]) => `${letter}-${count}-${settings.letterValues.get(letter) ?? 0}`
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

/**
 * @throws UrlError
 */
export function parseGameParams(allParams: Readonly<URLSearchParams>) {
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
    throw new UrlError(`Protocol version not supported: ${vParam}`)
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
  if (bagParam) parseBagParam(settings, bagParam)
  const boardParam = gameParams.get('board')
  if (boardParam) settings.boardLayout = boardParam.split('-')
  const bingoParam = gameParams.get('bingo')
  if (bingoParam) settings.bingoBonus = parseInt(bingoParam, 10)
  const racksizeParam = gameParams.get('racksize')
  if (racksizeParam) settings.rackCapacity = parseInt(racksizeParam, 10)
  const seedParam = gameParams.get('seed')
  if (!seedParam) throw new UrlError('No random seed in URL.')
  settings.tileSystemSettings = {seed: seedParam}
  const dtParam = gameParams.get('dt')
  if (dtParam === 'permissive' || dtParam === 'freeapi' || dtParam === 'custom') {
    settings.dictionaryType = dtParam
  } else if (dtParam) {
    throw new UrlError(`Unknown dictionary type: "${dtParam}".`)
  }
  const dsParam = gameParams.get('ds')
  if (dsParam) settings.dictionarySettings = dsParam
  else if (settings.dictionaryType === 'custom') {
    throw new UrlError('Custom dictionary requires a URL.')
  }
  let playerId = gameParams.get('pid') ?? undefined
  if (!playerId) {
    const urlTurnNumber = parseInt(turnParams.get('tn')!, 10) || 1
    const turnNumber = toTurnNumber(urlTurnNumber + turnParams.getAll('wl').length + turnParams.getAll('ex').length)
    playerId = getPlayerForTurnNumber(settings.players, turnNumber).id
    console.log(`Joining as Player ${playerId}.`)
  }
  return { settings, playerId, turnParams }
}

function playersEqual(ps1: ReadonlyArray<Player>, ps2: ReadonlyArray<Player>) {
  if (ps1.length !== ps2.length) return false
  for (const index in ps1) {
    if (!ps1[index]!.equals(ps2[index])) return false
  }
  return true
}

export function parseBagParam(settings: Settings, bagParam: string) {
  const letterCounts = new Map<string, number>()
  const letterValues = new Map<string, number>()
  const iterator = bagParam.split('.')[Symbol.iterator]()
  for (const letterConfig of iterator) {
    if (letterConfig === '') {
      // "..en" copies all unspecified letters from default settings.
      const rest = [...iterator].join('.')
      if (rest !== 'en') {
        throw new UrlError(`Invalid tile distribution specifier: ${rest}`)
      }
      for (const [letter, count] of settings.letterCounts) {
        if (!letterCounts.has(letter)) {
          letterCounts.set(letter, count)
          letterValues.set(letter, settings.letterValues.get(letter)!)
        }
      }
      break
    }
    // TODO - Consider supporting multi-character tiles.
    const match = letterConfig.match(/^(?<letter>.)(?:-(?<count>(?:\d+$|\d*))(?:-(?<value>\d+))?)?$/)
    if (!match) {
      throw new UrlError(`Invalid letter configuration in URL: ${letterConfig}`)
    }
    const g = match.groups!
    const count = g.count ? parseInt(g.count, 10) : settings.letterCounts.get(g.letter!) ?? 1
    const value = g.value ? parseInt(g.value, 10) : settings.letterValues.get(g.letter!) ?? 1
    letterCounts.set(g.letter!, count)
    letterValues.set(g.letter!, value)
  }
  settings.letterCounts = letterCounts
  settings.letterValues = letterValues
}
