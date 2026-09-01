import { FileSystemAdapter, htmlToMarkdown } from 'obsidian';
import { shellPath } from 'shell-path';
import which from 'which';

export function getVaultRoot() {
  // This is a desktop only plugin, so the adapter is expected to be a
  // FileSystemAdapter. Return null rather than throwing if it isn't.
  const adapter = app.vault.adapter;
  if (adapter instanceof FileSystemAdapter) {
    return adapter.getBasePath();
  }
  return null;
}

// Locate pandoc on the user's machine. Returns null when it cannot be found;
// callers decide whether that is fatal.
export async function getPandocPath(): Promise<string | null> {
  try {
    return await which('pandoc');
  } catch (e) {
    return null;
  }
}

export function copyElToClipboard(el: HTMLElement) {
  require('electron').clipboard.write({
    html: el.outerHTML,
    text: htmlToMarkdown(el.outerHTML),
  });
}

export class PromiseCapability<T> {
  settled = false;
  promise: Promise<T>;
  resolve: (data: T) => void;
  reject: (reason?: any) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = (data) => {
        resolve(data);
        this.settled = true;
      };

      this.reject = (reason) => {
        reject(reason);
        this.settled = true;
      };
    });
  }
}

export async function fixPath() {
  if (process.platform === 'win32') {
    return;
  }

  try {
    const path = await shellPath();

    process.env.PATH =
      path ||
      [
        './node_modules/.bin',
        '/.nodebrew/current/bin',
        '/usr/local/bin',
        process.env.PATH,
      ].join(':');
  } catch (e) {
    console.error(e);
  }
}

export function areSetsEqual<T>(as: Set<T>, bs: Set<T>) {
  if (as.size !== bs.size) return false;
  for (const a of as) if (!bs.has(a)) return false;
  return true;
}
