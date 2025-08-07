import type { Tile, TilePlacement, TilePlacementRow, BoardPlacement } from './tile.js'

export interface BagEventDetail {
  playerId: string
  tile: Tile
}

export class BagEvent extends CustomEvent<BagEventDetail> {}

export interface TileEventDetail {
  // Tile identity and new location.
  placement: TilePlacement
  // Old location.
  fromRow?: TilePlacementRow
  fromCol?: number
}

export class TileEvent extends CustomEvent<TileEventDetail> {}

export class GameEvent extends CustomEvent<{}> {}

export interface BoardEventDetail {
  placement: BoardPlacement
}

export class BoardEvent extends CustomEvent<BoardEventDetail> {}
