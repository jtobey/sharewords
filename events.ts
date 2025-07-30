import type { TilePlacement, BoardPlacement } from './tile.js'

export interface TileEventDetail {
  tilePlacement: TilePlacement
}

export class TileEvent extends CustomEvent<TileEventDetail> {}

export interface BoardEventDetail {
  tilePlacements: Array<BoardPlacement>
}

export class BoardEvent extends CustomEvent<BoardEventDetail> {}

export class GameEvent extends CustomEvent<{}> {}
