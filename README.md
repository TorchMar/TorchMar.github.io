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

The homepage layout is inspired by [Anleeno Academic](https://github.com/Anleeno/anleeno-academic).
The profile photo lives at `public/images/Ray.jpg` and is served at `/images/Ray.jpg`.

### Add your academic information

| Information | Where to fill it in |
| --- | --- |
| Research topic, supervisor, responsibilities, or results | Add a bilingual `details` field to the relevant item in `sections.researchExperience.items`. Education details can go in `sections.education.items`. |
| Google Scholar | Set `url` in the existing Google Scholar entry in `profile.links` to your personal Scholar profile URL. |
| CV | Put the public PDF in `public/downloads/` and set `url` in the existing CV entry in `profile.links` to its path, such as `/downloads/cv.pdf`. |
| News | Add an item in `sections.recentNews.items` with `date` and bilingual `text`. Add `links` when you have a related announcement. |
| Publications | Add an item in `sections.publications.items` with `title`, `authors`, `venue`, and `year`. Use `**Your Name**` in `authors` to highlight your name. Add `note` or `links` for the paper, code, or project page as available. |
| Projects, awards, teaching, service, or talks | Add items in the matching section with `title`. Add `period`, `organization`, `location`, `details`, and `links` as available. |

Each link entry uses `label.en`, `label.zh`, and `url`. For an optional
publication or project thumbnail, put the image in `public/images/` and set
the item's `image` to `/images/<filename>` and its `imageAlt` to an `en`/`zh`
description. After adding a first item to a section, set `enabled: true` to
show it on the homepage.

An empty `url: ""` in `profile.links` displays a label without a link. An
enabled section with `items: []` and a bilingual `empty` message shows that
message until you add an item. News and Publications use this setting.

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
