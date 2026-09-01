import { FileSystemAdapter, htmlToMarkdown } from 'obsidian';
import fs from 'fs';

export function getVaultRoot() {
  // This is a desktop only plugin, so the adapter is expected to be a
  // FileSystemAdapter. Return null rather than throwing if it isn't.
  const adapter = app.vault.adapter;
  if (adapter instanceof FileSystemAdapter) {
    return adapter.getBasePath();
  }
  return null;
}

// The cache directory was called `.pandoc` back when the plugin shelled out to
// pandoc. Move it instead of leaving an orphaned folder behind and
// re-downloading every CSL style and locale.
export function migrateCacheDir(from: string, to: string) {
  try {
    if (!fs.existsSync(from) || fs.existsSync(to)) return;
    fs.renameSync(from, to);
  } catch (e) {
    console.error('Error migrating the cache directory', e);
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

export function areSetsEqual<T>(as: Set<T>, bs: Set<T>) {
  if (as.size !== bs.size) return false;
  for (const a of as) if (!bs.has(a)) return false;
  return true;
}
