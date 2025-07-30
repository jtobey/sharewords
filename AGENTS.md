# Tests

Install Bun (https://bun.sh/) and TypeScript and run:

    bun tsc
    bun test

# Overview

`bun index.html` serves ShareWords, a Scrabble-like game. We are working first on the game logic and unit tests. As of this writing, we have only a very minimal DOM-based UI. app.js installs handlers and illustrates usage of the game logic. That interface is in flux.

Apart from loading static HTML, JavaScript, and (someday) CSS, the game has no communication with the origin server. Players exchange moves by external chat or other means. ShareWords has no strong security against inspecting the tile bag and other players' racks. The game relies on the honor system and helps players avoid seeing this information. However, the game is designed with hooks to support secure state management through an external service, which may or may not be the origin server.

This kind of game usually requires a dictionary, but ShareWords relies on players to agree on what is a word. We plan to add dictionary support by a configuable URL template.

The design for extensibility in security and dictionary explains why some functions return Promises.
