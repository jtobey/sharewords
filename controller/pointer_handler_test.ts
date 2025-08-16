import { test, expect, mock, setSystemTime, spyOn } from 'bun:test'
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
  const boardContainer = browser.getDocument().getElementById('board-container')!
  spyOn(boardContainer, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, bottom: 1000, right: 1000, width: 1000, height: 1000, toJSON: () => {}
  } as DOMRect)
  return {
    getBoardContainer: mock(() => boardContainer),
    setBoardTransform: mock(),
    clearDropTarget: mock(),
    getDropTarget: mock(),
    createGhostTile: mock(),
    removeGhostTile: mock(),
    setDropTarget: mock(),
  } as unknown as View
}

function createMockPointerEvent(target: HTMLElement, clientX = 100, clientY = 100): PointerEvent {
    return {
        target,
        clientX,
        clientY,
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

  test('panning moves the board when zoomed in', () => {
    const gameState = createMockGameState()
    const browser = new TestBrowser()
    const view = createMockView(browser)
    const handler = new PointerHandler(gameState, view)
    const boardContainer = browser.getDocument().getElementById('board-container')!
    const event = createMockPointerEvent(boardContainer)

    let time = new Date('2023-01-01T00:00:00.000Z').getTime()
    setSystemTime(new Date(time))

    // Double tap to zoom in
    handler.pointerUp(event)
    time += 100
    setSystemTime(new Date(time))
    handler.pointerUp(event)

    // Pan
    const downEvent = createMockPointerEvent(boardContainer, 100, 100)
    handler.pointerDown(downEvent)
    const moveEvent = createMockPointerEvent(boardContainer, 80, 70)
    handler.pointerMove(moveEvent)

    // Expect the pan to have taken effect
    // Initial panX is -44.44 from the zoom.
    // panStart.x = 100 - (-44.44) = 144.44
    // new panX = 80 - 144.44 = -64.44
    // Initial panY is -44.44 from the zoom.
    // panStart.y = 100 - (-44.44) = 144.44
    // new panY = 70 - 144.44 = -74.44
    expect(view.setBoardTransform).toHaveBeenLastCalledWith(1.8, expect.closeTo(-64.444), expect.closeTo(-74.444))

    handler.pointerUp(createMockPointerEvent(boardContainer))
    setSystemTime()
  })
