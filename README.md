## Reference List HBC

Forked from [mgmeyers/obsidian-pandoc-reference-list](https://github.com/mgmeyers/obsidian-pandoc-reference-list)

Under `GPL-3.0 license`

Displays a formatted reference in the sidebar for each pandoc citekey present in the current document.

Set up instructions:
- Supply a path to a compatible bibliography file (`.bib`, `.bibtex`, `.yaml`, or CSL `.json`). **Pandoc is no longer required.**
- (Optional) Supply a path or URL to a compatible [CSL style](https://citationstyles.org/)
- Run "Reference List HBC: Show reference list" from Obsidian command palette to display References tab in the sidebar

<img src="https://raw.githubusercontent.com/mgmeyers/obsidian-pandoc-reference-list/main/Screen%20Shot.png" alt="A screenshot of the plugin's works cited list">


## Changelog

### v1.1.2

- Bibliography and CSL paths accept either path separator, so a vault synced between Windows and Linux/macOS can keep one path string (`\` now resolves on POSIX; Windows already accepted `/`). A leading separator is treated as vault relative

### v1.1.1

- Dropped the last pandoc references from the interface: the settings icon's label, the "no bibliography configured" notice, and the `[@pandoc]` example citekey in the inline citation settings (now `[@citekey]`)
- Removed the unused "Validate Pandoc configuration" strings

### v1.1.0

- **Pandoc is no longer required.** Bibliographies are parsed in-process: BibTeX/BibLaTeX via [`@retorquere/bibtex-parser`](https://github.com/retorquere/bibtex-parser), CSL YAML via `js-yaml`, CSL JSON directly
  - Output is verified byte-identical to `pandoc -t csljson` on every bibliography fixture in this repo (`test.bib`, `test2.bib`, `test.yaml`), including sentence-cased titles with brace protection, smart apostrophes, date-parts and language codes
  - The "Pandoc executable path" and "Fallback path to Pandoc" settings are gone, as are the `execa`, `which` and `shell-path` dependencies
- The cache directory moved from `<vault>/.pandoc` to `<vault>/.reference-list`; an existing `.pandoc` folder is moved on first load, so cached styles and locales are kept
- Groundwork for mobile: the parser bundles for the browser, unlike the previously considered `citation-js` (which pulls in `node:http`/`node:https`/`node:zlib`). Filesystem and Electron usage still keeps the plugin desktop-only for now

### v1.0.2

- Renamed: plugin id `obsidian-pandoc-reference-list-hbc` -> `obsidian-reference-list-hbc`, display name "Pandoc Reference List HBC" -> "Reference List HBC", following the renamed repository
  - **Upgrading from 1.0.1:** rename the plugin folder in `<vault>/.obsidian/plugins/` to `obsidian-reference-list-hbc` and move your `data.json` into it, otherwise settings are lost
- Release workflow runs on `actions/checkout@v5` / `actions/setup-node@v5` and builds on Node 22 (Node 20 runners are deprecated)

### v1.0.1

- Fix relative CSL paths: styles were cached under a different key than the one they are looked up with, which silently disabled every explicit CSL path (relative *and* absolute)
- Fix the plugin hanging on startup when pandoc cannot be found; references now load regardless (pandoc is only required for non-CSL-JSON bibliographies)
- Restore the "Fallback path to Pandoc" input. Auto detection no longer overwrites it: the fallback is kept in its own setting and used only when detection fails
- Relative paths in frontmatter (`bibliography`, `csl`) resolve next to the note first, then relative to the vault root; a note setting only `csl`/`lang` no longer throws
- Plugin id corrected to `obsidian-pandoc-reference-list-hbc`; package metadata (name, version, license) synced with the manifest

### v1.0.0 (From 2.0.25)

- "Fallback path to Pandoc" doesn't automatically renewed
- Support relative path for both bib & csl file

