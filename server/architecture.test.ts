// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';

describe('M0 architecture guardrails', () => {
  it('pins the LibreChat baseline used at the adapter boundary', () => {
    expect(packageJson.dependencies['librechat-data-provider']).toBe('0.8.509');
  });

  it('keeps the Rhiza product domain independent from LibreChat and Mongo conversations', async () => {
    const domainSource = await readFile(resolve('server/domain.ts'), 'utf8');
    expect(domainSource).not.toMatch(/(?:import|from)[^\n]*(?:librechat|mongoose|mongodb|conversation)/i);
  });
});
