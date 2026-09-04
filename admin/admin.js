import { Repo, GitHubError } from "./github.js";
import { buildAll } from "./templates.js";

const SITE_URL = "https://erdankud.github.io/my_portfolio/";
const STORE = "portfolio.admin";

const state = {
  repo: null,
  content: null,
  baseline: null, // content as last loaded/published, to detect real edits
  headSha: null, // repo tip when content was loaded, guards concurrent writes
  uploads: {}, // path -> { base64, name, size }
  dirty: false,
};

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  for (const c of [].concat(children)) {
    if (c != null) node.append(c);
  }
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
  const next = { ...savedSettings(), ...patch };
  try {
    localStorage.setItem(STORE, JSON.stringify(next));
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

  if (!owner || !repo || !token) {
    return setStatus("connect", "Fill in owner, repository and token.", "error");
  }

  setStatus("connect", "Checking the token…", "busy");
  const client = new Repo({ token, owner, repo, branch });

  try {
    const info = await client.verify();
    const raw = await client.readFile("content.json");
    state.repo = client;
    state.content = JSON.parse(raw);
    state.baseline = JSON.parse(raw);
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
  state.repo = null;
  state.content = null;
  state.dirty = false;
  state.uploads = {};
  document.body.dataset.connected = "false";
  $("#f-token").value = "";
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
  state.dirty = hasChanges();
  $("#publish").disabled = !state.dirty;
  $("#dirty-flag").hidden = !state.dirty;
}

function hasChanges() {
  return (
    JSON.stringify(state.content) !== JSON.stringify(state.baseline) ||
    Object.keys(state.uploads).length > 0
  );
}

/** A labelled text input or textarea bound to obj[key]. */
function field(label, obj, key, { multiline = false, rows = 3, hint = "" } = {}) {
  const id = `fld-${Math.random().toString(36).slice(2, 9)}`;
  const input = multiline
    ? el("textarea", { id, rows, value: obj[key] ?? "" })
    : el("input", { id, type: "text", value: obj[key] ?? "" });
  input.addEventListener("input", () => {
    obj[key] = input.value;
    markDirty();
  });
  return el("div", { className: "field" }, [
    el("label", { htmlFor: id, textContent: label }),
    input,
    hint ? el("p", { className: "hint", textContent: hint }) : null,
  ]);
}

/** Editable list of plain strings (paragraphs, bullet points). */
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
            el(
              "button",
              {
                type: "button",
                className: "icon danger",
                title: "Delete",
                textContent: "×",
                onclick: () => {
                  items.splice(i, 1);
                  markDirty();
                  draw();
                },
              }
            ),
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
  return el("div", { className: "field" }, [
    el("label", { textContent: label }),
    wrap,
  ]);
}

function moveBtn(arr, i, delta, redraw) {
  const target = i + delta;
  return el("button", {
    type: "button",
    className: "icon",
    title: delta < 0 ? "Move up" : "Move down",
    textContent: delta < 0 ? "↑" : "↓",
    disabled: target < 0 || target >= arr.length,
    onclick: () => {
      [arr[i], arr[target]] = [arr[target], arr[i]];
      markDirty();
      redraw();
    },
  });
}

/** File picker that stages an upload to be included in the next publish. */
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
    const pending = state.uploads[name];
    current.append(
      el("code", { textContent: name }),
      pending
        ? el("span", { className: "badge", textContent: "new file, not published yet" })
        : el("a", {
            href: SITE_URL + name,
            target: "_blank",
            rel: "noopener",
            textContent: "view",
          }),
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
    state.uploads[safe] = { base64: await toBase64(file), size: file.size };
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

/**
 * Editable list of objects (projects, jobs, degrees, skills).
 * `fields` builds the form for one item; `title` labels the collapsed row.
 */
function objectList(container, arr, { title, blank, fields }) {
  const draw = () => {
    container.replaceChildren();
    if (!arr.length) {
      container.append(
        el("p", { className: "muted empty", textContent: "Nothing here yet." })
      );
    }
    arr.forEach((item, i) => {
      const body = el("div", { className: "card-body" }, fields(item, draw));
      const card = el("details", { className: "card", open: false }, [
        el("summary", {}, [
          el("span", { className: "card-title", textContent: title(item) || "Untitled" }),
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
        body,
      ]);
      container.append(card);
    });
    container.append(
      el("button", {
        type: "button",
        className: "add",
        textContent: "+ Add",
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

/* -------------------------------------------------------------------- render */

function render() {
  const c = state.content;

  // Home
  const home = $("#panel-home");
  home.replaceChildren(
    field("Heading", c.home, "heading"),
    field("Intro (italic paragraph)", c.home, "intro", { multiline: true, rows: 4 }),
    field("Personal paragraph", c.home, "personal", { multiline: true, rows: 3 }),
    imageField("Photo", c.home, "photo", {
      hint: "Portrait works best — it is shown at the full width of the text column.",
    }),
    field("Photo alt text", c.home, "photoAlt", {
      hint: "Describes the photo for screen readers.",
    }),
    el("hr"),
    field("“Current Work” heading", c.home, "currentWorkHeading"),
    stringList("Current work paragraphs", c.home, "currentWork"),
    field("“Previous Work” heading", c.home, "previousWorkHeading"),
    stringList("Previous work paragraphs", c.home, "previousWork"),
    el("hr"),
    field("Contact heading (home page)", c.home, "contactHeading"),
    field("Contact heading (contact page)", c.contactPage, "heading")
  );

  // Projects
  objectList($("#panel-projects"), c.projects, {
    title: (p) => p.title,
    blank: {
      title: "",
      meta: "",
      description: "",
      image: "",
      imageAlt: "",
      caption: "",
      bullets: [],
    },
    fields: (p, redraw) => [
      withRename(field("Title", p, "title"), redraw),
      field("Meta line", p, "meta", { hint: "Role, dates — shown in small caps." }),
      field("Description", p, "description", { multiline: true, rows: 4 }),
      imageField("Screenshot", p, "image"),
      field("Image alt text", p, "imageAlt"),
      field("Image caption", p, "caption"),
      stringList("Bullet points", p, "bullets"),
    ],
  });

  // Experience
  objectList($("#panel-experience"), c.experience, {
    title: (j) => j.title,
    blank: {
      title: "",
      meta: "",
      description: "",
      image: "",
      imageAlt: "",
      caption: "",
      bullets: [],
    },
    fields: (j, redraw) => [
      withRename(field("Company", j, "title"), redraw),
      field("Meta line", j, "meta", { hint: "Role — location — dates." }),
      field("Description", j, "description", { multiline: true, rows: 3 }),
      imageField("Image (optional)", j, "image"),
      field("Image alt text", j, "imageAlt"),
      field("Image caption", j, "caption"),
      stringList("Bullet points", j, "bullets"),
    ],
  });

  // Education
  objectList($("#panel-education"), c.education, {
    title: (e) => e.degree,
    blank: { degree: "", school: "", details: "" },
    fields: (e, redraw) => [
      withRename(field("Degree", e, "degree"), redraw),
      field("School", e, "school"),
      field("Details", e, "details", { multiline: true, rows: 3 }),
    ],
  });

  // Skills
  objectList($("#panel-skills"), c.skills, {
    title: (s) => s.category,
    blank: { category: "", text: "" },
    fields: (s, redraw) => [
      withRename(field("Category", s, "category"), redraw),
      field("Skills", s, "text", { multiline: true, rows: 3 }),
    ],
  });

  // Site
  $("#panel-site").replaceChildren(
    field("Name", c.site, "name", { hint: "Shown in the nav and page titles." }),
    field("Email", c.site, "email"),
    field("LinkedIn URL", c.site, "linkedin"),
    imageField("CV file", c.site, "cvFile", { accept: ".pdf,application/pdf" }),
    field("Copyright line", c.site, "copyright"),
    el("hr"),
    field("Work page heading", c.work, "heading"),
    field("Projects section heading", c.work, "projectsHeading"),
    field("Experience section heading", c.work, "experienceHeading"),
    field("Education section heading", c.work, "educationHeading"),
    field("Skills section heading", c.work, "skillsHeading")
  );

  markDirty();
}

/** Keep the collapsed row label in step with the title field as it is typed. */
function withRename(fieldEl, redraw) {
  const input = fieldEl.querySelector("input");
  let timer;
  input?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const card = fieldEl.closest("details");
      const label = card?.querySelector(".card-title");
      if (label) label.textContent = input.value || "Untitled";
    }, 200);
  });
  return fieldEl;
}

/* -------------------------------------------------------------------- actions */

function preview() {
  const files = buildAll(state.content);
  const which = $("#preview-page").value;
  // Uploaded images are not in the repo yet; show them from the local file data.
  let html = files[which].replace(
    /<head>/,
    `<head><base href="${SITE_URL}">`
  );
  for (const [name, up] of Object.entries(state.uploads)) {
    const mime = name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    html = html.replaceAll(`"${name}"`, `"data:${mime};base64,${up.base64}"`);
  }
  $("#preview-frame").srcdoc = html;
  $("#preview-dialog").showModal();
}

async function publish() {
  if (!state.dirty) return;
  const message =
    $("#commit-message").value.trim() || "Update site content from the admin panel";

  setStatus("publish", "Publishing…", "busy");
  $("#publish").disabled = true;

  try {
    const generated = buildAll(state.content);
    const files = {};
    for (const [path, text] of Object.entries(generated)) files[path] = { text };
    for (const [path, up] of Object.entries(state.uploads))
      files[path] = { base64: up.base64 };

    const sha = await state.repo.commitFiles(files, message, state.headSha);

    state.baseline = structuredClone(state.content);
    state.uploads = {};
    state.headSha = sha;
    $("#commit-message").value = "";
    markDirty();
    render();
    setStatus(
      "publish",
      "Published. GitHub Pages usually rebuilds within a minute.",
      "ok"
    );
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
  setStatus(
    "publish",
    pending.length
      ? `Downloaded 4 files. Note: the images you added (${pending.join(", ")}) are not included — add them to the repository yourself.`
      : "Downloaded 4 files. Commit them to the repository to go live.",
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
  $("#close-preview").addEventListener("click", () =>
    $("#preview-dialog").close()
  );
  $("#site-link").href = SITE_URL;

  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".tab, .panel")
        .forEach((n) => n.classList.remove("active"));
      tab.classList.add("active");
      $(`#panel-${tab.dataset.panel}`).classList.add("active");
    });
  }

  window.addEventListener("beforeunload", (e) => {
    if (state.dirty) e.preventDefault();
  });
}

init();
