import type { TilePlacement, TilePlacementRow, BoardPlacement } from './tile.js'

export interface TileEventDetail {
  // Tile identity and new location.
  placement: TilePlacement
  // Old location.
  fromRow?: TilePlacementRow
  fromCol?: number
}

export class TileEvent extends CustomEvent<TileEventDetail> {}

export interface BoardEventDetail {
  tilePlacements: Array<BoardPlacement>
}

export class BoardEvent extends CustomEvent<BoardEventDetail> {}

export class GameEvent extends CustomEvent<{}> {}
