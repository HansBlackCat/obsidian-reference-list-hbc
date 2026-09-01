import fs from 'fs';
import path from 'path';
import https from 'https';
import download from 'download';
import { request } from 'http';
import { CSLList, PartialCSLEntry } from './types';
import { parseBibliography } from './bibParser';

export const DEFAULT_ZOTERO_PORT = '23119';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// A vault synced between Windows and Linux/macOS stores one path string for
// both, so accept either separator. Windows already accepts `/`, so in practice
// this is what makes `\` work on POSIX. It is only tried as a fallback, since
// `\` is a legal character in a POSIX filename.
function separatorVariants(filePath: string) {
  const swapped = filePath.replace(/[\\/]+/g, path.sep);
  return swapped === filePath ? [filePath] : [filePath, swapped];
}

// Resolve a user supplied path: try it as given (absolute, or relative to the
// process cwd), then relative to the vault root. Returns null if neither exists.
export function resolveVaultPath(
  filePath: string,
  getVaultRoot?: () => string
): string | null {
  if (!filePath) return null;

  const variants = separatorVariants(filePath);

  for (const variant of variants) {
    if (fs.existsSync(variant)) return variant;
  }

  const root = getVaultRoot?.();
  if (root) {
    for (const variant of variants) {
      const fromVault = path.join(root, variant);
      if (fs.existsSync(fromVault)) return fromVault;
    }
  }

  return null;
}

export function getBibPath(bibPath: string, getVaultRoot?: () => string) {
  const resolved = resolveVaultPath(bibPath, getVaultRoot);

  if (!resolved) {
    throw new Error(`bibToCSL: cannot access bibliography file '${bibPath}'.`);
  }

  return resolved;
}

export async function bibToCSL(
  bibPath: string,
  getVaultRoot?: () => string
): Promise<PartialCSLEntry[]> {
  bibPath = getBibPath(bibPath, getVaultRoot);

  const content = await fs.promises.readFile(bibPath, 'utf8');

  try {
    return parseBibliography(content, path.parse(bibPath).ext);
  } catch (e) {
    throw new Error(`bibToCSL: cannot parse '${bibPath}': ${e.message}`);
  }
}

export async function getCSLLocale(
  localeCache: Map<string, string>,
  cacheDir: string,
  lang: string
) {
  if (localeCache.has(lang)) {
    return localeCache.get(lang);
  }

  const url = `https://raw.githubusercontent.com/citation-style-language/locales/master/locales-${lang}.xml`;
  const outpath = path.join(cacheDir, `locales-${lang}.xml`);

  ensureDir(cacheDir);
  if (fs.existsSync(outpath)) {
    const localeData = fs.readFileSync(outpath).toString();
    localeCache.set(lang, localeData);
    return localeData;
  }

  const str = await new Promise<string>((res, rej) => {
    https.get(url, (result) => {
      let output = '';

      result.setEncoding('utf8');
      result.on('data', (chunk) => (output += chunk));
      result.on('error', (e) => rej(`Downloading locale: ${e}`));
      result.on('close', () => {
        rej(new Error('Error: cannot download locale'));
      });
      result.on('end', () => {
        if (/^404: Not Found/.test(output)) {
          rej(new Error('Error downloading locale: 404: Not Found'));
        } else {
          res(output);
        }
      });
    });
  });

  fs.writeFileSync(outpath, str);
  localeCache.set(lang, str);
  return str;
}

export async function getCSLStyle(
  styleCache: Map<string, string>,
  cacheDir: string,
  url: string,
  getVaultRoot?: () => string,
  explicitPath?: string
) {
  if (explicitPath) {
    // Cache under the path exactly as it was configured: callers look styles up
    // with the same string they pass in here, so the key must not be rewritten
    // to the resolved (absolute) path.
    if (styleCache.has(explicitPath)) {
      return styleCache.get(explicitPath);
    }

    const cslPath = resolveVaultPath(explicitPath, getVaultRoot);

    if (!cslPath) {
      throw new Error(
        `Error: retrieving citation style; Cannot find file '${explicitPath}'.`
      );
    }

    const styleData = fs.readFileSync(cslPath).toString();
    styleCache.set(explicitPath, styleData);
    return styleData;
  }

  if (styleCache.has(url)) {
    return styleCache.get(url);
  }

  const fileFromURL = url.split('/').pop();
  const outpath = path.join(cacheDir, fileFromURL);

  ensureDir(cacheDir);
  if (fs.existsSync(outpath)) {
    const styleData = fs.readFileSync(outpath).toString();
    styleCache.set(url, styleData);
    return styleData;
  }

  const str = await new Promise<string>((res, rej) => {
    https.get(url, (result) => {
      let output = '';

      result.setEncoding('utf8');
      result.on('data', (chunk) => (output += chunk));
      result.on('error', (e) => rej(`Error downloading CSL: ${e}`));
      result.on('close', () => {
        rej(new Error('Error: cannot download CSL'));
      });
      result.on('end', () => {
        try {
          res(output);
        } catch (e) {
          rej(e);
        }
      });
    });
  });

  fs.writeFileSync(outpath, str);
  styleCache.set(url, str);
  return str;
}

export const defaultHeaders = {
  'Content-Type': 'application/json',
  'User-Agent': 'obsidian/zotero',
  Accept: 'application/json',
  Connection: 'keep-alive',
};

function getGlobal() {
  if (window?.activeWindow) return activeWindow;
  if (window) return window;
  return global;
}

export async function getZUserGroups(
  port: string = DEFAULT_ZOTERO_PORT
): Promise<Array<{ id: number; name: string }>> {
  if (!(await isZoteroRunning(port))) return null;

  return new Promise((res, rej) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'user.groups',
    });

    const postRequest = request(
      {
        host: '127.0.0.1',
        port: port,
        path: '/better-bibtex/json-rpc',
        method: 'POST',
        headers: {
          ...defaultHeaders,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (result) => {
        let output = '';

        result.setEncoding('utf8');
        result.on('data', (chunk) => (output += chunk));
        result.on('error', (e) => rej(`Error connecting to Zotero: ${e}`));
        result.on('close', () => {
          rej(new Error('Error: cannot connect to Zotero'));
        });
        result.on('end', () => {
          try {
            res(JSON.parse(output).result);
          } catch (e) {
            rej(e);
          }
        });
      }
    );

    postRequest.write(body);
    postRequest.end();
  });
}

function panNum(n: number) {
  if (n < 10) return `0${n}`;
  return n.toString();
}

function timestampToZDate(ts: number) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${panNum(d.getUTCMonth() + 1)}-${panNum(
    d.getUTCDate()
  )} ${panNum(d.getUTCHours())}:${panNum(d.getUTCMinutes())}:${panNum(
    d.getUTCSeconds()
  )}`;
}

export async function getZModified(
  port: string = DEFAULT_ZOTERO_PORT,
  groupId: number,
  since: number
): Promise<CSLList> {
  if (!(await isZoteroRunning(port))) return null;

  return new Promise((res, rej) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'item.search',
      params: [[['dateModified', 'isAfter', timestampToZDate(since)]], groupId],
    });

    const postRequest = request(
      {
        host: '127.0.0.1',
        port: port,
        path: '/better-bibtex/json-rpc',
        method: 'POST',
        headers: {
          ...defaultHeaders,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (result) => {
        let output = '';

        result.setEncoding('utf8');
        result.on('data', (chunk) => (output += chunk));
        result.on('error', (e) => rej(`Error connecting to Zotero: ${e}`));
        result.on('close', () => {
          rej(new Error('Error: cannot connect to Zotero'));
        });
        result.on('end', () => {
          try {
            res(JSON.parse(output).result);
          } catch (e) {
            rej(e);
          }
        });
      }
    );

    postRequest.write(body);
    postRequest.end();
  });
}

function applyGroupID(list: CSLList, groupId: number) {
  return list.map((item) => {
    item.groupID = groupId;
    return item;
  });
}

export async function getZBib(
  port: string = DEFAULT_ZOTERO_PORT,
  cacheDir: string,
  groupId: number,
  loadCached?: boolean
) {
  const isRunning = await isZoteroRunning(port);
  const cached = path.join(cacheDir, `zotero-library-${groupId}.json`);

  ensureDir(cacheDir);
  if (loadCached || !isRunning) {
    if (fs.existsSync(cached)) {
      return applyGroupID(
        JSON.parse(fs.readFileSync(cached).toString()) as CSLList,
        groupId
      );
    }
    if (!isRunning) {
      return null;
    }
  }

  const bib = await download(
    `http://127.0.0.1:${port}/better-bibtex/export/library?/${groupId}/library.json`
  );

  const str = bib.toString();

  fs.writeFileSync(cached, str);

  return applyGroupID(JSON.parse(str) as CSLList, groupId);
}

export async function refreshZBib(
  port: string = DEFAULT_ZOTERO_PORT,
  cacheDir: string,
  groupId: number,
  since: number
) {
  if (!(await isZoteroRunning(port))) {
    return null;
  }

  const cached = path.join(cacheDir, `zotero-library-${groupId}.json`);
  ensureDir(cacheDir);
  if (!fs.existsSync(cached)) {
    return null;
  }

  const mList = (await getZModified(port, groupId, since)) as CSLList;

  if (!mList?.length) {
    return null;
  }

  const modified: Map<string, PartialCSLEntry> = new Map();
  const newKeys: Set<string> = new Set();

  for (const mod of mList) {
    mod.id = (mod as any).citekey || (mod as any)['citation-key'];
    if (!mod.id) continue;
    modified.set(mod.id, mod);
    newKeys.add(mod.id);
  }

  const list = JSON.parse(fs.readFileSync(cached).toString()) as CSLList;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (modified.has(item.id)) {
      newKeys.delete(item.id);
      list[i] = modified.get(item.id);
    }
  }

  for (const key of newKeys) {
    list.push(modified.get(key));
  }

  fs.writeFileSync(cached, JSON.stringify(list));

  return {
    list: applyGroupID(list, groupId),
    modified,
  };
}

export async function isZoteroRunning(port: string = DEFAULT_ZOTERO_PORT) {
  const p = download(`http://127.0.0.1:${port}/better-bibtex/cayw?probe=true`);
  const res = await Promise.race([
    p,
    new Promise((res) => {
      getGlobal().setTimeout(() => {
        res(null);
        p.destroy();
      }, 150);
    }),
  ]);

  return res?.toString() === 'ready';
}

export async function getItemJSONFromCiteKeys(
  port: string = DEFAULT_ZOTERO_PORT,
  citeKeys: string[],
  libraryID: number
) {
  if (!(await isZoteroRunning(port))) return null;

  let res: any;
  try {
    res = await new Promise((res, rej) => {
      const body = JSON.stringify({
        jsonrpc: '2.0',
        method: 'item.export',
        params: [citeKeys, '36a3b0b5-bad0-4a04-b79b-441c7cef77db', libraryID],
      });

      const postRequest = request(
        {
          host: '127.0.0.1',
          port: port,
          path: '/better-bibtex/json-rpc',
          method: 'POST',
          headers: {
            ...defaultHeaders,
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (result) => {
          let output = '';

          result.setEncoding('utf8');
          result.on('data', (chunk) => (output += chunk));
          result.on('error', (e) => rej(`Error connecting to Zotero: ${e}`));
          result.on('close', () => {
            rej(new Error('Error: cannot connect to Zotero'));
          });
          result.on('end', () => {
            try {
              res(JSON.parse(output));
            } catch (e) {
              rej(e);
            }
          });
        }
      );

      postRequest.write(body);
      postRequest.end();
    });
  } catch (e) {
    console.error(e);
    return null;
  }

  try {
    if (res.error?.message) {
      console.error(new Error(res.error.message));
      return null;
    }

    return Array.isArray(res.result)
      ? JSON.parse(res.result[2]).items
      : JSON.parse(res.result).items;
  } catch (e) {
    console.error(e);
    return null;
  }
}
