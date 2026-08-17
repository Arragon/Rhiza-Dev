// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadFeatureFlags } from './feature-flags';

describe('feature flags', () => {
  it('defaults every incomplete M0 seam to disabled', () => {
    expect(loadFeatureFlags({})).toEqual({
      postgresPersistence: false,
      libreChatRuntime: false,
      fileContext: false,
    });
  });

  it('accepts explicit flags and rejects unknown or malformed values', () => {
    expect(loadFeatureFlags({ RHIZA_FEATURE_FLAGS: 'postgresPersistence=true,fileContext=false' })).toMatchObject({
      postgresPersistence: true,
      fileContext: false,
    });
    expect(() => loadFeatureFlags({ RHIZA_FEATURE_FLAGS: 'unknown=true' })).toThrow(/Invalid/);
    expect(() => loadFeatureFlags({ RHIZA_FEATURE_FLAGS: 'fileContext=yes' })).toThrow(/Invalid/);
  });
});
