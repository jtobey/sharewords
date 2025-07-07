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
        let originalLocalPlayerId;

        // Helper to mock localPlayerId for these specific tests
        const withMockLocalPlayerId = (id, fn) => {
            originalLocalPlayerId = window.localPlayerId; // Assuming localPlayerId is global
            window.localPlayerId = id;
            try {
                fn();
            } finally {
                window.localPlayerId = originalLocalPlayerId;
            }
        };

        TestSuite.it("should generate correct URL for a pass action", () => {
            // generateTurnURL(gameId, turnNumber, turnData, seed = null, settings = null, exchangeData = null)
            const url = generateTurnURL("game123", 5, null, null, null, ""); // seed, settings, exchangeData
            TestSuite.assertTrue(url.includes("gid=game123"), "URL should contain gameId");
            TestSuite.assertTrue(url.includes("tn=5"), "URL should contain turnNumber");
            TestSuite.assertTrue(url.includes("ex="), "URL should contain ex parameter for pass");
            TestSuite.assertFalse(url.includes("ex=0"), "URL should be ex= for pass, not ex=0");
        });

        TestSuite.it("should generate correct URL for an exchange action with indices", () => {
            const url = generateTurnURL("game456", 3, null, null, null, "0,2,5"); // seed, settings, exchangeData
            TestSuite.assertTrue(url.includes("gid=game456"));
            TestSuite.assertTrue(url.includes("tn=3"));
            TestSuite.assertTrue(url.includes("ex=0,2,5"), "URL should contain ex parameter with indices");
        });

        TestSuite.it("should generate URL for word play without ex parameter if exchangeData is null", () => {
            const wordData = { word: "HELLO", start_row: 7, start_col: 7, direction: 'horizontal', blanks_info: [] };
            // generateTurnURL(gameId, turnNumber, turnData, seed = null, settings = null, exchangeData = null)
            const url = generateTurnURL("game789", 2, wordData, null, defaultSettings, null); // seed, settings, exchangeData (null for word play)
            TestSuite.assertTrue(url.includes("gid=game789"));
            TestSuite.assertTrue(url.includes("tn=2"));
            TestSuite.assertTrue(url.includes("w=HELLO"));
            TestSuite.assertFalse(url.includes("ex="), "URL for word play should not contain ex parameter");
            // Settings (dt) should not be in non-initial URL
            TestSuite.assertFalse(url.includes("dt="), "Non-initial URL should not contain dt");
        });

        TestSuite.it("should prioritize ex parameter over wordData if both provided", () => {
            const wordData = { word: "HELLO", start_row: 7, start_col: 7, direction: 'horizontal', blanks_info: [] };
            const url = generateTurnURL("gameXYZ", 4, wordData, null, defaultSettings, "1,3"); // seed, settings, exchangeData
            TestSuite.assertTrue(url.includes("gid=gameXYZ"));
            TestSuite.assertTrue(url.includes("tn=4"));
            TestSuite.assertTrue(url.includes("ex=1,3"), "URL should contain ex parameter for exchange");
            TestSuite.assertFalse(url.includes("w=HELLO"), "URL should not contain word if ex is present");
            TestSuite.assertFalse(url.includes("dt="), "Non-initial URL with ex should not contain dt");
        });

        TestSuite.it("should include dictionary type for initial URL (turn 1, localPlayerId='player1') if not permissive", () => {
            withMockLocalPlayerId('player1', () => {
                const wordData = { word: "FIRST", start_row: 7, start_col: 7, direction: 'h', blanks_info:[]};
                // generateTurnURL(gameId, turnNumber, turnData, seed, settings, exchangeData)
                const url = generateTurnURL("gameInit", 1, wordData, 12345, freeApiSettings, null);
                TestSuite.assertTrue(url.includes("dt=freeapi"), "Initial URL for P1 should include dt=freeapi");
                TestSuite.assertFalse(url.includes("du="), "Initial URL for freeapi should not include du");
            });
        });

        TestSuite.it("should include custom dictionary URL for initial URL (turn 1, localPlayerId='player1') if type is custom", () => {
            withMockLocalPlayerId('player1', () => {
                const wordData = { word: "SETUP", start_row: 7, start_col: 7, direction: 'h', blanks_info:[]};
                const url = generateTurnURL("gameCustom", 1, wordData, 54321, customApiSettings, null);
                TestSuite.assertTrue(url.includes("dt=custom"), "Initial URL for P1 should include dt=custom");
                TestSuite.assertTrue(url.includes(`du=${encodeURIComponent(customApiSettings.dictionaryUrl)}`), "Initial URL for P1 should include du for custom type");
            });
        });

        TestSuite.it("should NOT include dictionary type for initial URL (turn 1, localPlayerId='player1') if permissive", () => {
            withMockLocalPlayerId('player1', () => {
                const wordData = { word: "BEGIN", start_row: 7, start_col: 7, direction: 'h', blanks_info:[]};
                const url = generateTurnURL("gamePerm", 1, wordData, 67890, defaultSettings, null);
                TestSuite.assertFalse(url.includes("dt="), "Initial URL for P1 (permissive) should not include dt");
            });
        });

        TestSuite.it("should NOT include dictionary type for initial URL if localPlayerId is 'player2' (P2 making first move - unusual scenario)", () => {
            withMockLocalPlayerId('player2', () => {
                const wordData = { word: "FIRSTP2", start_row: 7, start_col: 7, direction: 'h', blanks_info:[]};
                const url = generateTurnURL("gameInitP2", 1, wordData, 12345, freeApiSettings, null);
                TestSuite.assertFalse(url.includes("dt="), "Initial URL generated by P2 should not include dt");
            });
        });


        TestSuite.it("should NOT include dictionary type for non-initial URLs (turn > 1)", () => {
            // localPlayerId doesn't matter here as turn > 1
            const wordData = { word: "NEXT", start_row: 7, start_col: 8, direction: 'h', blanks_info:[]};
            const url = generateTurnURL("gameNext", 2, wordData, null, freeApiSettings, null); // seed, settings, exchangeData
            TestSuite.assertFalse(url.includes("dt="), "Non-initial URL should not include dt even if settings provided");
        });
    });

    // Helper to setup a basic game state for testing pass/exchange handlers
    function setupTestGame(initialSeed = 12345, gameSettings = {}, p1Rack = null, p2Rack = null, bagContents = null, currentLocalPlayerId = "player1", currentPlayerIdx = 0, currentTurn = 1) {
        currentGame = new GameState("testGame", initialSeed, gameSettings);

        // Set global localPlayerId for the test context
        window.localPlayerId = currentLocalPlayerId;

        currentGame.players[0].name = "Player 1";
        currentGame.players[1].name = "Player 2";
        currentGame.currentPlayerIndex = currentPlayerIdx;
        currentGame.turnNumber = currentTurn;

        currentGame.players[0].rack = p1Rack || [
            mockTile('R1',1,false,null,"r1"), mockTile('R2',1,false,null,"r2"), mockTile('R3',1,false,null,"r3"),
            mockTile('R4',1,false,null,"r4"), mockTile('R5',1,false,null,"r5"), mockTile('R6',1,false,null,"r6"),
            mockTile('R7',1,false,null,"r7")
        ];
        currentGame.players[1].rack = p2Rack || [mockTile('P2A'), mockTile('P2B')];

        currentGame.bag = bagContents || [
            mockTile('B1',10,false,null,"b1"), mockTile('B2',10,false,null,"b2"), mockTile('B3',10,false,null,"b3"),
            mockTile('B4',10,false,null,"b4"), mockTile('B5',10,false,null,"b5")
        ];

        // Ensure turn-url input exists for tests that update it
        if (!document.getElementById('turn-url')) {
            const turnUrlInput = document.createElement('input');
            turnUrlInput.type = 'text';
            turnUrlInput.id = 'turn-url';
            document.body.appendChild(turnUrlInput);
        }
        return currentGame;
    }

    // Store original alert/prompt and replace them
    const _originalAlert = window.alert;
    const _originalPrompt = window.prompt;
    let _mockAlertMessage = "";
    let _mockPromptResponse = "";
    // let mockNextRandom = 0.5; // Default mock random value (PRNG mocking not used here)
    let _originalWindowLocalPlayerId; // To backup global localPlayerId

    TestSuite.describe("Pass and Exchange Logic", () => {
        let game;

        const mockUI = () => {
            window.alert = (msg) => { _mockAlertMessage = msg; console.log("Mock Alert:", msg); };
            window.prompt = (msg) => { console.log("Mock Prompt:", msg); return _mockPromptResponse; };
            _originalWindowLocalPlayerId = window.localPlayerId; // Backup before test potentially changes it
        };
        const unMockUI = () => {
            window.alert = _originalAlert;
            window.prompt = _originalPrompt;
            window.localPlayerId = _originalWindowLocalPlayerId; // Restore
        };

        TestSuite.it("handlePassTurn: should advance turn, switch player, generate pass URL", () => {
            mockUI();
            // Setup: P1's turn (idx 0), local player is P1.
            game = setupTestGame(123, {}, null, null, null, "player1", 0, 1);
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
            const p1InitialRack = [
                mockTile('R1',1,false,null, "racktile1"), mockTile('R2',1,false,null, "racktile2"),
                mockTile('R3',1,false,null,"racktile3")
            ];
            const initialBag = [
                mockTile('B1',10,false,null,"bagtile1"), mockTile('B2',10,false,null,"bagtile2"),
                mockTile('B3',10,false,null,"bagtile3")
            ];
            // Setup: P1's turn (idx 0), local player is P1.
            game = setupTestGame(123, {}, [...p1InitialRack], null, [...initialBag], "player1", 0, 1);

            const p1 = game.players[0];
            const initialRackSize = p1.rack.length; // Should be 3 from p1InitialRack
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
            const p1InitialRack = [mockTile('R1',1,false,null,"r1"), mockTile('R2',1,false,null,"r2")];
            const initialBag = [mockTile('B1',10,false,null,"b1")]; // Only 1 tile in bag
            // Setup: P1's turn (idx 0), local player is P1.
            game = setupTestGame(123, {}, p1InitialRack, null, initialBag, "player1", 0, 1);

            _mockPromptResponse = "0,1"; // Request to exchange 2 tiles

            const p1RackBeforeIds = game.players[0].rack.map(t => t.id);
            const initialTurn = game.turnNumber;

            handleExchangeTiles();

            const p1RackAfterIds = game.players[0].rack.map(t => t.id);
            TestSuite.assertDeepEquals(p1RackBeforeIds, p1RackAfterIds, "Player rack (by tile IDs) should be unchanged if bag is too small.");
            TestSuite.assertEquals(initialTurn, game.turnNumber, "Turn number should not change if exchange fails.");
            TestSuite.assertTrue(_mockAlertMessage.includes("Not enough tiles in the bag"), "Alert message for insufficient bag is incorrect.");
            unMockUI();
        });

         TestSuite.it("handleExchangeTiles: should handle non-numeric/out-of-bounds indices gracefully", () => {
            mockUI();
            const p1InitialRack = [
                mockTile('R1',1,false,null,"r1"), mockTile('R2',1,false,null,"r2"),
                mockTile('R3',1,false,null,"r3")
            ];
            const initialBag = [mockTile('B1',10,false,null,"b1"), mockTile('B2',10,false,null,"b2")];
            // Setup: P1's turn (idx 0), local player is P1.
            game = setupTestGame(123, {}, p1InitialRack, null, initialBag, "player1", 0, 1);

            _mockPromptResponse = "0,foo,10,1"; // Exchange R1 (idx 0) and R2 (idx 1). foo invalid, 10 out of bounds.

            handleExchangeTiles();

            TestSuite.assertEquals(p1InitialRack.length, game.players[0].rack.length, "Rack size should be constant.");
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
        // let originalGameState; // To hold the state before URL processing (not strictly needed with full re-init)
        let _originalWindowLocalPlayerId_URLTest; // Backup for window.localPlayerId

        // This setup runs before each 'it' block in this 'describe'
        const beforeEachURLTest = (currentTurnOnServer, currentPlayerIdxOnServer, gameSettings = {}, browserLocalPlayerId) => {
            mockStorage = MockLocalStorage();

            // Set the window.localPlayerId to simulate who is opening the URL
            _originalWindowLocalPlayerId_URLTest = window.localPlayerId;
            window.localPlayerId = browserLocalPlayerId;

            // If a game already exists in mockStorage (e.g. simulating P1 has played and P2 is loading)
            // it should be set up by the test itself before calling loadGameFromURLOrStorage.
            // This beforeEach is more for initializing the environment.
            // The actual game state that loadGameFromURLOrStorage loads will come from mockStorage.
            // So, the test case needs to save a relevant state to mockStorage first.

            // For tests where P2 loads an initial URL from P1 (game not in P2's localStorage yet):
            // currentGame will be null initially. loadGameFromURLOrStorage will create it.

            // For tests where a player loads a subsequent URL (game already in their localStorage):
            // The test should save a version of the game to mockStorage that reflects the player's prior state.
            // Example: P1 (turn 1 done) -> P2 (loads P1's URL, makes turn 2) -> P1 (loads P2's URL)
            // When testing P1 loading P2's URL, P1's localStorage would have game state after turn 1.

            // Simplified: We'll create a base game state reflecting "server" state *before* the URL's action is applied,
            // then save it from the perspective of the `browserLocalPlayerId`.
            let gameToSave = new GameState("urlTestGame", 67890, gameSettings);
            gameToSave.turnNumber = currentTurnOnServer;
            gameToSave.currentPlayerIndex = currentPlayerIdxOnServer;
            gameToSave.players[0].rack = [mockTile('A'), mockTile('B'), mockTile('C'), mockTile('D'), mockTile('E'), mockTile('F'), mockTile('G')];
            gameToSave.players[1].rack = [mockTile('H'), mockTile('I'), mockTile('J'), mockTile('K'), mockTile('L'), mockTile('M'), mockTile('N')];
            gameToSave.bag = []; for(let i=0; i<20; i++) gameToSave.bag.push(mockTile(`Z${i}`,10));

            // Crucially, saveGameStateToLocalStorage uses the *global window.localPlayerId* to store savedLocalPlayerId
            saveGameStateToLocalStorage(gameToSave, mockStorage);
        };

        const afterEachURLTest = () => {
             window.localPlayerId = _originalWindowLocalPlayerId_URLTest; // Restore global
             currentGame = null; // Clean up global currentGame
             mockStorage.clear();
        };


        TestSuite.it("P2 loads URL from P1 who passed turn (default permissive settings)", () => {
            // P1 (server current player idx 0) has just finished turn 1 by passing. URL is for turn 2.
            // P2 (browserLocalPlayerId 'player2') is opening this URL.
            // P2's localStorage has game state from end of turn 1 (P1 was current player).
            beforeEachURLTest(1, 0, {}, 'player2');
            const passUrlParams = "gid=urlTestGame&tn=2&ex=&seed=67890"; // No creator in URL
            loadGameFromURLOrStorage(passUrlParams, mockStorage);

            TestSuite.assertEquals(2, currentGame.turnNumber);
            TestSuite.assertEquals(1, currentGame.currentPlayerIndex); // Should be P2's turn
            TestSuite.assertEquals("permissive", currentGame.settings.dictionaryType);
            TestSuite.assertEquals("player2", window.localPlayerId, "Browser's localPlayerId should remain P2");
            afterEachURLTest();
        });

        TestSuite.it("P1 loads URL from P2 who exchanged tiles (default permissive settings)", () => {
            // P2 (server current player idx 1) has just finished turn 2 by exchanging. URL is for turn 3.
            // P1 (browserLocalPlayerId 'player1') is opening this URL.
            // P1's localStorage has game state from end of turn 2 (P2 was current player).
            beforeEachURLTest(2, 1, {}, 'player1');
            const p2InitialRackBeforeExchangeInTest = [...currentGame.players[1].rack]; // P2's rack on "server"
            const initialBagBeforeExchangeInTest = [...currentGame.bag];

            const exchangeUrlParams = "gid=urlTestGame&tn=3&ex=0,1"; // P2 exchanged 2 tiles
            loadGameFromURLOrStorage(exchangeUrlParams, mockStorage);

            TestSuite.assertEquals(3, currentGame.turnNumber);
            TestSuite.assertEquals(0, currentGame.currentPlayerIndex); // Should be P1's turn
            TestSuite.assertEquals("permissive", currentGame.settings.dictionaryType);
            TestSuite.assertEquals("player1", window.localPlayerId, "Browser's localPlayerId should remain P1");

            const p2_gameState = currentGame.players[1];
            TestSuite.assertEquals(7, p2_gameState.rack.length, "P2 rack size should be maintained.");
            TestSuite.assertFalse(p2_gameState.rack[0].id === p2InitialRackBeforeExchangeInTest[0].id && p2_gameState.rack[1].id === p2InitialRackBeforeExchangeInTest[1].id, "P2's first two tiles should have changed.");
            TestSuite.assertEquals(initialBagBeforeExchangeInTest.length, currentGame.bag.length, "Bag size should be maintained.");
            afterEachURLTest();
        });

        TestSuite.it("P2 loads initial game URL from P1 (first move pass) with 'freeapi' dictionary setting", () => {
            mockStorage = MockLocalStorage(); // P2 has no game yet
            _originalWindowLocalPlayerId_URLTest = window.localPlayerId;
            window.localPlayerId = 'player2'; // P2 is this browser

            const initialUrlWithP1Pass = `gid=newGameFreeApi&tn=1&seed=111&dt=freeapi&ex=`; // No creator
            loadGameFromURLOrStorage(initialUrlWithP1Pass, mockStorage);

            TestSuite.assertNotNull(currentGame, "Game should be initialized for P2.");
            TestSuite.assertEquals("newGameFreeApi", currentGame.gameId);
            TestSuite.assertEquals(1, currentGame.turnNumber, "Turn number should be 1 (P1's completed turn).");
            TestSuite.assertEquals(1, currentGame.currentPlayerIndex, "Current player should be P2 (index 1).");
            TestSuite.assertEquals("player2", window.localPlayerId, "Local player ID for P2 should be 'player2'.");
            TestSuite.assertEquals("freeapi", currentGame.settings.dictionaryType, "Dictionary type should be 'freeapi'.");
            TestSuite.assertNull(currentGame.settings.dictionaryUrl, "Dictionary URL should be null for freeapi.");
            afterEachURLTest();
        });

         TestSuite.it("P2 loads initial game URL from P1 (no first move yet) with 'custom' dictionary setting", () => {
            mockStorage = MockLocalStorage(); // P2 has no game yet
            _originalWindowLocalPlayerId_URLTest = window.localPlayerId;
            window.localPlayerId = 'player2';

            const customUrl = "https://my.dict.co/api?q=";
            const initialUrlCustom = `gid=newGameCustom&seed=222&dt=custom&du=${encodeURIComponent(customUrl)}`;
            loadGameFromURLOrStorage(initialUrlCustom, mockStorage);

            TestSuite.assertNotNull(currentGame);
            TestSuite.assertEquals("newGameCustom", currentGame.gameId);
            TestSuite.assertEquals(0, currentGame.turnNumber, "Turn should be 0 (P1 to make first move).");
            TestSuite.assertEquals(0, currentGame.currentPlayerIndex, "Player should be P1 (index 0).");
            TestSuite.assertEquals("player2", window.localPlayerId);
            TestSuite.assertEquals("custom", currentGame.settings.dictionaryType);
            TestSuite.assertEquals(customUrl, currentGame.settings.dictionaryUrl);
            afterEachURLTest();
        });


        TestSuite.it("P2 loads initial game URL from P1 (first move word play) with 'permissive' (implicit)", () => {
            mockStorage = MockLocalStorage(); // P2 has no game yet
            _originalWindowLocalPlayerId_URLTest = window.localPlayerId;
            window.localPlayerId = 'player2';

            const initialUrlP1Word = `gid=newGameWord&tn=1&seed=333&w=HELLO&wl=7.7&wd=h`; // No creator, no dt/du
            loadGameFromURLOrStorage(initialUrlP1Word, mockStorage);

            TestSuite.assertNotNull(currentGame);
            TestSuite.assertEquals("newGameWord", currentGame.gameId);
            TestSuite.assertEquals(1, currentGame.turnNumber); // P1's move applied
            TestSuite.assertEquals(1, currentGame.currentPlayerIndex); // P2's turn
            TestSuite.assertEquals("player2", window.localPlayerId);
            TestSuite.assertEquals("permissive", currentGame.settings.dictionaryType, "Default to permissive if no dt in URL.");
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
        // No P1_BROWSER_ID or P2_BROWSER_ID needed
        // let game; // Not needed as a suite-level variable, individual tests will use global `currentGame`
        let _originalWindowLocalPlayerId_ScoringTest_v2; // Renamed to avoid conflict if copy-paste error

        const setupGameForURLScoringTest_v2 = (initialBoardTiles = [], turnBeforeUrl, playerIdxBeforeUrl, browserViewingLPI) => {
            mockStorage = MockLocalStorage();
            const gameId = "urlScoreTest"; // Keep consistent for mockStorage
            const seed = 12345;

            _originalWindowLocalPlayerId_ScoringTest_v2 = window.localPlayerId;
            window.localPlayerId = browserViewingLPI;

            let baseGame = new GameState(gameId, seed, { tileValues: DEFAULT_TILE_VALUES });
            baseGame.turnNumber = turnBeforeUrl;
            baseGame.currentPlayerIndex = playerIdxBeforeUrl;
            baseGame.players[0].score = 0;
            baseGame.players[1].score = 0;

            initialBoardTiles.forEach(t => {
                if (baseGame.board.grid[t.r] && baseGame.board.grid[t.r][t.c]) {
                    baseGame.board.grid[t.r][t.c].tile = t.tile;
                    if (t.bonus) baseGame.board.grid[t.r][t.c].bonus = t.bonus;
                    if (t.bonusUsed) baseGame.board.grid[t.r][t.c].bonusUsed = t.bonusUsed;
                }
            });

            // Use distinct IDs for tiles if specific tile tracking is needed in assertions.
            baseGame.players[0].rack = [mockTile('S',1,false,null,"s1"), mockTile('C',3,false,null,"c1"), mockTile('R',1,false,null,"r1"), mockTile('A',1,false,null,"a1"), mockTile('B',3,false,null,"b1"), mockTile('L',1,false,null,"l1"), mockTile('E',1,false,null,"e1")];
            baseGame.players[1].rack = [mockTile('Q',10,false,null,"q2"), mockTile('U',1,false,null,"u2"), mockTile('I',1,false,null,"i2"), mockTile('Z',10,false,null,"z2"), mockTile('X',8,false,null,"x2"), mockTile('J',8,false,null,"j2"), mockTile('K',5,false,null,"k2")];
            baseGame.bag = []; for(let i=0; i<30; i++) baseGame.bag.push(mockTile(`B${i}`, 1, false, null, `bag${i}`));

            saveGameStateToLocalStorage(baseGame, mockStorage);
            // Important: loadGameFromURLOrStorage in the test will load this into global `currentGame`.
            // It will also potentially set global `localPlayerId` based on what was saved.
            // So, the `browserViewingLPI` we set here is for `saveGameStateToLocalStorage`.
            // The `loadGameFromURLOrStorage` in the test will then correctly simulate a browser opening a URL.
        };

        const tearDownGameForURLScoringTest_v2 = () => {
            window.localPlayerId = _originalWindowLocalPlayerId_ScoringTest_v2;
            currentGame = null;
            mockStorage.clear();
        };

        TestSuite.it("P2 loads URL from P1's simple word play, score calculated", () => {
            // P1 (playerIdxBeforeUrl=0) played HAT (6 pts). Turn was 1, now URL is for turn 2.
            // P2 (browserViewingLPI='player2') is loading.
            setupGameForURLScoringTest_v2([], 1, 0, 'player2');

            const p1OriginalScore = 0;
            // After setup, loadGameFromURLOrStorage has NOT been called by setup.
            // The test calls it. currentGame is not yet the fully processed one.
            // We need to get initial bag size from the state *before* loadGameFromURLOrStorage.
            // This means querying the state that was put into mockStorage.
            // A bit complex. Let's assume initialBagSize before load is known or less critical for this exact assertion.
            // Or, more simply, capture it from the `currentGame` that `loadGameStateFromLocalStorage` (called by `loadGameFromURLOrStorage`) prepares.

            const initialUrlParams = "gid=urlScoreTest&tn=2&w=HAT&wl=7.7&wd=horizontal";

            // Manually load to get initial bag size from the perspective of the test runner *before* URL processing
            // This simulates what loadGameFromURLOrStorage would do as its first step.
            let gameLoadedForBagCheck = loadGameStateFromLocalStorage("urlScoreTest", mockStorage);
            const initialBagSize = gameLoadedForBagCheck.bag.length;
            const p1OriginalRackSize = gameLoadedForBagCheck.players[0].rack.length;


            loadGameFromURLOrStorage(initialUrlParams, mockStorage); // This updates global `currentGame`

            TestSuite.assertEquals(p1OriginalScore + 6, currentGame.players[0].score, "P1's score should be 6.");
            TestSuite.assertEquals(0, currentGame.players[1].score, "P2's score should be 0.");
            TestSuite.assertEquals(2, currentGame.turnNumber, "Turn number should advance to 2.");
            TestSuite.assertEquals(1, currentGame.currentPlayerIndex, "Current player should be P2 (index 1).");
            TestSuite.assertEquals(p1OriginalRackSize, currentGame.players[0].rack.length, "P1's rack size should be restored (7).");
            TestSuite.assertEquals(initialBagSize - 3, currentGame.bag.length, "Bag should have 3 fewer tiles.");

            tearDownGameForURLScoringTest_v2();
        });

        TestSuite.it("P1 loads URL from P2's word play with DL bonus", () => {
            // P2 (playerIdxBeforeUrl=1) played AXE (1+8*2+1=18). Turn was 2, URL for turn 3.
            // P1 (browserViewingLPI='player1') is loading.
            const initialBoard = [{r:7,c:8, bonus:BONUS_TYPES.DL}]; // X on DL
            setupGameForURLScoringTest_v2(initialBoard, 2, 1, 'player1');

            const p2OriginalScore = 0;
            let gameLoadedForBagCheck = loadGameStateFromLocalStorage("urlScoreTest", mockStorage);
            const initialBagSize = gameLoadedForBagCheck.bag.length;
            const p2OriginalRackSize = gameLoadedForBagCheck.players[1].rack.length;

            const wordPlayURLParams = "gid=urlScoreTest&tn=3&w=AXE&wl=7.7&wd=horizontal";
            loadGameFromURLOrStorage(wordPlayURLParams, mockStorage);

            TestSuite.assertEquals(0, currentGame.players[0].score, "P1's score should be 0.");
            TestSuite.assertEquals(p2OriginalScore + 18, currentGame.players[1].score, "P2's score should be 18.");
            TestSuite.assertTrue(currentGame.board.grid[7][8].bonusUsed, "DL bonus at 7,8 should be marked as used.");
            TestSuite.assertEquals(3, currentGame.turnNumber, "Turn number should advance to 3.");
            TestSuite.assertEquals(0, currentGame.currentPlayerIndex, "Current player should be P1 (index 0).");

            TestSuite.assertEquals(p2OriginalRackSize, currentGame.players[1].rack.length, "P2's rack size should be restored.");
            TestSuite.assertEquals(initialBagSize - 3, currentGame.bag.length, "Bag should have 3 fewer tiles after P2's play.");

            tearDownGameForURLScoringTest_v2();
        });

        TestSuite.it("P2 loads URL from P1's play including a blank tile", () => {
            // P1 (playerIdxBeforeUrl=0) plays H(blank O)ME (4+0+3+1=8). Turn was 1, URL for turn 2.
            // P2 (browserViewingLPI='player2') is loading.
            setupGameForURLScoringTest_v2([], 1, 0, 'player2');

            const p1OriginalScore = 0;
            let gameLoadedForBagCheck = loadGameStateFromLocalStorage("urlScoreTest", mockStorage);
            const initialBagSize = gameLoadedForBagCheck.bag.length;
            const p1OriginalRackSize = gameLoadedForBagCheck.players[0].rack.length;


            const wordPlayURLParams = "gid=urlScoreTest&tn=2&w=HOME&wl=7.7&wd=horizontal&bt=1:O";
            loadGameFromURLOrStorage(wordPlayURLParams, mockStorage);

            TestSuite.assertEquals(p1OriginalScore + 8, currentGame.players[0].score, "P1's score for HOME (blank O) should be 8.");
            const tileAt78 = currentGame.board.grid[7][8].tile;
            TestSuite.assertTrue(tileAt78.isBlank, "Tile at 7,8 should be blank.");
            TestSuite.assertEquals("O", tileAt78.assignedLetter, "Blank tile at 7,8 should be assigned 'O'.");
            TestSuite.assertEquals(0, tileAt78.value, "Blank tile value should be 0.");

            TestSuite.assertEquals(p1OriginalRackSize, currentGame.players[0].rack.length, "P1's rack size should be maintained after playing 4 tiles.");
            TestSuite.assertEquals(initialBagSize - 4, currentGame.bag.length, "Bag should have 4 fewer tiles for HOME.");

            tearDownGameForURLScoringTest_v2();
        });
    });

    TestSuite.describe("LocalStorage Persistence of Dictionary Settings", () => {
        let mockStorage;
        let _originalWindowLocalPlayerId_LSTest;

        const setupLocalStorageTest = () => {
            mockStorage = MockLocalStorage();
            _originalWindowLocalPlayerId_LSTest = window.localPlayerId;
            window.localPlayerId = 'player1'; // Set a default for saving, tests can override if needed
        };
        const teardownLocalStorageTest = () => {
            window.localPlayerId = _originalWindowLocalPlayerId_LSTest;
            mockStorage.clear();
            currentGame = null;
        };

        TestSuite.it("should save and load 'permissive' dictionary settings and savedLocalPlayerId", () => {
            setupLocalStorageTest();
            const gameId = "lsPermissiveGame";
            const settings = { dictionaryType: 'permissive', dictionaryUrl: null };
            let gameToSave = new GameState(gameId, 123, settings);
            // window.localPlayerId is 'player1' from setupLocalStorageTest, so this will be saved
            saveGameStateToLocalStorage(gameToSave, mockStorage);

            // Before loading, change global localPlayerId to ensure loadGameStateFromLocalStorage sets it
            window.localPlayerId = 'player_test_before_load';
            let loadedGame = loadGameStateFromLocalStorage(gameId, mockStorage);

            TestSuite.assertNotNull(loadedGame);
            TestSuite.assertEquals("permissive", loadedGame.settings.dictionaryType);
            TestSuite.assertNull(loadedGame.settings.dictionaryUrl);
            TestSuite.assertEquals('player1', window.localPlayerId, "Global localPlayerId should be loaded from saved state.");

            // Also check that the loaded raw object from storage had it
            const rawStored = JSON.parse(mockStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + gameId));
            TestSuite.assertEquals('player1', rawStored.savedLocalPlayerId);
            teardownLocalStorageTest();
        });

        TestSuite.it("should save and load 'freeapi' dictionary settings", () => {
            setupLocalStorageTest(); // window.localPlayerId will be 'player1'
            const gameId = "lsFreeApiGame";
            const settings = { dictionaryType: 'freeapi', dictionaryUrl: null };
            let game = new GameState(gameId, 456, settings);
            saveGameStateToLocalStorage(game, mockStorage);

            let loadedGame = loadGameStateFromLocalStorage(gameId, mockStorage);
            TestSuite.assertNotNull(loadedGame);
            TestSuite.assertEquals("freeapi", loadedGame.settings.dictionaryType);
            TestSuite.assertNull(loadedGame.settings.dictionaryUrl);
            TestSuite.assertEquals('player1', window.localPlayerId); // Should be loaded
            teardownLocalStorageTest();
        });

        TestSuite.it("should save and load 'custom' dictionary settings with URL", () => {
            setupLocalStorageTest(); // window.localPlayerId will be 'player1'
            const gameId = "lsCustomGame";
            const customUrl = "http://my.api.com/lookup=";
            const settings = { dictionaryType: 'custom', dictionaryUrl: customUrl };
            let game = new GameState(gameId, 789, settings);
            saveGameStateToLocalStorage(game, mockStorage);

            let loadedGame = loadGameStateFromLocalStorage(gameId, mockStorage);
            TestSuite.assertNotNull(loadedGame);
            TestSuite.assertEquals("custom", loadedGame.settings.dictionaryType);
            TestSuite.assertEquals(customUrl, loadedGame.settings.dictionaryUrl);
            TestSuite.assertEquals('player1', window.localPlayerId); // Should be loaded
            teardownLocalStorageTest();
        });

        TestSuite.it("loadGameStateFromLocalStorage should handle older game state (no savedLocalPlayerId, no dict settings)", () => {
            setupLocalStorageTest(); // Sets global localPlayerId to 'player1' initially, but this will be changed by load
            const gameId = "lsOldGame";
            const oldGameSerializable = {
                gameId: gameId, randomSeed: 101, settings: { boardSize: 15 },
                turnNumber: 5, currentPlayerIndex: 0, players: [], bag: [], boardGrid: []
                // No savedLocalPlayerId, no creatorId
            };
            mockStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + gameId, JSON.stringify(oldGameSerializable));

            // Change global localPlayerId before loading to see if it defaults correctly
            window.localPlayerId = 'player_test_before_load_old';
            let loadedGame = loadGameStateFromLocalStorage(gameId, mockStorage);

            TestSuite.assertNotNull(loadedGame);
            TestSuite.assertEquals("permissive", loadedGame.settings.dictionaryType, "Should default to permissive.");
            TestSuite.assertNull(loadedGame.settings.dictionaryUrl, "Should default to null URL.");
            TestSuite.assertEquals('player1', window.localPlayerId, "Global localPlayerId should default to 'player1' for old save lacking it.");
            teardownLocalStorageTest();
        });
    });
}
