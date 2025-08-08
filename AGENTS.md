# Tests

    bun install
    bun tsc
    bun test

Consider running these tests *before* your change. If any fail and seem unrelated to the change, we may ignore those failures.

# Submitting code

Prefer to submit fixes on the feature branch that you created, since multiple levels of branches produce extra cleanup work.

# Repository layout

Browser users test the app using `bun index.html`. app.ts is the main TypeScript entry point.

# Overview

`index.html` implements a multi-player, Scrabble-like game. During play, the game does not require communication with the origin server. Players exchange moves by external chat or other means. The logic in game_state.ts generates and expects these moves in the form of `URLSearchParams`. Much engineering goes into keeping the URLs short for pasting and copying in messaging apps. The URLs contain only deltas, not the whole game state or history. We store game states in localStorage to prevent data loss when the page reloads.

The game has no strong security against inspecting the tile bag and other players' racks. The game relies on the honor system and helps players avoid seeing this information (for example, by representing exchanged tiles by position rather than by letter). However, the game is designed with an abstraction (tiles_state.ts) to support secure state management through an external service, which may or may not be the origin server. The design for extensibility in security explains why some functions return `Promise`s.

A dictionary service for word validation can be configured during game setup. By default, the game does no validation, and the players should agree on what is a word. This "permissive" mode is convenient for testing.

README.md lists features.
