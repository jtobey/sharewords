# Tests

To run the full test suite, including a type-check, run:

    bun install
    bun run test

This is the recommended command to run before submitting changes. `bun run test` is a convenient alias for `bun run tsc && bun test`.

For faster iteration, you can run the tests without a type-check. This is useful when you know the types are correct and want to save time. You can run either of the following commands:

    bun run testjs
    bun test

Both commands are equivalent. You can pass arguments to them, for example: `bun test my_test.ts`.

# Submitting code

Prefer to submit fixes on the feature branch that you created, since multiple levels of branches produce extra cleanup work.

# Repository layout

Browser users test the app using `bun index.html`. app.ts is the main TypeScript entry point.

# Overview

`index.html` implements a multi-player, Scrabble-like game. During play, the game does not require communication with the origin server. Players exchange moves by external chat or other means. The logic in game_state.ts generates and expects these moves in the form of `URLSearchParams`. Much engineering goes into keeping the URLs short for pasting and copying in messaging apps. The URLs contain only deltas, not the whole game state or history. We store game states in localStorage to prevent data loss when the page reloads.

The game has no strong security against inspecting the tile bag and other players' racks. The game relies on the honor system and helps players avoid seeing this information (for example, by representing exchanged tiles by position rather than by letter). However, the game is designed with an abstraction (tiles_state.ts) to support secure state management through an external service, which may or may not be the origin server. The design for extensibility in security explains why some functions return `Promise`s.

A dictionary service for word validation can be configured during game setup. By default, the game does no validation, and the players should agree on what is a word. This "permissive" mode is convenient for testing.

README.md lists features.
