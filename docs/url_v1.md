# Turn URL Format V1

STATUS: DRAFT

Players initiate games and communicate moves by exchanging *Turn URLs.* The URI
standard [defines](https://datatracker.ietf.org/doc/html/rfc3986#section-3.5) an
optional "fragment identifier" following a hash (`#`) character. A Turn URL
contains game or turn data in the fragment. The data has the form of name-value
pairs such as typically seen in `?`-query strings. Example:

    https://jtobey.github.io/sw/#gid=123&v=1&bag=en&seed=12345&tn=1

In this example, the fragment identifier is `gid=123&v=1&bag=en&seed=12345#tn=1`.

[`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)
and its `toString()` method define a serialization of an ordered sequence of
string pairs (called *params*). The serialization involves:

*   percent-encoding (example: `%C3%91` for `Ñ`)
*   `&` to separate pairs
*   `=` to separate the elements (*key* and *value*) within a pair

The ordered sequence corresponding to the above example
is `[["gid", "123"], ["v", "1"], ["bag", "en"], ["seed", "12345"]]`. This
document defines the allowed params and their meanings in a game context.

## Game histories and deltas

The Turn URL format supports both full game histories and deltas (sequencies of
moves within a game). Game histories typically include settings such as
choice of dictionary, initial random seed, and player names, which deltas
typically omit, but not always. When a game uses a default setting, the history
URL may omit it. And a delta-style Turn URL that includes a game setting acts
as a request to change the setting in the midst of a game, if possible.

The feature that distinguishes *Game URLs* (full histories) from deltas is the
Turn Number (`tn`) param. Game URLs contain `tn=1`. Other Turn URLs contain a
higher Turn Number.

## Param types

We define *Game Params* as params that affect game settings. Game Params
typically appear only in Game URLs and seldom or never change during a game.
The other kind, *Turn Params,* reflect moves by players: Passes, Exchanges, and
Words Played.

## Common params

These params appear before any turn data in Turn URLs, including Game URLs.

### Game ID (`gid`)

All Turn URLs MUST begin with a Game ID (`gid`) param. Subsequent `gid` params
are not allowed. The value of `gid` is chosen by the game initiator (Player 1)
and repeated in all of the game's Turn URLs. Its value SHOULD be chosen so as
to be unlikely to collide with other Game IDs. Apart from that, it SHOULD be
short and avoid characters that are typically percent-encoded.

### Turn Number (`tn`)

The value of Turn Number MUST be a decimal positive integer. All generated Turn
URLs MUST contain a single Turn Number (`tn`) param. A recieved Turn URL that
contains only Game Params other than Turn Number MUST be interpreted as having
`tn=1`. Game Params MAY precede `tn`, but Turn Params MUST follow it.

## Game Params

### Protocol Version (`v`)

This is Version 1 of the Turn URL format. Game URLs that adhere to it SHOULD
include `v=1`.

### Player Names (`p1n`, `p2n`, etc.)

The game supports any number of players, subject to limits resulting from bag
and rack size. Players are identified by an ID, which is their position in the
order of play: `1`, `2`, etc. The game associates a name with each player. By
default, there are two players named `Player 1` and `Player 2`. To change
either the number or the names of the players, we support Player Name params of
the form `p{ID}n`, where `{ID}` is a Player ID.

If a Game URL contains any Player Name params before the Turn Number, their IDs
must form an unbroken sequence starting with `1`. They collectively set the
number of players.

A Player Name param's value sets the corresponding player's name. A name may
take any form, subject to implementation-defined limits.

### Player ID (`pid`)

The Player ID param is unique in that it takes a different value for each
player. By default, when a player receives a Game URL containing a new Game ID,
the player derives their ID from the number of turns played. The first turn
belongs to Player 1, the second to Player 2, and so on. You might have to set
Player ID when transferring a game state into a new browser context or when
starting a game with three or more players.

### Random Seed (`seed`)

...

### Dictionary Type (`dt`)

One of:

#### `permissive`

Any string is accepted as a word. Players see their replacement tiles
immediately.

#### `consensus`

Any string is a word if all players accept it. On a player's turn, the player
has received all previous turns' attempted Words Played. The player may signal
acceptance of their opponents' moves simply by making a move and distributing
the resulting Turn URL. Or the player may dispute a word, possibly resulting in
a rollback of the shared game state.

With the `consensus` Dictionary Type, a player sees their replacement tiles
only after all other players have accepted their last move.

#### `online`

Words Played are automatically validated in a manner defined by the Dictionary
Settings param. Players see their replacement tiles immediately after
successful validation.

### Dictionary Settings (`ds`)

A URL or other identifier of a word list in SWDICT format.

### Board Layout (`board`)

...

### Initial Bag Contents (`bag`)

...

### Rack Size (`racksize`)

A decimal number defining the maximum number of tiles held by a player at any
point in the game. By default, 7.

### Bingo Bonus (`bingo`)

A decimal number defining the bonus added to a player's score when the player
forms a word using all tiles from a full rack. By default, 42.

## Turn Params

These params MUST NOT appear before Turn Number (`tn`). They represent a
sequence of player moves. Each move begins with Word Location (`wl`) or
Exchange (`ex`), and every occurrence of one of those params begins a new move.
Each move is associated with a number, beginning with with the Turn Number and
incrementing with each move.

### Word Location (`wl`)

Two decimal numbers separated by a period (`.`). The numbers define the board
row and column, respectively, of the first letter in a Word Played. Even if the
first letter was on the board at the start of the turn, its location is the one
used in the Word Location param.

### Blank Tiles (`bt`)

The Blank Tiles param indicates which positions in a Word Played hold newly
placed blank tiles. Positions are zero-based, and the param uses period (`.`)
to separate them. If no blank tiles are played, the Blank Tiles param MUST be
omitted. It is an error to specify a position out of bounds or the position of
a tile placed on a previous turn.

### Word Horizontal (`wh`)

The letters in a horizontal Word Played, including those from previously placed
and newly placed tiles. If any tile has more than one letter, then the Word
Horizontal param MUST include period (`.`) characters separating the tile
contents. For example, if the tile contents are `E`, `Qu`, `A`, and `L`, the
param must be `wh=E.Qu.A.L`. If, on the other hand, `Q` and `U` are separate
tiles, the param SHOULD be simply `wh=EQUAL`.

### Word Vertical (`wv`)

The letters in a vertical Word Played. The same rules apply as in Word
Horizontal.

### Exchange (`ex`)

The rack posistions of tiles returned to the bag in an Exchange, or empty in
the case of a Pass. The positions are zero-based decimal numbers separated by
period (`.`) characters.
