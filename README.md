# TorchMar.github.io

This repository publishes two sites together:

- `https://torchmar.github.io/` — academic homepage
- `https://torchmar.github.io/blog/` — the existing Valaxy blog

The `hexo` branch stores source files. GitHub Actions builds the combined site
and publishes `dist/` to the `gh-pages` branch.

## Update the academic homepage

The homepage uses the [Anleeno Academic template](https://github.com/Anleeno/anleeno-academic/tree/763fd7a64c2fbc9434dc6f04f4e0f64561faaee2).
The template code and styles live in `academic/` with their [MIT license](academic/LICENSE).
The TorchMar wordmark and portrait placeholder live in `academic/src/assets/`.

| Content | Configuration in `academic/config/` |
| --- | --- |
| Title, description, and language | `site.json` |
| Profile, portrait, CV, and social links | `hero.json` |
| Biography | `about.json` |
| News and publications | `news.json`, `publications.json` |
| Experience, education, awards, and projects | `experience.json`, `education.json`, `awards.json`, `projects.json` |
| Theme, paper previews, and recommendations | `theme.jsonc`, `publication-previews.json`, `paper-recommendations.json` |

Place homepage media in `academic/src/assets/` and reference it as
`assets/<filename>` in the configuration. The [configuration schema](academic/config/schemas/site.schema.json)
describes the fields for each section. Run `pnpm dev:academic` to edit and
preview the homepage, or run `node academic/scripts/validate-config.js` to
check its configuration and asset references.

## Update the blog

Blog posts and pages remain in the existing `pages/` directory. For example:

```text
pages/posts/my-new-post.md
```

The Valaxy theme, comments, search, categories, tags, and archives remain
unchanged. The only deployment difference is that the blog now lives under
`/blog/`.

Start the Valaxy development server with:

```bash
pnpm dev
```

Then open the `/blog/` path shown by the development server.

## Build and preview the complete site

Use Node.js 22.13 or later in the Node 22 line, or Node.js 24 or later.

```bash
pnpm install
pnpm build
pnpm serve
```

The full build writes:

```text
dist/
├── index.html       # academic homepage
├── blog/            # Valaxy blog
└── posts/           # compatibility redirects for old blog URLs
```

The build also keeps the old RSS and article URLs working. Existing links such
as `/posts/example` redirect to `/blog/posts/example`, while query strings and
hash fragments are preserved.

## Deployment

Pushing to `hexo` triggers `.github/workflows/gh-pages.yml`. The workflow
installs dependencies, builds both sites, checks the required outputs, and
publishes `dist/` to `gh-pages`.
