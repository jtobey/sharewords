"use strict";

// Crossword Builder Game - Main Script
// This script handles game logic, UI interaction, and state management.
console.log("Crossword Builder Game script loaded.");

// --- PRNG (Mulberry32) ---
/**
 * Creates a seeded pseudorandom number generator (PRNG) using the Mulberry32 algorithm.
 * This ensures that game events like tile shuffling are reproducible if the same seed is used.
 * @param {number} seed - The initial seed for the PRNG.
 * @returns {function(): number} A function that, when called, returns a new pseudorandom number
 *                               between 0 (inclusive) and 1 (exclusive).
 */
function Mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// --- Game Constants ---
/** @const {number} BOARD_SIZE - The width and height of the game board (number of squares). */
const BOARD_SIZE = 15;
/** @const {number} RACK_SIZE - The number of tiles a player holds on their rack. */
const RACK_SIZE = 7;

/**
 * @typedef {string} BonusType
 * Enum for bonus types on the game board.
 * @enum {BonusType}
 */
const BONUS_TYPES = {
    NONE: 'none', // No bonus
    DL: 'dl',     // Double Letter score
    TL: 'tl',     // Triple Letter score
    DW: 'dw',     // Double Word score
    TW: 'tw'      // Triple Word score
};

// Default board layout definition.
// Each string represents a row. Characters define bonus squares:
// 'T': Triple Word, 'D': Double Word, 't': Triple Letter, 'd': Double Letter, '.': Normal square.
const DEFAULT_BOARD_LAYOUT_STRINGS = [
    "D..d..T......T.", // Row 0
    ".D...D...t.t..T", // Row 1
    "..D.....t...t..",
    "d..D...t.....t.",
    "....D.t...D....",
    ".D...d.d.....t.",
    "T...d...d...t..",
    "...d.t...d.t...",
    "..d...t...t...T",
    ".d.....t.t...D.",
    "....D...d.D....",
    ".d.....d...D..d",
    "..d...d.....D..",
    "T..d.d...D...D.",
    ".T......T..d..D" // Row 14
];

/**
 * Default point values for each letter tile.
 * Can be overridden by game settings.
 * Example: `DEFAULT_TILE_VALUES['_']` would be for blank tile value if explicitly defined.
 * @const {Object<string, number>}
 */
const DEFAULT_TILE_VALUES = {
    'A': 1, 'B': 3, 'C': 4, 'D': 2, 'E': 1, 'F': 4, 'G': 3, 'H': 4, 'I': 1, 'J': 9,
    'K': 5, 'L': 1, 'M': 3, 'N': 1, 'O': 1, 'P': 3, 'Q': 10, 'R': 1, 'S': 1, 'T': 1,
    'U': 2, 'V': 5, 'W': 4, 'X': 8, 'Y': 4, 'Z': 10 // Z is 10 points
};
/**
 * Default distribution of letter tiles (how many of each letter).
 * Can be overridden by game settings.
 * @const {Object<string, number>}
 */
const DEFAULT_LETTER_DISTRIBUTION = {
    'A': 9, 'B': 2, 'C': 2, 'D': 4, 'E': 12, 'F': 2, 'G': 2, 'H': 2, 'I': 9, 'J': 1,
    'K': 1, 'L': 4, 'M': 2, 'N': 6, 'O': 8, 'P': 2, 'Q': 1, 'R': 6, 'S': 5, 'T': 6,
    'U': 4, 'V': 2, 'W': 2, 'X': 1, 'Y': 2, 'Z': 1
};

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
  "dictionaryUrl": "https://api.example.com/dict?word=", // Optional, needed if dictionaryType is "custom"
  "customBoardLayout": ["T..d...", ".D..t...", ...], // Optional, array of 15 strings for board layout
  "playerNames": { "player1": "Alice", "player2": "Bob" } // Optional
}
*/

// --- Core Game Data Structures ---

/**
 * Represents a single game tile.
 * @param {string} letter - The letter on the tile (empty string for blank tiles).
 * @param {number} value - The point value of the tile.
 * @param {boolean} [isBlank=false] - True if this tile is a blank tile.
 * @property {string} id - A unique identifier for the tile instance.
 * @property {?string} assignedLetter - If blank, the letter assigned by the player (e.g., "A").
 */
function Tile(letter, value, isBlank = false) {
    this.letter = letter.toUpperCase(); // Ensure letter is uppercase for consistency
    this.value = value;
    this.isBlank = isBlank;
    this.assignedLetter = null; // Will be set when a blank tile is played
    // Generate a unique ID for tracking tile instances, useful for drag-and-drop and state updates.
    this.id = `tile-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Represents a single square on the game board.
 * @param {number} row - The row index of the square.
 * @param {number} col - The column index of the square.
 * @param {BonusType} [bonus=BONUS_TYPES.NONE] - The bonus type of the square.
 * @property {?Tile} tile - The Tile object currently placed on this square, or null if empty.
 * @property {boolean} bonusUsed - True if the bonus on this square has already been applied.
 */
function Square(row, col, bonus = BONUS_TYPES.NONE) {
    this.row = row;
    this.col = col;
    this.bonus = bonus;
    this.tile = null; // Tile object or null
    this.bonusUsed = false;
}

/**
 * Represents the game board.
 * @param {number} [size=BOARD_SIZE] - The size (width/height) of the board.
 * @param {?string[]} [customLayoutStringArray=null] - An array of strings defining a custom board layout.
 *                                                    If null or invalid, uses DEFAULT_BOARD_LAYOUT_STRINGS.
 * @property {Array<Array<Square>>} grid - A 2D array representing the board's squares.
 */
function Board(size = BOARD_SIZE, customLayoutStringArray = null) {
    this.size = size;
    this.grid = []; // Initialize grid as a 2D array of Square objects
    for (let r = 0; r < size; r++) {
        this.grid[r] = [];
        for (let c = 0; c < size; c++) {
            this.grid[r][c] = new Square(r, c, BONUS_TYPES.NONE);
        }
    }

    let layoutToApply = DEFAULT_BOARD_LAYOUT_STRINGS;
    let layoutSourceName = "default";

    // Validate and apply custom layout if provided
    if (customLayoutStringArray) {
        if (Array.isArray(customLayoutStringArray) &&
            customLayoutStringArray.length === this.size &&
            customLayoutStringArray.every(rowStr => typeof rowStr === 'string' && rowStr.length === this.size)) {
            layoutToApply = customLayoutStringArray;
            layoutSourceName = "custom";
            console.log("Board: Applying custom layout.");
        } else {
            console.warn("Board: Custom layout malformed. Falling back to default.");
            // layoutToApply remains DEFAULT_BOARD_LAYOUT_STRINGS
        }
    }

    // Populate the grid with Square objects and set their bonuses based on the layout
    console.log(`Board: Initializing with ${layoutSourceName} layout.`);
    for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
            // Default to no bonus, which is already set in Square constructor
            if (layoutToApply[r] && layoutToApply[r][c]) {
                const layoutChar = layoutToApply[r][c];
                switch (layoutChar) {
                    case 'T': this.grid[r][c].bonus = BONUS_TYPES.TW; break;
                    case 'D': this.grid[r][c].bonus = BONUS_TYPES.DW; break;
                    case 't': this.grid[r][c].bonus = BONUS_TYPES.TL; break;
                    case 'd': this.grid[r][c].bonus = BONUS_TYPES.DL; break;
                    // '.' or any other character implies BONUS_TYPES.NONE (already default)
                }
            }
        }
    }

    // Method to get the center square of the board.
    this.getCenterSquare = function() {
        const centerIndex = Math.floor(this.size / 2);
        return this.grid[centerIndex][centerIndex];
    };
}

/**
 * Represents a player in the game.
 * @param {string} id - The unique identifier for the player (e.g., "player1", "player2").
 * @param {string} name - The display name of the player.
 * @property {Array<Tile>} rack - An array of Tile objects currently on the player's rack.
 * @property {number} score - The player's current score.
 */
function Player(id, name) {
    this.id = id;
    this.name = name;
    this.rack = []; // Player's hand of tiles
    this.score = 0;
}

/**
 * Represents the overall state of the game.
 * @param {string} gameId - A unique identifier for this game session.
 * @param {number} randomSeed - The seed used for the PRNG for this game.
 * @param {object} [settings={}] - Custom game settings to override defaults. See example structure above.
 * @property {object} settings - Effective game settings, merging defaults with custom inputs.
 * @property {function(): number} prng - The pseudorandom number generator instance for this game.
 * @property {Array<Tile>} bag - An array of Tile objects available to be drawn.
 * @property {Array<Player>} players - An array of Player objects.
 * @property {number} currentPlayerIndex - Index of the current player in the `players` array.
 * @property {Board} board - The game Board object.
 * @property {number} turnNumber - The current turn number (0 for the start of the game).
 * @property {Array<object>} currentTurnMoves - Tiles placed on the board in the current turn but not yet committed.
 *                                              Each object: { tileId: string, tileRef: Tile, from: string ('rack'|'board'), to: {row: number, col: number} }
 * @property {Array<object>} gameHistory - Log of significant game events or states (future use).
 * @property {boolean} isGameOver - Flag indicating if the game has ended.
 */
function GameState(gameId, randomSeed, settings = {}) {
    this.gameId = gameId;
    this.randomSeed = randomSeed;

    // Consolidate settings, applying defaults for any not provided
    this.settings = {
        boardSize: settings.boardSize || BOARD_SIZE,
        rackSize: settings.rackSize || RACK_SIZE,
        blankTileCount: settings.blankTileCount !== undefined ? settings.blankTileCount : 2, // Default is 2
        sevenTileBonus: settings.sevenTileBonus !== undefined ? settings.sevenTileBonus : 50, // Default is 50
        dictionaryType: settings.dictionaryType || 'permissive',
        dictionaryUrl: settings.dictionaryUrl || null,
        tileValues: settings.tileValues || { ...DEFAULT_TILE_VALUES },
        letterDistribution: settings.letterDistribution || { ...DEFAULT_LETTER_DISTRIBUTION },
        customBoardLayout: settings.customBoardLayout || null, // Will be used by Board constructor
        playerNames: settings.playerNames || { player1: "Player 1", player2: "Player 2" },
        ...settings // Spread any other custom settings passed in
    };

    this.prng = Mulberry32(this.randomSeed);
    this.bag = []; // Initialize empty bag, to be filled by _initializeBag

    /**
     * Initializes the tile bag based on letter distribution and values from settings.
     * @private
     */
    this._initializeBag = function() {
        this.bag = []; // Clear bag before initializing
        const distribution = this.settings.letterDistribution;
        const values = this.settings.tileValues; // Effective values, considering defaults

        for (const letter in distribution) {
            if (distribution.hasOwnProperty(letter)) {
                for (let i = 0; i < distribution[letter]; i++) {
                    const value = values[letter] !== undefined ? values[letter] : 0;
                    this.bag.push(new Tile(letter, value));
                }
            }
        }

        // Add blank tiles
        const blankValue = values['_'] !== undefined ? values['_'] : 0; // Value for blank tiles, default 0
        for (let i = 0; i < this.settings.blankTileCount; i++) {
            this.bag.push(new Tile('', blankValue, true)); // Blank tile has empty letter string
        }
    };

    /**
     * Shuffles the tile bag using the game's PRNG.
     * @private
     */
    this._shuffleBag = function() {
        for (let i = this.bag.length - 1; i > 0; i--) {
            const j = Math.floor(this.prng() * (i + 1));
            [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]; // Fisher-Yates shuffle
        }
    };

    /**
     * Draws a specified number of tiles from the bag and adds them to a player's rack.
     * @param {Player} player - The player to draw tiles.
     * @param {number} numTiles - The number of tiles to draw.
     * @returns {Array<Tile>} The array of tiles drawn.
     */
    this.drawTiles = function(player, numTiles) {
        const drawnTiles = [];
        for (let i = 0; i < numTiles && this.bag.length > 0; i++) {
            const tile = this.bag.pop(); // Take tile from the end of the (shuffled) bag
            if (tile) {
                player.rack.push(tile);
                drawnTiles.push(tile);
            }
        }
        return drawnTiles;
    };

    // Initialize players
    const p1Name = this.settings.playerNames.player1;
    const p2Name = this.settings.playerNames.player2;
    this.players = [new Player("player1", p1Name), new Player("player2", p2Name)];
    this.currentPlayerIndex = 0; // Player 1 starts

    // Initialize and shuffle bag, then deal initial tiles to players
    this._initializeBag();
    this._shuffleBag();
    this.players.forEach(player => { this.drawTiles(player, this.settings.rackSize); });

    // Initialize board
    this.board = new Board(this.settings.boardSize, this.settings.customBoardLayout);

    this.turnNumber = 0;
    this.currentTurnMoves = []; // Stores { tileId, tileRef, from, to } for uncommitted moves
    this.gameHistory = []; // For potential future use (e.g., undo, replay)
    this.isGameOver = false;

    /** Gets the current player object. @returns {Player} */
    this.getCurrentPlayer = function() { return this.players[this.currentPlayerIndex]; };
    /** Gets the opponent player object. @returns {Player} */
    this.getOpponentPlayer = function() { return this.players[(this.currentPlayerIndex + 1) % this.players.length]; };
}

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
        const isDraggable = (gameState.getCurrentPlayer().id === localPlayerId && !isExchangeModeActive);
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
    if (modalCopyCheckbox) modalCopyCheckbox.checked = true; // Default to copying URL
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
    const localPlayerInstance = currentGame.players.find(p => p.id === localPlayerId);

    if (!localPlayerInstance) {
        console.log("Touch drag prevented: Local player instance not found.");
        return;
    }
    // Check if the tile is in the local player's rack OR part of their current uncommitted moves on the board.
    const isTileInLocalPlayerRack = localPlayerInstance.rack.some(t => t.id === tileId);
    const isTileInCurrentTurnMoves = currentGame.currentTurnMoves.some(m => m.tileId === tileId);

    if (!isTileInLocalPlayerRack && !isTileInCurrentTurnMoves) {
        console.log("Touch drag prevented: Tile is not in local player's rack or current turn moves.", tileId);
        return;
    }

    // Tile is draggable by the local player.
    console.log(`Touch Start: Allowed for local player, tile ${tileId}`);
    event.preventDefault(); // Prevent default touch actions (like scrolling or text selection).

    touchDraggedTileId = tileId;
    touchDraggedElement = tileElement;

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

    // Temporarily move element to body for unrestricted positioning and to ensure it's visually on top.
    document.body.appendChild(touchDraggedElement);
    touchDraggedElement.style.position = 'absolute';
    // Position includes current scroll offset to keep element under finger
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
    touchDraggedElement.style.left = (event.touches[0].clientX - offsetX + scrollX) + 'px';
    touchDraggedElement.style.top = (event.touches[0].clientY - offsetY + scrollY) + 'px';
    touchDraggedElement.style.opacity = '0.7'; // Make it semi-transparent
    touchDraggedElement.style.zIndex = '1001'; // Ensure it's above other elements

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
    if (!touchDraggedElement) return;
    event.preventDefault(); // Prevent scrolling during drag

    const touch = event.touches[0];
    // Update position, including scroll offset
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
    touchDraggedElement.style.left = (touch.clientX - offsetX + scrollX) + 'px';
    touchDraggedElement.style.top = (touch.clientY - offsetY + scrollY) + 'px';

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
    if (!touchDraggedElement) return;

    // Clean up global event listeners
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    document.removeEventListener('touchcancel', handleTouchEnd);
    document.querySelectorAll('.touch-drag-over').forEach(el => el.classList.remove('touch-drag-over'));

    // Temporarily hide the dragged element to correctly find the element underneath the touch point
    touchDraggedElement.style.display = 'none';
    const touch = event.changedTouches[0]; // Use changedTouches for touchend/touchcancel
    const dropTargetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    touchDraggedElement.style.display = ''; // Make it visible again

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
                touchDraggedElement.remove(); // Remove the temporarily-styled element from body

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
            touchDraggedElement.remove(); // Remove the temporarily-styled element from body

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
        if (touchDraggedElement.parentNode === document.body) {
             touchDraggedElement.remove(); // Remove from body first
        }
        // Re-insert into original DOM position with original styles
        if (originalParentNode && draggedElementOriginalStyles) {
            touchDraggedElement.style.position = draggedElementOriginalStyles.position;
            touchDraggedElement.style.left = draggedElementOriginalStyles.left;
            touchDraggedElement.style.top = draggedElementOriginalStyles.top;
            touchDraggedElement.style.opacity = draggedElementOriginalStyles.opacity;
            touchDraggedElement.style.zIndex = draggedElementOriginalStyles.zIndex;
            touchDraggedElement.style.transform = draggedElementOriginalStyles.transform;
            originalParentNode.insertBefore(touchDraggedElement, originalNextSibling);
        }
        // If the drop failed, a fullRender might be needed to ensure UI consistency,
        // especially if the tile was from the board and its logical state needs resetting.
        // However, the drop handlers (handleDropOnBoard/Rack) call fullRender on success.
        // If we reached here, it means no drop handler was called or it failed early.
        // A fullRender ensures the game state and UI are synchronized.
        fullRender(currentGame, localPlayerId);
    }

    // Reset touch DND state variables
    touchDraggedElement = null;
    touchDraggedTileId = null;
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
    const localPlayerInstance = currentGame.players.find(p => p.id === localPlayerId);

    if (!localPlayerInstance) {
        console.log("Mouse Drag prevented: Local player instance not found.");
        event.preventDefault(); return;
    }

    // Check if the tile is in the local player's rack OR part of their current uncommitted moves on the board.
    const isTileInLocalPlayerRack = localPlayerInstance.rack.some(t => t.id === tileId);
    const isTileInCurrentTurnMoves = currentGame.currentTurnMoves.some(m => m.tileId === tileId);

    if (!isTileInLocalPlayerRack && !isTileInCurrentTurnMoves) {
        console.log("Mouse Drag prevented: Tile is not in local player's rack or current turn moves.", tileId);
        event.preventDefault(); return;
    }

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
 * Validates the placement of tiles for the current turn.
 * Checks rules: forms a single line, contiguous, connects to existing tiles (or center for first turn).
 * @param {Array<object>} moves - Array of current turn's moves ({ tileRef, to: {row, col} }).
 * @param {number} turnNumber - The current turn number of the game.
 * @param {Board} boardState - The current state of the game board.
 * @returns {{isValid: boolean, message: string, direction: ?string}}
 *          Result object: `isValid` (boolean), `message` (string, error message if invalid),
 *          `direction` (string 'horizontal'|'vertical', the determined line direction of the play).
 */
function validatePlacement(moves, turnNumber, boardState) {
    const validationResult = { isValid: false, message: "", direction: null };
    if (!moves || moves.length === 0) {
        validationResult.message = "No tiles placed to validate.";
        return validationResult;
    }

    // Sort moves by row, then column for consistent processing
    const sortedMoves = [...moves].sort((a, b) =>
        (a.to.row === b.to.row) ? a.to.col - b.to.col : a.to.row - b.to.row
    );

    let isLineHorizontal = true;
    let isLineVertical = true;

    // Determine if tiles form a single horizontal or vertical line
    if (sortedMoves.length > 0) {
        isLineHorizontal = sortedMoves.every(m => m.to.row === sortedMoves[0].to.row);
        isLineVertical = sortedMoves.every(m => m.to.col === sortedMoves[0].to.col);
        if (sortedMoves.length > 1 && !isLineHorizontal && !isLineVertical) {
            validationResult.message = "Invalid placement: Newly placed tiles must form a single horizontal or vertical line.";
            return validationResult;
        }
    }

    // Determine play direction. For a single tile, check adjacent existing tiles to infer direction.
    if (sortedMoves.length === 1) {
        const r = sortedMoves[0].to.row, c = sortedMoves[0].to.col;
        // Check for existing tiles horizontally or vertically adjacent to the single placed tile
        const formsHorizontalWord = (c > 0 && boardState.grid[r][c-1].tile) || (c < boardState.size-1 && boardState.grid[r][c+1].tile);
        const formsVerticalWord = (r > 0 && boardState.grid[r-1][c].tile) || (r < boardState.size-1 && boardState.grid[r+1][c].tile);
        // Prefer horizontal if both are possible or neither (defaulting for a single tile in empty space)
        validationResult.direction = formsHorizontalWord ? 'horizontal' : (formsVerticalWord ? 'vertical' : 'horizontal');
    } else if (isLineHorizontal) {
        validationResult.direction = 'horizontal';
    } else if (isLineVertical) {
        validationResult.direction = 'vertical';
    }
    // If direction is still null here (e.g. single tile, no adjacent), it might be an issue or needs default.
    // The logic above tries to set it. If it's critical and still null, add handling.

    // Check for contiguity (no gaps in the line of newly placed tiles)
    if (sortedMoves.length > 1) {
        const first = sortedMoves[0].to;
        const last = sortedMoves[sortedMoves.length-1].to;
        if (validationResult.direction === 'horizontal') {
            for (let c = first.col + 1; c < last.col; c++) {
                // Check if square (first.row, c) is occupied by either a new move or an existing tile
                if (!sortedMoves.some(m => m.to.row === first.row && m.to.col === c) && !boardState.grid[first.row][c].tile) {
                    validationResult.message = "Invalid placement: Tiles in a new word must be contiguous (no gaps).";
                    return validationResult;
                }
            }
        } else if (validationResult.direction === 'vertical') {
            for (let r = first.row + 1; r < last.row; r++) {
                // Check if square (r, first.col) is occupied by either a new move or an existing tile
                if (!sortedMoves.some(m => m.to.col === first.col && m.to.row === r) && !boardState.grid[r][first.col].tile) {
                    validationResult.message = "Invalid placement: Tiles in a new word must be contiguous (no gaps).";
                    return validationResult;
                }
            }
        }
    }

    // First turn validation: must cover the center square
    if (turnNumber === 0) {
        const center = boardState.getCenterSquare();
        if (!sortedMoves.some(m => m.to.row === center.row && m.to.col === center.col)) {
            validationResult.message = "Invalid placement: The first word must cover the center square.";
            return validationResult;
        }
    } else { // Subsequent turns: must connect to an existing tile
        let connectsToExistingTile = false;
        let boardHasExistingTiles = false;

        // Check if there are any tiles on the board *not* part of the current move set
        for(let r_idx = 0; r_idx < boardState.size; r_idx++) {
            for(let c_idx = 0; c_idx < boardState.size; c_idx++) {
                if(boardState.grid[r_idx][c_idx].tile && !sortedMoves.some(m => m.to.row === r_idx && m.to.col === c_idx)) {
                    boardHasExistingTiles = true;
                    break;
                }
            }
            if (boardHasExistingTiles) break;
        }

        if (boardHasExistingTiles) {
            // New tiles must connect to at least one existing tile
            for (const move of sortedMoves) {
                const {row, col} = move.to;
                // Check adjacent squares (up, down, left, right)
                const neighbors = [[row-1, col], [row+1, col], [row, col-1], [row, col+1]];
                for (const [nr, nc] of neighbors) {
                    if (nr >= 0 && nr < boardState.size && nc >= 0 && nc < boardState.size &&
                        boardState.grid[nr][nc].tile && // Is there a tile in the neighboring square?
                        !sortedMoves.some(sm => sm.to.row === nr && sm.to.col === nc)) { // And it's not part of the current placement?
                        connectsToExistingTile = true;
                        break;
                    }
                }
                if (connectsToExistingTile) break;
            }
            if (!connectsToExistingTile) {
                validationResult.message = "Invalid placement: New words must connect to existing tiles on the board.";
                return validationResult;
            }
        } else {
            // Board was empty before this turn (even if turnNumber > 0, e.g. after many passes/exchanges)
            // So, this play must cover the center square like a first turn.
            const center = boardState.getCenterSquare();
            if (!sortedMoves.some(m => m.to.row === center.row && m.to.col === center.col)) {
                validationResult.message = "Invalid placement: The first word on an empty board must cover the center square.";
                return validationResult;
            }
        }
    }

    validationResult.isValid = true;
    return validationResult;
}

/**
 * Identifies the main played word string, its start position, direction, and blank tile info.
 * This is primarily used for generating the turn URL.
 * @param {Array<object>} committedMovesInput - Array of committed moves for the turn.
 * @param {Board} board - The game board state *after* tiles are placed.
 * @param {string} identifiedDirection - The 'horizontal' or 'vertical' direction of the main word.
 * @returns {?{word: string, start_row: number, start_col: number, direction: string, blanks_info: Array<{idx: number, al: string}>}}
 *          An object with word details, or null if identification fails.
 *          `blanks_info`: array of objects, each {idx: index_in_word, al: assigned_letter}.
 */
function identifyPlayedWord(committedMovesInput, board, identifiedDirection) {
    if (!identifiedDirection || !committedMovesInput || committedMovesInput.length === 0) {
        console.warn("identifyPlayedWord: Missing direction or moves. Cannot identify word for URL.");
        return null;
    }

    // Sort moves by the primary direction to find the logical start of the newly placed tiles
    const sortedNewMoves = [...committedMovesInput].sort((a,b) =>
        (identifiedDirection === 'horizontal') ? a.to.col - b.to.col : a.to.row - b.to.row
    );
    const firstNewTilePos = sortedNewMoves[0].to; // Position of the first tile in the sorted new moves

    let wordString = "";
    let startRow = firstNewTilePos.row; // Start scan from the first newly placed tile's row
    let startCol = firstNewTilePos.col; // Start scan from the first newly placed tile's col

    // Scan backwards from the first new tile to find the true start of the entire word (including existing tiles)
    if (identifiedDirection === 'horizontal') {
        while (startCol > 0 && board.grid[startRow][startCol - 1].tile) {
            startCol--;
        }
        // Scan forwards to find the end of the word and build the string
        let currentCol = startCol;
        while (currentCol < board.size && board.grid[startRow][currentCol].tile) {
            const tile = board.grid[startRow][currentCol].tile;
            wordString += tile.isBlank ? tile.assignedLetter.toUpperCase() : tile.letter.toUpperCase();
            currentCol++;
        }
    } else { // Vertical
        while (startRow > 0 && board.grid[startRow - 1][startCol].tile) {
            startRow--;
        }
        let currentRow = startRow;
        while (currentRow < board.size && board.grid[currentRow][startCol].tile) {
            const tile = board.grid[currentRow][startCol].tile;
            wordString += tile.isBlank ? tile.assignedLetter.toUpperCase() : tile.letter.toUpperCase();
            currentRow++;
        }
    }

    // Collect information about blank tiles used in this main word
    const blanksInfo = [];
    committedMovesInput.forEach(move => {
        if (move.tileRef.isBlank && move.tileRef.assignedLetter) {
            // Calculate the index of this blank tile within the identified main word string
            let indexInWord;
            if (identifiedDirection === 'horizontal') {
                if (move.to.row === startRow && move.to.col >= startCol && move.to.col < startCol + wordString.length) {
                    indexInWord = move.to.col - startCol;
                }
            } else { // Vertical
                if (move.to.col === startCol && move.to.row >= startRow && move.to.row < startRow + wordString.length) {
                    indexInWord = move.to.row - startRow;
                }
            }
            if (indexInWord !== undefined && indexInWord >= 0 && indexInWord < wordString.length) {
                blanksInfo.push({ idx: indexInWord, al: move.tileRef.assignedLetter.toUpperCase() });
            }
        }
    });

    if (wordString.includes('?') || wordString.length === 0) { // Should not happen if logic is correct
        console.error("identifyPlayedWord: Error constructing word string or empty word.", { committedMovesInput, wordString });
        return null;
    }

    return { word: wordString, start_row: startRow, start_col: startCol, direction: identifiedDirection, blanks_info: blanksInfo };
}


/**
 * Handles the "Play Word" action.
 * - Validates tile placement and dictionary words.
 * - Calculates score.
 * - Updates game state (scores, draws new tiles, advances turn).
 * - Generates and displays turn URL.
 * - Saves game state.
 */
async function handleCommitPlay() {
    if (!currentGame || currentGame.getCurrentPlayer().id !== localPlayerId) { alert("It's not your turn or no game active!"); return; }
    if (currentGame.currentTurnMoves.length === 0) { alert("You haven't placed any tiles."); return; }

    const validation = validatePlacement(currentGame.currentTurnMoves, currentGame.turnNumber, currentGame.board);
    if (!validation.isValid) { alert(validation.message); return; }
    const identifiedDirection = validation.direction;
    console.log("Placement validation passed. Direction:", identifiedDirection);

    const actualCommittedMoves = [...currentGame.currentTurnMoves];

    // --- Dictionary Validation (if not permissive) ---
    if (currentGame.settings.dictionaryType !== 'permissive') {
        // Important: For dictionary validation, we need to check words on the board *as it would be*
        // if the play is committed. Since drag/drop directly modifies `currentGame.board`,
        // the `currentGame.board` already reflects the `actualCommittedMoves`.
        // So, `identifyAllPlayedWords` will use this current board state.
        // No temporary board copy is strictly needed here for word identification if this assumption holds.
        // However, if validation fails, the board is NOT rolled back by this function automatically.
        // The user must manually recall tiles.
        // A TODO was noted for robust rollback.

        const allWordsToValidate = identifyAllPlayedWords(actualCommittedMoves, currentGame.board, identifiedDirection);

        if (!allWordsToValidate || allWordsToValidate.length === 0) {
            // This might happen if, for example, only one tile is placed and it doesn't form any words > 1 letter with existing tiles.
            // Or if `identifyAllPlayedWords` has specific logic for minimum word length for validation.
            console.warn("handleCommitPlay: No words identified for dictionary validation, though placement was valid. Allowing play.");
        } else {
            for (const wordTileArray of allWordsToValidate) {
                const wordToValidateStr = wordTileArray.map(t => t.tile.isBlank ? t.tile.assignedLetter.toUpperCase() : t.tile.letter.toUpperCase()).join('');

                // Skip validation for single-letter words if dictionary type is not permissive
                // (most dictionaries don't list all single letters as words).
                if (wordToValidateStr.length <= 1 && currentGame.settings.dictionaryType !== 'permissive') {
                    console.log(`Skipping dictionary validation for single letter: "${wordToValidateStr}"`);
                    continue;
                }

                let validationApiUrl = "";
                let dictionaryNameForAlert = "";

                if (currentGame.settings.dictionaryType === 'freeapi') {
                    validationApiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${wordToValidateStr.toLowerCase()}`;
                    dictionaryNameForAlert = "Free Dictionary API";
                } else if (currentGame.settings.dictionaryType === 'custom' && currentGame.settings.dictionaryUrl) {
                    // Assuming custom API also wants lowercase word.
                    validationApiUrl = `${currentGame.settings.dictionaryUrl}${wordToValidateStr.toLowerCase()}`;
                    dictionaryNameForAlert = "Custom Dictionary";
                }

                if (validationApiUrl) {
                    console.log(`Validating word: "${wordToValidateStr}" using ${dictionaryNameForAlert} at URL: ${validationApiUrl}`);
                    try {
                        const response = await fetch(validationApiUrl);
                        if (!response.ok) {
                            // Handle HTTP errors (e.g., 404 Not Found, 500 Server Error)
                            if (response.status === 404) {
                                alert(`Word "${wordToValidateStr}" not found in ${dictionaryNameForAlert}. Play rejected.`);
                            } else {
                                alert(`Error validating word "${wordToValidateStr}" with ${dictionaryNameForAlert} (Status: ${response.status}). Play rejected.`);
                            }
                            // TODO: Implement robust rollback of tiles on validation failure.
                            // For now, user must manually recall tiles.
                            fullRender(currentGame, localPlayerId); // Re-render to show current (pre-commit) state.
                            return; // Stop commit process
                        }
                        // For Free Dictionary API, a 200 OK can still mean "no definition found"
                        // which is typically returned as an empty array or an object with a "title" like "No Definitions Found".
                        if (currentGame.settings.dictionaryType === 'freeapi') {
                            const data = await response.json();
                            if (!Array.isArray(data) || data.length === 0 || (data[0] && data[0].title === "No Definitions Found")) {
                                alert(`Word "${wordToValidateStr}" not found or has no definition in ${dictionaryNameForAlert}. Play rejected.`);
                                fullRender(currentGame, localPlayerId);
                                return; // Stop commit process
                            }
                        }
                        console.log(`Word "${wordToValidateStr}" is valid according to ${dictionaryNameForAlert}.`);
                    } catch (error) {
                        console.error(`Network or other error validating word "${wordToValidateStr}":`, error);
                        alert(`Could not reach ${dictionaryNameForAlert} to validate "${wordToValidateStr}". Play rejected. Check connection or API status.`);
                        fullRender(currentGame, localPlayerId);
                        return; // Stop commit process
                    }
                }
            }
        }
    }
    // --- End Dictionary Validation ---

    const playerWhoPlayed = currentGame.getCurrentPlayer();

    // --- Scoring ---
    // `currentGame.board` already reflects the `actualCommittedMoves` due to direct modification by DND handlers.
    // `identifyAllPlayedWords` will use this board state to find all formed words.
    const allWordsPlayedForScoring = identifyAllPlayedWords(actualCommittedMoves, currentGame.board, identifiedDirection);

    if (allWordsPlayedForScoring.length === 0 && actualCommittedMoves.length > 0) {
        // This could happen if only a single tile was placed and it didn't form any words > 1 letter
        // and `identifyAllPlayedWords` filters out single-letter sequences for scoring.
        console.warn("handleCommitPlay: No words identified for scoring, though moves were made.", actualCommittedMoves);
        // The play might still be valid (e.g. connecting to existing tiles) but score 0 if no new multi-letter words.
    }

    const scoreResult = calculateWordScore(allWordsPlayedForScoring, currentGame.board, actualCommittedMoves, currentGame.settings);
    playerWhoPlayed.score += scoreResult.score;
    console.log(`${playerWhoPlayed.name} scored ${scoreResult.score} points. New total score: ${playerWhoPlayed.score}`);

    // Mark bonus squares on the main game board as used
    scoreResult.usedBonusSquares.forEach(sqCoord => {
        if (currentGame.board.grid[sqCoord.r] && currentGame.board.grid[sqCoord.r][sqCoord.c]) {
            currentGame.board.grid[sqCoord.r][sqCoord.c].bonusUsed = true;
            console.log(`Bonus at [${sqCoord.r},${sqCoord.c}] marked as used.`);
        }
    });
    // --- End Scoring ---

    // Identify the main word again for URL generation (might be redundant if stored from validation, but safer)
    // This uses the final board state.
    const wordDataForURL = identifyPlayedWord(actualCommittedMoves, currentGame.board, identifiedDirection);
    if (!wordDataForURL || !wordDataForURL.word) {
        // This might happen if `identifyPlayedWord` has stricter criteria or fails for some edge case.
        console.warn("handleCommitPlay: Word identification for URL failed or produced no word data.");
    }

    // Finalize turn: clear current moves, advance turn counter, draw new tiles, switch player.
    currentGame.currentTurnMoves = []; // Clear uncommitted moves
    currentGame.turnNumber++;

    const tilesPlayedCount = actualCommittedMoves.length;
    currentGame.drawTiles(playerWhoPlayed, tilesPlayedCount); // Player draws new tiles
    console.log(`${playerWhoPlayed.name} drew ${tilesPlayedCount} new tiles. Rack size: ${playerWhoPlayed.rack.length}`);

    currentGame.currentPlayerIndex = (currentGame.currentPlayerIndex + 1) % currentGame.players.length;
    console.log(`Turn ended. New current player: ${currentGame.getCurrentPlayer().name}`);

    // Update UI (scores, turn indicator) before generating URL or saving
    updateGameStatus(currentGame);

    // Generate Turn URL
    let turnURL;
    const isFirstTurnByP1 = (currentGame.turnNumber === 1 && localPlayerId === 'player1');
    const seedForURL = isFirstTurnByP1 ? currentGame.randomSeed : null;
    const settingsForURL = isFirstTurnByP1 ? currentGame.settings : null;
    turnURL = generateTurnURL(currentGame.gameId, currentGame.turnNumber, wordDataForURL, seedForURL, settingsForURL);

    const turnUrlInput = document.getElementById('turn-url');
    if (turnUrlInput) {
        turnUrlInput.value = turnURL;
        turnUrlInput.placeholder = "Share this URL with the other player."; // Placeholder might be too late if value is set
        console.log("Turn URL generated:", turnURL);
    }

    showPostMoveModal(scoreResult.score, turnURL); // Show modal with score and URL
    saveGameStateToLocalStorage(currentGame); // Save game state
    fullRender(currentGame, localPlayerId); // Full UI refresh
    updateControlButtonsVisibility(); // Update button states (e.g., disable Play Word until next turn)
}


// --- UI: Post-Move Modal ---
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
    if (modalCopyCheckbox) modalCopyCheckbox.checked = true; // Default to copying URL
    postMoveModalElement.removeAttribute('hidden'); // Make the modal visible
}

// --- Scoring Logic ---

/**
 * Identifies all words formed by a given set of placed tiles on the board.
 * This includes the main word formed along the primary axis of placement,
 * and any cross-words formed perpendicular to the main word by individual new tiles.
 *
 * @param {Array<{tileRef: Tile, to: {row: number, col: number}}>} placedMoves
 *        An array of objects representing the tiles placed in the current turn.
 *        Each object contains the Tile object (`tileRef`) and its final board coordinates (`to`).
 * @param {Board} board - The game board object, reflecting the state *after* `placedMoves` are on it.
 * @param {string} mainWordDirection - The direction ('horizontal' or 'vertical') of the main line of play,
 *                                     as determined by `validatePlacement`.
 * @returns {Array<Array<{tile: Tile, r: number, c: number}>>}
 *          An array of words. Each word is itself an array of objects,
 *          where each object represents a tile in that word and contains the Tile object (`tile`),
 *          its row (`r`), and column (`c`).
 *          Returns an empty array if no words are formed or if inputs are invalid.
 */
function identifyAllPlayedWords(placedMoves, board, mainWordDirection) {
    if (!placedMoves || placedMoves.length === 0 || !board || !mainWordDirection) {
        console.warn("identifyAllPlayedWords: Invalid input (placedMoves, board, or mainWordDirection).");
        return [];
    }

    const allWords = []; // Stores arrays of {tile, r, c} objects for each identified word.
    const mainWordCandidateTiles = []; // To build the main word.

    // 1. Identify the Main Word
    // Sort the newly placed moves to easily find the start and end of the main line of play.
    const sortedPlacedMoves = [...placedMoves].sort((a, b) =>
        mainWordDirection === 'horizontal' ? a.to.col - b.to.col : a.to.row - b.to.row
    );
    const firstNewTileInLine = sortedPlacedMoves[0]; // First newly placed tile in the main direction.
    let scanR = firstNewTileInLine.to.row;
    let scanC = firstNewTileInLine.to.col;

    // Scan backward from the first new tile to find the actual beginning of the main word (could include existing tiles).
    if (mainWordDirection === 'horizontal') {
        while (scanC > 0 && board.grid[scanR][scanC - 1].tile) scanC--;
    } else { // Vertical
        while (scanR > 0 && board.grid[scanR - 1][scanC].tile) scanR--;
    }

    // Scan forward from the actual start to collect all tiles in the main word.
    let currentR = scanR;
    let currentC = scanC;
    if (mainWordDirection === 'horizontal') {
        while (currentC < board.size && board.grid[currentR][currentC].tile) {
            mainWordCandidateTiles.push({ tile: board.grid[currentR][currentC].tile, r: currentR, c: currentC });
            currentC++;
        }
    } else { // Vertical
        while (currentR < board.size && board.grid[currentR][scanC].tile) {
            mainWordCandidateTiles.push({ tile: board.grid[currentR][scanC].tile, r: currentR, c: scanC });
            currentR++;
        }
    }

    // Add the main word if it's longer than one letter, or if it's a single-letter play (e.g. first turn).
    // A single letter placed might not be a "word" in itself but could form cross words.
    // The `calculateWordScore` function might handle single letter scores differently.
    if (mainWordCandidateTiles.length > 1) {
         allWords.push(mainWordCandidateTiles);
    } else if (placedMoves.length === 1 && mainWordCandidateTiles.length === 1) {
        // If only one tile was placed, and it forms a "word" of length 1 in the main direction.
        // This is usually only relevant for scoring if it also forms cross-words or is the first turn.
        // The game rules (via validatePlacement) ensure it connects or is on center.
        allWords.push(mainWordCandidateTiles); // Add it; scoring will determine its value.
    }


    // 2. Identify Cross-Words
    // For each newly placed tile, check if it forms a new word in the perpendicular direction.
    const crossDirection = mainWordDirection === 'horizontal' ? 'vertical' : 'horizontal';
    for (const move of placedMoves) { // Iterate through each of the *newly placed* tiles
        const crossWordCandidateTiles = [];
        let crossScanR = move.to.row;
        let crossScanC = move.to.col;

        // Scan backward from the new tile's position in the cross-direction.
        if (crossDirection === 'horizontal') {
            while (crossScanC > 0 && board.grid[crossScanR][crossScanC - 1].tile) crossScanC--;
        } else { // Vertical
            while (crossScanR > 0 && board.grid[crossScanR - 1][crossScanC].tile) crossScanR--;
        }

        // Scan forward to collect all tiles in the potential cross-word.
        let currentCrossR = crossScanR;
        let currentCrossC = crossScanC;
        if (crossDirection === 'horizontal') {
            while (currentCrossC < board.size && board.grid[currentCrossR][currentCrossC].tile) {
                crossWordCandidateTiles.push({ tile: board.grid[currentCrossR][currentCrossC].tile, r: currentCrossR, c: currentCrossC });
                currentCrossC++;
            }
        } else { // Vertical
            while (currentCrossR < board.size && board.grid[currentCrossR][crossScanC].tile) {
                crossWordCandidateTiles.push({ tile: board.grid[currentCrossR][crossScanC].tile, r: currentCrossR, c: crossScanC });
                currentCrossR++;
            }
        }

        // Add the cross-word if it's longer than one letter.
        if (crossWordCandidateTiles.length > 1) {
            // Avoid duplicating the main word if it was identified as a cross-word (can happen if main word is short).
            // A simple check is by content and start position/direction.
            // However, a robust check for full duplication (same tiles, same positions) is better.
            let isDuplicateOfMain = false;
            if (allWords.length > 0 && allWords[0].length === crossWordCandidateTiles.length) {
                isDuplicateOfMain = allWords[0].every((mainTilePos, idx) =>
                    mainTilePos.r === crossWordCandidateTiles[idx].r && mainTilePos.c === crossWordCandidateTiles[idx].c
                );
            }
            if (!isDuplicateOfMain) {
                 allWords.push(crossWordCandidateTiles);
            }
        }
    }
    // TODO: Ensure no duplicate words are added if multiple new tiles extend the same cross-word.
    // Current logic might add the same cross-word multiple times if several new tiles fall into it.
    // A final deduplication step on `allWords` based on content and start/end coordinates might be needed.
    // For now, `calculateWordScore` might effectively handle this if bonuses are only counted once per square.
    return allWords;
}


/**
 * Calculates the total score for a turn based on all words formed and bonuses.
 *
 * @param {Array<Array<{tile: Tile, r: number, c: number}>>} words
 *        An array of all words formed in the turn. Each word is an array of tile-position objects.
 * @param {Board} board - The game board (used to check bonus squares and their 'used' status).
 * @param {Array<{tileRef: Tile, to: {row: number, col: number}}>} placedMoves
 *        The specific tiles that were newly placed in this turn. Used to determine which bonuses apply.
 * @param {object} gameSettings - The game's settings object, containing tile values and bonus amounts.
 * @returns {{score: number, usedBonusSquares: Array<{r: number, c: number}>}}
 *          An object containing the total `score` for the turn and an array `usedBonusSquares`
 *          listing coordinates of bonus squares that were applied in this turn.
 */
function calculateWordScore(words, board, placedMoves, gameSettings) {
    let totalTurnScore = 0;
    const bonusSquaresActivatedThisTurn = []; // Tracks {r, c} of bonuses applied in this turn.
    const effectiveTileValues = gameSettings.tileValues || DEFAULT_TILE_VALUES;
    const sevenTilePlayBonus = gameSettings.sevenTileBonus || 50;

    for (const wordTilePositions of words) { // Iterate through each word formed
        let currentWordRawScore = 0; // Sum of letter values for this word
        let wordMultiplier = 1;      // Overall multiplier for this word (from DW, TW squares)
        let containsNewlyPlacedTile = false; // Flag: does this word use any of the `placedMoves`?

        for (const { tile, r, c } of wordTilePositions) { // Iterate through each tile in the current word
            const square = board.grid[r][c];
            let letterScore = tile.isBlank ? 0 : (effectiveTileValues[tile.letter.toUpperCase()] || 0);

            // Check if this tile at (r,c) is one of the tiles newly placed in this turn
            const isNewlyPlacedThisTurn = placedMoves.some(move => move.to.row === r && move.to.col === c);
            if (isNewlyPlacedThisTurn) {
                containsNewlyPlacedTile = true;
                // Apply letter/word bonuses only if the tile is newly placed and bonus hasn't been used
                if (!square.bonusUsed) {
                    switch (square.bonus) {
                        case BONUS_TYPES.DL:
                            letterScore *= 2;
                            bonusSquaresActivatedThisTurn.push({ r, c }); // Mark for setting bonusUsed later
                            break;
                        case BONUS_TYPES.TL:
                            letterScore *= 3;
                            bonusSquaresActivatedThisTurn.push({ r, c });
                            break;
                        case BONUS_TYPES.DW:
                            wordMultiplier *= 2;
                            bonusSquaresActivatedThisTurn.push({ r, c });
                            break;
                        case BONUS_TYPES.TW:
                            wordMultiplier *= 3;
                            bonusSquaresActivatedThisTurn.push({ r, c });
                            break;
                    }
                }
            }
            currentWordRawScore += letterScore;
        }

        // Add score for this word to total, applying word multiplier(s).
        // Standard Scrabble rules: if a word is formed that consists *only* of pre-existing tiles
        // (e.g. placing a tile adjacent to an existing word, forming a new word perpendicular to it,
        // but the original word itself is not extended), that pre-existing word is NOT re-scored.
        // The `containsNewlyPlacedTile` flag helps ensure we only score words that are new or extended by the current play.
        if (containsNewlyPlacedTile) {
            totalTurnScore += (currentWordRawScore * wordMultiplier);
        }
        // If a word from `words` array somehow does not contain any newly placed tile, it implies an issue
        // with `identifyAllPlayedWords` or a very unusual board state. Standardly, it shouldn't score.
    }

    // Add bonus for playing all tiles from rack (e.g., a "Bingo" or "Scrabble")
    if (placedMoves.length === (gameSettings.rackSize || RACK_SIZE)) {
        totalTurnScore += sevenTilePlayBonus;
    }

    // Deduplicate bonus squares that might have been part of multiple words (e.g., intersection)
    const uniqueBonusesToMarkUsed = bonusSquaresActivatedThisTurn.filter((item, index, self) =>
        index === self.findIndex((t) => t.r === item.r && t.c === item.c)
    );

    return { score: totalTurnScore, usedBonusSquares: uniqueBonusesToMarkUsed };
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
    const urlSeed = isFirstTurnByP1 ? currentGame.randomSeed : null;
    const urlSettings = isFirstTurnByP1 ? currentGame.settings : null;
    // The `null` for turnData indicates no word was played. The `""` for exchangeData signifies a pass.
    const turnURL = generateTurnURL(currentGame.gameId, currentGame.turnNumber, null, urlSeed, urlSettings, "");

    const turnUrlInput = document.getElementById('turn-url');
    if (turnUrlInput) {
        turnUrlInput.value = turnURL;
        // turnUrlInput.placeholder = "Share this URL with the other player."; // Placeholder might be less useful if value always set
        console.log("Pass Turn URL generated:", turnURL);
    }

    showPostMoveModal(0, turnURL); // Show modal (0 points for pass)
    saveGameStateToLocalStorage(currentGame); // Save the new game state
    fullRender(currentGame, localPlayerId); // Refresh the UI
    updateControlButtonsVisibility(); // Update button states for the new turn
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
    const urlSeed = isFirstTurnByP1 ? currentGame.randomSeed : null;
    const urlSettings = isFirstTurnByP1 ? currentGame.settings : null;
    const turnURL = generateTurnURL(currentGame.gameId, currentGame.turnNumber, null, urlSeed, urlSettings, urlExchangeIndicesString);

    const turnUrlInput = document.getElementById('turn-url');
    if (turnUrlInput) {
        turnUrlInput.value = turnURL;
        console.log("Exchange Turn URL generated:", turnURL);
    }

    // Cleanup and UI updates
    selectedTilesForExchange = [];
    isExchangeModeActive = false;
    updateControlButtonsVisibility();
    showPostMoveModal(0, turnURL); // 0 points for exchange
    saveGameStateToLocalStorage(currentGame);
    fullRender(currentGame, localPlayerId);
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

/**
 * Generates a shareable URL representing the current game turn or setup.
 * Includes game ID, turn number, and data specific to the action (play, exchange, pass).
 * For the first turn by Player 1, it also includes the game seed and any custom settings.
 *
 * @param {string} gameId - The unique ID of the game.
 * @param {number} turnNumber - The current turn number.
 * @param {?object} turnData - Data about a word play (word, location, blanks). Null for pass/exchange.
 *                             Expected structure: { word: string, start_row: number, start_col: number,
 *                                                 direction: string, blanks_info: Array<{idx: number, al: string}> }
 * @param {?number} [seed=null] - The game's random seed. Only included for P1's first turn URL.
 * @param {?object} [settings=null] - Custom game settings. Only included for P1's first turn URL.
 * @param {?string} [exchangeData=null] - Data about tile exchange.
 *                                       Empty string ("") for a pass, or comma-separated indices for exchanged tiles.
 *                                       Null if the turn is a word play.
 * @returns {string} The generated turn URL.
 */
function generateTurnURL(gameId, turnNumber, turnData, seed = null, settings = null, exchangeData = null) {
    const baseURL = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    params.append('gid', gameId); // Game ID
    params.append('tn', turnNumber); // Turn Number

    // Determine effective seed and settings, primarily for P1's first turn.
    // This logic ensures that if P1 passes or exchanges on their very first move,
    // the seed and settings are still included in that first URL.
    let effectiveSeed = seed;
    let effectiveSettings = settings;

    if (turnNumber === 1 && localPlayerId === 'player1') {
        effectiveSeed = currentGame.randomSeed; // Always use current game's seed for P1, Turn 1
        if (effectiveSettings === null) { // If settings weren't explicitly passed (e.g. for pass/exchange)
            effectiveSettings = currentGame.settings; // Use current game's settings
        }
    }

    // Append seed if it's determined to be included (P1, Turn 1 or explicitly passed)
    if (effectiveSeed !== null) {
        params.append('seed', effectiveSeed);
    }

    // Append game settings to URL only for the very first turn URL generated by Player 1.
    // This allows Player 2 to initialize the game with the correct custom settings.
    if (effectiveSettings && turnNumber === 1 && localPlayerId === 'player1') {
        // Dictionary settings
        if (effectiveSettings.dictionaryType && effectiveSettings.dictionaryType !== 'permissive') {
            params.append('dt', effectiveSettings.dictionaryType); // dt = dictionaryType
            if (effectiveSettings.dictionaryType === 'custom' && effectiveSettings.dictionaryUrl) {
                params.append('du', effectiveSettings.dictionaryUrl); // du = dictionaryUrl
            }
        }
        // Custom game rule settings (only if they differ from defaults to keep URL shorter)
        if (effectiveSettings.letterDistribution && JSON.stringify(effectiveSettings.letterDistribution) !== JSON.stringify(DEFAULT_LETTER_DISTRIBUTION)) {
            params.append('ld', JSON.stringify(effectiveSettings.letterDistribution)); // ld = letterDistribution
        }
        if (effectiveSettings.tileValues && JSON.stringify(effectiveSettings.tileValues) !== JSON.stringify(DEFAULT_TILE_VALUES)) {
            params.append('tv', JSON.stringify(effectiveSettings.tileValues)); // tv = tileValues
        }
        if (effectiveSettings.blankTileCount !== undefined && effectiveSettings.blankTileCount !== 2) { // Default is 2
            params.append('bc', effectiveSettings.blankTileCount); // bc = blankTileCount
        }
        if (effectiveSettings.sevenTileBonus !== undefined && effectiveSettings.sevenTileBonus !== 50) { // Default is 50
            params.append('sb', effectiveSettings.sevenTileBonus); // sb = sevenTileBonus
        }
        if (effectiveSettings.customBoardLayout && Array.isArray(effectiveSettings.customBoardLayout)) {
            const cblString = effectiveSettings.customBoardLayout.join(','); // cbl = customBoardLayout
            params.append('cbl', cblString);
        }
        // Player names if customized
        if (effectiveSettings.playerNames) {
            if (effectiveSettings.playerNames.player1 && effectiveSettings.playerNames.player1 !== "Player 1") {
                params.append('p1n', effectiveSettings.playerNames.player1); // p1n = player1Name
            }
            if (effectiveSettings.playerNames.player2 && effectiveSettings.playerNames.player2 !== "Player 2") {
                params.append('p2n', effectiveSettings.playerNames.player2); // p2n = player2Name
            }
        }
    }

    // Append action-specific data: exchange, pass, or word play
    if (exchangeData !== null) { // Indicates an exchange or pass
        params.append('ex', exchangeData); // `ex` parameter: "" for pass, "idx1,idx2" for exchange
    } else if (turnData && turnData.word) { // Indicates a word play
        params.append('wl', `${turnData.start_row}.${turnData.start_col}`); // wl = wordLocation (r.c)
        // 'wd' (word direction) was removed from URL params as per previous requirements.
        // The word itself is now split into 'wh' or 'wv'.
        if (turnData.direction === 'horizontal') {
            params.append('wh', turnData.word); // wh = wordHorizontal
        } else if (turnData.direction === 'vertical') {
            params.append('wv', turnData.word); // wv = wordVertical
        }
        if (turnData.blanks_info && turnData.blanks_info.length > 0) {
            // bt = blankTiles (idx:assignedLetter;...)
            params.append('bt', turnData.blanks_info.map(bi => `${bi.idx}:${bi.al}`).join(';'));
        }
        // 'w' (full word string) was also removed.
    }
    // Note: A turn is exclusively a play, pass, or exchange. Parameters should reflect this.
    return `${baseURL}?${params.toString()}`;
}

/**
 * Initializes a new local game from scratch (not from URL).
 * - Creates a new GameState with a random seed and default settings.
 * - Sets the local player as 'player1'.
 * - Saves and renders the new game.
 */
function initializeNewGame() {
    const gameId = `game-${Date.now()}`; // Simple unique game ID
    const randomSeed = Math.floor(Math.random() * 1000000); // Generate a new random seed
    currentGame = new GameState(gameId, randomSeed, {}); // Use default settings
    localPlayerId = 'player1'; // This browser initiates as Player 1
    console.log("New local game initialized by this browser (as Player 1):", currentGame);

    saveGameStateToLocalStorage(currentGame);
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
        const defaultDictRadio = document.querySelector('input[name="dictionaryType"][value="permissive"]');
        if (defaultDictRadio) defaultDictRadio.checked = true;

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
    const selectedDictionaryType = document.querySelector('input[name="dictionaryType"]:checked').value;
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
        dictionaryUrl: customDictionaryUrl
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
    const randomSeed = Math.floor(Math.random() * 1000000);
    currentGame = new GameState(gameId, randomSeed, collectedGameSettings);
    localPlayerId = 'player1'; // User starting a new game with settings is Player 1

    console.log("New game started with custom settings (as Player 1):", collectedGameSettings, currentGame);
    saveGameStateToLocalStorage(currentGame);
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
/** Prefix for keys used to store game states in LocalStorage. */
const LOCAL_STORAGE_KEY_PREFIX = "crosswordGame_";

/**
 * Saves the current game state to LocalStorage.
 * Serializes complex objects like Board, Player racks, and Bag into a storable format.
 * @param {GameState} gameState - The game state object to save.
 * @param {Storage} [storage=localStorage] - The storage object to use (defaults to browser's localStorage).
 *                                           Allows for mock storage in testing.
 */
function saveGameStateToLocalStorage(gameState, storage = localStorage) {
    if (!gameState || !gameState.gameId) {
        console.error("saveGameStateToLocalStorage: Cannot save game state - invalid gameState or gameId missing.");
        return;
    }
    try {
        // Create a serializable representation of the game state.
        // This involves mapping complex objects (like Player racks, Bag, Board grid)
        // to simpler structures that can be JSON.stringified.
        const serializableState = {
            gameId: gameState.gameId,
            randomSeed: gameState.randomSeed,
            settings: gameState.settings, // Settings are assumed to be serializable (JSON-like)
            turnNumber: gameState.turnNumber,
            currentPlayerIndex: gameState.currentPlayerIndex,
            isGameOver: gameState.isGameOver,
            gameHistory: gameState.gameHistory, // Assumed serializable
            players: gameState.players.map(player => ({ // Serialize each player
                id: player.id,
                name: player.name,
                score: player.score,
                rack: player.rack.map(tile => ({ // Serialize each tile in the rack
                    letter: tile.letter,
                    value: tile.value,
                    isBlank: tile.isBlank,
                    assignedLetter: tile.assignedLetter,
                    id: tile.id
                }))
            })),
            bag: gameState.bag.map(tile => ({ // Serialize each tile in the bag
                letter: tile.letter,
                value: tile.value,
                isBlank: tile.isBlank,
                assignedLetter: tile.assignedLetter,
                id: tile.id
            })),
            boardGrid: gameState.board.grid.map(row => row.map(square => ({ // Serialize board grid
                row: square.row,
                col: square.col,
                bonus: square.bonus,
                bonusUsed: square.bonusUsed,
                tile: square.tile ? { // Serialize tile on square, if any
                    letter: square.tile.letter,
                    value: square.tile.value,
                    isBlank: square.tile.isBlank,
                    assignedLetter: square.tile.assignedLetter,
                    id: square.tile.id
                } : null
            }))),
            savedLocalPlayerId: localPlayerId // Persist which player this browser instance represents for this game
        };
        storage.setItem(LOCAL_STORAGE_KEY_PREFIX + gameState.gameId, JSON.stringify(serializableState));
        console.log(`Game ${gameState.gameId} (for local player ${localPlayerId}) saved to ${storage === localStorage ? 'localStorage' : 'mockStorage'}.`);
    } catch (error) {
        console.error("Error saving game state to LocalStorage:", error);
        // Consider alerting the user or providing feedback if saving fails.
    }
}

/**
 * Loads a game state from LocalStorage by game ID.
 * Rehydrates the game state, reconstructing Tile, Square, Board, and Player objects.
 * @param {string} gameId - The ID of the game to load.
 * @param {Storage} [storage=localStorage] - The storage object to use (defaults to browser's localStorage).
 * @returns {?GameState} The rehydrated GameState object, or null if not found or error occurs.
 */
function loadGameStateFromLocalStorage(gameId, storage = localStorage) {
    if (!gameId) {
        console.warn("loadGameStateFromLocalStorage: No gameId provided to load.");
        return null;
    }
    try {
        const storedDataString = storage.getItem(LOCAL_STORAGE_KEY_PREFIX + gameId);
        if (!storedDataString) {
            console.log(`No game data found for gameId "${gameId}" in ${storage === localStorage ? 'localStorage' : 'mockStorage'}.`);
            return null;
        }
        const storedData = JSON.parse(storedDataString);

        // Create a new GameState instance. Settings are passed directly.
        // The GameState constructor handles defaults for settings not present in storedData.settings.
        const rehydratedGame = new GameState(storedData.gameId, storedData.randomSeed, storedData.settings || {});

        // Restore scalar properties
        rehydratedGame.turnNumber = storedData.turnNumber;
        rehydratedGame.currentPlayerIndex = storedData.currentPlayerIndex;
        rehydratedGame.isGameOver = storedData.isGameOver;
        rehydratedGame.gameHistory = storedData.gameHistory || []; // Default to empty array if not present

        // Restore the localPlayerId for this browser instance for this game.
        // This is crucial for UI behavior and turn synchronization.
        // This assignment affects the global `localPlayerId`.
        localPlayerId = storedData.savedLocalPlayerId || 'player1'; // Default to 'player1' if not saved

        // Rehydrate players (scores, racks)
        if (storedData.players && storedData.players.length === rehydratedGame.players.length) {
            storedData.players.forEach((playerData, index) => {
                const gamePlayer = rehydratedGame.players[index];
                gamePlayer.score = playerData.score;
                // gamePlayer.id and gamePlayer.name are set by GameState constructor based on settings.playerNames
                // If they need to be overridden from storage (e.g. if names could change mid-game and be saved):
                // gamePlayer.id = playerData.id || gamePlayer.id;
                // gamePlayer.name = playerData.name || gamePlayer.name;
                gamePlayer.rack = playerData.rack.map(tileData => {
                    const tile = new Tile(tileData.letter, tileData.value, tileData.isBlank);
                    tile.assignedLetter = tileData.assignedLetter;
                    tile.id = tileData.id; // Restore original tile ID
                    return tile;
                });
            });
        }

        // Rehydrate the tile bag
        rehydratedGame.bag = storedData.bag.map(tileData => {
            const tile = new Tile(tileData.letter, tileData.value, tileData.isBlank);
            tile.assignedLetter = tileData.assignedLetter;
            tile.id = tileData.id; // Restore original tile ID
            return tile;
        });

        // Rehydrate the board grid with Square and Tile objects
        // The Board object itself is already created by the GameState constructor. We just need to fill its grid.
        if (storedData.boardGrid && rehydratedGame.board && rehydratedGame.board.grid) {
            for (let r = 0; r < storedData.boardGrid.length; r++) {
                if (rehydratedGame.board.grid[r]) { // Ensure row exists in the rehydrated board
                    for (let c = 0; c < storedData.boardGrid[r].length; c++) {
                        if (rehydratedGame.board.grid[r][c]) { // Ensure square exists
                            const savedSquareData = storedData.boardGrid[r][c];
                            const boardSquare = rehydratedGame.board.grid[r][c]; // The Square instance from new Board()

                            // Restore bonus type and used status (these are set by Board constructor based on layout,
                            // but bonusUsed can change, so restore it).
                            // Bonus type itself should ideally not change from initial layout, but restoring defensively.
                            boardSquare.bonus = savedSquareData.bonus;
                            boardSquare.bonusUsed = savedSquareData.bonusUsed;

                            if (savedSquareData.tile) { // If there was a tile on this square
                                const tileData = savedSquareData.tile;
                                const tile = new Tile(tileData.letter, tileData.value, tileData.isBlank);
                                tile.assignedLetter = tileData.assignedLetter;
                                tile.id = tileData.id; // Restore original tile ID
                                boardSquare.tile = tile; // Place rehydrated Tile object on the Square
                            } else {
                                boardSquare.tile = null; // Ensure square is empty if saved as such
                            }
                        }
                    }
                }
            }
        }
        console.log(`Game ${gameId} loaded and rehydrated from ${storage === localStorage ? 'localStorage' : 'mockStorage'}. Local player is ${localPlayerId}.`);
        return rehydratedGame;
    } catch (error) {
        console.error(`Error loading or rehydrating game state for gameId "${gameId}":`, error);
        return null;
    }
}

// --- Game Initialization and URL Processing ---

/**
 * Applies turn data from a URL to the provided game state.
 * This function is called when a player loads a URL from their opponent,
 * effectively replaying the opponent's last move on the current player's client.
 * It handles three types of turns: word play, tile exchange, or pass.
 *
 * @param {GameState} gameState - The current game state object to be modified.
 * @param {URLSearchParams} params - The URLSearchParams object parsed from the turn URL.
 * @returns {boolean} True if turn data was successfully applied, false otherwise (e.g., error, desync).
 */
function applyTurnDataFromURL(gameState, params) {
    const exchangeParam = params.get('ex');
    // playerWhoseTurnItWas is the player who *just finished* their turn and sent the URL.
    // When applying this URL, this player's index in the `gameState.players` array needs to be
    // determined based on the `gameState.currentPlayerIndex` *before* it's advanced.
    // If `currentPlayerIndex` is P0, then P1 made the move. If P1, then P0 made the move.
    // This seems to be handled by the caller (`loadGameFromURLOrStorage`) which sets currentPlayerIndex
    // *after* calling this function. So, here `gameState.getCurrentPlayer()` should still be the one who made the move.
    const playerWhoseTurnItWas = gameState.getCurrentPlayer();

    if (exchangeParam !== null) { // Turn was a pass or exchange
        if (exchangeParam === "") { // Pass action
            console.log(`Applying turn data: Player ${playerWhoseTurnItWas.name} passed.`);
            // No game state changes beyond turn/player index, which is handled by caller.
            return true;
        } else { // Exchange action
            console.log(`Applying turn data: Player ${playerWhoseTurnItWas.name} exchanged tiles. Indices from their rack: ${exchangeParam}.`);
            const indicesToExchange = exchangeParam.split(',')
                .map(s => parseInt(s.trim()))
                .filter(n => !isNaN(n) && n >= 0 && n < playerWhoseTurnItWas.rack.length); // Validate against current rack size

            const uniqueIndices = [...new Set(indicesToExchange)].sort((a, b) => b - a); // Descending for splice

            if (uniqueIndices.length === 0 && exchangeParam !== "") { // exchangeParam might be "0" which is valid
                console.error("applyTurnDataFromURL (Exchange): No valid tile indices to apply from URL for player " + playerWhoseTurnItWas.name);
                return false;
            }
            if (gameState.bag.length < uniqueIndices.length) {
                console.error(`applyTurnDataFromURL (Exchange) for ${playerWhoseTurnItWas.name}: Not enough tiles in bag (${gameState.bag.length}) to exchange ${uniqueIndices.length} tile(s) as per URL.`);
                return false;
            }

            // Simulate the exchange: remove from player's rack, add to bag, draw new, shuffle bag.
            const tilesSetAside = [];
            for (const index of uniqueIndices) {
                if (playerWhoseTurnItWas.rack[index]) { // Ensure tile exists at index
                    tilesSetAside.push(playerWhoseTurnItWas.rack.splice(index, 1)[0]);
                } else {
                    console.error(`applyTurnDataFromURL (Exchange): Invalid index ${index} for ${playerWhoseTurnItWas.name}'s rack during exchange simulation.`);
                    // This indicates a desync or bad URL. Attempt to revert rack changes and fail.
                    tilesSetAside.forEach(t => playerWhoseTurnItWas.rack.push(t)); // Put back any already removed.
                    playerWhoseTurnItWas.rack.sort((a,b) => Math.random() - 0.5); // Basic re-shuffle of rack to avoid predictable state.
                    return false;
                }
            }

            // If the number of tiles actually set aside doesn't match, it's an error.
            if (tilesSetAside.length !== uniqueIndices.length && uniqueIndices.length > 0) { // added uniqueIndices.length > 0
                 console.error(`applyTurnDataFromURL (Exchange) logic mismatch for ${playerWhoseTurnItWas.name}: Tried to exchange ${uniqueIndices.length}, but only set aside ${tilesSetAside.length}.`);
                 // Attempt to restore rack state before failing.
                 tilesSetAside.forEach(t => playerWhoseTurnItWas.rack.push(t));
                 // A proper re-sort or re-insertion to original positions would be complex here.
                 // For now, just add them back and log error.
                 return false;
            }

            gameState.drawTiles(playerWhoseTurnItWas, tilesSetAside.length); // Player draws new tiles
            tilesSetAside.forEach(tile => { // Return exchanged tiles to bag
                if (tile.isBlank) tile.assignedLetter = null; // Reset blank
                gameState.bag.push(tile);
            });
            gameState._shuffleBag(); // Shuffle bag after adding tiles
            console.log(`Applied exchange for ${playerWhoseTurnItWas.name}. New rack size: ${playerWhoseTurnItWas.rack.length}, Bag size: ${gameState.bag.length}`);
            return true;
        }
    }

    // If not an exchange/pass, it must be a word play.
    let wordStrFromURL = null;
    let wordDirection = null;
    const wordLocation = params.get('wl'); // Format "row.col"
    const blankTileData = params.get('bt');  // Format "idx:AssignedLetter;idx2:AL2"

    // Word string is now in 'wh' (wordHorizontal) or 'wv' (wordVertical)
    const whParam = params.get('wh');
    const wvParam = params.get('wv');

    if (whParam !== null) {
        wordStrFromURL = whParam;
        wordDirection = 'horizontal';
    } else if (wvParam !== null) {
        wordStrFromURL = wvParam;
        wordDirection = 'vertical';
    }

    // If it's a word play, all necessary parameters must be present.
    if (wordStrFromURL && wordLocation && wordDirection) {
        console.log(`Applying word play from URL: "${wordStrFromURL}" at ${wordLocation}, direction: ${wordDirection} for player ${playerWhoseTurnItWas.name}`);
        const [startRowStr, startColStr] = wordLocation.split('.');
        const startRow = parseInt(startRowStr);
        const startCol = parseInt(startColStr);

        if (isNaN(startRow) || isNaN(startCol)) {
            console.error("applyTurnDataFromURL (Word Play): Invalid word location format in URL:", wordLocation);
            return false;
        }

        // Parse blank tile information from URL
        const blanksInWord = new Map(); // Stores { indexInWordString -> assignedLetter }
        if (blankTileData) {
            blankTileData.split(';').forEach(item => {
                const [idxStr, assignedLetter] = item.split(':');
                blanksInWord.set(parseInt(idxStr), assignedLetter.toUpperCase());
            });
        }

        const newlyPlacedTilesData = []; // To store {tileRef, to} for tiles placed in this turn from URL data

        // Iterate through the word string from URL to place/verify tiles on the board
        for (let i = 0; i < wordStrFromURL.length; i++) {
            const charFromWord = wordStrFromURL[i].toUpperCase();
            let r = startRow;
            let c = startCol;
            if (wordDirection === 'horizontal') c += i;
            else r += i; // Vertical

            if (!gameState.board.grid[r] || !gameState.board.grid[r][c]) {
                console.error(`applyTurnDataFromURL (Word Play): Invalid square coordinates (${r},${c}) for word placement from URL.`);
                return false; // Board desync or invalid URL
            }

            const boardSquare = gameState.board.grid[r][c];
            if (!boardSquare.tile) { // Square is empty, this tile must be newly placed by the opponent
                const isBlankPlacement = blanksInWord.has(i);
                const assignedLetterForBlank = isBlankPlacement ? blanksInWord.get(i) : null;
                const tileLetter = isBlankPlacement ? '' : charFromWord;
                // Determine tile value from game settings (or default if char not found, though unlikely for valid letters)
                const tileValue = isBlankPlacement ? (gameState.settings.tileValues['_'] !== undefined ? gameState.settings.tileValues['_'] : 0)
                                              : (gameState.settings.tileValues[charFromWord] || 0);

                const newTile = new Tile(tileLetter, tileValue, isBlankPlacement);
                if (isBlankPlacement) newTile.assignedLetter = assignedLetterForBlank;

                boardSquare.tile = newTile; // Place the new tile on the board
                newlyPlacedTilesData.push({ tileRef: newTile, to: { row: r, col: c } });
            } else {
                // Square has an existing tile. Verify it matches the character from the URL's word string.
                const existingTileOnBoard = boardSquare.tile;
                const expectedLetterOnBoard = existingTileOnBoard.isBlank ?
                    existingTileOnBoard.assignedLetter.toUpperCase() :
                    existingTileOnBoard.letter.toUpperCase();

                if (expectedLetterOnBoard !== charFromWord) {
                    console.error(`applyTurnDataFromURL (Word Play): Mismatch at (${r},${c}). Board has ${expectedLetterOnBoard}, URL implies ${charFromWord}. Game desync.`);
                    return false;
                }
                // If it's a blank tile already on board, verify its assigned letter matches if specified in URL's blank data.
                if (existingTileOnBoard.isBlank && blanksInWord.has(i) &&
                    existingTileOnBoard.assignedLetter.toUpperCase() !== blanksInWord.get(i)) {
                     console.error(`applyTurnDataFromURL (Word Play): Mismatch for blank tile assignment at (${r},${c}). Board: ${existingTileOnBoard.assignedLetter}, URL: ${blanksInWord.get(i)}`);
                     return false;
                }
                // If existing tile matches, it's part of the word but not "newly placed" by *this specific turn's URL data*.
                // `newlyPlacedTilesData` only includes tiles that were empty before this URL application.
            }
        }

        // Score the turn based on the board state and the newly placed tiles identified from URL.
        const allWordsFormedByOpponent = identifyAllPlayedWords(newlyPlacedTilesData, gameState.board, wordDirection);

        if (allWordsFormedByOpponent.length === 0 && newlyPlacedTilesData.length > 0) {
            console.warn("applyTurnDataFromURL (Word Play): No words identified for scoring from URL-placed tiles, though tiles were placed.");
        }

        const scoreResult = calculateWordScore(allWordsFormedByOpponent, gameState.board, newlyPlacedTilesData, gameState.settings);
        playerWhoseTurnItWas.score += scoreResult.score; // Update score of the player who made the move
        console.log(`applyTurnDataFromURL (Word Play): Player ${playerWhoseTurnItWas.name} scored ${scoreResult.score} points. New total score: ${playerWhoseTurnItWas.score}`);

        // Mark used bonus squares on the board
        scoreResult.usedBonusSquares.forEach(sqCoord => {
            if (gameState.board.grid[sqCoord.r] && gameState.board.grid[sqCoord.r][sqCoord.c]) {
                gameState.board.grid[sqCoord.r][sqCoord.c].bonusUsed = true;
            }
        });

        // Simulate tile drawing for the player who made the move.
        // The number of tiles drawn is equal to the number of tiles they placed.
        const tilesPlayedCount = newlyPlacedTilesData.length;
        gameState.drawTiles(playerWhoseTurnItWas, tilesPlayedCount);
        console.log(`applyTurnDataFromURL (Word Play): Simulated drawing ${tilesPlayedCount} tiles for ${playerWhoseTurnItWas.name}. New rack size: ${playerWhoseTurnItWas.rack.length}. Bag size: ${gameState.bag.length}`);

        // Conflict resolution: If the local player had uncommitted tiles on squares now occupied by the opponent's move,
        // those local tiles must be returned to the local player's rack.
        if (gameState.currentTurnMoves && gameState.currentTurnMoves.length > 0) {
            const localPlayer = gameState.players.find(p => p.id === localPlayerId); // The player using this browser
            if (localPlayer && localPlayer !== playerWhoseTurnItWas) { // Check if it's not the same player
                console.log("applyTurnDataFromURL: Checking for conflicts with local player's uncommitted tiles...");
                for (let i = gameState.currentTurnMoves.length - 1; i >= 0; i--) {
                    const localMove = gameState.currentTurnMoves[i];
                    const r = localMove.to.row;
                    const c = localMove.to.col;
                    const boardSquare = gameState.board.grid[r][c]; // Current state of the square

                    // If the square now has a tile, and that tile is NOT the one from the local player's uncommitted move
                    // (i.e., it's a tile from the opponent's move just applied from the URL), then conflict.
                    if (boardSquare.tile && boardSquare.tile.id !== localMove.tileRef.id) {
                        console.log(`Conflict: Opponent's move at (${r},${c}) overrides local player's uncommitted tile ${localMove.tileRef.id}. Returning to local rack.`);
                        const tileToReturnToLocalRack = localMove.tileRef;
                        if (tileToReturnToLocalRack.isBlank) { // Reset blank if it was assigned
                            tileToReturnToLocalRack.assignedLetter = null;
                        }
                        localPlayer.rack.push(tileToReturnToLocalRack); // Add back to local player's data rack
                        gameState.currentTurnMoves.splice(i, 1); // Remove from local uncommitted moves
                    }
                }
            }
        }
        return true; // Word play successfully applied
    }

    // If no valid action (play, pass, exchange) was found in URL params.
    console.log("applyTurnDataFromURL: No actionable turn data found in URL parameters.");
    return false;
}


/**
 * Main function to load a game, either from URL parameters or from LocalStorage.
 * This function orchestrates the game setup or resumption process.
 * It determines if a game is being joined, continued, or started fresh.
 * @param {?string} [searchStringOverride=null] - Optional search string to use instead of `window.location.search`.
 *                                                Useful for testing or specific scenarios.
 */
function loadGameFromURLOrStorage(searchStringOverride = null) {
    const searchSource = searchStringOverride !== null ? searchStringOverride : window.location.search;
    const params = new URLSearchParams(searchSource);

    const urlGameId = params.get('gid');
    const urlTurnNumberStr = params.get('tn');
    const urlSeed = params.get('seed'); // For initializing a new game if P2 loads P1's first URL

    // --- Game Loading/Joining Logic ---
    if (urlGameId) { // A game ID is present in the URL
        console.log(`loadGameFromURLOrStorage: URL contains gameId: ${urlGameId}.`);
        currentGame = loadGameStateFromLocalStorage(urlGameId); // Attempt to load existing game

        if (currentGame) { // Game found in LocalStorage
            // `localPlayerId` is restored by `loadGameStateFromLocalStorage`
            console.log(`Game ${urlGameId} loaded from LocalStorage. This browser is ${localPlayerId}. LS Turn: ${currentGame.turnNumber}.`);

            if (urlTurnNumberStr) { // URL also specifies a turn number
                const urlTurnNumber = parseInt(urlTurnNumberStr);
                if (urlTurnNumber === currentGame.turnNumber + 1) { // URL represents the next turn
                    console.log(`Attempting to apply turn ${urlTurnNumber} from URL to local game.`);
                    if (applyTurnDataFromURL(currentGame, params)) {
                        // If applyTurnDataFromURL succeeded, update turn number and current player locally
                        currentGame.turnNumber = urlTurnNumber;
                        currentGame.currentPlayerIndex = (currentGame.currentPlayerIndex + 1) % currentGame.players.length;
                        saveGameStateToLocalStorage(currentGame); // Save updated state
                        console.log(`Successfully applied opponent's move from URL for turn ${urlTurnNumber}. New current player: ${currentGame.getCurrentPlayer().name}.`);
                    } else {
                        // applyTurnDataFromURL returned false, indicating an issue with applying the move data.
                        // This could be due to an error in the URL data or a desync.
                        alert("Failed to apply turn data from URL. The game state might be out of sync. Please check console for errors.");
                        // Game remains at its current state before attempting to apply URL turn.
                    }
                } else if (urlTurnNumber <= currentGame.turnNumber) {
                    console.log(`URL turn ${urlTurnNumber} is not newer than local game turn ${currentGame.turnNumber}. No action taken from URL turn data.`);
                } else { // urlTurnNumber > currentGame.turnNumber + 1
                    alert(`Out of sync: URL specifies turn ${urlTurnNumber}, but local game is at turn ${currentGame.turnNumber}. Load appropriate URL.`);
                    // Game state remains as loaded from LocalStorage.
                }
            }
            // If no urlTurnNumberStr, game is just loaded from storage, no URL turn to apply.
        } else { // Game not found in LocalStorage, but URL has gameId. This implies joining a new game.
            if (urlSeed) { // Seed is required to initialize a new game instance for P2
                console.log(`New game ${urlGameId} initiated from URL by Player 2 (seed: ${urlSeed}).`);
                const newGameSettings = {}; // Populate with settings from URL if P1 included them

                // Parse all possible game settings from URL (typically sent by P1 on first turn URL)
                const urlDictType = params.get('dt');
                if (urlDictType) newGameSettings.dictionaryType = urlDictType;
                const urlDictUrl = params.get('du');
                if (urlDictUrl) newGameSettings.dictionaryUrl = urlDictUrl;

                try {
                    const urlLetterDist = params.get('ld');
                    if (urlLetterDist) newGameSettings.letterDistribution = JSON.parse(urlLetterDist);
                    const urlTileVals = params.get('tv');
                    if (urlTileVals) newGameSettings.tileValues = JSON.parse(urlTileVals);
                } catch (e) { console.error("Error parsing JSON settings from URL (distribution/values):", e); }

                const urlBlankCount = params.get('bc');
                if (urlBlankCount !== null) newGameSettings.blankTileCount = parseInt(urlBlankCount);
                const urlSevenBonus = params.get('sb');
                if (urlSevenBonus !== null) newGameSettings.sevenTileBonus = parseInt(urlSevenBonus);

                const urlCbl = params.get('cbl');
                if (urlCbl) newGameSettings.customBoardLayout = urlCbl.split(',');

                const p1n = params.get('p1n'); const p2n = params.get('p2n');
                if (p1n || p2n) newGameSettings.playerNames = { player1: p1n || "Player 1", player2: p2n || "Player 2" };

                currentGame = new GameState(urlGameId, parseInt(urlSeed), newGameSettings);
                localPlayerId = 'player2'; // This browser is Player 2

                // If P1's first move is also in this URL (tn=1 and action data)
                if (urlTurnNumberStr && parseInt(urlTurnNumberStr) === 1 && (params.has('wh') || params.has('wv') || params.get('ex') !== null)) {
                    console.log("Applying Player 1's first move from setup URL.");
                    if(applyTurnDataFromURL(currentGame, params)) {
                        currentGame.turnNumber = 1; // Mark P1's turn as done
                        currentGame.currentPlayerIndex = 1; // It's now P2's turn
                    } else {
                        console.error("Failed to apply P1's first move data when P2 created game from URL.");
                        // Game is created, but P1's move wasn't applied. Might lead to desync.
                    }
                }
                // If tn=0 or no turn data, it's just game setup, P1 hasn't moved yet.
                // currentPlayerIndex remains 0 (P1's turn), turnNumber remains 0. (Handled by GameState constructor)
                saveGameStateToLocalStorage(currentGame); // Save this new game state for P2
            } else {
                 // No game in LocalStorage, and URL (with gameId) lacks a seed to start a new game.
                 alert(`Game ${urlGameId} not found locally, and URL is missing data to start it as a new participant (e.g., missing seed). Please get the initial game URL from Player 1.`);
                 document.getElementById('board-container').innerHTML = `<p>Error: Game ${urlGameId} could not be loaded or started. Ensure you have the correct initial URL from Player 1 if joining a new game.</p>`;
                 return; // Stop further processing
            }
        }
    } else { // No gameId in URL
        // Check if there's a "last played" game ID in a separate local storage item (optional feature, not implemented here)
        // For now, if no gameId in URL, initialize a brand new local game for testing/solo play.
        console.log("No gameId in URL. Initializing a new local game.");
        initializeNewGame(); // This sets `currentGame` and `localPlayerId`
        // No need to return here, the rest of the function will handle rendering if currentGame is set.
    }

    // --- Final Rendering and UI Update ---
    if (currentGame) {
        fullRender(currentGame, localPlayerId); // Render the game board, racks, status
    } else {
        // This case should ideally be handled by initializeNewGame or specific error messages above.
        // If still no currentGame, display a generic "no game" message.
        console.log("loadGameFromURLOrStorage: No game is active after processing URL/LocalStorage.");
        const boardContainer = document.getElementById('board-container');
        if (boardContainer) {
            boardContainer.innerHTML = '<p>Start a new game or load one via a shared URL.</p>';
        }
    }
    updateControlButtonsVisibility(); // Ensure button states are correct based on game state
}


/**
 * Main entry point: Sets up event listeners when the DOM is fully loaded.
 * Initializes or loads a game.
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing game and event listeners.");

    // Modal elements (cache them for reuse)
    const postMoveModalElement = document.getElementById('post-move-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    // Note: modalPointsEarnedSpan and modalCopyCheckbox are accessed within showPostMoveModal.

    // Load game from URL parameters or LocalStorage
    loadGameFromURLOrStorage();

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

    // Dictionary type radio buttons: show/hide custom URL input
    document.querySelectorAll('input[name="dictionaryType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            document.getElementById('custom-dictionary-url').style.display =
                (this.value === 'custom') ? 'block' : 'none';
        });
    });

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
                if (urlToCopyFromModal) {
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
});
