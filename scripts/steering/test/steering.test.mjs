import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  parseDependencyIds,
  parseMarkdownSections,
  parseTaskPacket,
  selectNextTask,
  validateRepository,
} from "../core.mjs";
import { runLivePreflight } from "../live.mjs";
import { runCli } from "../cli.mjs";
import {
  createLiveRunner,
  defaultTasks,
  indexMarkdown,
  makeContract,
  rewrite,
  snapshotTree,
  writeFixture,
} from "./fixtures.mjs";

function diagnosticCodes(validation) {
  return new Set(validation.diagnostics.map((entry) => entry.code));
}

function withFixture(options, callback) {
  const fixture = writeFixture(options);
  try {
    return callback(fixture);
  } finally {
    fixture.cleanup();
  }
}

function readyTask(overrides = {}) {
  const task = {
    taskId: "M1-001",
    slug: "ready-work",
    filename: "M1-001-ready-work.md",
    status: "Ready",
    dependencies: ["M0-001"],
    ...overrides,
  };
  if (overrides.contractOverrides) {
    task.contract = makeContract(task, overrides.contractOverrides);
  }
  delete task.contractOverrides;
  return task;
}

function doneTask(overrides = {}) {
  return {
    taskId: "M0-001",
    slug: "foundation",
    filename: "M0-001-foundation.md",
    status: "Done",
    dependencies: [],
    contract: null,
    ...overrides,
  };
}

test("valid repository selects the first Ready task and emits a complete truthful contract", () => {
  withFixture({}, ({ root }) => {
    const validation = validateRepository(root);
    assert.equal(validation.ok, true, validation.diagnostics.map(String).join("\n"));
    const result = selectNextTask(validation);
    assert.equal(result.valid, true);
    assert.equal(result.eligible, true);
    assert.equal(result.selectionStatus, "selected");
    assert.equal(result.evidenceMode, "repository-only");
    assert.match(result.evidenceStatement, /not verified/u);
    assert.equal(result.selectedTask.taskId, "M1-001");
    assert.equal(result.selectedTask.branch, "codex/M1-001-ready-work");
    assert.deepEqual(result.selectedTask.dependencies, [
      { taskId: "M0-001", status: "Done" },
    ]);
    assert.deepEqual(result.selectedTask.requiredReading, ["AGENTS.md"]);
    assert.deepEqual(result.selectedTask.ownership, {
      paths: ["work/M1-001/**"],
      boundaries: ["boundary-m1-001"],
    });
    assert.deepEqual(result.selectedTask.requiredChecks, [
      "npm ci",
      "npm run steering:test",
      "npm run steering:check",
      "git diff --check",
    ]);
    assert.deepEqual(result.selectedTask.humanReview, ["steering-policy"]);
    assert.equal(result.selectedTask.stopBoundary, "reviewable-pr");
    assert.equal(result.autonomyBoundary.automaticMerge, false);
    assert.equal(result.autonomyBoundary.automaticNextTask, false);
  });
});

test("selection follows declared Ready queue order rather than filesystem order", () => {
  const first = readyTask({
    taskId: "M2-002",
    slug: "second-id-first",
    filename: "M2-002-second-id-first.md",
  });
  first.contract = makeContract(first);
  const second = readyTask({
    taskId: "M1-001",
    slug: "first-id-second",
    filename: "M1-001-first-id-second.md",
  });
  second.contract = makeContract(second);
  const tasks = [doneTask(), first, second];
  withFixture({ tasks }, ({ root }) => {
    const result = selectNextTask(validateRepository(root));
    assert.equal(result.selectedTask.taskId, "M2-002");
    assert.deepEqual(
      result.candidates.map((entry) => entry.taskId),
      ["M2-002", "M1-001"],
    );
  });
});

test("valid repository with no Ready task is a non-error result with an explicit reason", () => {
  const tasks = [doneTask()];
  withFixture({ tasks }, ({ root }) => {
    const result = selectNextTask(validateRepository(root));
    assert.equal(result.valid, true);
    assert.equal(result.eligible, false);
    assert.equal(result.selectionStatus, "no-ready-task");
    assert.deepEqual(result.reasons, [
      {
        code: "NO_READY_TASK",
        message: "The task index contains no locally eligible Ready task.",
      },
    ]);
  });
});

test("CRLF and UTF-8 Markdown normalize deterministically and negative dependency prose is ignored", () => {
  const ready = readyTask({
    dependenciesBody:
      "- M0-001 through M0-001 must be Done.\n- M2-011 is not a dependency.",
  });
  withFixture(
    { tasks: [doneTask(), ready], lineEnding: "\r\n" },
    ({ root }) => {
      const validation = validateRepository(root);
      assert.equal(validation.ok, true);
      assert.deepEqual(
        validation.tasks.find((task) => task.taskId === "M1-001").dependencies,
        ["M0-001"],
      );
    },
  );
  assert.deepEqual(
    parseDependencyIds(
      "- M2-001 through M2-003 must be Done.\n- M2-011 is not a dependency.",
    ).ids,
    ["M2-001", "M2-002", "M2-003"],
  );
  assert.deepEqual(
    parseDependencyIds(
      "- M0-001 must be Done; M2-011 is not a dependency.",
    ).ids,
    ["M0-001"],
  );
  assert.deepEqual(
    parseDependencyIds("- M2-011 should not be a dependency.").ids,
    ["M2-011"],
  );
});

test("dependency ranges using unspaced en or em dashes expand inclusively", () => {
  assert.deepEqual(parseDependencyIds("- M0-001–M0-003 must be Done.").ids, [
    "M0-001",
    "M0-002",
    "M0-003",
  ]);
  assert.deepEqual(parseDependencyIds("- M1-004—M1-006 must be Done.").ids, [
    "M1-004",
    "M1-005",
    "M1-006",
  ]);
});

test("Markdown headings inside fenced code do not become packet sections", () => {
  const parsed = parseMarkdownSections(
    "## Status\n\nReady\n\n```json\n## Fake\n{}\n```\n\n## Objective\n\nReal",
  );
  assert.equal(parsed.sections.has("fake"), false);
  assert.equal(parsed.sections.get("objective").body, "Real");
});

test("a task title inside fenced code is not accepted as the packet H1", () => {
  const parsed = parseTaskPacket({
    filename: "M1-001-fenced-title.md",
    markdown: [
      "```md",
      "# M1-001 — Not a real title",
      "```",
      "",
      "## Status",
      "",
      "Done",
    ].join("\n"),
  });
  assert.ok(
    new Set(parsed.diagnostics.map((entry) => entry.code)).has(
      "TASK_TITLE_INVALID",
    ),
  );
});

const malformedCases = [
  {
    name: "duplicate task IDs",
    expected: "TASK_ID_DUPLICATE",
    build() {
      const duplicate = readyTask({
        filename: "M1-001-duplicate.md",
        slug: "duplicate",
      });
      duplicate.contract = makeContract(duplicate);
      return { tasks: [doneTask(), readyTask(), duplicate] };
    },
  },
  {
    name: "invalid status",
    expected: "TASK_STATUS_INVALID",
    build() {
      return { tasks: [doneTask(), readyTask({ status: "Almost ready" })] };
    },
  },
  {
    name: "missing active heading",
    expected: "TASK_ACTIVE_HEADING_MISSING",
    build() {
      return { tasks: [doneTask(), readyTask({ acceptance: "" })] };
    },
  },
  {
    name: "malformed contract JSON",
    expected: "CONTRACT_JSON_INVALID",
    build() {
      return { tasks: [doneTask(), readyTask({ contract: "{ nope" })] };
    },
  },
  {
    name: "multiple contract JSON blocks",
    expected: "CONTRACT_JSON_MULTIPLE",
    build() {
      const task = readyTask();
      const json = JSON.stringify(makeContract(task));
      task.contract = `${json}\n\`\`\`\n\n\`\`\`json\n${json}`;
      return { tasks: [doneTask(), task] };
    },
  },
  {
    name: "duplicate top-level contract JSON key",
    expected: "CONTRACT_JSON_DUPLICATE_KEY",
    build() {
      const task = readyTask();
      const contract = makeContract(task);
      task.contract = JSON.stringify(contract).replace(
        '"taskId":"M1-001"',
        '"taskId":"M1-001","taskId":"M1-001"',
      );
      return { tasks: [doneTask(), task] };
    },
  },
  {
    name: "duplicate nested contract JSON key",
    expected: "CONTRACT_JSON_DUPLICATE_KEY",
    build() {
      const task = readyTask();
      const contract = makeContract(task);
      task.contract = JSON.stringify(contract).replace(
        '"paths":["work/M1-001/**"]',
        '"paths":["work/M1-001/**"],"paths":["work/M1-001/**"]',
      );
      return { tasks: [doneTask(), task] };
    },
  },
  {
    name: "filename and title IDs disagree",
    expected: "TASK_FILENAME_TITLE_MISMATCH",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({ titleTaskId: "M1-002" }),
        ],
      };
    },
  },
  {
    name: "index references unknown task",
    expected: "INDEX_TASK_UNKNOWN",
    build() {
      const tasks = defaultTasks();
      const ghost = {
        taskId: "M9-999",
        filename: "M9-999-ghost.md",
        status: "Ready",
      };
      return { tasks, index: { ready: [tasks[1], ghost] } };
    },
  },
  {
    name: "Ready queue numbering is out of order",
    expected: "READY_QUEUE_ORDER_INVALID",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({ indexOrdinal: 2 }),
        ],
      };
    },
  },
  {
    name: "task is duplicated across index sections",
    expected: "INDEX_TASK_DUPLICATE",
    build() {
      const tasks = defaultTasks();
      return {
        tasks,
        index: { ready: [tasks[1]], review: [tasks[1]] },
      };
    },
  },
  {
    name: "index status differs from packet",
    expected: "INDEX_STATUS_MISMATCH",
    build() {
      return {
        tasks: [doneTask(), readyTask({ indexStatus: "Review" })],
      };
    },
  },
  {
    name: "Ready task is missing from queue",
    expected: "READY_QUEUE_TASK_MISSING",
    build() {
      const tasks = defaultTasks();
      return { tasks, index: { ready: [] } };
    },
  },
  {
    name: "dependency is missing",
    expected: "READY_DEPENDENCY_MISSING",
    build() {
      const task = readyTask({ dependencies: ["M9-001"] });
      task.contract = makeContract(task);
      return { tasks: [doneTask(), task] };
    },
  },
  {
    name: "dependency is not Done",
    expected: "READY_DEPENDENCY_NOT_DONE",
    build() {
      const dependency = {
        taskId: "M0-001",
        slug: "foundation",
        filename: "M0-001-foundation.md",
        status: "Review",
        dependencies: [],
        contract: null,
      };
      return { tasks: [dependency, readyTask()] };
    },
  },
  {
    name: "dependency cycle",
    expected: "READY_DEPENDENCY_CYCLE",
    build() {
      const ready = readyTask({ dependencies: ["M1-002"] });
      ready.contract = makeContract(ready);
      const active = {
        taskId: "M1-002",
        slug: "active",
        filename: "M1-002-active.md",
        status: "In progress",
        dependencies: ["M1-001"],
      };
      active.contract = makeContract(active);
      return { tasks: [doneTask(), ready, active] };
    },
  },
  {
    name: "In progress dependency is missing",
    expected: "ACTIVE_DEPENDENCY_MISSING",
    build() {
      const active = {
        taskId: "M1-002",
        slug: "active",
        filename: "M1-002-active.md",
        status: "In progress",
        dependencies: ["M9-999"],
      };
      active.contract = makeContract(active);
      return { tasks: [doneTask(), active] };
    },
  },
  {
    name: "legacy Review dependency is not Done",
    expected: "ACTIVE_DEPENDENCY_NOT_DONE",
    build() {
      const review = {
        taskId: "M1-002",
        slug: "review",
        filename: "M1-002-review.md",
        status: "Review",
        dependencies: ["M1-001"],
        contract: null,
      };
      const active = {
        taskId: "M1-001",
        slug: "active",
        filename: "M1-001-active.md",
        status: "In progress",
        dependencies: ["M0-001"],
      };
      active.contract = makeContract(active);
      return { tasks: [doneTask(), active, review] };
    },
  },
  {
    name: "legacy Review dependency cycle",
    expected: "ACTIVE_DEPENDENCY_CYCLE",
    build() {
      const left = {
        taskId: "M1-001",
        slug: "left-review",
        filename: "M1-001-left-review.md",
        status: "Review",
        dependencies: ["M1-002"],
        contract: null,
      };
      const right = {
        taskId: "M1-002",
        slug: "right-review",
        filename: "M1-002-right-review.md",
        status: "Review",
        dependencies: ["M1-001"],
        contract: null,
      };
      return { tasks: [doneTask(), left, right] };
    },
  },
  {
    name: "unresolved Ready decision",
    expected: "READY_DECISIONS_UNRESOLVED",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({
            contractOverrides: { unresolvedDecisions: ["I-999"] },
          }),
        ],
      };
    },
  },
  {
    name: "invalid branch",
    expected: "CONTRACT_BRANCH_INVALID",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({ contractOverrides: { branch: "feature/work" } }),
        ],
      };
    },
  },
  {
    name: "empty ownership",
    expected: "CONTRACT_OWNERSHIP_EMPTY",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({
            contractOverrides: {
              ownership: { paths: [], boundaries: [] },
            },
          }),
        ],
      };
    },
  },
  {
    name: "unsafe ownership path",
    expected: "CONTRACT_OWNERSHIP_PATH_UNSAFE",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({
            contractOverrides: {
              ownership: {
                paths: ["../outside/**"],
                boundaries: ["safe-boundary"],
              },
            },
          }),
        ],
      };
    },
  },
  {
    name: "unsafe required-reading path",
    expected: "CONTRACT_READING_PATH_UNSAFE",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({
            readingBody: "- `../AGENTS.md`",
            contractOverrides: { requiredReading: ["../AGENTS.md"] },
          }),
        ],
      };
    },
  },
  {
    name: "non-string required-reading entry",
    expected: "CONTRACT_READING_INVALID",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({
            contractOverrides: { requiredReading: ["AGENTS.md", 42] },
          }),
        ],
      };
    },
  },
  {
    name: "empty acceptance section",
    expected: "TASK_ACTIVE_HEADING_MISSING",
    build() {
      return { tasks: [doneTask(), readyTask({ acceptance: "" })] };
    },
  },
  {
    name: "empty checks section",
    expected: "TASK_ACTIVE_HEADING_MISSING",
    build() {
      return { tasks: [doneTask(), readyTask({ checksBody: "" })] };
    },
  },
  {
    name: "empty review section",
    expected: "TASK_ACTIVE_HEADING_MISSING",
    build() {
      return { tasks: [doneTask(), readyTask({ reviewBody: "" })] };
    },
  },
  {
    name: "unknown package check script",
    expected: "CONTRACT_CHECK_SCRIPT_UNKNOWN",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({
            contractOverrides: {
              requiredChecks: ["npm ci", "npm run imaginary"],
            },
          }),
        ],
      };
    },
  },
  {
    name: "empty package check script",
    expected: "CONTRACT_CHECK_SCRIPT_EMPTY",
    build() {
      return {
        tasks: defaultTasks(),
        scripts: { ...Object.fromEntries([]), test: "node --test", "steering:test": "" },
      };
    },
    mutate(options) {
      const ready = options.tasks[1];
      ready.contract = makeContract(ready, {
        requiredChecks: ["npm ci", "npm run steering:test"],
      });
    },
  },
  {
    name: "unsafe required-check command",
    expected: "CONTRACT_CHECK_COMMAND_UNSAFE",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({
            contractOverrides: {
              requiredChecks: ["npm ci", "git push origin main"],
            },
          }),
        ],
      };
    },
  },
  {
    name: "invalid stop boundary",
    expected: "CONTRACT_STOP_BOUNDARY_INVALID",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({ contractOverrides: { stopBoundary: "merged-pr" } }),
        ],
      };
    },
  },
  {
    name: "dependency contract drift",
    expected: "CONTRACT_DEPENDENCY_DRIFT",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({
            contractOverrides: { dependencies: [] },
          }),
        ],
      };
    },
  },
  {
    name: "required-reading contract drift",
    expected: "CONTRACT_READING_DRIFT",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({
            contractOverrides: { requiredReading: ["README.md"] },
          }),
        ],
        extraFiles: { "README.md": "# Fixture\n" },
      };
    },
  },
  {
    name: "contract task ID drift",
    expected: "CONTRACT_TASK_ID_DRIFT",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({ contractOverrides: { taskId: "M1-002" } }),
        ],
      };
    },
  },
  {
    name: "required reading file missing",
    expected: "CONTRACT_READING_MISSING",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({
            readingBody: "- `MISSING.md`",
            contractOverrides: { requiredReading: ["MISSING.md"] },
          }),
        ],
      };
    },
  },
  {
    name: "ownership overlaps active work",
    expected: "READY_OWNERSHIP_CONFLICT",
    build() {
      const ready = readyTask({
        contractOverrides: {
          ownership: {
            paths: ["shared/**"],
            boundaries: ["shared-boundary"],
          },
        },
      });
      const active = {
        taskId: "M1-002",
        slug: "active-work",
        filename: "M1-002-active-work.md",
        status: "In progress",
        dependencies: ["M0-001"],
      };
      active.contract = makeContract(active, {
        ownership: {
          paths: ["shared/file.md"],
          boundaries: ["shared-boundary"],
        },
      });
      return { tasks: [doneTask(), ready, active] };
    },
  },
  {
    name: "Owned scope paths drift from contract",
    expected: "CONTRACT_OWNERSHIP_PATHS_DRIFT",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({ declaredPaths: ["different/**"] }),
        ],
      };
    },
  },
  {
    name: "Owned scope boundaries drift from contract",
    expected: "CONTRACT_OWNERSHIP_BOUNDARIES_DRIFT",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({ declaredBoundaries: ["different-boundary"] }),
        ],
      };
    },
  },
  {
    name: "Required checks prose drifts from contract",
    expected: "CONTRACT_REQUIRED_CHECKS_DRIFT",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({ declaredChecks: ["npm ci"] }),
        ],
      };
    },
  },
  {
    name: "Human review categories drift from contract",
    expected: "CONTRACT_HUMAN_REVIEW_DRIFT",
    build() {
      return {
        tasks: [
          doneTask(),
          readyTask({ declaredCategories: ["different-review"] }),
        ],
      };
    },
  },
];

for (const fixtureCase of malformedCases) {
  test(`fails closed: ${fixtureCase.name}`, () => {
    const options = fixtureCase.build();
    fixtureCase.mutate?.(options);
    withFixture(options, ({ root }) => {
      const validation = validateRepository(root);
      assert.equal(validation.ok, false);
      assert.ok(
        diagnosticCodes(validation).has(fixtureCase.expected),
        `Expected ${fixtureCase.expected}; received ${[...diagnosticCodes(validation)].join(", ")}`,
      );
      const selection = selectNextTask(validation);
      assert.equal(selection.valid, false);
      assert.equal(selection.eligible, false);
      assert.equal(selection.selectionStatus, "refused");
    });
  });
}

const contractShapeCases = [
  [
    "unsupported schema",
    "CONTRACT_SCHEMA_UNSUPPORTED",
    (contract) => {
      contract.schemaVersion = 2;
    },
  ],
  [
    "unknown field",
    "CONTRACT_UNKNOWN_FIELDS",
    (contract) => {
      contract.extra = true;
    },
  ],
  [
    "missing field",
    "CONTRACT_FIELDS_MISSING",
    (contract) => {
      delete contract.branch;
    },
  ],
  [
    "invalid taskId",
    "CONTRACT_TASK_ID_INVALID",
    (contract) => {
      contract.taskId = 7;
    },
  ],
  [
    "non-string branch",
    "CONTRACT_BRANCH_INVALID",
    (contract) => {
      contract.branch = 7;
    },
  ],
  [
    "malformed dependencies",
    "CONTRACT_DEPENDENCIES_INVALID",
    (contract) => {
      contract.dependencies = ["M0-001", 7];
    },
  ],
  [
    "empty required reading",
    "CONTRACT_READING_INVALID",
    (contract) => {
      contract.requiredReading = [];
    },
  ],
  [
    "malformed ownership",
    "CONTRACT_OWNERSHIP_EMPTY",
    (contract) => {
      contract.ownership = { paths: "src/**", boundaries: null };
    },
  ],
  [
    "invalid ownership boundary",
    "CONTRACT_OWNERSHIP_BOUNDARY_INVALID",
    (contract) => {
      contract.ownership.boundaries = ["Not Safe"];
    },
  ],
  [
    "malformed decisions",
    "CONTRACT_DECISIONS_INVALID",
    (contract) => {
      contract.unresolvedDecisions = null;
    },
  ],
  [
    "empty checks",
    "CONTRACT_CHECKS_EMPTY",
    (contract) => {
      contract.requiredChecks = [];
    },
  ],
  [
    "empty human review",
    "CONTRACT_HUMAN_REVIEW_EMPTY",
    (contract) => {
      contract.humanReview = [];
    },
  ],
  [
    "duplicate array value",
    "CONTRACT_ARRAY_DUPLICATE",
    (contract) => {
      contract.requiredReading = ["AGENTS.md", "AGENTS.md"];
    },
  ],
];

for (const [name, expected, mutate] of contractShapeCases) {
  test(`contract schema fails closed: ${name}`, () => {
    const task = readyTask();
    const contract = makeContract(task);
    mutate(contract);
    task.contract = contract;
    withFixture({ tasks: [doneTask(), task] }, ({ root }) => {
      const validation = validateRepository(root);
      assert.equal(validation.ok, false);
      assert.ok(
        diagnosticCodes(validation).has(expected),
        `Expected ${expected}; received ${[...diagnosticCodes(validation)].join(", ")}`,
      );
    });
  });
}

test("repository validation and selection do not alter fixture files", () => {
  withFixture({}, ({ root }) => {
    const before = snapshotTree(root);
    const validation = validateRepository(root);
    selectNextTask(validation);
    const after = snapshotTree(root);
    assert.deepEqual(after, before);
  });
});

test("root-wide ownership globs overlap narrower active globs", () => {
  const ready = readyTask({
    contractOverrides: {
      ownership: {
        paths: ["**"],
        boundaries: ["ready-boundary"],
      },
    },
  });
  const active = {
    taskId: "M1-002",
    slug: "active-work",
    filename: "M1-002-active-work.md",
    status: "In progress",
    dependencies: ["M0-001"],
  };
  active.contract = makeContract(active, {
    ownership: {
      paths: ["src/**"],
      boundaries: ["active-boundary"],
    },
  });
  withFixture({ tasks: [doneTask(), ready, active] }, ({ root }) => {
    const validation = validateRepository(root);
    assert.ok(
      diagnosticCodes(validation).has("READY_OWNERSHIP_CONFLICT"),
      [...diagnosticCodes(validation)].join(", "),
    );
  });
});

test("ownership overlap is conservative across path case", () => {
  const ready = readyTask({
    contractOverrides: {
      ownership: {
        paths: ["SRC/**"],
        boundaries: ["ready-boundary"],
      },
    },
  });
  const active = {
    taskId: "M1-002",
    slug: "active-work",
    filename: "M1-002-active-work.md",
    status: "In progress",
    dependencies: ["M0-001"],
  };
  active.contract = makeContract(active, {
    ownership: {
      paths: ["src/file.ts"],
      boundaries: ["active-boundary"],
    },
  });
  withFixture({ tasks: [doneTask(), ready, active] }, ({ root }) => {
    assert.ok(
      diagnosticCodes(validateRepository(root)).has(
        "READY_OWNERSHIP_CONFLICT",
      ),
    );
  });
});

test("ownership wildcard prefixes overlap when either raw prefix contains the other", () => {
  const ready = readyTask({
    contractOverrides: {
      ownership: {
        paths: ["src/a*"],
        boundaries: ["ready-boundary"],
      },
    },
  });
  const active = {
    taskId: "M1-002",
    slug: "active-work",
    filename: "M1-002-active-work.md",
    status: "In progress",
    dependencies: ["M0-001"],
  };
  active.contract = makeContract(active, {
    ownership: {
      paths: ["src/ab*"],
      boundaries: ["active-boundary"],
    },
  });
  withFixture({ tasks: [doneTask(), ready, active] }, ({ root }) => {
    assert.ok(
      diagnosticCodes(validateRepository(root)).has(
        "READY_OWNERSHIP_CONFLICT",
      ),
    );
  });
});

test("Ready selection is blocked when active legacy Review ownership is unverifiable", () => {
  const legacyReview = {
    taskId: "M1-002",
    slug: "legacy-review",
    filename: "M1-002-legacy-review.md",
    status: "Review",
    dependencies: ["M0-001"],
    contract: null,
  };
  withFixture(
    { tasks: [doneTask(), readyTask(), legacyReview] },
    ({ root }) => {
      const validation = validateRepository(root);
      assert.ok(
        diagnosticCodes(validation).has(
          "READY_ACTIVE_OWNERSHIP_UNVERIFIABLE",
        ),
        [...diagnosticCodes(validation)].join(", "),
      );
    },
  );
});

test("legacy Review without a contract remains repository-valid when no Ready task exists", () => {
  const legacyReview = {
    taskId: "M1-002",
    slug: "legacy-review",
    filename: "M1-002-legacy-review.md",
    status: "Review",
    dependencies: ["M0-001"],
    contract: null,
  };
  withFixture({ tasks: [doneTask(), legacyReview] }, ({ root }) => {
    const validation = validateRepository(root);
    assert.equal(validation.ok, true);
    assert.equal(selectNextTask(validation).selectionStatus, "no-ready-task");
  });
});

test("required reading must resolve to a regular file", () => {
  const ready = readyTask({
    readingBody: "- `reading-dir`",
    contractOverrides: { requiredReading: ["reading-dir"] },
  });
  withFixture({ tasks: [doneTask(), ready] }, ({ root }) => {
    mkdirSync(join(root, "reading-dir"));
    const validation = validateRepository(root);
    assert.ok(
      diagnosticCodes(validation).has("CONTRACT_READING_NOT_FILE"),
      [...diagnosticCodes(validation)].join(", "),
    );
  });
});

test("required-reading symlinks may not escape the repository", (context) => {
  const outside = mkdtempSync(join(tmpdir(), "gbg-steering-outside-"));
  try {
    const outsideFile = join(outside, "outside.md");
    writeFileSync(outsideFile, "# Outside\n", "utf8");
    const ready = readyTask({
      readingBody: "- `OUTSIDE.md`",
      contractOverrides: { requiredReading: ["OUTSIDE.md"] },
    });
    withFixture({ tasks: [doneTask(), ready] }, ({ root }) => {
      try {
        symlinkSync(outsideFile, join(root, "OUTSIDE.md"), "file");
      } catch (error) {
        if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
          context.skip(`File symlinks unavailable: ${error.code}`);
          return;
        }
        throw error;
      }
      const validation = validateRepository(root);
      assert.ok(
        diagnosticCodes(validation).has("CONTRACT_READING_OUTSIDE_ROOT"),
        [...diagnosticCodes(validation)].join(", "),
      );
    });
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});

test("CLI returns 0 for valid/no-ready and 1 for malformed state", () => {
  const capture = () => {
    const values = { logs: [], errors: [] };
    return {
      values,
      io: {
        log(value) {
          values.logs.push(value);
        },
        error(value) {
          values.errors.push(value);
        },
      },
    };
  };
  withFixture({ tasks: [doneTask()] }, ({ root }) => {
    const output = capture();
    assert.equal(runCli(["next", "--json", "--root", root], output.io), 0);
    const parsed = JSON.parse(output.values.logs[0]);
    assert.equal(parsed.selectionStatus, "no-ready-task");
  });
  withFixture({}, ({ root }) => {
    rewrite(root, "docs/tasks/M1-001-ready-work.md", (value) =>
      value.replace("\nReady\n", "\nUnknown\n"),
    );
    const output = capture();
    assert.equal(runCli(["check", "--root", root], output.io), 1);
    assert.ok(output.values.errors.some((value) => value.includes("TASK_STATUS_INVALID")));
  });
});

const liveFailures = [
  [
    "nested repository root",
    { gitTopLevel: dirname(process.cwd()) },
    "LIVE_ROOT_NOT_GIT_TOPLEVEL",
  ],
  ["dirty worktree", { status: "?? scratch.txt\n" }, "LIVE_DIRTY_WORKTREE"],
  ["missing GitHub authentication", { authFailure: true }, "LIVE_GH_AUTH_UNAVAILABLE"],
  ["wrong branch", { branch: "feature/work" }, "LIVE_NOT_DEFAULT_BRANCH"],
  ["outdated origin ref", { originSha: "b".repeat(40) }, "LIVE_HEAD_NOT_ORIGIN"],
  [
    "remote default branch moved",
    { remoteSha: "c".repeat(40) },
    "LIVE_HEAD_NOT_REMOTE",
  ],
  [
    "open pull request",
    { openPullRequests: [{ number: 7 }] },
    "LIVE_OPEN_PRS",
  ],
  ["missing exact-main run", { runs: [] }, "LIVE_EXACT_MAIN_RUN_MISSING"],
  [
    "unsuccessful exact-main run",
    {
      runs: [
        {
          databaseId: 42,
          headSha: "a".repeat(40),
          status: "completed",
          conclusion: "failure",
        },
      ],
    },
    "LIVE_EXACT_MAIN_RUN_NOT_SUCCESSFUL",
  ],
  [
    "unsuccessful Quality Gates job",
    {
      runDetails: {
        jobs: [
          {
            name: "Quality Gates",
            status: "completed",
            conclusion: "failure",
          },
        ],
        url: "https://github.example/runs/42",
      },
    },
    "LIVE_QUALITY_GATES_NOT_SUCCESSFUL",
  ],
];

for (const [name, overrides, expected] of liveFailures) {
  test(`live preflight fails closed for ${name}`, () => {
    const live = createLiveRunner(overrides);
    const result = runLivePreflight({
      root: process.cwd(),
      runner: live.runner,
    });
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0].code, expected);
  });
}

test("live preflight proves exact default HEAD, no PRs, and successful Quality Gates using read-only commands", () => {
  const live = createLiveRunner();
  const result = runLivePreflight({
    root: process.cwd(),
    runner: live.runner,
  });
  assert.equal(result.ok, true);
  assert.equal(result.evidence.defaultBranch, "main");
  assert.equal(result.evidence.remoteSha, "a".repeat(40));
  assert.equal(result.evidence.worktreeClean, true);
  assert.equal(result.evidence.openPullRequestCount, 0);
  assert.equal(result.evidence.qualityGates.conclusion, "success");
  assert.equal(result.evidence.commandsWereReadOnly, true);

  const allowed = new Set([
    "git --no-optional-locks rev-parse --show-toplevel",
    "git --no-optional-locks status --porcelain",
    "gh auth status",
    "gh repo view --json nameWithOwner,defaultBranchRef",
    "gh api repos/example/glassbeadgame/commits/main --jq .sha",
    "git --no-optional-locks branch --show-current",
    "git --no-optional-locks rev-parse HEAD",
    "git --no-optional-locks rev-parse origin/main",
    "gh pr list --state open --limit 100 --json number,title,headRefName,baseRefName",
    "gh run list --workflow ci.yml --branch main --event push --limit 50 --json databaseId,headSha,status,conclusion,workflowName,createdAt",
    "gh run view 42 --json jobs,url",
  ]);
  assert.deepEqual(
    live.calls.map(({ command, args }) => `${command} ${args.join(" ")}`),
    [...allowed],
  );
  for (const call of live.calls) {
    const command = `${call.command} ${call.args.join(" ")}`;
    assert.equal(
      /^(?:git (?:push|merge|checkout|switch|reset|clean)|gh (?:workflow run|pr (?:create|close|merge))|.*\bdeploy\b)/u.test(
        command,
      ),
      false,
      command,
    );
  }
});

test("live evidence is emitted only after a successful live preflight", () => {
  withFixture({}, ({ root }) => {
    const validation = validateRepository(root);
    const failed = selectNextTask(validation, {
      ok: false,
      diagnostics: [{ code: "LIVE_OPEN_PRS", message: "open PR" }],
      evidence: null,
    });
    assert.equal(failed.valid, false);
    assert.equal(failed.evidenceMode, "repository-only");
    assert.equal(Object.hasOwn(failed, "liveEvidence"), false);

    const incompleteEvidence = {
      ok: true,
      diagnostics: [],
      evidence: { headSha: "a".repeat(40) },
    };
    const refused = selectNextTask(validation, incompleteEvidence);
    assert.equal(refused.valid, false);
    assert.equal(refused.evidenceMode, "repository-only");
    assert.equal(refused.blockers.at(-1).code, "LIVE_EVIDENCE_INVALID");

    const evidence = {
      ok: true,
      diagnostics: [],
      evidence: {
        repository: "example/glassbeadgame",
        repositoryRoot: root,
        gitTopLevel: root,
        defaultBranch: "main",
        headSha: "a".repeat(40),
        originRef: "origin/main",
        originSha: "a".repeat(40),
        remoteSha: "a".repeat(40),
        worktreeClean: true,
        authenticatedGitHubMetadata: true,
        openPullRequestCount: 0,
        qualityGates: {
          runId: 42,
          runUrl: "https://github.example/runs/42",
          status: "completed",
          conclusion: "success",
        },
        commandsWereReadOnly: true,
      },
    };
    const passed = selectNextTask(validation, evidence);
    assert.equal(passed.valid, true);
    assert.equal(passed.evidenceMode, "live-verified");
    assert.match(passed.evidenceStatement, /protection configuration was not reverified/u);
    assert.deepEqual(passed.liveEvidence, evidence.evidence);
  });
});
