// Simple Test Framework
const TestSuite = {
    tests: [],
    totalTests: 0,
    passedCount: 0,
    failedCount: 0,
    resultsContainer: null,
    currentSuite: "",
    currentSuiteDiv: null,

    init: function(containerId = 'test-results') {
        this.resultsContainer = document.getElementById(containerId);
        if (!this.resultsContainer) {
            console.error("Test results container not found! Creating one.");
            this.resultsContainer = document.createElement('div');
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
        this.currentSuiteDiv = null; // Reset after suite
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
            console.error(`Test Failed: ${this.currentSuite} - ${testName}`, e);
        }
        if (this.currentSuiteDiv) {
            this.currentSuiteDiv.appendChild(testCaseDiv);
        } else {
            this.resultsContainer.appendChild(testCaseDiv); // Should ideally always be in a suite
        }
    },

    assertEquals: function(expected, actual, message = "Assertion failed") {
        if (expected !== actual) {
            throw new Error(`${message} - Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`);
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
function mockTile(letter = 'A', value = 1, isBlank = false, assignedLetter = null) {
    const tile = new Tile(letter, value, isBlank);
    if (isBlank && assignedLetter) {
        tile.assignedLetter = assignedLetter;
    }
    tile.id = `mock-tile-${Math.random().toString(16).slice(2)}`;
    return tile;
}

function mockMoves(moveData) {
    return moveData.map(data => {
        const tile = (typeof data[2] === 'string') ? mockTile(data[2]) : data[2];
        return {
            to: { row: data[0], col: data[1] },
            tileRef: tile,
            id: tile.id
        };
    });
}

function createTestBoard(initialTiles = []) {
    const board = new Board(BOARD_SIZE);
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

// --- Mock Storage and Test Environment Setup ---
let mockStorageP1 = {};
let mockStorageP2 = {};
let originalLocalStorageGetItem = localStorage.getItem;
let originalLocalStorageSetItem = localStorage.setItem;
let originalLocalStorageRemoveItem = localStorage.removeItem;
let currentMockStorage = null;
let original_BROWSER_PLAYER_ID = null;
let original_localPlayerId = null;
let original_window_location_search = null;


function mockLocalStorageFunctions() {
    originalLocalStorageGetItem = localStorage.getItem;
    originalLocalStorageSetItem = localStorage.setItem;
    originalLocalStorageRemoveItem = localStorage.removeItem;

    localStorage.getItem = (key) => currentMockStorage ? (currentMockStorage[key] || null) : null;
    localStorage.setItem = (key, value) => {
        if (currentMockStorage) currentMockStorage[key] = value.toString();
    };
    localStorage.removeItem = (key) => {
        if (currentMockStorage) delete currentMockStorage[key];
    };
}

function restoreLocalStorageFunctions() {
    localStorage.getItem = originalLocalStorageGetItem;
    localStorage.setItem = originalLocalStorageSetItem;
    localStorage.removeItem = originalLocalStorageRemoveItem;
}

function setupTestEnvironment(playerPerspective, gameIdToClear = null, searchString = "") {
    console.log(`Setting up test environment for: ${playerPerspective}, clearing game: ${gameIdToClear}, URL search: '${searchString}'`);

    if (original_BROWSER_PLAYER_ID === null) original_BROWSER_PLAYER_ID = window.BROWSER_PLAYER_ID;
    if (original_localPlayerId === null) original_localPlayerId = window.localPlayerId;
    if (original_window_location_search === null) original_window_location_search = window.location.search;

    if (playerPerspective === 'player1') {
        currentMockStorage = mockStorageP1;
        window.BROWSER_PLAYER_ID = "testBrowserP1";
        window.localPlayerId = "player1";
    } else {
        currentMockStorage = mockStorageP2;
        window.BROWSER_PLAYER_ID = "testBrowserP2";
        window.localPlayerId = "player2";
    }

    mockLocalStorageFunctions();

    if (gameIdToClear && currentMockStorage) {
        console.log(`Clearing game ${gameIdToClear} from mock storage for ${playerPerspective}`);
        delete currentMockStorage[LOCAL_STORAGE_KEY_PREFIX + gameIdToClear];
    }

    // Mock window.location.search by overriding it temporarily
    // This is a common approach for testing URL-dependent logic.
    Object.defineProperty(window, 'location', {
        value: {
            ...window.location, // Spread existing properties
            search: searchString,
            pathname: window.location.pathname || "/", // Ensure pathname exists
            origin: window.location.origin || `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':'+window.location.port : ''}`
        },
        writable: true, // Important to allow restoration
        configurable: true
    });


    window.currentGame = null;
    if(window.currentGame && window.currentGame.currentTurnMoves) window.currentGame.currentTurnMoves = [];

    const turnUrlInput = document.getElementById('turn-url'); // In test_runner.html
    if (turnUrlInput) turnUrlInput.value = '';
}

function teardownTestEnvironment() {
    restoreLocalStorageFunctions();
    if(original_BROWSER_PLAYER_ID !== null) window.BROWSER_PLAYER_ID = original_BROWSER_PLAYER_ID;
    if(original_localPlayerId !== null) window.localPlayerId = original_localPlayerId;

    Object.defineProperty(window, 'location', { // Restore original location object
        value: { ...window.location, search: original_window_location_search },
        writable: true,
        configurable: true
    });
    original_window_location_search = null;

    mockStorageP1 = {};
    mockStorageP2 = {};
    currentMockStorage = null;
    original_BROWSER_PLAYER_ID = null;
    original_localPlayerId = null;
    console.log("Test environment torn down.");
}


// Initialize Test Suite on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    TestSuite.init();
    runValidationTests();
    // runURLSyncTests(); // Will be called when implemented
    TestSuite.printSummary();
});

function runValidationTests() {
    TestSuite.describe("validatePlacement - Single Line & Gaps", () => {
        const turnNum = 1;

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
                [7, 7, 'L'], [7, 8, 'S'], [8, 8, 'H']
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
        });

        TestSuite.it("should allow contiguous horizontal placement (no gaps)", () => {
            const board = createTestBoard();
            const moves = mockMoves([[7, 7, 'A'], [7, 8, 'B'], [7, 9, 'C']]);
            const result = validatePlacement(moves, turnNum, board);
            TestSuite.assertTrue(result.isValid, result.message);
        });

        TestSuite.it("should disallow horizontal placement with internal gaps between new tiles", () => {
            const board = createTestBoard();
            const moves = mockMoves([[7, 7, 'A'], [7, 9, 'C']]);
            const result = validatePlacement(moves, turnNum, board);
            TestSuite.assertFalse(result.isValid, "Gap should make it invalid");
            TestSuite.assertEquals("Invalid placement: Tiles in a new word must be contiguous (no gaps).", result.message);
        });

        TestSuite.it("should allow horizontal placement with new tiles filling a gap around an existing tile", () => {
            const board = createTestBoard([[7, 8, 'X']]);
            const moves = mockMoves([[7, 7, 'A'], [7, 9, 'C']]);
            const result = validatePlacement(moves, turnNum, board);
            TestSuite.assertTrue(result.isValid, `Expected valid for AXC, got: ${result.message}`);
            TestSuite.assertEquals("horizontal", result.direction);
        });

        TestSuite.it("should allow vertical placement with new tiles filling a gap around an existing tile", () => {
            const board = createTestBoard([[6, 7, 'X']]);
            const moves = mockMoves([[5, 7, 'A'], [7, 7, 'C']]);
            const result = validatePlacement(moves, turnNum, board);
            TestSuite.assertTrue(result.isValid, `Expected valid for vertical fill, got: ${result.message}`);
            TestSuite.assertEquals("vertical", result.direction);
        });

        TestSuite.it("should disallow vertical placement with internal gaps between new tiles", () => {
            const board = createTestBoard();
            const moves = mockMoves([[5, 7, 'A'], [7, 7, 'C']]);
            const result = validatePlacement(moves, turnNum, board);
            TestSuite.assertFalse(result.isValid, "Vertical gap should be invalid");
            TestSuite.assertEquals("Invalid placement: Tiles in a new word must be contiguous (no gaps).", result.message);
        });

        TestSuite.it("should allow single tile placement (defaulting direction if isolated, for line/gap checks)", () => {
            const board = createTestBoard();
            const moves = mockMoves([[7,7,'Q']]);
            const result = validatePlacement(moves, turnNum, board);
            TestSuite.assertTrue(result.isValid, result.message);
            TestSuite.assertEquals("horizontal", result.direction);
        });
    });

    TestSuite.describe("validatePlacement - First Move & Connection", () => {
        const centerRow = Math.floor(BOARD_SIZE / 2); // BOARD_SIZE is from script.js
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
            const board = createTestBoard([[centerRow, centerCol, 'X']]);
            const moves = mockMoves([[centerRow, centerCol + 1, 'A']]);
            const result = validatePlacement(moves, 1, board);
            TestSuite.assertTrue(result.isValid, `Subsequent connected move failed: ${result.message}`);
        });

        TestSuite.it("should allow subsequent move (turn > 0) connecting to an existing tile vertically", () => {
            const board = createTestBoard([[centerRow, centerCol, 'X']]);
            const moves = mockMoves([[centerRow + 1, centerCol, 'A']]);
            const result = validatePlacement(moves, 1, board);
            TestSuite.assertTrue(result.isValid, `Subsequent connected move failed: ${result.message}`);
        });

        TestSuite.it("should allow subsequent move (turn > 0) forming a word by adding to two existing tiles", () => {
            const board = createTestBoard([[7,7,'H'], [7,9,'O']]);
            const moves = mockMoves([[7,8,'L']]);
            const result = validatePlacement(moves, 1, board);
            TestSuite.assertTrue(result.isValid, `Connecting between two tiles failed: ${result.message}`);
        });

        TestSuite.it("should disallow subsequent move (turn > 0) not connecting to any existing tile", () => {
            const board = createTestBoard([[0, 0, 'X']]);
            const moves = mockMoves([[centerRow, centerCol, 'A']]);
            const result = validatePlacement(moves, 1, board);
            TestSuite.assertFalse(result.isValid, "Subsequent disconnected move should be invalid");
            TestSuite.assertEquals("Invalid placement: New words must connect to existing tiles.", result.message);
        });

        TestSuite.it("should allow subsequent move if board is empty and placed on center (edge case)", () => {
            const board = createTestBoard();
            const moves = mockMoves([[centerRow, centerCol, 'A']]);
            const result = validatePlacement(moves, 1, board);
            TestSuite.assertTrue(result.isValid, `Move on empty board (turn > 0) on center failed: ${result.message}`);
        });

        TestSuite.it("should ALSO allow subsequent move on empty board NOT on center (current rule interpretation)", () => {
            // This test reflects current logic where connection rule is skipped if board is empty.
            // A stricter rule might require center if board is empty regardless of turn number > 0.
            const board = createTestBoard();
            const moves = mockMoves([[0,0,'A']]);
            const result = validatePlacement(moves, 1, board);
            TestSuite.assertTrue(result.isValid, `Subsequent move on empty board not on center. Current validation passes this.`);
        });

        TestSuite.it("should correctly determine direction for single tile connecting horizontally", () => {
            const board = createTestBoard([[7,6,'P']]);
            const moves = mockMoves([[7,7,'A']]);
            const result = validatePlacement(moves, 1, board);
            TestSuite.assertTrue(result.isValid, result.message);
            TestSuite.assertEquals("horizontal", result.direction);
        });

        TestSuite.it("should correctly determine direction for single tile connecting vertically", () => {
            const board = createTestBoard([[6,7,'P']]);
            const moves = mockMoves([[7,7,'A']]);
            const result = validatePlacement(moves, 1, board);
            TestSuite.assertTrue(result.isValid, result.message);
            TestSuite.assertEquals("vertical", result.direction);
        });

        TestSuite.it("should prefer horizontal for single tile connecting both ways", () => {
            const board = createTestBoard([[7,6,'L'], [6,7,'T']]);
            const moves = mockMoves([[7,7,'A']]);
            const result = validatePlacement(moves, 1, board);
            TestSuite.assertTrue(result.isValid, result.message);
            TestSuite.assertEquals("horizontal", result.direction);
        });
    });
}

function runURLSyncTests() {
    TestSuite.describe("URL Game State Sync - P1 Starts, P2 Loads", () => {
        let p1GameId = null;
        let p1InitialSeed = null;
        let p1BrowserId = "testBrowserP1";
        let p2BrowserId = "testBrowserP2";
        let firstTurnURL = null;
        const centerR = Math.floor(BOARD_SIZE / 2);
        const centerC = Math.floor(BOARD_SIZE / 2);

        TestSuite.it("P1: Initializes a new game", () => {
            setupTestEnvironment('player1'); // Sets BROWSER_PLAYER_ID to p1BrowserId, localPlayerId to 'player1'

            // Call initializeNewGame from script.js
            // It will use the mocked BROWSER_PLAYER_ID and localStorage via setupTestEnvironment
            initializeNewGame();

            TestSuite.assertTrue(currentGame !== null, "P1: currentGame should be initialized.");
            p1GameId = currentGame.gameId;
            p1InitialSeed = currentGame.randomSeed;
            TestSuite.assertEquals(p1BrowserId, currentGame.creatorId, "P1: Game creatorId should be P1's browser ID.");
            TestSuite.assertEquals("player1", localPlayerId, "P1: localPlayerId should be 'player1'.");
            TestSuite.assertEquals(0, currentGame.turnNumber, "P1: Initial turnNumber should be 0.");
            TestSuite.assertEquals(0, currentGame.currentPlayerIndex, "P1: Initial currentPlayerIndex should be 0 (P1).");

            // Check mockStorageP1
            const storedP1Game = JSON.parse(mockStorageP1[LOCAL_STORAGE_KEY_PREFIX + p1GameId]);
            TestSuite.assertTrue(storedP1Game !== null, "P1: Game should be saved to mockStorageP1.");
            TestSuite.assertEquals(p1BrowserId, storedP1Game.creatorId, "P1: Stored creatorId should be correct.");
            teardownTestEnvironment();
        });

        TestSuite.it("P1: Makes the first move", () => {
            setupTestEnvironment('player1');
            // Manually load the game that initializeNewGame would have created and saved.
            // This ensures 'currentGame' is P1's game context.
            currentGame = loadGameStateFromLocalStorage(p1GameId, mockStorageP1);
            // BROWSER_PLAYER_ID is already set to p1BrowserId by setup, localPlayerId to 'player1'

            TestSuite.assertTrue(currentGame !== null, "P1: Failed to reload game for first move.");
            TestSuite.assertEquals(0, currentGame.turnNumber, "P1: turnNumber should be 0 before first move.");
            TestSuite.assertEquals(p1BrowserId, window.BROWSER_PLAYER_ID, "P1: BROWSER_PLAYER_ID context check");


            // Simulate placing "HI" on center: H at (centerR, centerC), I at (centerR, centerC+1)
            // For this, we need actual Tile objects from P1's rack.
            // Let's assume P1's rack has 'H' and 'I' (or use known tiles from a fixed seed if necessary)
            // For simplicity, create mock tiles that would be in the rack.
            const tileH = currentGame.players[0].rack.find(t => t.letter === 'H') || mockTile('H',4);
            const tileI = currentGame.players[0].rack.find(t => t.letter === 'I') || mockTile('I',1);

            // Remove them from rack if found, otherwise test might be less realistic
            if(currentGame.players[0].rack.includes(tileH)) currentGame.players[0].rack.splice(currentGame.players[0].rack.indexOf(tileH), 1);
            if(currentGame.players[0].rack.includes(tileI)) currentGame.players[0].rack.splice(currentGame.players[0].rack.indexOf(tileI), 1);


            currentGame.currentTurnMoves = [
                { tileId: tileH.id, tileRef: tileH, from: 'rack', to: { row: centerR, col: centerC } },
                { tileId: tileI.id, tileRef: tileI, from: 'rack', to: { row: centerR, col: centerC + 1 } }
            ];

            // Place tiles on board for validation/word ID to work correctly
            currentGame.board.grid[centerR][centerC].tile = tileH;
            currentGame.board.grid[centerR][centerC+1].tile = tileI;

            handleCommitPlay(); // This will use BROWSER_PLAYER_ID="testBrowserP1"

            TestSuite.assertEquals(1, currentGame.turnNumber, "P1: turnNumber should be 1 after first move.");
            TestSuite.assertEquals(1, currentGame.currentPlayerIndex, "P1: currentPlayerIndex should be 1 (P2's turn).");

            const p1sRackSize = currentGame.players[0].rack.length;
            TestSuite.assertEquals(RACK_SIZE, p1sRackSize, `P1: Rack size should be ${RACK_SIZE} after drawing. Got ${p1sRackSize}`);


            const urlInputElement = document.getElementById('turn-url');
            firstTurnURL = urlInputElement ? urlInputElement.value : null;
            TestSuite.assertTrue(firstTurnURL !== null && firstTurnURL !== "", "P1: First turn URL should be generated.");
            console.log("P1 generated firstTurnURL:", firstTurnURL);

            const storedP1Game = JSON.parse(mockStorageP1[LOCAL_STORAGE_KEY_PREFIX + p1GameId]);
            TestSuite.assertEquals(1, storedP1Game.turnNumber, "P1: Stored turnNumber should be 1.");
            TestSuite.assertEquals(1, storedP1Game.currentPlayerIndex, "P1: Stored currentPlayerIndex should be 1.");
            TestSuite.assertEquals("H", storedP1Game.boardGrid[centerR][centerC].tile.letter, "P1: Stored board should have 'H'.");
            TestSuite.assertEquals("I", storedP1Game.boardGrid[centerR][centerC+1].tile.letter, "P1: Stored board should have 'I'.");

            teardownTestEnvironment();
        });

        TestSuite.it("P2: Loads the game using P1's first turn URL", () => {
            TestSuite.assertTrue(firstTurnURL !== null, "P2: Prerequisite P1's URL is missing.");
            setupTestEnvironment('player2', p1GameId, firstTurnURL); // Sets BROWSER_PLAYER_ID to p2BrowserId, localPlayerId to 'player2'

            // loadGameFromURLOrStorage will use the mocked window.location.search (from setupTestEnvironment)
            // and mocked localStorage (currentMockStorage = mockStorageP2)
            // The firstTurnURL contains the full URL, we need only the search part.
            const searchForP2Load = firstTurnURL ? firstTurnURL.substring(firstTurnURL.indexOf('?')) : "";
            loadGameFromURLOrStorage(searchForP2Load);

            TestSuite.assertTrue(currentGame !== null, "P2: currentGame should be initialized after loading URL.");
            TestSuite.assertEquals(p1GameId, currentGame.gameId, "P2: gameId should match P1.");
            TestSuite.assertEquals(p1InitialSeed, currentGame.randomSeed, "P2: randomSeed should match P1.");
            TestSuite.assertEquals(p1BrowserId, currentGame.creatorId, "P2: creatorId should be P1's browser ID.");
            TestSuite.assertEquals("player2", localPlayerId, "P2: localPlayerId should be 'player2'.");
            TestSuite.assertEquals(1, currentGame.turnNumber, "P2: turnNumber should be 1.");
            TestSuite.assertEquals(1, currentGame.currentPlayerIndex, "P2: currentPlayerIndex should be 1 (P2's turn).");

            // Check board state for P2
            TestSuite.assertTrue(currentGame.board.grid[centerR][centerC].tile !== null, "P2: Tile H should be on P2's board.");
            TestSuite.assertEquals("H", currentGame.board.grid[centerR][centerC].tile.letter, "P2: Tile at center should be 'H'.");
            TestSuite.assertTrue(currentGame.board.grid[centerR][centerC+1].tile !== null, "P2: Tile I should be on P2's board.");
            TestSuite.assertEquals("I", currentGame.board.grid[centerR][centerC+1].tile.letter, "P2: Tile at center+1 should be 'I'.");

            // Check mockStorageP2
            const storedP2Game = JSON.parse(mockStorageP2[LOCAL_STORAGE_KEY_PREFIX + p1GameId]);
            TestSuite.assertTrue(storedP2Game !== null, "P2: Game should be saved to mockStorageP2.");
            TestSuite.assertEquals(1, storedP2Game.turnNumber, "P2: Stored turnNumber should be 1.");
            TestSuite.assertEquals(1, storedP2Game.currentPlayerIndex, "P2: Stored currentPlayerIndex should be 1.");

            teardownTestEnvironment();
        });
    });

    // This suite relies on state from the previous one (p1GameId, storages)
    TestSuite.describe("URL Game State Sync - P2 Responds, P1 Loads", () => {
        let p2TurnURL = null;
        const centerR = Math.floor(BOARD_SIZE / 2);
        const centerC = Math.floor(BOARD_SIZE / 2); // HI is at (cR,cC) and (cR,cC+1)
        const p1BrowserId = "testBrowserP1"; // From previous test context

        TestSuite.it("P2: Makes a move", () => {
            setupTestEnvironment('player2', null, ""); // Use existing mockStorageP2, no specific URL to load initially

            // Load P2's game state which was saved after P1's first move
            currentGame = loadGameStateFromLocalStorage(p1GameId, mockStorageP2);
            TestSuite.assertTrue(currentGame !== null, "P2: Failed to load game for P2's move.");
            TestSuite.assertEquals(1, currentGame.turnNumber, "P2: turnNumber should be 1 before P2's move.");
            TestSuite.assertEquals(1, currentGame.currentPlayerIndex, "P2: currentPlayerIndex should be 1 (P2's turn).");
            TestSuite.assertEquals("player2", localPlayerId, "P2: localPlayerId context check");
            TestSuite.assertEquals("testBrowserP2", window.BROWSER_PLAYER_ID, "P2: BROWSER_PLAYER_ID context check");


            // P2 plays "SAY" vertically, S at (centerR-1, centerC+1) using the 'A' from "HI" (H I)
            //                                                                               A
            //                                                                               Y
            // Board has H at (cR, cC), I at (cR, cC+1)
            // P2 places S at (cR-1, cC+1) and Y at (cR+1, cC+1) to form SAY with I from HI.
            const tileS = currentGame.players[1].rack.find(t => t.letter === 'S') || mockTile('S',1);
            const tileY = currentGame.players[1].rack.find(t => t.letter === 'Y') || mockTile('Y',4);

            if(currentGame.players[1].rack.includes(tileS)) currentGame.players[1].rack.splice(currentGame.players[1].rack.indexOf(tileS), 1);
            if(currentGame.players[1].rack.includes(tileY)) currentGame.players[1].rack.splice(currentGame.players[1].rack.indexOf(tileY), 1);

            currentGame.currentTurnMoves = [
                { tileId: tileS.id, tileRef: tileS, from: 'rack', to: { row: centerR - 1, col: centerC + 1 } },
                { tileId: tileY.id, tileRef: tileY, from: 'rack', to: { row: centerR + 1, col: centerC + 1 } }
            ];
            currentGame.board.grid[centerR-1][centerC+1].tile = tileS;
            currentGame.board.grid[centerR+1][centerC+1].tile = tileY;
            // The 'I' from P1's "HI" is already at (centerR, centerC+1)

            handleCommitPlay(); // This will use BROWSER_PLAYER_ID="testBrowserP2"

            TestSuite.assertEquals(2, currentGame.turnNumber, "P2: turnNumber should be 2 after P2's move.");
            TestSuite.assertEquals(0, currentGame.currentPlayerIndex, "P2: currentPlayerIndex should be 0 (P1's turn).");
            TestSuite.assertEquals(RACK_SIZE, currentGame.players[1].rack.length, "P2: Rack size should be 7 after drawing.");

            const urlInputElement = document.getElementById('turn-url');
            p2TurnURL = urlInputElement ? urlInputElement.value : null;
            TestSuite.assertTrue(p2TurnURL !== null && p2TurnURL !== "", "P2: Turn URL should be generated.");
            console.log("P2 generated p2TurnURL:", p2TurnURL);

            const storedP2Game = JSON.parse(mockStorageP2[LOCAL_STORAGE_KEY_PREFIX + p1GameId]);
            TestSuite.assertEquals(2, storedP2Game.turnNumber, "P2: Stored turnNumber should be 2.");
            TestSuite.assertEquals("S", storedP2Game.boardGrid[centerR-1][centerC+1].tile.letter, "P2: Stored board should have 'S'.");

            teardownTestEnvironment();
        });

        TestSuite.it("P1: Loads P2's move URL", () => {
            TestSuite.assertTrue(p2TurnURL !== null, "P1: Prerequisite P2's URL is missing.");
            setupTestEnvironment('player1', null, p2TurnURL); // Use existing mockStorageP1

            // P1's game state should be from after their first move (turn 1, P2 to play)
            currentGame = loadGameStateFromLocalStorage(p1GameId, mockStorageP1);
            TestSuite.assertTrue(currentGame !== null, "P1: Failed to load game state before P2's move.");
            TestSuite.assertEquals(1, currentGame.turnNumber, "P1: turnNumber should be 1 before loading P2's URL.");
            TestSuite.assertEquals(1, currentGame.currentPlayerIndex, "P1: currentPlayerIndex should be 1 (P2's turn) before loading P2's URL.");

            // Now, loadGameFromURLOrStorage will process the URL from P2
            const searchForP1Load = p2TurnURL ? p2TurnURL.substring(p2TurnURL.indexOf('?')) : "";
            loadGameFromURLOrStorage(searchForP1Load);

            TestSuite.assertTrue(currentGame !== null, "P1: currentGame should be updated after loading P2's URL.");
            TestSuite.assertEquals(p1GameId, currentGame.gameId, "P1: gameId should remain consistent.");
            TestSuite.assertEquals("player1", localPlayerId, "P1: localPlayerId should be 'player1'.");
            TestSuite.assertEquals(2, currentGame.turnNumber, "P1: turnNumber should be 2 after P2's move.");
            TestSuite.assertEquals(0, currentGame.currentPlayerIndex, "P1: currentPlayerIndex should be 0 (P1's turn).");

            // Check board state for P1
            TestSuite.assertEquals("H", currentGame.board.grid[centerR][centerC].tile.letter, "P1: Tile 'H' should be present.");
            TestSuite.assertEquals("I", currentGame.board.grid[centerR][centerC+1].tile.letter, "P1: Tile 'I' should be present.");
            TestSuite.assertEquals("S", currentGame.board.grid[centerR-1][centerC+1].tile.letter, "P1: Tile 'S' from P2's move should be on P1's board.");
            TestSuite.assertEquals("Y", currentGame.board.grid[centerR+1][centerC+1].tile.letter, "P1: Tile 'Y' from P2's move should be on P1's board.");

            const storedP1Game = JSON.parse(mockStorageP1[LOCAL_STORAGE_KEY_PREFIX + p1GameId]);
            TestSuite.assertEquals(2, storedP1Game.turnNumber, "P1: Stored turnNumber should be 2 after P2's move.");

            teardownTestEnvironment();
        });
    });
}
