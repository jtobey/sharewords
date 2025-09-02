/*
Copyright 2025 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
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
