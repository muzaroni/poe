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

The Sunder → RF guide was imported from [the existing guide](https://muzaroni.github.io/328_sunder_rf.html). Acts 9 and 10 have clearly labeled placeholders because the reference did not include full instructions for those acts. Review them in the editor before treating this as a complete campaign guide.

## Commands

- `npm run dev` — start the site and local save service
- `npm run check` — check TypeScript and Astro components
- `npm run build` — check and build the static site

The local save service listens only on `127.0.0.1:4322` and accepts requests from the local editor origin.

## Sources

The guide text and images were imported from Muzaroni's existing guide. The gem picker is a local snapshot of released Path of Exile 1 gem names and colors from [RePoE's hosted export](https://repoe-fork.github.io/gems_minimal.json). Game data and artwork belong to Grinding Gear Games. This repository's software license is left for the owner to choose.

## Fonts

Reddit Mono and Reddit Sans are bundled locally from [reddit/redditsans](https://github.com/reddit/redditsans), licensed under the SIL Open Font License 1.1. The license is included at public/fonts/OFL.txt.
