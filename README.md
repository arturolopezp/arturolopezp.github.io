# Arturo López Pérez - Academic Website

Source files for [arturolopezp.github.io](https://arturolopezp.github.io), an academic website for research, teaching materials, replication packages, and computational economics projects.

The site uses [al-folio](https://github.com/alshedivat/al-folio), Jekyll, and GitHub Pages.

## Current content

- About and academic interests
- Macroeconomics II teaching page
- Fall 2026 lecture slides and closed-economy notes
- Initial placeholders for research and independent projects

## Local preview

The recommended Windows workflow uses Docker:

```powershell
docker compose pull
docker compose up
```

The local site is then available at `http://localhost:8080`.

## Deployment

Changes pushed to `main` are built by the deployment workflow and published to the `gh-pages` branch. GitHub Pages should be configured to serve from `gh-pages` at the repository root.

For the first publication, create the empty public repository `arturolopezp/arturolopezp.github.io` and point this local clone to it:

```powershell
git remote set-url origin https://github.com/arturolopezp/arturolopezp.github.io.git
git add --all
git commit -m "Create academic website and Macroeconomics II course page"
git push -u origin main
```

## Course materials

Public course files are stored under `assets/pdf/teaching/`. Books, copyrighted reference articles, grades, attendance records, and private course administration files are intentionally excluded.
