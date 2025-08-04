import type { GameState } from './game_state.js'
import type { View } from './view.js'
import { isBoardPlacementRow, type TilePlacementRow } from './tile.js'
import { PlayRejectedError } from './dictionary.js'
import { KeyHandler } from './key_handler.js'
import { PointerHandler } from './pointer_handler.js'

export class Controller {
  private gameState: GameState
  private view: View
  keyHandler: KeyHandler
  private pointerHandler: PointerHandler

  constructor(gameState: GameState, view: View) {
    this.gameState = gameState
    this.view = view
    this.keyHandler = new KeyHandler(gameState, view)
    this.pointerHandler = new PointerHandler(gameState, view)
    this.attachEventListeners()
  }

  private async playWordClick() {
    const { confirmed, copyUrl } = await this.view.showConfirmationDialog(
      'Play Word?',
      'clipboard' in navigator,
    );

    if (!confirmed) return;

    try {
      await this.gameState.playWord()
      if (copyUrl) {
        const url = new URL(location.href);
        url.hash = this.gameState.turnUrlParams.toString();
        await navigator.clipboard.writeText(url.toString());
      }
    } catch (e: any) {
      alert(e instanceof PlayRejectedError ? e.message : e)
    }
  }

  private async passOrExchangeClick() {
    const tileCount = this.gameState.exchangeTilesCount
    const { confirmed, copyUrl } = await this.view.showConfirmationDialog(
      tileCount ? `Exchange ${tileCount}?` : 'Pass Turn?',
      'clipboard' in navigator,
    );

    if (!confirmed) return;

    try {
      await this.gameState.passOrExchange()
      if (copyUrl) {
        const url = new URL(location.href);
        url.hash = this.gameState.turnUrlParams.toString();
        await navigator.clipboard.writeText(url.toString());
      }
    } catch (e: any) {
      alert(e)
    }
  }

  private attachEventListeners() {
    const gameContainer = document.getElementById('game-container')!

    // Pointer events for drag-and-drop and clicking
    gameContainer.addEventListener('pointerdown', this.pointerHandler.pointerDown.bind(this.pointerHandler))
    // We need to listen on the whole document for pointermove and pointerup
    // so that the drag continues even if the user's pointer leaves the game container.
    document.addEventListener('pointermove', this.pointerHandler.pointerMove.bind(this.pointerHandler))
    document.addEventListener('pointerup', this.pointerHandler.pointerUp.bind(this.pointerHandler))

    gameContainer.addEventListener('keydown', this.keyHandler.keydown.bind(this.keyHandler))

    document.getElementById('play-word')!.addEventListener('click', this.playWordClick.bind(this))
    document.getElementById('pass-exchange')!.addEventListener('click', this.passOrExchangeClick.bind(this))
  }
}
