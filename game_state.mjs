import {
    GameState,
    Tile
} from './types.mjs';
import {
    calculateWordScore,
    identifyAllPlayedWords
} from './scoring.mjs';

/** Prefix for keys used to store game states in LocalStorage. */
const LOCAL_STORAGE_KEY_PREFIX = "crosswordGame_";

/**
 * Loads a game state from LocalStorage by game ID.
 * Rehydrates the game state, reconstructing Tile, Square, Board, and Player objects.
 * @param {string} gameId - The ID of the game to load.
 * @param {Storage} storage - The storage object to use (e.g., localStorage).
 * @returns {{gameState: ?GameState, playerId: ?string, [message: string]}} An object containing the rehydrated GameState object and local player ID, or nulls if not found or error occurs.
 */
export function loadGameStateFromLocalStorage(gameId, storage) {
    if (!gameId) {
        return {gameState: null, playerId: null, message: "loadGameStateFromLocalStorage: No gameId provided to load."};
    }
    try {
        const storedDataString = storage.getItem(LOCAL_STORAGE_KEY_PREFIX + gameId);
        if (!storedDataString) {
            console.log(`No game data found for gameId "${gameId}" in localStorage.`);
            return {gameState: null, playerId: null};
        }
        const storedData = JSON.parse(storedDataString);

        // Create a new GameState instance. Settings are passed directly.
        // The GameState constructor handles defaults for settings not present in storedData.settings.
        const rehydratedGame = new GameState(storedData.gameId, null, storedData.settings || {});

        // Restore scalar properties
        rehydratedGame.turnNumber = storedData.turnNumber;
        rehydratedGame.currentPlayerIndex = storedData.currentPlayerIndex;
        rehydratedGame.isGameOver = storedData.isGameOver;

        // Restore the localPlayerId for this browser instance for this game.
        // This is crucial for UI behavior and turn synchronization.
        // This assignment affects the global `localPlayerId`.
        const playerId = storedData.savedLocalPlayerId || 'player1'; // Default to 'player1' if not saved

        rehydratedGame.prng.seed = storedData.randomSeed;

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
        console.log(`Game ${gameId} loaded and rehydrated from localStorage. Local player is ${playerId}. Seed is ${rehydratedGame.prng.seed}`);
        return {gameState: rehydratedGame, playerId};
    } catch (error) {
        console.error(`Error loading or rehydrating game state for gameId "${gameId}":`, error);
        return {gameState: null, playerId: null, message: `Error loading or rehydrating game state for gameId "${gameId}": ${error}`};
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
 * @param {string} playerId - The local player ID.
 * @param {URLSearchParams} params - The URLSearchParams object parsed from the turn URL.
 * @returns {boolean} True if turn data was successfully applied, false otherwise (e.g., error, desync).
 */
export function applyTurnDataFromURL(gameState, playerId, params) {
    // playerWhoseTurnItWas is the player who *just finished* their turn and sent the URL.
    // When applying this URL, this player's index in the `gameState.players` array needs to be
    // determined based on the `gameState.currentPlayerIndex` *before* it's advanced.
    // If `currentPlayerIndex` is P0, then P1 made the move. If P1, then P0 made the move.
    // This seems to be handled by the caller (`loadGameFromParamsOrStorage`) which sets currentPlayerIndex
    // *after* calling this function. So, here `gameState.getCurrentPlayer()` should still be the one who made the move.
    const playerWhoseTurnItWas = gameState.getCurrentPlayer();

    const exchangeParam = params.get('ex');
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
                    // TODO: Remove silliness.
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
                    // TODO: Remove silliness.
                    existingTileOnBoard.assignedLetter.toUpperCase() !== blanksInWord.get(i)) {
                     console.error(`applyTurnDataFromURL (Word Play): Mismatch for blank tile assignment at (${r},${c}). Board: ${existingTileOnBoard.assignedLetter}, URL: ${blanksInWord.get(i)}`);
                     return false;
                }
                // If existing tile matches, it's part of the word but not "newly placed" by *this specific turn's URL data*.
                // `newlyPlacedTilesData` only includes tiles that were empty before this URL application.
            }
        }

        // Score the turn based on the board state and the newly placed tiles identified from URL.

        if (newlyPlacedTilesData.length > 0) {
            console.log(`[DEBUG] applyTurnDataFromURL: Opponent ${playerWhoseTurnItWas.name} (id: ${playerWhoseTurnItWas.id}) reportedly played ${newlyPlacedTilesData.length} tiles. Their rack size before removal: ${playerWhoseTurnItWas.rack.length}`);
            // Log content of opponent's rack before removal for detailed debugging
            // console.log(`[DEBUG] Opponent's rack content before removal: ${playerWhoseTurnItWas.rack.map(t => t.isBlank ? '_' : t.letter).join('')}`);

            const rackToModify = [...playerWhoseTurnItWas.rack]; // Operate on a copy

            for (const playedTileInfo of newlyPlacedTilesData) {
                // playedTileInfo.tileRef is the Tile object *as placed on the board*.
                // It was created based on the URL, not taken directly from the opponent's rack model on this client.
                // We need to find a matching tile in 'rackToModify'.
                let tileToRemoveIndex = -1;
                if (playedTileInfo.tileRef.isBlank) {
                    // If the played tile was a blank, find any blank tile in the rack.
                    tileToRemoveIndex = rackToModify.findIndex(rackTile => rackTile.isBlank);
                } else {
                    // If it was a lettered tile, find that letter in the rack.
                    tileToRemoveIndex = rackToModify.findIndex(rackTile => !rackTile.isBlank && rackTile.letter === playedTileInfo.tileRef.letter);
                }

                if (tileToRemoveIndex !== -1) {
                    rackToModify.splice(tileToRemoveIndex, 1); // Remove one instance of the found tile
                } else {
                    // This is a significant issue if it occurs, indicating a desync
                    // or that the opponent's move (word from URL) is inconsistent with their rack state
                    // as represented on this client.
                    console.error(`[CRITICAL DESYNC] applyTurnDataFromURL: Cannot find tile to remove from ${playerWhoseTurnItWas.name}'s rack. Played tile data: ${playedTileInfo.tileRef.isBlank ? `Blank (assigned ${playedTileInfo.tileRef.assignedLetter})` : playedTileInfo.tileRef.letter}. Current rack: ${playerWhoseTurnItWas.rack.map(t => t.isBlank ? `_(ID:${t.id.slice(-3)})` : `${t.letter}(ID:${t.id.slice(-3)})`).join(', ')}`);
                    // Consider how to handle this error. For now, log it. The game might proceed with inconsistent state.
                }
            }
            playerWhoseTurnItWas.rack = rackToModify; // Update the actual rack in the gameState
            console.log(`[DEBUG] applyTurnDataFromURL: Opponent ${playerWhoseTurnItWas.name}'s rack size after attempted removal: ${playerWhoseTurnItWas.rack.length}`);
        }

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
            const localPlayer = gameState.players.find(p => p.id === playerId); // The player using this browser
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

export function gameSettingsFromUrlParams(params) {
    const settings = {}; // Populate with settings from turn URL
    const randomSeed = params.get('seed');
    if (randomSeed) settings.randomSeed = parseInt(randomSeed);
    const urlDictTypeTurn = params.get('dt');
    if (urlDictTypeTurn) settings.dictionaryType = urlDictTypeTurn;
    const urlDictUrlTurn = params.get('du');
    if (urlDictUrlTurn) settings.dictionaryUrlOrFunction = urlDictUrlTurn;
    try {
        const urlLetterDistTurn = params.get('ld');
        if (urlLetterDistTurn) settings.letterDistribution = JSON.parse(urlLetterDistTurn);
        const urlTileValsTurn = params.get('tv');
        if (urlTileValsTurn) settings.tileValues = JSON.parse(urlTileValsTurn);
    } catch (e) { console.error("Error parsing JSON settings from turn URL (distribution/values):", e); }
    const urlBlankCountTurn = params.get('bc');
    if (urlBlankCountTurn !== null) settings.blankTileCount = parseInt(urlBlankCountTurn);
    const urlSevenBonusTurn = params.get('sb');
    if (urlSevenBonusTurn !== null) settings.sevenTileBonus = parseInt(urlSevenBonusTurn);
    const urlCblTurn = params.get('cbl');
    if (urlCblTurn) settings.customBoardLayout = urlCblTurn.split(',');
    const p1nTurn = params.get('p1n'); const p2nTurn = params.get('p2n');
    if (p1nTurn || p2nTurn) settings.playerNames = { player1: p1nTurn || "Player 1", player2: p2nTurn || "Player 2" };
    return settings;
}

/**
 * Main function to load a game, either from URL parameters or from LocalStorage.
 * This function orchestrates the game setup or resumption process.
 * It determines if a game is being joined, continued, or started fresh.
 * @param {URLSearchParams} searchParams - URL data representing a turn outcome.
 *                                         Includes game settings if the turn is the first of the game.
 * @param {Storage} storage - The storage object to use (e.g., localStorage).
 *                            Allows for mock storage in testing.
 * @param {?GameState} gameState - The current game, if we are applying turn data to an already loaded page.
 * @param {?string} playerId - The local player ID, if we are applying turn data to an already loaded page.
 * @returns {{gameState: ?GameState, playerId: ?string, [message: string]}}
 *          An object containing the loaded GameState and local player ID (nulls on error) and an optional
 *          error message to show the user.
 */
export function loadGameFromParamsOrStorage(params, storage, gameState, playerId) {
    const urlGameId = params.get('gid');
    const urlTurnNumberStr = params.get('tn');
    const urlSeed = params.get('seed');

    if (!urlGameId) {
        console.log("No game ID in URL");
        return {gameState: null, playerId: null};
    }
    if (gameState && gameState.gameId !== urlGameId) {
        console.log(`loadGameFromParamsOrStorage: Switching game from ${gameState.gameId} to ${urlGameId}.`);
        gameState = null;
    }
    console.log(`loadGameFromParamsOrStorage: Processing 'gid' parameter: ${urlGameId}.`);
    // If gameState is already set, respect it.
    // Otherwise, attempt to load from local storage.
    if (!(gameState && playerId)) {
        const state = loadGameStateFromLocalStorage(urlGameId, storage);
        if (state.message) {
            return state;
        }
        gameState = state.gameState;
        playerId = state.playerId;
    }

    if (gameState) {
        console.log(`Game ${urlGameId} loaded or kept from LocalStorage. This browser is ${playerId}. LS Turn: ${gameState.turnNumber}.`);
        if (urlTurnNumberStr) {
            const urlTurnNumber = parseInt(urlTurnNumberStr);
            if (urlTurnNumber === gameState.turnNumber + 1) {
                console.log(`Attempting to apply turn ${urlTurnNumber} from URL to local game.`);
                if (applyTurnDataFromURL(gameState, playerId, params)) {
                    gameState.turnNumber = urlTurnNumber;
                    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
                    saveGameStateToLocalStorage(gameState, playerId, storage);
                    console.log(`Successfully applied opponent's move from URL for turn ${urlTurnNumber}. New current player: ${gameState.getCurrentPlayer().name}.`);
                } else {
                    return {gameState: null, playerId: null, message: "Failed to apply turn data from URL. The game state might be out of sync. Please check console for errors."};
                }
            } else if (urlTurnNumber <= gameState.turnNumber) {
                console.log(`URL turn ${urlTurnNumber} is not newer than local game turn ${gameState.turnNumber}. No action taken from URL turn data.`);
            } else {
                return {gameState: null, playerId: null, message: `Out of sync: URL specifies turn ${urlTurnNumber}, but local game is at turn ${gameState.turnNumber}. Load appropriate URL.`};
            }
        }
    } else { // Game not found in LocalStorage for this gid, implies joining a new game with turn URL
        if (urlSeed) {
            console.log(`New game ${urlGameId} initiated from turn URL by Player 2 (seed: ${urlSeed}).`);
            // Populate with settings from turn URL if P1 included them
            const newGameSettingsFromTurnUrl = gameSettingsFromUrlParams(params);
            gameState = new GameState(urlGameId, parseInt(urlSeed), newGameSettingsFromTurnUrl);
            playerId = 'player2';

            if (urlTurnNumberStr && parseInt(urlTurnNumberStr) === 1 && (params.has('wh') || params.has('wv') || params.get('ex') !== null)) {
                console.log("Applying Player 1's first move from turn URL during P2 setup.");
                if(applyTurnDataFromURL(gameState, playerId, params)) {
                    gameState.turnNumber = 1;
                    gameState.currentPlayerIndex = 1;
                } else {
                    console.error("Failed to apply P1's first move data when P2 created game from turn URL.");
                }
            }
            saveGameStateToLocalStorage(gameState, playerId, storage);
        } else {
            return {gameState: null, playerId: null, message: `Game ${urlGameId} (from turn URL) not found locally, and URL is missing data (seed) to start it. Please get the initial game URL from Player 1.`};
        }
    }
    return {gameState, playerId};
}

/**
 * Saves the current game state to LocalStorage.
 * Serializes complex objects like Board, Player racks, and Bag into a storable format.
 * @param {GameState} gameState - The game state object to save.
 * @param {string} playerId - The local player ID.
 * @param {Storage} storage - The storage object to use (e.g., localStorage).
 *                            Allows for mock storage in testing.
 * @returns {{success: boolean, [message: string]}}
 */
export function saveGameStateToLocalStorage(gameState, playerId, storage) {
    if (!gameState || !gameState.gameId) {
        return {success: false, message: "saveGameStateToLocalStorage: Cannot save game state - invalid gameState or gameId missing."};
    }
    try {
        // Create a serializable representation of the game state.
        // This involves mapping complex objects (like Player racks, Bag, Board grid)
        // to simpler structures that can be JSON.stringified.
        const serializableState = {
            gameId: gameState.gameId,
            randomSeed: gameState.prng.seed,
            settings: gameState.settings, // Settings are assumed to be serializable (JSON-like)
            turnNumber: gameState.turnNumber,
            currentPlayerIndex: gameState.currentPlayerIndex,
            isGameOver: gameState.isGameOver,
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
            savedLocalPlayerId: playerId // Persist which player this browser instance represents for this game
        };
        storage.setItem(LOCAL_STORAGE_KEY_PREFIX + gameState.gameId, JSON.stringify(serializableState));
        console.log(`Game ${gameState.gameId} (for local player ${playerId}) saved to storage. Seed is ${serializableState.randomSeed}.`);
    } catch (error) {
        console.error("Error saving game state to LocalStorage:", error);
        return {success: false, message: `Error saving game state to LocalStorage: ${error}`};
    }
    return {success: true};
}
