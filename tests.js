// tests.js - Start of the test additions

// --- Test Setup & Mocks ---
const TEST_DEFAULT_TILE_VALUES = {
    'A': 1, 'B': 3, 'C': 3, 'D': 2, 'E': 1, 'F': 4, 'G': 2, 'H': 4, 'I': 1, 'J': 8,
    'K': 5, 'L': 1, 'M': 3, 'N': 1, 'O': 1, 'P': 3, 'Q': 10, 'R': 1, 'S': 1, 'T': 1,
    'U': 1, 'V': 4, 'W': 4, 'X': 8, 'Y': 4, 'Z': 10
};
const TEST_DEFAULT_LETTER_DISTRIBUTION = {
    'A': 9, 'B': 2, 'C': 2, 'D': 4, 'E': 12, 'F': 2, 'G': 3, 'H': 2, 'I': 9, 'J': 1,
    'K': 1, 'L': 4, 'M': 2, 'N': 6, 'O': 8, 'P': 2, 'Q': 1, 'R': 6, 'S': 4, 'T': 6,
    'U': 4, 'V': 2, 'W': 2, 'X': 1, 'Y': 2, 'Z': 1
};
const TEST_DEFAULT_BLANK_COUNT = 2;
const TEST_DEFAULT_SEVEN_TILE_BONUS = 50;

let assertions = 0;
let failures = 0;

function assertEqual(actual, expected, message) {
    assertions++;
    if (actual !== expected) {
        failures++;
        console.error(`Assertion Failed: ${message}. Expected "${expected}", got "${actual}"`);
    } else {
        // console.log(`Assertion Passed: ${message}`); // Keep console cleaner for failures
    }
}

function assertDeepEqual(actual, expected, message) {
    assertions++;
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        failures++;
        console.error(`Assertion Failed: ${message}. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    } else {
        // console.log(`Assertion Passed: ${message}`);
    }
}

function printTestSummary() {
    console.log("\n--- Test Summary ---");
    console.log(`Total Assertions: ${assertions}`);
    console.log(`Passed: ${assertions - failures}`);
    console.log(`Failed: ${failures}`);
    if (failures > 0) {
        console.error("\nTESTS FAILED!");
    } else {
        console.log("\nALL TESTS PASSED!");
    }
    assertions = 0;
    failures = 0;
}

let mockAlertMessages = [];
const originalAlert = window.alert;
window.alert = (message) => {
    mockAlertMessages.push(message);
    // console.log("Mock alert:", message);
};

function clearMockAlerts() {
    mockAlertMessages = [];
}

let mockLocalStorageStore = {};
const mockLocalStorage = {
    getItem: (key) => mockLocalStorageStore[key] || null,
    setItem: (key, value) => {
        mockLocalStorageStore[key] = String(value);
    },
    removeItem: (key) => {
        delete mockLocalStorageStore[key];
    },
    clear: () => {
        mockLocalStorageStore = {};
    }
};

// --- GameState Tests ---
function testGameStateWithCustomSettings() {
    console.log("\n--- Running GameState with Custom Settings Tests ---");
    const customSettings = {
        letterDistribution: { 'A': 1, 'B': 1 },
        tileValues: { 'A': 10, 'B': 20, '_': 0 },
        blankTileCount: 1,
        sevenTileBonus: 100
    };
    const game = new GameState('test-game', 123, customSettings);

    assertDeepEqual(game.settings.letterDistribution, customSettings.letterDistribution, "GameState uses custom letterDistribution");
    assertDeepEqual(game.settings.tileValues, customSettings.tileValues, "GameState uses custom tileValues");
    assertEqual(game.settings.blankTileCount, customSettings.blankTileCount, "GameState uses custom blankTileCount");
    assertEqual(game.settings.sevenTileBonus, customSettings.sevenTileBonus, "GameState uses custom sevenTileBonus");

    assertEqual(game.bag.length, 3, "_initializeBag creates correct total number of tiles");
    const tileA = game.bag.find(t => t.letter === 'A');
    const tileB = game.bag.find(t => t.letter === 'B');
    const blankTile = game.bag.find(t => t.isBlank);
    assertEqual(tileA ? tileA.value : -1, 10, "Tile A has custom value");
    assertEqual(tileB ? tileB.value : -1, 20, "Tile B has custom value");
    assertEqual(blankTile ? blankTile.value : -1, 0, "Blank tile has value 0 (as per custom tileValues)");
    assertEqual(game.bag.filter(t => t.isBlank).length, 1, "Correct number of blank tiles in bag");

    const mockBoard = new Board(BOARD_SIZE);
    const player = game.players[0];
    player.rack = [];
    const moveA_gs = { tileRef: new Tile('A', 10), to: {row: 7, col: 7} };
    const moveB_gs = { tileRef: new Tile('B', 20), to: {row: 7, col: 8} };
    mockBoard.grid[7][7].tile = moveA_gs.tileRef;
    mockBoard.grid[7][8].tile = moveB_gs.tileRef;
    const wordAB = [ { tile: moveA_gs.tileRef, r: 7, c: 7 }, { tile: moveB_gs.tileRef, r: 7, c: 8 } ];
    const scoreResult1 = calculateWordScore([wordAB], mockBoard, [moveA_gs, moveB_gs], game.settings);
    assertEqual(scoreResult1.score, 30, "calculateWordScore uses custom tileValues (30 points)");

    game.settings.rackSize = 1;
    const moveSingle = { tileRef: new Tile('A', 10), to: {row: 8, col: 8} };
    mockBoard.grid[8][8].tile = moveSingle.tileRef;
    const wordSingle = [{ tile: moveSingle.tileRef, r: 8, c: 8 }];
    const scoreResult2 = calculateWordScore([wordSingle], mockBoard, [moveSingle], game.settings);
    assertEqual(scoreResult2.score, 110, "calculateWordScore uses custom sevenTileBonus (10 + 100)");
    game.settings.rackSize = RACK_SIZE; // Reset
}

// --- URL Handling Tests ---
function testURLHandlingWithCustomSettings() {
    console.log("\n--- Running URL Handling with Custom Settings Tests ---");
    const customSettings = {
        letterDistribution: { 'X': 1 },
        tileValues: { 'X': 50, '_': 0 },
        blankTileCount: 3,
        sevenTileBonus: 75
    };
    const defaultSettingsCopy = JSON.parse(JSON.stringify({ // Deep copy for safety
        letterDistribution: TEST_DEFAULT_LETTER_DISTRIBUTION,
        tileValues: TEST_DEFAULT_TILE_VALUES,
        blankTileCount: TEST_DEFAULT_BLANK_COUNT,
        sevenTileBonus: TEST_DEFAULT_SEVEN_TILE_BONUS
    }));

    const gameWithCustom = new GameState('gid-custom', 1, customSettings);
    const gameWithDefault = new GameState('gid-default', 2, defaultSettingsCopy);

    const originalLocalPlayerId = window.localPlayerId;
    window.localPlayerId = 'player1';

    const urlCustom = generateTurnURL(gameWithCustom.gameId, 1, null, gameWithCustom.randomSeed, gameWithCustom.settings);
    const paramsCustom = new URLSearchParams(urlCustom.split('?')[1]);
    assertDeepEqual(JSON.parse(paramsCustom.get('td')), customSettings.letterDistribution, "generateTurnURL: td param correct");
    assertDeepEqual(JSON.parse(paramsCustom.get('tv')), customSettings.tileValues, "generateTurnURL: tv param correct");
    assertEqual(parseInt(paramsCustom.get('bc')), customSettings.blankTileCount, "generateTurnURL: bc param correct");
    assertEqual(parseInt(paramsCustom.get('sb')), customSettings.sevenTileBonus, "generateTurnURL: sb param correct");

    const urlDefault = generateTurnURL(gameWithDefault.gameId, 1, null, gameWithDefault.randomSeed, gameWithDefault.settings);
    const paramsDefault = new URLSearchParams(urlDefault.split('?')[1]);
    assertEqual(paramsDefault.has('td'), false, "generateTurnURL: td param not present for default");
    assertEqual(paramsDefault.has('tv'), false, "generateTurnURL: tv param not present for default");
    assertEqual(paramsDefault.has('bc'), false, "generateTurnURL: bc param not present for default");
    assertEqual(paramsDefault.has('sb'), false, "generateTurnURL: sb param not present for default");

    const urlForP2 = `?gid=newgame&seed=123&tn=1&td=${encodeURIComponent(JSON.stringify(customSettings.letterDistribution))}&tv=${encodeURIComponent(JSON.stringify(customSettings.tileValues))}&bc=${customSettings.blankTileCount}&sb=${customSettings.sevenTileBonus}`;
    window.currentGame = null;
    mockLocalStorage.removeItem(LOCAL_STORAGE_KEY_PREFIX + 'newgame');
    loadGameFromURLOrStorage(urlForP2.substring(1));

    assertDeepEqual(window.currentGame.settings.letterDistribution, customSettings.letterDistribution, "loadGameFromURL: parsed td correct");
    assertDeepEqual(window.currentGame.settings.tileValues, customSettings.tileValues, "loadGameFromURL: parsed tv correct");
    assertEqual(window.currentGame.settings.blankTileCount, customSettings.blankTileCount, "loadGameFromURL: parsed bc correct");
    assertEqual(window.currentGame.settings.sevenTileBonus, customSettings.sevenTileBonus, "loadGameFromURL: parsed sb correct");
    assertEqual(window.localPlayerId, 'player2', "loadGameFromURL: localPlayerId set to player2 for new game from URL");

    window.localPlayerId = originalLocalPlayerId;
    window.currentGame = null;
}

// --- startGameWithSettings Tests ---
function testStartGameWithSettingsModal() {
    console.log("\n--- Running startGameWithSettings (Modal Input) Tests ---");
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = `
        <div id="new-game-modal" style="display: block;"> <!-- Ensure modal is 'visible' for hideNewGameModal -->
            <input type="radio" name="dictionaryType" value="permissive" checked>
            <input type="text" id="custom-dictionary-url">
            <textarea id="custom-tile-distribution"></textarea>
            <textarea id="custom-tile-values"></textarea>
            <input type="number" id="custom-blank-tile-count">
            <input type="number" id="custom-seven-tile-bonus">
        </div>`;
    document.body.appendChild(modalContainer);

    const distInput = document.getElementById('custom-tile-distribution');
    const valInput = document.getElementById('custom-tile-values');
    const blankInput = document.getElementById('custom-blank-tile-count');
    const bonusInput = document.getElementById('custom-seven-tile-bonus');

    clearMockAlerts();
    window.currentGame = null;

    const customDist = { Z: 100 };
    const customVals = { Z: 99, '_': 0 };
    distInput.value = JSON.stringify(customDist);
    valInput.value = JSON.stringify(customVals);
    blankInput.value = "5";
    bonusInput.value = "150";
    startGameWithSettings();
    assertDeepEqual(currentGame.settings.letterDistribution, customDist, "startGameWithSettings: Custom distribution applied");
    assertDeepEqual(currentGame.settings.tileValues, customVals, "startGameWithSettings: Custom values applied");
    assertEqual(currentGame.settings.blankTileCount, 5, "startGameWithSettings: Custom blank count applied");
    assertEqual(currentGame.settings.sevenTileBonus, 150, "startGameWithSettings: Custom bonus applied");
    assertEqual(mockAlertMessages.length, 0, "startGameWithSettings: No alerts for valid custom input");

    clearMockAlerts(); window.currentGame = null;
    distInput.value = "not json"; valInput.value = ""; blankInput.value = ""; bonusInput.value = "";
    startGameWithSettings();
    assertEqual(window.currentGame, null, "startGameWithSettings: Game not started with invalid JSON");
    assertEqual(mockAlertMessages.length > 0 && mockAlertMessages[0].includes("Error parsing Tile Distribution JSON"), true, "startGameWithSettings: Alert for invalid distribution JSON");

    clearMockAlerts(); window.currentGame = null;
    distInput.value = ""; blankInput.value = "-5";
    startGameWithSettings();
    assertEqual(window.currentGame, null, "startGameWithSettings: Game not started with invalid blank count");
    assertEqual(mockAlertMessages.length > 0 && mockAlertMessages[0].includes("Invalid Blank Tile Count"), true, "startGameWithSettings: Alert for invalid blank count");

    clearMockAlerts(); window.currentGame = null;
    distInput.value = ""; valInput.value = ""; blankInput.value = ""; bonusInput.value = "";
    startGameWithSettings();
    assertDeepEqual(currentGame.settings.letterDistribution, TEST_DEFAULT_LETTER_DISTRIBUTION, "startGameWithSettings: Default distribution for empty input");
    assertDeepEqual(currentGame.settings.tileValues, TEST_DEFAULT_TILE_VALUES, "startGameWithSettings: Default values for empty input");
    assertEqual(currentGame.settings.blankTileCount, TEST_DEFAULT_BLANK_COUNT, "startGameWithSettings: Default blank count for empty input");
    assertEqual(currentGame.settings.sevenTileBonus, TEST_DEFAULT_SEVEN_TILE_BONUS, "startGameWithSettings: Default bonus for empty input");
    assertEqual(mockAlertMessages.length, 0, "startGameWithSettings: No alerts for empty inputs (defaults)");

    document.body.removeChild(modalContainer);
    window.currentGame = null;
}

// --- LocalStorage Tests ---
function testLocalStorageWithCustomSettings() {
    console.log("\n--- Running LocalStorage with Custom Settings Tests ---");
    const customSettings = {
        letterDistribution: { Y: 5 },
        tileValues: { Y: 25, '_': 0 },
        blankTileCount: 1,
        sevenTileBonus: 25
    };
    const gameId = "test-ls-game";

    const originalLocalStorageGlobal = window.localStorage; // Backup global window.localStorage
    window.localStorage = mockLocalStorage; // Override global window.localStorage with mock for this test
    mockLocalStorage.clear();

    let gameToSave = new GameState(gameId, 123, customSettings);
    const originalLocalPlayerId = window.localPlayerId;
    window.localPlayerId = 'player1-ls-test';

    // Pass mockLocalStorage to the functions if they accept it as an argument,
    // otherwise they will use the (now mocked) global window.localStorage
    saveGameStateToLocalStorage(gameToSave); // Uses global (mocked) localStorage

    const savedDataString = mockLocalStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + gameId);
    assertEqual(savedDataString !== null, true, "LocalStorage: Game data was saved");

    const savedData = JSON.parse(savedDataString);
    assertDeepEqual(savedData.settings.letterDistribution, customSettings.letterDistribution, "LocalStorage: Saved data contains custom distribution");
    assertDeepEqual(savedData.settings.tileValues, customSettings.tileValues, "LocalStorage: Saved data contains custom values");
    assertEqual(savedData.settings.blankTileCount, customSettings.blankTileCount, "LocalStorage: Saved data contains custom blank count");
    assertEqual(savedData.settings.sevenTileBonus, customSettings.sevenTileBonus, "LocalStorage: Saved data contains custom bonus");

    let loadedGame = loadGameStateFromLocalStorage(gameId); // Uses global (mocked) localStorage

    assertDeepEqual(loadedGame.settings.letterDistribution, customSettings.letterDistribution, "LocalStorage: Loaded game has custom distribution");
    assertDeepEqual(loadedGame.settings.tileValues, customSettings.tileValues, "LocalStorage: Loaded game has custom values");
    assertEqual(loadedGame.settings.blankTileCount, customSettings.blankTileCount, "LocalStorage: Loaded game has custom blank count");
    assertEqual(loadedGame.settings.sevenTileBonus, customSettings.sevenTileBonus, "LocalStorage: Loaded game has custom bonus");
    assertEqual(window.localPlayerId, savedData.savedLocalPlayerId, "LocalStorage: localPlayerId restored");

    mockLocalStorage.clear();
    window.localStorage = originalLocalStorageGlobal; // Restore original global localStorage
    window.localPlayerId = originalLocalPlayerId;
}

function runAllTests() {
    // Test suite setup
    const originalGame = window.currentGame;
    const originalLocalPlayerId = window.localPlayerId;
    const originalAlertFunc = window.alert;
    const originalLocalStorageRef = window.localStorage;

    // Run tests
    testGameStateWithCustomSettings();
    testURLHandlingWithCustomSettings();
    testStartGameWithSettingsModal();
    testLocalStorageWithCustomSettings();

    printTestSummary();

    // Test suite teardown
    window.currentGame = originalGame;
    window.localPlayerId = originalLocalPlayerId;
    window.alert = originalAlertFunc;
    window.localStorage = originalLocalStorageRef;
    clearMockAlerts(); // Clear any remaining messages
    mockLocalStorage.clear(); // Clear mock storage
}
