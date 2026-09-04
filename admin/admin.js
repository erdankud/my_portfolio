import { Repo, GitHubError } from "./github.js";
import { buildAll, slugify, detailPath, hasDetail, COLLECTIONS } from "./templates.js";

const SITE_URL = "https://erdankud.github.io/my_portfolio/";
const STORE = "portfolio.admin";

const state = {
  repo: null,
  content: null,
  baseline: null, // content as last loaded/published, to detect real edits
  headSha: null, // repo tip when content was loaded, guards concurrent writes
  uploads: {}, // path -> { base64 }
  dirty: false,
};

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const c of [].concat(children)) if (c != null) node.append(c);
  return node;
};

/* ---------------------------------------------------------------- connection */

function savedSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "{}");
  } catch {
    return {};
  }
}

function saveSettings(patch) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ ...savedSettings(), ...patch }));
  } catch {
    /* private mode — the panel still works for this session */
  }
}

async function connect(ev) {
  ev?.preventDefault();
  const owner = $("#f-owner").value.trim();
  const repo = $("#f-repo").value.trim();
  const branch = $("#f-branch").value.trim() || "main";
  const token = $("#f-token").value.trim();
  const remember = $("#f-remember").checked;

  if (!owner || !repo || !token)
    return setStatus("connect", "Fill in owner, repository and token.", "error");

  setStatus("connect", "Checking the token…", "busy");
  const client = new Repo({ token, owner, repo, branch });

  try {
    const info = await client.verify();
    const raw = await client.readFile("content.json");
    state.repo = client;
    state.content = migrate(JSON.parse(raw));
    state.baseline = structuredClone(state.content);
    state.headSha = await client.headSha();
    state.uploads = {};
    state.dirty = false;

    saveSettings({ owner, repo, branch, token: remember ? token : "" });
    $("#connected-as").textContent = `${info.fullName} · ${branch}`;
    document.body.dataset.connected = "true";
    setStatus("connect", "", "");
    render();
  } catch (err) {
    setStatus("connect", describe(err), "error");
  }
}

function disconnect() {
  if (state.dirty && !confirm("You have unpublished changes. Disconnect anyway?"))
    return;
  saveSettings({ token: "" });
  Object.assign(state, { repo: null, content: null, dirty: false, uploads: {} });
  document.body.dataset.connected = "false";
  $("#f-token").value = "";
}

/** Fill in anything a hand-edited or older content.json is missing. */
function migrate(c) {
  c.collections ||= {};
  for (const id of COLLECTIONS) {
    const col = (c.collections[id] ||= {});
    col.navLabel ||= id[0].toUpperCase() + id.slice(1);
    col.heading ||= col.navLabel;
    col.intro ??= "";
    col.groups ||= [];
    col.items ||= [];
    for (const item of col.items) {
      item.slug ||= slugify(item.title || "item");
      item.group ??= "";
      item.meta ??= "";
      item.summary ??= "";
      item.image ??= "";
      item.imageAlt ??= "";
      item.tagline ??= "";
      item.sections ||= [];
      for (const s of item.sections) {
        s.heading ??= "";
        s.paragraphs ||= [];
        s.bullets ||= [];
        s.image ??= "";
        s.imageAlt ??= "";
        s.caption ??= "";
      }
    }
  }
  return c;
}

function describe(err) {
  if (err instanceof GitHubError) return err.message;
  if (err instanceof SyntaxError)
    return "content.json in the repository is not valid JSON, so it could not be loaded.";
  if (err instanceof TypeError)
    return "Could not reach GitHub. Check the network connection.";
  return err.message || String(err);
}

/* --------------------------------------------------------------- form pieces */

function markDirty() {
  state.dirty =
    JSON.stringify(state.content) !== JSON.stringify(state.baseline) ||
    Object.keys(state.uploads).length > 0;
  $("#publish").disabled = !state.dirty;
  $("#dirty-flag").hidden = !state.dirty;
  // Adding a section creates a detail page; the preview list and the
  // "has detail page" labels have to follow, or the page you just created
  // cannot be previewed and the card still reads "card only".
  refreshPreviewOptions();
  for (const node of document.querySelectorAll(".card-sub"))
    if (node.__refresh) node.textContent = node.__refresh();
}

function field(label, obj, key, { multiline = false, rows = 3, hint = "", onInput } = {}) {
  const id = `f${Math.random().toString(36).slice(2, 9)}`;
  const input = multiline
    ? el("textarea", { id, rows, value: obj[key] ?? "" })
    : el("input", { id, type: "text", value: obj[key] ?? "" });
  input.addEventListener("input", () => {
    obj[key] = input.value;
    markDirty();
    onInput?.(input.value);
  });
  return el("div", { className: "field" }, [
    el("label", { htmlFor: id, textContent: label }),
    input,
    hint ? el("p", { className: "hint", textContent: hint }) : null,
  ]);
}

function selectField(label, obj, key, options, { hint = "" } = {}) {
  const id = `f${Math.random().toString(36).slice(2, 9)}`;
  const sel = el("select", { id });
  for (const o of options)
    sel.append(el("option", { value: o.value, textContent: o.label, selected: obj[key] === o.value }));
  sel.addEventListener("change", () => {
    obj[key] = sel.value;
    markDirty();
  });
  return el("div", { className: "field" }, [
    el("label", { htmlFor: id, textContent: label }),
    sel,
    hint ? el("p", { className: "hint", textContent: hint }) : null,
  ]);
}

function stringList(label, obj, key, { placeholder = "", rows = 2 } = {}) {
  const wrap = el("div", { className: "sublist" });
  const draw = () => {
    wrap.replaceChildren();
    const items = (obj[key] ||= []);
    items.forEach((value, i) => {
      const ta = el("textarea", { rows, value, placeholder });
      ta.addEventListener("input", () => {
        items[i] = ta.value;
        markDirty();
      });
      wrap.append(
        el("div", { className: "sublist-row" }, [
          ta,
          el("div", { className: "row-tools" }, [
            moveBtn(items, i, -1, draw),
            moveBtn(items, i, +1, draw),
            el("button", {
              type: "button",
              className: "icon danger",
              title: "Delete",
              textContent: "×",
              onclick: () => {
                items.splice(i, 1);
                markDirty();
                draw();
              },
            }),
          ]),
        ])
      );
    });
    wrap.append(
      el("button", {
        type: "button",
        className: "add small",
        textContent: "+ Add",
        onclick: () => {
          items.push("");
          markDirty();
          draw();
        },
      })
    );
  };
  draw();
  return el("div", { className: "field" }, [el("label", { textContent: label }), wrap]);
}

function moveBtn(arr, i, delta, redraw) {
  const target = i + delta;
  return el("button", {
    type: "button",
    className: "icon",
    title: delta < 0 ? "Move up" : "Move down",
    textContent: delta < 0 ? "↑" : "↓",
    disabled: target < 0 || target >= arr.length,
    onclick: (e) => {
      e.preventDefault();
      [arr[i], arr[target]] = [arr[target], arr[i]];
      markDirty();
      redraw();
    },
  });
}

function imageField(label, obj, key, { accept = "image/*", hint = "" } = {}) {
  const current = el("div", { className: "file-current" });
  const input = el("input", { type: "file", accept });

  const refresh = () => {
    current.replaceChildren();
    const name = obj[key];
    if (!name) {
      current.append(el("span", { className: "muted", textContent: "None" }));
      return;
    }
    current.append(
      el("code", { textContent: name }),
      state.uploads[name]
        ? el("span", { className: "badge", textContent: "new file, not published yet" })
        : el("a", { href: SITE_URL + name, target: "_blank", rel: "noopener", textContent: "view" }),
      el("button", {
        type: "button",
        className: "icon danger",
        title: "Remove",
        textContent: "×",
        onclick: () => {
          delete state.uploads[obj[key]];
          obj[key] = "";
          markDirty();
          refresh();
        },
      })
    );
  };

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert("That file is larger than 20 MB. Please use a smaller one.");
      input.value = "";
      return;
    }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    obj[key] = safe;
    state.uploads[safe] = { base64: await toBase64(file) };
    input.value = "";
    markDirty();
    refresh();
  });

  refresh();
  return el("div", { className: "field" }, [
    el("label", { textContent: label }),
    current,
    input,
    hint ? el("p", { className: "hint", textContent: hint }) : null,
  ]);
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

/** Editable list of objects, rendered as collapsible cards. */
function objectList(container, arr, { title, subtitle, blank, fields, addLabel = "+ Add" }) {
  const draw = () => {
    container.replaceChildren();
    if (!arr.length)
      container.append(el("p", { className: "muted empty", textContent: "Nothing here yet." }));

    arr.forEach((item, i) => {
      const subNode = subtitle
        ? el("span", { className: "card-sub", textContent: subtitle(item) })
        : null;
      // Remember how to recompute the label so an edit deeper in the card
      // (adding a section, say) can refresh it without a full redraw.
      if (subNode) subNode.__refresh = () => subtitle(item);

      container.append(
        el("details", { className: "card" }, [
          el("summary", {}, [
            el("span", { className: "card-title", textContent: title(item) || "Untitled" }),
            subNode,
            el("span", { className: "row-tools" }, [
              moveBtn(arr, i, -1, draw),
              moveBtn(arr, i, +1, draw),
              el("button", {
                type: "button",
                className: "icon danger",
                title: "Delete",
                textContent: "×",
                onclick: (e) => {
                  e.preventDefault();
                  if (!confirm(`Delete "${title(item) || "this entry"}"?`)) return;
                  arr.splice(i, 1);
                  markDirty();
                  draw();
                },
              }),
            ]),
          ]),
          el("div", { className: "card-body" }, fields(item, draw)),
        ])
      );
    });

    container.append(
      el("button", {
        type: "button",
        className: "add",
        textContent: addLabel,
        onclick: () => {
          arr.push(structuredClone(blank));
          markDirty();
          draw();
          container.querySelector("details:last-of-type")?.setAttribute("open", "");
        },
      })
    );
  };
  draw();
}

/** Keep a collapsed card's label in step with its title field. */
function liveLabel(fieldEl, getText) {
  const input = fieldEl.querySelector("input");
  let timer;
  input?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const label = fieldEl.closest("details")?.querySelector(".card-title");
      if (label) label.textContent = getText() || "Untitled";
    }, 200);
  });
  return fieldEl;
}

/* -------------------------------------------------------------------- render */

const BLANK_SECTION = {
  heading: "",
  paragraphs: [],
  bullets: [],
  image: "",
  imageAlt: "",
  caption: "",
};

const BLANK_ITEM = {
  slug: "",
  group: "",
  title: "",
  meta: "",
  summary: "",
  image: "",
  imageAlt: "",
  tagline: "",
  sections: [],
};

/** The editor for one item: card fields, then the detail page's sections. */
function itemFields(collectionId, col, item, redraw) {
  const slugHint = el("p", { className: "hint" });
  const updateSlugHint = () => {
    slugHint.textContent = hasDetail(item)
      ? `Detail page: ${detailPath(collectionId, item.slug || "…")}`
      : "No detail page yet — add a section below and a Learn More link appears on the card.";
  };
  updateSlugHint();

  const slugField = field("Page address (slug)", item, "slug", {
    hint: "Letters, digits and hyphens.",
  });
  slugField.querySelector("input").addEventListener("input", updateSlugHint);

  const titleField = field("Title", item, "title", {
    onInput: (v) => {
      // Only auto-fill the slug while it is still empty, so a published
      // address is never silently changed underneath a link.
      if (!item.slug) {
        item.slug = slugify(v);
        slugField.querySelector("input").value = item.slug;
        updateSlugHint();
      }
    },
  });
  liveLabel(titleField, () => item.title);

  const parts = [
    titleField,
    slugField,
    slugHint,
  ];

  if ((col.groups || []).length) {
    parts.push(
      selectField(
        "Group",
        item,
        "group",
        [{ value: "", label: "— none —" }].concat(
          col.groups.map((g) => ({ value: g.id, label: g.heading || g.id }))
        ),
        { hint: "Which heading this appears under on the index page." }
      )
    );
  }

  parts.push(
    field("Meta line", item, "meta", { hint: "Role, place, dates — shown in small caps." }),
    field("Card summary", item, "summary", {
      multiline: true,
      rows: 3,
      hint: "The short description on the index card. Keep it to two or three lines.",
    }),
    imageField("Card image", item, "image", {
      hint: "Shown on the card at a fixed 16:10 crop, and at the top of the detail page.",
    }),
    field("Image alt text", item, "imageAlt"),
    el("hr"),
    field("Tagline", item, "tagline", {
      hint: "The italic line under the title on the detail page.",
    }),
    el("p", { className: "section-label", textContent: "Detail page sections" })
  );

  const sectionsBox = el("div", { className: "nested" });
  objectList(sectionsBox, item.sections, {
    title: (s) => s.heading || "Section",
    blank: BLANK_SECTION,
    addLabel: "+ Add section",
    fields: (s, redrawSections) => [
      liveLabel(field("Section heading", s, "heading"), () => s.heading || "Section"),
      stringList("Paragraphs", s, "paragraphs", { rows: 3 }),
      stringList("Bullet points", s, "bullets"),
      imageField("Section image", s, "image"),
      field("Image alt text", s, "imageAlt"),
      field("Image caption", s, "caption"),
    ],
  });

  // Adding or removing a section flips whether a Learn More link exists.
  sectionsBox.addEventListener("click", () => setTimeout(updateSlugHint, 0));
  parts.push(sectionsBox);

  return parts;
}

function renderCollection(collectionId) {
  const col = state.content.collections[collectionId];
  const panel = $(`#panel-${collectionId}`);
  panel.replaceChildren();

  panel.append(
    el("details", { className: "card settings-card" }, [
      el("summary", {}, [el("span", { className: "card-title", textContent: "Page settings" })]),
      el("div", { className: "card-body" }, [
        field("Navigation label", col, "navLabel", { hint: "The word shown in the header." }),
        field("Page heading", col, "heading"),
        field("Page intro", col, "intro", {
          multiline: true,
          rows: 2,
          hint: "Optional paragraph under the heading.",
        }),
        el("p", { className: "section-label", textContent: "Groups" }),
        el("p", {
          className: "hint",
          textContent:
            "Optional headings that split the index page into sections. With no groups, all entries are listed together.",
        }),
        groupsEditor(col),
      ]),
    ])
  );

  const itemsBox = el("div");
  panel.append(itemsBox);

  const redraw = () => renderCollection(collectionId);
  objectList(itemsBox, col.items, {
    title: (it) => it.title,
    subtitle: (it) => (hasDetail(it) ? "has detail page" : "card only"),
    blank: BLANK_ITEM,
    addLabel: "+ Add entry",
    fields: (item) => itemFields(collectionId, col, item, redraw),
  });
}

function groupsEditor(col) {
  const box = el("div", { className: "nested" });
  const draw = () => {
    box.replaceChildren();
    col.groups.forEach((g, i) => {
      const heading = el("input", { type: "text", value: g.heading, placeholder: "Heading" });
      heading.addEventListener("input", () => {
        g.heading = heading.value;
        if (!g.id) g.id = slugify(heading.value);
        markDirty();
      });
      box.append(
        el("div", { className: "sublist-row" }, [
          heading,
          el("div", { className: "row-tools" }, [
            moveBtn(col.groups, i, -1, draw),
            moveBtn(col.groups, i, +1, draw),
            el("button", {
              type: "button",
              className: "icon danger",
              title: "Delete",
              textContent: "×",
              onclick: () => {
                if (
                  col.items.some((it) => it.group === g.id) &&
                  !confirm(
                    `Entries are still filed under "${g.heading}". They will be listed without a heading. Delete it?`
                  )
                )
                  return;
                col.groups.splice(i, 1);
                markDirty();
                draw();
              },
            }),
          ]),
        ])
      );
    });
    box.append(
      el("button", {
        type: "button",
        className: "add small",
        textContent: "+ Add group",
        onclick: () => {
          col.groups.push({ id: "group-" + (col.groups.length + 1), heading: "" });
          markDirty();
          draw();
        },
      })
    );
  };
  draw();
  return box;
}

function render() {
  const c = state.content;

  $("#panel-home").replaceChildren(
    field("Heading", c.home, "heading"),
    field("Intro (italic paragraph)", c.home, "intro", { multiline: true, rows: 4 }),
    field("Personal paragraph", c.home, "personal", { multiline: true, rows: 3 }),
    imageField("Photo", c.home, "photo", {
      hint: "Shown at the full width of the text column, so a wide or portrait image both work.",
    }),
    field("Photo alt text", c.home, "photoAlt", { hint: "Describes the photo for screen readers." }),
    el("hr"),
    field("First section heading", c.home, "currentWorkHeading"),
    stringList("First section paragraphs", c.home, "currentWork"),
    field("Second section heading", c.home, "previousWorkHeading"),
    stringList("Second section paragraphs", c.home, "previousWork"),
    el("hr"),
    field("Contact heading (home page)", c.home, "contactHeading"),
    field("Contact heading (contact page)", c.contactPage, "heading")
  );

  for (const id of COLLECTIONS) renderCollection(id);

  $("#panel-site").replaceChildren(
    field("Name", c.site, "name", { hint: "Shown in the nav and page titles." }),
    field("Email", c.site, "email"),
    field("LinkedIn URL", c.site, "linkedin"),
    imageField("CV file", c.site, "cvFile", { accept: ".pdf,application/pdf" }),
    field("Copyright line", c.site, "copyright")
  );

  refreshPreviewOptions();
  markDirty();
}

/* -------------------------------------------------------------------- actions */

/** The preview list has to follow the pages that actually exist now. */
function refreshPreviewOptions() {
  if (!state.content) return;
  const select = $("#preview-page");
  const previous = select.value;
  const pages = [
    { value: "index.html", label: "Home" },
    { value: "contact.html", label: "Contact" },
  ];
  for (const id of COLLECTIONS) {
    const col = state.content.collections[id];
    pages.push({ value: `${id}.html`, label: col.heading || id });
    for (const item of col.items)
      if (hasDetail(item))
        pages.push({
          value: detailPath(id, item.slug),
          label: `   ${col.navLabel} · ${item.title}`,
        });
  }
  select.replaceChildren(
    ...pages.map((p) => el("option", { value: p.value, textContent: p.label }))
  );
  if (pages.some((p) => p.value === previous)) select.value = previous;
}

function preview() {
  const files = buildAll(state.content);
  const which = $("#preview-page").value;
  if (!files[which]) return;

  // Uploaded images are not in the repo yet; show them from the local file data.
  let html = files[which].replace(/<head>/, `<head><base href="${SITE_URL}">`);
  for (const [name, up] of Object.entries(state.uploads)) {
    const ext = name.toLowerCase().split(".").pop();
    const mime =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    html = html.replaceAll(`"${name}"`, `"data:${mime};base64,${up.base64}"`);
  }
  $("#preview-frame").srcdoc = html;
  $("#preview-dialog").showModal();
}

/** Problems that would publish a broken site. */
function validate() {
  const problems = [];
  for (const id of COLLECTIONS) {
    const col = state.content.collections[id];
    const seen = new Map();
    for (const item of col.items) {
      const label = item.title || "(untitled)";
      if (!String(item.title || "").trim())
        problems.push(`${col.navLabel}: an entry has no title.`);
      if (hasDetail(item)) {
        if (!String(item.slug || "").trim())
          problems.push(`${col.navLabel} · ${label}: needs a page address.`);
        else if (seen.has(item.slug))
          problems.push(
            `${col.navLabel}: "${label}" and "${seen.get(item.slug)}" share the address "${item.slug}".`
          );
        else seen.set(item.slug, label);
      }
    }
  }
  return problems;
}

async function publish() {
  if (!state.dirty) return;

  const problems = validate();
  if (problems.length)
    return setStatus("publish", "Fix before publishing — " + problems.join(" "), "error");

  const message =
    $("#commit-message").value.trim() || "Update site content from the admin panel";

  setStatus("publish", "Publishing…", "busy");
  $("#publish").disabled = true;

  try {
    const generated = buildAll(state.content);
    const files = {};
    for (const [path, text] of Object.entries(generated)) files[path] = { text };
    for (const [path, up] of Object.entries(state.uploads)) files[path] = { base64: up.base64 };

    const sha = await state.repo.commitFiles(files, message, state.headSha);

    state.baseline = structuredClone(state.content);
    state.uploads = {};
    state.headSha = sha;
    $("#commit-message").value = "";
    render();
    setStatus("publish", "Published. GitHub Pages usually rebuilds within a minute.", "ok");
  } catch (err) {
    setStatus("publish", describe(err), "error");
    $("#publish").disabled = false;
  }
}

function downloadFiles() {
  const files = buildAll(state.content);
  for (const [name, text] of Object.entries(files)) {
    const blob = new Blob([text], {
      type: name.endsWith(".json") ? "application/json" : "text/html",
    });
    const a = el("a", { href: URL.createObjectURL(blob), download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
  const pending = Object.keys(state.uploads);
  const n = Object.keys(files).length;
  setStatus(
    "publish",
    pending.length
      ? `Downloaded ${n} files. The images you added (${pending.join(", ")}) are not included — add them to the repository yourself.`
      : `Downloaded ${n} files. Commit them to the repository to go live.`,
    "ok"
  );
}

function setStatus(where, text, kind) {
  const node = $(`#status-${where}`);
  node.textContent = text;
  node.className = `status ${kind}`;
  node.hidden = !text;
}

/* ----------------------------------------------------------------------- init */

function init() {
  const saved = savedSettings();
  $("#f-owner").value = saved.owner || "erdankud";
  $("#f-repo").value = saved.repo || "my_portfolio";
  $("#f-branch").value = saved.branch || "main";
  $("#f-token").value = saved.token || "";
  $("#f-remember").checked = Boolean(saved.token);

  $("#connect-form").addEventListener("submit", connect);
  $("#disconnect").addEventListener("click", disconnect);
  $("#publish").addEventListener("click", publish);
  $("#preview").addEventListener("click", preview);
  $("#download").addEventListener("click", downloadFiles);
  $("#preview-page").addEventListener("change", preview);
  $("#close-preview").addEventListener("click", () => $("#preview-dialog").close());
  $("#site-link").href = SITE_URL;

  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab, .panel").forEach((n) => n.classList.remove("active"));
      tab.classList.add("active");
      $(`#panel-${tab.dataset.panel}`).classList.add("active");
    });
  }

  window.addEventListener("beforeunload", (e) => {
    if (state.dirty) e.preventDefault();
  });
}

init();
