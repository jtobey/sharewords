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
// Inspired by Scrabble, but slightly different to meet requirements.
// Total tiles: 98 lettered + 2 blank = 100
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

/**
 * Represents a tile in the game.
 * @param {string} letter - The letter on the tile (or empty string for blank).
 * @param {number} value - The point value of the tile.
 * @param {boolean} isBlank - True if the tile is a blank tile.
 * @param {string | null} assignedLetter - The letter assigned to a blank tile after placement.
 */
function Tile(letter, value, isBlank = false) {
    this.letter = letter;
    this.value = value;
    this.isBlank = isBlank;
    this.assignedLetter = null; // Letter assigned if this is a blank tile and played
    this.id = `tile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; // Unique ID for tracking
}

/**
 * Represents a square on the game board.
 * @param {number} row - The row index of the square.
 * @param {number} col - The column index of the square.
 * @param {string} bonus - The bonus type of the square (e.g., BONUS_TYPES.DL).
 */
function Square(row, col, bonus = BONUS_TYPES.NONE) {
    this.row = row;
    this.col = col;
    this.bonus = bonus;
    this.tile = null; // Will hold a Tile object when one is placed here
    this.bonusUsed = false; // Tracks if the bonus has been applied
}

/**
 * Represents the game board.
 * @param {number} size - The size of the board (e.g., 15 for a 15x15 board).
 * @param {object} layout - Optional custom layout for bonus squares.
 */
function Board(size = BOARD_SIZE, layout = null) {
    this.size = size;
    this.grid = []; // 2D array of Square objects

    // Initialize grid
    for (let r = 0; r < size; r++) {
        this.grid[r] = [];
        for (let c = 0; c < size; c++) {
            // TODO: Implement default or custom bonus square layout
            let bonus = BONUS_TYPES.NONE;
            // Example: Center square (usually special, but not a bonus in Scrabble, handled by first play rule)
            // For now, all squares are plain. Bonus square logic will be added later.
            this.grid[r][c] = new Square(r, c, bonus);
        }
    }

    // Apply a default bonus layout if no custom layout is provided
    // This is a placeholder and needs to be defined based on game design
    if (!layout) {
        // Example: Mark center square for first play (though not a 'bonus' in scoring)
        // The actual bonus squares (DL, TL, DW, TW) need a proper layout.
        // For now, we'll add a few placeholders. This will be refined.
        // Let's assume (0,0), (0,7), (0,14), (7,0), (7,14), (14,0), (14,7), (14,14) are TW
        // And (1,1), (2,2), (3,3), (4,4) (and symmetric) are DW
        // And (0,3), (3,0) etc are TL
        // And (1,5), (5,1) etc are DL
        // This is just a very basic placeholder layout.
        const tw_coords = [[0,0], [0,7], [0,14], [7,0], [7,14], [14,0], [14,7], [14,14]];
        tw_coords.forEach(([r,c]) => this.grid[r][c].bonus = BONUS_TYPES.TW);
        // Simplified DW, TL, DL for now
        this.grid[1][1].bonus = BONUS_TYPES.DW; this.grid[13][13].bonus = BONUS_TYPES.DW;
        this.grid[1][13].bonus = BONUS_TYPES.DW; this.grid[13][1].bonus = BONUS_TYPES.DW;
        this.grid[2][6].bonus = BONUS_TYPES.TL; this.grid[2][8].bonus = BONUS_TYPES.TL;
        this.grid[6][2].bonus = BONUS_TYPES.TL; this.grid[8][2].bonus = BONUS_TYPES.TL;
        this.grid[3][7].bonus = BONUS_TYPES.DL; this.grid[7][3].bonus = BONUS_TYPES.DL;
    }
    // The center square needs to be identified for the first move, usually (7,7) for a 15x15 board.
    // This is distinct from score bonuses.
    this.getCenterSquare = function() {
        return this.grid[Math.floor(this.size / 2)][Math.floor(this.size / 2)];
    }
}

/**
 * Represents a player.
 * @param {string} id - Unique identifier for the player (e.g., "player1", "player2").
 * @param {string} name - Display name for the player.
 */
function Player(id, name) {
    this.id = id;
    this.name = name;
    this.rack = []; // Array of Tile objects, max RACK_SIZE
    this.score = 0;
}

/**
 * Represents the overall game state.
 * @param {string} gameId - Unique identifier for this game session.
 * @param {number} randomSeed - Seed for the PRNG.
 * @param {object} settings - Game settings (tile distribution, dictionary, etc.).
 */
function GameState(gameId, randomSeed, settings = {}) {
    this.gameId = gameId;
    this.randomSeed = randomSeed;
    this.settings = { // Default settings
        boardSize: BOARD_SIZE,
        rackSize: RACK_SIZE,
        blankTileCount: 2,
        sevenTileBonus: 50,
        dictionaryType: 'permissive', // 'permissive' or 'rfc2229'
        dictionaryUrl: null, // URL if dictionaryType is 'rfc2229'
        tileValues: settings.tileValues || DEFAULT_TILE_VALUES,
        letterDistribution: settings.letterDistribution || DEFAULT_LETTER_DISTRIBUTION,
        customBoardLayout: null, // To define bonus square positions
        ...settings // Override defaults with provided settings
    };

    // Initialize PRNG
    this.prng = Mulberry32(this.randomSeed);

    // Initialize Bag
    this._initializeBag = function() {
        this.bag = [];
        const distribution = this.settings.letterDistribution;
        const values = this.settings.tileValues;

        for (const letter in distribution) {  // jt: Nit: Why not for...of?
            if (distribution.hasOwnProperty(letter)) {
                for (let i = 0; i < distribution[letter]; i++) {
                    this.bag.push(new Tile(letter, values[letter] || 0));
                }
            }
        }
        // Add blank tiles
        for (let i = 0; i < this.settings.blankTileCount; i++) {
            this.bag.push(new Tile('', 0, true)); // Blank tiles have empty string for letter, 0 value, and isBlank=true
        }
    };

    this._shuffleBag = function() {
        if (!this.prng) {
            console.error("PRNG not initialized for shuffling.");
            // Fallback to Math.random if PRNG is somehow not set, though it should be.
            // This is not ideal for reproducible games but prevents a crash.
            for (let i = this.bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
            }
            return;
        }
        // Fisher-Yates shuffle using the seeded PRNG
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

    // Initialize Players
    this.players = [new Player("player1", "Player 1"), new Player("player2", "Player 2")];
    this.currentPlayerIndex = 0; // Index into this.players

    // Initialize Bag
    this.bag = []; // Initialize bag array before _initializeBag is called
    this._initializeBag();
    this._shuffleBag();

    // Initial draw for players
    this.players.forEach(player => {
        this.drawTiles(player, this.settings.rackSize);
    });

    // Initialize Board
    this.board = new Board(this.settings.boardSize, this.settings.customBoardLayout);

    this.turnNumber = 0;
    this.gameHistory = []; // Array to store turn data for replays or state checks
    this.isGameOver = false;

    this.getCurrentPlayer = function() {
        return this.players[this.currentPlayerIndex];
    };

    this.getOpponentPlayer = function() {
        return this.players[(this.currentPlayerIndex + 1) % 2];
    };
}

// Global game state variable (or manage through a game manager class)
let currentGame = null;
let localPlayerId = "player1"; // This will be set from localStorage later

// --- UI Rendering Functions ---

function renderBoard(gameState) {
    const boardContainer = document.getElementById('board-container');
    if (!boardContainer || !gameState || !gameState.board) {
        console.error("Cannot render board: missing container or gameState.");
        return;
    }
    boardContainer.innerHTML = ''; // Clear previous board
    boardContainer.style.gridTemplateColumns = `repeat(${gameState.board.size}, 30px)`;
    boardContainer.style.gridTemplateRows = `repeat(${gameState.board.size}, 30px)`;

    const centerR = Math.floor(gameState.board.size / 2);
    const centerC = Math.floor(gameState.board.size / 2);

    for (let r = 0; r < gameState.board.size; r++) {
        for (let c = 0; c < gameState.board.size; c++) {
            const squareData = gameState.board.grid[r][c];
            const squareDiv = document.createElement('div');
            squareDiv.classList.add('square');
            squareDiv.dataset.row = r;
            squareDiv.dataset.col = c;

            if (squareData.bonus !== BONUS_TYPES.NONE) {
                squareDiv.classList.add(squareData.bonus);
                // Optionally, add text to bonus squares if desired, e.g., squareDiv.textContent = squareData.bonus.toUpperCase();
            }
            if (r === centerR && c === centerC) {
                squareDiv.classList.add('center'); // Special styling for center square
            }

            if (squareData.tile) {
                const tile = squareData.tile;
                squareDiv.textContent = tile.isBlank ? `(${tile.assignedLetter || ' '})` : tile.letter;
                squareDiv.classList.add('tile-on-board');
                // TODO: Add value display for tile on board if needed  // jt: It's needed.
            }
            boardContainer.appendChild(squareDiv);
        }
    }
}

function renderTileInRack(tile) {
    const tileDiv = document.createElement('div');
    tileDiv.classList.add('tile-in-rack');
    tileDiv.dataset.tileId = tile.id; // For drag-and-drop or selection

    const letterSpan = document.createElement('span');
    letterSpan.classList.add('letter');
    letterSpan.textContent = tile.isBlank ? '?' : tile.letter; // Show '?' for blank before assignment

    const valueSpan = document.createElement('span');
    valueSpan.classList.add('value');
    valueSpan.textContent = tile.value;

    tileDiv.appendChild(letterSpan);
    tileDiv.appendChild(valueSpan);
    return tileDiv;
}

function renderRacks(gameState, localPlayerId) {
    if (!gameState || !gameState.players) return;

    gameState.players.forEach(player => {
        const rackElement = document.getElementById(`${player.id}-rack`);
        if (rackElement) {
            rackElement.innerHTML = ''; // Clear previous rack
            if (player.id === localPlayerId) {
                player.rack.forEach(tile => {
                    rackElement.appendChild(renderTileInRack(tile));
                });
            } else {
                // For opponent, show tile backs or count
                for (let i = 0; i < player.rack.length; i++) {
                    const tileBack = document.createElement('div');
                    tileBack.classList.add('tile-in-rack'); // Same dimensions
                    tileBack.style.backgroundColor = "#888"; // Grey for hidden tile
                    // tileBack.textContent = "?"; // Optional
                    rackElement.appendChild(tileBack);
                }
            }
        }
    });
}

function updateGameStatus(gameState) {
    if (!gameState) return;

    const player1ScoreEl = document.getElementById('player1-score');
    const player2ScoreEl = document.getElementById('player2-score');
    const turnPlayerEl = document.getElementById('turn-player');
    const tilesInBagEl = document.getElementById('tiles-in-bag');

    if (player1ScoreEl) player1ScoreEl.textContent = gameState.players[0].score;
    if (player2ScoreEl) player2ScoreEl.textContent = gameState.players[1].score;
    if (turnPlayerEl) turnPlayerEl.textContent = gameState.getCurrentPlayer().name;
    if (tilesInBagEl) tilesInBagEl.textContent = gameState.bag.length;
}

function fullRender(gameState, localPlayerId) {
    if (!gameState) {
        console.log("No current game to render.");
        // Potentially clear the board or show a "No game active" message
        document.getElementById('board-container').innerHTML = '<p>No game active. Start a new game or load one via URL.</p>';
        return;
    }
    renderBoard(gameState);
    renderRacks(gameState, localPlayerId);
    updateGameStatus(gameState);
    // TODO: Render other UI elements like turn URL
}


// --- Game Initialization and Event Listeners ---

function initializeNewGame() {
    // For now, use a fixed seed for predictability during development
    // Later, this will come from user input or be generated randomly
    const gameId = `game-${Date.now()}`;
    const randomSeed = 12345; // Example seed

    // TODO: Get player ID from local storage, or assign one if first time.
    // For now, assuming player 1 is local.
    // localPlayerId = localStorage.getItem('crosswordPlayerId');  // jt: The local player ID should be per game.
    // if (!localPlayerId) {
    //     localPlayerId = 'player1'; // Or prompt user
    //     localStorage.setItem('crosswordPlayerId', localPlayerId);
    // }


    currentGame = new GameState(gameId, randomSeed, {
        // Example of overriding default settings:
        // blankTileCount: 3,
        // sevenTileBonus: 75
    });
    console.log("New game initialized:", currentGame);
    // jt: TODO: Suppress console logging of rack tiles unless debug=1 given in query string.
    console.log("Player 1 rack:", currentGame.players[0].rack);
    console.log("Player 2 rack:", currentGame.players[1].rack);
    console.log("Bag count:", currentGame.bag.length);

    fullRender(currentGame, localPlayerId);
}


document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");

    // Attempt to load game from URL or localStorage first (to be implemented)
    // For now, just start a new game for testing UI rendering
    initializeNewGame();


    // Event Listeners for buttons
    document.getElementById('play-word-btn').addEventListener('click', () => alert('Play Word clicked!'));
    document.getElementById('exchange-tiles-btn').addEventListener('click', () => alert('Exchange Tiles clicked!'));
    document.getElementById('pass-turn-btn').addEventListener('click', () => alert('Pass Turn clicked!'));

    const newGameBtn = document.getElementById('new-game-btn');
    const newGameModal = document.getElementById('new-game-modal');
    const startGameBtn = document.getElementById('start-game-btn');
    const cancelNewGameBtn = document.getElementById('cancel-new-game-btn');

    if (newGameBtn && newGameModal) {
        newGameBtn.addEventListener('click', () => {
            newGameModal.style.display = 'block';
        });
    }

    if (startGameBtn && newGameModal) {
        startGameBtn.addEventListener('click', () => {
            alert('Starting new game with settings...');
            newGameModal.style.display = 'none';
            // Actual new game logic will go here
        });
    }

    if (cancelNewGameBtn && newGameModal) {
        cancelNewGameBtn.addEventListener('click', () => {
            newGameModal.style.display = 'none';
        });
    }

});
