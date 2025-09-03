# Turn URL Format V1

Players initiate games and communicate moves by exchanging *Turn URLs.* The URI
standard [defines](https://datatracker.ietf.org/doc/html/rfc3986#section-3.5) an
optional "fragment identifier" following a hash (`#`) character. A Turn URL
contains game or turn data in the fragment. The data has the form of name-value
pairs such as typically seen in `?`-query strings. Example:

    https://jtobey.github.io/sw/#gid=123&v=1&bag=en&seed=12345

In this example, the fragment identifier is `gid=123&v=1&bag=en&seed=12345`.

[`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)
and its `toString()` method define a serialization of an ordered sequence of
string pairs (called *params*). The serialization involves:

*   percent-encoding (example: `%C3%91` for `Ñ`)
*   `&` to separate pairs
*   `=` to separate the elements of a pair

The ordered sequence corresponding to the above example
is `[["gid", "123"], ["v", "1"], ["bag", "en"], ["seed", "12345"]]`. This
document defines the allowed params and their meanings in a game context.

## Game histories and deltas

The Turn URL format supports both full game histories and deltas (sequencies of
moves within a game). Game histories typically include settings such as
choice of dictionary, initial random seed, and player names, which deltas
typically omit, but not always. When a game uses a default setting, the history
URL may omit it. And a delta-style Turn URL that includes a game setting acts
as a request to change the setting in the middle of a game.

The feature that distinguishes *Game URLs* (full histories) from deltas is the
Turn Number (`tn`) param. Game URLs contain `tn=1`. Other Turn URLs contain a
higher Turn Number.

## Common params

### Game ID `gid`

All Turn URLs MUST begin with a Game ID (`gid`) param. Subsequent `gid` params
are not allowed. The value of `gid` is chosen by the game initiator (Player 1)
and repeated in all of the game's Turn URLs. Its value SHOULD be chosen so as
to be unlikely to collide with other Game IDs. Apart from that, it SHOULD be
short and avoid characters that are typically percent-encoded.

### Turn Number `tn`

All Turn URLs MUST contain a single Turn Number (`tn`) param whose value is a
decimal positive integer. Game Params MUST precede `tn`, while Turn Params MUST
follow it.

## Game Params

### Protocol Version `v`

This is Version 1 of the Turn URL format. Game URLs that adhere to it SHOULD
include `v=1`.

### Player ID `pid`

...

### Random Seed `seed`

...

### Language `l`

...

### Dictionary Type `dt`

* `permissive`
* `consensus`
* `swdict`

...

### Dictionary Settings `ds`

...

### Board Layout `board`

...

### Initial Bag Contents `bag`

...

### Rack Size `racksize`

...

### Bingo Bonus `bingo`

...

## Turn Params

These params MUST NOT appear before Turn Number (`tn`). They represent a
sequence of player moves. Each move begins with Word Location (`wl`) or
Exchange (`ex`), and every occurrence of one of those params begins a new move.
Each move is associated with a number, beginning with with the Turn Number and
incrementing with each move.

### Word Location `wl`

...

### Blank Tiles `bt`

...

### Word Horizontal `wh`

...

### Word Vertical `wv`

...

### Exchange `ex`

...
