# Crossword Builder Game

A serverless, web-based, two-player crossword-building game.

## Description

This game is similar to Scrabble™ and Words with Friends™, but with its own unique board layout, letter distributions, and scoring rules. Players take turns forming words on a 15x15 grid using tiles drawn from a bag.

## Features (Planned)

-   15x15 game board with bonus squares (Double/Triple Letter, Double/Triple Word).
-   Standard tile bag (approx. 100 tiles) with letter distributions and point values.
-   Player racks holding up to 7 tiles.
-   Word validation using a configurable dictionary (default permissive, option for RFC 2229 DICT servers).
-   Scoring based on tile values and board bonuses.
-   Special "seven-tile bonus".
-   Blank tiles assignable by players.
-   Player actions: play word, exchange tiles, pass turn.
-   Game state managed in local storage.
-   Turn progression via sharable "turn URLs".
-   Customizable game settings for new games (board layout, letter values, dictionary, etc.).
-   Pseudorandom Number Generator (PRNG) for consistent shuffling based on a seed.
-   Support for multiple active games.

## How to Play (Eventually)

1.  Start a new game or load an existing game using a turn URL. (DONE)
2.  If starting a new game, configure settings or use defaults.
3.  Players take turns. On your turn:
    *   Drag tiles from your rack to the board to form words. (DONE)
    *   The first word must cover the center square. (DONE)
    *   Subsequent words must connect to existing tiles. (DONE)
    *   All new tiles in a turn must form a single line (horizontal or vertical). (DONE)
    *   All resulting sequences of letters (horizontal and vertical) must be valid words.
    *   Alternatively, exchange tiles with the bag or pass your turn. (DONE)
4.  After your turn, the game will generate a "turn URL". Send this URL to the other player. (DONE)
5.  When you receive a turn URL from the other player, open it in your browser to update your game state. (DONE)
6.  Play continues until the bag is empty and one player plays their last tile.
7.  Final scores are calculated, and a winner is determined.

## Development

This game is implemented purely with HTML, CSS, and JavaScript, designed to run entirely in the browser without a dedicated backend server. Game state is stored in the browser's local storage. The game relies on the honor system to prevent each player from peeking at the bag contents or at their opponent's tiles.
