# Crossword Builder Game

A serverless, web-based, multiplayer crossword-building game.

This is not an officially supported Google product. This project is not eligible for the [Google Open Source Software Vulnerability Rewards Program](https://bughunters.google.com/open-source-security).

## Description

This game is similar to Scrabble™ and Words with Friends™, but with its own board layout, letter distributions, and scoring rules. Players take turns forming words on a grid using tiles drawn from a bag. The game relies on the honor system to prevent each player from peeking at the bag contents or at their opponents' tiles.

## Features

-   15x15 game board with bonus squares (Double/Triple Letter, Double/Triple Word).
-   Standard tile bag (approx. 100 tiles) with letter distributions and point values.
-   Player racks holding up to 7 tiles.
-   Word validation using a configurable dictionary (default permissive).
-   Scoring based on tile values and board bonuses.
-   Special seven-tile "bingo bonus".
-   Blank tiles assignable when placed on the board by players.
-   Player actions: play word, exchange tiles, pass turn.
-   Game state managed in local storage.
-   Turn progression via sharable "turn URLs".
-   Customizable game settings for new games (board layout, letter values, dictionary, etc.).
-   Pseudorandom Number Generator (PRNG) for consistent shuffling based on a seed.
-   Support for multiple active games.

## How to Play

1.  Start a new game or load an existing game using a turn URL.
2.  If starting a new game, configure settings using the "⚙️" (Game Setup) button, or use defaults.
3.  Players take turns. On your turn:
    *   Drag tiles from your rack to the board to form words.
        *   If you prefer to exchange tiles and pass your turn, drag tiles to the exchange ("♻") area below the rack.
    *   Alternatively, use the keyboard to select and move a tile.
        *   Tab to navigate among selectable tiles.
        *   Space to select the tile.
        *   Arrow keys to move the selected tile among possible drop locations.
        *   "Up" from the rack is the bottom of the board, regardless of responsive layout.
        *   "Left" from the rack is the right side of the board.
        *   "Down" from the rack is the exchange area.
        *   A second press on Space to drop the tile where you have positioned it.
        *   Alternatively, Escape to drop the tile where it was picked up, undoing any arrow key movement.
        *   Reloading the page likewise returns any selected tile to its pick-up location.
    *   The first word must cover the center square.
    *   Subsequent words must connect to existing tiles.
    *   All new tiles in a turn must form a single line (horizontal or vertical).
    *   All resulting sequences of tiles (horizontal and vertical) must form valid words.
    *   You may move tiles from place to place within the board, your rack, and the exchange area.
    *   The "❌" (Recall Tiles) button returns all your unplayed tiles to your rack.
    *   Click "✅" (Play Word) and confirm to play the tiles that you have placed on the board.
    *   Alternatively, click "♻" (Pass/Exchange) and confirm to pass or exchange the tiles in the exchange area.
4.  After your turn:
    *   The game will generate a "turn URL" containing recent turn data in the #fragment.
    *   Send this URL to the other player or players.
    *   You may continue to move your tiles while you await your next turn.
5.  When you receive a turn URL from another player:
    *   Open the turn URL in your browser to update your game state.
    *   Any tiles that you have placed where another player played a word automatically revert to your rack.
6.  When the bag is empty and one player plays their last tile:
    *   Each player's score is reduced by the total value of their remaining tiles.
    *   The score of the player who played last is increased by the other players' tile values.
    *   The player with the highest score wins.

## Development

This game is implemented purely with HTML, CSS, and TypeScript, designed to run entirely in the browser without a dedicated backend server. Game state and the local player's identity are stored in the browser's local storage.
