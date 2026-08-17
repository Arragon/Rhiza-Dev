import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const checker = require('license-checker-rseidelsohn');
const outputPath = resolve('reports/third-party-licenses.json');

function scan() {
  return new Promise((resolveScan, reject) => {
    checker.init({ start: process.cwd(), production: true }, (error, packages) => {
      if (error) reject(error);
      else resolveScan(packages);
    });
  });
}

const raw = await scan();
const packages = Object.fromEntries(Object.entries(raw)
  .filter(([name]) => !name.startsWith('rhiza-mvp@'))
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([name, metadata]) => [name, {
    licenses: metadata.licenses || 'UNKNOWN',
    repository: metadata.repository || null,
    publisher: metadata.publisher || null,
    copyright: metadata.copyright || null,
  }]));
const report = `${JSON.stringify({ generatedBy: 'license-checker-rseidelsohn', dependencyScope: 'production', packages }, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const existing = await readFile(outputPath, 'utf8').catch(() => '');
  if (existing !== report) {
    console.error('License report is missing or stale. Run npm run licenses:generate.');
    process.exitCode = 1;
  } else {
    console.info(`License report verified (${Object.keys(packages).length} production packages).`);
  }
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, report, 'utf8');
  console.info(`Wrote ${outputPath} (${Object.keys(packages).length} production packages).`);
}
