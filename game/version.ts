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

export type ProtocolVersion = string & { '__brand': 'ProtocolVersion' };
export const toProtocolVersion = (v: string) => v as ProtocolVersion;
export const fromProtocolVersion = (v: ProtocolVersion) => v as string;

export const PROTOCOL_VERSION_0 = toProtocolVersion('0');
export const PROTOCOL_VERSION_1 = toProtocolVersion('1');
export const PROTOCOL_VERSION = PROTOCOL_VERSION_1;
