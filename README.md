## Obsidian Pandoc Reference List

Forked from [mgmeyers/obsidian-pandoc-reference-list](https://github.com/mgmeyers/obsidian-pandoc-reference-list)

Under `GPL-3.0 license`

Displays a formatted reference in the sidebar for each pandoc citekey present in the current document.

Set up instructions:
- Ensure [Pandoc](https://pandoc.org/) is installed. **This plugin requires at least version 2.11**.
- Supply a path to a compatible bibliography file
- (Optional) Supply a path or URL to a compatible [CSL style](https://citationstyles.org/)
- Run "Pandoc Reference List: Show reference list" from Obsidian command palette to display References tab in the sidebar

<img src="https://raw.githubusercontent.com/mgmeyers/obsidian-pandoc-reference-list/main/Screen%20Shot.png" alt="A screenshot of the plugin's works cited list">


## Changelog

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

