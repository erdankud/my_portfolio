// Builds the public HTML pages from content.json.
//
// The site stays plain static HTML on purpose: the pages you publish contain the
// real text, so they load with no JavaScript, index normally, and never flash
// empty while content is fetched. This file is the only place the markup lives,
// so a layout change is made here once and re-applied to every page on save.
//
// Detail pages are written flat — work-pm-thinking-coach.html, not
// work/pm-thinking-coach.html — so every page sits beside style.css and the
// images, and one set of relative links works everywhere.

// Bump this whenever style.css changes, so browsers fetch the new file instead
// of a cached copy. GitHub Pages serves the stylesheet with a long cache life.
const CSS_VERSION = 9;

const FONTS =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..600&family=Karla:ital,wght@0,300..600;1,300..500&display=swap";

const ICON = {
  linkedin:
    '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>',
  email:
    '<path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>',
  download: '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>',
};

// Collections render as an index of cards plus a detail page per entry.
const COLLECTIONS = ["work", "education"];

// Skills is its own page: a rated list, not cards. It still sits in the nav.
const NAV_PAGES = [...COLLECTIONS, "skills"];

/** Escape text for use in HTML body content. */
export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape text for use inside a double-quoted HTML attribute. */
export function escAttr(value) {
  return esc(value).replace(/"/g, "&quot;");
}

/** Turn a title into a file-safe slug. Exported so the panel suggests the same. */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** The file a detail page is written to. */
export function detailPath(collectionId, slug) {
  return `${collectionId}-${slug}.html`;
}

/** An entry's own address on the web, if it has one. */
export function itemLink(item) {
  const href = String(item.link || "").trim();
  if (!href) return null;
  return { href, label: String(item.linkLabel || "").trim() || "Visit" };
}

/** An item earns a Learn More link only when there is a page worth opening. */
export function hasDetail(item) {
  return (item.sections || []).some(
    (s) =>
      String(s.heading || "").trim() ||
      (s.paragraphs || []).some((p) => String(p).trim()) ||
      (s.bullets || []).some((b) => String(b).trim()) ||
      String(s.image || "").trim()
  );
}

function svg(name, size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">${ICON[name]}</svg>`;
}

function navLabel(c, id) {
  if (id === "skills") return c.skillsPage?.navLabel || "Skills";
  return c.collections[id]?.navLabel || id;
}

function head(title, c) {
  const links = NAV_PAGES.map(
    (id) => `            <a href="${id}.html">${esc(navLabel(c, id))}</a>`
  ).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="${FONTS}" rel="stylesheet">
    <link rel="stylesheet" href="style.css?v=${CSS_VERSION}">
</head>
<body>

    <nav>
        <div class="nav-group nav-left">
${links}
        </div>
        <a href="index.html" class="nav-center">${esc(c.site.name)}</a>
        <div class="nav-group nav-right">
            <a href="contact.html">Contact</a>
        </div>
    </nav>

    <div class="page">
`;
}

function foot(site) {
  return `    </div>

    <footer>
        <div class="footer-links">
            <a href="${escAttr(site.linkedin)}" target="_blank" rel="noopener">
                ${svg("linkedin", 16)}
                LinkedIn
            </a>
            <a href="mailto:${escAttr(site.email)}">
                ${svg("email", 16)}
                ${esc(site.email)}
            </a>
        </div>
        <p class="copyright">${esc(site.copyright)}</p>
    </footer>

    <script src="transitions.js?v=${CSS_VERSION}"></script>
</body>
</html>
`;
}

function paragraphs(list, indent = "        ") {
  return (list || [])
    .filter((p) => String(p).trim())
    .map((p) => `${indent}<p>${esc(p)}</p>`)
    .join("\n");
}

/* ------------------------------------------------------------------ home */

export function buildIndex(c) {
  const { site, home } = c;
  return (
    head(site.name, c) +
    `
    <section class="hero">
        <h1>${esc(home.heading)}</h1>
        <p class="intro">${esc(home.intro)}</p>
        <p class="personal">${esc(home.personal)}</p>
        <div class="hero-photo">
            <img src="${escAttr(home.photo)}" alt="${escAttr(home.photoAlt)}">
        </div>
    </section>

    <hr class="rule">

    <section class="prose">
        <h2>${esc(home.currentWorkHeading)}</h2>
${paragraphs(home.currentWork)}
        <a href="work.html" class="btn">See My Work</a>

        <h2>${esc(home.previousWorkHeading)}</h2>
${paragraphs(home.previousWork)}
        <a href="work.html" class="btn">See All Work</a>
    </section>

    <hr class="rule">

    <section class="prose">
        <h2>${esc(home.contactHeading)}</h2>
        <div class="button-row">
            <a href="${escAttr(site.cvFile)}" class="btn" download>
                ${svg("download", 18)}
                Download CV
            </a>
            <a href="contact.html" class="btn btn-quiet">Contact Me</a>
        </div>
    </section>
` +
    foot(site)
  );
}

/* ------------------------------------------------- collection index pages */

/** One card: image on the left, title, summary and Learn More on the right. */
function card(collectionId, item) {
  const out = [`            <article class="card">`];

  if (String(item.image || "").trim()) {
    out.push(`                <div class="card-media">`);
    out.push(
      `                    <img src="${escAttr(item.image)}" alt="${escAttr(item.imageAlt || item.title)}" loading="lazy">`
    );
    out.push(`                </div>`);
  } else {
    out.push(`                <div class="card-media card-media-empty" aria-hidden="true"></div>`);
  }

  out.push(`                <div class="card-body">`);
  out.push(`                    <h3>${esc(item.title)}</h3>`);
  if (String(item.meta || "").trim())
    out.push(`                    <p class="card-meta">${esc(item.meta)}</p>`);
  if (String(item.summary || "").trim())
    out.push(`                    <p class="card-summary">${esc(item.summary)}</p>`);
  const link = itemLink(item);
  if (hasDetail(item) || link) {
    out.push(`                    <p class="card-links">`);
    if (hasDetail(item))
      out.push(
        `                        <a class="learn-more" href="${escAttr(detailPath(collectionId, item.slug))}">Learn More</a>`
      );
    if (link)
      out.push(
        `                        <a class="learn-more external" href="${escAttr(link.href)}" target="_blank" rel="noopener">${esc(link.label)}</a>`
      );
    out.push(`                    </p>`);
  }
  out.push(`                </div>`);
  out.push(`            </article>`);
  return out.join("\n");
}

export function buildCollection(c, collectionId) {
  const { site } = c;
  const col = c.collections[collectionId];
  const items = col.items || [];

  let body = `
    <header class="page-header">
        <h1>${esc(col.heading)}</h1>
${String(col.intro || "").trim() ? `        <p class="page-intro">${esc(col.intro)}</p>\n` : ""}    </header>

    <section class="cards">
`;

  const groups = (col.groups || []).filter((g) =>
    items.some((it) => it.group === g.id)
  );

  if (groups.length) {
    for (const g of groups) {
      body += `        <h2 class="group-heading">${esc(g.heading)}</h2>\n`;
      body += items
        .filter((it) => it.group === g.id)
        .map((it) => card(collectionId, it))
        .join("\n");
      body += "\n";
    }
    // Anything whose group was removed still needs to appear.
    const orphans = items.filter(
      (it) => !groups.some((g) => g.id === it.group)
    );
    if (orphans.length)
      body += orphans.map((it) => card(collectionId, it)).join("\n") + "\n";
  } else {
    body += items.map((it) => card(collectionId, it)).join("\n") + "\n";
  }

  body += `    </section>
`;

  return head(`${col.heading} — ${site.name}`, c) + body + foot(site);
}

/* --------------------------------------------------------- detail pages */

function section(s) {
  const out = [`        <section class="detail-section">`];
  if (String(s.heading || "").trim())
    out.push(`            <h2>${esc(s.heading)}</h2>`);
  const ps = paragraphs(s.paragraphs, "            ");
  if (ps) out.push(ps);

  const bullets = (s.bullets || []).filter((b) => String(b).trim());
  if (bullets.length) {
    out.push(`            <ul>`);
    for (const b of bullets) out.push(`                <li>${esc(b)}</li>`);
    out.push(`            </ul>`);
  }

  if (String(s.image || "").trim()) {
    out.push(`            <figure class="detail-figure">`);
    out.push(
      `                <img src="${escAttr(s.image)}" alt="${escAttr(s.imageAlt || s.heading || "")}" loading="lazy">`
    );
    if (String(s.caption || "").trim())
      out.push(`                <figcaption>${esc(s.caption)}</figcaption>`);
    out.push(`            </figure>`);
  }

  out.push(`        </section>`);
  return out.join("\n");
}

export function buildDetail(c, collectionId, item) {
  const { site } = c;
  const col = c.collections[collectionId];
  const link = itemLink(item);

  let body = `
    <header class="page-header detail-header">
        <a class="back-link" href="${collectionId}.html">← ${esc(col.heading)}</a>
        <h1>${esc(item.title)}</h1>
${String(item.tagline || "").trim() ? `        <p class="tagline">${esc(item.tagline)}</p>\n` : ""}${String(item.meta || "").trim() ? `        <p class="detail-meta">${esc(item.meta)}</p>\n` : ""}${
    link ? `        <a class="btn" href="${escAttr(link.href)}" target="_blank" rel="noopener">${esc(link.label)}</a>\n` : ""
  }    </header>
`;

  if (String(item.image || "").trim()) {
    body += `
    <figure class="detail-hero">
        <img src="${escAttr(item.image)}" alt="${escAttr(item.imageAlt || item.title)}">
${String(item.caption || "").trim() ? `        <figcaption>${esc(item.caption)}</figcaption>\n` : ""}    </figure>
`;
  }

  body += `
    <div class="detail-body">
${(item.sections || []).map(section).join("\n\n")}
    </div>

    <div class="detail-footer">
        <a class="btn btn-quiet" href="${collectionId}.html">← Back to ${esc(col.heading)}</a>
    </div>
`;

  return head(`${item.title} — ${site.name}`, c) + body + foot(site);
}

/* --------------------------------------------------------------- skills */

/**
 * One skill row. A level renders as a bar; without one the skill is a plain
 * name, because a 0–100 bar against "Jira" would be measuring nothing.
 */
function skillRow(skill) {
  const level = Number.isFinite(Number(skill.level)) && skill.level !== null && skill.level !== ""
    ? Math.max(0, Math.min(100, Math.round(Number(skill.level))))
    : null;

  if (level === null) {
    return `                <li class="skill-row skill-plain"><span class="skill-name">${esc(skill.name)}</span></li>`;
  }
  return `                <li class="skill-row">
                    <span class="skill-name">${esc(skill.name)}</span>
                    <span class="skill-meter" role="img" aria-label="${escAttr(skill.name)}: ${level} out of 100">
                        <span class="skill-fill" style="width:${level}%"></span>
                    </span>
                    <span class="skill-value">${level}</span>
                </li>`;
}

/** The levels in a category that are actually set, as numbers. */
export function ratedLevels(cat) {
  return (cat.skills || [])
    .filter((s) => String(s.name || "").trim())
    .map((s) => (s.level === null || s.level === "" ? NaN : Number(s.level)))
    .filter((n) => Number.isFinite(n));
}

/**
 * A category's rating is the mean of its skills, computed rather than stored.
 * A stored average is a second copy of the same fact, and the two drift apart
 * the first time a skill is edited and the average is not.
 */
export function categoryAverage(cat) {
  const levels = ratedLevels(cat);
  if (!levels.length) return null;
  return Math.round(levels.reduce((a, b) => a + b, 0) / levels.length);
}

/** Anchor for a category, so the summary at the top can jump to it. */
function categoryAnchor(cat) {
  return "d-" + (cat.id || slugify(cat.name || "group"));
}

function skillCategory(cat) {
  const skills = (cat.skills || []).filter((s) => String(s.name || "").trim());
  if (!skills.length) return "";
  const average = categoryAverage(cat);
  const rated = average !== null;

  const heading = rated
    ? `            <div class="skill-group-head">
                <h2>${esc(cat.name)}</h2>
                <span class="skill-average" aria-label="${escAttr(cat.name)} average: ${average} out of 100">${average}</span>
            </div>`
    : `            <div class="skill-group-head"><h2>${esc(cat.name)}</h2></div>`;

  return `        <section class="skill-group${rated ? "" : " skill-group-plain"}" id="${escAttr(categoryAnchor(cat))}">
${heading}
${String(cat.note || "").trim() ? `            <p class="skill-note">${esc(cat.note)}</p>\n` : ""}            <ul class="skill-list">
${skills.map(skillRow).join("\n")}
            </ul>
        </section>`;
}

/**
 * The ratings at a glance, above the detail. It doubles as navigation: on a
 * page this long, the summary is also how you reach a direction.
 */
function skillSummary(page) {
  const rated = (page.categories || [])
    .map((cat) => ({ cat, average: categoryAverage(cat) }))
    .filter((x) => x.average !== null);
  if (!rated.length) return "";

  const tiles = rated
    .map(
      ({ cat, average }) => `            <a class="summary-tile" href="#${escAttr(categoryAnchor(cat))}">
                <span class="summary-value">${average}</span>
                <span class="summary-name">${esc(cat.name)}</span>
            </a>`
    )
    .join("\n");

  return `        <nav class="skill-summary" aria-label="Ratings by direction">
${tiles}
        </nav>`;
}

export function buildSkills(c) {
  const { site } = c;
  const page = c.skillsPage || { heading: "Skills", categories: [] };
  const groups = (page.categories || []).map(skillCategory).filter(Boolean).join("\n\n");
  const summary = skillSummary(page);

  const body = `
    <header class="page-header">
        <h1>${esc(page.heading)}</h1>
${String(page.intro || "").trim() ? `        <p class="page-intro">${esc(page.intro)}</p>\n` : ""}${String(page.note || "").trim() ? `        <p class="skill-scale">${esc(page.note)}</p>\n` : ""}    </header>

    <div class="skills-page">
${summary ? summary + "\n\n" : ""}${groups}
    </div>
`;

  return head(`${page.heading} — ${site.name}`, c) + body + foot(site);
}

/* -------------------------------------------------------------- contact */

export function buildContact(c) {
  const { site, contactPage } = c;
  return (
    head(`Contact — ${site.name}`, c) +
    `
    <header class="page-header">
        <h1>${esc(contactPage.heading)}</h1>
    </header>

    <section class="prose">
        <div class="button-row">
            <a href="${escAttr(site.linkedin)}" class="btn" target="_blank" rel="noopener">
                ${svg("linkedin", 18)}
                LinkedIn
            </a>
            <a href="mailto:${escAttr(site.email)}" class="btn">
                ${svg("email", 18)}
                Email Me
            </a>
            <a href="${escAttr(site.cvFile)}" class="btn" download>
                ${svg("download", 18)}
                Download CV
            </a>
        </div>
    </section>
` +
    foot(site)
  );
}

/* ------------------------------------------------------------------ all */

/** Every generated file, keyed by the path it is written to in the repo. */
export function buildAll(content) {
  const files = {
    "index.html": buildIndex(content),
    "contact.html": buildContact(content),
    "skills.html": buildSkills(content),
    "content.json": JSON.stringify(content, null, 2) + "\n",
  };

  for (const id of COLLECTIONS) {
    files[`${id}.html`] = buildCollection(content, id);
    for (const item of content.collections[id].items || []) {
      if (hasDetail(item))
        files[detailPath(id, item.slug)] = buildDetail(content, id, item);
    }
  }
  return files;
}

export { COLLECTIONS, NAV_PAGES };
