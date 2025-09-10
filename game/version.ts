/**
 * @file Game/turn URL semantics versions.
 */
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

export type ProtocolVersion = string & { __brand: "ProtocolVersion" };
const toProtocolVersion = (v: string) => v as ProtocolVersion;
export const fromProtocolVersion = (v: ProtocolVersion) => v as string;

const _PROTOCOL_VERSIONS: { [key: string]: ProtocolVersion } =
  Object.create(null);
const v = (vStr: string) =>
  (_PROTOCOL_VERSIONS[vStr] = toProtocolVersion(vStr));

export const PROTOCOL_VERSIONS: Readonly<typeof _PROTOCOL_VERSIONS> =
  _PROTOCOL_VERSIONS;
export const PROTOCOL_VERSION_0 = v("0");
export const PROTOCOL_VERSION_1 = v("1");

export const PROTOCOL_VERSION = PROTOCOL_VERSION_1;
