import {
    BONUS_TYPES,
    DEFAULT_TILE_VALUES,
    RACK_SIZE
} from './types.js';


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
export function validatePlacement(moves, turnNumber, boardState) {
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
export function identifyPlayedWord(committedMovesInput, board, identifiedDirection) {
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
export function identifyAllPlayedWords(placedMoves, board, mainWordDirection) {
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
export function calculateWordScore(words, board, placedMoves, gameSettings) {
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
 * Handles the "Play Word" action.
 * - Validates tile placement and dictionary words.
 * - Calculates score.
 * - Updates game state (scores, draws new tiles, advances turn).
 * - Generates and displays turn URL.
 * - Saves game state.
 */
export async function handleCommitPlay(game, localPlayerId) {
    if (!game || game.getCurrentPlayer().id !== localPlayerId) {
        return {
            success: false,
            message: "It's not your turn or no game active!"
        };
    }
    if (game.currentTurnMoves.length === 0) {
        return {
            success: false,
            message: "You haven't placed any tiles."
        };
    }

    const validation = validatePlacement(game.currentTurnMoves, game.turnNumber, game.board);
    if (!validation.isValid) {
        return {
            success: false,
            message: validation.message
        };
    }
    const identifiedDirection = validation.direction;
    console.log("Placement validation passed. Direction:", identifiedDirection);

    const actualCommittedMoves = [...game.currentTurnMoves];

    // --- Dictionary Validation (if not permissive) ---
    if (game.settings.dictionaryType !== 'permissive') {
        const allWordsToValidate = identifyAllPlayedWords(actualCommittedMoves, game.board, identifiedDirection);

        if (!allWordsToValidate || allWordsToValidate.length === 0) {
            console.warn("handleCommitPlay: No words identified for dictionary validation, though placement was valid. Allowing play.");
        } else {
            for (const wordTileArray of allWordsToValidate) {
                const wordToValidateStr = wordTileArray.map(t => t.tile.isBlank ? t.tile.assignedLetter.toUpperCase() : t.tile.letter.toUpperCase()).join('');
                let validationApiUrl = "";
                let dictionaryNameForAlert = "";

                if (game.settings.dictionaryType === 'freeapi') {
                    validationApiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${wordToValidateStr.toLowerCase()}`;
                    dictionaryNameForAlert = "Free Dictionary API";
                } else if (game.settings.dictionaryType === 'custom' && game.settings.dictionaryUrl) {
                    validationApiUrl = `${game.settings.dictionaryUrl}${wordToValidateStr.toLowerCase()}`;
                    dictionaryNameForAlert = "Custom Dictionary";
                }

                if (validationApiUrl) {
                    console.log(`Validating word: "${wordToValidateStr}" using ${dictionaryNameForAlert} at URL: ${validationApiUrl}`);
                    try {
                        const response = await fetch(validationApiUrl);
                        if (!response.ok) {
                            if (response.status === 404) {
                                return {
                                    success: false,
                                    message: `Word "${wordToValidateStr}" not found in ${dictionaryNameForAlert}. Play rejected.`
                                };
                            } else {
                                return {
                                    success: false,
                                    message: `Error validating word "${wordToValidateStr}" with ${dictionaryNameForAlert} (Status: ${response.status}). Play rejected.`
                                };
                            }
                        }
                        if (game.settings.dictionaryType === 'freeapi') {
                            const data = await response.json();
                            if (!Array.isArray(data) || data.length === 0 || (data[0] && data[0].title === "No Definitions Found")) {
                                return {
                                    success: false,
                                    message: `Word "${wordToValidateStr}" not found or has no definition in ${dictionaryNameForAlert}. Play rejected.`
                                };
                            }
                        }
                        console.log(`Word "${wordToValidateStr}" is valid according to ${dictionaryNameForAlert}.`);
                    } catch (error) {
                        console.error(`Network or other error validating word "${wordToValidateStr}":`, error);
                        return {
                            success: false,
                            message: `Could not reach ${dictionaryNameForAlert} to validate "${wordToValidateStr}". Play rejected. Check connection or API status.`
                        };
                    }
                }
            }
        }
    }
    // --- End Dictionary Validation ---

    const playerWhoPlayed = game.getCurrentPlayer();

    // --- Scoring ---
    const allWordsPlayedForScoring = identifyAllPlayedWords(actualCommittedMoves, game.board, identifiedDirection);

    if (allWordsPlayedForScoring.length === 0 && actualCommittedMoves.length > 0) {
        console.warn("handleCommitPlay: No words identified for scoring, though moves were made.", actualCommittedMoves);
    }

    const scoreResult = calculateWordScore(allWordsPlayedForScoring, game.board, actualCommittedMoves, game.settings);
    playerWhoPlayed.score += scoreResult.score;
    console.log(`${playerWhoPlayed.name} scored ${scoreResult.score} points. New total score: ${playerWhoPlayed.score}`);

    // Mark bonus squares on the main game board as used
    scoreResult.usedBonusSquares.forEach(sqCoord => {
        if (game.board.grid[sqCoord.r] && game.board.grid[sqCoord.r][sqCoord.c]) {
            game.board.grid[sqCoord.r][sqCoord.c].bonusUsed = true;
            console.log(`Bonus at [${sqCoord.r},${sqCoord.c}] marked as used.`);
        }
    });
    // --- End Scoring ---

    const wordDataForURL = identifyPlayedWord(actualCommittedMoves, game.board, identifiedDirection);
    if (!wordDataForURL || !wordDataForURL.word) {
        console.warn("handleCommitPlay: Word identification for URL failed or produced no word data.");
    }

    game.currentTurnMoves = [];
    game.turnNumber++;

    const tilesPlayedCount = actualCommittedMoves.length;
    game.drawTiles(playerWhoPlayed, tilesPlayedCount);
    console.log(`${playerWhoPlayed.name} drew ${tilesPlayedCount} new tiles. Rack size: ${playerWhoPlayed.rack.length}`);

    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    console.log(`Turn ended. New current player: ${game.getCurrentPlayer().name}`);

    return {
        success: true,
        score: scoreResult.score,
        wordDataForURL: wordDataForURL
    };
}

/**
 * Generates params for a shareable URL representing the current game turn or setup.
 * Includes game ID, turn number, and data specific to the action (play, exchange, pass).
 * For the first turn by Player 1, it also includes the game seed and any custom settings.
 *
 * @param {GameState} game - The current game.
 * @param {string} playerId - The local player ID.
 * @param {?object} turnData - Data about a word play (word, location, blanks). Null for pass/exchange.
 *                             Expected structure: { word: string, start_row: number, start_col: number,
 *                                                 direction: string, blanks_info: Array<{idx: number, al: string}> }
 * @param {?number} [seed=null] - The game's random seed. Only included for P1's first turn URL.
 * @param {?object} [settings=null] - Custom game settings. Only included for P1's first turn URL.
 * @param {?string} [exchangeData=null] - Data about tile exchange.
 *                                       Empty string ("") for a pass, or comma-separated indices for exchanged tiles.
 *                                       Null if the turn is a word play.
 * @returns {URLSearchParams} The generated turn URL params.
 */
export function generateTurnUrlParams(game, playerId, turnData, seed = null, settings = null, exchangeData = null) {
    const params = new URLSearchParams();
    params.append('gid', game.gameId);
    params.append('tn', game.turnNumber);

    let effectiveSeed = seed;
    let effectiveSettings = settings;

    if (game.turnNumber === 1 && playerId === 'player1') {
        effectiveSeed = game.randomSeed;
        if (effectiveSettings === null) {
            effectiveSettings = game.settings;
        }
    }

    if (effectiveSeed !== null) {
        params.append('seed', effectiveSeed);
    }

    if (effectiveSettings && game.turnNumber === 1 && playerId === 'player1') {
        if (effectiveSettings.dictionaryType && effectiveSettings.dictionaryType !== 'permissive') {
            params.append('dt', effectiveSettings.dictionaryType);
            if (effectiveSettings.dictionaryType === 'custom' && effectiveSettings.dictionaryUrl) {
                params.append('du', effectiveSettings.dictionaryUrl);
            }
        }
        if (effectiveSettings.letterDistribution && JSON.stringify(effectiveSettings.letterDistribution) !== JSON.stringify(DEFAULT_LETTER_DISTRIBUTION)) {
            params.append('ld', JSON.stringify(effectiveSettings.letterDistribution));
        }
        if (effectiveSettings.tileValues && JSON.stringify(effectiveSettings.tileValues) !== JSON.stringify(DEFAULT_TILE_VALUES)) {
            params.append('tv', JSON.stringify(effectiveSettings.tileValues));
        }
        if (effectiveSettings.blankTileCount !== undefined && effectiveSettings.blankTileCount !== 2) {
            params.append('bc', effectiveSettings.blankTileCount);
        }
        if (effectiveSettings.sevenTileBonus !== undefined && effectiveSettings.sevenTileBonus !== 50) {
            params.append('sb', effectiveSettings.sevenTileBonus);
        }
        if (effectiveSettings.customBoardLayout && Array.isArray(effectiveSettings.customBoardLayout)) {
            const cblString = effectiveSettings.customBoardLayout.join(',');
            params.append('cbl', cblString);
        }
        if (effectiveSettings.playerNames) {
            if (effectiveSettings.playerNames.player1 && effectiveSettings.playerNames.player1 !== "Player 1") {
                params.append('p1n', effectiveSettings.playerNames.player1);
            }
            if (effectiveSettings.playerNames.player2 && effectiveSettings.playerNames.player2 !== "Player 2") {
                params.append('p2n', effectiveSettings.playerNames.player2);
            }
        }
    }

    if (exchangeData !== null) {
        params.append('ex', exchangeData);
    } else if (turnData && turnData.word) {
        params.append('wl', `${turnData.start_row}.${turnData.start_col}`);
        if (turnData.direction === 'horizontal') {
            params.append('wh', turnData.word);
        } else if (turnData.direction === 'vertical') {
            params.append('wv', turnData.word);
        }
        if (turnData.blanks_info && turnData.blanks_info.length > 0) {
            params.append('bt', turnData.blanks_info.map(bi => `${bi.idx}:${bi.al}`).join(';'));
        }
    }
    return params;
}
