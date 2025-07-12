// Simple test runner for ES modules
import { expect } from 'chai';
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
    const game = new GameState('test-game', 12345, {
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

// Simple test framework
let testsPassed = 0;
let testsFailed = 0;

function test(name, testFunction) {
    try {
        testFunction();
        console.log(`✅ PASS: ${name}`);
        testsPassed++;
    } catch (error) {
        console.log(`❌ FAIL: ${name}`);
        console.log(`   Error: ${error.message}`);
        testsFailed++;
    }
}

// --- Test Cases ---

console.log('Running Scoring Function Tests...\n');

// validatePlacement tests
test('validatePlacement: Valid first move on center', () => {
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
    expect(result.isValid).to.be.true;
});

test('validatePlacement: Invalid first move off center', () => {
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
    expect(result.isValid).to.be.false;
});

// identifyAllPlayedWords tests
test('identifyAllPlayedWords: Single horizontal word', () => {
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
    expect(words).to.have.length(1);
    const wordStr = words[0].map(t => t.tile.letter).join('');
    expect(wordStr).to.equal('WORD');
});

test('identifyAllPlayedWords: Main word and one cross word', () => {
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
    expect(words).to.have.length(2);
    const wordStrings = words.map(w => w.map(t => t.tile.letter).join('')).sort();
    expect(wordStrings).to.deep.equal(['CAT', 'CRS']);
});

// calculateWordScore tests
test('calculateWordScore: Simple word, no bonuses', () => {
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
    expect(scoreResult.score).to.equal(5);
});

test('calculateWordScore: Word with letter and word bonuses', () => {
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
    console.log(`words:${words.map(w => w.map(t => t.tile.letter).join(''))}`);
    console.log(`values:${words.map(w => w.map(t => t.tile.value).join(' '))}`);
    const scoreResult = calculateWordScore(words, game.board, moves, game.settings);
    // Word is ACT. C is on DW, T is on TL.
    // Score = (1 + 3 + 1*3) * 2 = 14
    expect(scoreResult.score).to.equal(14);
});

// handleCommitPlay tests
test('handleCommitPlay: Valid play with function-based dictionary', async () => {
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

    expect(result.success).to.be.true;
    expect(result.score).to.equal(7);
    expect(game.turnNumber).to.equal(1);
});

test('handleCommitPlay: Invalid word with function-based dictionary', async () => {
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

    expect(result.success).to.be.false;
    expect(game.turnNumber).to.equal(0);
});

// Test summary
console.log(`\n--- Test Summary ---`);
console.log(`Total Tests: ${testsPassed + testsFailed}`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log(`Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

if (testsFailed > 0) {
    process.exit(1);
}
