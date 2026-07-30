# TorchMar.github.io

This repository publishes two sites together:

- `https://torchmar.github.io/` — bilingual academic homepage
- `https://torchmar.github.io/blog/` — the existing Valaxy blog

The `hexo` branch stores source files. GitHub Actions builds the combined site
and publishes `dist/` to the `gh-pages` branch.

## Update the academic homepage

All homepage content lives in:

```text
academic/content.yml
```

The file contains `site`, `profile`, and these optional sections:

- `recentNews`
- `publications`
- `education`
- `researchExperience`
- `honors`
- `projects`
- `teaching`
- `academicService`
- `talks`

Every section has an `enabled` switch:

```yaml
sections:
  publications:
    enabled: true
```

Set it to `false` to remove both the section and its navigation link. Text that
can be translated uses `en` and `zh` fields:

```yaml
title:
  en: Example title
  zh: 示例标题
```

English is the default language. If a Chinese value is empty, the English value
is shown as a fallback. Lists are rendered in the same order as the YAML file,
so add new news and publications where you want them to appear.

The initial file intentionally contains obvious placeholders. Replace them
before publishing. The current profile image is `/images/Ray.jpg`; replacing
that file or changing `profile.photo` updates the homepage photo.

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
