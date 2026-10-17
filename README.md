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
