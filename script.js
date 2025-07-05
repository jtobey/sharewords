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
            this.grid[r][c] = new Square(r, c, BONUS_TYPES.NONE); // Keep it simple first
        }
    }
    if (!layout) { // Apply a default layout if none provided
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
        boardSize: BOARD_SIZE, rackSize: RACK_SIZE, blankTileCount: 2, sevenTileBonus: 50,
        dictionaryType: 'permissive', dictionaryUrl: null,
        tileValues: settings.tileValues || DEFAULT_TILE_VALUES,
        letterDistribution: settings.letterDistribution || DEFAULT_LETTER_DISTRIBUTION,
        customBoardLayout: null, ...settings
    };
    this.prng = Mulberry32(this.randomSeed);
    this._initializeBag = function() { /* ... as before ... */
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
    this._shuffleBag = function() { /* ... as before ... */
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
    this.drawTiles = function(player, numTiles) { /* ... as before ... */
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
    this.board = new Board(this.settings.boardSize, this.settings.customBoardLayout || this.settings.defaultBoardLayout); // Use custom or default
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
// renderBoard, renderTileInRack, renderRacks, updateGameStatus, fullRender (mostly as before)
// ... (ensure renderBoard and renderTileInRack use .tile-letter and .tile-value classes)
function renderBoard(gameState) {
    const boardContainer = document.getElementById('board-container');
    if (!boardContainer || !gameState || !gameState.board) {
        console.error("Cannot render board: missing container or gameState.");
        return;
    }
    boardContainer.innerHTML = '';
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
            }
            if (r === centerR && c === centerC && squareData.bonus === BONUS_TYPES.NONE) { // Only add .center if no other bonus
                squareDiv.classList.add('center');
            }

            if (squareData.tile) {
                const tile = squareData.tile;
                const letterSpan = document.createElement('span');
                letterSpan.classList.add('tile-letter');
                letterSpan.textContent = tile.isBlank ? (tile.assignedLetter ? `(${tile.assignedLetter.toUpperCase()})` : '(?)') : tile.letter;

                const valueSpan = document.createElement('span');
                valueSpan.classList.add('tile-value');
                valueSpan.textContent = tile.value;

                squareDiv.innerHTML = '';
                squareDiv.appendChild(letterSpan);
                squareDiv.appendChild(valueSpan);
                squareDiv.classList.add('tile-on-board');

                const isCurrentTurnMove = currentGame.currentTurnMoves.find(m => m.tileId === tile.id && m.to.row === r && m.to.col === c);
                if (isCurrentTurnMove && currentGame.getCurrentPlayer().id === localPlayerId) {
                    squareDiv.draggable = true;
                    squareDiv.addEventListener('dragstart', handleDragStart);
                    squareDiv.addEventListener('dragend', handleDragEnd);
                    squareDiv.dataset.tileId = tile.id;
                }
            }
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
    letterSpan.classList.add('tile-letter');
    letterSpan.textContent = tile.isBlank ? '?' : tile.letter.toUpperCase();

    const valueSpan = document.createElement('span');
    valueSpan.classList.add('tile-value');
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
            rackElement.innerHTML = '';
            if (player.id === localPlayerId) {
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
                rackElement.removeEventListener('dragover', handleDragOver);
                rackElement.removeEventListener('drop', handleDropOnRack);
                for (let i = 0; i < player.rack.length; i++) {
                    const tileBack = document.createElement('div');
                    tileBack.classList.add('tile-in-rack');
                    tileBack.style.backgroundColor = "#888";
                    rackElement.appendChild(tileBack);
                }
            }
        }
    });
}

function updateGameStatus(gameState) {
    if (!gameState) return;
    document.getElementById('player1-score').textContent = gameState.players[0].score;
    document.getElementById('player2-score').textContent = gameState.players[1].score;
    document.getElementById('turn-player').textContent = gameState.getCurrentPlayer().name;
    document.getElementById('tiles-in-bag').textContent = gameState.bag.length;
}

function fullRender(gameState, localPlayerId) {
    if (!gameState) {
        document.getElementById('board-container').innerHTML = '<p>No game active. Start a new game or load one via URL.</p>';
        return;
    }
    renderBoard(gameState);
    renderRacks(gameState, localPlayerId);
    updateGameStatus(gameState);
}


// --- Drag and Drop Handlers ---
// handleDragStart, handleDragEnd, handleDragOver, handleDropOnBoard, handleDropOnRack (as before)
// ...
let draggedTileId = null;
function handleDragStart(event) {
    const currentTurnPlayerId = currentGame ? currentGame.getCurrentPlayer().id : null;
    console.log(`Drag Start Attempt: localPlayerId='${localPlayerId}', currentTurnPlayerId='${currentTurnPlayerId}'`);
    if (!currentGame || currentTurnPlayerId !== localPlayerId) {
        console.log("Drag prevented: Not current player's turn or local player mismatch.");
        event.preventDefault();
        return;
    }
    const tileElement = event.target.closest('[data-tile-id]');
    if (!tileElement) {
        event.preventDefault();
        return;
    }
    draggedTileId = tileElement.dataset.tileId;
    event.dataTransfer.setData('text/plain', draggedTileId);
    event.dataTransfer.effectAllowed = 'move';
    event.target.style.opacity = '0.5';
    console.log('Drag Start:', draggedTileId);
}
function handleDragEnd(event) {
    if(event.target) event.target.style.opacity = '1';
    draggedTileId = null;
    console.log('Drag End');
}
function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}
function handleDropOnBoard(event) {
    event.preventDefault();
    if (!draggedTileId) return;
    const targetSquareElement = event.target.closest('.square');
    if (!targetSquareElement) return;
    const row = parseInt(targetSquareElement.dataset.row);
    const col = parseInt(targetSquareElement.dataset.col);
    if (isNaN(row) || isNaN(col)) return;

    const boardSquare = currentGame.board.grid[row][col];
    if (boardSquare.tile) {
        const existingMove = currentGame.currentTurnMoves.find(move => move.tileId === draggedTileId);
        if (!existingMove || (existingMove && boardSquare.tile.id !== draggedTileId)) {
             console.log("Square already occupied by a different tile or tile is not from board.");
             return;
        }
    }

    const player = currentGame.getCurrentPlayer();
    let tile;
    let originalSourceType = 'rack';
    const existingMoveIndex = currentGame.currentTurnMoves.findIndex(move => move.tileId === draggedTileId);

    if (existingMoveIndex !== -1) {
        const move = currentGame.currentTurnMoves[existingMoveIndex];
        tile = move.tileRef;
        originalSourceType = 'board';
        let originalPosition = { row: move.to.row, col: move.to.col };
        if (originalPosition.row === row && originalPosition.col === col) {
            draggedTileId = null; fullRender(currentGame, localPlayerId); return;
        }
        currentGame.board.grid[originalPosition.row][originalPosition.col].tile = null;
        move.to = { row, col };
    } else {
        const tileIndexInRack = player.rack.findIndex(t => t.id === draggedTileId);
        if (tileIndexInRack === -1) {
            draggedTileId = null; fullRender(currentGame, localPlayerId); return;
        }
        tile = player.rack[tileIndexInRack];
        player.rack.splice(tileIndexInRack, 1);
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
    fullRender(currentGame, localPlayerId);
    draggedTileId = null;
}
function handleDropOnRack(event) {
    event.preventDefault();
    if (!draggedTileId) return;
    const player = currentGame.getCurrentPlayer();
    const rackElement = document.getElementById(`${player.id}-rack`);
    if (!rackElement || !rackElement.contains(event.target)) return;

    const moveIndex = currentGame.currentTurnMoves.findIndex(m => m.tileId === draggedTileId);
    if (moveIndex === -1) {
        console.log("Tile dragged to rack was not from board this turn."); return;
    }
    const move = currentGame.currentTurnMoves[moveIndex];
    const tile = move.tileRef;
    currentGame.board.grid[move.to.row][move.to.col].tile = null;
    player.rack.push(tile);
    if (tile.isBlank && move.from === 'rack') tile.assignedLetter = null;
    currentGame.currentTurnMoves.splice(moveIndex, 1);
    console.log(`Tile ${tile.id} (${tile.letter}) returned to rack. currentTurnMoves:`, currentGame.currentTurnMoves);
    fullRender(currentGame, localPlayerId);
    draggedTileId = null;
}

// --- Game Validation and Action Handlers ---

/**
 * Validates the placement of tiles for the current turn.
 * @param {Array<Object>} moves - Array of move objects { tileId, tileRef, from, to: {row, col} } from currentGame.currentTurnMoves
 * @param {number} turnNumber - The current game turn number (0 for the first turn).
 * @param {Board} boardState - The current game board object.
 * @returns {Object} An object { isValid: boolean, message: string, direction: string|null }
 */
function validatePlacement(moves, turnNumber, boardState) {
    const validationResult = {
        isValid: false,
        message: "",
        direction: null
    };

    if (!moves || moves.length === 0) {
        validationResult.message = "No tiles placed to validate.";
        return validationResult;
    }

    const sortedMoves = [...moves].sort((a, b) => {
        if (a.to.row === b.to.row) return a.to.col - b.to.col;
        return a.to.row - b.to.row;
    });

    let isLineHorizontal = false;
    let isLineVertical = false;

    if (sortedMoves.length > 0) {
        isLineHorizontal = sortedMoves.every(m => m.to.row === sortedMoves[0].to.row);
        isLineVertical = sortedMoves.every(m => m.to.col === sortedMoves[0].to.col);

        if (sortedMoves.length > 1 && !isLineHorizontal && !isLineVertical) {
            validationResult.message = "Invalid placement: Newly placed tiles must form a single horizontal or vertical line.";
            return validationResult;
        }
        if (sortedMoves.length === 1) {
            isLineHorizontal = true; isLineVertical = true; // A single tile is trivially in a line
        }
    }

    if (isLineHorizontal && isLineVertical && sortedMoves.length === 1) {
        const r = sortedMoves[0].to.row; const c = sortedMoves[0].to.col;
        const formsHorizontalWord = (c > 0 && boardState.grid[r][c - 1].tile) || (c < boardState.size - 1 && boardState.grid[r][c + 1].tile);
        const formsVerticalWord = (r > 0 && boardState.grid[r - 1][c].tile) || (r < boardState.size - 1 && boardState.grid[r + 1][c].tile);
        if (formsHorizontalWord) validationResult.direction = 'horizontal';
        else if (formsVerticalWord) validationResult.direction = 'vertical';
        else validationResult.direction = 'horizontal';
    } else if (isLineHorizontal) {
        validationResult.direction = 'horizontal';
    } else if (isLineVertical) {
        validationResult.direction = 'vertical';
    } else if (sortedMoves.length > 0) {
        validationResult.message = "Internal Error: Could not determine placement line logic."; return validationResult;
    }

    if (sortedMoves.length > 1) {
        const firstPlaced = sortedMoves[0].to;
        const lastPlaced = sortedMoves[sortedMoves.length - 1].to;
        if (validationResult.direction === 'horizontal') {
            for (let c = firstPlaced.col + 1; c < lastPlaced.col; c++) {
                if (!sortedMoves.some(m => m.to.row === firstPlaced.row && m.to.col === c) && !boardState.grid[firstPlaced.row][c].tile) {
                    validationResult.message = "Invalid placement: Tiles in a new word must be contiguous (no gaps)."; return validationResult;
                }
            }
        } else if (validationResult.direction === 'vertical') {
            for (let r = firstPlaced.row + 1; r < lastPlaced.row; r++) {
                 if (!sortedMoves.some(m => m.to.col === firstPlaced.col && m.to.row === r) && !boardState.grid[r][firstPlaced.col].tile) {
                    validationResult.message = "Invalid placement: Tiles in a new word must be contiguous (no gaps)."; return validationResult;
                }
            }
        }
    }

    if (turnNumber === 0) {
        const centerSquare = boardState.getCenterSquare();
        if (!sortedMoves.some(m => m.to.row === centerSquare.row && m.to.col === centerSquare.col)) {
            validationResult.message = "Invalid placement: The first word must cover the center square."; return validationResult;
        }
    } else {
        let connectsToExisting = false;
        let boardHasExistingTiles = false;
        for(let r_idx=0; r_idx < boardState.size; r_idx++) {
            for(let c_idx=0; c_idx < boardState.size; c_idx++) {
                if(boardState.grid[r_idx][c_idx].tile && !sortedMoves.some(m => m.to.row === r_idx && m.to.col === c_idx)) {
                    boardHasExistingTiles = true; break;
                }
            }
            if(boardHasExistingTiles) break;
        }
        if (boardHasExistingTiles) {
            for (const move of sortedMoves) {
                const r = move.to.row; const c = move.to.col;
                const neighbors = [[r-1, c], [r+1, c], [r, c-1], [r, c+1]];
                for (const [nr, nc] of neighbors) {
                    if (nr >= 0 && nr < boardState.size && nc >= 0 && nc < boardState.size) {
                        const neighborSquare = boardState.grid[nr][nc];
                        if (neighborSquare.tile && !sortedMoves.some(sm => sm.to.row === nr && sm.to.col === nc)) { // Check if neighbor is NOT part of current play
                            connectsToExisting = true; break;
                        }
                    }
                }
                if (connectsToExisting) break;
            }
            if (!connectsToExisting) {
                 validationResult.message = "Invalid placement: New words must connect to existing tiles."; return validationResult;
            }
        }
    }
    validationResult.isValid = true;
    return validationResult;
}

/**
 * Identifies the primary word formed by a set of moves.
 * @param {Array<Object>} committedMovesInput - The moves made in the current turn (e.g., from currentGame.currentTurnMoves).
 * @param {Board} board - The game board instance.
 * @param {string} identifiedDirection - The primary direction of the play ('horizontal' or 'vertical').
 * @returns {Object|null} An object { word, start_row, start_col, direction, blanks_info } or null.
 */
function identifyPlayedWord(committedMovesInput, board, identifiedDirection) {
    if (!identifiedDirection || !committedMovesInput || committedMovesInput.length === 0) {
        console.warn("identifyPlayedWord: No direction or no moves provided.");
        return null;
    }

    const sortedMoves = [...committedMovesInput].sort((a, b) => {
        if (identifiedDirection === 'horizontal') return a.to.col - b.to.col;
        return a.to.row - b.to.row;
    });

    const firstNewTilePos = sortedMoves[0].to;
    let wordString = "";
    let startRow = firstNewTilePos.row;
    let startCol = firstNewTilePos.col;

    if (identifiedDirection === 'horizontal') {
        while (startCol > 0 && board.grid[startRow][startCol - 1].tile) {
            startCol--;
        }
        let endColScan = sortedMoves[sortedMoves.length - 1].to.col;
        while (endColScan < board.size - 1 && board.grid[startRow][endColScan + 1].tile) {
            endColScan++;
        }
        for (let c = startCol; c <= endColScan; c++) {
            const tileOnSquare = board.grid[startRow][c].tile;
            if (tileOnSquare) {
                wordString += tileOnSquare.isBlank ? tileOnSquare.assignedLetter.toUpperCase() : tileOnSquare.letter.toUpperCase();
            } else {
                console.error(`Gap found at ${startRow},${c} during horizontal word identification.`);
                wordString += '?';
            }
        }
    } else { // Vertical
        while (startRow > 0 && board.grid[startRow - 1][startCol].tile) {
            startRow--;
        }
        let endRowScan = sortedMoves[sortedMoves.length - 1].to.row;
        while (endRowScan < board.size - 1 && board.grid[endRowScan + 1][startCol].tile) {
            endRowScan++;
        }
        for (let r = startRow; r <= endRowScan; r++) {
            const tileOnSquare = board.grid[r][startCol].tile;
            if (tileOnSquare) {
                wordString += tileOnSquare.isBlank ? tileOnSquare.assignedLetter.toUpperCase() : tileOnSquare.letter.toUpperCase();
            } else {
                console.error(`Gap found at ${r},${startCol} during vertical word identification.`);
                wordString += '?';
            }
        }
    }

    const blanksInfo = [];
    committedMovesInput.forEach(move => {
        if (move.tileRef.isBlank) {
            let indexInWord = -1;
            if (identifiedDirection === 'horizontal') {
                indexInWord = move.to.col - startCol;
            } else {
                indexInWord = move.to.row - startRow;
            }
            if (indexInWord >= 0 && indexInWord < wordString.length) {
                blanksInfo.push({ idx: indexInWord, al: move.tileRef.assignedLetter.toUpperCase() });
            }
        }
    });

    if (wordString.includes('?')) {
        console.error("Error in word identification: word string contains '?'. Moves:", committedMovesInput, "Identified:", { word: wordString, start_row: startRow, start_col: startCol, direction: identifiedDirection });
        return null;
    }

    return {
        word: wordString,
        start_row: startRow,
        start_col: startCol,
        direction: identifiedDirection,
        blanks_info: blanksInfo
    };
}


function handleCommitPlay() {
    if (!currentGame || currentGame.getCurrentPlayer().id !== localPlayerId) {
        alert("It's not your turn or no game active!");
        return;
    }
    if (currentGame.currentTurnMoves.length === 0) {
        alert("You haven't placed any tiles.");
        return;
    }

    const validation = validatePlacement(currentGame.currentTurnMoves, currentGame.turnNumber, currentGame.board);
    if (!validation.isValid) {
        alert(validation.message);
        return;
    }
    const identifiedDirection = validation.direction;
    console.log("Placement validation passed. Direction:", identifiedDirection);

    const actualCommittedMoves = [...currentGame.currentTurnMoves];

    actualCommittedMoves.forEach(move => {
        const square = currentGame.board.grid[move.to.row][move.to.col];
        if (square.bonus !== BONUS_TYPES.NONE) {
            // bonus usage would be marked during scoring
        }
    });

    const wordDataForURL = identifyPlayedWord(actualCommittedMoves, currentGame.board, identifiedDirection);
    if (!wordDataForURL || !wordDataForURL.word) {
        console.warn("Word identification did not produce data for URL. URL will lack word details.");
    }

    currentGame.currentTurnMoves = [];
    currentGame.turnNumber++;

    const playerWhoPlayed = currentGame.getCurrentPlayer();
    const tilesPlayedCount = actualCommittedMoves.length;

    currentGame.drawTiles(playerWhoPlayed, tilesPlayedCount);
    console.log(`${playerWhoPlayed.name} drew ${tilesPlayedCount} tiles. Rack size: ${playerWhoPlayed.rack.length}`);

    currentGame.currentPlayerIndex = (currentGame.currentPlayerIndex + 1) % currentGame.players.length;
    console.log("Player switched. New current player:", currentGame.getCurrentPlayer().name);

    let turnURL;
    if (currentGame.turnNumber === 1 && currentGame.creatorId === BROWSER_PLAYER_ID) {
        turnURL = generateTurnURL(
            currentGame.gameId, currentGame.turnNumber, wordDataForURL,
            currentGame.randomSeed, currentGame.creatorId
        );
    } else {
        turnURL = generateTurnURL(currentGame.gameId, currentGame.turnNumber, wordDataForURL);
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

function generateTurnURL(gameId, turnNumber, turnData, seed = null, creator = null, settings = null) {
    const baseURL = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    params.append('gid', gameId);
    params.append('tn', turnNumber);

    if (seed !== null) params.append('seed', seed);
    if (creator !== null) params.append('creator', creator);

    if (turnData && turnData.word) {
        params.append('w', turnData.word);
        params.append('wl', `${turnData.start_row},${turnData.start_col}`);
        params.append('wd', turnData.direction);
        if (turnData.blanks_info && turnData.blanks_info.length > 0) {
            const blankParam = turnData.blanks_info.map(bi => `${bi.idx}:${bi.al}`).join(';');
            params.append('bt', blankParam);
        }
    }
    return `${baseURL}?${params.toString()}`;
}

// --- Game Initialization and Event Listeners ---
// ... (initializeNewGame, LocalStorage functions, applyTurnDataFromURL, loadGameFromURLOrStorage as before) ...

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
}

// --- LocalStorage Functions ---
const LOCAL_STORAGE_KEY_PREFIX = "crosswordGame_";

function getPlayerIdentifier() {
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
        const serializableState = {
            gameId: gameState.gameId, randomSeed: gameState.randomSeed, settings: gameState.settings,
            turnNumber: gameState.turnNumber, currentPlayerIndex: gameState.currentPlayerIndex,
            isGameOver: gameState.isGameOver, gameHistory: gameState.gameHistory,
            players: gameState.players.map(p => ({
                id: p.id, name: p.name, score: p.score,
                rack: p.rack.map(t => ({ letter: t.letter, value: t.value, isBlank: t.isBlank, assignedLetter: t.assignedLetter, id: t.id }))
            })),
            bag: gameState.bag.map(t => ({ letter: t.letter, value: t.value, isBlank: t.isBlank, assignedLetter: t.assignedLetter, id: t.id })),
            boardGrid: gameState.board.grid.map(row => row.map(sq => ({
                row: sq.row, col: sq.col, bonus: sq.bonus, bonusUsed: sq.bonusUsed,
                tile: sq.tile ? { letter: sq.tile.letter, value: sq.tile.value, isBlank: sq.tile.isBlank, assignedLetter: sq.tile.assignedLetter, id: sq.tile.id } : null
            }))),
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
        if (!storedDataString) return null;
        const storedData = JSON.parse(storedDataString);
        const rehydratedGame = new GameState(storedData.gameId, storedData.randomSeed, storedData.settings || {});
        rehydratedGame.turnNumber = storedData.turnNumber;
        rehydratedGame.currentPlayerIndex = storedData.currentPlayerIndex;
        rehydratedGame.isGameOver = storedData.isGameOver;
        rehydratedGame.gameHistory = storedData.gameHistory || [];
        rehydratedGame.creatorId = storedData.creatorId;
        if (storedData.players && storedData.players.length === rehydratedGame.players.length) {
            storedData.players.forEach((pd, index) => {
                rehydratedGame.players[index].score = pd.score;
                rehydratedGame.players[index].rack = pd.rack.map(td => {
                    const tile = new Tile(td.letter, td.value, td.isBlank);
                    tile.assignedLetter = td.assignedLetter; tile.id = td.id; return tile;
                });
            });
        }
        rehydratedGame.bag = storedData.bag.map(td => {
            const tile = new Tile(td.letter, td.value, td.isBlank);
            tile.assignedLetter = td.assignedLetter; tile.id = td.id; return tile;
        });
        if (storedData.boardGrid) {
            for (let r = 0; r < storedData.boardGrid.length; r++) {
                for (let c = 0; c < storedData.boardGrid[r].length; c++) {
                    const sqData = storedData.boardGrid[r][c];
                    const boardSq = rehydratedGame.board.grid[r][c];
                    boardSq.bonus = sqData.bonus; boardSq.bonusUsed = sqData.bonusUsed;
                    if (sqData.tile) {
                        const td = sqData.tile;
                        const tile = new Tile(td.letter, td.value, td.isBlank);
                        tile.assignedLetter = td.assignedLetter; tile.id = td.id;
                        boardSq.tile = tile;
                    } else { boardSq.tile = null; }
                }
            }
        }
        console.log(`Game ${gameId} loaded and rehydrated from localStorage.`);
        return rehydratedGame;
    } catch (error) {
        console.error("Error loading game state from localStorage:", error); return null;
    }
}

// --- Game Initialization and URL Handling ---
function applyTurnDataFromURL(gameState, params) {
    const word = params.get('w');
    const wordLocation = params.get('wl');
    const wordDirection = params.get('wd');
    const blankTileData = params.get('bt');

    if (word && wordLocation && wordDirection) {
        console.log(`Applying word-based turn data: ${word} at ${wordLocation} ${wordDirection}`);
        const [startRowStr, startColStr] = wordLocation.split(',');
        const startRow = parseInt(startRowStr); const startCol = parseInt(startColStr);
        if (isNaN(startRow) || isNaN(startCol)) { console.error("Invalid word location format:", wordLocation); return false; }

        const blanks = new Map();
        if (blankTileData) {
            blankTileData.split(';').forEach(item => {
                const [idxStr, al] = item.split(':'); blanks.set(parseInt(idxStr), al);
            });
        }
        for (let i = 0; i < word.length; i++) {
            const char = word[i]; let r = startRow; let c = startCol;
            if (wordDirection === 'horizontal') c += i;
            else if (wordDirection === 'vertical') r += i;
            else { console.error("Invalid word direction:", wordDirection); return false; }

            if (gameState.board.grid[r] && gameState.board.grid[r][c]) {
                if (gameState.board.grid[r][c].tile && gameState.board.grid[r][c].tile.letter !== char && !(gameState.board.grid[r][c].tile.isBlank && gameState.board.grid[r][c].tile.assignedLetter === char)) {
                    console.warn(`Square ${r},${c} already has a tile ${gameState.board.grid[r][c].tile.letter}. Overwriting with ${char} from URL.`);
                }
                let isBlankTile = false; let assignedLetterForBlank = null;
                if (blanks.has(i)) { isBlankTile = true; assignedLetterForBlank = blanks.get(i); }
                const tileLetter = isBlankTile ? '' : char;
                const newTile = new Tile(tileLetter, gameState.settings.tileValues[char.toUpperCase()] || 0, isBlankTile); // Use char.toUpperCase() for value lookup
                if (isBlankTile) newTile.assignedLetter = assignedLetterForBlank;
                gameState.board.grid[r][c].tile = newTile;
            } else { console.error(`Invalid square coordinates for word placement: ${r},${c}`); return false; }
        }
        return true;
    }
    console.log("No word-based turn data (w, wl, wd) found in URL params to apply.");
    return false;
}

function loadGameFromURLOrStorage() {
    const params = new URLSearchParams(window.location.search);
    const urlGameId = params.get('gid');
    const urlTurnNumberStr = params.get('tn');
    const urlSeed = params.get('seed');

    if (urlGameId) {
        console.log(`URL contains gameId: ${urlGameId}`);
        currentGame = loadGameStateFromLocalStorage(urlGameId);
        if (currentGame) {
            if (currentGame.creatorId === BROWSER_PLAYER_ID) localPlayerId = 'player1';
            else localPlayerId = 'player2';
            console.log(`Game ${urlGameId} loaded from storage. This browser is ${localPlayerId}. Current turn: ${currentGame.turnNumber}`);

            if (urlTurnNumberStr) {
                const urlTurnNumber = parseInt(urlTurnNumberStr);
                if (urlTurnNumber === currentGame.turnNumber + 1) {
                    console.log(`Attempting to apply turn ${urlTurnNumber} from URL.`);
                    if (applyTurnDataFromURL(currentGame, params)) {
                        currentGame.turnNumber = urlTurnNumber;
                        if (params.get('w')) { // if there was word data, implies a move was made
                             currentGame.currentPlayerIndex = (currentGame.currentPlayerIndex + 1) % currentGame.players.length;
                        }
                        saveGameStateToLocalStorage(currentGame);
                        console.log(`Successfully applied turn ${urlTurnNumber}. New current player index: ${currentGame.currentPlayerIndex}`);
                    } else {
                        if (!params.get('w') && !params.get('bt')) { // No word data implies pass/exchange
                             currentGame.turnNumber = urlTurnNumber;
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
        } else {
            if (urlSeed && (!urlTurnNumberStr || parseInt(urlTurnNumberStr) <= 1)) {
                console.log(`New game ${urlGameId} from URL with seed ${urlSeed}. Assuming this client is Player 2.`);
                currentGame = new GameState(urlGameId, parseInt(urlSeed), {});
                localPlayerId = 'player2';
                currentGame.creatorId = params.get('creator') || null;
                if (urlTurnNumberStr && parseInt(urlTurnNumberStr) === 1 && (params.has('w'))) {
                    if(applyTurnDataFromURL(currentGame, params)) {
                        currentGame.turnNumber = 1;
                        currentGame.currentPlayerIndex = 1;
                        console.log("Applied P1's first move for P2. Current player index:", currentGame.currentPlayerIndex);
                    } else {
                        console.error("Failed to apply P1's first move data for P2.");
                    }
                }
                saveGameStateToLocalStorage(currentGame);
            } else {
                 alert(`Game ${urlGameId} not found locally. Please ensure you have the complete game history or the initial new game URL.`);
                 document.getElementById('board-container').innerHTML = `<p>Error: Game ${urlGameId} not found. Cannot apply turn ${urlTurnNumberStr}.</p>`;
                 return;
            }
        }
    } else if (urlSeed) {
        console.log(`New game from URL with seed ${urlSeed}. This client is Player 1.`);
        const newGameId = urlGameId || `game-${Date.now()}`;
        currentGame = new GameState(newGameId, parseInt(urlSeed), {});
        currentGame.creatorId = BROWSER_PLAYER_ID;
        localPlayerId = 'player1';
        saveGameStateToLocalStorage(currentGame);
    } else {
        console.log("No game parameters in URL. Initializing a new local test game.");
        initializeNewGame();
        return;
    }

    if (currentGame) {
        fullRender(currentGame, localPlayerId);
    } else {
        console.log("No game active after URL processing. Displaying new game prompt or empty state.");
        document.getElementById('board-container').innerHTML = '<p>Start a new game or load one via URL. Check console for errors.</p>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");
    loadGameFromURLOrStorage();

    document.getElementById('play-word-btn').addEventListener('click', handleCommitPlay);
    document.getElementById('exchange-tiles-btn').addEventListener('click', () => alert('Exchange Tiles clicked! (Not implemented)'));
    document.getElementById('pass-turn-btn').addEventListener('click', () => alert('Pass Turn clicked! (Not implemented)'));

    const newGameBtn = document.getElementById('new-game-btn');
    if (newGameBtn) {
        newGameBtn.addEventListener('click', () => {
            initializeNewGame();
        });
    }
});

[end of script.js]
