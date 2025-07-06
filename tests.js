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

// Initialize Test Suite on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    TestSuite.init();
    runValidationTests();
    TestSuite.printSummary();
});

function runValidationTests() {
    TestSuite.describe("generateTurnURL", () => {
        TestSuite.it("should generate correct URL for a pass action", () => {
            const url = generateTurnURL("game123", 5, null, null, null, null, "");
            TestSuite.assertTrue(url.includes("gid=game123"), "URL should contain gameId");
            TestSuite.assertTrue(url.includes("tn=5"), "URL should contain turnNumber");
            TestSuite.assertTrue(url.includes("ex="), "URL should contain ex parameter for pass");
            TestSuite.assertFalse(url.includes("ex=0"), "URL should be ex= for pass, not ex=0");
        });

        TestSuite.it("should generate correct URL for an exchange action with indices", () => {
            const url = generateTurnURL("game456", 3, null, null, null, null, "0,2,5");
            TestSuite.assertTrue(url.includes("gid=game456"));
            TestSuite.assertTrue(url.includes("tn=3"));
            TestSuite.assertTrue(url.includes("ex=0,2,5"), "URL should contain ex parameter with indices");
        });

        TestSuite.it("should generate URL for word play without ex parameter if exchangeData is null", () => {
            const wordData = { word: "HELLO", start_row: 7, start_col: 7, direction: 'horizontal', blanks_info: [] };
            const url = generateTurnURL("game789", 2, wordData, null, null, null, null);
            TestSuite.assertTrue(url.includes("gid=game789"));
            TestSuite.assertTrue(url.includes("tn=2"));
            TestSuite.assertTrue(url.includes("w=HELLO"));
            TestSuite.assertFalse(url.includes("ex="), "URL for word play should not contain ex parameter");
        });
         TestSuite.it("should prioritize ex parameter over wordData if both provided (though not typical)", () => {
            const wordData = { word: "HELLO", start_row: 7, start_col: 7, direction: 'horizontal', blanks_info: [] };
            const url = generateTurnURL("gameXYZ", 4, wordData, null, null, null, "1,3");
            TestSuite.assertTrue(url.includes("gid=gameXYZ"));
            TestSuite.assertTrue(url.includes("tn=4"));
            TestSuite.assertTrue(url.includes("ex=1,3"), "URL should contain ex parameter for exchange");
            TestSuite.assertFalse(url.includes("w=HELLO"), "URL should not contain word if ex is present");
        });
    });

    // Helper to setup a basic game state for testing pass/exchange handlers
    function setupTestGame(initialSeed = 12345, specificRack = null, specificBag = null) {
        currentGame = new GameState("testGame", initialSeed, {});
        localPlayerId = "player1";
        currentGame.players[0].name = "Player 1";
        currentGame.players[1].name = "Player 2";
        currentGame.currentPlayerIndex = 0;
        currentGame.turnNumber = 1;

        currentGame.players[0].rack = specificRack || [
            new Tile('R1',1, false, null, "tile_rack1"), new Tile('R2',1, false, null, "tile_rack2"),
            new Tile('R3',1, false, null, "tile_rack3"), new Tile('R4',1, false, null, "tile_rack4"),
            new Tile('R5',1, false, null, "tile_rack5"), new Tile('R6',1, false, null, "tile_rack6"),
            new Tile('R7',1, false, null, "tile_rack7")
        ];
        currentGame.players[1].rack = [mockTile('P2A'), mockTile('P2B')]; // Minimal for P2

        currentGame.bag = specificBag || [
            new Tile('B1',10, false, null, "tile_bag1"), new Tile('B2',10, false, null, "tile_bag2"),
            new Tile('B3',10, false, null, "tile_bag3"), new Tile('B4',10, false, null, "tile_bag4"),
            new Tile('B5',10, false, null, "tile_bag5")
        ];

        // Ensure Tile constructor assigns unique ID if not provided for this test
        // The Tile constructor in script.js already creates a unique this.id
        // Forcing IDs here for predictability in tests.

        // Mock UI elements that might be updated
        document.body.innerHTML += '<input type="text" id="turn-url">'; // Ensure turn-url input exists
        return currentGame;
    }

    // Store original alert/prompt and replace them
    const _originalAlert = window.alert;
    const _originalPrompt = window.prompt;
    let _mockAlertMessage = "";
    let _mockPromptResponse = "";

    TestSuite.describe("Pass and Exchange Logic", () => {
        let game;

        const mockUI = () => {
            window.alert = (msg) => { _mockAlertMessage = msg; console.log("Mock Alert:", msg); };
            window.prompt = (msg) => { console.log("Mock Prompt:", msg); return _mockPromptResponse; };
        };
        const unMockUI = () => {
            window.alert = _originalAlert;
            window.prompt = _originalPrompt;
        };

        TestSuite.it("handlePassTurn: should advance turn, switch player, generate pass URL", () => {
            mockUI();
            game = setupTestGame();
            const initialTurn = game.turnNumber;
            const initialPlayerIndex = game.currentPlayerIndex;
            const p1RackBefore = [...game.players[0].rack];
            const bagBefore = [...game.bag];

            handlePassTurn();

            TestSuite.assertEquals(initialTurn + 1, game.turnNumber, "Turn number should increment.");
            TestSuite.assertEquals((initialPlayerIndex + 1) % 2, game.currentPlayerIndex, "Should switch to next player.");
            TestSuite.assertDeepEquals(p1RackBefore, game.players[0].rack, "Player 1 rack should be unchanged on pass.");
            TestSuite.assertDeepEquals(bagBefore, game.bag, "Bag should be unchanged on pass.");

            const turnUrlInput = document.getElementById('turn-url');
            TestSuite.assertTrue(turnUrlInput.value.includes("ex="), "Turn URL should indicate a pass.");
            TestSuite.assertFalse(turnUrlInput.value.includes("ex=0"), "Turn URL for pass should be 'ex=' not 'ex=0'.");
            TestSuite.assertTrue(_mockAlertMessage.includes("Turn passed!"), "Alert message for pass is incorrect.");
            unMockUI();
        });

        TestSuite.it("handleExchangeTiles: should exchange tiles, update rack/bag, advance turn, generate exchange URL", () => {
            mockUI();
            // Setup with specific, identifiable tiles using the updated setupTestGame
            const rackTiles = [
                new Tile('R1',1,false,null,"racktile1"), new Tile('R2',1,false,null,"racktile2"),
                new Tile('R3',1,false,null,"racktile3")
            ];
            // Ensure bag has enough distinct tiles to draw, different from rack tiles
            const bagTiles = [
                new Tile('B1',10,false,null,"bagtile1"), new Tile('B2',10,false,null,"bagtile2"),
                new Tile('B3',10,false,null,"bagtile3") // Extra tile in bag
            ];
            game = setupTestGame(123, [...rackTiles], [...bagTiles]); // Pass copies

            const p1 = game.players[0];
            const initialRackSize = p1.rack.length; // Should be 3
            const initialBagSize = game.bag.length;   // Should be 3
            const tilesToExchangeIndicesStr = "0,2"; // Exchange R1 (id: racktile1) and R3 (id: racktile3)
            _mockPromptResponse = tilesToExchangeIndicesStr;

            const exchangedTileId1 = "racktile1"; // ID of tile R1
            const tileKeptInRackId = "racktile2"; // ID of tile R2
            const exchangedTileId3 = "racktile3"; // ID of tile R3

            // Store original IDs of tiles in bag to verify drawn tiles came from here
            const originalBagTileIds = game.bag.map(t => t.id);

            handleExchangeTiles();

            TestSuite.assertEquals(initialRackSize, p1.rack.length, "Player rack size should remain constant after exchange.");
            TestSuite.assertEquals(initialBagSize, game.bag.length, "Bag size should remain constant after exchange.");

            // Verify exchanged tiles are NOT in the new rack
            TestSuite.assertFalse(p1.rack.some(t => t.id === exchangedTileId1), `Exchanged tile ID ${exchangedTileId1} should not be in the new rack.`);
            TestSuite.assertFalse(p1.rack.some(t => t.id === exchangedTileId3), `Exchanged tile ID ${exchangedTileId3} should not be in the new rack.`);

            // Verify the tile that wasn't exchanged IS STILL in the rack
            TestSuite.assertTrue(p1.rack.some(t => t.id === tileKeptInRackId), `Kept tile ID ${tileKeptInRackId} should still be in the rack.`);

            // Verify new tiles in rack are from the original bag (i.e., their IDs were in originalBagTileIds)
            let drawnTilesInRackCount = 0;
            p1.rack.forEach(rackTile => {
                // A tile in the rack is considered "drawn" if its ID was in the original bag
                // and it's not the tile that was kept.
                if (originalBagTileIds.includes(rackTile.id) && rackTile.id !== tileKeptInRackId) {
                    drawnTilesInRackCount++;
                }
            });
            const numberOfTilesExchanged = 2;
            TestSuite.assertEquals(numberOfTilesExchanged, drawnTilesInRackCount, `Exactly ${numberOfTilesExchanged} tiles in the new rack should have come from the original bag.`);

            // Verify exchanged tiles ARE NOW in the bag
            TestSuite.assertTrue(game.bag.some(t => t.id === exchangedTileId1), `Exchanged tile ID ${exchangedTileId1} should now be in the bag.`);
            TestSuite.assertTrue(game.bag.some(t => t.id === exchangedTileId3), `Exchanged tile ID ${exchangedTileId3} should now be in the bag.`);

            // Verify that tiles drawn into rack are NO LONGER in the bag
            p1.rack.forEach(rackTile => {
                if (originalBagTileIds.includes(rackTile.id) && rackTile.id !== tileKeptInRackId) { // If it's a drawn tile
                    TestSuite.assertFalse(game.bag.some(bagTile => bagTile.id === rackTile.id), `Drawn tile ID ${rackTile.id} should no longer be in the bag if it's now in rack.`);
                }
            });

            TestSuite.assertEquals(2, game.turnNumber, "Turn number should increment after exchange."); // Initial turn 1
            TestSuite.assertEquals(1, game.currentPlayerIndex, "Should switch to player 2 after exchange.");

            const turnUrlInput = document.getElementById('turn-url');
            TestSuite.assertTrue(turnUrlInput.value.includes(`ex=${tilesToExchangeIndicesStr}`), "Turn URL should indicate specific tiles exchanged.");
            TestSuite.assertTrue(_mockAlertMessage.includes(`Exchanged ${numberOfTilesExchanged} tile(s)`), "Alert message for exchange is incorrect.");
            unMockUI();
        });

        TestSuite.it("handleExchangeTiles: should not exchange if bag has too few tiles", () => {
            mockUI();
            // Use specific tile IDs for clarity
            const rackTiles = [new Tile('R1',1,false,null,"r1"), new Tile('R2',1,false,null,"r2")];
            const bagTiles = [new Tile('B1',10,false,null,"b1")]; // Only 1 tile in bag
            game = setupTestGame(123, [...rackTiles], [...bagTiles]); // Pass copies

            _mockPromptResponse = "0,1"; // Request to exchange 2 tiles

            const p1RackBefore = game.players[0].rack.map(t => t.id); // Store IDs
            const initialTurn = game.turnNumber;

            handleExchangeTiles();

            const p1RackAfterIds = game.players[0].rack.map(t => t.id);
            TestSuite.assertDeepEquals(p1RackBefore, p1RackAfterIds, "Player rack (by tile IDs) should be unchanged if bag is too small.");
            TestSuite.assertEquals(initialTurn, game.turnNumber, "Turn number should not change if exchange fails.");
            TestSuite.assertTrue(_mockAlertMessage.includes("Not enough tiles in the bag"), "Alert message for insufficient bag is incorrect.");
            unMockUI();
        });

         TestSuite.it("handleExchangeTiles: should handle non-numeric/out-of-bounds indices gracefully", () => {
            mockUI();
            const rackTiles = [
                new Tile('R1',1,false,null,"r1"), new Tile('R2',1,false,null,"r2"),
                new Tile('R3',1,false,null,"r3")
            ];
            const bagTiles = [new Tile('B1',10,false,null,"b1"), new Tile('B2',10,false,null,"b2")];
            game = setupTestGame(123, [...rackTiles], [...bagTiles]);

            const p1RackOriginalIds = game.players[0].rack.map(t => t.id);
            _mockPromptResponse = "0,foo,10,1"; // Exchange R1 (idx 0) and R2 (idx 1). foo invalid, 10 out of bounds.

            handleExchangeTiles();

            TestSuite.assertEquals(rackTiles.length, game.players[0].rack.length, "Rack size should be constant.");
            // Tiles r1 and r2 should have been exchanged. r3 should remain.
            TestSuite.assertFalse(game.players[0].rack.some(t => t.id === "r1"), "Tile r1 should have been exchanged out.");
            TestSuite.assertFalse(game.players[0].rack.some(t => t.id === "r2"), "Tile r2 should have been exchanged out.");
            TestSuite.assertTrue(game.players[0].rack.some(t => t.id === "r3"), "Tile r3 should remain in rack.");
            // Two new tiles from bag (b1, b2) should be in rack.
            TestSuite.assertTrue(game.players[0].rack.some(t => t.id === "b1" || t.id === "b2"), "A tile from bag should be in rack.");

            TestSuite.assertTrue(_mockAlertMessage.includes("Exchanged 2 tile(s)"), "Should report exchanging 2 valid tiles.");
            const turnUrlInput = document.getElementById('turn-url');
            TestSuite.assertTrue(turnUrlInput.value.includes("ex=0,foo,10,1"), "URL should contain original (unclean) indices as per current implementation.");
            unMockUI();
        });

    });

    // Mock localStorage for testing load/save
    const MockLocalStorage = () => {
        let store = {};
        return {
            getItem: key => store[key] || null,
            setItem: (key, value) => { store[key] = value.toString(); },
            removeItem: key => { delete store[key]; },
            clear: () => { store = {}; }
        };
    };
    let mockStorage; // To be initialized in test setup

    TestSuite.describe("URL Processing for Pass/Exchange (via loadGameFromURLOrStorage)", () => {
        let originalGameState; // To hold the state before URL processing

        const P1_BROWSER_ID = "browserP1";
        const P2_BROWSER_ID = "browserP2";

        // This setup runs before each 'it' block in this 'describe'
        const beforeEachTest = (currentTurn, currentPlayerIdx, localBrowserId = P1_BROWSER_ID) => {
            mockStorage = MockLocalStorage();
            currentGame = new GameState("urlTestGame", 67890, {});
            currentGame.turnNumber = currentTurn;
            currentGame.currentPlayerIndex = currentPlayerIdx; // 0 for P1, 1 for P2
            currentGame.creatorId = P1_BROWSER_ID; // P1 created the game

            // Set localPlayerId based on who is "viewing" the URL
            // BROWSER_PLAYER_ID is a global in script.js, so we need to mock it or control localPlayerId directly
            // For simplicity, we'll assume loadGameFromURLOrStorage correctly sets localPlayerId based on BROWSER_PLAYER_ID and creatorId.
            // We will manually set localPlayerId for the test's perspective.
            // And we'll need to ensure BROWSER_PLAYER_ID is temporarily something for the test.
            window.BROWSER_PLAYER_ID_backup = window.BROWSER_PLAYER_ID; // Backup global
            window.BROWSER_PLAYER_ID = localBrowserId;
            localPlayerId = localBrowserId === currentGame.creatorId ? "player1" : "player2";


            // Simulate player racks and bag for realism, though not strictly needed for URL processing logic itself
            currentGame.players[0].rack = [mockTile('A'), mockTile('B')];
            currentGame.players[1].rack = [mockTile('C'), mockTile('D')];
            currentGame.bag = [mockTile('E'), mockTile('F')];

            saveGameStateToLocalStorage(currentGame, mockStorage); // Save initial state
            originalGameState = JSON.parse(JSON.stringify(currentGame)); // Deep copy for comparison
        };
        const afterEachTest = () => {
             window.BROWSER_PLAYER_ID = window.BROWSER_PLAYER_ID_backup; // Restore global
             currentGame = null; // Clean up
        };


        TestSuite.it("P2 loads URL from P1 who passed turn", () => {
            // P1 (local) was current player (index 0), turn 1. P1 passes.
            // URL will be for turn 2, player becomes P2 (index 1).
            beforeEachTest(1, 0, P2_BROWSER_ID); // P2 is loading, game was P1's turn (0) at turn 1.

            const passUrlParams = "gid=urlTestGame&tn=2&ex="; // P1 passed, advancing to turn 2
            loadGameFromURLOrStorage(passUrlParams, mockStorage);

            TestSuite.assertEquals(2, currentGame.turnNumber, "Game turn should be 2 after P1's pass.");
            TestSuite.assertEquals(1, currentGame.currentPlayerIndex, "Current player should be P2 (index 1).");
            // Board, bag, racks unchanged by a pass itself, but this test focuses on turn/player update.
            afterEachTest();
        });

        TestSuite.it("P1 loads URL from P2 who exchanged tiles", () => {
            // P2 (local) was current player (index 1), turn 2. P2 exchanges.
            // URL will be for turn 3, player becomes P1 (index 0).
            beforeEachTest(2, 1, P1_BROWSER_ID); // P1 is loading, game was P2's turn (1) at turn 2.

            const exchangeUrlParams = "gid=urlTestGame&tn=3&ex=0,1"; // P2 exchanged, advancing to turn 3
            loadGameFromURLOrStorage(exchangeUrlParams, mockStorage);

            TestSuite.assertEquals(3, currentGame.turnNumber, "Game turn should be 3 after P2's exchange.");
            TestSuite.assertEquals(0, currentGame.currentPlayerIndex, "Current player should be P1 (index 0).");
            // Bag/P2's rack would have changed due to exchange - this is reflected by loading the state P2 saved.
            // This test primarily verifies the turn/player advancement for P1.
            afterEachTest();
        });

        TestSuite.it("P2 loads initial game URL from P1 that includes P1's first move as a pass", () => {
            mockStorage = MockLocalStorage(); // P2 has no local game yet
            currentGame = null;
            window.BROWSER_PLAYER_ID_backup = window.BROWSER_PLAYER_ID;
            window.BROWSER_PLAYER_ID = P2_BROWSER_ID; // P2 is this browser

            const initialUrlWithP1Pass = "gid=newGamePass&tn=1&seed=111&creator=" + P1_BROWSER_ID + "&ex=";
            loadGameFromURLOrStorage(initialUrlWithP1Pass, mockStorage);

            TestSuite.assertNotNull(currentGame, "Game should be initialized for P2.");
            TestSuite.assertEquals("newGamePass", currentGame.gameId);
            TestSuite.assertEquals(1, currentGame.turnNumber, "Turn number should be 1 (P1's completed turn).");
            TestSuite.assertEquals(1, currentGame.currentPlayerIndex, "Current player should be P2 (index 1).");
            TestSuite.assertEquals(P2_BROWSER_ID === currentGame.creatorId ? "player1" : "player2", localPlayerId, "Local player ID for P2 is wrong.");
            afterEachTest();
        });
    });

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
