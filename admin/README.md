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
regenerates every HTML page from `templates.js` and commits everything together
in **one** commit — never file by file, so the site is never left half updated
if a request fails partway.

## Pages

Two collections — **Work** and **Education** — share one shape.
Each produces an index page of cards, plus a detail page for any entry that has
something to show:

    work.html                     index of cards
    work-pm-thinking-coach.html   detail page for one entry
    education.html

Detail pages are written flat (`work-<slug>.html`, not `work/<slug>.html`) so
every page sits beside `style.css` and the images, and one set of relative links
works from everywhere.

**Skills** is not a collection. It is one page of rated skills, edited on its own
tab: categories of skills, each skill carrying a level from 0 to 100. Leave a
level blank and the skill is listed without a bar — right for a tool or a
language, where a score would be measuring nothing. Each category has a control
that sets or clears every level in it at once, because filling seventy of them
one at a time is the difference between using this and not bothering.

An entry gets a **Learn More** link only once it has at least one section with
content. Until then it is a card and nothing more — better than a link to an
empty page. The panel shows which state an entry is in next to its name.

Changing an entry's slug changes its page address, so any link you have shared
to the old address stops working. The panel fills the slug in from the title
only while it is still blank, and never rewrites one you already published.

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
| `generate.html` | Rebuilds every page from content.json, for hand edits |
