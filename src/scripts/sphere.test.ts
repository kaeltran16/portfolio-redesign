import { afterEach, describe, expect, it, vi } from 'vitest';
import { startSphere } from './sphere';

describe('startSphere', () => {
  afterEach(() => vi.restoreAllMocks());

  it('throws webgl unavailable before three logs anything', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() => startSphere(canvas, 'dark', true)).toThrowError(new Error('webgl unavailable'));
    expect(error).not.toHaveBeenCalled();
  });
});
