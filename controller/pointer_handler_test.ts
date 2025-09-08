/*
Copyright 2025 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import { test, expect, mock, setSystemTime, spyOn, describe, beforeEach, afterEach } from 'bun:test'
import { PointerHandler } from './pointer_handler'
import type { GameState } from '../game/game_state'
import type { View } from '../view/view'
import { TestBrowser } from '../test_browser'
import type { TilePlacementRow } from '../game/tile'

function createMockGameState(): GameState {
  return {
    tilesHeld: [],
    moveTile: mock(),
  } as unknown as GameState
}

function createMockView(browser: TestBrowser): View {
  const boardContainer = browser.getDocument().getElementById('board-container')!
  spyOn(boardContainer, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, bottom: 1000, right: 1000, width: 1000, height: 1000, toJSON: () => {}
  } as DOMRect)

  let dropTargetMap = new Map<number, { row: TilePlacementRow, col: number }>

  return {
    getBoardContainer: mock(() => boardContainer),
    setBoardTransform: mock(),
    clearDropTarget: mock((id: number) => { dropTargetMap.delete(id) }),
    getDropTarget: mock((id: number) => dropTargetMap.get(id)),
    createGhostTile: mock((el: HTMLElement) => el.cloneNode() as HTMLElement),
    removeGhostTile: mock(),
    setDropTarget: mock((id: number, row: TilePlacementRow, col: number) => { dropTargetMap.set(id, { row, col }) }),
  } as unknown as View
}

function createMockPointerEvent(target: HTMLElement, clientX = 100, clientY = 100, pointerId = 1): PointerEvent {
    return {
        pointerId,
        target,
        clientX,
        clientY,
        button: 0,
        preventDefault: mock(),
        stopPropagation: mock(),
    } as unknown as PointerEvent
}

describe('pointer handler', () => {
  describe('tile dragging', () => {
    let gameState: GameState
    let browser: TestBrowser
    let view: View
    let handler: PointerHandler

    beforeEach(() => {
      gameState = createMockGameState()
      browser = new TestBrowser()
      view = createMockView(browser)
      handler = new PointerHandler(gameState, view)
      global.document = browser.getDocument()
      global.window = {
        setTimeout: mock(() => 1),
        clearTimeout: mock(),
      } as any
      // happy-dom doesn't implement getBoundingClientRect
      spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        x: 100, y: 100, top: 100, left: 100, bottom: 120, right: 120, width: 20, height: 20, toJSON: () => {}
      })
    })

    afterEach(() => {
      delete (global as any).document
    })

    function createTile(row: TilePlacementRow, col: number, letter = 'A'): HTMLElement {
      const tile = browser.getDocument().createElement('div')
      tile.classList.add('tile')
      tile.dataset.row = String(row)
      tile.dataset.col = String(col)
      tile.textContent = letter
      browser.getDocument().body.appendChild(tile)
      return tile
    }

    function createBoardSquare(row: number, col: number): HTMLElement {
      const square = browser.getDocument().createElement('div')
      square.classList.add('square')
      square.dataset.row = String(row)
      square.dataset.col = String(col)
      browser.getDocument().body.appendChild(square)
      return square
    }

    function createRackSpot(col: number): HTMLElement {
      const spot = browser.getDocument().createElement('div')
      spot.classList.add('tile-spot')
      spot.dataset.row = 'rack'
      spot.dataset.col = String(col)
      browser.getDocument().body.appendChild(spot)
      return spot
    }

    function dragAndDrop(fromElement: HTMLElement, toElement: HTMLElement) {
      // 1. Press down on the fromElement
      handler.pointerDown(createMockPointerEvent(fromElement))

      // 2. Move a little to initiate the drag
      const fromRect = fromElement.getBoundingClientRect()
      handler.pointerMove(createMockPointerEvent(fromElement, fromRect.x + 10, fromRect.y))

      // 3. Move over the toElement to set the drop target
      const originalElementFromPoint = document.elementFromPoint
      document.elementFromPoint = () => toElement

      const toRect = toElement.getBoundingClientRect()
      handler.pointerMove(createMockPointerEvent(toElement, toRect.x, toRect.y))

      document.elementFromPoint = originalElementFromPoint

      // 4. Release the pointer
      handler.pointerUp(createMockPointerEvent(toElement, toRect.x, toRect.y))
    }

    test('drags a tile from the rack to the board', () => {
      const fromTile = createTile('rack', 0)
      const toSquare = createBoardSquare(7, 7)

      dragAndDrop(fromTile, toSquare)

      expect(gameState.moveTile).toHaveBeenCalledWith('rack', 0, 7, 7)
    })

    test('drags a tile from the board to another board location', () => {
      const fromTile = createTile(7, 7)
      const toSquare = createBoardSquare(7, 8)

      dragAndDrop(fromTile, toSquare)

      expect(gameState.moveTile).toHaveBeenCalledWith(7, 7, 7, 8)
    })

    test('drags a tile from the board to the rack', () => {
      const fromTile = createTile(7, 7)
      const toRackSpot = createRackSpot(0)

      dragAndDrop(fromTile, toRackSpot)

      expect(gameState.moveTile).toHaveBeenCalledWith(7, 7, 'rack', 0)
    })

    test('rearranges tiles on the rack', () => {
      const fromTile = createTile('rack', 0)
      const toRackSpot = createRackSpot(1)

      dragAndDrop(fromTile, toRackSpot)

      expect(gameState.moveTile).toHaveBeenCalledWith('rack', 0, 'rack', 1)
    })
  })

  describe('double tap', () => {
    test('double tap zooms in', () => {
      const gameState = createMockGameState()
      const browser = new TestBrowser()
      const view = createMockView(browser)
      const handler = new PointerHandler(gameState, view)
      const boardContainer = browser.getDocument().getElementById('board-container')!
      const event = createMockPointerEvent(boardContainer)

      let time = new Date('2023-01-01T00:00:00.000Z').getTime()
      setSystemTime(new Date(time))
      // First tap
      handler.pointerDown(event)
      setSystemTime(new Date(time += 100))
      handler.pointerUp(event)

      // Second tap (double tap)
      setSystemTime(new Date(time += 100))
      handler.pointerDown(event)
      setSystemTime(new Date(time += 100))
      handler.pointerUp(event)

      expect(view.setBoardTransform).toHaveBeenCalledWith(1.8, expect.closeTo(-44.444), expect.closeTo(-44.444))
      setSystemTime()
    })

    test('double tap when zoomed in zooms out', () => {
      const gameState = createMockGameState()
      const browser = new TestBrowser()
      const view = createMockView(browser)
      const handler = new PointerHandler(gameState, view)
      const boardContainer = browser.getDocument().getElementById('board-container')!
      const event = createMockPointerEvent(boardContainer)
      const window = browser.getDocument().defaultView!
      window.scrollBy = mock()

      let time = new Date('2023-01-01T00:00:00.000Z').getTime()
      setSystemTime(new Date(time))

      // First double tap to zoom in
      handler.pointerDown(event)
      setSystemTime(new Date(time += 100))
      handler.pointerUp(event)
      setSystemTime(new Date(time += 100))
      handler.pointerDown(event)
      setSystemTime(new Date(time += 100))
      handler.pointerUp(event)

      // Wait so the next tap is not a double tap on the previous one.
      setSystemTime(new Date(time += 500))
      handler.pointerDown(event)
      setSystemTime(new Date(time += 100))
      handler.pointerUp(event)

      // The fourth tap is a double tap on the third
      setSystemTime(new Date(time += 100))
      handler.pointerDown(event)
      setSystemTime(new Date(time += 100))
      handler.pointerUp(event)

      // Expect the last call to be with scale 1
      expect(view.setBoardTransform).toHaveBeenLastCalledWith(1, 0, 0)
      setSystemTime()
    })

    test('panning moves the board when zoomed in', () => {
      const gameState = createMockGameState()
      const browser = new TestBrowser()
      const view = createMockView(browser)
      const handler = new PointerHandler(gameState, view)
      spyOn(handler, 'scrollWindowBy').mockImplementation(() => {})
      const boardContainer = browser.getDocument().getElementById('board-container')!
      const event = createMockPointerEvent(boardContainer)

      let time = new Date('2023-01-01T00:00:00.000Z').getTime()
      setSystemTime(new Date(time))

      // Double tap to zoom in
      handler.pointerDown(event)
      setSystemTime(new Date(time += 100))
      handler.pointerUp(event)
      setSystemTime(new Date(time += 100))
      handler.pointerDown(event)
      setSystemTime(new Date(time += 100))
      handler.pointerUp(event)

      // Pan
      const downEvent = createMockPointerEvent(boardContainer, 100, 100)
      handler.pointerDown(downEvent)
      const moveEvent = createMockPointerEvent(boardContainer, 80, 70)
      handler.pointerMove(moveEvent)

      // Expect the pan to have taken effect
      expect(view.setBoardTransform).toHaveBeenLastCalledWith(1.8, expect.closeTo(-55.5555), expect.closeTo(-61.1111))

      handler.pointerUp(createMockPointerEvent(boardContainer))
      setSystemTime()
    })
  })

  describe('long tap', () => {
    test('long tap on a tile shows info popup', () => {
      const browser = new TestBrowser()
      const gameState = createMockGameState()
      const view = createMockView(browser)
      const handler = new PointerHandler(gameState, view)

      let timeoutCallback: () => void = () => {}
      global.window = {
        setTimeout: mock((fn: () => void) => {
          timeoutCallback = fn
          return 1
        }),
        clearTimeout: mock(),
      } as any

      const square = browser.getDocument().createElement('div')
      square.classList.add('square')
      square.dataset.row = '7'
      square.dataset.col = '7'
      const letter = browser.getDocument().createElement('div')
      letter.classList.add('letter')
      square.appendChild(letter)
      browser.getDocument().body.appendChild(square)

      const event = createMockPointerEvent(letter)
      let time = new Date('2023-01-01T00:00:00.000Z').getTime()
      setSystemTime(new Date(time))

      gameState.getWordsAt = mock(() => ['word1', 'word2'])
      view.showInfoPopup = mock(() => {})

      handler.pointerDown(event)

      // Simulate the timeout firing
      timeoutCallback()

      expect(gameState.getWordsAt).toHaveBeenCalledWith(7, 7)
      expect(view.showInfoPopup).toHaveBeenCalledWith(['word1', 'word2'], square)

      setSystemTime()
    })

    test('long tap on a tile prevents dragging', () => {
      const browser = new TestBrowser()
      const gameState = createMockGameState()
      const view = createMockView(browser)
      const handler = new PointerHandler(gameState, view)

      let timeoutCallback: () => void = () => {}
      global.window = {
        setTimeout: mock((fn: () => void) => {
          timeoutCallback = fn
          return 1
        }),
        clearTimeout: mock(),
      } as any

      const tile = browser.getDocument().createElement('div')
      tile.classList.add('tile')
      tile.dataset.row = 'rack'
      tile.dataset.col = '0'
      browser.getDocument().body.appendChild(tile)

      const event = createMockPointerEvent(tile)

      gameState.getWordsAt = mock(() => [])
      view.showInfoPopup = mock(() => {})
      view.createGhostTile = mock(() => ({} as HTMLElement))

      handler.pointerDown(event)

      // Simulate the timeout firing
      timeoutCallback()

      // Try to drag
      handler.pointerMove(createMockPointerEvent(tile, 110, 110))

      expect(view.createGhostTile).not.toHaveBeenCalled()
    })

    test.skip('system back button dismisses popup', () => {
      const browser = new TestBrowser()
      const gameState = createMockGameState()
      const view = new View(gameState, browser)
      const handler = new PointerHandler(gameState, view)

      let timeoutCallback: () => void = () => {}
      let popstateCallback: () => void = () => {}
      global.window = {
        setTimeout: mock((fn: () => void) => {
          timeoutCallback = fn
          return 1
        }),
        clearTimeout: mock(),
        history: {
          pushState: mock(),
          back: mock(),
        },
        addEventListener: mock((event, cb) => {
          if (event === 'popstate') {
            popstateCallback = cb as () => void
          }
        }),
        removeEventListener: mock(),
        location: {
          hash: ''
        }
      } as any

      const square = browser.getDocument().createElement('div')
      square.classList.add('square')
      square.dataset.row = '7'
      square.dataset.col = '7'
      const letter = browser.getDocument().createElement('div')
      letter.classList.add('letter')
      square.appendChild(letter)
      browser.getDocument().body.appendChild(square)

      const event = createMockPointerEvent(letter)

      gameState.getWordsAt = mock(() => ['word1', 'word2'])

      handler.pointerDown(event)

      // Simulate the timeout firing
      timeoutCallback()

      expect((global.window.history.pushState as any)).toHaveBeenCalled()

      // Simulate back button press
      popstateCallback()

      const calls = (global.window.removeEventListener as any).mock.calls
      const popstateCall = calls.find((call: any) => call[0] === 'popstate')
      expect(popstateCall).toBeDefined()
    })
  })
})
