import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendorRoot = join(frontendRoot, 'vendor', 'organizer');

const packages = [
  ['@tigao/organizer-contract-tests', 'tigao-organizer-contract-tests-0.1.3.tgz', 'ea82085f57bf1acfa7f4c94124132fa8fed833042d809a27e1881b8011e43cfd', 'devDependencies'],
  ['@tigao/organizer-contracts', 'tigao-organizer-contracts-0.1.3.tgz', '13b47ae7d882f1b4104ca00d6c539c8ebd7414c6538b591bc0aec1c2844c2bac', 'dependencies'],
  ['@tigao/organizer-core', 'tigao-organizer-core-0.1.3.tgz', '24c73ece1ad429f05afbee7a4e4a9583d51dd0350fb6566babb66f90e7c1ef5b', 'dependencies'],
  ['@tigao/organizer-react', 'tigao-organizer-react-0.1.3.tgz', 'bf4b69916140be0b1392ae2c1bff6cc132c38e7046947225c7599fd7bc0140f4', 'dependencies']
];

const readTarEntry = (archivePath, entryName) => {
  const tar = gunzipSync(readFileSync(archivePath));
  for (let offset = 0; offset + 512 <= tar.length;) {
    const name = tar.subarray(offset, offset + 100).toString('utf8').replace(/\0.*$/, '');
    const sizeText = tar.subarray(offset + 124, offset + 136).toString('ascii').replace(/\0.*$/, '').trim();
    const size = Number.parseInt(sizeText || '0', 8);
    const dataStart = offset + 512;
    if (name === entryName) return tar.subarray(dataStart, dataStart + size);
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  throw new Error(`Missing ${entryName} in ${archivePath}`);
};

describe('vendored organizer packages', () => {
  test.each(packages)('%s is the pinned v0.1.3 archive with the expected SHA256', (packageName, filename, expectedHash) => {
    const archivePath = join(vendorRoot, filename);
    const archive = readFileSync(archivePath);
    const packageJson = JSON.parse(readTarEntry(archivePath, 'package/package.json').toString('utf8'));

    expect(createHash('sha256').update(archive).digest('hex')).toBe(expectedHash);
    expect(packageJson).toMatchObject({ name: packageName, version: '0.1.3' });
  });

  test('package.json and package-lock.json use only repository-relative archives', () => {
    const packageJson = JSON.parse(readFileSync(join(frontendRoot, 'package.json'), 'utf8'));
    const packageLockText = readFileSync(join(frontendRoot, 'package-lock.json'), 'utf8');
    const packageLock = JSON.parse(packageLockText);

    for (const [packageName, filename, , dependencyGroup] of packages) {
      const expectedReference = `file:vendor/organizer/${filename}`;
      expect(packageJson[dependencyGroup][packageName]).toBe(expectedReference);
      expect(packageLock.packages[''][dependencyGroup][packageName]).toBe(expectedReference);
    }

    const dependencyMetadata = `${JSON.stringify(packageJson)}\n${packageLockText}`;
    expect(dependencyMetadata).not.toMatch(/[A-Z]:\\/i);
    expect(dependencyMetadata).not.toContain('teaching-prj-mgmt');
    expect(dependencyMetadata).not.toMatch(/npm\s+link/i);
    for (const metadata of Object.values(packageLock.packages)) {
      expect(metadata?.resolved || '').not.toContain('github.com');
    }
  });
});
