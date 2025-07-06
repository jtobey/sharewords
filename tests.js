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
        const defaultSettings = { dictionaryType: 'permissive', dictionaryUrl: null };
        const freeApiSettings = { dictionaryType: 'freeapi', dictionaryUrl: null };
        const customApiSettings = { dictionaryType: 'custom', dictionaryUrl: 'https://example.com/dict/' };

        TestSuite.it("should generate correct URL for a pass action", () => {
            const url = generateTurnURL("game123", 5, null, null, null, null, ""); // Settings not relevant for non-initial pass
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
            const url = generateTurnURL("game789", 2, wordData, null, null, defaultSettings, null); // Non-initial turn
            TestSuite.assertTrue(url.includes("gid=game789"));
            TestSuite.assertTrue(url.includes("tn=2"));
            TestSuite.assertTrue(url.includes("w=HELLO"));
            TestSuite.assertFalse(url.includes("ex="), "URL for word play should not contain ex parameter");
            TestSuite.assertFalse(url.includes("dt="), "Non-initial URL should not contain dt");
        });

        TestSuite.it("should prioritize ex parameter over wordData if both provided", () => {
            const wordData = { word: "HELLO", start_row: 7, start_col: 7, direction: 'horizontal', blanks_info: [] };
            const url = generateTurnURL("gameXYZ", 4, wordData, null, null, defaultSettings, "1,3"); // Non-initial
            TestSuite.assertTrue(url.includes("gid=gameXYZ"));
            TestSuite.assertTrue(url.includes("tn=4"));
            TestSuite.assertTrue(url.includes("ex=1,3"), "URL should contain ex parameter for exchange");
            TestSuite.assertFalse(url.includes("w=HELLO"), "URL should not contain word if ex is present");
            TestSuite.assertFalse(url.includes("dt="), "Non-initial URL with ex should not contain dt");
        });

        TestSuite.it("should include dictionary type for initial URL (turn 1, creator) if not permissive", () => {
            const wordData = { word: "FIRST", start_row: 7, start_col: 7, direction: 'h', blanks_info:[]};
            const url = generateTurnURL("gameInit", 1, wordData, 12345, "creator1", freeApiSettings, null);
            TestSuite.assertTrue(url.includes("dt=freeapi"), "Initial URL should include dt=freeapi");
            TestSuite.assertFalse(url.includes("du="), "Initial URL for freeapi should not include du");
        });

        TestSuite.it("should include custom dictionary URL for initial URL if type is custom", () => {
            const wordData = { word: "SETUP", start_row: 7, start_col: 7, direction: 'h', blanks_info:[]};
            const url = generateTurnURL("gameCustom", 1, wordData, 54321, "creator2", customApiSettings, null);
            TestSuite.assertTrue(url.includes("dt=custom"), "Initial URL should include dt=custom");
            TestSuite.assertTrue(url.includes(`du=${encodeURIComponent(customApiSettings.dictionaryUrl)}`), "Initial URL should include du for custom type");
        });

        TestSuite.it("should NOT include dictionary type for initial URL if permissive", () => {
            const wordData = { word: "BEGIN", start_row: 7, start_col: 7, direction: 'h', blanks_info:[]};
            const url = generateTurnURL("gamePerm", 1, wordData, 67890, "creator3", defaultSettings, null);
            TestSuite.assertFalse(url.includes("dt="), "Initial URL for permissive should not include dt");
        });

        TestSuite.it("should NOT include dictionary type for non-initial URLs (turn > 1)", () => {
            const wordData = { word: "NEXT", start_row: 7, start_col: 8, direction: 'h', blanks_info:[]};
            const url = generateTurnURL("gameNext", 2, wordData, null, null, freeApiSettings, null); // seed & creator null for non-initial
            TestSuite.assertFalse(url.includes("dt="), "Non-initial URL should not include dt even if settings provided");
        });
    });

    // Helper to setup a basic game state for testing pass/exchange handlers
    function setupTestGame(initialSeed = 12345, gameSettings = {}, specificRack = null, specificBag = null) {
        currentGame = new GameState("testGame", initialSeed, gameSettings);
        localPlayerId = "player1"; // Assume P1 is running the test functions locally
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
    let mockNextRandom = 0.5; // Default mock random value

    TestSuite.describe("Pass and Exchange Logic", () => {
        let game;

        const mockUIAndRandom = () => {
            window.alert = (msg) => { _mockAlertMessage = msg; console.log("Mock Alert:", msg); };
            window.prompt = (msg) => { console.log("Mock Prompt:", msg); return _mockPromptResponse; };
            // Mulberry32 is initialized in GameState. To control drawing, we'd need to mock the PRNG instance
            // or ensure a fixed seed and predictable sequence. For these tests, fixed seed in setupTestGame is enough.
        };
        const unMockUIAndRandom = () => {
            window.alert = _originalAlert;
            window.prompt = _originalPrompt;
        };

        TestSuite.it("handlePassTurn: should advance turn, switch player, generate pass URL", () => {
            mockUIAndRandom();
            game = setupTestGame(123, {}); // seed, settings
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
            unMockUIAndRandom();
        });

        TestSuite.it("handleExchangeTiles: should exchange tiles, update rack/bag, advance turn, generate exchange URL", () => {
            mockUIAndRandom();
            // Setup with specific, identifiable tiles using the updated setupTestGame
            // Provide explicit IDs for tiles to make assertions easier.
            const rackTiles = [
                new Tile('R1',1,false,null, "racktile1"), new Tile('R2',1,false,null, "racktile2"),
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
            unMockUIAndRandom();
        });

        TestSuite.it("handleExchangeTiles: should not exchange if bag has too few tiles", () => {
            mockUIAndRandom();
            // Use specific tile IDs for clarity
            const rackTiles = [new Tile('R1',1,false,null,"r1"), new Tile('R2',1,false,null,"r2")];
            const bagTiles = [new Tile('B1',10,false,null,"b1")]; // Only 1 tile in bag
            // Pass empty gameSettings object {}
            game = setupTestGame(123, {}, [...rackTiles], [...bagTiles]);

            _mockPromptResponse = "0,1"; // Request to exchange 2 tiles

            const p1RackBefore = game.players[0].rack.map(t => t.id); // Store IDs
            const initialTurn = game.turnNumber;

            handleExchangeTiles();

            const p1RackAfterIds = game.players[0].rack.map(t => t.id);
            TestSuite.assertDeepEquals(p1RackBefore, p1RackAfterIds, "Player rack (by tile IDs) should be unchanged if bag is too small.");
            TestSuite.assertEquals(initialTurn, game.turnNumber, "Turn number should not change if exchange fails.");
            TestSuite.assertTrue(_mockAlertMessage.includes("Not enough tiles in the bag"), "Alert message for insufficient bag is incorrect.");
            unMockUIAndRandom();
        });

         TestSuite.it("handleExchangeTiles: should handle non-numeric/out-of-bounds indices gracefully", () => {
            mockUIAndRandom();
            const rackTiles = [
                new Tile('R1',1,false,null,"r1"), new Tile('R2',1,false,null,"r2"),
                new Tile('R3',1,false,null,"r3")
            ];
            const bagTiles = [new Tile('B1',10,false,null,"b1"), new Tile('B2',10,false,null,"b2")];
            game = setupTestGame(123, {}, [...rackTiles], [...bagTiles]); // Pass empty gameSettings

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
            unMockUIAndRandom();
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
        const beforeEachURLTest = (currentTurn, currentPlayerIdx, gameSettings = {}, localBrowserId = P1_BROWSER_ID) => {
            mockStorage = MockLocalStorage();
            currentGame = new GameState("urlTestGame", 67890, gameSettings); // Use provided settings
            currentGame.turnNumber = currentTurn;
            currentGame.currentPlayerIndex = currentPlayerIdx; // 0 for P1, 1 for P2
            currentGame.creatorId = P1_BROWSER_ID; // P1 created the game

            window.BROWSER_PLAYER_ID_backup = window.BROWSER_PLAYER_ID; // Backup global
            window.BROWSER_PLAYER_ID = localBrowserId;
            // Determine localPlayerId based on who is "viewing" this game instance
            localPlayerId = (localBrowserId === currentGame.creatorId) ? "player1" : "player2";

            // Simulate player racks and bag for realism
            currentGame.players[0].rack = [mockTile('A'), mockTile('B'), mockTile('C'), mockTile('D'), mockTile('E'), mockTile('F'), mockTile('G')];
            currentGame.players[1].rack = [mockTile('H'), mockTile('I'), mockTile('J'), mockTile('K'), mockTile('L'), mockTile('M'), mockTile('N')];
            currentGame.bag = [];
            for(let i=0; i<20; i++) currentGame.bag.push(mockTile(`Z${i}`,10));


            saveGameStateToLocalStorage(currentGame, mockStorage); // Save initial state
            originalGameState = JSON.parse(JSON.stringify(currentGame)); // Deep copy for comparison
        };
        const afterEachURLTest = () => {
             window.BROWSER_PLAYER_ID = window.BROWSER_PLAYER_ID_backup; // Restore global
             currentGame = null; // Clean up
             mockStorage.clear();
        };


        TestSuite.it("P2 loads URL from P1 who passed turn (default permissive settings)", () => {
            beforeEachURLTest(1, 0, {}, P2_BROWSER_ID); // P2 loading, P1's turn 1, default settings
            const passUrlParams = "gid=urlTestGame&tn=2&ex=&seed=67890&creator=" + P1_BROWSER_ID;
            loadGameFromURLOrStorage(passUrlParams, mockStorage);

            TestSuite.assertEquals(2, currentGame.turnNumber);
            TestSuite.assertEquals(1, currentGame.currentPlayerIndex);
            TestSuite.assertEquals("permissive", currentGame.settings.dictionaryType);
            afterEachURLTest();
        });

        TestSuite.it("P1 loads URL from P2 who exchanged tiles (default permissive settings)", () => {
            beforeEachURLTest(2, 1, {}, P1_BROWSER_ID); // P1 loading, P2's turn 2
            const p2InitialRackBeforeExchange = [...currentGame.players[1].rack]; // Copy P2's rack before exchange
            const initialBagBeforeExchange = [...currentGame.bag];

            const exchangeUrlParams = "gid=urlTestGame&tn=3&ex=0,1"; // P2 exchanged 2 tiles
            loadGameFromURLOrStorage(exchangeUrlParams, mockStorage);

            TestSuite.assertEquals(3, currentGame.turnNumber);
            TestSuite.assertEquals(0, currentGame.currentPlayerIndex);
            TestSuite.assertEquals("permissive", currentGame.settings.dictionaryType);

            // Verify P2's rack and bag were modified correctly due to exchange by P2
            const p2 = currentGame.players[1];
            TestSuite.assertEquals(7, p2.rack.length, "P2 rack size should be maintained.");
            // Check that the two exchanged tiles are different from original first two
            TestSuite.assertFalse(p2.rack[0].id === p2InitialRackBeforeExchange[0].id && p2.rack[1].id === p2InitialRackBeforeExchange[1].id, "P2's first two tiles should have changed.");
            // Check that the two original tiles are now in the bag (approx check, PRNG makes exact hard without mocking it)
            TestSuite.assertEquals(initialBagBeforeExchange.length, currentGame.bag.length, "Bag size should be maintained after exchange.");
            afterEachURLTest();
        });

        TestSuite.it("P2 loads initial game URL from P1 (first move pass) with 'freeapi' dictionary setting", () => {
            // P2 has no local game. P1 (creator) makes first move (pass) and generates URL.
            mockStorage = MockLocalStorage();
            currentGame = null; // No game loaded yet for P2
            window.BROWSER_PLAYER_ID_backup = window.BROWSER_PLAYER_ID;
            window.BROWSER_PLAYER_ID = P2_BROWSER_ID; // P2 is this browser

            const initialUrlWithP1Pass = `gid=newGameFreeApi&tn=1&seed=111&creator=${P1_BROWSER_ID}&dt=freeapi&ex=`;
            loadGameFromURLOrStorage(initialUrlWithP1Pass, mockStorage);

            TestSuite.assertNotNull(currentGame, "Game should be initialized for P2.");
            TestSuite.assertEquals("newGameFreeApi", currentGame.gameId);
            TestSuite.assertEquals(1, currentGame.turnNumber, "Turn number should be 1 (P1's completed turn).");
            TestSuite.assertEquals(1, currentGame.currentPlayerIndex, "Current player should be P2 (index 1).");
            TestSuite.assertEquals("player2", localPlayerId, "Local player ID for P2 should be 'player2'.");
            TestSuite.assertEquals("freeapi", currentGame.settings.dictionaryType, "Dictionary type should be 'freeapi'.");
            TestSuite.assertNull(currentGame.settings.dictionaryUrl, "Dictionary URL should be null for freeapi.");
            afterEachURLTest();
        });

         TestSuite.it("P2 loads initial game URL from P1 (no first move yet) with 'custom' dictionary setting", () => {
            mockStorage = MockLocalStorage();
            currentGame = null;
            window.BROWSER_PLAYER_ID_backup = window.BROWSER_PLAYER_ID;
            window.BROWSER_PLAYER_ID = P2_BROWSER_ID;

            const customUrl = "https://my.dict.co/api?q=";
            const initialUrlCustom = `gid=newGameCustom&seed=222&creator=${P1_BROWSER_ID}&dt=custom&du=${encodeURIComponent(customUrl)}`;
            // Note: tn is missing, so it's pre-first-move state (turn 0, P1 to play)
            loadGameFromURLOrStorage(initialUrlCustom, mockStorage);

            TestSuite.assertNotNull(currentGame);
            TestSuite.assertEquals("newGameCustom", currentGame.gameId);
            TestSuite.assertEquals(0, currentGame.turnNumber, "Turn should be 0 (P1 to make first move).");
            TestSuite.assertEquals(0, currentGame.currentPlayerIndex, "Player should be P1 (index 0).");
            TestSuite.assertEquals("player2", localPlayerId);
            TestSuite.assertEquals("custom", currentGame.settings.dictionaryType);
            TestSuite.assertEquals(customUrl, currentGame.settings.dictionaryUrl);
            afterEachURLTest();
        });


        TestSuite.it("P2 loads initial game URL from P1 (first move word play) with 'permissive' (implicit)", () => {
            mockStorage = MockLocalStorage();
            currentGame = null;
            window.BROWSER_PLAYER_ID_backup = window.BROWSER_PLAYER_ID;
            window.BROWSER_PLAYER_ID = P2_BROWSER_ID;

            // No dt/du params means permissive
            const initialUrlP1Word = `gid=newGameWord&tn=1&seed=333&creator=${P1_BROWSER_ID}&w=HELLO&wl=7.7&wd=h`;
            loadGameFromURLOrStorage(initialUrlP1Word, mockStorage);

            TestSuite.assertNotNull(currentGame);
            TestSuite.assertEquals("newGameWord", currentGame.gameId);
            TestSuite.assertEquals(1, currentGame.turnNumber); // P1's move applied
            TestSuite.assertEquals(1, currentGame.currentPlayerIndex); // P2's turn
            TestSuite.assertEquals("player2", localPlayerId);
            TestSuite.assertEquals("permissive", currentGame.settings.dictionaryType, "Default to permissive if no dt in URL.");
            // Check that P1's score reflects HELLO (H4+E1+L1+L1+O1 = 8)
            TestSuite.assertEquals(8, currentGame.players[0].score, "P1 score for HELLO should be 8.");
            afterEachURLTest();
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

    TestSuite.describe("identifyAllPlayedWords", () => {
        const gameSettings = { tileValues: DEFAULT_TILE_VALUES, rackSize: RACK_SIZE, sevenTileBonus: 50 };
        let board;

        TestSuite.it("should identify a simple horizontal word", () => {
            board = createTestBoard();
            const moves = mockMoves([ [7,7,mockTile('H',4)], [7,8,mockTile('A',1)], [7,9,mockTile('T',1)] ]);
            // Manually place tiles on board for identifyAllPlayedWords
            moves.forEach(m => board.grid[m.to.row][m.to.col].tile = m.tileRef);
            const words = identifyAllPlayedWords(moves, board, 'horizontal');
            TestSuite.assertEquals(1, words.length);
            TestSuite.assertEquals("HAT", words[0].map(t => t.tile.letter).join(''));
        });

        TestSuite.it("should identify a simple vertical word", () => {
            board = createTestBoard();
            const moves = mockMoves([ [7,7,mockTile('V',4)], [8,7,mockTile('A',1)], [9,7,mockTile('T',1)] ]);
            moves.forEach(m => board.grid[m.to.row][m.to.col].tile = m.tileRef);
            const words = identifyAllPlayedWords(moves, board, 'vertical');
            TestSuite.assertEquals(1, words.length);
            TestSuite.assertEquals("VAT", words[0].map(t => t.tile.letter).join(''));
        });

        TestSuite.it("should identify main word and one horizontal cross-word", () => {
            //  P A T
            //  A <- new
            //  T <- new
            board = createTestBoard([ [0,1,mockTile('P',3)], [0,2,mockTile('A',1)], [0,3,mockTile('T',1)] ]); // PAT existing
            const moves = mockMoves([ [1,1,mockTile('A',1)], [2,1,mockTile('T',1)] ]); // New A, T forming AT vertically and AA horizontally
            moves.forEach(m => board.grid[m.to.row][m.to.col].tile = m.tileRef); // Place new A, T

            // Main word is AT (vertical)
            const words = identifyAllPlayedWords(moves, board, 'vertical');
            TestSuite.assertEquals(2, words.length, "Should find main word (AT) and cross-word (AA)");

            const wordStrings = words.map(w => w.map(t=>t.tile.letter).join('')).sort();
            TestSuite.assertDeepEquals(["AA", "AT"], wordStrings, "Identified words are incorrect.");
        });

        TestSuite.it("should identify main word and multiple cross-words", () => {
            //   H A T  (HAT is new)
            //   I S E
            //   D O G
            // Existing: [1,0,'I'],[1,1,'S'],[1,2,'E'], [2,0,'D'],[2,1,'O'],[2,2,'G']
            board = createTestBoard([
                [1,0,mockTile('I',1)], [1,1,mockTile('S',1)], [1,2,mockTile('E',1)],
                [2,0,mockTile('D',2)], [2,1,mockTile('O',1)], [2,2,mockTile('G',2)]
            ]);
            const moves = mockMoves([ // Player plays HAT horizontally
                [0,0,mockTile('H',4)], [0,1,mockTile('A',1)], [0,2,mockTile('T',1)]
            ]);
            moves.forEach(m => board.grid[m.to.row][m.to.col].tile = m.tileRef);

            const words = identifyAllPlayedWords(moves, board, 'horizontal');
            TestSuite.assertEquals(4, words.length, "Should be HAT, HID, AS, TEG");
            const wordStrings = words.map(w => w.map(t=>t.tile.letter).join('')).sort();
            TestSuite.assertDeepEquals(["AS", "HAT", "HID", "TEG"], wordStrings);
        });

        TestSuite.it("should handle single tile placement forming two cross-words", () => {
            //   P A L
            // H O M E  (O is new)
            //   S T Y
            board = createTestBoard([
                [0,1,mockTile('A',1)], [1,0,mockTile('H',4)], [1,2,mockTile('M',3)], [2,1,mockTile('S',1)]
            ]);
            const moves = mockMoves([[1,1,mockTile('O',1)]]); // Player places O
            moves.forEach(m => board.grid[m.to.row][m.to.col].tile = m.tileRef);

            // If main direction is horizontal for 'O', cross words are 'AOS' and 'HOM'
            // The identifyAllPlayedWords might return 3 words if 'O' itself is considered a word.
            // Let's assume 'O' alone isn't scored if it forms longer words.
            // The current logic for identifyAllPlayedWords will identify HOM (main, length 3) and AOS (cross, length 3) if direction 'horizontal'.
            // If direction is 'vertical', main is AOS, cross is HOM.
            // Test with 'horizontal' as main direction.
            const wordsHorizontal = identifyAllPlayedWords(moves, board, 'horizontal');
            const wordStringsH = wordsHorizontal.map(w => w.map(t=>t.tile.letter).join('')).sort();
            TestSuite.assertTrue(wordStringsH.includes("AOS") && wordStringsH.includes("HOM"), "Failed for horizontal 'O'");
            TestSuite.assertEquals(2, wordStringsH.length, "Should be 2 words for horizontal 'O' placement");


            // Reset board for vertical check
            board = createTestBoard([
                [0,1,mockTile('A',1)], [1,0,mockTile('H',4)], [1,2,mockTile('M',3)], [2,1,mockTile('S',1)]
            ]);
            moves.forEach(m => board.grid[m.to.row][m.to.col].tile = m.tileRef);
            const wordsVertical = identifyAllPlayedWords(moves, board, 'vertical');
            const wordStringsV = wordsVertical.map(w => w.map(t=>t.tile.letter).join('')).sort();
            TestSuite.assertTrue(wordStringsV.includes("AOS") && wordStringsV.includes("HOM"), "Failed for vertical 'O'");
            TestSuite.assertEquals(2, wordStringsV.length, "Should be 2 words for vertical 'O' placement");
        });
    });

    TestSuite.describe("calculateWordScore", () => {
        const gameSettings = { tileValues: DEFAULT_TILE_VALUES, rackSize: RACK_SIZE, sevenTileBonus: 50 };
        let board;

        const MOCK_A = mockTile('A',1); const MOCK_B = mockTile('B',3); const MOCK_C = mockTile('C',3);
        const MOCK_D = mockTile('D',2); const MOCK_E = mockTile('E',1); const MOCK_F = mockTile('F',4);
        const MOCK_G = mockTile('G',2); const MOCK_H = mockTile('H',4);
        const BLANK_E = mockTile('',0,true,'E'); BLANK_E.value = 0; // Blank assigned E

        TestSuite.it("scores simple word, no bonuses", () => {
            board = createTestBoard();
            const moves = mockMoves([ [7,7,MOCK_H], [7,8,MOCK_A], [7,9,MOCK_T] ]); // HAT = 4+1+1=6
            moves.forEach(m => board.grid[m.to.row][m.to.col].tile = m.tileRef);
            const words = identifyAllPlayedWords(moves, board, 'horizontal');
            const result = calculateWordScore(words, board, moves, gameSettings);
            TestSuite.assertEquals(6, result.score);
            TestSuite.assertEquals(0, result.usedBonusSquares.length);
        });

        TestSuite.it("scores word with Double Letter bonus", () => {
            board = createTestBoard();
            board.grid[7][7].bonus = BONUS_TYPES.DL; // H on DL
            const moves = mockMoves([ [7,7,MOCK_H], [7,8,MOCK_A], [7,9,MOCK_T] ]); // (H*2)+A+T = (4*2)+1+1 = 8+1+1=10
            moves.forEach(m => board.grid[m.to.row][m.to.col].tile = m.tileRef);
            const words = identifyAllPlayedWords(moves, board, 'horizontal');
            const result = calculateWordScore(words, board, moves, gameSettings);
            TestSuite.assertEquals(10, result.score);
            TestSuite.assertEquals(1, result.usedBonusSquares.length);
            TestSuite.assertDeepEquals({r:7,c:7}, result.usedBonusSquares[0]);
        });

        TestSuite.it("scores word with Triple Word bonus", () => {
            board = createTestBoard();
            board.grid[7][7].bonus = BONUS_TYPES.TW; // H on TW
            const moves = mockMoves([ [7,7,MOCK_H], [7,8,MOCK_A], [7,9,MOCK_T] ]); // (H+A+T)*3 = (4+1+1)*3 = 6*3=18
            moves.forEach(m => board.grid[m.to.row][m.to.col].tile = m.tileRef);
            const words = identifyAllPlayedWords(moves, board, 'horizontal');
            const result = calculateWordScore(words, board, moves, gameSettings);
            TestSuite.assertEquals(18, result.score);
            TestSuite.assertEquals(1, result.usedBonusSquares.length);
        });

        TestSuite.it("scores word with DL and DW bonuses", () => {
            board = createTestBoard();
            board.grid[7][7].bonus = BONUS_TYPES.DL; // H on DL
            board.grid[7][8].bonus = BONUS_TYPES.DW; // A on DW
            const moves = mockMoves([ [7,7,MOCK_H], [7,8,MOCK_A], [7,9,MOCK_T] ]); // ((H*2)+A+T)*2 = ((4*2)+1+1)*2 = (8+1+1)*2 = 10*2=20
            moves.forEach(m => board.grid[m.to.row][m.to.col].tile = m.tileRef);
            const words = identifyAllPlayedWords(moves, board, 'horizontal');
            const result = calculateWordScore(words, board, moves, gameSettings);
            TestSuite.assertEquals(20, result.score);
            TestSuite.assertEquals(2, result.usedBonusSquares.length);
        });

        TestSuite.it("scores word with multiple DW bonuses (multiplicative)", () => {
            board = createTestBoard();
            board.grid[7][7].bonus = BONUS_TYPES.DW; // H on DW
            board.grid[7][8].bonus = BONUS_TYPES.DW; // A on DW
            const moves = mockMoves([ [7,7,MOCK_H], [7,8,MOCK_A], [7,9,MOCK_T] ]); // (H+A+T)*2*2 = (4+1+1)*4 = 6*4=24
            moves.forEach(m => board.grid[m.to.row][m.to.col].tile = m.tileRef);
            const words = identifyAllPlayedWords(moves, board, 'horizontal');
            const result = calculateWordScore(words, board, moves, gameSettings);
            TestSuite.assertEquals(24, result.score);
            TestSuite.assertEquals(2, result.usedBonusSquares.length);
        });

        TestSuite.it("scores word with a blank tile (0 value)", () => {
            board = createTestBoard();
            board.grid[7][7].bonus = BONUS_TYPES.DL; // Blank (as E) on DL
            // H (blank E) T. H=4, blank=0, T=1. (H + blank*2 + T) = 4 + 0*2 + 1 = 5
            const moves = mockMoves([ [7,6,MOCK_H], [7,7,BLANK_E], [7,8,MOCK_T] ]);
            moves.forEach(m => board.grid[m.to.row][m.to.col].tile = m.tileRef);
            const words = identifyAllPlayedWords(moves, board, 'horizontal');
            const result = calculateWordScore(words, board, moves, gameSettings);
            TestSuite.assertEquals(5, result.score, "Blank on DL should still be 0 for letter, DL applies to 0.");
            TestSuite.assertEquals(1, result.usedBonusSquares.length);
        });

        TestSuite.it("scores with 7-tile bonus (bingo)", () => {
            board = createTestBoard();
            // CAB = 3+1+3=7. Bingo = 50. Total = 57
            const seven_moves = [ MOCK_C, MOCK_A, MOCK_B, MOCK_D, MOCK_E, MOCK_F, MOCK_G ].slice(0, gameSettings.rackSize).map((tile, i) => ({
                tileRef: tile, to: {row: 7, col: 7+i}
            }));
            seven_moves.forEach(m => board.grid[m.to.row][m.to.col].tile = m.tileRef);

            // For this test, let's assume the word formed is just the first 3 tiles for simplicity of base score calculation
            const wordTiles = seven_moves.slice(0,3); // CAB
            const wordValue = wordTiles.reduce((sum,m)=>sum+m.tileRef.value,0); // 3+1+3 = 7

            const mockWordsForScoring = [ wordTiles.map(m => ({tile: m.tileRef, r: m.to.row, c: m.to.col})) ];

            const result = calculateWordScore(mockWordsForScoring, board, seven_moves, gameSettings);
            TestSuite.assertEquals(wordValue + gameSettings.sevenTileBonus, result.score); // 7 + 50 = 57
        });

        TestSuite.it("does not reuse bonuses", () => {
            board = createTestBoard();
            board.grid[7][7].bonus = BONUS_TYPES.DL;
            board.grid[7][7].bonusUsed = true; // Mark as used
            const moves = mockMoves([ [7,7,MOCK_H], [7,8,MOCK_A], [7,9,MOCK_T] ]); // H(DL used)+A+T = 4+1+1=6
            moves.forEach(m => board.grid[m.to.row][m.to.col].tile = m.tileRef);
            const words = identifyAllPlayedWords(moves, board, 'horizontal');
            const result = calculateWordScore(words, board, moves, gameSettings);
            TestSuite.assertEquals(6, result.score);
            TestSuite.assertEquals(0, result.usedBonusSquares.length, "Should not list already used bonus square");
        });

        TestSuite.it("scores main word and cross-words correctly", () => {
            //  P A T (PAT existing)
            //  A (new A)
            //  T (new T)
            // Main: AT vertically (A=1, T=1 -> 1+1=2)
            // Cross: AA horizontally (A=1, new A=1 -> on DL -> 1*2 = 2. Total AA = 1 + 2 = 3)
            // Total score = 2 + 3 = 5
            board = createTestBoard([ [0,1,mockTile('P',3)], [0,2,MOCK_A], [0,3,mockTile('T',1)] ]);
            board.grid[1][1].bonus = BONUS_TYPES.DL; // New A is on DL

            const moves = mockMoves([ [1,1,MOCK_A], [2,1,MOCK_T] ]);
            moves.forEach(m => board.grid[m.to.row][m.to.col].tile = m.tileRef);

            const words = identifyAllPlayedWords(moves, board, 'vertical');
            // words should be: [ [A at 0,2], [new A at 1,1 on DL] ] (AA)
            //                  [ [new A at 1,1 on DL], [new T at 2,1] ] (AT)

            const result = calculateWordScore(words, board, moves, gameSettings);
            // Word AA: Tile at (0,2) is 'A' (value 1). Tile at (1,1) is new 'A' (value 1) on DL -> 1*2=2. Score for AA = 1+2 = 3.
            // Word AT: Tile at (1,1) is new 'A' (value 1) on DL -> 1*2=2 (bonus applied only once per tile per turn). Tile at (2,1) is new 'T' (value 1). Score for AT = 2+1=3.
            // Oh, a tile's letter bonus applies to its value in ALL words it forms during that turn.
            // Recalculate:
            // New A at (1,1) is on DL, value 1 -> effective value 1*2=2.
            // Word AA: A(0,2 existing, val 1) + A(1,1 new, effective val 2) = 1+2 = 3.
            // Word AT: A(1,1 new, effective val 2) + T(2,1 new, val 1) = 2+1 = 3.
            // Total = 3+3 = 6.
            TestSuite.assertEquals(6, result.score);
            TestSuite.assertEquals(1, result.usedBonusSquares.length);
            TestSuite.assertDeepEquals({r:1,c:1}, result.usedBonusSquares[0]);
        });
    });

    TestSuite.describe("Scoring via applyTurnDataFromURL", () => {
        const P1_BROWSER_ID = "p1browser";
        const P2_BROWSER_ID = "p2browser";
        let game;

        const setupGameForURLTest = (initialBoardTiles = [], turn = 1, currentPlayerIdx = 0, localBrowserId = P2_BROWSER_ID) => {
            mockStorage = MockLocalStorage();
            const gameId = "urlScoreTest";
            const seed = 12345;

            // Temporarily set global BROWSER_PLAYER_ID for correct localPlayerId determination in load/init
            window.BROWSER_PLAYER_ID_backup = window.BROWSER_PLAYER_ID;
            window.BROWSER_PLAYER_ID = localBrowserId;

            // Initialize a new game state or load if one was saved by a previous step.
            // For these tests, we usually want a fresh state modified for the test case.
            game = new GameState(gameId, seed, { tileValues: DEFAULT_TILE_VALUES });
            game.creatorId = P1_BROWSER_ID; // P1 is always creator for these tests.
            game.turnNumber = turn;
            game.currentPlayerIndex = currentPlayerIdx; // This is player whose turn it *was* before URL data.

            // Manually set scores to 0 for players
            game.players[0].score = 0;
            game.players[1].score = 0;

            // Set up board with initial tiles
            initialBoardTiles.forEach(t => {
                if (game.board.grid[t.r] && game.board.grid[t.r][t.c]) {
                    game.board.grid[t.r][t.c].tile = t.tile;
                    if (t.bonus) game.board.grid[t.r][t.c].bonus = t.bonus;
                    if (t.bonusUsed) game.board.grid[t.r][t.c].bonusUsed = t.bonusUsed;
                }
            });

            // Racks and bag might need adjustment for draw simulation if not covered by GameState constructor fully for tests
            game.players[0].rack = [mockTile('S',1), mockTile('C',3), mockTile('R',1), mockTile('A',1), mockTile('B',3), mockTile('L',1), mockTile('E',1)]; // P1 Rack
            game.players[1].rack = [mockTile('Q',10), mockTile('U',1), mockTile('I',1), mockTile('Z',10), mockTile('X',8), mockTile('J',8), mockTile('K',5)]; // P2 Rack
            // Ensure bag has enough tiles for drawing after play
            game.bag = []; for(let i=0; i<20; i++) game.bag.push(mockTile('Z', 10));


            saveGameStateToLocalStorage(game, mockStorage); // Save this specific setup

            // This global currentGame is what applyTurnDataFromURL will operate on after loadGameFromURLOrStorage retrieves it.
            // So, the 'game' variable here is effectively the 'currentGame' that will be affected.
            // No, loadGameFromURLOrStorage sets the global `currentGame`. The `game` var here is a local reference to that.
            // localPlayerId is also set globally by loadGameFromURLOrStorage.
            // We return `game` just to make assertions on it directly if needed, as it's the same object as global `currentGame`.
            return game;
        };

        const tearDownGameForURLTest = () => {
            window.BROWSER_PLAYER_ID = window.BROWSER_PLAYER_ID_backup; // Restore
            currentGame = null; // Clean up global
            localPlayerId = null; // Clean up global
            mockStorage.clear();
        };

        TestSuite.it("P2 loads URL from P1's simple word play, score calculated", () => {
            // P1 plays HAT (H=4, A=1, T=1 -> 6 points). P1 is player index 0.
            // Game state before this URL: P1 (idx 0) was current player, turn 1. Settings are default.
            game = setupGameForURLTest([], 1, 0, P2_BROWSER_ID); // P2 is this browser

            const p1OriginalScore = game.players[0].score;
            const p1OriginalRackSize = game.players[0].rack.length; // Should be 7 from setup
            const initialBagSize = game.bag.length;

            // gid, tn, w, wl, wd
            const wordPlayURLParams = "gid=urlScoreTest&tn=2&w=HAT&wl=7.7&wd=horizontal";

            // loadGameFromURLOrStorage will call applyTurnDataFromURL.
            // applyTurnDataFromURL gets 'game' (which is 'currentGame') as its gameState.
            // It will modify game.players[0].score (P1's score).
            loadGameFromURLOrStorage(wordPlayURLParams, mockStorage);

            TestSuite.assertEquals(p1OriginalScore + 6, game.players[0].score, "P1's score should be 6.");
            TestSuite.assertEquals(0, game.players[1].score, "P2's score should be 0.");
            TestSuite.assertEquals(2, game.turnNumber, "Turn number should advance to 2.");
            TestSuite.assertEquals(1, game.currentPlayerIndex, "Current player should be P2 (index 1).");

            // Check P1's rack was refilled (3 tiles played, 3 drawn)
            TestSuite.assertEquals(p1OriginalRackSize, game.players[0].rack.length, "P1's rack size should be restored.");
            TestSuite.assertEquals(initialBagSize - 3, game.bag.length, "Bag should have 3 fewer tiles.");

            tearDownGameForURLTest();
        });

        TestSuite.it("P1 loads URL from P2's word play with DL bonus", () => {
            // P2 plays 'AXE' (A=1, X=8, E=1). X on DL. Score: A + X*2 + E = 1 + 8*2 + 1 = 1+16+1 = 18.
            // P2 is player index 1. P2's move completes turn 2 (URL will be for tn=3).
            // P1 (this browser) is loading.
            // Board setup: DL at 7,8 (where X will be placed)
            const initialBoard = [{r:7,c:8, bonus:BONUS_TYPES.DL}];
            game = setupGameForURLTest(initialBoard, 2, 1, P1_BROWSER_ID);

            const p2OriginalScore = game.players[1].score; // Should be 0
            const p2OriginalRackSize = game.players[1].rack.length;
            const initialBagSize = game.bag.length;

            const wordPlayURLParams = "gid=urlScoreTest&tn=3&w=AXE&wl=7.7&wd=horizontal";
            loadGameFromURLOrStorage(wordPlayURLParams, mockStorage);

            TestSuite.assertEquals(0, game.players[0].score, "P1's score should be 0.");
            TestSuite.assertEquals(p2OriginalScore + 18, game.players[1].score, "P2's score should be 18.");
            TestSuite.assertTrue(game.board.grid[7][8].bonusUsed, "DL bonus at 7,8 should be marked as used.");
            TestSuite.assertEquals(3, game.turnNumber, "Turn number should advance to 3.");
            TestSuite.assertEquals(0, game.currentPlayerIndex, "Current player should be P1 (index 0).");
            TestSuite.assertEquals(p2OriginalRackSize, game.players[1].rack.length, "P2's rack size should be restored.");
            TestSuite.assertEquals(initialBagSize - 3, game.bag.length, "Bag should have 3 fewer tiles after P2's play.");


            tearDownGameForURLTest();
        });

        TestSuite.it("P2 loads URL from P1's play including a blank tile", () => {
            // P1 plays H(blank O)ME. H=4, blank O=0, M=3, E=1. Score: 4+0+3+1=8.
            // Blank O is at index 1 of "HOME", placed at 7,8.
            game = setupGameForURLTest([], 1, 0, P2_BROWSER_ID); // P2 is this browser
            const p1OriginalScore = game.players[0].score;
            const p1OriginalRackSize = game.players[0].rack.length;
            const initialBagSize = game.bag.length;

            // gid, tn, w, wl, wd, bt (blank tile: index_in_w:AssignedLetter)
            const wordPlayURLParams = "gid=urlScoreTest&tn=2&w=HOME&wl=7.7&wd=horizontal&bt=1:O";
            loadGameFromURLOrStorage(wordPlayURLParams, mockStorage);

            TestSuite.assertEquals(p1OriginalScore + 8, game.players[0].score, "P1's score for HOME (blank O) should be 8.");
            const tileAt78 = game.board.grid[7][8].tile; // Word HOME, H at 7,7, O(blank) at 7,8
            TestSuite.assertTrue(tileAt78.isBlank, "Tile at 7,8 should be blank.");
            TestSuite.assertEquals("O", tileAt78.assignedLetter, "Blank tile at 7,8 should be assigned 'O'.");
            TestSuite.assertEquals(0, tileAt78.value, "Blank tile value should be 0.");
            TestSuite.assertEquals(p1OriginalRackSize, game.players[0].rack.length, "P1's rack size should be maintained after playing 4 tiles.");
            TestSuite.assertEquals(initialBagSize - 4, game.bag.length, "Bag should have 4 fewer tiles for HOME.");

            tearDownGameForURLTest();
        });
    });

    TestSuite.describe("LocalStorage Persistence of Dictionary Settings", () => {
        let mockStorage;
        const P1_ID = "p1_localStorage_test";

        const setupLocalStorageTest = () => {
            mockStorage = MockLocalStorage();
            // Mock BROWSER_PLAYER_ID for consistent creatorId
            window.BROWSER_PLAYER_ID_backup = window.BROWSER_PLAYER_ID;
            window.BROWSER_PLAYER_ID = P1_ID;
        };
        const teardownLocalStorageTest = () => {
            window.BROWSER_PLAYER_ID = window.BROWSER_PLAYER_ID_backup;
            mockStorage.clear();
            currentGame = null; // Ensure no leakage
        };

        TestSuite.it("should save and load 'permissive' dictionary settings", () => {
            setupLocalStorageTest();
            const gameId = "lsPermissiveGame";
            const settings = { dictionaryType: 'permissive', dictionaryUrl: null };
            let game = new GameState(gameId, 123, settings);
            game.creatorId = P1_ID;
            saveGameStateToLocalStorage(game, mockStorage);

            let loadedGame = loadGameStateFromLocalStorage(gameId, mockStorage);
            TestSuite.assertNotNull(loadedGame);
            TestSuite.assertEquals("permissive", loadedGame.settings.dictionaryType);
            TestSuite.assertNull(loadedGame.settings.dictionaryUrl);
            teardownLocalStorageTest();
        });

        TestSuite.it("should save and load 'freeapi' dictionary settings", () => {
            setupLocalStorageTest();
            const gameId = "lsFreeApiGame";
            const settings = { dictionaryType: 'freeapi', dictionaryUrl: null };
            let game = new GameState(gameId, 456, settings);
            game.creatorId = P1_ID;
            saveGameStateToLocalStorage(game, mockStorage);

            let loadedGame = loadGameStateFromLocalStorage(gameId, mockStorage);
            TestSuite.assertNotNull(loadedGame);
            TestSuite.assertEquals("freeapi", loadedGame.settings.dictionaryType);
            TestSuite.assertNull(loadedGame.settings.dictionaryUrl);
            teardownLocalStorageTest();
        });

        TestSuite.it("should save and load 'custom' dictionary settings with URL", () => {
            setupLocalStorageTest();
            const gameId = "lsCustomGame";
            const customUrl = "http://my.api.com/lookup=";
            const settings = { dictionaryType: 'custom', dictionaryUrl: customUrl };
            let game = new GameState(gameId, 789, settings);
            game.creatorId = P1_ID;
            saveGameStateToLocalStorage(game, mockStorage);

            let loadedGame = loadGameStateFromLocalStorage(gameId, mockStorage);
            TestSuite.assertNotNull(loadedGame);
            TestSuite.assertEquals("custom", loadedGame.settings.dictionaryType);
            TestSuite.assertEquals(customUrl, loadedGame.settings.dictionaryUrl);
            teardownLocalStorageTest();
        });

        TestSuite.it("loadGameStateFromLocalStorage should handle older game state without dictionary settings (defaulting)", () => {
            setupLocalStorageTest();
            const gameId = "lsOldGame";
            // Simulate an old game state string that wouldn't have dictionaryType/Url in its settings field
            const oldGameSerializable = {
                gameId: gameId, randomSeed: 101, settings: { boardSize: 15 }, // No dict settings
                turnNumber: 5, currentPlayerIndex: 0, players: [], bag: [], boardGrid: []
            };
            mockStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + gameId, JSON.stringify(oldGameSerializable));

            let loadedGame = loadGameStateFromLocalStorage(gameId, mockStorage);
            TestSuite.assertNotNull(loadedGame);
            // GameState constructor defaults to 'permissive' if not provided in settings
            TestSuite.assertEquals("permissive", loadedGame.settings.dictionaryType, "Should default to permissive for old state.");
            TestSuite.assertNull(loadedGame.settings.dictionaryUrl, "Should default to null URL for old state.");
            teardownLocalStorageTest();
        });
    });
}
