import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import {
    validatePlacement,
    identifyAllPlayedWords,
    calculateWordScore,
    handleCommitPlay,
    identifyPlayedWord,
    generateTurnUrlParams
} from './scoring.mjs';
import {
    GameState,
    Tile,
    Board,
    Player
} from './types.mjs';

// --- Test Data and Helper Functions ---

function createMockGame(turnNumber = 1) {
    const game = new GameState('test-game', {
        randomSeed: 12345,
        playerNames: {
            player1: "Player 1",
            player2: "Player 2"
        }
    });
    game.turnNumber = turnNumber;
    game.players = [new Player('player1', 'Player 1'), new Player('player2', 'Player 2')];
    game.board = new Board();
    game.currentTurnMoves = [];
    return game;
}

function createMockMoves(tiles) {
    return tiles.map(t => ({
        tileRef: new Tile(t.letter, t.value),
        to: t.pos
    }));
}

describe('Scoring Functions', () => {
    describe('validatePlacement', () => {
        it('should validate a valid first move on the center', () => {
            const moves = createMockMoves([{
                letter: 'A',
                value: 1,
                pos: {
                    row: 7,
                    col: 7
                }
            }]);
            const game = createMockGame(0);
            const result = validatePlacement(moves, game.turnNumber, game.board);
            assert.strictEqual(result.isValid, true);
        });

        it('should invalidate a first move off center', () => {
            const moves = createMockMoves([{
                letter: 'A',
                value: 1,
                pos: {
                    row: 0,
                    col: 0
                }
            }]);
            const game = createMockGame(0);
            const result = validatePlacement(moves, game.turnNumber, game.board);
            assert.strictEqual(result.isValid, false);
        });
    });

    describe('identifyAllPlayedWords', () => {
        it('should identify a single horizontal word', () => {
            const game = createMockGame();
            const moves = createMockMoves([{
                letter: 'W',
                value: 4,
                pos: {
                    row: 7,
                    col: 7
                }
            }, {
                letter: 'O',
                value: 1,
                pos: {
                    row: 7,
                    col: 8
                }
            }, {
                letter: 'R',
                value: 1,
                pos: {
                    row: 7,
                    col: 9
                }
            }, {
                letter: 'D',
                value: 2,
                pos: {
                    row: 7,
                    col: 10
                }
            }]);
            moves.forEach(m => game.board.grid[m.to.row][m.to.col].tile = m.tileRef);

            const words = identifyAllPlayedWords(moves, game.board, 'horizontal');
            assert.strictEqual(words.length, 1);
            const wordStr = words[0].map(t => t.tile.letter).join('');
            assert.strictEqual(wordStr, 'WORD');
        });

        it('should identify a main word and one cross word', () => {
            const game = createMockGame();
            // Pre-existing tile
            game.board.grid[7][7].tile = new Tile('A', 1);
            game.board.grid[7][8].tile = new Tile('T', 1);

            const moves = createMockMoves([{
                letter: 'C',
                value: 3,
                pos: {
                    row: 7,
                    col: 6
                }
            }, {
                letter: 'R',
                value: 1,
                pos: {
                    row: 8,
                    col: 6
                }
            }, {
                letter: 'S',
                value: 1,
                pos: {
                    row: 9,
                    col: 6
                }
            }]);
            moves.forEach(m => game.board.grid[m.to.row][m.to.col].tile = m.tileRef);

            const words = identifyAllPlayedWords(moves, game.board, 'vertical');
            assert.strictEqual(words.length, 2);
            const wordStrings = words.map(w => w.map(t => t.tile.letter).join('')).sort();
            assert.deepStrictEqual(wordStrings, ['CAT', 'CRS']);
        });
    });

    describe('calculateWordScore', () => {
        it('should calculate the score for a simple word with no bonuses', () => {
            const game = createMockGame();
            const moves = createMockMoves([{
                letter: 'W',
                value: 4,
                pos: {
                    row: 0,
                    col: 1
                }
            }, {
                letter: 'O',
                value: 1,
                pos: {
                    row: 0,
                    col: 2
                }
            }]);
            moves.forEach(m => game.board.grid[m.to.row][m.to.col].tile = m.tileRef);
            const words = identifyAllPlayedWords(moves, game.board, 'horizontal');
            const scoreResult = calculateWordScore(words, game.board, moves, game.settings);
            assert.strictEqual(scoreResult.score, 5);
        });

        it('should calculate the score for a word with letter and word bonuses', () => {
            const game = createMockGame();
            game.settings = {
                tileValues: {'A': 1, 'C': 3, 'T': 1}
            };
            // Pre-existing tile
            game.board.grid[7][7].tile = new Tile('A', 1); // Not a new move

            const moves = createMockMoves([{
                letter: 'C',
                value: 3,
                pos: {
                    row: 7,
                    col: 8
                }
            }, {
                letter: 'T',
                value: 1,
                pos: {
                    row: 7,
                    col: 9
                }
            }]);
            moves.forEach(m => game.board.grid[m.to.row][m.to.col].tile = m.tileRef);
            // C is on DW, T is on TL
            game.board.grid[7][8].bonus = 'dw';
            game.board.grid[7][9].bonus = 'tl';

            const words = identifyAllPlayedWords(moves, game.board, 'horizontal');
            const scoreResult = calculateWordScore(words, game.board, moves, game.settings);
            // Word is ACT. C is on DW, T is on TL.
            // Score = (1 + 3 + 1*3) * 2 = 14
            assert.strictEqual(scoreResult.score, 14);
        });
    });

    describe('handleCommitPlay', async () => {
        it('should handle a valid play with a function-based dictionary', async () => {
            const game = createMockGame(0);
            game.settings.dictionaryType = 'function';
            game.settings.dictionaryUrlOrFunction = (word) => {
                return word.toLowerCase() === 'cat';
            };
            game.currentTurnMoves = createMockMoves([{
                letter: 'C',
                value: 3,
                pos: {
                    row: 7,
                    col: 7
                }
            }, {
                letter: 'A',
                value: 1,
                pos: {
                    row: 7,
                    col: 8
                }
            }, {
                letter: 'T',
                value: 1,
                pos: {
                    row: 7,
                    col: 9
                }
            }]);
            game.currentTurnMoves.forEach(m => {
                game.board.grid[m.to.row][m.to.col].tile = m.tileRef;
            });

            const result = await handleCommitPlay(game, 'player1');

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.score, 7);
            assert.strictEqual(game.turnNumber, 1);
        });

        it('should handle an invalid word with a function-based dictionary', async () => {
            const game = createMockGame(0);
            game.settings.dictionaryType = 'function';
            game.settings.dictionaryUrlOrFunction = (word) => {
                return word.toLowerCase() === 'valid';
            };
            game.currentTurnMoves = createMockMoves([{
                letter: 'I',
                value: 1,
                pos: {
                    row: 7,
                    col: 7
                }
            }, {
                letter: 'N',
                value: 1,
                pos: {
                    row: 7,
                    col: 8
                }
            }]);
            game.currentTurnMoves.forEach(m => {
                game.board.grid[m.to.row][m.to.col].tile = m.tileRef;
            });

            const result = await handleCommitPlay(game, 'player1');

            assert.strictEqual(result.success, false);
            assert.strictEqual(game.turnNumber, 0);
            assert.strictEqual(result.error, 'Invalid words found: IN');
        });
    });
});
