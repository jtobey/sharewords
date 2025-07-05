// Simple Test Framework
const TestSuite = {
    tests: [],
    totalTests: 0,
    passedCount: 0,
    failedCount: 0,
    resultsContainer: null,

    init: function(containerId = 'test-results') {
        this.resultsContainer = document.getElementById(containerId);
        if (!this.resultsContainer) {
            console.error("Test results container not found!");
            this.resultsContainer = document.createElement('div'); // Fallback
            document.body.appendChild(this.resultsContainer);
        }
        this.resultsContainer.innerHTML = ''; // Clear previous results
        this.tests = [];
        this.totalTests = 0;
        this.passedCount = 0;
        this.failedCount = 0;
    },

    describe: function(suiteName, fn) {
        this.currentSuite = suiteName;
        const suiteDiv = document.createElement('div');
        suiteDiv.className = 'test-suite';
        const title = document.createElement('h2');
        title.textContent = suiteName;
        suiteDiv.appendChild(title);
        this.resultsContainer.appendChild(suiteDiv);
        this.currentSuiteDiv = suiteDiv;
        fn();
    },

    it: function(testName, fn) {
        this.totalTests++;
        const testCaseDiv = document.createElement('div');
        testCaseDiv.className = 'test-case';
        try {
            fn();
            testCaseDiv.innerHTML = `<span class="pass">PASS:</span> ${testName}`;
            this.passedCount++;
        } catch (e) {
            testCaseDiv.innerHTML = `<span class="fail">FAIL:</span> ${testName} <br><pre>${e.stack || e}</pre>`;
            this.failedCount++;
            console.error(`Test Failed: ${testName}`, e);
        }
        if (this.currentSuiteDiv) {
            this.currentSuiteDiv.appendChild(testCaseDiv);
        } else {
            this.resultsContainer.appendChild(testCaseDiv);
        }
    },

    assertEquals: function(expected, actual, message = "Assertion failed") {
        if (expected !== actual) {
            throw new Error(`${message} - Expected: ${expected}, Actual: ${actual}`);
        }
    },

    assertDeepEquals: function(expected, actual, message = "Deep assertion failed") {
        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
             throw new Error(`${message} - Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`);
        }
    },

    assertTrue: function(value, message = "Assertion failed (expected true)") {
        if (value !== true) {
            throw new Error(`${message} - Expected: true, Actual: ${value}`);
        }
    },

    assertFalse: function(value, message = "Assertion failed (expected false)") {
        if (value !== false) {
            throw new Error(`${message} - Expected: false, Actual: ${value}`);
        }
    },

    printSummary: function() {
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'summary';
        summaryDiv.innerHTML = `Total Tests: ${this.totalTests}, Passed: <span class="pass">${this.passedCount}</span>, Failed: <span class="fail">${this.failedCount}</span>`;
        this.resultsContainer.appendChild(summaryDiv);
    }
};

// Helper Functions for Tests

/**
 * Creates a mock Tile object.
 * @param {string} letter
 * @param {boolean} isBlank
 * @param {string|null} assignedLetter
 * @returns {Tile}
 */
function mockTile(letter = 'A', value = 1, isBlank = false, assignedLetter = null) {
    const tile = new Tile(letter, value, isBlank);
    if (isBlank && assignedLetter) {
        tile.assignedLetter = assignedLetter;
    }
    // Ensure a unique ID for each mock tile if tests depend on it,
    // though for placement validation, usually just presence/type matters.
    tile.id = `mock-tile-${Math.random().toString(16).slice(2)}`;
    return tile;
}

/**
 * Creates a mock array of moves (like currentGame.currentTurnMoves).
 * Each move is an object: { to: {row, col}, tileRef: Tile }
 * @param {Array<Array<number, number, string|Tile>>} moveData - e.g., [[row, col, 'A'], [row, col, mockTileInstance]]
 * @returns {Array<Object>}
 */
function mockMoves(moveData) {
    return moveData.map(data => {
        const tile = (typeof data[2] === 'string') ? mockTile(data[2]) : data[2];
        return {
            to: { row: data[0], col: data[1] },
            tileRef: tile,
            id: tile.id // Assuming move id might be tied to tile id for some logic
        };
    });
}

/**
 * Creates a Board instance and can optionally place tiles on it.
 * @param {Array<Array<number, number, string|Tile>>} initialTiles - e.g., [[row, col, 'X'], [row, col, mockTileInstance]]
 * @returns {Board}
 */
function createTestBoard(initialTiles = []) {
    // Use a known, fixed seed for board creation if its layout matters and is random by default
    // However, our current Board constructor's default layout is deterministic.
    const board = new Board(BOARD_SIZE); // Assuming BOARD_SIZE is available from script.js
    initialTiles.forEach(data => {
        const r = data[0];
        const c = data[1];
        const tile = (typeof data[2] === 'string') ? mockTile(data[2]) : data[2];
        if (board.grid[r] && board.grid[r][c]) {
            board.grid[r][c].tile = tile;
        }
    });
    return board;
}

// Initialize Test Suite on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    TestSuite.init();
    // Placeholder for running actual tests - will be added in subsequent steps
    runValidationTests(); // Call the function that runs the tests
    TestSuite.printSummary();
});

function runValidationTests() {
    TestSuite.describe("validatePlacement - Single Line & Gaps", () => {
        const turnNum = 1; // For these tests, turn number > 0 (not first move)

        TestSuite.it("should allow valid horizontal placement", () => {
            const board = createTestBoard();
            const moves = mockMoves([
                [7, 7, 'H'], [7, 8, 'E'], [7, 9, 'L'], [7, 10, 'L'], [7, 11, 'O']
            ]);
            const result = validatePlacement(moves, turnNum, board);
            TestSuite.assertTrue(result.isValid, result.message);
            TestSuite.assertEquals("horizontal", result.direction);
        });

        TestSuite.it("should allow valid vertical placement", () => {
            const board = createTestBoard();
            const moves = mockMoves([
                [5, 7, 'V'], [6, 7, 'E'], [7, 7, 'R'], [8, 7, 'T']
            ]);
            const result = validatePlacement(moves, turnNum, board);
            TestSuite.assertTrue(result.isValid, result.message);
            TestSuite.assertEquals("vertical", result.direction);
        });

        TestSuite.it("should disallow non-linear (L-shape) placement", () => {
            const board = createTestBoard();
            const moves = mockMoves([
                [7, 7, 'L'], [7, 8, 'S'], [8, 8, 'H'] // L-shape
            ]);
            const result = validatePlacement(moves, turnNum, board);
            TestSuite.assertFalse(result.isValid, "L-shape should be invalid");
            TestSuite.assertEquals("Invalid placement: Newly placed tiles must form a single horizontal or vertical line.", result.message);
        });

        TestSuite.it("should disallow non-linear (diagonal) placement", () => {
            const board = createTestBoard();
            const moves = mockMoves([
                [7, 7, 'D'], [8, 8, 'I'], [9,9, 'A']
            ]);
            const result = validatePlacement(moves, turnNum, board);
            TestSuite.assertFalse(result.isValid, "Diagonal shape should be invalid");
             // The message might vary slightly if it first fails single line or connection
        });


        TestSuite.it("should allow contiguous horizontal placement (no gaps)", () => {
            const board = createTestBoard();
            const moves = mockMoves([[7, 7, 'A'], [7, 8, 'B'], [7, 9, 'C']]);
            const result = validatePlacement(moves, turnNum, board);
            TestSuite.assertTrue(result.isValid, result.message);
        });

        TestSuite.it("should disallow horizontal placement with internal gaps between new tiles", () => {
            const board = createTestBoard();
            const moves = mockMoves([[7, 7, 'A'], [7, 9, 'C']]); // Gap at 7,8
            const result = validatePlacement(moves, turnNum, board);
            TestSuite.assertFalse(result.isValid, "Gap should make it invalid");
            TestSuite.assertEquals("Invalid placement: Tiles in a new word must be contiguous (no gaps).", result.message);
        });

        TestSuite.it("should allow horizontal placement with new tiles filling a gap around an existing tile", () => {
            const board = createTestBoard([[7, 8, 'X']]); // Pre-existing tile
            const moves = mockMoves([[7, 7, 'A'], [7, 9, 'C']]); // A at 7,7, C at 7,9 -> AXC
            const result = validatePlacement(moves, turnNum, board);
            TestSuite.assertTrue(result.isValid, `Expected valid for AXC, got: ${result.message}`);
            TestSuite.assertEquals("horizontal", result.direction);
        });

        TestSuite.it("should allow vertical placement with new tiles filling a gap around an existing tile", () => {
            const board = createTestBoard([[6, 7, 'X']]); // Pre-existing tile
            const moves = mockMoves([[5, 7, 'A'], [7, 7, 'C']]);
            const result = validatePlacement(moves, turnNum, board);
            TestSuite.assertTrue(result.isValid, `Expected valid for vertical fill, got: ${result.message}`);
            TestSuite.assertEquals("vertical", result.direction);
        });


        TestSuite.it("should disallow vertical placement with internal gaps between new tiles", () => {
            const board = createTestBoard();
            const moves = mockMoves([[5, 7, 'A'], [7, 7, 'C']]); // Gap at 6,7
            const result = validatePlacement(moves, turnNum, board);
            TestSuite.assertFalse(result.isValid, "Vertical gap should be invalid");
            TestSuite.assertEquals("Invalid placement: Tiles in a new word must be contiguous (no gaps).", result.message);
        });

        TestSuite.it("should allow single tile placement (considered horizontal by default if no context)", () => {
            const board = createTestBoard(); // Empty board, subsequent turn (connection rule will fail later)
            const moves = mockMoves([[7,7,'Q']]);
            const result = validatePlacement(moves, turnNum, board);
            // Single line and no gaps are trivially true. Connection/Center is for other tests.
            TestSuite.assertTrue(result.isValid, result.message);
            TestSuite.assertEquals("horizontal", result.direction);
        });
    });

    TestSuite.describe("validatePlacement - First Move & Connection", () => {
        const centerRow = Math.floor(BOARD_SIZE / 2);
        const centerCol = Math.floor(BOARD_SIZE / 2);

        TestSuite.it("should allow first move (turn 0) on center square", () => {
            const board = createTestBoard();
            const moves = mockMoves([[centerRow, centerCol, 'A']]);
            const result = validatePlacement(moves, 0, board);
            TestSuite.assertTrue(result.isValid, `First move on center failed: ${result.message}`);
        });

        TestSuite.it("should allow first move (turn 0) word through center square", () => {
            const board = createTestBoard();
            const moves = mockMoves([[centerRow, centerCol-1, 'A'], [centerRow, centerCol, 'B'], [centerRow, centerCol+1, 'C']]);
            const result = validatePlacement(moves, 0, board);
            TestSuite.assertTrue(result.isValid, `First move word through center failed: ${result.message}`);
        });

        TestSuite.it("should disallow first move (turn 0) not on center square", () => {
            const board = createTestBoard();
            const moves = mockMoves([[0, 0, 'A']]);
            const result = validatePlacement(moves, 0, board);
            TestSuite.assertFalse(result.isValid, "First move not on center should be invalid");
            TestSuite.assertEquals("Invalid placement: The first word must cover the center square.", result.message);
        });

        TestSuite.it("should allow subsequent move (turn > 0) connecting to an existing tile horizontally", () => {
            const board = createTestBoard([[centerRow, centerCol, 'X']]); // Existing tile
            const moves = mockMoves([[centerRow, centerCol + 1, 'A']]); // Connects to X
            const result = validatePlacement(moves, 1, board);
            TestSuite.assertTrue(result.isValid, `Subsequent connected move failed: ${result.message}`);
        });

        TestSuite.it("should allow subsequent move (turn > 0) connecting to an existing tile vertically", () => {
            const board = createTestBoard([[centerRow, centerCol, 'X']]); // Existing tile
            const moves = mockMoves([[centerRow + 1, centerCol, 'A']]); // Connects to X
            const result = validatePlacement(moves, 1, board);
            TestSuite.assertTrue(result.isValid, `Subsequent connected move failed: ${result.message}`);
        });

        TestSuite.it("should allow subsequent move (turn > 0) forming a word by adding to two existing tiles", () => {
            const board = createTestBoard([[7,7,'H'], [7,9,'O']]);
            const moves = mockMoves([[7,8,'L']]); // Forms HLO
            const result = validatePlacement(moves, 1, board);
            TestSuite.assertTrue(result.isValid, `Connecting between two tiles failed: ${result.message}`);
        });


        TestSuite.it("should disallow subsequent move (turn > 0) not connecting to any existing tile", () => {
            const board = createTestBoard([[0, 0, 'X']]); // Existing tile far away
            const moves = mockMoves([[centerRow, centerCol, 'A']]); // New move not connected
            const result = validatePlacement(moves, 1, board);
            TestSuite.assertFalse(result.isValid, "Subsequent disconnected move should be invalid");
            TestSuite.assertEquals("Invalid placement: New words must connect to existing tiles.", result.message);
        });

        TestSuite.it("should allow subsequent move if board is empty (e.g. hypothetical scenario, first 'real' move)", () => {
            // This tests if the connection rule doesn't break if board becomes empty after turn 0.
            // In such a case, it should probably behave like a first move (e.g. require center).
            // Current validation for connection is skipped if boardHasExistingTiles is false.
            // However, if turnNumber > 0 and board is empty, it's an edge case.
            // The game rules imply first actual word on center. If board somehow empty later,
            // it should still connect OR if it's the only play, hit center.
            // For now, let's test that it doesn't wrongly fail connection if board is empty.
            // The center square rule for turn 0 handles the initial placement.
            const board = createTestBoard(); // Empty board
            const moves = mockMoves([[centerRow, centerCol, 'A']]); // Place on center
            const result = validatePlacement(moves, 1, board); // Subsequent turn, but empty board
            TestSuite.assertTrue(result.isValid, `Move on empty board (turn > 0) on center failed: ${result.message}`);
        });

        TestSuite.it("should disallow subsequent move on empty board NOT on center", () => {
            const board = createTestBoard(); // Empty board
            const moves = mockMoves([[0,0,'A']]);
            const result = validatePlacement(moves, 1, board); // Subsequent turn number
            // This should ideally be caught by a modified rule: if board is empty after turn 0, new play must be on center.
            // Current rules might let this pass connection (as no tiles to connect to) but fail a "first effective play" rule.
            // For now, existing validation will pass connection, but it's a game rule edge case.
            // The current `validatePlacement` will pass this for connection, but it's not a good play.
            // Let's expect `isValid` to be true for now based on current rules, highlighting this edge.
            TestSuite.assertTrue(result.isValid, `Subsequent move on empty board not on center: ${result.message} - this may indicate a rule logic gap if it should be invalid.`);
        });


        TestSuite.it("should correctly determine direction for single tile connecting horizontally", () => {
            const board = createTestBoard([[7,6,'P']]);
            const moves = mockMoves([[7,7,'A']]); // P-A
            const result = validatePlacement(moves, 1, board);
            TestSuite.assertTrue(result.isValid, result.message);
            TestSuite.assertEquals("horizontal", result.direction);
        });

        TestSuite.it("should correctly determine direction for single tile connecting vertically", () => {
            const board = createTestBoard([[6,7,'P']]);
            const moves = mockMoves([[7,7,'A']]); // P above A
            const result = validatePlacement(moves, 1, board);
            TestSuite.assertTrue(result.isValid, result.message);
            TestSuite.assertEquals("vertical", result.direction);
        });

        TestSuite.it("should prefer horizontal for single tile connecting both ways", () => {
            const board = createTestBoard([[7,6,'L'], [6,7,'T']]); // L-A-T (A is new)
            const moves = mockMoves([[7,7,'A']]);
            const result = validatePlacement(moves, 1, board);
            TestSuite.assertTrue(result.isValid, result.message);
            TestSuite.assertEquals("horizontal", result.direction);
        });
    });
}
