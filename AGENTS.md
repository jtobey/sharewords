# Tests

    bun install
    bun tsc
    bun test

# Submitting code

Prefer to submit fixes on the feature branch that you created, since multiple levels of branches produce extra cleanup work.

# Repository layout

We test the app using `bun index.html`. app.ts is the main TypeScript entry point.

# Overview

`bun index.html` serves ShareWords, a Scrabble-like game. We are working first on the game logic and unit tests. Once that settles down, we plan to add a drag-and-drop HTML interface. As of this writing, we have only a very incomplete DOM-based UI (index.html, style.css, app.js).

Apart from loading static HTML, JavaScript, and CSS, the game has no communication with the origin server. Players exchange moves by external chat or other means. The logic in game_state.ts generates and expects these moves in the form of `URLSearchParams`. Much design work goes into keeping the URLs short for pasting and copying in messaging apps. The URLs will contain only deltas, not the whole game state or history. We store game states in localStorage to prevent data loss when the page reloads.

ShareWords has no strong security against inspecting the tile bag and other players' racks. The game relies on the honor system and helps players avoid seeing this information (for example, by passing tiles to exchange by reference). However, the game is designed with an abstraction (tiles_state.ts) to support secure state management through an external service, which may or may not be the origin server.

This kind of game usually requires a dictionary, but ShareWords relies on players to agree upon what is a word. We plan to add dictionary support by a configuable URL template.

The design for extensibility in security and dictionary explains why some functions return `Promise`s.

README.md lists current and planned features.
