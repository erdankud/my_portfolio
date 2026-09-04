# Admin panel

Edits the site's content and publishes it, from the browser. Open it at
[/admin/](https://erdankud.github.io/my_portfolio/admin/).

## How it works

The site is hosted on GitHub Pages, which serves static files and runs no server
code. So the panel has no backend: it reads and writes the repository directly
through the GitHub API, using a token you paste in.

    content.json  ──▶  admin panel  ──▶  index.html
                                         work.html      ──▶  one commit
                                         contact.html
                                         content.json

`content.json` is the single source of content. The panel edits it, then
regenerates the three HTML pages from `templates.js` and commits everything
together in **one** commit — never file by file, so the site is never left half
updated if a request fails partway.

The published pages stay plain static HTML on purpose. They contain the real
text, so the site loads with no JavaScript, indexes normally, and never flashes
empty while content is fetched.

## The token

Create a **fine-grained** personal access token:

> GitHub → Settings → Developer settings → Personal access tokens →
> Fine-grained tokens → Generate new token

- **Repository access:** Only select repositories → `my_portfolio`
- **Permissions:** Repository permissions → **Contents: Read and write**

Nothing else. That token can write to this one repository and nothing else in
the account.

The panel keeps the token in your browser's `localStorage` and sends it only to
`api.github.com`. Untick *Stay signed in* on a shared computer.

The panel's page is publicly reachable — anything on GitHub Pages is — but it
does nothing without a token. Treat the token as the lock, not the URL. If it
ever leaks, revoke it on the tokens page; the panel needs no other cleanup.

## Editing without a token

The **Download files instead** button produces the same four files locally. Commit
them yourself and the result is identical. Images added in the panel are not
included in that download — add those to the repository yourself.

## Changing the layout

The markup lives in `templates.js` only. After editing it, open
[`verify.html`](verify.html) through a local web server:

    python3 -m http.server 8000
    # then open http://127.0.0.1:8000/admin/verify.html

It rebuilds all three pages from `content.json` and diffs them against the
published files. Use it before and after a change: a clean run before you start
proves the templates still match what is live, so any diff after your edit is
your change and nothing else.

When you edit `style.css`, bump `CSS_VERSION` in `templates.js`. GitHub Pages
serves the stylesheet with a long cache life, so without that bump browsers keep
using the old file.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The panel |
| `admin.js` | Forms, state, publish and preview |
| `admin.css` | Panel styling (not used by the public site) |
| `github.js` | GitHub API client — verify, read, single-commit write |
| `templates.js` | Generates the public HTML. The only place the markup lives |
| `verify.html` | Checks the templates still reproduce the published pages |
