import { describe, expect, it } from 'vitest';
import { fallbackNotice, resumePlan } from './session';

describe('resumePlan', () => {
  it('starts from the intro when nothing has been shown', () => {
    expect(resumePlan(0, 40)).toEqual({ kind: 'start' });
  });
  it('resumes mid-battle from the beat of the last shown event', () => {
    expect(resumePlan(13, 40)).toEqual({ kind: 'resume', from: 13 });
  });
  it('skips straight to the finished state once every event has been shown (no victory re-run)', () => {
    expect(resumePlan(40, 40)).toEqual({ kind: 'finished' });
  });
});

describe('fallbackNotice', () => {
  it('says 3D is unavailable only when the device lacks WebGL 2', () => {
    expect(fallbackNotice({ chunkLoaded: true, supported: false })).toBe('unsupported');
  });
  it('reports an error when the stage chunk failed to load (e.g. offline)', () => {
    expect(fallbackNotice({ chunkLoaded: false, supported: false })).toBe('error');
  });
});
