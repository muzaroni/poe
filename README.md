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
- `npm run refresh:gems` — refresh the locally bundled gem card data and icons from RePoE and the Path of Exile CDN

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
