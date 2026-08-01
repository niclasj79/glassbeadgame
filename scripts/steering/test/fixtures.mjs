import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

const DEFAULT_SCRIPTS = Object.freeze({
  test: "node --test",
  typecheck: "tsc --noEmit",
  lint: "eslint .",
  "validate:content": "node validate.mjs",
  build: "node build.mjs",
  "test:browser": "node browser.mjs",
  "bundle:check": "node bundle.mjs",
  "steering:test": "node --test scripts/steering/test/*.test.mjs",
  "steering:check": "node scripts/steering/cli.mjs check",
});

export function makeContract(task, overrides = {}) {
  const base = {
    schemaVersion: 1,
    taskId: task.taskId,
    branch: `codex/${task.taskId}-${task.slug}`,
    dependencies: [...(task.dependencies ?? [])],
    requiredReading: ["AGENTS.md"],
    ownership: {
      paths: [`work/${task.taskId}/**`],
      boundaries: [`boundary-${task.taskId.toLowerCase()}`],
    },
    unresolvedDecisions: [],
    requiredChecks: [
      "npm ci",
      "npm run steering:test",
      "npm run steering:check",
      "git diff --check",
    ],
    humanReview: ["steering-policy"],
    stopBoundary: "reviewable-pr",
  };
  return {
    ...base,
    ...overrides,
    ownership: {
      ...base.ownership,
      ...(overrides.ownership ?? {}),
    },
  };
}

export function taskMarkdown(task) {
  const dependencies =
    task.dependencies?.length > 0
      ? task.dependencies.map((id) => `- ${id} must be Done.`).join("\n")
      : "- None.";
  const includeContract =
    task.contract !== null &&
    (task.contract !== undefined ||
      ["Ready", "In progress"].includes(task.status));
  const contract =
    task.contract === undefined ? makeContract(task) : task.contract;
  const projection =
    contract && typeof contract === "object"
      ? contract
      : makeContract(task);
  const declaredPaths =
    task.declaredPaths ??
    (Array.isArray(projection.ownership?.paths)
      ? projection.ownership.paths.filter((value) => typeof value === "string")
      : []);
  const declaredBoundaries =
    task.declaredBoundaries ??
    (Array.isArray(projection.ownership?.boundaries)
      ? projection.ownership.boundaries.filter(
          (value) => typeof value === "string",
        )
      : []);
  const declaredChecks =
    task.declaredChecks ??
    (Array.isArray(projection.requiredChecks)
      ? projection.requiredChecks.filter((value) => typeof value === "string")
      : []);
  const declaredCategories =
    task.declaredCategories ??
    (Array.isArray(projection.humanReview)
      ? projection.humanReview.filter((value) => typeof value === "string")
      : []);
  const ownedScopeProjection = [
    "### Declared paths",
    "",
    ...declaredPaths.map((value) => `- \`${value}\``),
    "",
    "### Declared boundaries",
    "",
    ...declaredBoundaries.map((value) => `- \`${value}\``),
  ].join("\n");
  const checksProjection = declaredChecks
    .map((value) => `- \`${value}\``)
    .join("\n");
  const reviewProjection = [
    "### Declared categories",
    "",
    ...declaredCategories.map((value) => `- \`${value}\``),
  ].join("\n");
  const contractSection = includeContract
    ? [
        "",
        "## Steering contract",
        "",
        "```json",
        typeof contract === "string"
          ? contract
          : JSON.stringify(contract, null, 2),
        "```",
      ].join("\n")
    : "";
  return [
    `# ${task.titleTaskId ?? task.taskId} — ${task.title ?? `Task ${task.taskId}`}`,
    "",
    "## Status",
    "",
    task.status,
    "",
    "## Milestone",
    "",
    "Fixture",
    "",
    "## Dependencies",
    "",
    task.dependenciesBody ?? dependencies,
    "",
    "## Objective",
    "",
    task.objective ?? "Exercise the steering harness.",
    "",
    "## Required reading",
    "",
    task.readingBody ?? "- `AGENTS.md`",
    contractSection,
    "",
    "## Owned scope",
    "",
    task.ownedScope ?? ownedScopeProjection,
    "",
    "## Acceptance criteria",
    "",
    task.acceptance ?? "- The fixture behaves deterministically.",
    "",
    task.checkHeading ?? "## Required tests and checks",
    "",
    task.checksBody ?? checksProjection,
    "",
    "## Expected completion report",
    "",
    task.report ?? "- Report the fixture result.",
    "",
    task.reviewHeading ?? "## Human review boundary",
    "",
    task.reviewBody ?? reviewProjection,
    "",
  ].join("\n");
}

function indexSection(title, tasks, numbered = true) {
  if (tasks.length === 0) return `## ${title}\n\nNone.\n`;
  return [
    `## ${title}`,
    "",
    ...tasks.map((task, index) => {
      const marker = numbered
        ? `${task.indexOrdinal ?? index + 1}.`
        : "-";
      return `${marker} \`${task.filename}\` — fixture task.`;
    }),
    "",
  ].join("\n");
}

export function indexMarkdown(tasks, overrides = {}) {
  const statusTasks = (status) =>
    tasks.filter((task) => task.indexStatus === status || (
      task.indexStatus === undefined && task.status === status
    ));
  return [
    "# Codex Task Index",
    "",
    "## Status definitions",
    "",
    "- Ready",
    "",
    indexSection(
      "Ready queue",
      overrides.ready ?? statusTasks("Ready"),
      true,
    ),
    indexSection(
      "In progress",
      overrides.inProgress ?? statusTasks("In progress"),
      true,
    ),
    indexSection(
      "In review",
      overrides.review ?? statusTasks("Review"),
      true,
    ),
    indexSection(
      "Blocked queue",
      overrides.blocked ?? statusTasks("Blocked"),
      true,
    ),
    indexSection(
      "Completed",
      overrides.done ?? statusTasks("Done"),
      true,
    ),
  ].join("\n");
}

export function defaultTasks() {
  return [
    {
      taskId: "M0-001",
      slug: "foundation",
      filename: "M0-001-foundation.md",
      status: "Done",
      dependencies: [],
      contract: null,
    },
    {
      taskId: "M1-001",
      slug: "ready-work",
      filename: "M1-001-ready-work.md",
      status: "Ready",
      dependencies: ["M0-001"],
    },
  ];
}

export function writeFixture({
  tasks = defaultTasks(),
  index = null,
  scripts = DEFAULT_SCRIPTS,
  lineEnding = "\n",
  extraFiles = {},
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "gbg-steering-"));
  const write = (path, value) => {
    const absolute = join(root, ...path.split("/"));
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(
      absolute,
      value.replace(/\r\n?|\n/gu, lineEnding),
      "utf8",
    );
  };
  write("AGENTS.md", "# Fixture instructions\n");
  write(
    "package.json",
    `${JSON.stringify(
      {
        name: "steering-fixture",
        private: true,
        type: "module",
        scripts,
      },
      null,
      2,
    )}\n`,
  );
  for (const task of tasks) {
    write(`docs/tasks/${task.filename}`, taskMarkdown(task));
  }
  write(
    "docs/tasks/README.md",
    typeof index === "string" ? index : indexMarkdown(tasks, index ?? {}),
  );
  for (const [path, value] of Object.entries(extraFiles)) write(path, value);
  return {
    root,
    tasks,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

export function rewrite(root, path, transform) {
  const absolute = join(root, ...path.split("/"));
  const current = readFileSync(absolute, "utf8");
  writeFileSync(absolute, transform(current), "utf8");
}

export function snapshotTree(root) {
  const snapshot = {};
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile()) {
        const path = relative(root, absolute).replaceAll("\\", "/");
        snapshot[path] = {
          size: statSync(absolute).size,
          content: readFileSync(absolute, "utf8"),
        };
      }
    }
  };
  visit(root);
  return snapshot;
}

export function createLiveRunner(overrides = {}) {
  const calls = [];
  const sha = overrides.sha ?? "a".repeat(40);
  const responses = new Map([
    [
      "git\u0000--no-optional-locks\u0000status\u0000--porcelain",
      { status: 0, stdout: overrides.status ?? "", stderr: "" },
    ],
    [
      "gh\u0000auth\u0000status",
      {
        status: overrides.authFailure ? 1 : 0,
        stdout: "",
        stderr: overrides.authFailure ? "not authenticated" : "",
      },
    ],
    [
      "gh\u0000repo\u0000view\u0000--json\u0000nameWithOwner,defaultBranchRef",
      {
        status: 0,
        stdout: JSON.stringify(
          overrides.repository ?? {
            nameWithOwner: "example/glassbeadgame",
            defaultBranchRef: { name: "main" },
          },
        ),
        stderr: "",
      },
    ],
    [
      "gh\u0000api\u0000repos/example/glassbeadgame/commits/main\u0000--jq\u0000.sha",
      {
        status: 0,
        stdout: `${overrides.remoteSha ?? sha}\n`,
        stderr: "",
      },
    ],
    [
      "git\u0000--no-optional-locks\u0000branch\u0000--show-current",
      {
        status: 0,
        stdout: `${overrides.branch ?? "main"}\n`,
        stderr: "",
      },
    ],
    [
      "git\u0000--no-optional-locks\u0000rev-parse\u0000HEAD",
      { status: 0, stdout: `${sha}\n`, stderr: "" },
    ],
    [
      "git\u0000--no-optional-locks\u0000rev-parse\u0000origin/main",
      {
        status: 0,
        stdout: `${overrides.originSha ?? sha}\n`,
        stderr: "",
      },
    ],
    [
      "gh\u0000pr\u0000list\u0000--state\u0000open\u0000--limit\u0000100\u0000--json\u0000number,title,headRefName,baseRefName",
      {
        status: 0,
        stdout: JSON.stringify(overrides.openPullRequests ?? []),
        stderr: "",
      },
    ],
    [
      "gh\u0000run\u0000list\u0000--workflow\u0000ci.yml\u0000--branch\u0000main\u0000--event\u0000push\u0000--limit\u000050\u0000--json\u0000databaseId,headSha,status,conclusion,workflowName,createdAt",
      {
        status: 0,
        stdout: JSON.stringify(
          overrides.runs ?? [
            {
              databaseId: 42,
              headSha: sha,
              status: "completed",
              conclusion: "success",
              workflowName: "CI",
              createdAt: "2026-07-26T00:00:00Z",
            },
          ],
        ),
        stderr: "",
      },
    ],
    [
      "gh\u0000run\u0000view\u000042\u0000--json\u0000jobs,url",
      {
        status: 0,
        stdout: JSON.stringify(
          overrides.runDetails ?? {
            jobs: [
              {
                name: "Quality Gates",
                status: "completed",
                conclusion: "success",
              },
            ],
            url: "https://github.example/runs/42",
          },
        ),
        stderr: "",
      },
    ],
  ]);

  const runner = (command, args, options = {}) => {
    calls.push({ command, args: [...args] });
    const key = [command, ...args].join("\u0000");
    if (
      key ===
      "git\u0000--no-optional-locks\u0000rev-parse\u0000--show-toplevel"
    ) {
      return {
        status: 0,
        stdout: `${overrides.gitTopLevel ?? options.cwd}\n`,
        stderr: "",
      };
    }
    return (
      responses.get(key) ?? {
        status: 1,
        stdout: "",
        stderr: `Unexpected command: ${command} ${args.join(" ")}`,
      }
    );
  };
  return { runner, calls };
}
