/**
 * @typedef {Object} User
 * @property {number} id - The user's ID.
 * @property {string} name - The user's name.
 * @property {string} email - The user's email address.
 */

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
    this.isGameOver = false;

    /** Gets the current player object. @returns {Player} */
    this.getCurrentPlayer = function() { return this.players[this.currentPlayerIndex]; };
    /** Gets the opponent player object. @returns {Player} */
    this.getOpponentPlayer = function() { return this.players[(this.currentPlayerIndex + 1) % this.players.length]; };
}

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

export { Board, BONUS_TYPES, BOARD_SIZE, DEFAULT_BOARD_LAYOUT_STRINGS, DEFAULT_LETTER_DISTRIBUTION, DEFAULT_TILE_VALUES, GameState, Player, RACK_SIZE, Square, Tile };
