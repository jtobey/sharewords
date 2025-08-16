import { test, expect } from 'bun:test';

test('running "bun tsc"', async () => {
  const process = Bun.spawn(['bun', 'run', 'tsc']);
  const exitCode = await process.exited;
  const stdout = await new Response(process.stdout).text();
  const stderr = await new Response(process.stderr).text();
  expect(exitCode, `tsc failed with stdout:\n${stdout}\n\nstderr:\n${stderr}`).toBe(0);
}, 15000);
