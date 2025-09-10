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
import { test, expect } from "bun:test";

test('running "bun tsc"', async () => {
  const process = Bun.spawn(["bun", "run", "tsc"]);
  const exitCode = await process.exited;
  const stdout = await new Response(process.stdout).text();
  const stderr = await new Response(process.stderr).text();
  expect(
    exitCode,
    `tsc failed with stdout:\n${stdout}\n\nstderr:\n${stderr}`,
  ).toBe(0);
}, 15000);
