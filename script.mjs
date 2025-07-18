import {
    BOARD_SIZE,
    RACK_SIZE,
    BONUS_TYPES,
    DEFAULT_BOARD_LAYOUT_STRINGS,
    DEFAULT_TILE_VALUES,
    DEFAULT_LETTER_DISTRIBUTION,
    Tile,
    Square,
    Board,
    Player,
    GameState
} from './types.mjs';
import {
    identifyAllPlayedWords,
    calculateWordScore,
    handleCommitPlay as handleCommitPlayLogic,
    generateTurnUrlParams
} from './scoring.mjs';
import {
    gameSettingsFromUrlParams,
    loadGameFromParamsOrStorage,
    saveGameStateToLocalStorage
} from './game_state.mjs';

// Crossword Builder Game - Main Script
// This script handles game logic, UI interaction, and state management.
console.log("Crossword Builder Game script loaded.");

// Note: The comment block below describes the structure for customGameSettings.
// This is useful for developers to understand how to customize game parameters.
// It's not a constant, but rather documentation for an object structure.
/*
Example structure for customGameSettings (passed to GameState constructor or settings update):
{
  "boardSize": 15, // Optional, defaults to BOARD_SIZE
  "rackSize": 7, // Optional, defaults to RACK_SIZE
  "tileDistribution": { "A": 9, "B": 2, ... }, // Optional, defaults to DEFAULT_LETTER_DISTRIBUTION
  "tileValues": { "A": 1, "B": 3, "_": 0, ... }, // Optional, defaults to DEFAULT_TILE_VALUES
  "blankTileCount": 2, // Optional, defaults to 2
  "sevenTileBonus": 50, // Optional, defaults to 50
  "dictionaryType": "permissive" | "freeapi" | "custom", // Optional, defaults to "permissive"
  "dictionaryUrlOrFunction": "https://api.example.com/dict?word=", // Optional, needed if dictionaryType is "custom"
  "customBoardLayout": ["T..d...", ".D..t...", ...], // Optional, array of 15 strings for board layout
  "playerNames": { "player1": "Alice", "player2": "Bob" } // Optional
}
*/

// --- Global Game Variables ---
/** @type {?GameState} The current global game state object. Null if no game is active. */
let currentGame = null;
/** @type {string} ID of the player using this browser instance ("player1" or "player2"). */
let localPlayerId = "player1"; // Default, can be changed when loading/joining a game
/** @type {boolean} Flag indicating if tile exchange mode is active. */
let isExchangeModeActive = false;
/** @type {Array<Tile>} Tiles selected by the local player for exchange. */
let selectedTilesForExchange = [];


// --- UI Rendering Functions ---

/**
 * Creates and returns a DOM element for a single tile in a player's rack.
 * @param {Tile} tile - The Tile object to render.
 * @param {boolean} [isDraggable=false] - Whether the tile should be draggable (usually true for local player's rack).
 * @returns {HTMLDivElement} The created tile DOM element.
 */
function renderTileInRack(tile, isDraggable = false) {
    const tileDiv = document.createElement('div');
    tileDiv.classList.add('tile-in-rack');
    tileDiv.dataset.tileId = tile.id; // Store tile ID

    if (isDraggable) {
        tileDiv.draggable = true;
        tileDiv.addEventListener('dragstart', handleDragStart);
        tileDiv.addEventListener('dragend', handleDragEnd);
        tileDiv.addEventListener('touchstart', handleTouchStart, { passive: false }); // Touch support
    }

    // If in exchange mode and it's the local player's turn, add click listeners for selection
    if (isExchangeModeActive && currentGame && currentGame.getCurrentPlayer().id === localPlayerId) {
        tileDiv.addEventListener('click', () => {
            const tileId = tileDiv.dataset.tileId;
            const player = currentGame.getCurrentPlayer();
            // Find the actual tile object in the player's rack (not just from selectedTilesForExchange)
            const tileInRackInstance = player.rack.find(t => t.id === tileId);

            if (!tileInRackInstance) return; // Should not happen if rack is rendered correctly

            const indexInSelection = selectedTilesForExchange.findIndex(selTile => selTile.id === tileInRackInstance.id);

            if (indexInSelection > -1) { // Tile is already selected, deselect it
                selectedTilesForExchange.splice(indexInSelection, 1);
                tileDiv.classList.remove('selected-for-exchange');
            } else { // Tile is not selected, select it
                selectedTilesForExchange.push(tileInRackInstance);
                tileDiv.classList.add('selected-for-exchange');
            }
            console.log("Selected for exchange:", selectedTilesForExchange.map(t => t.letter || (t.isBlank ? 'BLANK' : '')));
            updateControlButtonsVisibility(); // Update confirm/cancel exchange button states
        });

        // Apply 'selected-for-exchange' class if tile is already in the selection list (e.g., after a re-render)
        if (selectedTilesForExchange.some(selTile => selTile.id === tile.id)) {
            tileDiv.classList.add('selected-for-exchange');
        }
    }

    const letterSpan = document.createElement('span');
    letterSpan.classList.add('tile-letter');
    letterSpan.textContent = tile.isBlank ? '?' : tile.letter.toUpperCase(); // Show '?' for blank tile in rack

    const valueSpan = document.createElement('span');
    valueSpan.classList.add('tile-value');
    valueSpan.textContent = tile.value;

    tileDiv.appendChild(letterSpan);
    tileDiv.appendChild(valueSpan);
    return tileDiv;
}

/**
 * Renders the game board in the DOM.
 * @param {GameState} gameState - The current game state.
 */
function renderBoard(gameState) {
    const boardContainer = document.getElementById('board-container');
    if (!boardContainer || !gameState || !gameState.board) {
        console.error("renderBoard: Cannot render board - missing container or gameState/board object.");
        return;
    }
    boardContainer.innerHTML = ''; // Clear previous board content

    // Set up CSS grid for the board based on its size
    boardContainer.style.gridTemplateColumns = `repeat(${gameState.board.size}, var(--tile-size))`;
    boardContainer.style.gridTemplateRows = `repeat(${gameState.board.size}, var(--tile-size))`;

    const centerR = Math.floor(gameState.board.size / 2);
    const centerC = Math.floor(gameState.board.size / 2);

    // Iterate over each square in the board grid
    for (let r = 0; r < gameState.board.size; r++) {
        for (let c = 0; c < gameState.board.size; c++) {
            const squareData = gameState.board.grid[r][c]; // The Square object
            const squareDiv = document.createElement('div');
            squareDiv.classList.add('square');
            squareDiv.dataset.row = r; // Store row/col for event handlers
            squareDiv.dataset.col = c;

            // Apply bonus class if applicable
            if (squareData.bonus !== BONUS_TYPES.NONE) {
                squareDiv.classList.add(squareData.bonus);
            }
            // Special class for the center square if it has no other bonus
            if (r === centerR && c === centerC && squareData.bonus === BONUS_TYPES.NONE) {
                squareDiv.classList.add('center');
            }

            // If a tile is on this square, render it
            if (squareData.tile) {
                const tile = squareData.tile;
                const letterSpan = document.createElement('span');
                letterSpan.classList.add('tile-letter');
                // Display assigned letter for blanks, or actual letter. Show '(?)' if blank unassigned (should not happen on board).
                letterSpan.textContent = tile.isBlank ?
                    (tile.assignedLetter ? `(${tile.assignedLetter.toUpperCase()})` : '(?)') :
                    tile.letter.toUpperCase();

                const valueSpan = document.createElement('span');
                valueSpan.classList.add('tile-value');
                valueSpan.textContent = tile.value;

                squareDiv.innerHTML = ''; // Clear any previous content (like bonus text)
                squareDiv.appendChild(letterSpan);
                squareDiv.appendChild(valueSpan);
                squareDiv.classList.add('tile-on-board'); // Mark square as having a tile

                // Make tile draggable if it's part of the current turn's uncommitted moves
                const isCurrentTurnMove = currentGame.currentTurnMoves.find(
                    m => m.tileId === tile.id && m.to.row === r && m.to.col === c
                );
                if (isCurrentTurnMove) {
                    squareDiv.draggable = true;
                    squareDiv.addEventListener('dragstart', handleDragStart);
                    squareDiv.addEventListener('dragend', handleDragEnd);
                    squareDiv.addEventListener('touchstart', handleTouchStart, { passive: false }); // Touch support
                    squareDiv.dataset.tileId = tile.id; // Store tile ID for drag identification
                }
            } else {
                // No tile on the square, check for bonus types to display label
                if (squareData.bonus !== BONUS_TYPES.NONE) {
                    const bonusLabel = document.createElement('div');
                    bonusLabel.classList.add('bonus-label');
                    switch (squareData.bonus) {
                        case BONUS_TYPES.DL:
                            bonusLabel.textContent = '2L';
                            break;
                        case BONUS_TYPES.TL:
                            bonusLabel.textContent = '3L';
                            break;
                        case BONUS_TYPES.DW:
                            bonusLabel.textContent = '2W';
                            break;
                        case BONUS_TYPES.TW:
                            bonusLabel.textContent = '3W';
                            break;
                    }
                    squareDiv.appendChild(bonusLabel);
                }
            }

            // Add drop zone listeners to all squares
            squareDiv.addEventListener('dragover', handleDragOver);
            squareDiv.addEventListener('drop', handleDropOnBoard);
            // Touch drop zone logic is handled globally by handleTouchEnd finding elementFromPoint

            boardContainer.appendChild(squareDiv);
        }
    }
}

/**
 * Renders the local player's rack.
 * @param {GameState} gameState - The current game state.
 * @param {string} localPlayerId - The ID of the player using this browser instance.
 */
function renderRack(gameState, localPlayerId) {
    if (!gameState || !gameState.players) {
        console.error("renderRack: gameState or players array is missing.");
        return;
    }

    const localPlayer = gameState.players.find(p => p.id === localPlayerId);
    const localRackElement = document.getElementById('local-player-rack');

    if (!localPlayer || !localRackElement) {
        console.error("renderRack: Could not find local player or their rack DOM element.");
        return;
    }

    localRackElement.innerHTML = ''; // Clear existing tiles from the rack element

    // Add drag-and-drop listeners to the local player's rack (as a drop target)
    localRackElement.addEventListener('dragover', handleDragOver);
    localRackElement.addEventListener('drop', handleDropOnRack);
    // Note: Touch drop logic for the rack is handled by handleTouchEnd checking elementFromPoint.

    // Render tiles for the local player's rack
    localPlayer.rack.forEach(tile => {
        // Tiles in local player's rack are draggable only if it's their turn and not in exchange mode.
        // Exchange mode handles its own click-to-select logic, not drag-and-drop.
        const isDraggable = !isExchangeModeActive;
        localRackElement.appendChild(renderTileInRack(tile, isDraggable));
    });
    // Opponent's rack is not explicitly rendered here, but could be (e.g., showing tile counts).
}

/**
 * Updates the game status display (player scores, current turn, tiles in bag).
 * @param {GameState} gameState - The current game state.
 */
function updateGameStatus(gameState) {
    if (!gameState) {
        console.warn("updateGameStatus: No gameState provided.");
        return;
    }

    // Update player names and scores displayed in the game header
    const player1 = gameState.players[0];
    const player2 = gameState.players[1];

    // DOM elements for player 1 info
    const headerP1Name = document.getElementById('header-player1-name');
    const headerP1Score = document.getElementById('header-player1-score');
    // DOM elements for player 2 info
    const headerP2Name = document.getElementById('header-player2-name');
    const headerP2Score = document.getElementById('header-player2-score');

    if (headerP1Name) headerP1Name.textContent = player1.name;
    if (headerP1Score) headerP1Score.textContent = player1.score;
    if (headerP2Name) headerP2Name.textContent = player2.name;
    if (headerP2Score) headerP2Score.textContent = player2.score;

    // Update current turn player and tiles remaining in bag
    const turnPlayerEl = document.getElementById('turn-player');
    if (turnPlayerEl) turnPlayerEl.textContent = gameState.getCurrentPlayer().name;
    const tilesInBagEl = document.getElementById('tiles-in-bag');
    if (tilesInBagEl) tilesInBagEl.textContent = gameState.bag.length;
}

/**
 * Performs a full re-render of all major UI components: board, racks, and game status.
 * @param {GameState} gameState - The current game state.
 * @param {string} localPlayerId - The ID of the player using this browser instance.
 */
function fullRender(gameState, localPlayerId) {
    const boardContainer = document.getElementById('board-container');
    if (!gameState) {
        // If no game is active, display a message in the board container.
        if (boardContainer) {
            boardContainer.innerHTML = '<p>No game active. Start a new game or load one via URL.</p>';
        } else {
            // This case should ideally not happen if the HTML structure is correct.
            console.warn("fullRender: board-container not found, cannot display no-game message.");
        }
        // Potentially clear other UI elements like racks or status here if necessary.
        return;
    }

    // Call individual render functions. These functions have their own internal checks
    // for the existence of their primary DOM elements.
    renderBoard(gameState);
    renderRack(gameState, localPlayerId);
    updateGameStatus(gameState);
}

/**
 * Shows a modal dialog after a move is committed (play, pass, or exchange).
 * Displays points earned (if any) and provides the turn URL.
 * @param {number} pointsEarned - The number of points earned in the last move.
 * @param {string} turnURL - The URL for the next player's turn.
 */
function showPostMoveModal(pointsEarned, turnURL) {
    // Ensure modal elements are defined in the outer scope (DOMContentLoaded)
    const postMoveModalElement = document.getElementById('post-move-modal');
    const modalPointsEarnedSpan = document.getElementById('modal-points-earned');
    const modalCopyCheckbox = document.getElementById('modal-copy-url-checkbox');

    if (!postMoveModalElement || !modalPointsEarnedSpan) {
        console.error("Post-move modal elements not found for showPostMoveModal.");
        return;
    }
    modalPointsEarnedSpan.textContent = pointsEarned;
    postMoveModalElement.dataset.turnUrl = turnURL; // Store URL for the copy button/action

    if (modalCopyCheckbox) {
        if (navigator.clipboard) {
            modalCopyCheckbox.checked = true; // Default to copying URL
            // show parent
            modalCopyCheckbox.parentElement.style.display = 'block';
        } else {
            // hide parent
            modalCopyCheckbox.parentElement.style.display = 'none';
        }
    }
    postMoveModalElement.removeAttribute('hidden'); // Make the modal visible
}

// --- Drag and Drop (DND) and Touch Event Handlers ---

// --- Mouse DND State ---
/** @type {?string} ID of the tile currently being dragged via mouse. Null if no mouse drag is active. */
let draggedTileId = null;

// --- Touch DND State ---
/** @type {?HTMLElement} The DOM element of the tile currently being dragged via touch. */
let touchDraggedElement = null;
/** @type {?string} ID of the tile being dragged via touch. */
let touchDraggedTileId = null;
/** @type {?HTMLElement} The cloned DOM element that is visually dragged around. */
let touchDraggedClone = null;
// let initialTouchX = 0; // Relative to viewport, not used directly after initial calculation
// let initialTouchY = 0; // Relative to viewport, not used directly after initial calculation
/** @type {number} Offset from touch point to the dragged tile's top-left X-coordinate. */
let offsetX = 0;
/** @type {number} Offset from touch point to the dragged tile's top-left Y-coordinate. */
let offsetY = 0;
/** @type {?Node} Original parent node of the touch-dragged tile, for restoration on invalid drop. */
let originalParentNode = null;
/** @type {?Node} Original next sibling of the touch-dragged tile, for restoring order in flex containers like the rack. */
let originalNextSibling = null;
/** @type {?object} Stores original CSS styles of the touch-dragged element for restoration. */
let draggedElementOriginalStyles = null;

/**
 * Handles the start of a touch drag operation on a tile.
 * - Validates if the tile is draggable by the current local player.
 * - Sets up state variables for touch dragging (touchDraggedElement, touchDraggedTileId).
 * - Stores original position and styles for potential restoration.
 * - Visually prepares the tile for dragging (opacity, z-index, absolute positioning).
 * - Adds global touchmove and touchend listeners.
 * @param {TouchEvent} event - The touchstart event.
 */
function handleTouchStart(event) {
    if (!currentGame) {
        console.log("Touch drag prevented: No current game active.");
        return;
    }
    // Exchange mode prevents tile dragging from rack/board for play
    if (isExchangeModeActive) {
        console.log("Touch drag prevented: Exchange mode is active.");
        return;
    }

    const tileElement = event.target.closest('[data-tile-id]');
    if (!tileElement) return; // Not a tile or descendant of a tile element

    const tileId = tileElement.dataset.tileId;

    // Tile is draggable by the local player.
    console.log(`Touch Start: Allowed for local player, tile ${tileId}`);
    event.preventDefault(); // Prevent default touch actions (like scrolling or text selection).

    touchDraggedTileId = tileId;
    touchDraggedElement = tileElement;

    // Create a clone of the element to be dragged
    touchDraggedClone = touchDraggedElement.cloneNode(true);

    originalParentNode = touchDraggedElement.parentNode;
    originalNextSibling = touchDraggedElement.nextSibling;

    // Store original styles to revert if not dropped on a valid target
    draggedElementOriginalStyles = {
        position: touchDraggedElement.style.position || '',
        left: touchDraggedElement.style.left || '',
        top: touchDraggedElement.style.top || '',
        opacity: touchDraggedElement.style.opacity || '',
        zIndex: touchDraggedElement.style.zIndex || '',
        transform: touchDraggedElement.style.transform || ''
    };

    // Calculate offset from touch point to tile's top-left corner
    const rect = touchDraggedElement.getBoundingClientRect();
    offsetX = event.touches[0].clientX - rect.left;
    offsetY = event.touches[0].clientY - rect.top;

    // Hide the original element but keep it in place
    touchDraggedElement.style.opacity = '0.4';


    // Temporarily move element to body for unrestricted positioning and to ensure it's visually on top.
    document.body.appendChild(touchDraggedClone);
    touchDraggedClone.style.position = 'absolute';
    // Position includes current scroll offset to keep element under finger
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
    touchDraggedClone.style.left = (event.touches[0].clientX - offsetX + scrollX) + 'px';
    touchDraggedClone.style.top = (event.touches[0].clientY - offsetY + scrollY) + 'px';
    touchDraggedClone.style.opacity = '0.7'; // Make it semi-transparent
    touchDraggedClone.style.zIndex = '1001'; // Ensure it's above other elements

    // Add global listeners for move and end events
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd); // Also handle abrupt cancellations
}

/**
 * Handles the movement of a touch-dragged tile.
 * - Updates the tile's position to follow the touch.
 * - Provides visual feedback (e.g., highlighting) on potential drop targets.
 * @param {TouchEvent} event - The touchmove event.
 */
function handleTouchMove(event) {
    if (!touchDraggedClone) return;
    event.preventDefault(); // Prevent scrolling during drag

    const touch = event.touches[0];
    // Update position, including scroll offset
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
    touchDraggedClone.style.left = (touch.clientX - offsetX + scrollX) + 'px';
    touchDraggedClone.style.top = (touch.clientY - offsetY + scrollY) + 'px';

    // Visual feedback for drop targets: remove from old, add to new
    document.querySelectorAll('.touch-drag-over').forEach(el => el.classList.remove('touch-drag-over'));
    const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
    if (elementUnderTouch) {
        const potentialDropTarget = elementUnderTouch.closest('.square, #local-player-rack'); // Target specific rack ID
        if (potentialDropTarget) {
            if (potentialDropTarget.classList.contains('square')) {
                const r = parseInt(potentialDropTarget.dataset.row);
                const c = parseInt(potentialDropTarget.dataset.col);
                const boardSquare = currentGame.board.grid[r][c];
                // Allow highlighting if square is empty or is the original square of the tile
                const isOriginalSquare = boardSquare.tile && boardSquare.tile.id === touchDraggedTileId;
                if (!boardSquare.tile || isOriginalSquare) {
                    potentialDropTarget.classList.add('touch-drag-over');
                }
            } else if (potentialDropTarget.id === 'local-player-rack') { // It's the local player's rack
                potentialDropTarget.classList.add('touch-drag-over');
            }
        }
    }
}

/**
 * Handles the end of a touch drag operation (drop or cancel).
 * - Determines the drop target.
 * - If valid target (board square or rack), calls the appropriate drop handler (handleDropOnBoard or handleDropOnRack).
 * - If invalid target, restores the tile to its original position and style.
 * - Cleans up global listeners and resets touch DND state variables.
 * @param {TouchEvent} event - The touchend or touchcancel event.
 */
function handleTouchEnd(event) {
    if (!touchDraggedClone) return;

    // Clean up global event listeners
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    document.removeEventListener('touchcancel', handleTouchEnd);
    document.querySelectorAll('.touch-drag-over').forEach(el => el.classList.remove('touch-drag-over'));

    // Temporarily hide the dragged element to correctly find the element underneath the touch point
    touchDraggedClone.style.display = 'none';
    const touch = event.changedTouches[0]; // Use changedTouches for touchend/touchcancel
    const dropTargetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    touchDraggedClone.style.display = ''; // Make it visible again

    let droppedSuccessfully = false;

    if (dropTargetElement) {
        const boardSquareElement = dropTargetElement.closest('.square');
        const rackElement = dropTargetElement.closest('#local-player-rack'); // Target specific rack ID

        if (boardSquareElement) { // Dropped on a board square
            const r = parseInt(boardSquareElement.dataset.row);
            const c = parseInt(boardSquareElement.dataset.col);
            const boardSquare = currentGame.board.grid[r][c];

            // Allow drop if square is empty, or if it's the original square of the currently dragged tile
            if (!boardSquare.tile || (boardSquare.tile && boardSquare.tile.id === touchDraggedTileId)) {
                console.log(`Touch Drop on Board: tile ${touchDraggedTileId} to (${r},${c})`);
                // touchDraggedElement.remove(); // Remove the temporarily-styled element from body

                const realDraggedTileIdBackup = draggedTileId; // Backup mouse DND state
                draggedTileId = touchDraggedTileId;    // Temporarily set for handleDropOnBoard compatibility

                // Simulate a drop event for handleDropOnBoard
                const mockDropEvent = { preventDefault: () => {}, target: boardSquareElement };
                handleDropOnBoard(mockDropEvent); // This function should call fullRender

                draggedTileId = realDraggedTileIdBackup; // Restore mouse DND state
                droppedSuccessfully = true;
            } else {
                 console.log("Touch Drop on Board: Square occupied by a different tile. Aborting drop.");
            }
        } else if (rackElement) { // Dropped on the local player's rack
            console.log(`Touch Drop on Rack: tile ${touchDraggedTileId}`);
            // touchDraggedElement.remove(); // Remove the temporarily-styled element from body

            const realDraggedTileIdBackup = draggedTileId; // Backup mouse DND state
            draggedTileId = touchDraggedTileId; // Temporarily set for handleDropOnRack compatibility

            // Simulate a drop event for handleDropOnRack
            // The target for handleDropOnRack should be the specific element the user dropped on within the rack, or the rack itself.
            const mockEventTarget = rackElement.contains(dropTargetElement) ? dropTargetElement : rackElement;
            const mockDropEvent = { preventDefault: () => {}, target: mockEventTarget };
            handleDropOnRack(mockDropEvent); // This function should call fullRender

            draggedTileId = realDraggedTileIdBackup; // Restore mouse DND state
            droppedSuccessfully = true;
        }
    }

    if (!droppedSuccessfully) {
        console.log("Touch Drop: Invalid target or drop failed. Returning tile to original position.");
        // If the element was not removed by a successful drop, it's still a child of document.body.
        // Re-insert into original DOM position with original styles
        if (originalParentNode && draggedElementOriginalStyles) {
            touchDraggedElement.style.position = draggedElementOriginalStyles.position;
            touchDraggedElement.style.left = draggedElementOriginalStyles.left;
            touchDraggedElement.style.top = draggedElementOriginalStyles.top;
            touchDraggedElement.style.opacity = draggedElementOriginalStyles.opacity;
            touchDraggedElement.style.zIndex = draggedElementOriginalStyles.zIndex;
            touchDraggedElement.style.transform = draggedElementOriginalStyles.transform;
            // originalParentNode.insertBefore(touchDraggedElement, originalNextSibling);
        }
        // If the drop failed, a fullRender might be needed to ensure UI consistency,
        // especially if the tile was from the board and its logical state needs resetting.
        // However, the drop handlers (handleDropOnBoard/Rack) call fullRender on success.
        // If we reached here, it means no drop handler was called or it failed early.
        // A fullRender ensures the game state and UI are synchronized.
        fullRender(currentGame, localPlayerId);
    }

    // remove the clone
    touchDraggedClone.remove();

    // Reset touch DND state variables
    touchDraggedElement = null;
    touchDraggedTileId = null;
    touchDraggedClone = null;
    originalParentNode = null;
    originalNextSibling = null;
    draggedElementOriginalStyles = null;
    // offsetX and offsetY don't need resetting as they are recalculated on each touchstart.
}

// Dynamically add CSS for touch drag visual feedback
const styleSheet = document.createElement("style");
styleSheet.innerText = `
    .touch-drag-over { background-color: #cccccc !important; outline: 1px dashed #333; }
    /* .tile-touch-dragging { opacity: 0.7; transform: scale(1.1); } */ /* Example, JS handles opacity */
`;
document.head.appendChild(styleSheet);

/**
 * Handles the start of a mouse drag operation on a tile.
 * - Validates if the tile is draggable by the current local player.
 * - Sets `draggedTileId` with the ID of the tile being dragged.
 * - Sets data for the DataTransfer object.
 * - Styles the dragged tile (e.g., reduces opacity).
 * @param {DragEvent} event - The dragstart event.
 */
function handleDragStart(event) {
    if (!currentGame) {
        console.log("Mouse Drag prevented: No current game active.");
        event.preventDefault(); return;
    }
    // Exchange mode prevents tile dragging from rack/board for play
    if (isExchangeModeActive) {
        console.log("Mouse Drag prevented: Exchange mode is active.");
        event.preventDefault(); return;
    }

    const tileElement = event.target.closest('[data-tile-id]');
    if (!tileElement) { // Should be the tile itself or a child
        console.log("Mouse Drag prevented: Event target is not a tile element.");
        event.preventDefault(); return;
    }

    const tileId = tileElement.dataset.tileId;

    // Tile is draggable by the local player.
    console.log(`Mouse Drag Start: Allowed for local player, tile ${tileId}`);
    draggedTileId = tileId; // Set the global ID for the tile being dragged
    event.dataTransfer.setData('text/plain', draggedTileId); // Set data for the drag operation
    event.dataTransfer.effectAllowed = 'move'; // Indicate that a 'move' operation is allowed
    if (event.target.style) event.target.style.opacity = '0.5'; // Visually indicate dragging
}

/**
 * Handles the end of a mouse drag operation.
 * - Resets the opacity of the dragged tile.
 * - Clears `draggedTileId`.
 * @param {DragEvent} event - The dragend event.
 */
function handleDragEnd(event) {
    if(event.target && event.target.style) {
        event.target.style.opacity = '1'; // Restore original opacity
    }
    draggedTileId = null; // Clear the ID of the dragged tile
    console.log('Mouse Drag End');
}

/**
 * Handles the dragover event, typically on a potential drop target.
 * - Prevents default handling to allow dropping.
 * - Sets the drop effect (e.g., 'move').
 * @param {DragEvent} event - The dragover event.
 */
function handleDragOver(event) {
    event.preventDefault(); // Necessary to allow a drop
    event.dataTransfer.dropEffect = 'move'; // Visual feedback for the type of operation
}

/**
 * Handles dropping a tile onto a board square.
 * - Validates the drop target and dragged tile.
 * - Updates game state: moves tile from rack/another board square to the target square.
 * - Handles blank tile letter assignment.
 * - Re-renders the game.
 * @param {DragEvent | {target: HTMLElement, preventDefault: function}} event - The drop event or a mock event for touch.
 */
function handleDropOnBoard(event) {
    event.preventDefault(); // Prevent default drop behavior
    if (!draggedTileId) return; // No tile was being dragged (or ID was cleared)

    const targetSquareElement = event.target.closest('.square');
    if (!targetSquareElement) return; // Drop was not on a square element

    const row = parseInt(targetSquareElement.dataset.row);
    const col = parseInt(targetSquareElement.dataset.col);
    if (isNaN(row) || isNaN(col)) return; // Square element missing row/col data

    const boardSquare = currentGame.board.grid[row][col]; // The logical Square object

    // Check if the target square is already occupied by a *different* tile
    if (boardSquare.tile) {
        // If a tile is being moved on the board, it can be dropped back onto its original square.
        // Check if the dragged tile is the same as the one on the square.
        const isMovingSameTileOnBoard = currentGame.currentTurnMoves.some(
            move => move.tileId === draggedTileId && boardSquare.tile.id === draggedTileId
        );
        if (!isMovingSameTileOnBoard) {
             console.log("Drop on Board: Target square is already occupied by a different tile.");
             // Note: draggedTileId is cleared by handleDragEnd or handleTouchEnd.
             // A fullRender() might be good here if the opacity of the dragged tile wasn't reset.
             // However, handleDragEnd/handleTouchEnd should manage this.
             return;
        }
    }

    const localPlayerInstance = currentGame.players.find(p => p.id === localPlayerId);
    if (!localPlayerInstance) {
        console.error("Drop on Board: Local player instance not found.");
        draggedTileId = null; // Clear DND state
        fullRender(currentGame, localPlayerId); // Refresh UI
        return;
    }

    let tileToPlace; // The Tile object being placed
    let sourceWasRack = true; // Assume tile comes from rack unless found in currentTurnMoves

    // Check if the tile was already on the board (i.e., being moved from another square)
    const existingMoveIndex = currentGame.currentTurnMoves.findIndex(move => move.tileId === draggedTileId);

    if (existingMoveIndex !== -1) { // Tile is being moved from another position on the board
        const move = currentGame.currentTurnMoves[existingMoveIndex];
        tileToPlace = move.tileRef;
        sourceWasRack = false; // Tile was already on the board
        const originalPosition = { row: move.to.row, col: move.to.col };

        // If dropped on the exact same square it came from, do nothing.
        if (originalPosition.row === row && originalPosition.col === col) {
            draggedTileId = null; // DND operation ends
            fullRender(currentGame, localPlayerId); // Refresh (mainly to reset opacity if dragEnd didn't catch it)
            return;
        }
        // Clear the tile from its old board position
        currentGame.board.grid[originalPosition.row][originalPosition.col].tile = null;
        // Update the move's destination in currentTurnMoves
        move.to = { row, col };
    } else { // Tile is being moved from the local player's rack
        const tileIndexInRack = localPlayerInstance.rack.findIndex(t => t.id === draggedTileId);
        if (tileIndexInRack === -1) {
            console.error("Drop on Board: Tile not found in local player's rack or currentTurnMoves.", draggedTileId);
            draggedTileId = null;
            fullRender(currentGame, localPlayerId);
            return;
        }
        tileToPlace = localPlayerInstance.rack[tileIndexInRack];
        localPlayerInstance.rack.splice(tileIndexInRack, 1); // Remove from rack
        // Add to currentTurnMoves, marking its origin as 'rack'
        currentGame.currentTurnMoves.push({ tileId: tileToPlace.id, tileRef: tileToPlace, from: 'rack', to: { row, col }});
    }

    // Handle blank tile letter assignment if it's new from rack and unassigned
    if (sourceWasRack && tileToPlace.isBlank && !tileToPlace.assignedLetter) {
        let assignedLetter = '';
        // Loop until a single valid letter is entered or prompt is cancelled
        while (assignedLetter.length !== 1 || !/^[A-Z]$/i.test(assignedLetter)) {
            assignedLetter = prompt("Enter a letter for the blank tile (A-Z):");
            if (assignedLetter === null) { // User cancelled the prompt
                // Return tile to local player's rack
                localPlayerInstance.rack.push(tileToPlace);
                // If it was added to currentTurnMoves, remove it
                const newMoveIdx = currentGame.currentTurnMoves.findIndex(m => m.tileId === tileToPlace.id);
                if (newMoveIdx !== -1) currentGame.currentTurnMoves.splice(newMoveIdx, 1);

                draggedTileId = null; // End DND
                fullRender(currentGame, localPlayerId); // Refresh UI
                return; // Stop further processing
            }
            assignedLetter = assignedLetter.toUpperCase();
        }
        tileToPlace.assignedLetter = assignedLetter;
    }

    boardSquare.tile = tileToPlace; // Place the tile object on the target logical square
    console.log(`Tile ${tileToPlace.id} (${tileToPlace.letter || 'blank'}) moved to (${row},${col}). currentTurnMoves:`, currentGame.currentTurnMoves);

    fullRender(currentGame, localPlayerId); // Refresh the entire UI
    draggedTileId = null; // DND operation is complete for this tile
}

/**
 * Handles dropping a tile onto the local player's rack.
 * - Validates the drop.
 * - If tile is from board: returns it to rack, resets blank assignment if needed, removes from `currentTurnMoves`.
 * - If tile is from rack (reordering): updates its position in the rack.
 * - Re-renders the game.
 * @param {DragEvent | {target: HTMLElement, preventDefault: function}} event - The drop event or a mock event for touch.
 */
function handleDropOnRack(event) {
    event.preventDefault();
    if (!draggedTileId) return; // No tile being dragged

    const localPlayerInstance = currentGame.players.find(p => p.id === localPlayerId);
    if (!localPlayerInstance) {
        console.error("Drop on Rack: Local player instance not found.");
        draggedTileId = null;
        fullRender(currentGame, localPlayerId);
        return;
    }
    const playerRack = localPlayerInstance.rack; // Reference to the local player's rack array

    // Ensure the drop target is indeed the local player's rack element
    const targetRackElement = document.getElementById('local-player-rack');
    // For mouse DND, event.target could be a tile within the rack. For touch, it's usually the rack itself.
    if (!targetRackElement || (event.target !== targetRackElement && !targetRackElement.contains(event.target))) {
        console.warn("Drop on Rack: Event target is not the local player's rack or its child. Aborting drop.");
        // draggedTileId will be cleared by dragEnd/touchEnd. A fullRender might be needed if styles aren't reset.
        fullRender(currentGame, localPlayerId); // Re-render to be safe
        return;
    }

    // Check if the tile was part of currentTurnMoves (i.e., dragged from the board)
    const moveIndexOnBoard = currentGame.currentTurnMoves.findIndex(m => m.tileId === draggedTileId);

    if (moveIndexOnBoard === -1) {
        // Tile was dragged from the rack and dropped back onto the rack (rearrangement).
        const tileIndexInRack = playerRack.findIndex(t => t.id === draggedTileId);
        if (tileIndexInRack !== -1) {
            const tileToMove = playerRack.splice(tileIndexInRack, 1)[0]; // Remove from current position

            // Determine target index for re-insertion (e.g., before a specific tile or at the end)
            let targetInsertionIndex = playerRack.length; // Default to appending
            const targetTileElement = event.target.closest('.tile-in-rack'); // Dropped on another tile?
            if (targetTileElement && targetTileElement.dataset.tileId !== draggedTileId) {
                const targetTileId = targetTileElement.dataset.tileId;
                const actualTargetIndexInRack = playerRack.findIndex(t => t.id === targetTileId);
                if (actualTargetIndexInRack !== -1) {
                    targetInsertionIndex = actualTargetIndexInRack; // Insert before this target tile
                }
            }
            playerRack.splice(targetInsertionIndex, 0, tileToMove); // Add tile to rack at new position
            console.log(`Tile ${draggedTileId} rearranged in local player's rack.`);
        } else {
            // This case should ideally not be reached if drag source validation is correct.
            console.warn("Rearrange Rack: Dragged tile ID not found in local player's rack.", draggedTileId);
        }
        // draggedTileId is cleared by the respective dragEnd or touchEnd handlers for rack-to-rack moves.
    } else {
        // Tile was on the board (part of currentTurnMoves) and is being returned to the local player's rack.
        const move = currentGame.currentTurnMoves[moveIndexOnBoard];
        const tile = move.tileRef;

        // Clear the tile from its board position in the game state
        currentGame.board.grid[move.to.row][move.to.col].tile = null;
        // Add tile back to the local player's rack (data structure)
        playerRack.push(tile);

        // If it was a blank tile placed from the rack this turn, reset its assigned letter.
        if (tile.isBlank && move.from === 'rack') {
            tile.assignedLetter = null;
        }
        // Remove the move from currentTurnMoves
        currentGame.currentTurnMoves.splice(moveIndexOnBoard, 1);
        console.log(`Tile ${tile.id} (${tile.letter || 'blank'}) returned to local player's rack. currentTurnMoves updated.`);
        draggedTileId = null; // Explicitly clear for board-to-rack, as it's a consummated move reversal.
    }

    fullRender(currentGame, localPlayerId); // Refresh UI
    // Note: draggedTileId is set to null if it was a board-to-rack move.
    // For rack-to-rack, it's usually cleared by the respective drag/touch end handlers,
    // but ensuring it's null here or in those handlers is important.
}

/**
 * Recalls all uncommitted tiles from the board back to the local player's rack.
 * - Clears `currentTurnMoves`.
 * - Resets assigned letters for recalled blank tiles.
 * - Updates game state and re-renders.
 */
function handleRecallTiles() {
    if (!currentGame) {
        console.log("handleRecallTiles: No game active.");
        return;
    }
    const localPlayerInstance = currentGame.players.find(p => p.id === localPlayerId);
    if (!localPlayerInstance) {
        console.error("handleRecallTiles: Local player instance not found.");
        return;
    }

    if (!currentGame.currentTurnMoves || currentGame.currentTurnMoves.length === 0) {
        console.log("handleRecallTiles: No uncommitted tiles to recall.");
        return;
    }

    console.log("Recalling all uncommitted tiles to rack...");
    // Iterate backwards because we are modifying the array (splicing is not used here, but good practice if it were)
    for (let i = currentGame.currentTurnMoves.length - 1; i >= 0; i--) {
        const move = currentGame.currentTurnMoves[i];
        const tileToRecall = move.tileRef; // The actual Tile object

        // Return tile to the local player's rack (data structure)
        localPlayerInstance.rack.push(tileToRecall);

        // If the recalled tile was a blank that had a letter assigned this turn, reset it
        if (tileToRecall.isBlank && move.from === 'rack') { // Check if it was originally from rack for this move
            tileToRecall.assignedLetter = null;
        }

        // Clear the tile from the board (data structure)
        if (currentGame.board.grid[move.to.row] && currentGame.board.grid[move.to.row][move.to.col]) {
            currentGame.board.grid[move.to.row][move.to.col].tile = null;
        } else {
            // This should not happen if moves are tracked correctly
            console.warn(`handleRecallTiles: Attempted to clear tile from invalid board location: ${move.to.row}, ${move.to.col}`);
        }
    }

    currentGame.currentTurnMoves = []; // Clear the array of uncommitted moves
    console.log("All uncommitted tiles recalled. Rack now:", localPlayerInstance.rack.map(t => t.letter || (t.isBlank ? 'BLANK' : '')));
    fullRender(currentGame, localPlayerId); // Refresh the display
    updateControlButtonsVisibility(); // Update button states (e.g., disable "Recall")
}

// --- Game Logic: Validation, Actions, and Scoring ---

/**
 * Handles the "Play Word" action.
 * - Validates tile placement and dictionary words.
 * - Calculates score.
 * - Updates game state (scores, draws new tiles, advances turn).
 * - Generates and displays turn URL.
 * - Saves game state.
 */
async function handleCommitPlay() {
    const result = await handleCommitPlayLogic(currentGame, localPlayerId);
    if (!result.success) {
        alert(result.message);
        fullRender(currentGame, localPlayerId);
        return;
    }

    updateGameStatus(currentGame);

    // Generate Turn URL
    const isFirstTurnByP1 = (currentGame.turnNumber === 1 && localPlayerId === 'player1');
    const settingsForURL = isFirstTurnByP1 ? currentGame.settings : null;
    const turnUrlParams = generateTurnUrlParams(currentGame, localPlayerId, result.wordDataForURL, settingsForURL);

    updateAfterMove(turnUrlParams, result.score);
}


/**
 * Handles the "Pass Turn" action.
 * - Recalls any uncommitted tiles.
 * - Advances turn, generates URL for the opponent.
 * - Updates UI and saves game state.
 */
function handlePassTurn() {
    if (!currentGame || currentGame.getCurrentPlayer().id !== localPlayerId) {
        alert("It's not your turn or no game active!");
        return;
    }

    // Recall any uncommitted tiles from the board before passing.
    if (currentGame.currentTurnMoves && currentGame.currentTurnMoves.length > 0) {
        console.log("handlePassTurn: Recalling uncommitted tiles before passing turn...");
        // Use handleRecallTiles for this logic to avoid duplication.
        // Note: handleRecallTiles itself calls fullRender and updateControlButtonsVisibility.
        // This is generally fine, though it means those might be called twice if handlePassTurn
        // also calls them at the end. For simplicity now, this is acceptable.
        // A more refined approach might have handleRecallTiles return a status and let caller decide on re-renders.
        handleRecallTiles(); // This will also clear currentGame.currentTurnMoves.
    }

    console.log(`Pass Turn: Initiated by ${currentGame.getCurrentPlayer().name}.`);

    // Advance turn and player
    currentGame.turnNumber++;
    currentGame.currentPlayerIndex = (currentGame.currentPlayerIndex + 1) % currentGame.players.length;

    // Generate URL for the pass action. For a pass, `exchangeData` is an empty string.
    const isFirstTurnByP1 = (currentGame.turnNumber === 1 && localPlayerId === 'player1');
    const urlSettings = isFirstTurnByP1 ? currentGame.settings : null;
    // The `null` for turnData indicates no word was played. The `""` for exchangeData signifies a pass.
    const turnUrlParams = generateTurnUrlParams(currentGame, localPlayerId, null, urlSettings, "");

    updateAfterMove(turnUrlParams, 0);
}


// Note: The original `handleExchangeTiles` (with prompt) is replaced by the new UI-driven exchange flow.
// The new flow consists of:
// 1. `handleExchangeTiles`: Activates exchange mode.
// 2. User clicks tiles in rack (handled by `renderTileInRack`'s click listener).
// 3. `handleConfirmExchange`: Processes selected tiles, ends turn.
// 4. `handleCancelExchange`: Deactivates exchange mode.

/**
 * Activates tile exchange mode.
 * - Recalls any uncommitted tiles from the board (with confirmation).
 * - Sets `isExchangeModeActive` to true.
 * - Clears `selectedTilesForExchange`.
 * - Updates UI (buttons, rack tile interactivity).
 */
function handleExchangeTiles() {
    if (!currentGame || currentGame.getCurrentPlayer().id !== localPlayerId) {
        alert("It's not your turn or no game active!");
        return;
    }

    // If there are uncommitted tiles on the board, confirm with the user before recalling them.
    if (currentGame.currentTurnMoves && currentGame.currentTurnMoves.length > 0) {
        const recallConfirmed = confirm(
            "You have pending moves on the board. " +
            "Starting a tile exchange will recall these moves. Are you sure?"
        );
        if (recallConfirmed) {
            handleRecallTiles(); // This will clear currentTurnMoves and re-render.
        } else {
            return; // User cancelled, do not proceed with exchange mode.
        }
    }

    const player = currentGame.getCurrentPlayer();
    if (player.rack.length === 0) {
        alert("Your rack is empty. No tiles to select for exchange.");
        return; // Cannot enter exchange mode with an empty rack.
    }
    if (currentGame.bag.length === 0) {
        alert("The tile bag is empty. Cannot exchange tiles.");
        return;
    }


    isExchangeModeActive = true;
    selectedTilesForExchange = []; // Reset any previous selection
    updateControlButtonsVisibility(); // Show confirm/cancel buttons, hide others
    // Re-render is important here:
    // - renderRack will make tiles non-draggable.
    // - renderTileInRack will add click listeners for selection and apply .selected-for-exchange class.
    fullRender(currentGame, localPlayerId);

    console.log("Exchange mode activated. Select tiles from your rack to exchange.");
}

/**
 * Confirms and processes the selected tiles for exchange.
 * - Validates selection and bag count.
 * - Removes selected tiles from player's rack, adds them to bag.
 * - Draws new tiles for the player.
 * - Shuffles bag, advances turn, generates URL.
 * - Updates UI and saves game state.
 */
function handleConfirmExchange() {
    if (!isExchangeModeActive) {
        console.log("handleConfirmExchange: Called when exchange mode is not active. No action taken.");
        return;
    }
    if (selectedTilesForExchange.length === 0) {
        alert("Please select at least one tile from your rack to exchange.");
        return;
    }

    const player = currentGame.getCurrentPlayer();
    if (currentGame.bag.length < selectedTilesForExchange.length) {
        alert(
            `Not enough tiles in the bag (${currentGame.bag.length}) to exchange ` +
            `${selectedTilesForExchange.length} tile(s).`
        );
        return;
    }

    console.log(`Confirming exchange for ${player.name}. Tiles: ${selectedTilesForExchange.map(t => t.letter || (t.isBlank ? 'BLANK' : '')).join(', ')}`);

    // For the URL, we need the original indices of the selected tiles from the player's current rack
    // *before* any splicing happens for this exchange operation.
    const currentRackIndicesForURL = selectedTilesForExchange.map(selectedTile =>
        player.rack.findIndex(rackTile => rackTile.id === selectedTile.id)
    ).filter(index => index !== -1); // Filter out -1 just in case, though selection should be from rack.

    // For actually removing tiles from the rack, sort indices descending to avoid issues with splicing.
    const indicesToSpliceFromRack = [...currentRackIndicesForURL].sort((a, b) => b - a);

    if (indicesToSpliceFromRack.length !== selectedTilesForExchange.length) {
        // This indicates a mismatch, possibly if a selected tile was somehow no longer in the rack.
        alert("Error: Some selected tiles could not be found in the rack for exchange. Please try again.");
        // Reset selection and mode as a precaution.
        selectedTilesForExchange = [];
        isExchangeModeActive = false;
        updateControlButtonsVisibility();
        fullRender(currentGame, localPlayerId);
        return;
    }

    // 1. Remove selected tiles from player's rack
    const tilesReturnedToBag = [];
    for (const index of indicesToSpliceFromRack) {
        tilesReturnedToBag.push(player.rack.splice(index, 1)[0]);
    }

    // 2. Player draws new tiles
    currentGame.drawTiles(player, tilesReturnedToBag.length);

    // 3. Add exchanged tiles back to the bag and reset blanks
    tilesReturnedToBag.forEach(tile => {
        if (tile.isBlank) tile.assignedLetter = null; // Reset blank tile before returning to bag
        currentGame.bag.push(tile);
    });

    // 4. Shuffle the bag
    currentGame._shuffleBag();

    // 5. Advance turn
    currentGame.turnNumber++;
    currentGame.currentPlayerIndex = (currentGame.currentPlayerIndex + 1) % currentGame.players.length;

    // 6. Generate Turn URL
    // The `exchangeData` for the URL should be the comma-separated string of original rack indices.
    const urlExchangeIndicesString = currentRackIndicesForURL.join(',');
    const isFirstTurnByP1 = (currentGame.turnNumber === 1 && localPlayerId === 'player1');
    const urlSettings = isFirstTurnByP1 ? currentGame.settings : null;
    const turnUrlParams = generateTurnUrlParams(currentGame, localPlayerId, null, urlSettings, urlExchangeIndicesString);

    updateAfterMove(turnUrlParams, 0);
}

/**
 * Cancels the tile exchange mode.
 * - Resets `isExchangeModeActive` and `selectedTilesForExchange`.
 * - Updates UI (buttons, rack tile interactivity).
 */
function handleCancelExchange() {
    if (!isExchangeModeActive) {
        console.log("handleCancelExchange: Called when exchange mode is not active. No action taken.");
        return;
    }
    console.log("Tile exchange cancelled by user.");

    isExchangeModeActive = false;
    selectedTilesForExchange = []; // Clear any selection

    updateControlButtonsVisibility(); // Restore normal play buttons
    // Re-render to remove selection styling from rack tiles and make them draggable again.
    fullRender(currentGame, localPlayerId);
}

/**
 * Updates the visibility and state of game control buttons
 * based on whether exchange mode is active or not.
 */
function updateControlButtonsVisibility() {
    const playWordBtn = document.getElementById('play-word-btn');
    const exchangeTilesBtn = document.getElementById('exchange-tiles-btn');
    const passTurnBtn = document.getElementById('pass-turn-btn');
    const recallTilesBtn = document.getElementById('recall-tiles-btn');
    const confirmExchangeBtn = document.getElementById('confirm-exchange-btn');
    const cancelExchangeBtn = document.getElementById('cancel-exchange-btn');

    // In exchange mode:
    if (isExchangeModeActive) {
        if (playWordBtn) playWordBtn.style.display = 'none';           // Hide normal play buttons
        if (exchangeTilesBtn) exchangeTilesBtn.style.display = 'none';
        if (passTurnBtn) passTurnBtn.style.display = 'none';
        if (recallTilesBtn) recallTilesBtn.style.display = 'none';

        if (confirmExchangeBtn) confirmExchangeBtn.style.display = 'inline-block'; // Show exchange action buttons
        if (cancelExchangeBtn) cancelExchangeBtn.style.display = 'inline-block';

        // Enable "Confirm Exchange" only if tiles are selected
        if (confirmExchangeBtn) {
            confirmExchangeBtn.disabled = selectedTilesForExchange.length === 0;
        }
    } else { // Normal play mode:
        if (playWordBtn) playWordBtn.style.display = 'inline-block';   // Show normal play buttons
        if (exchangeTilesBtn) exchangeTilesBtn.style.display = 'inline-block';
        if (passTurnBtn) passTurnBtn.style.display = 'inline-block';
        if (recallTilesBtn) recallTilesBtn.style.display = 'inline-block';

        if (confirmExchangeBtn) confirmExchangeBtn.style.display = 'none'; // Hide exchange action buttons
        if (cancelExchangeBtn) cancelExchangeBtn.style.display = 'none';

        // Ensure confirm button is not spuriously disabled when hidden (good practice)
        if (confirmExchangeBtn) confirmExchangeBtn.disabled = false;
    }
    // TODO: Add logic to disable/enable buttons based on whose turn it is, game over state, etc.
    // For example, Play/Exchange/Pass should be disabled if it's not the local player's turn.
    // Recall Tiles should be disabled if currentTurnMoves is empty.
}

function updateAfterMove(turnUrlParams, pointsEarned) {
    const baseURL = window.location.origin + window.location.pathname;
    const turnURL = `${baseURL}#${turnUrlParams.toString()}`;
    const turnUrlInput = document.getElementById('turn-url');
    if (turnUrlInput) {
        turnUrlInput.value = turnURL;
        console.log("Exchange Turn URL generated:", turnURL);
    }

    // Cleanup and UI updates
    selectedTilesForExchange = [];
    isExchangeModeActive = false;
    updateControlButtonsVisibility();
    showPostMoveModal(pointsEarned, turnURL);
    saveGameStateToLocalStorage(currentGame, localPlayerId, localStorage);
    fullRender(currentGame, localPlayerId);
}

/**
 * Initializes a new local game from scratch (not from URL).
 * - Creates a new GameState with a random seed and default settings.
 * - Sets the local player as 'player1'.
 * - Saves and renders the new game.
 */
function initializeNewGame(params) {
    const gameId = `game-${Date.now()}`; // Simple unique game ID
    const randomSeedStr = params.get('seed');
    const randomSeed = (randomSeedStr !== null ? parseInt(randomSeedStr) : Math.floor(Math.random() * 1000000));
    console.log(`initializeNewGame: seed is ${randomSeed}`);
    currentGame = new GameState(gameId, randomSeed, gameSettingsFromUrlParams(params));
    localPlayerId = 'player1'; // This browser initiates as Player 1
    console.log("New local game initialized by this browser (as Player 1):", currentGame);

    saveGameStateToLocalStorage(currentGame, localPlayerId, localStorage);
    fullRender(currentGame, localPlayerId);

    const turnUrlInput = document.getElementById('turn-url');
    if (turnUrlInput) {
        turnUrlInput.value = ""; // Clear any old URL
        turnUrlInput.placeholder = "Make your first move to generate a shareable URL.";
    }
    updateControlButtonsVisibility();
    // The first shareable URL is generated after Player 1 makes their first move (play, pass, or exchange).
}

/**
 * Toggles the visibility of the custom game settings section in the UI.
 * Resets dictionary type and URL to defaults when showing the section.
 */
function toggleCustomSettingsSection() {
    const settingsSection = document.getElementById('custom-settings-section');
    if (!settingsSection) return;

    if (settingsSection.style.display === 'none' || settingsSection.style.display === '') {
        settingsSection.style.display = 'block'; // Show the section
        // Reset dictionary options to default when opening
        const dictionaryTypeSelect = document.getElementById('dictionary-type-select');
        if (dictionaryTypeSelect) dictionaryTypeSelect.value = 'permissive';


        const customUrlInput = document.getElementById('custom-dictionary-url');
        if (customUrlInput) {
            customUrlInput.style.display = 'none'; // Hide URL input initially
            customUrlInput.value = ''; // Clear any previous custom URL
        }
        // Other custom game rule inputs (tile distribution, values, etc.) are intentionally *not* reset here,
        // allowing users to tweak previous custom settings if they reopen the section before starting a game.
    } else {
        settingsSection.style.display = 'none'; // Hide the section
    }
}

/**
 * Starts a new game using settings specified in the custom settings UI.
 * - Collects and validates settings from form inputs.
 * - Creates a new GameState.
 * - Sets local player as 'player1'.
 * - Saves and renders the game.
 */
function startGameWithSettings() {
    // Collect dictionary settings
    const selectedDictionaryType = document.getElementById('dictionary-type-select').value;
    let customDictionaryUrl = null;
    if (selectedDictionaryType === 'custom') {
        customDictionaryUrl = document.getElementById('custom-dictionary-url').value.trim();
        if (!customDictionaryUrl) {
            alert("Please enter a Custom Dictionary URL if 'Custom URL' type is selected.");
            return;
        }
        // Basic validation for custom URL format (e.g., should not end with placeholder)
        if (customDictionaryUrl.endsWith("<word>") || customDictionaryUrl.endsWith("{word}")) {
            alert("Please provide the base URL for the custom dictionary. The word will be appended automatically by the game.");
            return;
        }
    }

    const collectedGameSettings = {
        dictionaryType: selectedDictionaryType,
        dictionaryUrlOrFunction: customDictionaryUrl
        // Other game settings will be parsed and added below
    };

    // Read and parse custom tile distribution (if provided)
    const tileDistributionStr = document.getElementById('custom-tile-distribution').value.trim();
    if (tileDistributionStr) {
        try {
            const parsedDistribution = JSON.parse(tileDistributionStr);
            // Basic validation: check if it's an object
            if (typeof parsedDistribution === 'object' && parsedDistribution !== null && !Array.isArray(parsedDistribution)) {
                collectedGameSettings.letterDistribution = parsedDistribution;
            } else {
                alert("Invalid JSON format for Tile Distribution. It must be an object (e.g., {\"A\": 9, ...}).");
                return;
            }
        } catch (e) {
            alert("Error parsing Tile Distribution JSON: " + e.message + "\nPlease ensure it's valid JSON.");
            return;
        }
    }

    // Read and parse custom tile values (if provided)
    const tileValuesStr = document.getElementById('custom-tile-values').value.trim();
    if (tileValuesStr) {
        try {
            const parsedValues = JSON.parse(tileValuesStr);
            if (typeof parsedValues === 'object' && parsedValues !== null && !Array.isArray(parsedValues)) {
                collectedGameSettings.tileValues = parsedValues;
            } else {
                alert("Invalid JSON format for Tile Values. It must be an object (e.g., {\"A\": 1, ...}).");
                return;
            }
        } catch (e) {
            alert("Error parsing Tile Values JSON: " + e.message + "\nPlease ensure it's valid JSON.");
            return;
        }
    }

    // Read custom blank tile count (if provided)
    const blankTileCountStr = document.getElementById('custom-blank-tile-count').value.trim();
    if (blankTileCountStr) {
        const parsedBlankCount = parseInt(blankTileCountStr, 10);
        if (!isNaN(parsedBlankCount) && parsedBlankCount >= 0) {
            collectedGameSettings.blankTileCount = parsedBlankCount;
        } else {
            alert("Invalid Blank Tile Count. It must be a non-negative whole number.");
            return;
        }
    }

    // Read custom seven-tile bonus (if provided)
    const sevenTileBonusStr = document.getElementById('custom-seven-tile-bonus').value.trim();
    if (sevenTileBonusStr) {
        const parsedBonus = parseInt(sevenTileBonusStr, 10);
        if (!isNaN(parsedBonus) && parsedBonus >= 0) {
            collectedGameSettings.sevenTileBonus = parsedBonus;
        } else {
            alert("Invalid Seven Tile Bonus. It must be a non-negative whole number.");
            return;
        }
    }

    // Parse Custom Board Layout (if provided)
    const boardLayoutStr = document.getElementById('custom-board-layout').value.trim();
    if (boardLayoutStr) {
        const layoutRows = boardLayoutStr.split('\n').map(row => row.trim());
        // Validate board layout: must be 15 rows, each 15 chars long, using valid characters.
        if (layoutRows.length !== BOARD_SIZE) { // BOARD_SIZE is typically 15
            alert(`Custom Board Layout must have exactly ${BOARD_SIZE} rows.`);
            return;
        }
        if (layoutRows.some(row => row.length !== BOARD_SIZE)) {
            alert(`Each row in Custom Board Layout must have exactly ${BOARD_SIZE} characters.`);
            return;
        }
        const validLayoutChars = Object.values(BONUS_TYPES).concat(['T', 'D', 't', 'd', '.']); // Include actual mapping chars
        const invalidCharFound = layoutRows.some(row =>
            row.split('').some(char => !['T', 'D', 't', 'd', '.'].includes(char)) // More specific check for input format
        );
        if (invalidCharFound) {
            alert("Invalid character in Custom Board Layout. Only T, D, t, d, . (period) are allowed.");
            return;
        }
        collectedGameSettings.customBoardLayout = layoutRows;
    }

    // Get player names from input fields, use defaults if empty
    const player1NameInput = document.getElementById('player1-name-input').value.trim();
    const player2NameInput = document.getElementById('player2-name-input').value.trim();
    collectedGameSettings.playerNames = {
        player1: player1NameInput || "Player 1",
        player2: player2NameInput || "Player 2"
    };

    // Hide the settings section after successfully collecting settings
    const settingsSection = document.getElementById('custom-settings-section');
    if (settingsSection) {
        settingsSection.style.display = 'none';
    }

    // Initialize the game with the collected settings
    const gameId = `game-${Date.now()}`;
    const randomSeed = Math.floor(Math.random() * 1000000);  // TODO: Add seed to the form.
    currentGame = new GameState(gameId, randomSeed, collectedGameSettings);
    localPlayerId = 'player1'; // User starting a new game with settings is Player 1

    console.log("New game started with custom settings (as Player 1):", collectedGameSettings, currentGame);
    saveGameStateToLocalStorage(currentGame, localPlayerId, localStorage);
    fullRender(currentGame, localPlayerId);

    const turnUrlInput = document.getElementById('turn-url');
    if (turnUrlInput) {
        turnUrlInput.value = ""; // Clear any previous URL
        turnUrlInput.placeholder = "Make your first move to generate a shareable URL.";
    }
    updateControlButtonsVisibility();
    // The first shareable URL (containing settings and seed) will be generated after P1's first move.
}


// --- LocalStorage Functions ---
/**
 * Main function to load a game, either from URL parameters or from LocalStorage.
 * This function orchestrates the game setup or resumption process.
 * It determines if a game is being joined, continued, or started fresh.
 * @param {string} searchSource - Search string to use, e.g., `window.location.search`.
 * @param {Storage} storage - The storage object to use (e.g., localStorage).
 */
function loadGameFromURLOrStorage(hashSource, storage) {
    const params = new URLSearchParams(hashSource);
    const state = loadGameFromParamsOrStorage(params, localStorage, currentGame, localPlayerId);

    if (state.message) {
        alert(state.message);
    }
    currentGame = state.gameState;
    localPlayerId = state.playerId;
    if (!currentGame) {
        // Check if there's a "last played" game ID in a separate local storage item (optional feature, not implemented here)
        // For now, if no gameId in URL, initialize a brand new local game for testing/solo play.
        console.log("No current game. Initializing a new local game.");
        initializeNewGame(params); // This sets `currentGame` and `localPlayerId`, and calls saveGameStateToLocalStorage.
        // No need to return here, the rest of the function will handle rendering if currentGame is set.
    }
    // --- Final Rendering and UI Update ---
    if (currentGame) {
        fullRender(currentGame, localPlayerId); // Render the game board, racks, status
    } else {
        // This case should ideally be handled by initializeNewGame or specific error messages above.
        // If still no currentGame, display a generic "no game" message.
        console.log("loadGameFromParamsOrStorage: No game is active after processing URL/LocalStorage.");
        const boardContainer = document.getElementById('board-container');
        if (boardContainer) {
            if (state.message) {
                // TODO: Test whether this looks okay.
                boardContainer.innerText = state.message;
            } else {
                boardContainer.innerHTML = '<p>Start a new game or load one via a shared URL.</p>';
            }
        }
    }
    updateControlButtonsVisibility(); // Ensure button states are correct based on game state
}

/**
 * Main entry point: Sets up event listeners when the DOM is fully loaded.
 * Initializes or loads a game.
 */
function initializeGameAndEventListeners() {
    console.log("DOM fully loaded and parsed. Initializing game and event listeners.");

    // Hide copy URL button if clipboard API is not available
    if (!navigator.clipboard) {
        const copyUrlBtn = document.getElementById('copy-url-btn');
        if (copyUrlBtn) copyUrlBtn.style.display = 'none';
    }

    // Modal elements (cache them for reuse)
    const postMoveModalElement = document.getElementById('post-move-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    // Note: modalPointsEarnedSpan and modalCopyCheckbox are accessed within showPostMoveModal.

    // Load game from URL parameters or LocalStorage
    loadGameFromURLOrStorage(window.location.hash.substring(1), localStorage);

    // Add a hashchange event listener to reload the game when the URL fragment changes
    window.addEventListener('hashchange', () => {
        loadGameFromURLOrStorage(window.location.hash.substring(1), localStorage);
    });

    // Attach event listeners to game control buttons
    document.getElementById('play-word-btn').addEventListener('click', handleCommitPlay);
    document.getElementById('exchange-tiles-btn').addEventListener('click', handleExchangeTiles);
    document.getElementById('pass-turn-btn').addEventListener('click', handlePassTurn);
    document.getElementById('recall-tiles-btn').addEventListener('click', handleRecallTiles);
    document.getElementById('confirm-exchange-btn').addEventListener('click', handleConfirmExchange);
    document.getElementById('cancel-exchange-btn').addEventListener('click', handleCancelExchange);

    // "Setup New Game" button (toggles settings section)
    const newGameBtn = document.getElementById('new-game-btn');
    if (newGameBtn) newGameBtn.addEventListener('click', toggleCustomSettingsSection);

    // "Start New Game with These Settings" button (inside the settings section)
    const startGameBtn = document.getElementById('start-game-btn');
    if (startGameBtn) startGameBtn.addEventListener('click', startGameWithSettings);

    // Dictionary type dropdown: show/hide custom URL input
    const dictionaryTypeSelect = document.getElementById('dictionary-type-select');
    if (dictionaryTypeSelect) {
        dictionaryTypeSelect.addEventListener('change', function() {
            document.getElementById('custom-dictionary-url').style.display =
                (this.value === 'custom') ? 'block' : 'none';
        });
    }

    // "Copy URL" button for the main turn URL input field
    const copyUrlBtn = document.getElementById('copy-url-btn');
    const turnUrlInput = document.getElementById('turn-url');
    if (copyUrlBtn && turnUrlInput) {
        copyUrlBtn.addEventListener('click', () => {
            const urlToCopy = turnUrlInput.value;
            if (urlToCopy) {
                navigator.clipboard.writeText(urlToCopy)
                    .then(() => {
                        const originalButtonText = copyUrlBtn.textContent;
                        copyUrlBtn.textContent = 'Copied!';
                        copyUrlBtn.disabled = true;
                        setTimeout(() => {
                            copyUrlBtn.textContent = originalButtonText;
                            copyUrlBtn.disabled = false;
                        }, 2000); // Revert button text and state after 2 seconds
                    })
                    .catch(err => {
                        console.error('Failed to copy URL to clipboard: ', err);
                        alert("Failed to automatically copy URL. Please copy it manually.");
                    });
            } else { // No URL in the input field
                const originalButtonText = copyUrlBtn.textContent;
                copyUrlBtn.textContent = 'No URL!';
                setTimeout(() => {
                    copyUrlBtn.textContent = originalButtonText;
                }, 1500);
            }
        });
    }

    // Post-move modal close button functionality
    if (modalCloseBtn && postMoveModalElement) {
        modalCloseBtn.addEventListener('click', () => {
            const modalCopyCheckbox = document.getElementById('modal-copy-url-checkbox');
            // If checkbox is checked, attempt to copy URL from modal's dataset before closing
            if (modalCopyCheckbox && modalCopyCheckbox.checked) {
                const urlToCopyFromModal = postMoveModalElement.dataset.turnUrl;
                if (urlToCopyFromModal && navigator.clipboard) {
                    navigator.clipboard.writeText(urlToCopyFromModal)
                        .then(() => console.log('Turn URL copied to clipboard from modal.'))
                        .catch(err => {
                            console.error('Failed to copy URL from modal: ', err);
                            // User might need to copy manually from the main input field if this fails.
                        });
                } else {
                    console.warn('No Turn URL found in modal dataset to copy.');
                }
            }
            postMoveModalElement.setAttribute('hidden', 'true'); // Hide the modal
        });
    }

    // Keyboard shortcuts for the post-move modal (Enter to close and copy, Escape to close)
    document.addEventListener('keydown', (event) => {
        if (postMoveModalElement && !postMoveModalElement.hasAttribute('hidden')) { // If modal is visible
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent default form submission if modal is in a form
                if (modalCloseBtn) modalCloseBtn.click(); // Simulate click on close button
            } else if (event.key === 'Escape') {
                event.preventDefault();
                postMoveModalElement.setAttribute('hidden', 'true'); // Hide on Escape
            }
        }
    });
}

export { initializeGameAndEventListeners };
