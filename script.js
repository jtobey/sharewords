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

        for (const letter in distribution) {
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
    this.currentTurnMoves = []; // Stores tiles placed in the current turn: { tileId: string, tileRef: Tile, from: 'rack' | {row, col}, to: {row, col} }
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
                // Render tile content with common classes for letter and value
                const letterSpan = document.createElement('span');
                letterSpan.classList.add('tile-letter'); // Use common class
                letterSpan.textContent = tile.isBlank ? (tile.assignedLetter ? `(${tile.assignedLetter.toUpperCase()})` : '(?)') : tile.letter;

                const valueSpan = document.createElement('span');
                valueSpan.classList.add('tile-value'); // Use common class
                valueSpan.textContent = tile.value;

                squareDiv.innerHTML = ''; // Clear any bonus text (e.g. from bonus class name)
                squareDiv.appendChild(letterSpan);
                squareDiv.appendChild(valueSpan);

                squareDiv.classList.add('tile-on-board');

                // Check if this tile was placed this turn and make it draggable
                const isCurrentTurnMove = currentGame.currentTurnMoves.find(m => m.tileId === tile.id && m.to.row === r && m.to.col === c);
                if (isCurrentTurnMove && currentGame.getCurrentPlayer().id === localPlayerId) {
                    squareDiv.draggable = true;
                    squareDiv.addEventListener('dragstart', handleDragStart); // Reusing handleDragStart
                    squareDiv.addEventListener('dragend', handleDragEnd);     // Reusing handleDragEnd
                    squareDiv.dataset.tileId = tile.id; // Important for identifying the tile being dragged from board
                }
            }

            // Add DND listeners for board squares
            squareDiv.addEventListener('dragover', handleDragOver);
            squareDiv.addEventListener('drop', handleDropOnBoard);

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
    }

    const letterSpan = document.createElement('span');
    letterSpan.classList.add('tile-letter'); // Use common class
    letterSpan.textContent = tile.isBlank ? '?' : tile.letter.toUpperCase();

    const valueSpan = document.createElement('span');
    valueSpan.classList.add('tile-value'); // Use common class
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
                // Make the rack a drop target only for the current local player
                if (currentGame && player.id === currentGame.getCurrentPlayer().id) {
                    rackElement.addEventListener('dragover', handleDragOver);
                    rackElement.addEventListener('drop', handleDropOnRack);
                } else {
                    rackElement.removeEventListener('dragover', handleDragOver);
                    rackElement.removeEventListener('drop', handleDropOnRack);
                }

                player.rack.forEach(tile => {
                    const isDraggable = (currentGame && player.id === currentGame.getCurrentPlayer().id && player.id === localPlayerId);
                    rackElement.appendChild(renderTileInRack(tile, isDraggable));
                });
            } else {
                // For opponent, show tile backs or count
                rackElement.removeEventListener('dragover', handleDragOver); // Ensure opponent rack is not a drop target
                rackElement.removeEventListener('drop', handleDropOnRack);
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

// --- Drag and Drop Handlers ---
let draggedTileId = null; // To store the ID of the tile being dragged

function handleDragStart(event) {
    const currentTurnPlayerId = currentGame ? currentGame.getCurrentPlayer().id : null;
    console.log(`Drag Start Attempt: localPlayerId='${localPlayerId}', currentTurnPlayerId='${currentTurnPlayerId}'`);

    // Only allow dragging if it's the current player's turn AND this browser controls that player.
    if (!currentGame || currentTurnPlayerId !== localPlayerId) {
        console.log("Drag prevented: Not current player's turn or local player mismatch.");
        event.preventDefault();
        return;
    }

    // Additional check: ensure the tile being dragged is either from the local player's rack
    // or was placed by the local player this turn.
    // (The draggable attribute should already enforce this by not being set otherwise, but this is a safeguard)
    const tileElement = event.target.closest('[data-tile-id]');
    if (!tileElement) {
        event.preventDefault();
        return;
    }
    draggedTileId = tileElement.dataset.tileId;
    event.dataTransfer.setData('text/plain', draggedTileId);
    event.dataTransfer.effectAllowed = 'move';
    event.target.style.opacity = '0.5'; // Visual feedback
    console.log('Drag Start:', draggedTileId);
}

function handleDragEnd(event) {
    event.target.style.opacity = '1'; // Reset visual feedback
    draggedTileId = null;
    console.log('Drag End');
}

function handleDragOver(event) {
    event.preventDefault(); // Necessary to allow dropping
    event.dataTransfer.dropEffect = 'move';
}

function handleDropOnBoard(event) {
    event.preventDefault();
    if (!draggedTileId) return;

    const targetSquareElement = event.target.closest('.square');
    if (!targetSquareElement) return;

    const row = parseInt(targetSquareElement.dataset.row);
    const col = parseInt(targetSquareElement.dataset.col);

    if (isNaN(row) || isNaN(col)) {
        console.error("Invalid row/col on drop target:", targetSquareElement.dataset.row, targetSquareElement.dataset.col);
        return;
    }

    const boardSquare = currentGame.board.grid[row][col];
    if (boardSquare.tile) {
        // Allow dropping on an occupied square ONLY IF the tile being dragged came from the board (board-to-board move)
        // AND the target square is the source of another current turn move (swapping)
        // OR if the target square's tile is the one being dragged (no actual move) - this case should be handled by not doing much.
        // For simplicity now, only allow dropping on an empty square or its own square.
        // More complex swap logic can be added later if desired.
        const existingMove = currentGame.currentTurnMoves.find(move => move.tileId === draggedTileId);
        if (!existingMove || (existingMove && boardSquare.tile.id !== draggedTileId)) { // Not dragging the tile that's already there
             console.log("Square already occupied by a different tile or tile is not from board.");
             return;
        }
    }

    const player = currentGame.getCurrentPlayer();
    let tile;
    let originalSourceType = 'rack'; // 'rack' or 'board'
    let originalPosition = null; // {row, col} if from board

    // Check if the tile is coming from the rack or from the board (current turn moves)
    const existingMoveIndex = currentGame.currentTurnMoves.findIndex(move => move.tileId === draggedTileId);

    if (existingMoveIndex !== -1) { // Tile is being moved from another board square (placed this turn)
        const move = currentGame.currentTurnMoves[existingMoveIndex];
        tile = move.tileRef;
        originalSourceType = 'board';
        originalPosition = { row: move.to.row, col: move.to.col };

        // If dropping onto its own square, do nothing.
        if (originalPosition.row === row && originalPosition.col === col) {
            draggedTileId = null;
            fullRender(currentGame, localPlayerId); // Ensure opacity is restored etc.
            return;
        }

        // Clear the original square on the board
        currentGame.board.grid[originalPosition.row][originalPosition.col].tile = null;
        // Update the move's 'to' position
        move.to = { row, col };
        // No need to remove from currentTurnMoves, just update its position.
    } else { // Tile is coming from the rack
        const tileIndexInRack = player.rack.findIndex(t => t.id === draggedTileId);
        if (tileIndexInRack === -1) {
            console.error("Dragged tile not found in player's rack or current turn moves.");
            draggedTileId = null;
            fullRender(currentGame, localPlayerId);
            return;
        }
        tile = player.rack[tileIndexInRack];
        player.rack.splice(tileIndexInRack, 1); // Remove from rack

        // Add to currentTurnMoves
        currentGame.currentTurnMoves.push({
            tileId: tile.id,
            tileRef: tile,
            from: 'rack', // Or originalPosition if it was from board
            to: { row, col }
        });
    }

    // Handle blank tile letter assignment (only if it's newly from rack and blank)
    if (originalSourceType === 'rack' && tile.isBlank && !tile.assignedLetter) {
        let assigned = '';
        while (assigned.length !== 1 || !/^[A-Z]$/i.test(assigned)) {
            assigned = prompt("Enter a letter for the blank tile (A-Z):");
            if (assigned === null) { // User cancelled prompt
                // Return tile to rack if it was from rack
                if (originalSourceType === 'rack') player.rack.push(tile);
                // If it was part of currentTurnMoves and from rack, remove it
                const newMoveIdx = currentGame.currentTurnMoves.findIndex(m => m.tileId === tile.id);
                if (newMoveIdx !== -1) currentGame.currentTurnMoves.splice(newMoveIdx, 1);

                draggedTileId = null;
                fullRender(currentGame, localPlayerId);
                return;
            }
            assigned = assigned.toUpperCase();
        }
        tile.assignedLetter = assigned;
    }

    // Update GameState: Place tile on the new board square
    boardSquare.tile = tile;

    console.log(`Tile ${tile.id} (${tile.letter || 'blank'}) moved to (${row},${col}). currentTurnMoves:`, currentGame.currentTurnMoves);

    // Re-render
    fullRender(currentGame, localPlayerId);
    draggedTileId = null; // Clear after successful drop
}

function handleDropOnRack(event) {
    event.preventDefault();
    if (!draggedTileId) return;

    const player = currentGame.getCurrentPlayer();
    // Ensure the drop target is indeed the current player's rack element.
    // This check might be redundant if listeners are added/removed correctly, but good for safety.
    const rackElement = document.getElementById(`${player.id}-rack`);
    if (!rackElement || !rackElement.contains(event.target)) {
        // Dropped outside the actual rack area, or on wrong player's rack somehow
        return;
    }

    const moveIndex = currentGame.currentTurnMoves.findIndex(m => m.tileId === draggedTileId);
    if (moveIndex === -1) {
        // This tile wasn't on the board this turn (e.g., dragging from rack to rack - not supported by this handler)
        console.log("Tile dragged to rack was not from board this turn.");
        return;
    }

    const move = currentGame.currentTurnMoves[moveIndex];
    const tile = move.tileRef;

    // Remove from board
    currentGame.board.grid[move.to.row][move.to.col].tile = null;

    // Add back to player's rack
    player.rack.push(tile);

    // If it was a blank tile and its letter was assigned this turn (i.e., it came from 'rack' originally in currentTurnMoves)
    // then reset its assignedLetter.
    if (tile.isBlank && move.from === 'rack') {
        tile.assignedLetter = null;
    }

    // Remove from currentTurnMoves
    currentGame.currentTurnMoves.splice(moveIndex, 1);

    console.log(`Tile ${tile.id} (${tile.letter}) returned to rack. currentTurnMoves:`, currentGame.currentTurnMoves);

    fullRender(currentGame, localPlayerId);
    draggedTileId = null;
}

// --- Game Action Handlers ---
function handleCommitPlay() {
    if (!currentGame || currentGame.getCurrentPlayer().id !== localPlayerId) {
        alert("It's not your turn or no game active!");
        return;
    }

    if (currentGame.currentTurnMoves.length === 0) {
        alert("You haven't placed any tiles.");
        return;
    }

    // TODO: Future:
    // 1. Validate word formation and placement rules.
    //    - First word on center square.
    //    - Subsequent words connect to existing tiles.
    //    - All new tiles in a single row/column.
    //    - All formed words are valid (dictionary lookup).
    // 2. Calculate score for the turn.
    // 3. Add score to player.
    // 4. Draw new tiles for the player.
    // 5. Check for game end conditions.
    // 6. Switch current player.
    // 7. Generate Turn URL.

    console.log("Committing play with moves:", currentGame.currentTurnMoves);

    // For now, just "finalize" the tiles:
    // Tiles placed this turn are now permanent for this turn's context,
    // meaning they are no longer draggable by `currentTurnMoves` logic.
    // Bonus squares used this turn should be marked.
    currentGame.currentTurnMoves.forEach(move => {
        const square = currentGame.board.grid[move.to.row][move.to.col];
        if (square.bonus !== BONUS_TYPES.NONE && !square.bonusUsed) {
            // In a full scoring system, we'd use the bonus here.
            // For now, just conceptually mark it.
            // We might not actually need to mark bonusUsed on the square object itself
            // if scoring calculates it on the fly based on which tiles are new.
            // However, the requirement says "a square's bonus has effect only during the turn when its tile is placed".
            // This implies it should be possible for a tile to be on a bonus square but the bonus not apply
            // if that tile was placed in a previous turn.
            // So, for now, let's assume `bonusUsed` could be set here if we were fully implementing bonuses.
            // For this step, simply acknowledging this is sufficient.
        }
    });

    // Capture moves for URL generation BEFORE clearing
    const committedMoves = [...currentGame.currentTurnMoves];

    // --- Word Identification Logic (Simplified) ---
    let wordDataForURL = null;
    if (committedMoves.length > 0) {
        // Sort moves by row, then col to help determine word order
        committedMoves.sort((a, b) => {
            if (a.to.row === b.to.row) return a.to.col - b.to.col;
            return a.to.row - b.to.row;
        });

        const firstMove = committedMoves[0];
        const lastMove = committedMoves[committedMoves.length - 1];
        let direction = null;
        let isSingleLine = true;

        if (committedMoves.length > 1) {
            const allSameRow = committedMoves.every(m => m.to.row === firstMove.to.row);
            const allSameCol = committedMoves.every(m => m.to.col === firstMove.to.col);

            if (allSameRow) {
                direction = 'horizontal';
            } else if (allSameCol) {
                direction = 'vertical';
            } else {
                isSingleLine = false; // Tiles not in a single line
            }
        } else { // Single tile placed
            direction = 'horizontal'; // Default for single tile, or could try to infer
        }

        if (isSingleLine) {
            let wordString = "";
            let startRow = firstMove.to.row;
            let startCol = firstMove.to.col;
            let minR = startRow, maxR = startRow, minC = startCol, maxC = startCol;

            if (direction === 'horizontal') {
                minC = committedMoves.reduce((min, m) => Math.min(min, m.to.col), firstMove.to.col);
                maxC = committedMoves.reduce((max, m) => Math.max(max, m.to.col), firstMove.to.col);
                startCol = minC; // Word starts at the minimum column of the new tiles

                // Expand to include existing adjacent tiles
                let currentC = minC - 1;
                while(currentC >= 0 && currentGame.board.grid[startRow][currentC].tile) {
                    startCol = currentC; // Update startCol if existing tiles are found to the left
                    currentC--;
                }
                currentC = maxC + 1;
                let endCol = maxC;
                while(currentC < currentGame.board.size && currentGame.board.grid[startRow][currentC].tile) {
                    endCol = currentC; // Update endCol if existing tiles are found to the right
                    currentC++;
                }

                for (let c = startCol; c <= endCol; c++) {
                    const tileOnSquare = currentGame.board.grid[startRow][c].tile;
                    if (tileOnSquare) {
                        wordString += tileOnSquare.isBlank ? tileOnSquare.assignedLetter.toUpperCase() : tileOnSquare.letter.toUpperCase();
                    } else { /* This case should ideally not happen if logic is correct */ wordString += '?'; }
                }

            } else { // Vertical
                minR = committedMoves.reduce((min, m) => Math.min(min, m.to.row), firstMove.to.row);
                maxR = committedMoves.reduce((max, m) => Math.max(max, m.to.row), firstMove.to.row);
                startRow = minR; // Word starts at the minimum row

                let currentR = minR - 1;
                while(currentR >= 0 && currentGame.board.grid[currentR][startCol].tile) {
                    startRow = currentR;
                    currentR--;
                }
                currentR = maxR + 1;
                let endRow = maxR;
                while(currentR < currentGame.board.size && currentGame.board.grid[currentR][startCol].tile) {
                    endRow = currentR;
                    currentR++;
                }

                for (let r = startRow; r <= endRow; r++) {
                     const tileOnSquare = currentGame.board.grid[r][startCol].tile;
                    if (tileOnSquare) {
                        wordString += tileOnSquare.isBlank ? tileOnSquare.assignedLetter.toUpperCase() : tileOnSquare.letter.toUpperCase();
                    } else { wordString += '?'; }
                }
            }

            const blanksInfo = [];
            committedMoves.forEach(move => {
                if (move.tileRef.isBlank) {
                    let indexInWord = -1;
                    if (direction === 'horizontal') {
                        indexInWord = move.to.col - startCol;
                    } else { // vertical
                        indexInWord = move.to.row - startRow;
                    }
                    if (indexInWord >= 0 && indexInWord < wordString.length) {
                         blanksInfo.push({ idx: indexInWord, al: move.tileRef.assignedLetter.toUpperCase() });
                    }
                }
            });

            wordDataForURL = {
                word: wordString,
                start_row: startRow,
                start_col: startCol,
                direction: direction,
                blanks_info: blanksInfo
            };
            console.log("Identified word for URL:", wordDataForURL);

        } else {
            console.warn("Tiles placed are not in a single line. Using old td format for now.");
            // Fallback to old turn data format if not a single line (for this simplified step)
            wordDataForURL = committedMoves; // This will make generateTurnURL use the old `td` format
        }
    }
    // --- End of Word Identification ---


    // Clear currentTurnMoves as these are now "locked in" for this turn.
    currentGame.currentTurnMoves = [];

    // Increment turn number (will be part of state for URL)
    // This should happen *before* generating the URL for this turn's data.
    currentGame.turnNumber++;


    // TODO: Placeholder for switching player & replenishing tiles
    // const playerWhoPlayed = currentGame.getCurrentPlayer();
    // const tilesPlayedCount = movesForURL.length;
    // currentGame.drawTiles(playerWhoPlayed, tilesPlayedCount);
    // currentGame.currentPlayerIndex = (currentGame.currentPlayerIndex + 1) % currentGame.players.length;

    alert("Play committed! (Validation, scoring, and turn change not yet implemented)");

    let turnURL;
    if (currentGame.turnNumber === 1 && currentGame.creatorId === BROWSER_PLAYER_ID) {
        // This is P1 completing their first move, generate the special new game + first move URL
        turnURL = generateTurnURL(
            currentGame.gameId,
            currentGame.turnNumber,
            wordDataForURL, // Use the new word-based data structure
            currentGame.randomSeed,
            currentGame.creatorId
            // TODO: Include non-default settings
        );
    } else {
        // Standard turn URL for subsequent moves, using new word-based data
        turnURL = generateTurnURL(currentGame.gameId, currentGame.turnNumber, wordDataForURL);
    }

    const turnUrlInput = document.getElementById('turn-url');
    if (turnUrlInput) {
        turnUrlInput.value = turnURL;
        turnUrlInput.placeholder = "Share this URL with the other player."; // Update placeholder
        console.log("Turn URL:", turnURL);
    }

    // Re-render the board. Tiles that were in currentTurnMoves will no longer be draggable.
    // Rack will also re-render, ensuring its drop listeners are updated if the turn changed.
    fullRender(currentGame, localPlayerId);
}

function generateTurnURL(gameId, turnNumber, turnData, seed = null, creator = null, settings = null) {
    const baseURL = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    params.append('gid', gameId);
    params.append('tn', turnNumber);

    if (seed !== null) {
        params.append('seed', seed);
    }
    if (creator !== null) {
        params.append('creator', creator);
    }
    // TODO: Add settings to params if provided and non-default

    // New turnData format: { word, start_row, start_col, direction, blanks_info }
    // or array of moves (old format as fallback)
    if (turnData) {
        if (Array.isArray(turnData)) { // Fallback to old format if word identification failed
            console.warn("generateTurnURL: Falling back to old 'td' format.");
            const simplifiedTurnData = turnData.map(move => ({
                l: move.tileRef.isBlank ? '' : move.tileRef.letter,
                r: move.to.row,
                c: move.to.col,
                b: move.tileRef.isBlank ? 1 : 0,
                al: move.tileRef.isBlank ? move.tileRef.assignedLetter : undefined
            })).filter(td => td !== undefined);
            if (simplifiedTurnData.length > 0) {
                params.append('td', JSON.stringify(simplifiedTurnData));
            }
        } else if (turnData.word) { // New word-based format
            params.append('w', turnData.word);
            params.append('wl', `${turnData.start_row},${turnData.start_col}`);
            params.append('wd', turnData.direction);
            if (turnData.blanks_info && turnData.blanks_info.length > 0) {
                const blankParam = turnData.blanks_info.map(bi => `${bi.idx}:${bi.al}`).join(';');
                params.append('bt', blankParam);
            }
        }
    }

    return `${baseURL}?${params.toString()}`;
}


// --- Game Initialization and Event Listeners ---

// Add drag event listeners to board squares during renderBoard
// Modify renderBoard to add these:
// squareDiv.addEventListener('dragover', handleDragOver);
// squareDiv.addEventListener('drop', handleDropOnBoard);

function initializeNewGame() {
    // For now, use a fixed seed for predictability during development
    // Later, this will come from user input or be generated randomly
    const gameId = `game-${Date.now()}`;
    const randomSeed = 12345; // Example seed

    // TODO: Get player ID from local storage, or assign one if first time.
    // For now, assuming player 1 is local.
    // localPlayerId = localStorage.getItem('crosswordPlayerId');
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
    console.log("Player 1 rack:", currentGame.players[0].rack);
    console.log("Player 2 rack:", currentGame.players[1].rack);
    console.log("Bag count:", currentGame.bag.length);

    fullRender(currentGame, localPlayerId);
}


// --- LocalStorage Functions ---
const LOCAL_STORAGE_KEY_PREFIX = "crosswordGame_";

function getPlayerIdentifier() {
    // Generates or retrieves a unique identifier for this browser instance.
    let browserId = localStorage.getItem("crosswordBrowserId");
    if (!browserId) {
        browserId = `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem("crosswordBrowserId", browserId);
    }
    return browserId;
}
const BROWSER_PLAYER_ID = getPlayerIdentifier();


function saveGameStateToLocalStorage(gameState) {
    if (!gameState || !gameState.gameId) {
        console.error("Cannot save game state: invalid gameState or gameId missing.");
        return;
    }
    try {
        // Prepare a serializable version of the gameState
        const serializableState = {
            gameId: gameState.gameId,
            randomSeed: gameState.randomSeed,
            settings: gameState.settings, // Assuming settings are already plain data
            turnNumber: gameState.turnNumber,
            currentPlayerIndex: gameState.currentPlayerIndex,
            isGameOver: gameState.isGameOver,
            gameHistory: gameState.gameHistory, // Assuming history stores serializable turn summaries

            // Player data needs to be just data (racks will be arrays of tile data)
            players: gameState.players.map(p => ({
                id: p.id,
                name: p.name,
                score: p.score,
                rack: p.rack.map(t => ({ letter: t.letter, value: t.value, isBlank: t.isBlank, assignedLetter: t.assignedLetter, id: t.id }))
            })),

            // Bag needs to be an array of tile data
            bag: gameState.bag.map(t => ({ letter: t.letter, value: t.value, isBlank: t.isBlank, assignedLetter: t.assignedLetter, id: t.id })),

            // Board grid needs to be an array of arrays of square data (with tile data if present)
            boardGrid: gameState.board.grid.map(row => row.map(sq => ({
                row: sq.row,
                col: sq.col,
                bonus: sq.bonus,
                bonusUsed: sq.bonusUsed,
                tile: sq.tile ? { letter: sq.tile.letter, value: sq.tile.value, isBlank: sq.tile.isBlank, assignedLetter: sq.tile.assignedLetter, id: sq.tile.id } : null
            }))),
            // Store who created this game, to help determine P1/P2 on load
            // This is set when a new game is first created by a browser
            creatorId: gameState.creatorId || null
        };

        localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + gameState.gameId, JSON.stringify(serializableState));
        console.log(`Game ${gameState.gameId} saved to localStorage.`);
    } catch (error) {
        console.error("Error saving game state to localStorage:", error);
    }
}

function loadGameStateFromLocalStorage(gameId) {
    if (!gameId) return null;
    try {
        const storedDataString = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + gameId);
        if (!storedDataString) {
            console.log(`No game data found in localStorage for ${gameId}`);
            return null;
        }

        const storedData = JSON.parse(storedDataString);

        // Rehydrate GameState
        // 1. Create a new GameState instance. This will initialize a default board, bag, players.
        //    We pass settings from storedData if available.
        const rehydratedGame = new GameState(storedData.gameId, storedData.randomSeed, storedData.settings || {});

        // 2. Overwrite properties with stored data
        rehydratedGame.turnNumber = storedData.turnNumber;
        rehydratedGame.currentPlayerIndex = storedData.currentPlayerIndex;
        rehydratedGame.isGameOver = storedData.isGameOver;
        rehydratedGame.gameHistory = storedData.gameHistory || [];
        rehydratedGame.creatorId = storedData.creatorId;

        // Rehydrate players (racks and scores)
        if (storedData.players && storedData.players.length === rehydratedGame.players.length) {
            storedData.players.forEach((pd, index) => {
                rehydratedGame.players[index].score = pd.score;
                rehydratedGame.players[index].rack = pd.rack.map(td => {
                    const tile = new Tile(td.letter, td.value, td.isBlank);
                    tile.assignedLetter = td.assignedLetter;
                    tile.id = td.id; // Preserve original tile ID
                    return tile;
                });
            });
        }

        // Rehydrate bag
        rehydratedGame.bag = storedData.bag.map(td => {
            const tile = new Tile(td.letter, td.value, td.isBlank);
            tile.assignedLetter = td.assignedLetter;
            tile.id = td.id;
            return tile;
        });

        // Rehydrate board
        if (storedData.boardGrid) {
            for (let r = 0; r < storedData.boardGrid.length; r++) {
                for (let c = 0; c < storedData.boardGrid[r].length; c++) {
                    const sqData = storedData.boardGrid[r][c];
                    const boardSq = rehydratedGame.board.grid[r][c]; // Get the Square instance
                    boardSq.bonus = sqData.bonus; // Should match initial if not changed by settings
                    boardSq.bonusUsed = sqData.bonusUsed;
                    if (sqData.tile) {
                        const td = sqData.tile;
                        const tile = new Tile(td.letter, td.value, td.isBlank);
                        tile.assignedLetter = td.assignedLetter;
                        tile.id = td.id;
                        boardSq.tile = tile;
                    } else {
                        boardSq.tile = null;
                    }
                }
            }
        }

        console.log(`Game ${gameId} loaded and rehydrated from localStorage.`);
        return rehydratedGame;

    } catch (error) {
        console.error("Error loading game state from localStorage:", error);
        return null;
    }
}


// --- Game Initialization and URL Handling ---
function applyTurnDataFromURL(gameState, params) {
    const word = params.get('w');
    const wordLocation = params.get('wl');
    const wordDirection = params.get('wd');
    const blankTileData = params.get('bt'); // Format: "idx1:AL1;idx2:AL2"
    const oldTurnDataStr = params.get('td'); // Fallback

    if (word && wordLocation && wordDirection) {
        console.log(`Applying word-based turn data: ${word} at ${wordLocation} ${wordDirection}`);
        const [startRowStr, startColStr] = wordLocation.split(',');
        const startRow = parseInt(startRowStr);
        const startCol = parseInt(startColStr);

        if (isNaN(startRow) || isNaN(startCol)) {
            console.error("Invalid word location format:", wordLocation);
            return false;
        }

        const blanks = new Map(); // Map from indexInWord to assignedLetter
        if (blankTileData) {
            blankTileData.split(';').forEach(item => {
                const [idxStr, al] = item.split(':');
                blanks.set(parseInt(idxStr), al);
            });
        }

        for (let i = 0; i < word.length; i++) {
            const char = word[i];
            let r = startRow;
            let c = startCol;

            if (wordDirection === 'horizontal') {
                c += i;
            } else if (wordDirection === 'vertical') {
                r += i;
            } else {
                console.error("Invalid word direction:", wordDirection);
                return false;
            }

            if (gameState.board.grid[r] && gameState.board.grid[r][c]) {
                if (gameState.board.grid[r][c].tile && gameState.board.grid[r][c].tile.letter !== char && !(gameState.board.grid[r][c].tile.isBlank && gameState.board.grid[r][c].tile.assignedLetter === char)) {
                    // Only overwrite if it's clearly different. If it's the same, this is fine.
                    // This simple application doesn't know which tiles were newly placed vs pre-existing.
                    console.warn(`Square ${r},${c} already has a tile ${gameState.board.grid[r][c].tile.letter}. Overwriting with ${char} from URL.`);
                }

                let isBlankTile = false;
                let assignedLetterForBlank = null;

                if (blanks.has(i)) {
                    isBlankTile = true;
                    assignedLetterForBlank = blanks.get(i);
                }

                // For non-blank characters from the word string, they are the letter.
                // For blank characters (represented by their assigned letter in `word`), `char` is the assigned letter.
                const tileLetter = isBlankTile ? '' : char;
                const newTile = new Tile(tileLetter, gameState.settings.tileValues[char] || 0, isBlankTile);
                if (isBlankTile) {
                    newTile.assignedLetter = assignedLetterForBlank;
                }
                gameState.board.grid[r][c].tile = newTile;

            } else {
                console.error(`Invalid square coordinates for word placement: ${r},${c}`);
                return false;
            }
        }
        return true;

    } else if (oldTurnDataStr) { // Fallback to old td format
        console.warn("Applying turn data using fallback 'td' parameter.");
        try {
            const turnDataArray = JSON.parse(oldTurnDataStr);
            if (!gameState || !turnDataArray || !Array.isArray(turnDataArray)) {
                console.error("Invalid arguments to applyTurnDataToGame (fallback)");
                return false;
            }
            turnDataArray.forEach(td => {
                if (gameState.board.grid[td.r] && gameState.board.grid[td.r][td.c]) {
                    if (gameState.board.grid[td.r][td.c].tile) {
                        console.warn(`Square ${td.r},${td.c} already has a tile. Overwriting for URL apply (simplification).`);
                    }
                    const newTile = new Tile(td.l, gameState.settings.tileValues[td.l] || 0, td.b === 1);
                    if (newTile.isBlank && td.al) {
                        newTile.assignedLetter = td.al;
                    }
                    gameState.board.grid[td.r][td.c].tile = newTile;
                } else {
                    console.error(`Invalid square coordinates in turn data: ${td.r},${td.c}`);
                }
            });
            return true;
        } catch (e) {
            console.error("Error parsing fallback 'td' data:", e);
            return false;
        }
    }
    console.log("No recognized turn data found in URL params to apply.");
    return false; // No turn data applied
}


function loadGameFromURLOrStorage() {
    const params = new URLSearchParams(window.location.search);
    const urlGameId = params.get('gid');
    const urlTurnNumberStr = params.get('tn');
    // const urlTurnDataStr = params.get('td'); // No longer primary, handled by applyTurnDataFromURL
    const urlSeed = params.get('seed'); // For new game from URL

    // TODO: Determine localPlayerId more robustly (e.g. from localStorage, or based on who created the game)
    // For now, if a gameId is present, and we don't have it, assume we are player2 for this game.
    // This is a very basic heuristic.
    // localPlayerId will be determined based on whether this browser created the game.

    if (urlGameId) {
        console.log(`URL contains gameId: ${urlGameId}`);
        currentGame = loadGameStateFromLocalStorage(urlGameId);

        if (currentGame) { // Game exists in local storage
            // Determine localPlayerId
            if (currentGame.creatorId === BROWSER_PLAYER_ID) {
                localPlayerId = 'player1';
            } else {
                // If creatorId is set and not this browser, this browser is player2.
                // If creatorId is not set (older game from before this logic), and we're loading via URL,
                // it's ambiguous. For now, default to player2 if not creator.
                localPlayerId = 'player2';
            }
            console.log(`Game ${urlGameId} loaded from storage. This browser is ${localPlayerId}. Current turn: ${currentGame.turnNumber}`);

            if (urlTurnNumberStr) {
                const urlTurnNumber = parseInt(urlTurnNumberStr);
                if (urlTurnNumber === currentGame.turnNumber + 1) {
                    console.log(`Attempting to apply turn ${urlTurnNumber} from URL.`);
                    if (applyTurnDataFromURL(currentGame, params)) {
                        currentGame.turnNumber = urlTurnNumber; // Update turn number
                        // TODO: Player switching logic more robustly
                        // For now, if a move was applied, switch player index
                        if (params.get('w') || params.get('td')) { // if there was move data
                             currentGame.currentPlayerIndex = (currentGame.currentPlayerIndex + 1) % currentGame.players.length;
                        }
                        saveGameStateToLocalStorage(currentGame);
                        console.log(`Successfully applied turn ${urlTurnNumber}. New current player index: ${currentGame.currentPlayerIndex}`);
                    } else {
                        // applyTurnDataFromURL might return false if no actual turn data was found (e.g. only gid, tn)
                        // or if there was an error. If it's just a URL to sync turn number (e.g. after a pass),
                        // and no data was present, it's not an error.
                        if (!params.get('w') && !params.get('td') && !params.get('bt')) {
                             currentGame.turnNumber = urlTurnNumber; // Likely a pass or exchange, update turn.
                             currentGame.currentPlayerIndex = (currentGame.currentPlayerIndex + 1) % currentGame.players.length;
                             saveGameStateToLocalStorage(currentGame);
                             console.log(`Turn ${urlTurnNumber} processed as pass/exchange. New current player index: ${currentGame.currentPlayerIndex}`);
                        } else {
                            alert("Failed to apply turn data from URL. Check console for details.");
                        }
                    }
                } else if (urlTurnNumber <= currentGame.turnNumber) {
                    alert(`Turn ${urlTurnNumber} has already been applied or is out of sync. Current turn is ${currentGame.turnNumber}.`);
                } else {
                    alert(`Out of sync turn data. Expected turn ${currentGame.turnNumber + 1}, got ${urlTurnNumber}.`);
                }
            }
        } else { // Game not in local storage, but URL has gid.
                 // This could be player 2 joining a game started by player 1 if it's turn 0 or 1 from a new game URL.
                 // Or it's an error if tn > 1 and we have no base state.
            if (urlSeed && (!urlTurnNumberStr || parseInt(urlTurnNumberStr) <= 1)) { // New game initiated by other player
                console.log(`New game ${urlGameId} from URL with seed ${urlSeed}. Assuming this client is Player 2.`);
                // TODO: Parse settings from URL if present
                currentGame = new GameState(urlGameId, parseInt(urlSeed), {}); // Pass parsed settings
                // The creatorId would have been part of the new game URL (or established by P1 saving it first)
                // For this flow, if creatorId isn't set on the game object by GameState (it's not by default),
                // it implies P1 hasn't saved it yet, or this is an old game.
                // If the URL carries a `creator` param, that would be ideal.
                // For now, if we're here, it means we didn't load it, so this browser is NOT the creator.
                localPlayerId = 'player2';
                currentGame.creatorId = params.get('creator') || null; // P1 should include its BROWSER_PLAYER_ID as 'creator' in the first shared URL.

                // If tn=1 and td is present, apply first move from P1.
                // If tn=1 and turn data (w, wl, wd or td) is present, apply P1's first move.
                if (urlTurnNumberStr && parseInt(urlTurnNumberStr) === 1 && (params.has('w') || params.has('td'))) {
                    if(applyTurnDataFromURL(currentGame, params)) {
                        currentGame.turnNumber = 1;
                        currentGame.currentPlayerIndex = 1; // P1 made move 1, so it's P2's turn.
                        console.log("Applied P1's first move for P2. Current player index:", currentGame.currentPlayerIndex);
                    } else {
                        console.error("Failed to apply P1's first move data for P2.");
                    }
                }
                saveGameStateToLocalStorage(currentGame);
            } else {
                 alert(`Game ${urlGameId} not found locally. Please ensure you have the complete game history or the initial new game URL.`);
                 document.getElementById('board-container').innerHTML = `<p>Error: Game ${urlGameId} not found. Cannot apply turn ${urlTurnNumberStr}.</p>`;
                 return; // Stop further processing
            }
        }
    } else if (urlSeed) { // New game initiated by this client (no gid yet, or gid is for this new game)
        console.log(`New game from URL with seed ${urlSeed}. This client is Player 1.`);
        const newGameId = urlGameId || `game-${Date.now()}`; // Use gid from URL if present (e.g. bookmark)
        currentGame = new GameState(newGameId, parseInt(urlSeed), {}); // TODO: Parse settings
        currentGame.creatorId = BROWSER_PLAYER_ID; // This browser is creating the game
        localPlayerId = 'player1';
        // The initial URL for a new game typically won't have tn or td.
        // It's just for player 1 to start. Player 1 makes first move, then shares URL with tn=1.
        saveGameStateToLocalStorage(currentGame);
    } else {
        // No game parameters in URL. Try to load a default/last game or initialize a test one.
        // For now, if no URL params, and no "last game" logic, initialize a new test game.
        // This means opening the page without params always starts a fresh game for this browser as P1.
        // A more sophisticated approach would be to list saved games or resume the last one.
        console.log("No game parameters in URL. Initializing a new local test game.");
        initializeNewGame(); // Default test game for P1
        return; // initializeNewGame calls fullRender and saves.
    }

    if (currentGame) {
        // Ensure current player index is correctly set if loading mid-game (already handled by save/load)
        // localPlayerId is now set based on creatorId.
        // currentPlayerIndex in the loaded game state dictates whose turn it is.
        // UI should reflect this.
        fullRender(currentGame, localPlayerId);
    } else {
        // Fallback if no game could be loaded or initialized from URL and initializeNewGame wasn't called
        console.log("No game active after URL processing. Displaying new game prompt or empty state.");
        document.getElementById('board-container').innerHTML = '<p>Start a new game or load one via URL. Check console for errors.</p>';
        // Potentially show the new game modal or some other UI
    }
}

function initializeNewGame() {
    // This function is now primarily for a user clicking "New Game" button in *this* browser,
    // or as a fallback if no URL parameters are present.
    const gameId = `game-${Date.now()}`;
    const randomSeed = Math.floor(Math.random() * 1000000); // More random seed

    currentGame = new GameState(gameId, randomSeed, {});
    currentGame.creatorId = BROWSER_PLAYER_ID; // This browser is P1 for this new game
    localPlayerId = 'player1'; // This browser is Player 1

    console.log("New local game initialized by this browser:", currentGame);
    saveGameStateToLocalStorage(currentGame);
    fullRender(currentGame, localPlayerId);

    // Clear the turn URL input or set instructional text
    const turnUrlInput = document.getElementById('turn-url');
    if (turnUrlInput) {
        turnUrlInput.value = ""; // Clear it
        turnUrlInput.placeholder = "Make your first move to generate a shareable URL.";
    }
}

// function generateNewGameURL(gameId, seed, creatorId, settings) {
//     // This function is no longer strictly needed if the first turn URL contains all new game info.
//     // However, it can be kept if we want a way to generate a "lobby" type URL before any move.
//     const baseURL = window.location.origin + window.location.pathname;
//     const params = new URLSearchParams();
//     params.append('gid', gameId);
//     params.append('seed', seed);
//     params.append('creator', creatorId);
//     // Add non-default settings to params, e.g. params.append('s_blanks', settings.blankTileCount)
//     return `${baseURL}?${params.toString()}`;
// }


document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");
    loadGameFromURLOrStorage();

    // Event Listeners for buttons
    document.getElementById('play-word-btn').addEventListener('click', handleCommitPlay);
    document.getElementById('exchange-tiles-btn').addEventListener('click', () => alert('Exchange Tiles clicked! (Not implemented)'));
    document.getElementById('pass-turn-btn').addEventListener('click', () => alert('Pass Turn clicked! (Not implemented)'));

    const newGameBtn = document.getElementById('new-game-btn');
    // const newGameModal = document.getElementById('new-game-modal'); // Modal not fully used yet
    // const startGameBtn = document.getElementById('start-game-btn');
    // const cancelNewGameBtn = document.getElementById('cancel-new-game-btn');

    if (newGameBtn) {
        newGameBtn.addEventListener('click', () => {
            // For now, "New Game" button immediately starts a new game and provides a shareable URL.
            // Later, it might open the modal for settings.
            initializeNewGame();
        });
    }

    // Modal interaction logic (can be expanded when settings are added to modal)
    // if (newGameModal && newGameBtn) {
    //     newGameBtn.addEventListener('click', () => {
    //         newGameModal.style.display = 'block';
    //     });
    // }
    // if (startGameBtn && newGameModal) {
    //     startGameBtn.addEventListener('click', () => {
    //         // TODO: Get settings from modal
    //         initializeNewGame(); // Will eventually pass settings
    //         newGameModal.style.display = 'none';
    //     });
    // }
    // if (cancelNewGameBtn && newGameModal) {
    //     cancelNewGameBtn.addEventListener('click', () => {
    //         newGameModal.style.display = 'none';
    //     });
    // }

});
