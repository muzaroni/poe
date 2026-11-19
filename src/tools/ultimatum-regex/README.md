# Ultimatum Regex Generator

Imported from https://github.com/muzaroni/poe-regex at commit
`be0fd2135d081b0c30f9d84788540a1762d572cb`.
The standalone repository and deployment remain independent and unchanged.

`UltimatumRegexPicker.tsx` is the original React application with its manual
createRoot entry replaced by a component export. Astro mounts it with
`client:only="react"` so browser storage is restored before any persistence effect.
The original components, data, regex/trade/storage logic and tests are retained.
CSS selectors are prefixed with `.ultimatum-picker`; final overrides use site
fonts, palette and a wider container. Do not import standalone fonts or global CSS.

Storage remains `ultimatum-picker:v1` with the original version 1 schema.
GitHub Pages paths `/poe-regex/` and `/poe/tools/ultimatum-regex/` share
`https://muzaroni.github.io` localStorage. No migration or clearing is needed.
Both tools edit the same stored presets; avoid editing both in separate tabs
simultaneously because the last save wins, as in the original application.
Local development and other hostnames have independent browser storage.
Reset changes only the selected preset settings, preserving other presets and keys.

Run `npm run test:ultimatum` and `npm run build` from the repository root.
Deployment runs both checks. The Astro base remains `/poe` and new navigation
links derive from BASE_URL. Add future tools to `src/data/tools.ts` and create
a dedicated page/module. No additional runtime dependencies were introduced.

Validation: all 49 original tests pass, including legacy saved presets and storage
failures. Production preview checked fresh load, navigation, preset creation and
restoration from the same origin, clipboard output, reset isolation, existing guide
rendering and no horizontal overflow at 320, 390, 768 and 1440px widths.
Live GitHub Pages deployment is not performed by this local integration.
