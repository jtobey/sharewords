import {
    validatePlacement,
    identifyAllPlayedWords,
    calculateWordScore,
    handleCommitPlay
} from './scoring.js';
import {
    GameState,
    Tile,
    Board,
    Player
} from './types.js';

// --- Test Framework ---
const testSuite = [];
let testsPassed = 0;
let testsFailed = 0;

function test(testName, testFunction) {
    testSuite.push({
        name: testName,
        fn: testFunction
    });
}

async function runTests() {
    for (const testCase of testSuite) {
        try {
            await testCase.fn();
            console.log(`%c[PASS] ${testCase.name}`, 'color: green;');
            testsPassed++;
        } catch (error) {
            console.error(`%c[FAIL] ${testCase.name}`, 'color: red;');
            console.error(error);
            testsFailed++;
        }
    }
    console.log(`\n--- Test Summary ---`);
    console.log(`Total Tests: ${testSuite.length}`);
    console.log(`%cPassed: ${testsPassed}`, 'color: green;');
    console.log(`%cFailed: ${testsFailed}`, 'color: red;');
}

function assertEquals(expected, actual, message) {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        throw new Error(`Assertion failed: ${message || ''}. Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}.`);
    }
}
// Basic assertion function for deep equality
function assertDeepEquals(expected, actual, message) {
    const areEqual = JSON.stringify(expected) === JSON.stringify(actual);
    if (!areEqual) {
        throw new Error(message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
    }
}


function assertTrue(value, message) {
    if (value !== true) {
        throw new Error(message || `Expected true but got ${value}`);
    }
}
// --- Mocks and Test Data ---

function createMockGame(turnNumber = 1) {
    const game = new GameState('test-game', 12345);
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

// --- Test Cases ---

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
    assertTrue(result.isValid, 'First move on center should be valid');
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
    assertFalse(result.isValid, 'First move off center should be invalid');
});

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
    assertEquals(1, words.length, 'Should identify one word');
    const wordStr = words[0].map(t => t.tile.letter).join('');
    assertEquals('WORD', wordStr, 'The identified word should be "WORD"');
});

test('identifyAllPlayedWords: Main word and one cross word', () => {
    const game = createMockGame();
    // Pre-existing tile
    game.board.grid[6][8].tile = new Tile('A', 1);
    game.board.grid[8][8].tile = new Tile('T', 1);

    const moves = createMockMoves([{
        letter: 'C',
        value: 3,
        pos: {
            row: 7,
            col: 8
        }
    }, {
        letter: 'R',
        value: 1,
        pos: {
            row: 7,
            col: 7
        }
    }, {
        letter: 'S',
        value: 1,
        pos: {
            row: 7,
            col: 9
        }
    }]);
    moves.forEach(m => game.board.grid[m.to.row][m.to.col].tile = m.tileRef);

    const words = identifyAllPlayedWords(moves, game.board, 'horizontal');
    assertEquals(2, words.length, 'Should identify two words');
    const wordStrings = words.map(w => w.map(t => t.tile.letter).join('')).sort();
    assertDeepEquals(['ACT', 'CRS'], wordStrings, 'Should identify "CRS" and "ACT"');
});

test('calculateWordScore: Simple word, no bonuses', () => {
    const game = createMockGame();
    const moves = createMockMoves([{
        letter: 'W',
        value: 4,
        pos: {
            row: 0,
            col: 0
        }
    }, {
        letter: 'O',
        value: 1,
        pos: {
            row: 0,
            col: 1
        }
    }]);
    moves.forEach(m => game.board.grid[m.to.row][m.to.col].tile = m.tileRef);
    const words = identifyAllPlayedWords(moves, game.board, 'horizontal');
    const scoreResult = calculateWordScore(words, game.board, moves, game.settings);
    assertEquals(5, scoreResult.score, "Score for 'WO' should be 5");
});

test('calculateWordScore: Word with letter and word bonuses', () => {
    const game = createMockGame();
    // Pre-existing tile
    game.board.grid[7][7] = new Tile('A', 1); // Not a new move

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
    // Word is CAT. C is on DW, T is on TL.
    // Score = (1 + 3 + 1*3) * 2 = 14
    assertEquals(14, scoreResult.score, "Score for CAT with DW and TL should be 14");
});

test('handleCommitPlay: Valid play with function-based dictionary', async () => {
    const game = createMockGame(0);
    game.settings.dictionaryType = 'function';
    game.settings.dictionaryUrlOrFunction = (word) => {
        return word === 'cat';
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

    assertTrue(result.success, 'handleCommitPlay should succeed');
    assertEquals(10, result.score, 'Score for CAT on center (2W) should be (3+1+1)*2=10');
    assertEquals(1, game.turnNumber, 'Turn number should advance');
});

test('handleCommitPlay: Invalid word with function-based dictionary', async () => {
    const game = createMockGame(0);
    game.settings.dictionaryType = 'function';
    game.settings.dictionaryUrlOrFunction = (word) => {
        return word === 'valid';
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

    assertFalse(result.success, 'handleCommitPlay should fail for invalid word');
    assertEquals(0, game.turnNumber, 'Turn number should not advance on failure');
});


// --- Run All Tests ---
runTests();

function runTest(testName, testFunction) {
    try {
        testFunction();
        console.log(`%c[PASS] ${testName}`, 'color: green;');
    } catch (error) {
        console.error(`%c[FAIL] ${testName}`, 'color: red;');
        console.error(error);
    }
}

function assertEquals(expected, actual, message) {
    if (expected !== actual) {
        throw new Error(`Assertion failed: ${message}. Expected ${expected}, but got ${actual}.`);
    }
}

function assertTrue(actual, message) {
    if (!actual) {
        throw new Error(`Assertion failed: ${message}. Expected true, but got false.`);
    }
}

function assertFalse(value, message) {
    if (value !== false) {
        throw new Error(message || `Expected false but got ${value}`);
    }
}

function assertDeepEquals(expected, actual, message) {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        throw new Error(`Assertion failed: ${message}. Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}.`);
    }
}

runTest('validatePlacement should return true for valid first move', () => {
    const moves = [{
        tileRef: new Tile('A', 1),
        to: {
            row: 7,
            col: 7
        }
    }];
    const turnNumber = 0;
    const boardState = new Board();
    const result = validatePlacement(moves, turnNumber, boardState);
    assertTrue(result.isValid, 'Valid first move should be valid');
});

runTest('identifyAllPlayedWords should identify a horizontal word', () => {
    const board = new Board();
    const moves = [{
        tileRef: new Tile('W', 4),
        to: {
            row: 7,
            col: 7
        }
    }, {
        tileRef: new Tile('O', 1),
        to: {
            row: 7,
            col: 8
        }
    }, {
        tileRef: new Tile('R', 1),
        to: {
            row: 7,
            col: 9
        }
    }, {
        tileRef: new Tile('D', 2),
        to: {
            row: 7,
            col: 10
        }
    }, ];
    moves.forEach(move => {
        board.grid[move.to.row][move.to.col].tile = move.tileRef;
    });
    const words = identifyAllPlayedWords(moves, board, 'horizontal');
    assertEquals(1, words.length, 'Should identify one word');
    assertEquals(4, words[0].length, 'Word should have 4 letters');
    assertEquals('WORD', words[0].map(t => t.tile.letter).join(''), 'Word should be WORD');
});

runTest('calculateWordScore should calculate the score for a word', () => {
    const board = new Board();
    const moves = [{
        tileRef: new Tile('W', 4),
        to: {
            row: 7,
            col: 7
        }
    }, {
        tileRef: new Tile('O', 1),
        to: {
            row: 7,
            col: 8
        }
    }, {
        tileRef: new Tile('R', 1),
        to: {
            row: 7,
            col: 9
        }
    }, {
        tileRef: new Tile('D', 2),
        to: {
            row: 7,
            col: 10
        }
    }, ];
    moves.forEach(move => {
        board.grid[move.to.row][move.to.col].tile = move.tileRef;
    });
    const words = identifyAllPlayedWords(moves, board, 'horizontal');
    const scoreResult = calculateWordScore(words, board, moves, {});
    assertEquals(16, scoreResult.score, 'Score should be 16');
});

runTest('handleCommitPlay should commit a play', async () => {
    const game = new GameState('test-game', 12345);
    game.currentTurnMoves = [{
        tileId: 'tile-1',
        tileRef: new Tile('W', 4),
        from: 'rack',
        to: {
            row: 7,
            col: 7
        }
    }, {
        tileId: 'tile-2',
        tileRef: new Tile('O', 1),
        from: 'rack',
        to: {
            row: 7,
            col: 8
        }
    }, {
        tileId: 'tile-3',
        tileRef: new Tile('R', 1),
        from: 'rack',
        to: {
            row: 7,
            col: 9
        }
    }, {
        tileId: 'tile-4',
        tileRef: new Tile('D', 2),
        from: 'rack',
        to: {
            row: 7,
            col: 10
        }
    }, ];
    game.currentTurnMoves.forEach(move => {
        game.board.grid[move.to.row][move.to.col].tile = move.tileRef;
    });
    game.settings.dictionaryType = 'function';
    game.settings.dictionaryUrlOrFunction = () => true;
    const result = await handleCommitPlayLogic(game, 'player1');
    assertTrue(result.success, 'Should be able to commit play');
    assertEquals(16, result.score, 'Score should be 16');
});
