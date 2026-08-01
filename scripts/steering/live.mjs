import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { relative, resolve } from "node:path";

function diagnostic(code, message) {
  return { code, message };
}

export function createReadOnlyCommandRunner() {
  return (command, args, options = {}) => {
    const result = spawnSync(command, args, {
      cwd: options.cwd,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
      shell: false,
    });
    return {
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      error: result.error ?? null,
    };
  };
}

function run(runner, root, command, args) {
  const result = runner(command, args, { cwd: root });
  if (
    !result ||
    result.error ||
    result.status !== 0 ||
    typeof result.stdout !== "string"
  ) {
    const detail =
      result?.error?.message ||
      result?.stderr?.trim() ||
      `exit status ${String(result?.status)}`;
    throw new Error(`${command} ${args.join(" ")} failed: ${detail}`);
  }
  return result.stdout.trim();
}

function parseJson(commandLabel, value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${commandLabel} returned malformed JSON: ${error.message}`);
  }
}

export function runLivePreflight({
  root = process.cwd(),
  runner = createReadOnlyCommandRunner(),
} = {}) {
  const absoluteRoot = resolve(root);
  const diagnostics = [];
  let canonicalRoot;
  try {
    canonicalRoot = realpathSync(absoluteRoot);
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        diagnostic("LIVE_ROOT_UNRESOLVABLE", error.message),
      ],
      evidence: null,
    };
  }
  let gitTopLevel;
  try {
    const reportedTopLevel = run(runner, canonicalRoot, "git", [
      "--no-optional-locks",
      "rev-parse",
      "--show-toplevel",
    ]);
    gitTopLevel = realpathSync(reportedTopLevel);
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        diagnostic("LIVE_GIT_UNAVAILABLE", error.message),
      ],
      evidence: null,
    };
  }
  if (relative(canonicalRoot, gitTopLevel) !== "") {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "LIVE_ROOT_NOT_GIT_TOPLEVEL",
          `Live root ${canonicalRoot} is not the canonical Git toplevel ${gitTopLevel}.`,
        ),
      ],
      evidence: null,
    };
  }

  let cleanStatus;
  try {
    cleanStatus = run(runner, canonicalRoot, "git", [
      "--no-optional-locks",
      "status",
      "--porcelain",
    ]);
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        diagnostic("LIVE_GIT_UNAVAILABLE", error.message),
      ],
      evidence: null,
    };
  }
  if (cleanStatus !== "") {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "LIVE_DIRTY_WORKTREE",
          "Live preflight requires a clean worktree, including no untracked files.",
        ),
      ],
      evidence: null,
    };
  }

  try {
    run(runner, canonicalRoot, "gh", ["auth", "status"]);
  } catch (error) {
    return {
      ok: false,
      diagnostics: [diagnostic("LIVE_GH_AUTH_UNAVAILABLE", error.message)],
      evidence: null,
    };
  }

  let repository;
  try {
    repository = parseJson(
      "gh repo view",
      run(runner, canonicalRoot, "gh", [
        "repo",
        "view",
        "--json",
        "nameWithOwner,defaultBranchRef",
      ]),
    );
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        diagnostic("LIVE_GITHUB_METADATA_UNAVAILABLE", error.message),
      ],
      evidence: null,
    };
  }
  const defaultBranch = repository?.defaultBranchRef?.name;
  const repositoryName = repository?.nameWithOwner;
  if (
    typeof defaultBranch !== "string" ||
    defaultBranch === "" ||
    typeof repositoryName !== "string" ||
    repositoryName === ""
  ) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "LIVE_GITHUB_METADATA_INVALID",
          "GitHub metadata did not identify the repository and default branch.",
        ),
      ],
      evidence: null,
    };
  }

  let remoteSha;
  try {
    remoteSha = run(runner, canonicalRoot, "gh", [
      "api",
      `repos/${repositoryName}/commits/${encodeURIComponent(defaultBranch)}`,
      "--jq",
      ".sha",
    ]);
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        diagnostic("LIVE_REMOTE_HEAD_UNAVAILABLE", error.message),
      ],
      evidence: null,
    };
  }
  if (!/^[0-9a-f]{40}$/u.test(remoteSha)) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "LIVE_REMOTE_HEAD_INVALID",
          `GitHub returned an invalid default-branch commit SHA: ${JSON.stringify(remoteSha)}.`,
        ),
      ],
      evidence: null,
    };
  }

  let currentBranch;
  let headSha;
  let originSha;
  try {
    currentBranch = run(runner, canonicalRoot, "git", [
      "--no-optional-locks",
      "branch",
      "--show-current",
    ]);
    headSha = run(runner, canonicalRoot, "git", [
      "--no-optional-locks",
      "rev-parse",
      "HEAD",
    ]);
    originSha = run(runner, canonicalRoot, "git", [
      "--no-optional-locks",
      "rev-parse",
      `origin/${defaultBranch}`,
    ]);
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        diagnostic("LIVE_GIT_METADATA_UNAVAILABLE", error.message),
      ],
      evidence: null,
    };
  }
  if (currentBranch !== defaultBranch) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "LIVE_NOT_DEFAULT_BRANCH",
          `Current branch is ${currentBranch || "(detached)"}, not default branch ${defaultBranch}.`,
        ),
      ],
      evidence: null,
    };
  }
  if (headSha !== originSha) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "LIVE_HEAD_NOT_ORIGIN",
          `Local HEAD ${headSha} does not equal origin/${defaultBranch} ${originSha}.`,
        ),
      ],
      evidence: null,
    };
  }
  if (headSha !== remoteSha) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "LIVE_HEAD_NOT_REMOTE",
          `Local HEAD ${headSha} and origin/${defaultBranch} do not equal current GitHub ${defaultBranch} SHA ${remoteSha}.`,
        ),
      ],
      evidence: null,
    };
  }

  let openPullRequests;
  try {
    openPullRequests = parseJson(
      "gh pr list",
      run(runner, canonicalRoot, "gh", [
        "pr",
        "list",
        "--state",
        "open",
        "--limit",
        "100",
        "--json",
        "number,title,headRefName,baseRefName",
      ]),
    );
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        diagnostic("LIVE_OPEN_PRS_UNVERIFIABLE", error.message),
      ],
      evidence: null,
    };
  }
  if (!Array.isArray(openPullRequests)) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "LIVE_OPEN_PRS_UNVERIFIABLE",
          "GitHub open-PR response was not an array.",
        ),
      ],
      evidence: null,
    };
  }
  if (openPullRequests.length > 0) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "LIVE_OPEN_PRS",
          `Live preflight requires no open pull request; found ${openPullRequests.map((entry) => `#${entry.number}`).join(", ")}.`,
        ),
      ],
      evidence: null,
    };
  }

  let runs;
  try {
    runs = parseJson(
      "gh run list",
      run(runner, canonicalRoot, "gh", [
        "run",
        "list",
        "--workflow",
        "ci.yml",
        "--branch",
        defaultBranch,
        "--event",
        "push",
        "--limit",
        "50",
        "--json",
        "databaseId,headSha,status,conclusion,workflowName,createdAt",
      ]),
    );
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        diagnostic("LIVE_QUALITY_GATES_UNVERIFIABLE", error.message),
      ],
      evidence: null,
    };
  }
  if (!Array.isArray(runs)) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "LIVE_QUALITY_GATES_UNVERIFIABLE",
          "GitHub workflow-run response was not an array.",
        ),
      ],
      evidence: null,
    };
  }
  const exactRun = runs.find((entry) => entry?.headSha === headSha);
  if (!exactRun) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "LIVE_EXACT_MAIN_RUN_MISSING",
          `No CI push run was found for exact ${defaultBranch} HEAD ${headSha}.`,
        ),
      ],
      evidence: null,
    };
  }
  if (exactRun.status !== "completed" || exactRun.conclusion !== "success") {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "LIVE_EXACT_MAIN_RUN_NOT_SUCCESSFUL",
          `Exact-main CI run ${exactRun.databaseId} is ${exactRun.status}/${exactRun.conclusion || "no conclusion"}, not completed/success.`,
        ),
      ],
      evidence: null,
    };
  }

  let runDetails;
  try {
    runDetails = parseJson(
      "gh run view",
      run(runner, canonicalRoot, "gh", [
        "run",
        "view",
        String(exactRun.databaseId),
        "--json",
        "jobs,url",
      ]),
    );
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        diagnostic("LIVE_QUALITY_GATES_UNVERIFIABLE", error.message),
      ],
      evidence: null,
    };
  }
  const qualityGate = Array.isArray(runDetails?.jobs)
    ? runDetails.jobs.find((job) => job?.name === "Quality Gates")
    : null;
  if (
    !qualityGate ||
    qualityGate.status !== "completed" ||
    qualityGate.conclusion !== "success"
  ) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "LIVE_QUALITY_GATES_NOT_SUCCESSFUL",
          "The exact-main run does not contain a completed, successful Quality Gates job.",
        ),
      ],
      evidence: null,
    };
  }

  return {
    ok: true,
    diagnostics,
    evidence: {
      repository: repositoryName,
      repositoryRoot: canonicalRoot,
      gitTopLevel,
      defaultBranch,
      headSha,
      originRef: `origin/${defaultBranch}`,
      originSha,
      remoteSha,
      worktreeClean: true,
      authenticatedGitHubMetadata: true,
      openPullRequestCount: 0,
      qualityGates: {
        runId: exactRun.databaseId,
        runUrl: runDetails.url,
        status: qualityGate.status,
        conclusion: qualityGate.conclusion,
      },
      commandsWereReadOnly: true,
    },
  };
}
