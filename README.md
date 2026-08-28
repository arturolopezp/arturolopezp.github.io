# Arturo López - Academic Website

Source files for [arturolopezp.github.io](https://arturolopezp.github.io), an academic website for research, teaching materials, replication packages, and computational projects.

The site uses [al-folio](https://github.com/alshedivat/al-folio), Jekyll, and GitHub Pages.

## Local preview

The recommended Windows workflow uses Docker:

```powershell
docker compose pull
docker compose up
```

The local site is then available at `http://localhost:8080`.

## Deployment

Changes pushed to `main` are built by the deployment workflow and published to the `gh-pages` branch. GitHub Pages should be configured to serve from `gh-pages` at the repository root.
