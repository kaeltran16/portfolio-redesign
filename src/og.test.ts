import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IHDR_WIDTH_OFFSET = 16;
const IHDR_HEIGHT_OFFSET = 20;

describe('share image', () => {
  it('public/og.png is a 1200x630 png', () => {
    const png = readFileSync(new URL('../public/og.png', import.meta.url));
    expect(png.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
    expect(png.readUInt32BE(IHDR_WIDTH_OFFSET)).toBe(1200);
    expect(png.readUInt32BE(IHDR_HEIGHT_OFFSET)).toBe(630);
  });
});
