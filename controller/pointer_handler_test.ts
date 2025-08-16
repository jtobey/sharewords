import { test, expect, mock, setSystemTime } from 'bun:test'
import { PointerHandler } from './pointer_handler'
import type { GameState } from '../game/game_state'
import type { View } from '../view/view'
import { TestBrowser } from '../test_browser'

function createMockGameState(): GameState {
  return {
    tilesHeld: [],
    moveTile: mock(),
  } as unknown as GameState
}

function createMockView(browser: TestBrowser): View {
  return {
    getBoardContainer: mock(() => browser.getDocument().getElementById('board-container')!),
    setBoardTransform: mock(),
    clearDropTarget: mock(),
  } as unknown as View
}

function createMockPointerEvent(target: HTMLElement): PointerEvent {
    return {
        target,
        clientX: 100,
        clientY: 100,
        button: 0,
        preventDefault: mock(),
        stopPropagation: mock(),
    } as unknown as PointerEvent
}

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
  handler.pointerUp(event)

  // Second tap (double tap)
  time += 100
  setSystemTime(new Date(time))
  handler.pointerUp(event)

  expect(view.setBoardTransform).toHaveBeenCalledWith(1.8, expect.any(Number), expect.any(Number))
  setSystemTime()
})

test('double tap when zoomed in zooms out', () => {
    const gameState = createMockGameState()
    const browser = new TestBrowser()
    const view = createMockView(browser)
    const handler = new PointerHandler(gameState, view)
    const boardContainer = browser.getDocument().getElementById('board-container')!
    const event = createMockPointerEvent(boardContainer)

    let time = new Date('2023-01-01T00:00:00.000Z').getTime()
    setSystemTime(new Date(time))

    // First double tap to zoom in
    handler.pointerUp(event)
    time += 100
    setSystemTime(new Date(time))
    handler.pointerUp(event)

    // Wait so the next tap is not a double tap on the previous one.
    time += 500
    setSystemTime(new Date(time))
    handler.pointerUp(event)

    // The fourth tap is a double tap on the third
    time += 100
    setSystemTime(new Date(time))
    handler.pointerUp(event)

    // Expect the last call to be with scale 1
    expect(view.setBoardTransform).toHaveBeenLastCalledWith(1, 0, 0)
    setSystemTime()
  })
