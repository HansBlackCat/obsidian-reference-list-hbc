import {
  MarkdownRenderChild,
  MarkdownPostProcessorContext,
  TFile,
} from 'obsidian';

import { t } from './lang/helpers';
import ReferenceList from './main';

export const referenceBlockLang = 'references';

// Renders the document's bibliography where the ```references``` block sits, so
// a note can carry its reference list the way a paper does. The numbering
// matches the inline citations for free: both come from one citeproc run over
// the whole document.
class ReferenceBlock extends MarkdownRenderChild {
  plugin: ReferenceList;
  file: TFile;

  constructor(el: HTMLElement, plugin: ReferenceList, file: TFile) {
    super(el);
    this.plugin = plugin;
    this.file = file;
  }

  onload() {
    this.containerEl.addClass('pwc-embedded-reference-list');

    // Reading mode re-runs this processor when the bibliography changes, but
    // live preview does not, so listen for the update as well.
    this.registerEvent(
      this.plugin.emitter.on('referencesUpdated', (file: TFile) => {
        if (file === this.file) this.render();
      })
    );

    this.render();
  }

  async render() {
    const { bibManager } = this.plugin;

    // Nothing cached yet: the sidebar may never have been opened for this file.
    if (!bibManager.fileCache.has(this.file)) {
      try {
        const content = await app.vault.cachedRead(this.file);
        await bibManager.getReferenceList(this.file, content);
      } catch (e) {
        console.error('Error building the reference list', e);
      }
    }

    const bib = bibManager.renderBibliography(this.file);

    this.containerEl.empty();

    if (!bib) {
      this.containerEl.createDiv({
        cls: 'pwc-no-content',
        text: t('No citations found in the current document.'),
      });
      return;
    }

    this.containerEl.append(bib);
  }
}

export function processReferenceBlock(plugin: ReferenceList) {
  return (
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ) => {
    const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(file instanceof TFile)) return;

    ctx.addChild(new ReferenceBlock(el, plugin, file));
  };
}
