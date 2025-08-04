import type { TilePlacement, TilePlacementRow } from './tile.js'

export interface TileEventDetail {
  // Tile identity and new location.
  placement: TilePlacement
  // Old location.
  fromRow?: TilePlacementRow
  fromCol?: number
}

export class TileEvent extends CustomEvent<TileEventDetail> {}

export class GameEvent extends CustomEvent<{}> {}
