import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignActFromLog } from '../src/lib/client-log.ts';

test('detects all ten campaign acts from generated area IDs', () => {
  for (let act = 1; act <= 10; act++) {
    const part = act <= 5 ? 1 : 2;
    assert.equal(campaignActFromLog(`2026/10/27 [INFO Client 123] Generating level 40 area "${part}_${act}_1" with seed 123\r`), act);
    assert.equal(campaignActFromLog(`Generating level 40 area "${part}_${act}_town" with seed 123`), act);
  }
});

test('ignores non-campaign areas and unrelated or incomplete entries', () => {
  for (const line of [
    'Generating level 83 area "MapWorldsBeach" with seed 123',
    'Generating level 60 area "Labyrinth_Airlock" with seed 123',
    'Generating level 60 area "Hideout" with seed 123',
    'Generating level 60 area "1_6_1" with seed 123',
    'Generating level 60 area "2_1_1" with seed 123',
    'Generating level 60 area "2_11_1" with seed 123',
    'Generating level 60 area "2_10_',
    ': You have entered The Coast.',
    '',
  ]) assert.equal(campaignActFromLog(line), null);
});
