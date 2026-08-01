# Steering Harness v2

## Purpose

The steering harness turns the reviewed task index and active task packets into
a deterministic execution contract. It is designed to let Codex complete more
of one well-bounded task without repeated direction while keeping the
repository's existing safety boundary:

- one task, one branch, and one reviewable pull request;
- no automatic merge, deployment, branch mutation, or next-task chaining;
- no inferred product decision or human acceptance;
- the reviewed Markdown packet remains authoritative.

The harness is read-only. It validates and reports; it never edits a task,
changes Git state, or calls a GitHub write operation.

## Commands

| Command | Purpose | External evidence |
| --- | --- | --- |
| `npm run steering:test` | Run deterministic parser, validator, selector, live-preflight, and immutability fixtures. | None |
| `npm run steering:check` | Validate the real task index and active packets. | None |
| `npm run steering:next -- --json` | Report the first locally eligible Ready task in index order, or an explicit no-Ready result. | Repository only |
| `npm run steering:next -- --json --live` | Perform the same selection after proving the live start preconditions. | Read-only local Git and GitHub CLI |

`steering:check` and repository-only `steering:next` are deterministic and
offline. A valid no-Ready result is not an error and authorizes no work.
Malformed or unsafe repository state fails closed with actionable diagnostics.

`next --json` emits a schema version, eligibility, evidence mode and statement,
the selected task contract when present, every considered candidate and
blocker, the autonomy boundary, and live evidence only after every live check
passes. Exit code 0 means valid repository state, including an explicit
no-Ready result; exit code 1 means invalid state or a refused live preflight;
exit code 2 means invalid CLI usage.

## Authority and contract

`docs/tasks/README.md` supplies queue order and task status. Each new Ready task
must contain a schema-version-1 `Steering contract` JSON block that projects the
run-critical parts of the human packet:

```json
{
  "schemaVersion": 1,
  "taskId": "M3-001",
  "branch": "codex/M3-001-short-name",
  "dependencies": ["M2-011"],
  "requiredReading": ["AGENTS.md", "docs/tasks/M3-001-short-name.md"],
  "ownership": {
    "paths": ["src/example/**"],
    "boundaries": ["example-boundary"]
  },
  "unresolvedDecisions": [],
  "requiredChecks": ["npm ci", "npm test", "git diff --check"],
  "humanReview": ["product-specification"],
  "stopBoundary": "reviewable-pr"
}
```

The contract does not replace prose acceptance criteria, implementation
constraints, or the human-review section. Validation rejects drift between the
contract and its human packet. New packets make that comparison unambiguous:

- `Owned scope` contains `### Declared paths` and
  `### Declared boundaries`, each with one leading backticked value per bullet;
- `Required tests and checks` contains one leading backticked executable command
  per declared command check; and
- `Human review boundary` contains `### Declared categories`, with one leading
  backticked category per bullet.

The listed order, task ID, dependency IDs, required reading, ownership, command
checks, and human-review categories must match the JSON projection exactly.
Prose can impose additional acceptance and self-review obligations; the
contract cannot weaken them. Historical Done packets remain valid as legacy
records, and the pre-v2 M2-011 Review packet may omit a contract; new Ready
packets cannot use either exception.

## What validation proves

Repository validation checks:

- unique, known task IDs and supported statuses;
- task filename, title, status, index section, and contract agreement;
- complete active-packet headings and valid contract JSON;
- exact Ready queue order without missing or duplicate entries;
- normalized explicit and range dependencies, including missing, non-Done, and
  cyclic dependencies;
- no unresolved decisions on a Ready task;
- a valid `codex/` branch, non-empty ownership, acceptance criteria, checks,
  human-review categories, and `reviewable-pr` stop boundary;
- every required `npm run` check exists in `package.json`.

Selection then considers Ready tasks in their declared order. It emits the task
identity, task file, branch, dependencies and statuses, required reading,
ownership, unresolved decisions, required checks, human-review categories,
stop boundary, blockers, and evidence mode. It does not inspect code or decide
that two vaguely described ownership claims are compatible; ambiguity remains
a reason to stop.

## Repository-only and live evidence

Repository-only output always states that GitHub and open-work state were not
verified. It is useful for authoring, CI, and inspection, but it is insufficient
to start an autonomous task.

The explicit live mode uses only read operations and refuses selection unless:

1. the requested repository root is exactly the canonical Git worktree root;
2. the worktree is clean;
3. the current branch is the repository default branch;
4. local `HEAD` exactly equals `origin/<default>`;
5. that SHA also equals GitHub's current default-branch SHA;
6. authenticated GitHub repository metadata is available;
7. there are no open pull requests; and
8. the latest Quality Gates run for that exact default-branch commit succeeded.

Live mode does not fetch or repair stale state. The operator must do that
outside the harness and rerun it. A task branch is therefore expected to fail
the live-start preflight.

## Single-task operating sequence

1. On a clean, explicitly updated default branch, install from the lockfile.
2. Run `npm run steering:check`.
3. Run `npm run steering:next -- --json --live`.
4. Stop if the result is invalid, unverified, blocked, or has no eligible task.
5. Read the emitted task packet and every required-reading file; resolve any
   conflict in favor of the repository authority order.
6. Create the emitted isolated branch and record the concise plan.
7. Implement only that task, run every declared check, self-review, and record
   truthful evidence.
8. Open one reviewable pull request and stop. Never select another task in the
   same run, even if the pull request is later merged.

An explicitly assigned supervised task still requires its reviewed packet and
all task checks. Assignment can identify the task, but it does not waive scope,
human review, or the pull-request stop.

## Human review remains semantic

The harness can prove syntax, internal consistency, and observed automation
state. It cannot approve:

- product or specification choices;
- content truth or evidence classification;
- event compatibility or persistence migration safety;
- accessibility-sensitive interaction;
- dependency-major or deployment changes;
- audiovisual comfort, pacing, legibility, or artistic quality.

Those categories remain mandatory review items even when every automated check
passes. A merged implementation and successful CI likewise do not imply that a
separate director playtest gate passed.

## CI behavior

`Quality Gates` runs `steering:test` and `steering:check` immediately after the
lockfile install. These pure checks add no workflow permission and do not alter
CI triggers or the separate Pages deployment workflow. Live preflight is
intentionally excluded from CI because a pull-request runner is not a clean,
exact default-branch task-start context.

## Adding a Ready task

Before placing a task in the Ready queue:

1. give it objective acceptance criteria, required checks, owned paths and
   architectural boundaries, and a specific human-review section;
2. resolve every product decision required to implement it;
3. list only dependencies that are present and Done;
4. use the declared-path, declared-boundary, command-bullet, and
   declared-category formats above, then add a schema-version-1 steering
   contract whose projection matches them exactly;
5. add it once, in intended selection order, under `Ready queue`;
6. run `npm run steering:test`, `npm run steering:check`, and repository-only
   `npm run steering:next -- --json`.

Do not mark work Ready merely to make the selector produce an answer. Silence
is the correct result when no task is safe to begin.
