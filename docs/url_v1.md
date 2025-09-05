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

The Turn URL format supports both full game histories and deltas (sequences of
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

These params appear in all Turn URLs (Game URLs and deltas) before any turn
data.

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
`tn=1`. Game Params MAY precede `tn`, but Turn Params MUST NOT precede it.

## Game Params

### Protocol Version (`v`)

This is Version 1 of the Turn URL format. Game URLs that adhere to it SHOULD
include `v=1`.

### Player Names (`p1n`, `p2n`, etc.)

The game supports any number of players, subject to limits resulting from bag
and rack size. Players are identified by an ID, which is their position in the
order of play: `1`, `2`, etc. The game associates a name with each player. By
default, there are two players named `Player 1` and `Player 2`. To specify
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

When using Honor System tile management (the only supported kind as of this
writing), the Game URL MUST contain a Random Seed param to control how tiles
are shuffled. Honor System works without a game server and relies on players'
browsers to remember who holds which tiles. (It is therefore not hard to
discover your opponents' tiles, hence the name *Honor System.*) The seed lets
the players' browsers agree on the tiles' state. The seed MAY be any string and
SHOULD be unlikely to have been used previously.

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
a rollback of the shared game state. (This document does not specify a means of
disputing a word or rolling back state.)

With the `consensus` Dictionary Type, a player sees their replacement tiles
only after all other players have accepted the player's last move.

#### `wordlist`

Words Played are automatically validated in a manner defined by the Dictionary
Settings param. Players see their replacement tiles immediately after
successful validation.

### Dictionary Settings (`ds`)

A URL or other identifier of a word list in SWDICT format. See `dict/dictc.ts`
for how to create SWDICT files.

### Board Layout (`board`)

The Board Layout param defines the board dimensions and the locations of bonus
squares. The param consists of a sequence of *row strings* separated by hyphen
(`-`) characters. Each row string consists of a sequence of 1-character *bonus
codes* with the following interpretation:

*  period (`.`) for ordinary squares without a bonus type
*  lowercase `d` for double-letter-score squares
*  lowercase `t` for triple-letter-score squares
*  uppercase `D` for double-word-score squares
*  uppercase `T` for triple-word-score squares

For example, `board=T.d.d.T-.D.t.D.-d.t.t.d-.t...t.-d.t.t.d-.D.t.D.-T.d.d.T`
defines a 7x7-square board with triple-word bonus squares at the corners,
double-letter bonuses along the edges at intervals of two squares, double-word
bonuses at the corners of the interior 5x5 square, and triple-letter bonuses in
a diamond pattern around the center:

    T . d . d . T
    . D . t . D .
    d . t . t . d
    . t . . . t .
    d . t . t . d
    . D . t . D .
    T . d . d . T

The file `game/settings.ts` defines the default board layout.

### Initial Bag Contents (`bag`)

The Initial Bag Contents param defines the letters and point values on all
tiles used in the game. If using a word list with a known language, the default
bag contents come from `game/bag_defaults.ts`. Otherwise, the Initial Bag
Contents param is required.

The Initial Bag Contents param is parsed by first splitting on period (`.`)
characters. Each segment is applied to an initially empty bag as follows.

1.  If the segment begins with an ASCII lowercase letter, the segment MUST be
    a supported language identifier (currently `en` or `es`). The segment is
    treated as a sequence of segments expressing the language's default
    settings as follows:

    *   `en` (English) expands to `A-7-1.B-2-4.C-4-4.D-3-2.E-12-1.F-1-4` +
        `.G-3-3.H-2-4.I-8-1.J-1-9.K-1-5.L-5-2.M-3-3.N-6-1.O-6-1.P-2-3.Q-1-10` +
        `.R-7-1.S-9-1.T-6-1.U-4-2.V-1-5.W-1-4.X-1-8.Y-1-4.Z-1-8.-2-0`

    *   `es` (Spanish) expands to `A-12-1.B-2-3.C-5-2.D-3-2.E-11-1.F-1-4` +
        `.G-2-4.H-1-4.I-7-1.J-1-5.K-1-9.L-4-2.M-3-2.N-6-1.Ñ-1-10.O-8-1.P-3-3` +
        `.Qu-1-6.R-8-1.S-6-1.T-5-1.U-3-2.V-1-4.X-1-8.Y-1-5.Z-1-5.-2-0`

    Other language identifiers are not supported in this version.

    A language specified in this way MUST NOT have been previously specified in
    the same Initial Bag Contents param value.

2.  Otherwise, the segment defines a letter to be added to the bag, along with
    the letter's count and point value, or to be removed from the bag. "Letter"
    in this context means a sequence of zero, one, or multiple characters. An
    empty "letter" represents a blank tile, which when played may be assigned
    any non-empty letter in the bag defined by the Initial Bag Contents param.

    *   If the segment ends in hyphen (`-`), followed by a sequence of ASCII
        digits, followed by another hyphen and more ASCII digits, the part
        before the first of these hyphens is parsed as the letter. The digit
        sequences are parsed as the letter's count and value, respectively.

    *   If the segment ends in two hyphens (`--`) followed by a sequence of
        ASCII digits, the part before the hyphens is parsed as the letter. The
        digit sequence is parsed as the letter's value. The letter's count
        remains unchanged if present in the bag. If the letter was not
        previously in the bag, its count defaults to 1.

    *   Otherwise, if the segment ends in one hyphen (`-`) followed by ASCII
        digits, the part preceding the hyphen is parsed as the letter. The
        digit sequence is parsed as the letter's count. The letter's value
        remains unchanged if present in the bag. If the letter was not
        previously in the bag, its value defaults to 1.

    *   If the segment ends in a hyphen (`-`), the part preceding the hyphen is
        parsed as the letter. The letter is removed from the bag.

    *   Otherwise, the entire segment is treated as a letter. The letter
        MUST NOT be in the bag. The letter is added to the bag with count 1 and
        value 1.

    A segment of this form MUST NOT refer to a letter directly referred to by
    an earlier segment in the same Initial Bag Contents param value. A segment
    MAY refer to a letter that was added through language identifier expansion.

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
