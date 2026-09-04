// Builds the public HTML pages from content.json.
//
// The site stays plain static HTML on purpose: the pages you publish contain the
// real text, so they load with no JavaScript, index normally, and never flash
// empty while content is fetched. This file is the only place the markup lives,
// so a layout change is made here once and re-applied to every page on save.

// Bump this whenever style.css changes, so browsers fetch the new file instead
// of a cached copy. GitHub Pages serves the stylesheet with a long cache life.
const CSS_VERSION = 3;

const ICON = {
  linkedin:
    '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>',
  email:
    '<path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>',
  download: '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>',
};

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

function svg(name, size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">${ICON[name]}</svg>`;
}

function head(title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css?v=${CSS_VERSION}">
</head>
<body>

    <nav>
        <a href="work.html">Work</a>
        <a href="index.html" class="nav-center">${esc(title === "Erdan Kudaibergen" ? title : nameFromTitle(title))}</a>
        <a href="contact.html">Contact</a>
    </nav>
`;
}

function nameFromTitle(title) {
  const parts = String(title).split("—");
  return parts[parts.length - 1].trim();
}

function footer(site) {
  return `
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
`;
}

function paragraphs(list) {
  return (list || [])
    .filter((p) => String(p).trim())
    .map((p) => `        <p>\n            ${esc(p)}\n        </p>`)
    .join("\n");
}

/** A project or job entry: title, meta line, description, optional image, bullets. */
function entry(item) {
  const out = [`        <div class="work-item">`];
  out.push(`            <h3>${esc(item.title)}</h3>`);
  if (String(item.meta || "").trim()) {
    out.push(`            <p class="work-meta">${esc(item.meta)}</p>`);
  }
  if (String(item.description || "").trim()) {
    out.push(`            <p>`);
    out.push(`                ${esc(item.description)}`);
    out.push(`            </p>`);
  }
  if (String(item.image || "").trim()) {
    out.push(`            <figure class="project-shot">`);
    out.push(
      `                <img src="${escAttr(item.image)}" alt="${escAttr(item.imageAlt || item.title)}">`
    );
    if (String(item.caption || "").trim()) {
      out.push(`                <figcaption>${esc(item.caption)}</figcaption>`);
    }
    out.push(`            </figure>`);
  }
  const bullets = (item.bullets || []).filter((b) => String(b).trim());
  if (bullets.length) {
    out.push(`            <ul>`);
    for (const b of bullets) out.push(`                <li>${esc(b)}</li>`);
    out.push(`            </ul>`);
  }
  out.push(`        </div>`);
  return out.join("\n");
}

export function buildIndex(c) {
  const { site, home } = c;
  return (
    head(site.name) +
    `
    <div class="side-nav">
        <a href="#intro" title="Intro"></a>
        <a href="#current-work" title="Work"></a>
    </div>

    <section class="hero" id="intro">
        <div class="hero-content">
            <div class="hero-text">
                <h1>${esc(home.heading)}</h1>
                <p class="intro">
                    ${esc(home.intro)}
                </p>
                <p class="personal">
                    ${esc(home.personal)}
                </p>
            </div>
            <div class="hero-photo">
                <img src="${escAttr(home.photo)}" alt="${escAttr(home.photoAlt)}">
            </div>
        </div>
    </section>

    <div class="section-divider"></div>

    <section id="current-work">
        <h2>${esc(home.currentWorkHeading)}</h2>
${paragraphs(home.currentWork)}
        <a href="work.html" class="btn">See My Work</a>

        <h3>${esc(home.previousWorkHeading)}</h3>
${paragraphs(home.previousWork)}
        <a href="work.html" class="btn">See All Work</a>
    </section>

    <div class="section-divider"></div>

    <section class="contact-cta" id="contact">
        <h2>${esc(home.contactHeading)}</h2>
        <div class="contact-links">
            <a href="${escAttr(site.cvFile)}" class="contact-link" download>
                ${svg("download", 18)}
                Download CV
            </a>
        </div>
    </section>
` +
    footer(site) +
    `
    <script>
        const sections = document.querySelectorAll('section');
        const dots = document.querySelectorAll('.side-nav a');
        function updateActiveDot() {
            let current = '';
            sections.forEach(section => {
                const top = section.offsetTop - 200;
                if (window.scrollY >= top) {
                    current = section.getAttribute('id');
                }
            });
            dots.forEach(dot => {
                dot.classList.remove('active');
                if (dot.getAttribute('href') === '#' + current) {
                    dot.classList.add('active');
                }
            });
        }
        window.addEventListener('scroll', updateActiveDot);
        updateActiveDot();
    </script>
</body>
</html>
`
  );
}

export function buildWork(c) {
  const { site, work } = c;
  const projects = (c.projects || []).map(entry).join("\n\n");
  const experience = (c.experience || []).map(entry).join("\n\n");

  const education = (c.education || [])
    .map(
      (e) => `        <div class="edu-item">
            <h3>${esc(e.degree)}</h3>
            <p class="edu-school">${esc(e.school)}</p>
            <p class="edu-details">${esc(e.details)}</p>
        </div>`
    )
    .join("\n\n");

  const skills = (c.skills || [])
    .map(
      (s) => `            <div class="skill-category">
                <h4>${esc(s.category)}</h4>
                <p>${esc(s.text)}</p>
            </div>`
    )
    .join("\n");

  let body = `
    <div class="page-header">
        <h1>${esc(work.heading)}</h1>
    </div>

    <div class="work-section">
`;

  if (projects) {
    body += `
        <h2>${esc(work.projectsHeading)}</h2>

${projects}
`;
  }
  if (experience) {
    body += `
        <h2>${esc(work.experienceHeading)}</h2>

${experience}
`;
  }
  if (education) {
    body += `
        <h2>${esc(work.educationHeading)}</h2>

${education}
`;
  }
  if (skills) {
    body += `
        <h2>${esc(work.skillsHeading)}</h2>

        <div class="skills-grid">
${skills}
        </div>
`;
  }

  body += `
    </div>
`;

  return head(`My Work — ${site.name}`) + body + footer(site) + `
</body>
</html>
`;
}

export function buildContact(c) {
  const { site, contactPage } = c;
  return (
    head(`Contact — ${site.name}`) +
    `
    <div class="contact-page">
        <h1>${esc(contactPage.heading)}</h1>

        <div class="contact-links">
            <a href="${escAttr(site.linkedin)}" class="contact-link" target="_blank" rel="noopener">
                ${svg("linkedin", 18)}
                LinkedIn
            </a>
            <a href="mailto:${escAttr(site.email)}" class="contact-link">
                ${svg("email", 18)}
                Email Me
            </a>
            <a href="${escAttr(site.cvFile)}" class="contact-link" download>
                ${svg("download", 18)}
                Download CV
            </a>
        </div>
    </div>
` +
    footer(site) +
    `
</body>
</html>
`
  );
}

/** Every generated file, keyed by the path it is written to in the repo. */
export function buildAll(content) {
  return {
    "index.html": buildIndex(content),
    "work.html": buildWork(content),
    "contact.html": buildContact(content),
    "content.json": JSON.stringify(content, null, 2) + "\n",
  };
}
