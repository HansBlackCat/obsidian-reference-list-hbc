/* eslint-disable @typescript-eslint/ban-ts-comment */

import path from 'path';
import {
  bibToCSL,
  getBibPath,
  getCSLLocale,
  getCSLStyle,
  // getZBib,
  getZUserGroups,
  isZoteroRunning,
} from '../helpers';

// @ts-ignore
import testCSL from './test.json';
// @ts-ignore
import testBIBCSL from './test.bib.json';
// @ts-ignore
import testBIB2CSL from './test2.bib.json';
// @ts-ignore
import testYAMLCSL from './test.yaml.json';
// @ts-ignore
// import library from './My Library.json';
import { existsSync, rmSync } from 'fs';

describe('bibToCSL()', () => {
  it('returns json from json', async () => {
    expect(await bibToCSL(path.join(__dirname, 'test.json'))).toEqual(testCSL);
  });

  it('returns json from bib', async () => {
    expect(await bibToCSL(path.join(__dirname, 'test.bib'))).toEqual(
      testBIBCSL
    );
  });

  it('returns json from bib2', async () => {
    expect(await bibToCSL(path.join(__dirname, 'test2.bib'))).toEqual(
      testBIB2CSL
    );
  });

  it('returns json from yaml', async () => {
    expect(await bibToCSL(path.join(__dirname, 'test.yaml'))).toEqual(
      testYAMLCSL
    );
  });
});

// @ts-ignore
global.setImmediate =
  // @ts-ignore
  global.setImmediate || ((fn, ...args) => global.setTimeout(fn, 0, ...args));

describe('getBibPath()', () => {
  const vaultRoot = path.join(__dirname, '..', '..', '..');
  const expected = path.join(vaultRoot, 'src', 'bib', 'tests', 'test.bib');
  const resolve = (p: string) => path.resolve(getBibPath(p, () => vaultRoot));

  it('resolves a path relative to the vault root', () => {
    expect(resolve(path.join('src', 'bib', 'tests', 'test.bib'))).toBe(
      expected
    );
  });

  it('accepts either path separator', () => {
    // A vault synced between Windows and POSIX stores one string for both.
    expect(resolve('src\\bib\\tests\\test.bib')).toBe(expected);
    expect(resolve('src/bib/tests/test.bib')).toBe(expected);
  });

  it('treats a leading separator as vault relative', () => {
    expect(resolve('/src/bib/tests/test.bib')).toBe(expected);
    expect(resolve('\\src\\bib\\tests\\test.bib')).toBe(expected);
  });

  it('throws when the file cannot be found', () => {
    expect(() => getBibPath('nope.bib', () => vaultRoot)).toThrow(
      "cannot access bibliography file 'nope.bib'"
    );
  });
});

describe('getLocale()', () => {
  it('fetches a locale', async () => {
    const cache = new Map<string, string>();
    jest.spyOn(navigator, 'onLine', 'get').mockReturnValueOnce(true);
    const locale = await getCSLLocale(cache, __dirname, 'bg-BG');
    expect(typeof locale).toBe('string');
    expect(existsSync(path.join(__dirname, 'locales-bg-BG.xml'))).toBe(true);
    await getCSLLocale(cache, __dirname, 'bg-BG');
    rmSync(path.join(__dirname, 'locales-bg-BG.xml'));
  });
});

describe('getStyle()', () => {
  it('fetches a style', async () => {
    const cache = new Map<string, string>();
    jest.spyOn(navigator, 'onLine', 'get').mockReturnValueOnce(true);
    const style = await getCSLStyle(
      cache,
      __dirname,
      'https://www.zotero.org/styles/australian-guide-to-legal-citation-3rd-edition'
    );
    expect(typeof style).toBe('string');
    expect(
      existsSync(
        path.join(__dirname, 'australian-guide-to-legal-citation-3rd-edition')
      )
    ).toBe(true);
    await getCSLStyle(
      cache,
      __dirname,
      'australian-guide-to-legal-citation-3rd-edition'
    );
    rmSync(
      path.join(__dirname, 'australian-guide-to-legal-citation-3rd-edition')
    );
  });

  it('resolves an explicit style path relative to the vault root', async () => {
    const cache = new Map<string, string>();
    const vaultRoot = path.join(__dirname, '..', '..', '..');
    const relativePath = path.join('src', 'parser', 'tests', 'apa.csl');

    const style = await getCSLStyle(
      cache,
      __dirname,
      relativePath,
      () => vaultRoot,
      relativePath
    );

    expect(typeof style).toBe('string');
    // The cache must be keyed by the path as configured, since that is what
    // callers look styles up with.
    expect(cache.has(relativePath)).toBe(true);
    expect(cache.get(relativePath)).toBe(style);
  });

  it('throws when an explicit style path cannot be resolved', async () => {
    const cache = new Map<string, string>();
    await expect(
      getCSLStyle(cache, __dirname, 'nope.csl', () => __dirname, 'nope.csl')
    ).rejects.toThrow("Cannot find file 'nope.csl'");
  });
});

describe('getZUserGroups()', () => {
  it('retrieves user groups', async () => {
    expect(await getZUserGroups('23119')).toEqual([
      { id: 1, name: 'My Library' },
      { id: 2, name: 'test' },
    ]);
  });
});

// describe('getZBib()', () => {
//   it('retrieves bib', async () => {
//     expect(await getZBib(new Map(), '23119', 1, 'My Library')).toEqual(library);
//   });
// });

describe('isZoteroRunning()', () => {
  it('runs', async () => {
    expect(await isZoteroRunning('23119')).toBe(true);
  });
});
