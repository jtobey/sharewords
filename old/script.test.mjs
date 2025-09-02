/*
Copyright 2025 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import { test, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import { initializeGameAndEventListeners } from './script.mjs';

describe('Game Initialization', () => {
    beforeEach(() => {
        // Reset the DOM and localStorage before each test
        document.body.innerHTML = '<div id="board-container"></div><div id="local-player-rack"></div><div id="header-player1-name"></div><div id="header-player1-score"></div><div id="header-player2-name"></div><div id="header-player2-score"></div><div id="turn-player"></div><div id="tiles-in-bag"></div><div id="post-move-modal"></div><div id="modal-points-earned"></div><div id="modal-copy-url-checkbox"></div><input id="turn-url" /><button id="play-word-btn"></button><button id="exchange-tiles-btn"></button><button id="pass-turn-btn"></button><button id="recall-tiles-btn"></button><button id="confirm-exchange-btn"></button><button id="cancel-exchange-btn"></button><button id="new-game-btn"></button><button id="start-game-btn"></button><div id="custom-settings-section"></div><input name="dictionaryType" value="permissive" checked type="radio" /><input id="custom-dictionary-url" /><input id="custom-tile-distribution" /><input id="custom-tile-values" /><input id="custom-blank-tile-count" /><input id="custom-seven-tile-bonus" /><textarea id="custom-board-layout"></textarea><input id="player1-name-input" /><input id="player2-name-input" /><button id="copy-url-btn"></button><button id="modal-close-btn"></button>';
        localStorage.clear();
    });

    it('should initialize a new game on first load', () => {
        initializeGameAndEventListeners();
        const boardContainer = document.getElementById('board-container');
        assert(boardContainer.innerHTML.includes('square'), 'Board should be rendered');

        const localPlayerRack = document.getElementById('local-player-rack');
        assert.strictEqual(localPlayerRack.children.length, 7, 'Player rack should have 7 tiles');

        const player1Name = document.getElementById('header-player1-name');
        assert.strictEqual(player1Name.textContent, 'Player 1', 'Player 1 name should be set');

        const tilesInBag = document.getElementById('tiles-in-bag');
        assert.strictEqual(parseInt(tilesInBag.textContent, 10), 100 - 7 - 7, 'Tiles in bag should be correct');
    });
});
