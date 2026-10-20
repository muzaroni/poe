# Muzaroni Path of Exile guides

A free visual guide editor and static guide site. The public site is built with Astro and hosted on GitHub Pages. Guide writing uses React and Tiptap, with drafts saved in your browser.

## Write a guide

1. Install [Node.js 22](https://nodejs.org/) and [GitHub Desktop](https://desktop.github.com/) once.
2. Clone `muzaroni/poe` in GitHub Desktop.
3. In the repository folder, run `npm install` once, then `npm run dev` when you want to write. The local site opens at `http://127.0.0.1:4321/poe/editor/`.
4. Write normally in the editor. Drafts save automatically in this browser. Use **Save to project** to write the guide to `src/content/builds/` and screenshots to `public/images/uploads/`.
5. Review the guide preview at `http://127.0.0.1:4321/poe/`.
6. In GitHub Desktop, commit and push the changes. GitHub Actions builds and publishes to `https://muzaroni.github.io/poe/` once Pages is configured to use **GitHub Actions** in repository Settings → Pages.

The editor's **Save to project** button works only when `npm run dev` is running on your computer. Published readers can view the editor route, but it cannot write to the repository. Reader checklist progress is saved in each reader's browser.

## Current content

To remove a page, select it in the local editor and choose **Delete page**. The confirmation shows its title and page address. Deletion removes its local project file and this browser's draft; the public page is removed on the next push and deployment. Recovery copies of the saved file and current editor content are kept under `.deleted-pages/` (excluded from Git and the public site). To recover, import the backup's `draft.json` in the editor and save it to the project. Uploaded images are kept because other pages may use them.

The Sunder → RF guide was imported from [the existing guide](https://muzaroni.github.io/328_sunder_rf.html). Acts 9 and 10 have clearly labeled placeholders because the reference did not include full instructions for those acts. Review them in the editor before treating this as a complete campaign guide.

## Commands

- `npm run dev` — start the site and local save service
- `npm run check` — check TypeScript and Astro components
- `npm run build` — check and build the static site
- `npm run refresh:gems` — refresh gem card data and icons, then cache vendor prices for the current league
- `npm run refresh:gem-vendors` — check RePoE's game version and fetch PoE Levelling Planner vendor prices only if that league is not already cached in `public/data/gem-vendors/`

GitHub Actions checks for a new league daily. When RePoE reports a new league and PoE Levelling Planner has its prices, the workflow commits one versioned cache file and triggers the normal site deployment. Normal builds use the committed file and do not call the vendor API.

The local save service listens only on `127.0.0.1:4322` and accepts requests from the local editor origin.

## Analytics

Production page views are sent to `https://muzaroni.goatcounter.com/` using GoatCounter's hosted script. Analytics runs only on `muzaroni.github.io/poe/`; local development, local production previews, the editor, and gem mockup pages are excluded. Page paths are counted without query strings or section anchors. The account dashboard provides the reports; tracking starts after deployment, and visitors who block the script may not be counted.

## Sources

The guide text and images were imported from Muzaroni's existing guide. The gem picker is a local snapshot of released Path of Exile 1 gem names and colors from [RePoE's hosted export](https://repoe-fork.github.io/gems_minimal.json). Game data and artwork belong to Grinding Gear Games. This repository's software license is left for the owner to choose.

## Gem cards

Hover or focus a gem for a compact preview; click or tap it for the full card, including its icon, level selector, requirements, stats, and quality effects. Escape, the close button, or clicking outside closes the card. Opening a gem inside a checklist does not change its checkmark.

Cards use a local [RePoE gem export](https://repoe-fork.github.io/gems.json) and locally stored Grinding Gear Games icons. Each card shows the snapshot's game version; it can differ from the guide's league. Refreshing data is a manual action and should be reviewed before publishing. Unknown gem names offer a wiki lookup instead of invented statistics.

## Fonts

Reddit Mono and Reddit Sans are bundled locally from [reddit/redditsans](https://github.com/reddit/redditsans), licensed under the SIL Open Font License 1.1. The license is included at public/fonts/OFL.txt.

## Passive tree viewer preview

Open `/poe/tree-preview/` locally. The preview has pinned GGG 3.29.1 and 3.28.0 trees and locally bundled spritesheets. The Sunder/RF example imports 11 real 3.28 stages from the guide's existing PoB. Switch stages to compare allocations, search or click passives to inspect them, and use drag/scroll/pinch or keyboard navigation to move around. Ascendancy nodes have a separate view.

Import accepts compressed PoB export codes or XML files for 3.28/3.29. Tree versions are matched to the export; 3.28 allocations are never silently applied to 3.29. Preview imports last until reload, and do not change guides. This is a viewer, not an allocation planner: item calculations, jewel transformations, and cluster-jewel-generated nodes are not supported. Missing node IDs are reported. Existing screenshots stay in place.

Run `npm run refresh:trees` to refresh the pinned data and example stages. Review game-version updates explicitly; do not replace an existing league snapshot with a newer tree. The preview route is excluded from GoatCounter.

## Inline tree blocks

Use **Tree** in the local visual editor toolbar to insert a compact snapshot. Choose **Choose nodes & steps** to open the picker. Click nodes to select/deselect them, or import a PoB and choose a stage. Inspect a destination, choose **Add step marker**, add an optional instruction, and reorder the steps with the up/down buttons.

The inline view defaults to 480 × 240 pixels. Automatic framing focuses the numbered destinations (or selected nodes when there are no markers), with surrounding nodes for context. Choose a width/height preset or pan/zoom and select **Use dashed crop** for manual framing. **Apply to guide** stores the selection, ordered markers, notes, version, and framing inside that block. **Save to project** writes it with the rest of the guide. Cancel closes the picker without altering the block.

Readers get the compact snapshot, selectable numbered instructions, and **Expand tree** for the interactive viewer. Scrolling over the compact snapshot continues scrolling the page. Tree data and spritesheets are shared and loaded only as snapshots approach the viewport. `/poe/tree-inline-preview/` is an editable demonstration that never changes guide files and is excluded from analytics.

For a single tree covering the whole campaign, enable **Full campaign view** in the tree picker and add an Act divider before each act's first marker. The guide shows a compact tree overview. **Open campaign view** opens a monitor sized layout with act tabs, that act's numbered tree steps, its gem links, and the full interactive tree. Drag to pan, scroll over the tree to zoom, use Fit tree, or click any passive to inspect its stats, even if it belongs to a later act. Arrow keys or Previous/Next switch acts. Gem links come from the final GEM LINKS block in each written Act H2 section; stages inside that block are combined into its final setup. Acts without a new gem block carry forward the previous links. The tree picker's per-act text fields are a fallback for guides without written gem links. A guide Regex block stays available with a Copy button across all acts; the picker also has a fallback regex field.

### Gem links between acts

In a gem links block, choose **Edit setup** and an earlier block under **Continue from**. **Continue gem links** copies its current links and stores an independent comparison. Use **Compare only** to add tracking to an existing setup without replacing its gems. Keep labels such as `Main:`, `Movement:`, and `Utility:` consistent across acts. Readers see the complete current setup with a small yellow NEW badge for new gems and a muted previous gem beside replacements. Muted red REMOVED badges appear beneath the old link, orange SWAP badges accompany replacements, and blue MOVED badges appear only at the destination when a gem changes named setups. Moves are not counted as both removal and addition. Changed linking gets a compact label. Unchanged gems have no extra decoration. **Remove comparison** keeps the current gems and hides the notes. Comparisons travel with browser drafts, draft transfers, and Save to project.

Run `npm run check:gem-links` to check comparison behavior.

For manual control, open **Edit setup → Change badges**. Each current gem can use Automatic, NEW, No badge, a specific SWAP target from the previous setup, or MOVED from another named setup. Choosing NEW leaves the previous gem as a separate removal. Under **Removed gems**, individual removal entries can be hidden. **Reset all to automatic** removes manual choices. These settings are stored on the gem links block and survive draft transfers and Save to project; choosing a different comparison resets them.

### Level stages inside gem links

Add an H3 heading inside one GEM LINKS block for each level milestone. Keep setup labels consistent (`Link 1:`, `Link 2:`, `Util:`). The first stage establishes the links; later stages compare against the latest version of each label. Include only changed setups or repeat the full setup. Omitted setups remain unchanged. Removing a gem from a setup that is shown still produces a removal badge. A comparison with an earlier block carries forward its final cumulative links. **Edit setup → Change badges** provides separate manual controls for each stage; keep stage headings stable to retain their saved choices. Use `or` between inserted gems for alternatives in one socket.
