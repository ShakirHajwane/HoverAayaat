# Quran Reference Linker

Single-file hover-to-play Quran reference linker for Islamic articles and blog posts.

## Local commands

```bash
npm ci
npm test
npm run build
npm run build:pages
```

## GitHub Pages output

After `npm run build:pages`, the Pages-ready files are created in `pages-dist/`:

- `pages-dist/index.html`
- `pages-dist/quran-ref-linker.min.js`

When deployed to GitHub Pages, the hosted bundle URL will follow this pattern:

```text
https://<github-username>.github.io/<repo-name>/quran-ref-linker.min.js
```

The documentation page will be:

```text
https://<github-username>.github.io/<repo-name>/
```

## Publishing to GitHub Pages

1. Push this repo to GitHub.
2. Keep the default branch as `main`, or update `.github/workflows/deploy-pages.yml` if your branch name is different.
3. In GitHub, open `Settings -> Pages`.
4. Under `Build and deployment`, set `Source` to `GitHub Actions`.
5. Push to `main` or run the workflow manually from the `Actions` tab.

The workflow will test the widget, build the bundle, prepare the Pages artifact, and deploy both the docs page and hosted script.
