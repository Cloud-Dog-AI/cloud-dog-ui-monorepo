export type RepoDirEntry = Readonly<{
  path: string;
  type: "file" | "dir";
}>;

export type FolderNode = Readonly<{
  name: string;
  path: string;
  children?: FolderNode[];
}>;

export type CommitRecord = Readonly<{
  hash: string;
  author: string;
  date: string;
  message: string;
  body: string;
  merge: boolean;
  raw: string;
}>;

export type DiffSummaryRow = Readonly<{
  path: string;
  additions: number;
  deletions: number;
}>;

export type DiffLine = Readonly<{
  kind: "meta" | "context" | "add" | "delete";
  left: string;
  right: string;
}>;

export type StashRecord = Readonly<{
  index: number;
  ref: string;
  branch: string;
  message: string;
  raw: string;
}>;

export function normaliseRepoPath(path: string): string {
  const trimmed = String(path ?? "").trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
  return trimmed || ".";
}

export function repoBaseName(path: string): string {
  const normalised = normaliseRepoPath(path);
  if (normalised === ".") return ".";
  const parts = normalised.split("/");
  return parts[parts.length - 1] || normalised;
}

export function repoParentPath(path: string): string {
  const normalised = normaliseRepoPath(path);
  if (normalised === ".") return ".";
  const parts = normalised.split("/").filter(Boolean);
  if (parts.length <= 1) return ".";
  return parts.slice(0, -1).join("/");
}

export function joinRepoPath(basePath: string, segment: string): string {
  const base = normaliseRepoPath(basePath);
  const next = normaliseRepoPath(segment);
  if (base === ".") return next;
  if (next === ".") return base;
  return `${base}/${next}`.replace(/\/+/g, "/");
}

export function filterEntriesForPath(entries: RepoDirEntry[], currentPath: string): RepoDirEntry[] {
  const target = normaliseRepoPath(currentPath);
  const prefix = target === "." ? "" : `${target}/`;
  return entries.filter((entry) => {
    const normalizedPath = normaliseRepoPath(entry.path);
    if (target === "." && !normalizedPath.includes("/")) return true;
    if (target !== "." && repoParentPath(normalizedPath) === target) return true;
    return target === "." && !prefix && !normalizedPath.includes("/");
  });
}

export function buildFolderTree(entries: RepoDirEntry[]): FolderNode[] {
  type MutableNode = { name: string; path: string; children: Map<string, MutableNode> };
  const roots = new Map<string, MutableNode>();
  for (const entry of entries) {
    if (entry.type !== "dir") continue;
    const parts = normaliseRepoPath(entry.path).split("/").filter(Boolean);
    let currentMap = roots;
    let runningPath = "";
    for (const part of parts) {
      runningPath = runningPath ? `${runningPath}/${part}` : part;
      let node = currentMap.get(part);
      if (!node) {
        node = { name: part, path: runningPath, children: new Map() };
        currentMap.set(part, node);
      }
      currentMap = node.children;
    }
  }

  const toNodes = (items: Map<string, MutableNode>): FolderNode[] =>
    Array.from(items.values())
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((item) => ({
        name: item.name,
        path: item.path,
        children: toNodes(item.children),
      }));

  return toNodes(roots);
}

export function parseGitLogOutput(log: string): CommitRecord[] {
  const trimmed = String(log ?? "").trim();
  if (!trimmed) return [];
  // git_log emits one TAB-delimited line per commit: <hash>\t<author>\t<isoDate>\t<subject>
  // (W28J-1330). Verbose `commit <hash>` blocks are still parsed below as a fallback.
  if (trimmed.includes("\t") && !/^commit [0-9a-f]/m.test(trimmed)) {
    return trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [hash = "", author = "", date = "", ...rest] = line.split("\t");
        const message = rest.join("\t").trim();
        return {
          hash,
          author,
          date,
          message: message || hash,
          body: message,
          merge: /^Merge\b/i.test(message),
          raw: line,
        };
      });
  }
  const blocks = trimmed.split(/^commit /m).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split("\n");
    const hash = lines[0]?.trim() ?? "";
    let author = "";
    let date = "";
    const messageLines: string[] = [];
    let captureMessage = false;
    for (const line of lines.slice(1)) {
      if (line.startsWith("Author:")) {
        author = line.replace(/^Author:\s*/, "").trim();
        continue;
      }
      if (line.startsWith("Date:")) {
        date = line.replace(/^Date:\s*/, "").trim();
        captureMessage = true;
        continue;
      }
      if (!captureMessage) continue;
      messageLines.push(line.replace(/^ {4}/, ""));
    }
    const body = messageLines.join("\n").trim();
    const firstLine = body.split("\n").find((item) => item.trim())?.trim() ?? "";
    return {
      hash,
      author,
      date,
      message: firstLine || hash,
      body,
      merge: /^Merge\b/i.test(firstLine) || lines.some((line) => line.startsWith("Merge:")),
      raw: `commit ${block.trim()}`,
    };
  });
}

export function parseDiffSummary(diff: string): DiffSummaryRow[] {
  const rows: DiffSummaryRow[] = [];
  let current: DiffSummaryRow | null = null;
  for (const line of String(diff ?? "").split("\n")) {
    if (line.startsWith("diff --git ")) {
      if (current) rows.push(current);
      const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line.trim());
      current = {
        path: match?.[2] ?? line.replace(/^diff --git /, "").trim(),
        additions: 0,
        deletions: 0,
      };
      continue;
    }
    if (!current || line.startsWith("+++ ") || line.startsWith("--- ")) continue;
    if (line.startsWith("+")) {
      current = { ...current, additions: current.additions + 1 };
      continue;
    }
    if (line.startsWith("-")) {
      current = { ...current, deletions: current.deletions + 1 };
    }
  }
  if (current) rows.push(current);
  return rows;
}

export function parseUnifiedDiff(diff: string): DiffLine[] {
  const rows: DiffLine[] = [];
  const pendingDeletes: string[] = [];
  for (const rawLine of String(diff ?? "").split("\n")) {
    if (
      rawLine.startsWith("diff --git ") ||
      rawLine.startsWith("index ") ||
      rawLine.startsWith("--- ") ||
      rawLine.startsWith("+++ ") ||
      rawLine.startsWith("@@")
    ) {
      while (pendingDeletes.length) {
        rows.push({ kind: "delete", left: pendingDeletes.shift() ?? "", right: "" });
      }
      rows.push({ kind: "meta", left: rawLine, right: rawLine });
      continue;
    }
    if (rawLine.startsWith("-")) {
      pendingDeletes.push(rawLine.slice(1));
      continue;
    }
    if (rawLine.startsWith("+")) {
      const previousDelete = pendingDeletes.shift() ?? "";
      rows.push({ kind: previousDelete ? "delete" : "add", left: previousDelete, right: rawLine.slice(1) });
      continue;
    }
    while (pendingDeletes.length) {
      rows.push({ kind: "delete", left: pendingDeletes.shift() ?? "", right: "" });
    }
    rows.push({ kind: "context", left: rawLine.startsWith(" ") ? rawLine.slice(1) : rawLine, right: rawLine.startsWith(" ") ? rawLine.slice(1) : rawLine });
  }
  while (pendingDeletes.length) {
    rows.push({ kind: "delete", left: pendingDeletes.shift() ?? "", right: "" });
  }
  return rows;
}

export function parseStashList(output: string): StashRecord[] {
  return String(output ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^stash@\{(\d+)\}:\s*(.+?):\s*(.+)$/.exec(line);
      return {
        index: Number(match?.[1] ?? 0),
        ref: `stash@{${match?.[1] ?? "0"}}`,
        branch: match?.[2] ?? "unknown",
        message: match?.[3] ?? line,
        raw: line,
      };
    });
}

export function parseConflictMarkers(content: string): { ours: string; theirs: string; result: string } {
  const source = String(content ?? "");
  const lines = source.split("\n");
  const ours: string[] = [];
  const theirs: string[] = [];
  let mode: "none" | "ours" | "theirs" = "none";
  for (const line of lines) {
    if (line.startsWith("<<<<<<<")) {
      mode = "ours";
      continue;
    }
    if (line.startsWith("=======") && mode === "ours") {
      mode = "theirs";
      continue;
    }
    if (line.startsWith(">>>>>>>")) {
      mode = "none";
      continue;
    }
    if (mode === "ours") ours.push(line);
    if (mode === "theirs") theirs.push(line);
  }
  return {
    ours: ours.join("\n"),
    theirs: theirs.join("\n"),
    result: source,
  };
}
