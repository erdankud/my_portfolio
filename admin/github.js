// Minimal GitHub client for publishing the site from the browser.
//
// Everything a save touches — the three HTML pages, content.json, any uploaded
// image — goes up as ONE commit via the Git Data API. Writing the files one at a
// time through /contents would leave the site half-updated if a later call
// failed, and would litter the history with four commits per edit.

const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

export class Repo {
  constructor({ token, owner, repo, branch = "main" }) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
  }

  get base() {
    return `${API}/repos/${this.owner}/${this.repo}`;
  }

  async call(path, options = {}) {
    const res = await fetch(path.startsWith("http") ? path : this.base + path, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.json()).message || "";
      } catch {
        /* response had no JSON body */
      }
      throw new GitHubError(
        friendlyError(res.status, detail, this),
        res.status
      );
    }
    return res.status === 204 ? null : res.json();
  }

  /** Confirm the token works and can actually write here, before any edit is made. */
  async verify() {
    const repo = await this.call("");
    if (!repo.permissions?.push) {
      throw new GitHubError(
        "This token can read the repository but not write to it. Give it Contents: Read and write.",
        403
      );
    }
    return { fullName: repo.full_name, defaultBranch: repo.default_branch };
  }

  /** Read one text file at the tip of the branch. */
  async readFile(path) {
    const data = await this.call(
      `/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(this.branch)}`
    );
    const bytes = Uint8Array.from(atob(data.content.replace(/\n/g, "")), (ch) =>
      ch.charCodeAt(0)
    );
    return new TextDecoder().decode(bytes);
  }

  async headSha() {
    const ref = await this.call(
      `/git/ref/heads/${encodeURIComponent(this.branch)}`
    );
    return ref.object.sha;
  }

  async createBlob(content, encoding) {
    const blob = await this.call("/git/blobs", {
      method: "POST",
      body: JSON.stringify({ content, encoding }),
    });
    return blob.sha;
  }

  /**
   * Commit a set of files together.
   * `files` maps repo path -> { text } or { base64 } for binary uploads.
   * `expectedHead` guards against overwriting a change made elsewhere.
   */
  async commitFiles(files, message, expectedHead = null) {
    const head = await this.headSha();
    if (expectedHead && head !== expectedHead) {
      throw new GitHubError(
        "The repository changed since this page loaded, so publishing was stopped to avoid overwriting that change. Reload the panel and redo this edit.",
        409
      );
    }

    const commit = await this.call(`/git/commits/${head}`);
    const baseTree = commit.tree.sha;

    const tree = [];
    for (const [path, file] of Object.entries(files)) {
      const sha =
        file.base64 !== undefined
          ? await this.createBlob(file.base64, "base64")
          : await this.createBlob(file.text, "utf-8");
      tree.push({ path, mode: "100644", type: "blob", sha });
    }

    const newTree = await this.call("/git/trees", {
      method: "POST",
      body: JSON.stringify({ base_tree: baseTree, tree }),
    });

    const newCommit = await this.call("/git/commits", {
      method: "POST",
      body: JSON.stringify({
        message,
        tree: newTree.sha,
        parents: [head],
      }),
    });

    await this.call(`/git/refs/heads/${encodeURIComponent(this.branch)}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommit.sha }),
    });

    return newCommit.sha;
  }
}

function friendlyError(status, detail, repo) {
  if (status === 401)
    return "GitHub rejected the token. It may be expired, mistyped, or revoked — create a new one and paste it again.";
  if (status === 403)
    return detail.includes("rate limit")
      ? "GitHub rate limit reached. Wait a minute and try again."
      : "The token does not have permission to write to this repository. It needs Contents: Read and write.";
  if (status === 404)
    return `Could not find ${repo.owner}/${repo.repo}. Either the name is wrong or the token was not granted access to this repository.`;
  if (status === 409) return detail || "Conflict.";
  if (status === 422) return `GitHub rejected the change: ${detail}`;
  return detail ? `GitHub error ${status}: ${detail}` : `GitHub error ${status}.`;
}
