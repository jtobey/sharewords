"use strict";

// Placeholder for game logic and UI interaction
console.log("Crossword Builder Game script loaded.");

// --- PRNG (Mulberry32) ---
/**
 * Creates a seeded pseudorandom number generator (Mulberry32).
 * @param {number} seed - The seed for the PRNG.
 * @returns {function} A function that returns a new random number between 0 (inclusive) and 1 (exclusive) each time it's called.
 */
function Mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// --- Constants ---
const BOARD_SIZE = 15;
const RACK_SIZE = 7;
const BONUS_TYPES = {
    NONE: 'none',
    DL: 'dl', // Double Letter
    TL: 'tl', // Triple Letter
    DW: 'dw', // Double Word
    TW: 'tw'  // Triple Word
};

// Default Tile Values and Distribution (can be overridden by game settings)
const DEFAULT_TILE_VALUES = {
    'A': 1, 'B': 3, 'C': 3, 'D': 2, 'E': 1, 'F': 4, 'G': 2, 'H': 4, 'I': 1, 'J': 8,
    'K': 5, 'L': 1, 'M': 3, 'N': 1, 'O': 1, 'P': 3, 'Q': 10, 'R': 1, 'S': 1, 'T': 1,
    'U': 1, 'V': 4, 'W': 4, 'X': 8, 'Y': 4, 'Z': 10
};
const DEFAULT_LETTER_DISTRIBUTION = {
    'A': 9, 'B': 2, 'C': 2, 'D': 4, 'E': 12, 'F': 2, 'G': 3, 'H': 2, 'I': 9, 'J': 1,
    'K': 1, 'L': 4, 'M': 2, 'N': 6, 'O': 8, 'P': 2, 'Q': 1, 'R': 6, 'S': 4, 'T': 6,
    'U': 4, 'V': 2, 'W': 2, 'X': 1, 'Y': 2, 'Z': 1
};

// --- Data Structures ---
function Tile(letter, value, isBlank = false) {
    this.letter = letter;
    this.value = value;
    this.isBlank = isBlank;
    this.assignedLetter = null;
    this.id = `tile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
function Square(row, col, bonus = BONUS_TYPES.NONE) {
    this.row = row;
    this.col = col;
    this.bonus = bonus;
    this.tile = null;
    this.bonusUsed = false;
}
function Board(size = BOARD_SIZE, layout = null) {
    this.size = size;
    this.grid = [];
    for (let r = 0; r < size; r++) {
        this.grid[r] = [];
        for (let c = 0; c < size; c++) {
            this.grid[r][c] = new Square(r, c, BONUS_TYPES.NONE);
        }
    }
    if (!layout) {
        const tw_coords = [[0,0], [0,7], [0,14], [7,0], [7,14], [14,0], [14,7], [14,14]];
        tw_coords.forEach(([r,c]) => { if(this.grid[r] && this.grid[r][c]) this.grid[r][c].bonus = BONUS_TYPES.TW; });
        const dw_coords = [[1,1], [2,2], [3,3], [4,4], [1,13], [2,12], [3,11], [4,10], [13,1], [12,2], [11,3], [10,4], [13,13], [12,12], [11,11], [10,10]];
        dw_coords.forEach(([r,c]) => { if(this.grid[r] && this.grid[r][c]) this.grid[r][c].bonus = BONUS_TYPES.DW; });
        const tl_coords = [[1,5], [1,9], [5,1], [5,5], [5,9], [5,13], [9,1], [9,5], [9,9], [9,13], [13,5], [13,9]];
        tl_coords.forEach(([r,c]) => { if(this.grid[r] && this.grid[r][c]) this.grid[r][c].bonus = BONUS_TYPES.TL; });
        const dl_coords = [[0,3], [0,11], [2,6], [2,8], [3,0], [3,7], [3,14], [6,2], [6,6], [6,8], [6,12], [7,3], [7,11], [8,2], [8,6], [8,8], [8,12], [11,0], [11,7], [11,14], [12,6], [12,8], [14,3], [14,11]];
        dl_coords.forEach(([r,c]) => { if(this.grid[r] && this.grid[r][c]) this.grid[r][c].bonus = BONUS_TYPES.DL; });
    }
    this.getCenterSquare = function() {
        return this.grid[Math.floor(this.size / 2)][Math.floor(this.size / 2)];
    }
}
function Player(id, name) {
    this.id = id;
    this.name = name;
    this.rack = [];
    this.score = 0;
}
function GameState(gameId, randomSeed, settings = {}) {
    this.gameId = gameId;
    this.randomSeed = randomSeed;
    this.settings = {
        boardSize: settings.boardSize || BOARD_SIZE, // Allow overriding via settings
        rackSize: settings.rackSize || RACK_SIZE, // Allow overriding via settings
        blankTileCount: settings.blankTileCount !== undefined ? settings.blankTileCount : 2,
        sevenTileBonus: settings.sevenTileBonus !== undefined ? settings.sevenTileBonus : 50,
        dictionaryType: settings.dictionaryType || 'permissive', // Default to permissive
        dictionaryUrl: settings.dictionaryUrl || null,
        tileValues: settings.tileValues || DEFAULT_TILE_VALUES,
        letterDistribution: settings.letterDistribution || DEFAULT_LETTER_DISTRIBUTION,
        customBoardLayout: settings.customBoardLayout || null,
        ...settings // Spread any other settings passed in
    };
    this.prng = Mulberry32(this.randomSeed);
    this._initializeBag = function() {
        this.bag = [];
        const distribution = this.settings.letterDistribution;
        const values = this.settings.tileValues;
        for (const letter in distribution) {
            if (distribution.hasOwnProperty(letter)) {
                for (let i = 0; i < distribution[letter]; i++) {
                    this.bag.push(new Tile(letter, values[letter] || 0));
                }
            }
        }
        for (let i = 0; i < this.settings.blankTileCount; i++) {
            this.bag.push(new Tile('', 0, true));
        }
    };
    this._shuffleBag = function() {
        if (!this.prng) {
            console.error("PRNG not initialized for shuffling.");
            for (let i = this.bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
            }
            return;
        }
        for (let i = this.bag.length - 1; i > 0; i--) {
            const j = Math.floor(this.prng() * (i + 1));
            [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
    };
    this.drawTiles = function(player, numTiles) {
        const drawnTiles = [];
        for (let i = 0; i < numTiles && this.bag.length > 0; i++) {
            const tile = this.bag.pop();
            if (tile) {
                player.rack.push(tile);
                drawnTiles.push(tile);
            }
        }
        return drawnTiles;
    };
    this.players = [new Player("player1", "Player 1"), new Player("player2", "Player 2")];
    this.currentPlayerIndex = 0;
    this.bag = [];
    this._initializeBag(); this._shuffleBag();
    this.players.forEach(player => { this.drawTiles(player, this.settings.rackSize); });
    this.board = new Board(this.settings.boardSize, this.settings.customBoardLayout || this.settings.defaultBoardLayout);
    this.turnNumber = 0;
    this.currentTurnMoves = [];
    this.gameHistory = [];
    this.isGameOver = false;
    this.creatorId = null;
    this.getCurrentPlayer = function() { return this.players[this.currentPlayerIndex]; };
    this.getOpponentPlayer = function() { return this.players[(this.currentPlayerIndex + 1) % 2]; };
}

let currentGame = null;
let localPlayerId = "player1";

// --- UI Rendering Functions ---
function renderBoard(gameState) {
    const boardContainer = document.getElementById('board-container');
    if (!boardContainer || !gameState || !gameState.board) {
        console.error("Cannot render board: missing container or gameState.");
        return;
    }
    boardContainer.innerHTML = '';
    // Use CSS variables for responsive grid sizing
    boardContainer.style.gridTemplateColumns = `repeat(${gameState.board.size}, var(--tile-size))`;
    boardContainer.style.gridTemplateRows = `repeat(${gameState.board.size}, var(--tile-size))`;
    const centerR = Math.floor(gameState.board.size / 2);
    const centerC = Math.floor(gameState.board.size / 2);
    for (let r = 0; r < gameState.board.size; r++) {
        for (let c = 0; c < gameState.board.size; c++) {
            const squareData = gameState.board.grid[r][c];
            const squareDiv = document.createElement('div');
            squareDiv.classList.add('square');
            squareDiv.dataset.row = r; squareDiv.dataset.col = c;
            if (squareData.bonus !== BONUS_TYPES.NONE) squareDiv.classList.add(squareData.bonus);
            if (r === centerR && c === centerC && squareData.bonus === BONUS_TYPES.NONE) squareDiv.classList.add('center');
            if (squareData.tile) {
                const tile = squareData.tile;
                const letterSpan = document.createElement('span');
                letterSpan.classList.add('tile-letter');
                letterSpan.textContent = tile.isBlank ? (tile.assignedLetter ? `(${tile.assignedLetter.toUpperCase()})` : '(?)') : tile.letter;
                const valueSpan = document.createElement('span');
                valueSpan.classList.add('tile-value');
                valueSpan.textContent = tile.value;
                squareDiv.innerHTML = '';
                squareDiv.appendChild(letterSpan); squareDiv.appendChild(valueSpan);
                squareDiv.classList.add('tile-on-board');
                const isCurrentTurnMove = currentGame.currentTurnMoves.find(m => m.tileId === tile.id && m.to.row === r && m.to.col === c);
                if (isCurrentTurnMove && currentGame.getCurrentPlayer().id === localPlayerId) {
                    squareDiv.draggable = true;
                    squareDiv.addEventListener('dragstart', handleDragStart);
                    squareDiv.addEventListener('dragend', handleDragEnd);
                    // Add touch listeners for tiles on board
                    squareDiv.addEventListener('touchstart', handleTouchStart, { passive: false });
                    squareDiv.dataset.tileId = tile.id;
                }
            }
            squareDiv.addEventListener('dragover', handleDragOver);
            squareDiv.addEventListener('drop', handleDropOnBoard);
            // Touch listeners for drop targets (board squares)
            // squareDiv.addEventListener('touchmove', handleTouchMove, { passive: false }); // Moved to document
            // squareDiv.addEventListener('touchend', handleTouchEndBoard); // Moved to document
            boardContainer.appendChild(squareDiv);
        }
    }
}
function renderTileInRack(tile, isDraggable = false) {
    const tileDiv = document.createElement('div');
    tileDiv.classList.add('tile-in-rack');
    tileDiv.dataset.tileId = tile.id;
    if (isDraggable) {
        tileDiv.draggable = true;
        tileDiv.addEventListener('dragstart', handleDragStart);
        tileDiv.addEventListener('dragend', handleDragEnd);
        // Add touch listeners for rack tiles
        tileDiv.addEventListener('touchstart', handleTouchStart, { passive: false });
    }
    const letterSpan = document.createElement('span');
    letterSpan.classList.add('tile-letter');
    letterSpan.textContent = tile.isBlank ? '?' : tile.letter.toUpperCase();
    const valueSpan = document.createElement('span');
    valueSpan.classList.add('tile-value');
    valueSpan.textContent = tile.value;
    tileDiv.appendChild(letterSpan); tileDiv.appendChild(valueSpan);
    return tileDiv;
}

function renderRacks(gameState, localPlayerId) {
    if (!gameState || !gameState.players) return;

    const localPlayer = gameState.players.find(p => p.id === localPlayerId);
    const localRackElement = document.getElementById('local-player-rack');

    if (!localPlayer || !localRackElement) {
        console.error("Could not find local player or their rack element DOM reference.");
        return;
    }

    localRackElement.innerHTML = ''; // Clear existing tiles

    // Determine if the local player is the current turn player
    const isLocalPlayerTurn = currentGame && localPlayer.id === currentGame.getCurrentPlayer().id;

    // Add or remove DND listeners for the rack
    if (isLocalPlayerTurn) {
        localRackElement.addEventListener('dragover', handleDragOver);
        localRackElement.addEventListener('drop', handleDropOnRack);
        // Touch DND listeners are added to individual tiles, but the rack itself needs to be a drop target.
        // The original `handleTouchEnd` logic checks `dropTargetElement.closest('.rack')`.
        // So, no specific touch listeners needed directly on the rack div beyond what might be handled globally
        // or if it were to accept direct drops (which it does via elementFromPoint).
    } else {
        localRackElement.removeEventListener('dragover', handleDragOver);
        localRackElement.removeEventListener('drop', handleDropOnRack);
    }

    // Render tiles for the local player
    localPlayer.rack.forEach(tile => {
        const isDraggable = isLocalPlayerTurn; // Tiles are draggable if it's the local player's turn
        localRackElement.appendChild(renderTileInRack(tile, isDraggable));
    });
}

function updateGameStatus(gameState) {
    if (!gameState) return;

    // Update player names and scores in the header
    const player1 = gameState.players[0];
    const player2 = gameState.players[1];

    const headerP1Name = document.getElementById('header-player1-name');
    const headerP1Score = document.getElementById('header-player1-score');
    const headerP2Name = document.getElementById('header-player2-name');
    const headerP2Score = document.getElementById('header-player2-score');

    if (headerP1Name) headerP1Name.textContent = player1.name;
    if (headerP1Score) headerP1Score.textContent = player1.score;
    if (headerP2Name) headerP2Name.textContent = player2.name;
    if (headerP2Score) headerP2Score.textContent = player2.score;

    // Update turn player and tiles in bag (these elements remain in the info panel)
    document.getElementById('turn-player').textContent = gameState.getCurrentPlayer().name;
    document.getElementById('tiles-in-bag').textContent = gameState.bag.length;
}

function fullRender(gameState, localPlayerId) {
    if (!gameState) {
        document.getElementById('board-container').innerHTML = '<p>No game active. Start a new game or load one via URL.</p>';
        return;
    }
    renderBoard(gameState); renderRacks(gameState, localPlayerId); updateGameStatus(gameState);
}

// --- Drag and Drop Handlers ---
let draggedTileId = null; // For mouse DND

// --- Touch Drag and Drop Handlers ---
let touchDraggedElement = null; // The element being dragged
let touchDraggedTileId = null;  // The ID of the tile being dragged (from dataset.tileId)
let initialTouchX = 0; // Touch X position relative to viewport
let initialTouchY = 0; // Touch Y position relative to viewport
let offsetX = 0; // Offset from touch point to tile's top-left corner
let offsetY = 0; // Offset from touch point to tile's top-left corner
let originalParentNode = null; // Original parent of the dragged tile
let originalNextSibling = null; // For restoring position in flex container like the rack
let draggedElementOriginalStyles = null; // To restore original styles

function handleTouchStart(event) {
    const currentTurnPlayerId = currentGame ? currentGame.getCurrentPlayer().id : null;
    if (!currentGame || currentTurnPlayerId !== localPlayerId) {
        console.log("Touch drag prevented: Not current player's turn or local player mismatch.");
        return;
    }

    const tileElement = event.target.closest('[data-tile-id]');
    if (!tileElement) return;

    // Check if the tile is actually draggable (already on board by current player, or in current player's rack)
    const tileId = tileElement.dataset.tileId;
    const player = currentGame.getCurrentPlayer();
    const isTileInRack = player.rack.some(t => t.id === tileId);
    const isTileOnBoardFromCurrentTurn = currentGame.currentTurnMoves.some(m => m.tileId === tileId);

    if (!isTileInRack && !isTileOnBoardFromCurrentTurn) {
        console.log("Touch drag prevented: Tile is not draggable by current player.", tileId);
        return;
    }

    event.preventDefault(); // IMPORTANT: Prevent default touch actions like scrolling

    touchDraggedTileId = tileId;
    touchDraggedElement = tileElement;

    console.log('Touch Start:', touchDraggedTileId);

    originalParentNode = touchDraggedElement.parentNode;
    originalNextSibling = touchDraggedElement.nextSibling;

    // Store original styles to revert if not dropped on a valid target
    draggedElementOriginalStyles = {
        position: touchDraggedElement.style.position,
        left: touchDraggedElement.style.left,
        top: touchDraggedElement.style.top,
        opacity: touchDraggedElement.style.opacity,
        zIndex: touchDraggedElement.style.zIndex,
        transform: touchDraggedElement.style.transform // If using transform for movement
    };

    // Visually lift the tile and prepare for movement
    const rect = touchDraggedElement.getBoundingClientRect();
    offsetX = event.touches[0].clientX - rect.left;
    offsetY = event.touches[0].clientY - rect.top;

    // Move element to body to ensure it's on top and position is relative to viewport
    document.body.appendChild(touchDraggedElement);
    touchDraggedElement.style.position = 'absolute';
    touchDraggedElement.style.left = (event.touches[0].clientX - offsetX) + 'px';
    touchDraggedElement.style.top = (event.touches[0].clientY - offsetY) + 'px';
    touchDraggedElement.style.opacity = '0.7';
    touchDraggedElement.style.zIndex = '1001'; // Ensure it's on top

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd); // Handle abrupt cancels
}

function handleTouchMove(event) {
    if (!touchDraggedElement) return;
    event.preventDefault(); // Prevent scrolling during drag

    const touch = event.touches[0];
    touchDraggedElement.style.left = (touch.clientX - offsetX) + 'px';
    touchDraggedElement.style.top = (touch.clientY - offsetY) + 'px';

    // Visual feedback for drop targets
    document.querySelectorAll('.touch-drag-over').forEach(el => el.classList.remove('touch-drag-over'));
    const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
    if (elementUnderTouch) {
        const potentialDropTarget = elementUnderTouch.closest('.square, .rack');
        if (potentialDropTarget) {
            // Check if the square is empty or is the original square of the tile being moved
            const isSquare = potentialDropTarget.classList.contains('square');
            if (isSquare) {
                const r = parseInt(potentialDropTarget.dataset.row);
                const c = parseInt(potentialDropTarget.dataset.col);
                const boardSquare = currentGame.board.grid[r][c];
                // Allow drop on empty square, or on its own square if moving a tile already on board
                const isOriginalSquare = boardSquare.tile && boardSquare.tile.id === touchDraggedTileId;
                if (!boardSquare.tile || isOriginalSquare) {
                    potentialDropTarget.classList.add('touch-drag-over');
                }
            } else { // It's a rack
                potentialDropTarget.classList.add('touch-drag-over');
            }
        }
    }
}

function handleTouchEnd(event) {
    if (!touchDraggedElement) return;

    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    document.removeEventListener('touchcancel', handleTouchEnd);
    document.querySelectorAll('.touch-drag-over').forEach(el => el.classList.remove('touch-drag-over'));

    // Temporarily hide the dragged element to correctly find the element underneath
    touchDraggedElement.style.display = 'none';
    const touch = event.changedTouches[0];
    const dropTargetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    touchDraggedElement.style.display = ''; // Make it visible again

    // Restore initial styles before decision, will be overridden by game logic if drop is successful
    // touchDraggedElement.style.position = draggedElementOriginalStyles.position;
    // touchDraggedElement.style.left = draggedElementOriginalStyles.left;
    // touchDraggedElement.style.top = draggedElementOriginalStyles.top;
    // touchDraggedElement.style.opacity = draggedElementOriginalStyles.opacity;
    // touchDraggedElement.style.zIndex = draggedElementOriginalStyles.zIndex;


    let droppedSuccessfully = false;

    if (dropTargetElement) {
        const boardSquareElement = dropTargetElement.closest('.square');
        const rackElement = dropTargetElement.closest('.rack');

        if (boardSquareElement) {
            const r = parseInt(boardSquareElement.dataset.row);
            const c = parseInt(boardSquareElement.dataset.col);
            const boardSquare = currentGame.board.grid[r][c];

            // Allow drop if square is empty, or if it's the original square of the tile (moving a tile on board)
            if (!boardSquare.tile || (boardSquare.tile && boardSquare.tile.id === touchDraggedTileId)) {
                console.log(`Touch Drop on Board: tile ${touchDraggedTileId} to (${r},${c})`);

                // The touchDraggedElement is currently child of document.body.
                // The handleDropOnBoard function expects the tile to be logically in the rack or on the board (data structure).
                // It then re-renders, which will create new DOM elements.
                // So, we can remove touchDraggedElement from body before calling, as fullRender will recreate it.
                touchDraggedElement.remove();


                const realDraggedTileIdBackup = draggedTileId; // Backup mouse DND state
                draggedTileId = touchDraggedTileId;    // Set for handleDropOnBoard

                const mockDropEvent = { preventDefault: () => {}, target: boardSquareElement };
                handleDropOnBoard(mockDropEvent); // This function should call fullRender

                draggedTileId = realDraggedTileIdBackup; // Restore mouse DND state
                droppedSuccessfully = true;
            } else {
                 console.log("Touch Drop on Board: Square occupied by a different tile. Returning tile.");
            }
        } else if (rackElement && rackElement.id === `${currentGame.getCurrentPlayer().id}-rack`) {
            // Ensure it's the current player's rack
            console.log(`Touch Drop on Rack: tile ${touchDraggedTileId}`);
            touchDraggedElement.remove();

            const realDraggedTileIdBackup = draggedTileId;
            draggedTileId = touchDraggedTileId;

            const mockDropEvent = { preventDefault: () => {}, target: rackElement };
            handleDropOnRack(mockDropEvent); // This function should call fullRender

            draggedTileId = realDraggedTileIdBackup;
            droppedSuccessfully = true;
        }
    }

    if (!droppedSuccessfully) {
        console.log("Touch Drop failed or on invalid target. Returning tile to original position.");
        // If the element was not removed by a successful drop, return it.
        if (touchDraggedElement.parentNode === document.body) { // Check if it's still child of body
             touchDraggedElement.remove(); // Remove from body first
        }
        // Re-insert into original position if it was in the rack or re-render for board
        if (originalParentNode) {
             // Restore styles before re-inserting
            touchDraggedElement.style.position = draggedElementOriginalStyles.position;
            touchDraggedElement.style.left = draggedElementOriginalStyles.left;
            touchDraggedElement.style.top = draggedElementOriginalStyles.top;
            touchDraggedElement.style.opacity = draggedElementOriginalStyles.opacity;
            touchDraggedElement.style.zIndex = draggedElementOriginalStyles.zIndex;
            touchDraggedElement.style.transform = draggedElementOriginalStyles.transform;

            originalParentNode.insertBefore(touchDraggedElement, originalNextSibling);
        }
        // If the drop failed, a fullRender might be needed to ensure consistency,
        // especially if the tile was from the board. The drop handlers usually call fullRender.
        // If we got here, it means no drop handler was called.
        fullRender(currentGame, localPlayerId);
    }

    // Reset state
    touchDraggedElement = null;
    touchDraggedTileId = null;
    originalParentNode = null;
    originalNextSibling = null;
    draggedElementOriginalStyles = null;
}

// Add a simple CSS class for visual feedback on touch drag over
const styleSheet = document.createElement("style");
styleSheet.innerText = `
    .touch-drag-over { background-color: #cccccc !important; outline: 1px dashed #333; }
    /* Style for the tile being dragged by touch */
    .tile-touch-dragging {
        /* opacity: 0.7; */ /* Already set by JS */
        /* transform: scale(1.1); */ /* Optional: make it slightly larger */
    }
`;
document.head.appendChild(styleSheet);


function handleDragStart(event) {
    const currentTurnPlayerId = currentGame ? currentGame.getCurrentPlayer().id : null;
    console.log(`Drag Start Attempt: localPlayerId='${localPlayerId}', currentTurnPlayerId='${currentTurnPlayerId}'`);
    if (!currentGame || currentTurnPlayerId !== localPlayerId) {
        console.log("Drag prevented: Not current player's turn or local player mismatch.");
        event.preventDefault(); return;
    }
    const tileElement = event.target.closest('[data-tile-id]');
    if (!tileElement) { event.preventDefault(); return; }
    draggedTileId = tileElement.dataset.tileId;
    event.dataTransfer.setData('text/plain', draggedTileId);
    event.dataTransfer.effectAllowed = 'move';
    event.target.style.opacity = '0.5';
    console.log('Drag Start:', draggedTileId);
}
function handleDragEnd(event) {
    if(event.target && event.target.style) event.target.style.opacity = '1';
    draggedTileId = null; console.log('Drag End');
}
function handleDragOver(event) { event.preventDefault(); event.dataTransfer.dropEffect = 'move';}
function handleDropOnBoard(event) {
    event.preventDefault(); if (!draggedTileId) return;
    const targetSquareElement = event.target.closest('.square');
    if (!targetSquareElement) return;
    const row = parseInt(targetSquareElement.dataset.row);
    const col = parseInt(targetSquareElement.dataset.col);
    if (isNaN(row) || isNaN(col)) return;
    const boardSquare = currentGame.board.grid[row][col];
    if (boardSquare.tile) {
        const existingMove = currentGame.currentTurnMoves.find(move => move.tileId === draggedTileId);
        if (!existingMove || (existingMove && boardSquare.tile.id !== draggedTileId)) {
             console.log("Square already occupied by a different tile or tile is not from board."); return;
        }
    }
    const player = currentGame.getCurrentPlayer(); let tile; let originalSourceType = 'rack';
    const existingMoveIndex = currentGame.currentTurnMoves.findIndex(move => move.tileId === draggedTileId);
    if (existingMoveIndex !== -1) {
        const move = currentGame.currentTurnMoves[existingMoveIndex]; tile = move.tileRef; originalSourceType = 'board';
        let originalPosition = { row: move.to.row, col: move.to.col };
        if (originalPosition.row === row && originalPosition.col === col) { draggedTileId = null; fullRender(currentGame, localPlayerId); return; }
        currentGame.board.grid[originalPosition.row][originalPosition.col].tile = null;
        move.to = { row, col };
    } else {
        const tileIndexInRack = player.rack.findIndex(t => t.id === draggedTileId);
        if (tileIndexInRack === -1) { draggedTileId = null; fullRender(currentGame, localPlayerId); return; }
        tile = player.rack[tileIndexInRack]; player.rack.splice(tileIndexInRack, 1);
        currentGame.currentTurnMoves.push({ tileId: tile.id, tileRef: tile, from: 'rack', to: { row, col }});
    }
    if (originalSourceType === 'rack' && tile.isBlank && !tile.assignedLetter) {
        let assigned = '';
        while (assigned.length !== 1 || !/^[A-Z]$/i.test(assigned)) {
            assigned = prompt("Enter a letter for the blank tile (A-Z):");
            if (assigned === null) {
                if (originalSourceType === 'rack') player.rack.push(tile);
                const newMoveIdx = currentGame.currentTurnMoves.findIndex(m => m.tileId === tile.id);
                if (newMoveIdx !== -1) currentGame.currentTurnMoves.splice(newMoveIdx, 1);
                draggedTileId = null; fullRender(currentGame, localPlayerId); return;
            }
            assigned = assigned.toUpperCase();
        }
        tile.assignedLetter = assigned;
    }
    boardSquare.tile = tile;
    console.log(`Tile ${tile.id} (${tile.letter || 'blank'}) moved to (${row},${col}). currentTurnMoves:`, currentGame.currentTurnMoves);
    fullRender(currentGame, localPlayerId); draggedTileId = null;
}
function handleDropOnRack(event) {
    event.preventDefault(); if (!draggedTileId) return;
    const player = currentGame.getCurrentPlayer();
    const rackElement = document.getElementById(`${player.id}-rack`);
    if (!rackElement || !rackElement.contains(event.target)) return;
    const moveIndex = currentGame.currentTurnMoves.findIndex(m => m.tileId === draggedTileId);
    if (moveIndex === -1) { console.log("Tile dragged to rack was not from board this turn."); return; }
    const move = currentGame.currentTurnMoves[moveIndex]; const tile = move.tileRef;
    currentGame.board.grid[move.to.row][move.to.col].tile = null;
    player.rack.push(tile);
    if (tile.isBlank && move.from === 'rack') tile.assignedLetter = null;
    currentGame.currentTurnMoves.splice(moveIndex, 1);
    console.log(`Tile ${tile.id} (${tile.letter}) returned to rack. currentTurnMoves:`, currentGame.currentTurnMoves);
    fullRender(currentGame, localPlayerId); draggedTileId = null;
}

// --- Game Validation and Action Handlers ---
function validatePlacement(moves, turnNumber, boardState) {
    const validationResult = { isValid: false, message: "", direction: null };
    if (!moves || moves.length === 0) { validationResult.message = "No tiles placed to validate."; return validationResult; }
    const sortedMoves = [...moves].sort((a, b) => (a.to.row === b.to.row) ? a.to.col - b.to.col : a.to.row - b.to.row);
    let isLineHorizontal = true, isLineVertical = true;
    if (sortedMoves.length > 0) {
        isLineHorizontal = sortedMoves.every(m => m.to.row === sortedMoves[0].to.row);
        isLineVertical = sortedMoves.every(m => m.to.col === sortedMoves[0].to.col);
        if (sortedMoves.length > 1 && !isLineHorizontal && !isLineVertical) {
            validationResult.message = "Invalid placement: Newly placed tiles must form a single horizontal or vertical line."; return validationResult;
        }
    }
    if (sortedMoves.length === 1) { // For single tile, determine preferred direction
        const r = sortedMoves[0].to.row, c = sortedMoves[0].to.col;
        const formsHorizontal = (c > 0 && boardState.grid[r][c-1].tile) || (c < boardState.size-1 && boardState.grid[r][c+1].tile);
        const formsVertical = (r > 0 && boardState.grid[r-1][c].tile) || (r < boardState.size-1 && boardState.grid[r+1][c].tile);
        validationResult.direction = formsHorizontal ? 'horizontal' : (formsVertical ? 'vertical' : 'horizontal');
    } else if (isLineHorizontal) validationResult.direction = 'horizontal';
    else if (isLineVertical) validationResult.direction = 'vertical';

    if (sortedMoves.length > 1) {
        const first = sortedMoves[0].to, last = sortedMoves[sortedMoves.length-1].to;
        if (validationResult.direction === 'horizontal') {
            for (let c = first.col + 1; c < last.col; c++)
                if (!sortedMoves.some(m=>m.to.row===first.row && m.to.col===c) && !boardState.grid[first.row][c].tile) {
                    validationResult.message = "Invalid placement: Tiles in a new word must be contiguous (no gaps)."; return validationResult;
                }
        } else if (validationResult.direction === 'vertical') {
            for (let r = first.row + 1; r < last.row; r++)
                if (!sortedMoves.some(m=>m.to.col===first.col && m.to.row===r) && !boardState.grid[r][first.col].tile) {
                    validationResult.message = "Invalid placement: Tiles in a new word must be contiguous (no gaps)."; return validationResult;
                }
        }
    }
    if (turnNumber === 0) {
        const center = boardState.getCenterSquare();
        if (!sortedMoves.some(m => m.to.row === center.row && m.to.col === center.col)) {
            validationResult.message = "Invalid placement: The first word must cover the center square."; return validationResult;
        }
    } else {
        let connects = false, boardHasTiles = false;
        for(let r_idx=0;r_idx<boardState.size;r_idx++) for(let c_idx=0;c_idx<boardState.size;c_idx++) if(boardState.grid[r_idx][c_idx].tile && !sortedMoves.some(m=>m.to.row===r_idx&&m.to.col===c_idx)) {boardHasTiles=true;break;}
        if(boardHasTiles){
            for(const move of sortedMoves){
                const {row,col} = move.to;
                [[row-1,col],[row+1,col],[row,col-1],[row,col+1]].forEach(([nr,nc])=>{
                    if(nr>=0&&nr<boardState.size&&nc>=0&&nc<boardState.size && boardState.grid[nr][nc].tile && !sortedMoves.some(sm=>sm.to.row===nr&&sm.to.col===nc)) connects=true;
                });
                if(connects)break;
            }
            if(!connects){validationResult.message="Invalid placement: New words must connect to existing tiles."; return validationResult;}
        }
    }
    validationResult.isValid = true; return validationResult;
}

function identifyPlayedWord(committedMovesInput, board, identifiedDirection) {
    if (!identifiedDirection || !committedMovesInput || committedMovesInput.length === 0) {
        console.warn("identifyPlayedWord: No direction or no moves provided."); return null;
    }
    const sortedMoves = [...committedMovesInput].sort((a,b)=> (identifiedDirection==='horizontal') ? a.to.col-b.to.col : a.to.row-b.to.row);
    const firstNewTilePos = sortedMoves[0].to;
    let wordString = "", startRow = firstNewTilePos.row, startCol = firstNewTilePos.col;
    if (identifiedDirection === 'horizontal') {
        while (startCol > 0 && board.grid[startRow][startCol-1].tile) startCol--;
        let endColScan = sortedMoves[sortedMoves.length-1].to.col;
        while (endColScan < board.size-1 && board.grid[startRow][endColScan+1].tile) endColScan++;
        for (let c=startCol; c<=endColScan; c++) {
            const tile = board.grid[startRow][c].tile;
            if(tile) wordString += tile.isBlank ? tile.assignedLetter.toUpperCase() : tile.letter.toUpperCase(); else {console.error("Gap H");wordString+='?'}
        }
    } else { // Vertical
        while (startRow > 0 && board.grid[startRow-1][startCol].tile) startRow--;
        let endRowScan = sortedMoves[sortedMoves.length-1].to.row;
        while (endRowScan < board.size-1 && board.grid[endRowScan+1][startCol].tile) endRowScan++;
        for (let r=startRow; r<=endRowScan; r++) {
            const tile = board.grid[r][startCol].tile;
            if(tile) wordString += tile.isBlank ? tile.assignedLetter.toUpperCase() : tile.letter.toUpperCase(); else {console.error("Gap V");wordString+='?'}
        }
    }
    const blanksInfo = [];
    committedMovesInput.forEach(move => {
        if (move.tileRef.isBlank) {
            let idx = (identifiedDirection==='horizontal') ? move.to.col-startCol : move.to.row-startRow;
            if (idx>=0 && idx<wordString.length) blanksInfo.push({idx, al:move.tileRef.assignedLetter.toUpperCase()});
        }
    });
    if(wordString.includes('?')){console.error("Word ID error", committedMovesInput, wordString); return null;}
    return { word:wordString, start_row:startRow, start_col:startCol, direction:identifiedDirection, blanks_info:blanksInfo };
}

async function handleCommitPlay() {
    if (!currentGame || currentGame.getCurrentPlayer().id !== localPlayerId) { alert("It's not your turn or no game active!"); return; }
    if (currentGame.currentTurnMoves.length === 0) { alert("You haven't placed any tiles."); return; }

    const validation = validatePlacement(currentGame.currentTurnMoves, currentGame.turnNumber, currentGame.board);
    if (!validation.isValid) { alert(validation.message); return; }
    const identifiedDirection = validation.direction;
    console.log("Placement validation passed. Direction:", identifiedDirection);

    const actualCommittedMoves = [...currentGame.currentTurnMoves];

    // --- Dictionary Validation ---
    if (currentGame.settings.dictionaryType !== 'permissive') {
        const tempBoardForWordIdentification = JSON.parse(JSON.stringify(currentGame.board));
        // Moves are already on currentGame.board due to drag/drop, so tempBoard has them.
        // identifyPlayedWord uses this board state.

        // We need to validate ALL words formed, not just the "main" one initially identified by validatePlacement's direction.
        // identifyAllPlayedWords will give us all words based on the current board state and newly placed tiles.
        const allWordsDataForValidation = identifyAllPlayedWords(actualCommittedMoves, tempBoardForWordIdentification, identifiedDirection);

        if (!allWordsDataForValidation || allWordsDataForValidation.length === 0) {
            console.warn("No words identified for dictionary validation, though placement was valid. Allowing play.");
        } else {
            for (const wordArr of allWordsDataForValidation) {
                const wordToValidate = wordArr.map(t => t.tile.isBlank ? t.tile.assignedLetter.toUpperCase() : t.tile.letter.toUpperCase()).join('');
                if (wordToValidate.length <= 1 && currentGame.settings.dictionaryType !== 'permissive') { // Single letters usually not in dicts
                    console.log(`Skipping dictionary validation for single letter: "${wordToValidate}"`);
                    continue;
                }

                let validationApiUrl = "";
                let dictionaryName = "";

                if (currentGame.settings.dictionaryType === 'freeapi') {
                    validationApiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${wordToValidate.toLowerCase()}`;
                    dictionaryName = "Free Dictionary API";
                } else if (currentGame.settings.dictionaryType === 'custom' && currentGame.settings.dictionaryUrl) {
                    validationApiUrl = `${currentGame.settings.dictionaryUrl}${wordToValidate.toLowerCase()}`; // Assuming custom API also wants lowercase
                    dictionaryName = "Custom Dictionary";
                }

                if (validationApiUrl) {
                    console.log(`Validating word: "${wordToValidate}" using ${dictionaryName} at URL: ${validationApiUrl}`);
                    try {
                        const response = await fetch(validationApiUrl);
                        if (!response.ok) {
                            if (response.status === 404) {
                                alert(`Word "${wordToValidate}" not found in ${dictionaryName}. Play rejected.`);
                            } else {
                                alert(`Error validating word "${wordToValidate}" with ${dictionaryName} (Status: ${response.status}). Play rejected.`);
                            }
                            // Before returning, revert tiles from board and put back to rack if they came from there.
                            // This is complex because currentTurnMoves doesn't store original rack state for each tile.
                            // A simpler immediate solution is to just alert and return, requiring user to manually fix.
                            // For now: alert and return. User must manually drag tiles back.
                            // TODO: Implement robust rollback of tiles on validation failure.
                            fullRender(currentGame, localPlayerId); // Re-render to show current (pre-commit) state.
                            return;
                        }
                        // For Free Dictionary API, a 200 OK can still mean "no definition found" (empty array or specific message)
                        if (currentGame.settings.dictionaryType === 'freeapi') {
                            const data = await response.json();
                            if (!Array.isArray(data) || data.length === 0 || (data[0] && data[0].title === "No Definitions Found")) {
                                alert(`Word "${wordToValidate}" not found or has no definition in ${dictionaryName}. Play rejected.`);
                                fullRender(currentGame, localPlayerId);
                                return;
                            }
                        }
                        console.log(`Word "${wordToValidate}" is valid according to ${dictionaryName}.`);
                    } catch (error) {
                        console.error(`Network or other error validating word "${wordToValidate}":`, error);
                        alert(`Could not reach ${dictionaryName} to validate "${wordToValidate}". Play rejected. Check connection or API status.`);
                        fullRender(currentGame, localPlayerId);
                        return;
                    }
                }
            }
        }
    }
    // --- End Dictionary Validation ---

    const playerWhoPlayed = currentGame.getCurrentPlayer();

    // --- Scoring Integration ---
    // Note: identifyAllPlayedWords and calculateWordScore will use currentGame.board,
    // which at this point *does not* have the currentTurnMoves applied yet.
    // This is correct for scoring: bonuses are on the original board state.
    // The tiles themselves are taken from actualCommittedMoves.
    // However, identifyAllPlayedWords needs the board to reflect the newly placed tiles to find all words.
    // So, similar to dictionary validation, we need to apply moves to a temporary board state,
    // or apply them to the actual board *before* this step, then roll back on validation failure.
    // The current identifyAllPlayedWords takes the board as argument.
    // Let's ensure the board state used for identifyAllPlayedWords has the new tiles.
    // The most straightforward way is to apply to main board and then clear if validation fails later.
    // Or, more safely, use a temporary board for all lookups before final commit.

    // For now, the dictionary validation section correctly uses a temp board.
    // The scoring section *after* this needs to operate on the *final* board state with committed moves.
    // The current structure of handleCommitPlay commits tiles to currentGame.board *implicitly*
    // because drag/drop operations modify it directly. The currentTurnMoves are reflections of these.
    // This means currentGame.board *already* has the tiles when handleCommitPlay is called.
    // So, identifyAllPlayedWords should correctly see them.

    const allWordsPlayed = identifyAllPlayedWords(actualCommittedMoves, currentGame.board, identifiedDirection);
    if (allWordsPlayed.length === 0 && actualCommittedMoves.length > 0) {
        // This case should ideally be caught by validation, but as a fallback:
        // If tiles were placed but no words were identified (e.g. single disconnected tile not on first turn)
        // This might indicate an issue or a play that shouldn't score.
        // For now, we'll proceed, and calculateWordScore might return 0.
        console.warn("No words identified for scoring, though moves were made.", actualCommittedMoves);
    }

    const scoreResult = calculateWordScore(allWordsPlayed, currentGame.board, actualCommittedMoves, currentGame.settings);
    playerWhoPlayed.score += scoreResult.score;
    console.log(`${playerWhoPlayed.name} scored ${scoreResult.score} points. Total score: ${playerWhoPlayed.score}`);

    // Mark bonus squares as used
    scoreResult.usedBonusSquares.forEach(sqCoord => {
        if (currentGame.board.grid[sqCoord.r] && currentGame.board.grid[sqCoord.r][sqCoord.c]) {
            currentGame.board.grid[sqCoord.r][sqCoord.c].bonusUsed = true;
            console.log(`Bonus at ${sqCoord.r},${sqCoord.c} marked as used.`);
        }
    });
    // --- End Scoring Integration ---

    const wordDataForURL = identifyPlayedWord(actualCommittedMoves, currentGame.board, identifiedDirection);
    if (!wordDataForURL || !wordDataForURL.word) {
        console.warn("Word identification did not produce data for URL (this is separate from scoring word ID).");
    }

    currentGame.currentTurnMoves = []; // Clear moves for next turn
    currentGame.turnNumber++;

    const tilesPlayedCount = actualCommittedMoves.length;
    currentGame.drawTiles(playerWhoPlayed, tilesPlayedCount);
    console.log(`${playerWhoPlayed.name} drew ${tilesPlayedCount} tiles. Rack size: ${playerWhoPlayed.rack.length}`);

    currentGame.currentPlayerIndex = (currentGame.currentPlayerIndex + 1) % currentGame.players.length;
    console.log("Player switched. New current player:", currentGame.getCurrentPlayer().name);

    // Update UI with new scores before generating URL or saving
    updateGameStatus(currentGame);

    let turnURL;
    // Pass relevant settings for URL generation, especially for the first turn
    const relevantSettings = (currentGame.turnNumber === 1 && currentGame.creatorId === BROWSER_PLAYER_ID) ? currentGame.settings : null;
    if (currentGame.turnNumber === 1 && currentGame.creatorId === BROWSER_PLAYER_ID) {
        turnURL = generateTurnURL(currentGame.gameId, currentGame.turnNumber, wordDataForURL, currentGame.randomSeed, currentGame.creatorId, relevantSettings);
    } else {
        // For subsequent turns, dictionary settings are not needed in the URL as they are part of the game state loaded from localStorage
        turnURL = generateTurnURL(currentGame.gameId, currentGame.turnNumber, wordDataForURL, null, null, null);
    }
    const turnUrlInput = document.getElementById('turn-url');
    if (turnUrlInput) {
        turnUrlInput.value = turnURL;
        turnUrlInput.placeholder = "Share this URL with the other player.";
        console.log("Turn URL:", turnURL);
    }
    alert("Play committed! It's now " + currentGame.getCurrentPlayer().name + "'s turn.");
    saveGameStateToLocalStorage(currentGame);
    fullRender(currentGame, localPlayerId);
}

// --- Scoring Logic ---

/**
 * Identifies all words formed by a given set of placed tiles.
 * This includes the main word and any cross-words.
 * @param {Array<{tileRef: Tile, to: {row: number, col: number}}>} placedMoves - The tiles placed in the current turn.
 * @param {Board} board - The game board.
 * @param {string} mainWordDirection - The direction ('horizontal' or 'vertical') of the main word.
 * @returns {Array<Array<{tile: Tile, r: number, c: number}>>} An array of words, where each word is an array of {tile, r, c}.
 */
function identifyAllPlayedWords(placedMoves, board, mainWordDirection) {
    if (!placedMoves || placedMoves.length === 0) return [];

    const allWords = [];
    const mainWordTiles = []; // To store {tile, r, c} for the main word

    // 1. Identify the main word
    const sortedMoves = [...placedMoves].sort((a, b) =>
        mainWordDirection === 'horizontal' ? a.to.col - b.to.col : a.to.row - b.to.row
    );
    const firstMove = sortedMoves[0];
    let r = firstMove.to.row;
    let c = firstMove.to.col;

    if (mainWordDirection === 'horizontal') {
        while (c > 0 && board.grid[r][c - 1].tile) c--; // Find start of word
        while (c < board.size && board.grid[r][c].tile) {
            mainWordTiles.push({ tile: board.grid[r][c].tile, r: r, c: c });
            c++;
        }
    } else { // Vertical
        while (r > 0 && board.grid[r - 1][c].tile) r--; // Find start of word
        while (r < board.size && board.grid[r][c].tile) {
            mainWordTiles.push({ tile: board.grid[r][c].tile, r: r, c: c });
            r++;
        }
    }
    if (mainWordTiles.length > 1) { // Only add if it's actually a word (length > 1) or if it's the only tile played
         allWords.push(mainWordTiles);
    } else if (placedMoves.length === 1 && mainWordTiles.length === 1){
        // If only one tile was placed, it might not form a word by itself in the main direction
        // but it could form cross words. We'll handle this by checking cross words regardless.
        // For scoring, a single tile played that doesn't connect to form a longer word
        // usually doesn't score unless it forms cross words.
        // However, our validation ensures it connects if other tiles are on board.
        // If it's the very first tile, it's a word of 1.
        if (currentGame.turnNumber === 0 || placedMoves.length === mainWordTiles.length) {
             allWords.push(mainWordTiles);
        }
    }


    // 2. Identify cross-words
    const crossDirection = mainWordDirection === 'horizontal' ? 'vertical' : 'horizontal';
    for (const move of placedMoves) {
        const crossWordTiles = [];
        let rCross = move.to.row;
        let cCross = move.to.col;

        if (crossDirection === 'horizontal') {
            while (cCross > 0 && board.grid[rCross][cCross - 1].tile) cCross--;
            while (cCross < board.size && board.grid[rCross][cCross].tile) {
                crossWordTiles.push({ tile: board.grid[rCross][cCross].tile, r: rCross, c: cCross });
                cCross++;
            }
        } else { // Vertical
            while (rCross > 0 && board.grid[rCross - 1][cCross].tile) rCross--;
            while (rCross < board.size && board.grid[rCross][cCross].tile) {
                crossWordTiles.push({ tile: board.grid[rCross][cCross].tile, r: rCross, c: cCross });
                rCross++;
            }
        }
        if (crossWordTiles.length > 1) {
            // Avoid duplicating the main word if it's found again as a "cross-word"
            // This can happen if the main word is length 1.
            const wordStr = crossWordTiles.map(t => t.tile.isBlank ? t.tile.assignedLetter : t.tile.letter).join('');
            const mainWordStr = mainWordTiles.map(t => t.tile.isBlank ? t.tile.assignedLetter : t.tile.letter).join('');
            if (allWords.length === 0 || wordStr !== mainWordStr) {
                 allWords.push(crossWordTiles);
            } else if (allWords.length > 0 && wordStr === mainWordStr && crossWordTiles.length !== mainWordTiles.length) {
                // It's possible a single letter placed forms a cross word that IS the main word.
                // e.g. board has A_C, player places B. Main word is ABC. Cross word for B is also ABC.
                // Only add if it's genuinely a different word or context.
                // This check might need refinement based on edge cases.
                // A simpler way: ensure no two identical words (by content and position) are added.
                let isDuplicate = false;
                for(const existingWord of allWords) {
                    if (existingWord.length === crossWordTiles.length) {
                        let same = true;
                        for(let i=0; i<existingWord.length; i++) {
                            if (existingWord[i].r !== crossWordTiles[i].r || existingWord[i].c !== crossWordTiles[i].c) {
                                same = false; break;
                            }
                        }
                        if (same) {isDuplicate = true; break;}
                    }
                }
                if (!isDuplicate) allWords.push(crossWordTiles);

            }
        }
    }
    return allWords;
}


/**
 * Calculates the score for a list of played words.
 * @param {Array<Array<{tile: Tile, r: number, c: number}>>} words - An array of words, where each word is an array of {tile, r, c}.
 * @param {Board} board - The game board.
 * @param {Array<{tileRef: Tile, to: {row: number, col: number}}>} placedMoves - The specific tiles placed in the current turn.
 * @param {object} gameSettings - The game's settings object.
 * @returns {{score: number, usedBonusSquares: Array<{r: number, c: number}>}} The total score and list of used bonus square coordinates.
 */
function calculateWordScore(words, board, placedMoves, gameSettings) {
    let totalScore = 0;
    const usedBonusSquares = [];
    const tileValues = gameSettings.tileValues || DEFAULT_TILE_VALUES;
    const sevenTileBonus = gameSettings.sevenTileBonus || 50;

    for (const word of words) {
        let currentWordScore = 0;
        let wordMultiplier = 1;
        let newTilesInThisWordCount = 0;

        for (const tilePos of word) {
            const tile = tilePos.tile;
            const r = tilePos.r;
            const c = tilePos.c;
            const square = board.grid[r][c];
            let letterScore = tile.isBlank ? 0 : (tileValues[tile.letter.toUpperCase()] || 0);

            const isNewlyPlaced = placedMoves.some(move => move.to.row === r && move.to.col === c);
            if (isNewlyPlaced) newTilesInThisWordCount++;

            if (isNewlyPlaced && !square.bonusUsed) {
                switch (square.bonus) {
                    case BONUS_TYPES.DL:
                        letterScore *= 2;
                        usedBonusSquares.push({ r, c });
                        break;
                    case BONUS_TYPES.TL:
                        letterScore *= 3;
                        usedBonusSquares.push({ r, c });
                        break;
                    case BONUS_TYPES.DW:
                        wordMultiplier *= 2;
                        usedBonusSquares.push({ r, c });
                        break;
                    case BONUS_TYPES.TW:
                        wordMultiplier *= 3;
                        usedBonusSquares.push({ r, c });
                        break;
                }
            }
            currentWordScore += letterScore;
        }
        // Only apply word multiplier if at least one new tile is part of this word
        // This prevents re-scoring a full existing word if a new tile just touches it.
        if (newTilesInThisWordCount > 0) {
            totalScore += (currentWordScore * wordMultiplier);
        } else {
            // If no new tiles are in this "word" (e.g. a cross-word that was already existing and just got extended by one letter of the main word)
            // then this specific "word" instance doesn't add to score unless it's the main word itself.
            // This logic is tricky: standard Scrabble scores all formed words.
            // The newTilesInThisWordCount check might be too restrictive if a cross-word is entirely old letters.
            // Let's assume for now all words in the 'words' list are valid new/extended words.
            // The `identifyAllPlayedWords` should ensure words are only returned if they contain at least one new tile.
            // Re-evaluating: if a word is passed to calculateWordScore, it's assumed to be valid for scoring.
            // The check should be: "is this word one of the ones that was directly formed or extended by the new tiles?"
            // The `identifyAllPlayedWords` function should handle this by only returning relevant words.
            totalScore += (currentWordScore * wordMultiplier);
        }
    }

    // Add bonus for playing all tiles from rack (e.g., 7 tiles)
    if (placedMoves.length === (gameSettings.rackSize || RACK_SIZE)) {
        totalScore += sevenTileBonus;
    }

    // Deduplicate usedBonusSquares
    const uniqueUsedBonusSquares = usedBonusSquares.filter((item, index, self) =>
        index === self.findIndex((t) => t.r === item.r && t.c === item.c)
    );

    return { score: totalScore, usedBonusSquares: uniqueUsedBonusSquares };
}


function handlePassTurn() {
    if (!currentGame || currentGame.getCurrentPlayer().id !== localPlayerId) {
        alert("It's not your turn or no game active!");
        return;
    }

    console.log("Pass Turn initiated by:", currentGame.getCurrentPlayer().name);

    currentGame.turnNumber++;
    currentGame.currentPlayerIndex = (currentGame.currentPlayerIndex + 1) % currentGame.players.length;

    // For a pass, exchangeData is an empty string.
    // No turnData for word play.
    const turnURL = generateTurnURL(currentGame.gameId, currentGame.turnNumber, null, null, null, null, "");

    const turnUrlInput = document.getElementById('turn-url');
    if (turnUrlInput) {
        turnUrlInput.value = turnURL;
        turnUrlInput.placeholder = "Share this URL with the other player.";
        console.log("Pass Turn URL:", turnURL);
    }

    alert("Turn passed! It's now " + currentGame.getCurrentPlayer().name + "'s turn.");
    saveGameStateToLocalStorage(currentGame);
    fullRender(currentGame, localPlayerId);
}

function handleExchangeTiles() {
    if (!currentGame || currentGame.getCurrentPlayer().id !== localPlayerId) {
        alert("It's not your turn or no game active!");
        return;
    }

    const player = currentGame.getCurrentPlayer();
    const rackSize = player.rack.length;
    if (rackSize === 0) {
        alert("Your rack is empty. Cannot exchange tiles.");
        return;
    }

    const indicesStr = prompt(`Enter comma-separated indices of tiles to exchange (0-${rackSize - 1}). For example, 0,2 to exchange the 1st and 3rd tile:`);
    if (indicesStr === null) return; // User cancelled

    const indicesToExchange = indicesStr.split(',')
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n) && n >= 0 && n < rackSize);

    if (indicesToExchange.length === 0) {
        alert("No valid tile indices selected for exchange.");
        return;
    }

    // Remove duplicates by converting to Set and back to array
    const uniqueIndices = [...new Set(indicesToExchange)].sort((a,b) => b-a); // Sort descending to splice correctly

    if (currentGame.bag.length < uniqueIndices.length) {
        alert(`Not enough tiles in the bag (${currentGame.bag.length}) to exchange ${uniqueIndices.length} tile(s).`);
        return;
    }

    console.log(`Exchange initiated by ${player.name}. Indices: ${uniqueIndices.join(',')}`);

    const tilesSetAsideForExchange = [];
    for (const index of uniqueIndices) {
        if (player.rack[index]) {
            // Remove from rack and store temporarily
            tilesSetAsideForExchange.push(player.rack.splice(index, 1)[0]);
        }
    }

    if (tilesSetAsideForExchange.length === 0) {
        alert("Something went wrong, no tiles were selected from rack for exchange process.");
        // Add back any potentially spliced tiles if something went partially wrong before this check
        // (though current logic makes this unlikely here, good for robustness if logic changes)
        uniqueIndices.forEach((val, originalOrderIndex) => {
            // This part is tricky as original indices are gone.
            // The check for tilesSetAsideForExchange.length === 0 should be robust.
            // If any tiles were actually spliced, they are in tilesSetAsideForExchange.
            // If it's empty, nothing was spliced.
        });
        return;
    }

    // 2. Draw new tiles from the bag to replenish the player's rack.
    // The number of tiles to draw is the number of tiles successfully set aside.
    const numTilesToDraw = tilesSetAsideForExchange.length;
    currentGame.drawTiles(player, numTilesToDraw);

    // 3. Add the set-aside (exchanged) tiles to the game bag.
    tilesSetAsideForExchange.forEach(tile => {
        if (tile.isBlank) tile.assignedLetter = null; // Reset blank tile before returning to bag
        currentGame.bag.push(tile);
    });

    // 4. Shuffle the game bag.
    currentGame._shuffleBag();

    currentGame.turnNumber++;
    currentGame.currentPlayerIndex = (currentGame.currentPlayerIndex + 1) % currentGame.players.length;

    // exchangeData is the string of original indices provided by the user (before sorting for splice)
    const turnURL = generateTurnURL(currentGame.gameId, currentGame.turnNumber, null, null, null, null, indicesToExchange.join(','));


    const turnUrlInput = document.getElementById('turn-url');
    if (turnUrlInput) {
        turnUrlInput.value = turnURL;
        turnUrlInput.placeholder = "Share this URL with the other player.";
        console.log("Exchange Turn URL:", turnURL);
    }

    alert(`Exchanged ${tilesSetAsideForExchange.length} tile(s). It's now ${currentGame.getCurrentPlayer().name}'s turn.`);
    saveGameStateToLocalStorage(currentGame);
    fullRender(currentGame, localPlayerId);
}


function generateTurnURL(gameId, turnNumber, turnData, seed = null, creator = null, settings = null, exchangeData = null) {
    const baseURL = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    params.append('gid', gameId);
    params.append('tn', turnNumber);

    if (seed !== null) params.append('seed', seed);
    if (creator !== null) params.append('creator', creator);

    // Add dictionary settings to URL only for the very first turn URL (game creation)
    if (settings && turnNumber === 1 && creator) { // Check turnNumber and creator to identify initial share
        if (settings.dictionaryType && settings.dictionaryType !== 'permissive') {
            params.append('dt', settings.dictionaryType);
            if (settings.dictionaryType === 'custom' && settings.dictionaryUrl) {
                params.append('du', settings.dictionaryUrl);
            }
        }
    }

    if (exchangeData !== null) { // Check if exchangeData is provided (not null)
        params.append('ex', exchangeData); // exchangeData is either "" for pass or "0,1,2" for exchange
    } else if (turnData && turnData.word) {
        params.append('wl', `${turnData.start_row}.${turnData.start_col}`);
        params.append('wd', turnData.direction);
        if (turnData.blanks_info && turnData.blanks_info.length > 0) {
            params.append('bt', turnData.blanks_info.map(bi => `${bi.idx}:${bi.al}`).join(';'));
        }
        params.append('w', turnData.word);
    }
    // Note: A turn can be a play, a pass, or an exchange, but not more than one.
    // So, if 'ex' is present, 'w', 'wl', 'wd', 'bt' should not be.
    return `${baseURL}?${params.toString()}`;
}

function initializeNewGame() {
    const gameId = `game-${Date.now()}`;
    const randomSeed = Math.floor(Math.random() * 1000000);
    currentGame = new GameState(gameId, randomSeed, {});
    currentGame.creatorId = BROWSER_PLAYER_ID;
    localPlayerId = 'player1';
    console.log("New local game initialized by this browser:", currentGame);
    saveGameStateToLocalStorage(currentGame);
    fullRender(currentGame, localPlayerId);
    const turnUrlInput = document.getElementById('turn-url');
    if (turnUrlInput) {
        turnUrlInput.value = "";
        turnUrlInput.placeholder = "Make your first move to generate a shareable URL.";
    }
    // Do not generate URL here, it will be done after first move by P1
    // or when P2 loads the game.
}

function showNewGameModal() {
    document.getElementById('new-game-modal').style.display = 'block';
    // Reset modal to defaults
    document.querySelector('input[name="dictionaryType"][value="permissive"]').checked = true;
    document.getElementById('custom-dictionary-url').style.display = 'none';
    document.getElementById('custom-dictionary-url').value = '';
}

function hideNewGameModal() {
    document.getElementById('new-game-modal').style.display = 'none';
}

function startGameWithSettings() {
    const selectedDictionaryType = document.querySelector('input[name="dictionaryType"]:checked').value;
    let customUrl = null;
    if (selectedDictionaryType === 'custom') {
        customUrl = document.getElementById('custom-dictionary-url').value.trim();
        if (!customUrl) {
            alert("Please enter a Custom Dictionary URL.");
            return;
        }
        // Basic validation for URL prefix - should not end with the word placeholder
        if (customUrl.endsWith("<word>") || customUrl.endsWith("{word}")) {
            alert("Please provide the base URL only. The word will be appended automatically.");
            return;
        }
    }

    hideNewGameModal();

    const gameId = `game-${Date.now()}`;
    const randomSeed = Math.floor(Math.random() * 1000000);
    const gameSettings = {
        dictionaryType: selectedDictionaryType,
        dictionaryUrl: customUrl
        // Add other game settings here if they become configurable in the modal
    };

    currentGame = new GameState(gameId, randomSeed, gameSettings);
    currentGame.creatorId = BROWSER_PLAYER_ID; // This browser is P1
    localPlayerId = 'player1';

    console.log("New game started with settings:", gameSettings, currentGame);
    saveGameStateToLocalStorage(currentGame);
    fullRender(currentGame, localPlayerId);

    const turnUrlInput = document.getElementById('turn-url');
    if (turnUrlInput) {
        turnUrlInput.value = ""; // Clear any old URL
        turnUrlInput.placeholder = "Make your first move to generate a shareable URL.";
    }
    // The initial shareable URL will be generated after P1's first move.
}


// --- LocalStorage Functions ---
const LOCAL_STORAGE_KEY_PREFIX = "crosswordGame_";

/**
 * Generates or retrieves a unique identifier for this browser instance.
 * This helps in determining Player 1 vs Player 2 in a shared game context.
 * @param {Storage} storage - The storage object (localStorage or mock).
 * @returns {string} A unique browser/player identifier.
 */
function getPlayerIdentifier(storage = localStorage) {
    let browserId = storage.getItem("crosswordBrowserId");
    if (!browserId) {
        browserId = `browser-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        storage.setItem("crosswordBrowserId", browserId);
        console.log("New browser identifier created:", browserId);
    }
    return browserId;
}

const BROWSER_PLAYER_ID = getPlayerIdentifier(); // Uses actual localStorage for the app

function saveGameStateToLocalStorage(gameState, storage = localStorage) {
    if (!gameState || !gameState.gameId) {
        console.error("Cannot save game state: invalid gameState or gameId missing.");
        return;
    }
    try {
        const serializableState = {
            gameId: gameState.gameId,
            randomSeed: gameState.randomSeed,
            settings: gameState.settings,
            turnNumber: gameState.turnNumber,
            currentPlayerIndex: gameState.currentPlayerIndex,
            isGameOver: gameState.isGameOver,
            gameHistory: gameState.gameHistory,
            players: gameState.players.map(player => ({
                id: player.id, name: player.name, score: player.score,
                rack: player.rack.map(tile => ({
                    letter: tile.letter, value: tile.value, isBlank: tile.isBlank,
                    assignedLetter: tile.assignedLetter, id: tile.id
                }))
            })),
            bag: gameState.bag.map(tile => ({
                letter: tile.letter, value: tile.value, isBlank: tile.isBlank,
                assignedLetter: tile.assignedLetter, id: tile.id
            })),
            boardGrid: gameState.board.grid.map(row => row.map(square => ({
                row: square.row, col: square.col, bonus: square.bonus, bonusUsed: square.bonusUsed,
                tile: square.tile ? {
                    letter: square.tile.letter, value: square.tile.value, isBlank: square.tile.isBlank,
                    assignedLetter: square.tile.assignedLetter, id: square.tile.id
                } : null
            }))),
            creatorId: gameState.creatorId || null
        };
        storage.setItem(LOCAL_STORAGE_KEY_PREFIX + gameState.gameId, JSON.stringify(serializableState));
        console.log(`Game ${gameState.gameId} saved to ${storage === localStorage ? 'localStorage' : 'mockStorage'}.`);
    } catch (error) {
        console.error("Error saving game state:", error);
    }
}

function loadGameStateFromLocalStorage(gameId, storage = localStorage) {
    if (!gameId) {
        console.warn("loadGameStateFromLocalStorage: No gameId provided.");
        return null;
    }
    try {
        const storedDataString = storage.getItem(LOCAL_STORAGE_KEY_PREFIX + gameId);
        if (!storedDataString) {
            console.log(`No game data found for ${gameId} in ${storage === localStorage ? 'localStorage' : 'mockStorage'}.`);
            return null;
        }
        const storedData = JSON.parse(storedDataString);
        const rehydratedGame = new GameState(storedData.gameId, storedData.randomSeed, storedData.settings || {});

        rehydratedGame.turnNumber = storedData.turnNumber;
        rehydratedGame.currentPlayerIndex = storedData.currentPlayerIndex;
        rehydratedGame.isGameOver = storedData.isGameOver;
        rehydratedGame.gameHistory = storedData.gameHistory || [];
        rehydratedGame.creatorId = storedData.creatorId;

        if (storedData.players && storedData.players.length === rehydratedGame.players.length) {
            storedData.players.forEach((playerData, index) => {
                rehydratedGame.players[index].score = playerData.score;
                rehydratedGame.players[index].id = playerData.id || rehydratedGame.players[index].id;
                rehydratedGame.players[index].name = playerData.name || rehydratedGame.players[index].name;
                rehydratedGame.players[index].rack = playerData.rack.map(tileData => {
                    const tile = new Tile(tileData.letter, tileData.value, tileData.isBlank);
                    tile.assignedLetter = tileData.assignedLetter; tile.id = tileData.id;
                    return tile;
                });
            });
        }
        rehydratedGame.bag = storedData.bag.map(tileData => {
            const tile = new Tile(tileData.letter, tileData.value, tileData.isBlank);
            tile.assignedLetter = tileData.assignedLetter; tile.id = tileData.id;
            return tile;
        });
        if (storedData.boardGrid && rehydratedGame.board && rehydratedGame.board.grid) {
            for (let r = 0; r < storedData.boardGrid.length; r++) {
                if (rehydratedGame.board.grid[r]) {
                    for (let c = 0; c < storedData.boardGrid[r].length; c++) {
                        if (rehydratedGame.board.grid[r][c]) {
                            const squareData = storedData.boardGrid[r][c];
                            const boardSquare = rehydratedGame.board.grid[r][c];
                            boardSquare.bonus = squareData.bonus;
                            boardSquare.bonusUsed = squareData.bonusUsed;
                            if (squareData.tile) {
                                const tileData = squareData.tile;
                                const tile = new Tile(tileData.letter, tileData.value, tileData.isBlank);
                                tile.assignedLetter = tileData.assignedLetter; tile.id = tileData.id;
                                boardSquare.tile = tile;
                            } else {
                                boardSquare.tile = null;
                            }
                        }
                    }
                }
            }
        }
        console.log(`Game ${gameId} loaded and rehydrated from ${storage === localStorage ? 'localStorage' : 'mockStorage'}.`);
        return rehydratedGame;
    } catch (error) {
        console.error(`Error loading game state for ${gameId}:`, error);
        return null;
    }
}

// --- Game Initialization and URL Handling ---
function applyTurnDataFromURL(gameState, params) {
    const exchangeParam = params.get('ex');
    const playerWhoseTurnItWas = gameState.getCurrentPlayer(); // The player who made the move described in URL

    if (exchangeParam !== null) {
        if (exchangeParam === "") { // Pass
            console.log(`Applying turn data: Player ${playerWhoseTurnItWas.name} passed.`);
            return true;
        } else { // Exchange
            console.log(`Applying turn data: Player ${playerWhoseTurnItWas.name} exchanged tiles (indices from their rack: ${exchangeParam}).`);
            const indicesToExchange = exchangeParam.split(',')
                .map(s => parseInt(s.trim()))
                .filter(n => !isNaN(n) && n >= 0 && n < playerWhoseTurnItWas.rack.length);

            const uniqueIndices = [...new Set(indicesToExchange)].sort((a, b) => b - a);

            if (uniqueIndices.length === 0) {
                console.error("Exchange failed: No valid tile indices to apply from URL for player " + playerWhoseTurnItWas.name);
                return false;
            }
            if (gameState.bag.length < uniqueIndices.length) {
                console.error(`Exchange failed for ${playerWhoseTurnItWas.name}: Not enough tiles in bag (${gameState.bag.length}) to exchange ${uniqueIndices.length} tile(s) as per URL.`);
                return false;
            }

            const tilesSetAside = [];
            for (const index of uniqueIndices) {
                if (playerWhoseTurnItWas.rack[index]) {
                    tilesSetAside.push(playerWhoseTurnItWas.rack.splice(index, 1)[0]);
                }
            }

            if (tilesSetAside.length !== uniqueIndices.length) {
                 console.error(`Exchange logic mismatch for ${playerWhoseTurnItWas.name}: Tried to exchange ${uniqueIndices.length}, but only set aside ${tilesSetAside.length}.`);
                 tilesSetAside.forEach(t => playerWhoseTurnItWas.rack.push(t));
                 return false;
            }

            gameState.drawTiles(playerWhoseTurnItWas, tilesSetAside.length);
            tilesSetAside.forEach(tile => {
                if (tile.isBlank) tile.assignedLetter = null;
                gameState.bag.push(tile);
            });
            gameState._shuffleBag();
            console.log(`Applied exchange for ${playerWhoseTurnItWas.name}. Rack size: ${playerWhoseTurnItWas.rack.length}, Bag size: ${gameState.bag.length}`);
            return true;
        }
    }

    const wordStrFromURL = params.get('w');
    const wordLocation = params.get('wl');
    const wordDirection = params.get('wd');
    const blankTileData = params.get('bt');

    if (wordStrFromURL && wordLocation && wordDirection) {
        console.log(`Applying word-based turn data: ${wordStrFromURL} at ${wordLocation} ${wordDirection} for player ${playerWhoseTurnItWas.name}`);
        const [startRowStr, startColStr] = wordLocation.split('.');
        const startRow = parseInt(startRowStr); const startCol = parseInt(startColStr);
        if (isNaN(startRow) || isNaN(startCol)) { console.error("Invalid word location format:", wordLocation); return false; }

        const blanksInWord = new Map(); // Map: index in wordStrFromURL -> assigned letter
        if (blankTileData) {
            blankTileData.split(';').forEach(item => {
                const [idxStr, al] = item.split(':');
                blanksInWord.set(parseInt(idxStr), al.toUpperCase());
            });
        }

        const newlyPlacedMovesFromURL = []; // To store {tileRef, to} for tiles this player is adding now

        for (let i = 0; i < wordStrFromURL.length; i++) {
            const charFromWord = wordStrFromURL[i].toUpperCase();
            let r = startRow;
            let c = startCol;
            if (wordDirection === 'horizontal') c += i;
            else r += i;

            if (!gameState.board.grid[r] || !gameState.board.grid[r][c]) {
                console.error(`Invalid square coordinates (${r},${c}) for word placement from URL.`);
                return false;
            }

            const square = gameState.board.grid[r][c];
            if (!square.tile) { // Square is empty, this tile is newly placed by the opponent
                const isBlank = blanksInWord.has(i);
                const assignedLetter = isBlank ? blanksInWord.get(i) : null;
                const tileLetter = isBlank ? '' : charFromWord; // Store empty for blank, actual letter otherwise
                const tileValue = isBlank ? 0 : (gameState.settings.tileValues[charFromWord] || 0);

                const newTile = new Tile(tileLetter, tileValue, isBlank);
                if (isBlank) newTile.assignedLetter = assignedLetter;

                square.tile = newTile;
                newlyPlacedMovesFromURL.push({ tileRef: newTile, to: { row: r, col: c } });
            } else {
                // Square has a tile. This tile was pre-existing on the board.
                // Verify it matches the character from the URL's word string.
                const existingTile = square.tile;
                const expectedLetterOnBoard = existingTile.isBlank ? existingTile.assignedLetter.toUpperCase() : existingTile.letter.toUpperCase();
                if (expectedLetterOnBoard !== charFromWord) {
                    console.error(`Mismatch: Board at ${r},${c} has ${expectedLetterOnBoard}, URL implies ${charFromWord}. Game desync.`);
                    return false;
                }
                // If it's a blank tile that was already on board and its assigned letter matches,
                // and the URL also specifies it as a blank at this position with the same assigned letter, it's consistent.
                if (existingTile.isBlank && blanksInWord.has(i) && existingTile.assignedLetter.toUpperCase() !== blanksInWord.get(i)) {
                     console.error(`Mismatch for blank tile assignment at ${r},${c}. Board: ${existingTile.assignedLetter}, URL: ${blanksInWord.get(i)}`);
                     return false;
                }
            }
        }

        // Score the turn based on the board state and the identified newly placed tiles.
        const allWordsFormed = identifyAllPlayedWords(newlyPlacedMovesFromURL, gameState.board, wordDirection);

        if (allWordsFormed.length === 0 && newlyPlacedMovesFromURL.length > 0) {
            console.warn("URL Processing: No words identified for scoring from newly placed tiles, though tiles were placed according to URL.", newlyPlacedMovesFromURL);
            // This could happen if validation on sender was different, or if only a single tile was placed that didn't form a word > 1 letter.
            // calculateWordScore should handle this and likely return 0 if no valid words.
        }

        const scoreResult = calculateWordScore(allWordsFormed, gameState.board, newlyPlacedMovesFromURL, gameState.settings);
        playerWhoseTurnItWas.score += scoreResult.score;
        console.log(`URL Processing: Player ${playerWhoseTurnItWas.name} scored ${scoreResult.score} points. New total score: ${playerWhoseTurnItWas.score}`);

        scoreResult.usedBonusSquares.forEach(sqCoord => {
            if (gameState.board.grid[sqCoord.r] && gameState.board.grid[sqCoord.r][sqCoord.c]) {
                gameState.board.grid[sqCoord.r][sqCoord.c].bonusUsed = true;
                console.log(`URL Processing: Bonus at ${sqCoord.r},${sqCoord.c} marked as used.`);
            }
        });

        // The player who made the move (playerWhoseTurnItWas) drew tiles on their client.
        // The receiving client needs to update that player's rack and the game bag accordingly.
        const tilesPlayedCount = newlyPlacedMovesFromURL.length;
        gameState.drawTiles(playerWhoseTurnItWas, tilesPlayedCount);
        console.log(`URL Processing: Simulated drawing ${tilesPlayedCount} tiles for ${playerWhoseTurnItWas.name}. New rack size: ${playerWhoseTurnItWas.rack.length}. Bag size: ${gameState.bag.length}`);

        return true;
    }

    console.log("No actionable turn data (word play, pass, or exchange) found in URL params to apply in applyTurnDataFromURL.");
    return false; // No word data, and no 'ex' parameter was found by this function.
}

function loadGameFromURLOrStorage(searchStringOverride = null) {
    const searchSource = searchStringOverride !== null ? searchStringOverride : window.location.search;
    const params = new URLSearchParams(searchSource);
    const urlGameId = params.get('gid');
    const urlTurnNumberStr = params.get('tn');
    const urlSeed = params.get('seed');
    const urlCreator = params.get('creator');
    const urlDictType = params.get('dt');
    const urlDictUrl = params.get('du');

    if (urlGameId) {
        console.log(`URL contains gameId: ${urlGameId}`);
        currentGame = loadGameStateFromLocalStorage(urlGameId);
        if (currentGame) {
            if (currentGame.creatorId === BROWSER_PLAYER_ID) localPlayerId = 'player1'; else localPlayerId = 'player2';
            console.log(`Game ${urlGameId} loaded. This browser: ${localPlayerId}. LS Turn: ${currentGame.turnNumber}. URL Turn: ${urlTurnNumberStr}`);
            if (urlTurnNumberStr) {
                const urlTurnNumber = parseInt(urlTurnNumberStr);
                if (urlTurnNumber === currentGame.turnNumber + 1) {
                    console.log(`Attempting to apply turn ${urlTurnNumber} from URL.`);
                    if (applyTurnDataFromURL(currentGame, params)) { // True if word data was processed and applied
                        currentGame.turnNumber = urlTurnNumber;
                        currentGame.currentPlayerIndex = (currentGame.currentPlayerIndex + 1) % currentGame.players.length;
                        saveGameStateToLocalStorage(currentGame);
                        console.log(`Successfully applied word move from URL for turn ${urlTurnNumber}. New current player index: ${currentGame.currentPlayerIndex}`);
                    } else {
                        // applyTurnDataFromURL returned false. Check if it was a pass/exchange or an error.
                        if (!params.has('w') && !params.has('wl') && !params.has('wd') && !params.has('bt')) {
                            // No word-specific parameters, likely a pass or exchange (or just gid, tn)
                            currentGame.turnNumber = urlTurnNumber;
                            currentGame.currentPlayerIndex = (currentGame.currentPlayerIndex + 1) % currentGame.players.length;
                            saveGameStateToLocalStorage(currentGame);
                            console.log(`Turn ${urlTurnNumber} (pass/exchange or sync) processed. New current player index: ${currentGame.currentPlayerIndex}`);
                        } else {
                            // Word parameters were present but applyTurnDataFromURL failed (e.g., parsing error, invalid coords)
                            alert("Failed to apply turn data from URL. Word data present but invalid. Check console.");
                        }
                    }
                } else if (urlTurnNumber <= currentGame.turnNumber) {
                    console.log(`Turn ${urlTurnNumber} from URL already applied or is old. Current turn: ${currentGame.turnNumber}.`);
                } else {
                    alert(`Out of sync turn data. Expected turn ${currentGame.turnNumber + 1}, got ${urlTurnNumber}.`);
                }
            }
        } else {
            if (urlSeed && (!urlTurnNumberStr || parseInt(urlTurnNumberStr) <= 1)) { // Game not found locally, but URL has seed (and optionally P1's first move)
                console.log(`New game ${urlGameId} from URL with seed ${urlSeed}. This client is P2.`);
                const newGameSettings = {};
                if (urlDictType) {
                    newGameSettings.dictionaryType = urlDictType;
                    if (urlDictType === 'custom' && urlDictUrl) {
                        newGameSettings.dictionaryUrl = urlDictUrl;
                    }
                }
                currentGame = new GameState(urlGameId, parseInt(urlSeed), newGameSettings);
                localPlayerId = 'player2'; // This client is Player 2
                currentGame.creatorId = urlCreator || null; // Store creator from URL

                // If P1's first move is also in this URL (tn=1 and word data or ex data)
                if (urlTurnNumberStr && parseInt(urlTurnNumberStr) === 1 && (params.has('w') || params.get('ex') !== null)) {
                    if(applyTurnDataFromURL(currentGame, params)) { // apply P1's word OR P1's pass/exchange
                        currentGame.turnNumber = 1;
                        currentGame.currentPlayerIndex = 1; // Now P2's turn (index 1)
                    } else {
                        console.error("Failed to apply P1's first move data for P2 when creating game from URL.");
                        // Potentially revert game creation or alert user more strongly
                    }
                }
                // If tn=0 or no turn data, it's just game setup, P1 hasn't moved yet.
                // currentPlayerIndex remains 0 (P1's turn). turnNumber remains 0.
                // This is already handled by GameState constructor defaults.

                saveGameStateToLocalStorage(currentGame);
            } else {
                 alert(`Game ${urlGameId} not found locally and URL does not contain sufficient data to start it (e.g. missing seed for a new game instance). Load initial new game URL from Player 1.`);
                 document.getElementById('board-container').innerHTML = `<p>Error: Game ${urlGameId} not found. Load P1's first URL.</p>`; return;
            }
        }
    } else if (urlSeed) {
        console.log(`New game from URL with seed ${urlSeed}. This client is P1.`);
        const newGameId = urlGameId || `game-${Date.now()}`;
        currentGame = new GameState(newGameId, parseInt(urlSeed), {});
        currentGame.creatorId = BROWSER_PLAYER_ID;
        localPlayerId = 'player1';
        saveGameStateToLocalStorage(currentGame);
    } else {
        console.log("No game parameters in URL. Initializing a new local test game.");
        initializeNewGame(); return;
    }
    if (currentGame) fullRender(currentGame, localPlayerId);
    else {
        console.log("No game active. Displaying new game prompt.");
        document.getElementById('board-container').innerHTML = '<p>Start a new game or load one via URL.</p>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");
    loadGameFromURLOrStorage();
    document.getElementById('play-word-btn').addEventListener('click', handleCommitPlay);
    document.getElementById('exchange-tiles-btn').addEventListener('click', handleExchangeTiles);
    document.getElementById('pass-turn-btn').addEventListener('click', handlePassTurn);

    // New Game Modal Logic
    const newGameBtn = document.getElementById('new-game-btn');
    if (newGameBtn) newGameBtn.addEventListener('click', showNewGameModal);

    const startGameBtn = document.getElementById('start-game-btn');
    if (startGameBtn) startGameBtn.addEventListener('click', startGameWithSettings);

    const cancelNewGameBtn = document.getElementById('cancel-new-game-btn');
    if (cancelNewGameBtn) cancelNewGameBtn.addEventListener('click', hideNewGameModal);

    document.querySelectorAll('input[name="dictionaryType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            document.getElementById('custom-dictionary-url').style.display =
                (this.value === 'custom') ? 'block' : 'none';
        });
    });

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
                        }, 2000); // Revert after 2 seconds
                    })
                    .catch(err => {
                        console.error('Failed to copy URL: ', err);
                        // Fallback for older browsers or if permissions are denied
                        // You could select the text and use document.execCommand('copy') here
                        // but that's also becoming deprecated.
                        // For now, just log the error. User can still manually copy.
                        alert("Failed to copy URL. Please copy it manually.");
                    });
            } else {
                // Optionally, provide feedback if there's no URL to copy
                const originalButtonText = copyUrlBtn.textContent;
                copyUrlBtn.textContent = 'No URL!';
                setTimeout(() => {
                    copyUrlBtn.textContent = originalButtonText;
                }, 1500);
            }
        });
    }
});
