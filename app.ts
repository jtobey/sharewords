import { Settings, toGameId } from './settings.js'
import { GameState } from './game_state.js'
import { makeTiles, Tile } from './tile.js'
import type { TilesState } from './tiles_state.js'
import { HonorSystemTilesState } from './honor_system_tiles_state.js'
import { Board } from './board.ts'
import { isBoardPlacementRow } from './tile.js'
import type { BoardPlacement, TilePlacementRow } from './tile.ts'
import { Player } from './player.ts'
import { Turn, toTurnNumber } from './turn.js'
import { View } from './view.js'
import { Controller } from './controller.js'

export let gameState: GameState
export let view: View
export let controller: Controller

async function updateGameStateFromUrlOrStorage() {
  const params = new URLSearchParams(window.location.hash?.substring(1) || [])
  const gidParam = params.get('gid')
  const gameId = gidParam ? toGameId(gidParam) : `game-${Date.now()}`
  if (gameState?.gameId === gameId) {
    await gameState.applyTurnParams(params)
  } else {
    const savedGame = gidParam && localStorage.getItem(`sharewords_${gidParam}`)
    if (savedGame) {
      // TODO - Recover if fromJSON fails.
      const newGameState = GameState.fromJSON(JSON.parse(savedGame))
      console.log(`Loaded ${gameId} from local storage${gameState ? ' and switched from ' + gameState.gameId + ' to it' : ''}.`)
      gameState = newGameState
    } else {
      if (!params.get('seed')) params.set('seed', String(Math.floor(1000000 * Math.random())))
      gameState = await GameState.fromParams(params)
    }
  }
  await gameState.initRack()
  saveGameState()
  updateUrl()
  return gameState
}

function updateUrl() {
  const paramsStr = gameState.turnUrlParams.toString()
  if (window.location.hash.substr(1) !== paramsStr) {
    window.location.hash = '#' + paramsStr
  }
}

function saveGameState() {
  const gid = gameState.gameId
  if (gid) {
    localStorage.setItem(`sharewords_${gid}`, JSON.stringify(gameState.toJSON()))
  }
}

export async function init() {
  gameState = await updateGameStateFromUrlOrStorage()
  view = new View(gameState)
  controller = new Controller(gameState, view)

  view.renderBoard()
  view.renderRack()
  view.renderScores()
  view.renderBagTileCount()
  view.renderPassExchangeButton()

  gameState.addEventListener('tilemove', (evt: any) => {
    if (!isBoardPlacementRow(evt.detail.fromRow) || !isBoardPlacementRow(evt.detail.placement.row)) {
      view.renderRack()
      view.renderPassExchangeButton()
    }
    if (isBoardPlacementRow(evt.detail.fromRow) || isBoardPlacementRow(evt.detail.placement.row)) {
      view.renderBoard()
    }
    saveGameState()
  })

  gameState.addEventListener('turnchange', () => {
    view.renderBoard()
    view.renderScores()
    view.renderBagTileCount()
    updateUrl()
    saveGameState()
  })

  gameState.addEventListener('gameover', () => {
    saveGameState()
  })

  window.addEventListener('hashchange', async () => {
    await updateGameStateFromUrlOrStorage()
  })
}

if (typeof window !== 'undefined') {
  init()
}
