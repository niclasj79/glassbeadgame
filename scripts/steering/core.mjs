import {
  existsSync,
  realpathSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export const CONTRACT_SCHEMA_VERSION = 1;

export const TASK_STATUSES = Object.freeze([
  "Draft",
  "Blocked",
  "Ready",
  "In progress",
  "Review",
  "Done",
  "Superseded",
]);

const TASK_ID_PATTERN = "M\\d+-\\d{3}";
const TASK_ID_RE = new RegExp(`^${TASK_ID_PATTERN}$`, "u");
const TASK_FILENAME_RE = new RegExp(`^(${TASK_ID_PATTERN})-(.+)\\.md$`, "u");
const ACTIVE_PACKET_STATUSES = new Set(["Ready", "In progress", "Review"]);
const CONTRACT_REQUIRED_STATUSES = new Set(["Ready", "In progress"]);
const ACTIVE_OWNERSHIP_STATUSES = new Set(["In progress", "Review"]);

const REQUIRED_ACTIVE_HEADINGS = Object.freeze([
  ["Dependencies"],
  ["Objective"],
  ["Required reading"],
  ["Owned scope"],
  ["Acceptance criteria"],
  ["Required tests and checks", "Required checks"],
  ["Expected completion report"],
  ["Human review boundary", "Human review", "Human review requirements"],
]);

const INDEX_STATUS_SECTIONS = Object.freeze({
  "ready queue": "Ready",
  "in progress": "In progress",
  "in review": "Review",
  "blocked queue": "Blocked",
  completed: "Done",
  superseded: "Superseded",
});

const CONTRACT_KEYS = Object.freeze([
  "schemaVersion",
  "taskId",
  "branch",
  "dependencies",
  "requiredReading",
  "ownership",
  "unresolvedDecisions",
  "requiredChecks",
  "humanReview",
  "stopBoundary",
]);

function diagnostic(code, message, details = {}) {
  return { code, message, ...details };
}

function normalizePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\/+/u, "");
}

function normalizeHeading(value) {
  return value.trim().toLowerCase().replace(/\s+/gu, " ");
}

function stripMarkdown(value) {
  return value
    .trim()
    .replace(/^`|`$/gu, "")
    .replace(/^\*\*|\*\*$/gu, "")
    .replace(/[.;:]$/u, "")
    .trim();
}

function unique(values) {
  return [...new Set(values)];
}

function arraysEqual(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isNonEmptyStringArray(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === "string" && entry.trim() !== "")
  );
}

function isStringArray(value) {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "string" && entry.trim() !== "")
  );
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function isSafeRepositoryPath(value, allowGlob) {
  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    value !== value.trim() ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.includes("://") ||
    value.startsWith("/") ||
    /^[A-Za-z]:/u.test(value)
  ) {
    return false;
  }
  if (!allowGlob && /[*?[\]{}]/u.test(value)) return false;
  return !value
    .split("/")
    .some(
      (segment) =>
        segment === ".." || segment === "." || segment === "",
    );
}

export function parseMarkdownSections(markdown) {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const sections = new Map();
  const duplicates = [];
  let current = null;
  let fence = null;

  for (const line of lines) {
    const fenceMatch = /^\s*(`{3,}|~{3,})/u.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fence) {
        fence = { character: marker[0], length: marker.length };
      } else if (
        marker[0] === fence.character &&
        marker.length >= fence.length
      ) {
        fence = null;
      }
      if (current) current.lines.push(line);
      continue;
    }
    const heading = fence ? null : /^##\s+(.+?)\s*$/u.exec(line);
    if (heading) {
      const label = heading[1].trim();
      const key = normalizeHeading(label);
      if (sections.has(key)) duplicates.push(label);
      current = { label, lines: [] };
      sections.set(key, current);
      continue;
    }
    if (current) current.lines.push(line);
  }

  for (const section of sections.values()) {
    section.body = section.lines.join("\n").trim();
    delete section.lines;
  }

  return { sections, duplicates };
}

function parseMarkdownSubsections(markdown) {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const sections = new Map();
  const duplicates = [];
  let current = null;
  let fence = null;

  for (const line of lines) {
    const fenceMatch = /^\s*(`{3,}|~{3,})/u.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fence) {
        fence = { character: marker[0], length: marker.length };
      } else if (
        marker[0] === fence.character &&
        marker.length >= fence.length
      ) {
        fence = null;
      }
      if (current) current.lines.push(line);
      continue;
    }
    const heading = fence ? null : /^###\s+(.+?)\s*$/u.exec(line);
    if (heading) {
      const label = heading[1].trim();
      const key = normalizeHeading(label);
      if (sections.has(key)) duplicates.push(label);
      current = { label, lines: [] };
      sections.set(key, current);
      continue;
    }
    if (/^##\s+/u.test(line)) {
      current = null;
      continue;
    }
    if (current) current.lines.push(line);
  }

  for (const section of sections.values()) {
    section.body = section.lines.join("\n").trim();
    delete section.lines;
  }
  return { sections, duplicates };
}

function parseLeadingProjectionBullets(body) {
  const values = [];
  let started = false;
  for (const line of body.replace(/\r\n?/gu, "\n").split("\n")) {
    if (line.trim() === "" && !started) continue;
    const match = /^\s*-\s+`([^`\n]+)`\s*$/u.exec(line);
    if (!match) break;
    started = true;
    values.push(match[1]);
  }
  return values;
}

function findTaskTitle(markdown) {
  let fence = null;
  for (const line of markdown.replace(/\r\n?/gu, "\n").split("\n")) {
    const fenceMatch = /^\s*(`{3,}|~{3,})/u.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fence) {
        fence = { character: marker[0], length: marker.length };
      } else if (
        marker[0] === fence.character &&
        marker.length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }
    if (fence) continue;
    const match = new RegExp(
      `^#\\s+(${TASK_ID_PATTERN})\\s+[—-]\\s+(.+?)\\s*$`,
      "u",
    ).exec(line);
    if (match) return match;
  }
  return null;
}

function sectionByAliases(sections, aliases) {
  for (const alias of aliases) {
    const section = sections.get(normalizeHeading(alias));
    if (section) return section;
  }
  return null;
}

function expandTaskRange(start, end) {
  const startMatch = /^(M\d+)-(\d{3})$/u.exec(start);
  const endMatch = /^(M\d+)-(\d{3})$/u.exec(end);
  if (!startMatch || !endMatch || startMatch[1] !== endMatch[1]) return null;
  const first = Number.parseInt(startMatch[2], 10);
  const last = Number.parseInt(endMatch[2], 10);
  if (last < first || last - first > 999) return null;
  const result = [];
  for (let value = first; value <= last; value += 1) {
    result.push(`${startMatch[1]}-${String(value).padStart(3, "0")}`);
  }
  return result;
}

export function parseDependencyIds(body) {
  const ids = [];
  const invalidRanges = [];
  const token = new RegExp(
    `\\b(${TASK_ID_PATTERN})(?:\\s+(?:through|to)\\s+|\\s*[–—]\\s*)(${TASK_ID_PATTERN})\\b|\\b(${TASK_ID_PATTERN})\\b`,
    "giu",
  );
  for (const line of body.replace(/\r\n?/gu, "\n").split("\n")) {
    const positiveClauses = line.replace(
      new RegExp(
        `\\b${TASK_ID_PATTERN}\\s+is\\s+not\\s+(?:a\\s+)?dependency\\b`,
        "giu",
      ),
      "",
    );
    token.lastIndex = 0;
    let match;
    while ((match = token.exec(positiveClauses)) !== null) {
      if (match[1] && match[2]) {
        const expanded = expandTaskRange(match[1], match[2]);
        if (!expanded) {
          invalidRanges.push(`${match[1]} through ${match[2]}`);
        } else {
          ids.push(...expanded);
        }
      } else if (match[3]) {
        ids.push(match[3]);
      }
    }
  }
  return { ids: unique(ids), invalidRanges };
}

export function parseRequiredReading(body) {
  const paths = [];
  const quoted = /`([^`\n]+)`/gu;
  let match;
  while ((match = quoted.exec(body)) !== null) {
    const value = normalizePath(match[1].trim());
    if (
      value !== "" &&
      !value.includes("::") &&
      !value.startsWith("?") &&
      (value.includes("/") ||
        value.startsWith(".") ||
        /\.[A-Za-z0-9]+$/u.test(value))
    ) {
      paths.push(value);
    }
  }
  return unique(paths);
}

function findDuplicateJsonKeys(source) {
  let index = 0;
  const duplicates = [];

  const skipWhitespace = () => {
    while (/\s/u.test(source[index] ?? "")) index += 1;
  };

  const parseString = () => {
    const start = index;
    index += 1;
    while (index < source.length) {
      if (source[index] === "\\") {
        index += 2;
      } else if (source[index] === '"') {
        index += 1;
        return JSON.parse(source.slice(start, index));
      } else {
        index += 1;
      }
    }
    return "";
  };

  const parseValue = (path) => {
    skipWhitespace();
    if (source[index] === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      while (index < source.length && source[index] !== "}") {
        const key = parseString();
        const keyPath = [...path, key].join(".");
        if (keys.has(key)) duplicates.push(keyPath);
        keys.add(key);
        skipWhitespace();
        index += 1; // colon; JSON.parse already established valid syntax.
        parseValue([...path, key]);
        skipWhitespace();
        if (source[index] === ",") {
          index += 1;
          skipWhitespace();
        } else {
          break;
        }
      }
      index += 1;
      return;
    }
    if (source[index] === "[") {
      index += 1;
      let item = 0;
      skipWhitespace();
      while (index < source.length && source[index] !== "]") {
        parseValue([...path, String(item)]);
        item += 1;
        skipWhitespace();
        if (source[index] === ",") {
          index += 1;
          skipWhitespace();
        } else {
          break;
        }
      }
      index += 1;
      return;
    }
    if (source[index] === '"') {
      parseString();
      return;
    }
    while (
      index < source.length &&
      ![",", "]", "}"].includes(source[index])
    ) {
      index += 1;
    }
  };

  parseValue([]);
  return duplicates;
}

function parseTaskContract(sectionBody, taskFile, diagnostics) {
  const fences = [
    ...sectionBody.matchAll(/```json\s*([\s\S]*?)```/giu),
  ];
  if (fences.length === 0) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_JSON_MISSING",
        "The Steering contract section must contain one fenced JSON object.",
        { file: taskFile },
      ),
    );
    return null;
  }
  if (fences.length !== 1) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_JSON_MULTIPLE",
        `The Steering contract section must contain exactly one fenced JSON object; found ${fences.length}.`,
        { file: taskFile },
      ),
    );
  }

  let contract;
  try {
    contract = JSON.parse(fences[0][1]);
  } catch (error) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_JSON_INVALID",
        `Steering contract JSON is malformed: ${error.message}`,
        { file: taskFile },
      ),
    );
    return null;
  }
  const duplicateKeys = findDuplicateJsonKeys(fences[0][1]);
  if (duplicateKeys.length > 0) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_JSON_DUPLICATE_KEY",
        `Steering contract JSON repeats object key(s): ${unique(duplicateKeys).join(", ")}.`,
        { file: taskFile },
      ),
    );
  }

  if (!isPlainObject(contract)) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_SHAPE_INVALID",
        "The Steering contract must be a JSON object.",
        { file: taskFile },
      ),
    );
    return null;
  }

  const unknownKeys = Object.keys(contract).filter(
    (key) => !CONTRACT_KEYS.includes(key),
  );
  const missingKeys = CONTRACT_KEYS.filter(
    (key) => !Object.hasOwn(contract, key),
  );
  if (unknownKeys.length > 0) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_UNKNOWN_FIELDS",
        `Steering contract contains unknown field(s): ${unknownKeys.join(", ")}.`,
        { file: taskFile },
      ),
    );
  }
  if (missingKeys.length > 0) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_FIELDS_MISSING",
        `Steering contract is missing field(s): ${missingKeys.join(", ")}.`,
        { file: taskFile },
      ),
    );
  }

  if (contract.schemaVersion !== CONTRACT_SCHEMA_VERSION) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_SCHEMA_UNSUPPORTED",
        `Expected steering schemaVersion ${CONTRACT_SCHEMA_VERSION}; received ${JSON.stringify(contract.schemaVersion)}.`,
        { file: taskFile },
      ),
    );
  }
  if (typeof contract.taskId !== "string" || !TASK_ID_RE.test(contract.taskId)) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_TASK_ID_INVALID",
        "Steering contract taskId must be an explicit task ID such as M3-001.",
        { file: taskFile },
      ),
    );
  }
  if (typeof contract.branch !== "string") {
    diagnostics.push(
      diagnostic(
        "CONTRACT_BRANCH_INVALID",
        "Steering contract branch must be a string.",
        { file: taskFile },
      ),
    );
  }
  if (
    !isStringArray(contract.dependencies) ||
    contract.dependencies.some((entry) => !TASK_ID_RE.test(entry))
  ) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_DEPENDENCIES_INVALID",
        "Steering contract dependencies must be an array of explicit task IDs.",
        { file: taskFile },
      ),
    );
  }
  if (!isNonEmptyStringArray(contract.requiredReading)) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_READING_INVALID",
        "Steering contract requiredReading must be a non-empty string array.",
        { file: taskFile },
      ),
    );
  }
  for (const path of Array.isArray(contract.requiredReading)
    ? contract.requiredReading
    : []) {
    if (typeof path === "string" && !isSafeRepositoryPath(path, false)) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_READING_PATH_UNSAFE",
          `Required reading must be a forward-slash repository-relative file path: ${JSON.stringify(path)}.`,
          { file: taskFile },
        ),
      );
    }
  }
  if (
    !isPlainObject(contract.ownership) ||
    !isNonEmptyStringArray(contract.ownership.paths) ||
    !isNonEmptyStringArray(contract.ownership.boundaries)
  ) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_OWNERSHIP_EMPTY",
        "Steering contract ownership must contain non-empty paths and boundaries arrays.",
        { file: taskFile },
      ),
    );
  }
  if (isPlainObject(contract.ownership)) {
    for (const path of Array.isArray(contract.ownership.paths)
      ? contract.ownership.paths
      : []) {
      if (typeof path === "string" && !isSafeRepositoryPath(path, true)) {
        diagnostics.push(
          diagnostic(
            "CONTRACT_OWNERSHIP_PATH_UNSAFE",
            `Ownership path must be a forward-slash repository-relative path or glob: ${JSON.stringify(path)}.`,
            { file: taskFile },
          ),
        );
      }
    }
    for (const boundary of Array.isArray(contract.ownership.boundaries)
      ? contract.ownership.boundaries
      : []) {
      if (
        typeof boundary === "string" &&
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(boundary)
      ) {
        diagnostics.push(
          diagnostic(
            "CONTRACT_OWNERSHIP_BOUNDARY_INVALID",
            `Ownership boundary must be a lowercase kebab-case identifier: ${JSON.stringify(boundary)}.`,
            { file: taskFile },
          ),
        );
      }
    }
  }
  if (!isStringArray(contract.unresolvedDecisions)) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_DECISIONS_INVALID",
        "Steering contract unresolvedDecisions must be a string array.",
        { file: taskFile },
      ),
    );
  }
  if (!isNonEmptyStringArray(contract.requiredChecks)) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_CHECKS_EMPTY",
        "Steering contract requiredChecks must be a non-empty string array.",
        { file: taskFile },
      ),
    );
  }
  if (!isNonEmptyStringArray(contract.humanReview)) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_HUMAN_REVIEW_EMPTY",
        "Steering contract humanReview must be a non-empty string array.",
        { file: taskFile },
      ),
    );
  }
  if (contract.stopBoundary !== "reviewable-pr") {
    diagnostics.push(
      diagnostic(
        "CONTRACT_STOP_BOUNDARY_INVALID",
        "Steering contract stopBoundary must be exactly \"reviewable-pr\".",
        { file: taskFile },
      ),
    );
  }

  for (const key of [
    "dependencies",
    "requiredReading",
    "unresolvedDecisions",
    "requiredChecks",
    "humanReview",
  ]) {
    if (!Array.isArray(contract[key])) continue;
    const duplicates = duplicateValues(contract[key]);
    if (duplicates.length > 0) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_ARRAY_DUPLICATE",
          `Steering contract ${key} repeats: ${duplicates.join(", ")}.`,
          { file: taskFile },
        ),
      );
    }
  }
  if (isPlainObject(contract.ownership)) {
    for (const key of ["paths", "boundaries"]) {
      if (!Array.isArray(contract.ownership[key])) continue;
      const duplicates = duplicateValues(contract.ownership[key]);
      if (duplicates.length > 0) {
        diagnostics.push(
          diagnostic(
            "CONTRACT_ARRAY_DUPLICATE",
            `Steering contract ownership.${key} repeats: ${duplicates.join(", ")}.`,
            { file: taskFile },
          ),
        );
      }
    }
  }

  return contract;
}

export function parseTaskPacket({ markdown, filename }) {
  const diagnostics = [];
  const normalizedFile = normalizePath(`docs/tasks/${filename}`);
  const filenameMatch = TASK_FILENAME_RE.exec(filename);
  if (!filenameMatch) {
    diagnostics.push(
      diagnostic(
        "TASK_FILENAME_INVALID",
        "Task filename must begin with an ID such as M3-001 and end in .md.",
        { file: normalizedFile },
      ),
    );
  }
  const filenameTaskId = filenameMatch?.[1] ?? null;
  const titleMatch = findTaskTitle(markdown);
  if (!titleMatch) {
    diagnostics.push(
      diagnostic(
        "TASK_TITLE_INVALID",
        "Task title must start with its task ID and an em dash.",
        { file: normalizedFile },
      ),
    );
  }
  const titleTaskId = titleMatch?.[1] ?? null;
  const title = titleMatch?.[2]?.trim() ?? "";
  if (filenameTaskId && titleTaskId && filenameTaskId !== titleTaskId) {
    diagnostics.push(
      diagnostic(
        "TASK_FILENAME_TITLE_MISMATCH",
        `Filename ID ${filenameTaskId} does not match title ID ${titleTaskId}.`,
        { file: normalizedFile, taskId: titleTaskId },
      ),
    );
  }

  const { sections, duplicates } = parseMarkdownSections(markdown);
  for (const heading of duplicates) {
    diagnostics.push(
      diagnostic(
        "TASK_HEADING_DUPLICATE",
        `Task packet repeats the heading "${heading}".`,
        { file: normalizedFile, taskId: titleTaskId ?? filenameTaskId },
      ),
    );
  }

  const statusSection = sectionByAliases(sections, ["Status"]);
  const status = statusSection
    ? stripMarkdown(statusSection.body.split("\n")[0] ?? "")
    : "";
  if (!statusSection || status === "") {
    diagnostics.push(
      diagnostic(
        "TASK_STATUS_MISSING",
        "Task packet must contain a non-empty Status section.",
        { file: normalizedFile, taskId: titleTaskId ?? filenameTaskId },
      ),
    );
  } else if (!TASK_STATUSES.includes(status)) {
    diagnostics.push(
      diagnostic(
        "TASK_STATUS_INVALID",
        `Unknown task status "${status}".`,
        { file: normalizedFile, taskId: titleTaskId ?? filenameTaskId },
      ),
    );
  }

  if (ACTIVE_PACKET_STATUSES.has(status)) {
    for (const aliases of REQUIRED_ACTIVE_HEADINGS) {
      const section = sectionByAliases(sections, aliases);
      if (!section || section.body.trim() === "") {
        diagnostics.push(
          diagnostic(
            "TASK_ACTIVE_HEADING_MISSING",
            `Active task packet must contain a non-empty "${aliases[0]}" section.`,
            { file: normalizedFile, taskId: titleTaskId ?? filenameTaskId },
          ),
        );
      }
    }
  }

  const dependencySection = sectionByAliases(sections, [
    "Dependencies",
    "Dependencies and boundary",
  ]);
  const dependencies = parseDependencyIds(dependencySection?.body ?? "");
  for (const range of dependencies.invalidRanges) {
    diagnostics.push(
      diagnostic(
        "TASK_DEPENDENCY_RANGE_INVALID",
        `Dependency range cannot be normalized: ${range}.`,
        { file: normalizedFile, taskId: titleTaskId ?? filenameTaskId },
      ),
    );
  }

  const readingSection = sectionByAliases(sections, [
    "Required reading",
    "Required reading and sources",
  ]);
  const requiredReading = parseRequiredReading(readingSection?.body ?? "");
  const contractSection = sectionByAliases(sections, ["Steering contract"]);
  let contract = null;
  if (contractSection) {
    contract = parseTaskContract(
      contractSection.body,
      normalizedFile,
      diagnostics,
    );
  } else if (CONTRACT_REQUIRED_STATUSES.has(status)) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_REQUIRED",
        `${status} task packets must contain a Steering contract section.`,
        { file: normalizedFile, taskId: titleTaskId ?? filenameTaskId },
      ),
    );
  }

  const taskId = titleTaskId ?? filenameTaskId;
  if (contract && taskId && contract.taskId !== taskId) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_TASK_ID_DRIFT",
        `Steering contract taskId ${JSON.stringify(contract.taskId)} does not match packet task ID ${taskId}.`,
        { file: normalizedFile, taskId },
      ),
    );
  }
  if (
    contract &&
    Array.isArray(contract.dependencies) &&
    !arraysEqual(contract.dependencies, dependencies.ids)
  ) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_DEPENDENCY_DRIFT",
        `Steering contract dependencies ${JSON.stringify(contract.dependencies)} do not match packet dependencies ${JSON.stringify(dependencies.ids)}.`,
        { file: normalizedFile, taskId },
      ),
    );
  }
  if (
    contract &&
    isStringArray(contract.requiredReading) &&
    !arraysEqual(
      contract.requiredReading.map(normalizePath),
      requiredReading,
    )
  ) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_READING_DRIFT",
        `Steering contract requiredReading ${JSON.stringify(contract.requiredReading)} does not match packet required reading ${JSON.stringify(requiredReading)}.`,
        { file: normalizedFile, taskId },
      ),
    );
  }
  if (contract) {
    const ownedSection = sectionByAliases(sections, ["Owned scope"]);
    const ownedSubsections = parseMarkdownSubsections(
      ownedSection?.body ?? "",
    );
    for (const heading of ownedSubsections.duplicates) {
      diagnostics.push(
        diagnostic(
          "TASK_PROJECTION_HEADING_DUPLICATE",
          `Owned scope repeats projection heading "${heading}".`,
          { file: normalizedFile, taskId },
        ),
      );
    }
    const declaredPaths = parseLeadingProjectionBullets(
      ownedSubsections.sections.get("declared paths")?.body ?? "",
    );
    const declaredBoundaries = parseLeadingProjectionBullets(
      ownedSubsections.sections.get("declared boundaries")?.body ?? "",
    );
    if (
      isPlainObject(contract.ownership) &&
      isStringArray(contract.ownership.paths) &&
      !arraysEqual(contract.ownership.paths, declaredPaths)
    ) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_OWNERSHIP_PATHS_DRIFT",
          `Steering contract ownership.paths ${JSON.stringify(contract.ownership.paths)} do not match Owned scope Declared paths ${JSON.stringify(declaredPaths)}.`,
          { file: normalizedFile, taskId },
        ),
      );
    }
    if (
      isPlainObject(contract.ownership) &&
      isStringArray(contract.ownership.boundaries) &&
      !arraysEqual(contract.ownership.boundaries, declaredBoundaries)
    ) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_OWNERSHIP_BOUNDARIES_DRIFT",
          `Steering contract ownership.boundaries ${JSON.stringify(contract.ownership.boundaries)} do not match Owned scope Declared boundaries ${JSON.stringify(declaredBoundaries)}.`,
          { file: normalizedFile, taskId },
        ),
      );
    }

    const checksSection = sectionByAliases(sections, [
      "Required tests and checks",
      "Required checks",
    ]);
    const declaredChecks = parseLeadingProjectionBullets(
      checksSection?.body ?? "",
    );
    if (
      isStringArray(contract.requiredChecks) &&
      !arraysEqual(contract.requiredChecks, declaredChecks)
    ) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_REQUIRED_CHECKS_DRIFT",
          `Steering contract requiredChecks ${JSON.stringify(contract.requiredChecks)} do not match required-check command bullets ${JSON.stringify(declaredChecks)}.`,
          { file: normalizedFile, taskId },
        ),
      );
    }

    const reviewSection = sectionByAliases(sections, [
      "Human review boundary",
      "Human review",
      "Human review requirements",
    ]);
    const reviewSubsections = parseMarkdownSubsections(
      reviewSection?.body ?? "",
    );
    for (const heading of reviewSubsections.duplicates) {
      diagnostics.push(
        diagnostic(
          "TASK_PROJECTION_HEADING_DUPLICATE",
          `Human review repeats projection heading "${heading}".`,
          { file: normalizedFile, taskId },
        ),
      );
    }
    const declaredCategories = parseLeadingProjectionBullets(
      reviewSubsections.sections.get("declared categories")?.body ?? "",
    );
    if (
      isStringArray(contract.humanReview) &&
      !arraysEqual(contract.humanReview, declaredCategories)
    ) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_HUMAN_REVIEW_DRIFT",
          `Steering contract humanReview ${JSON.stringify(contract.humanReview)} does not match Human review Declared categories ${JSON.stringify(declaredCategories)}.`,
          { file: normalizedFile, taskId },
        ),
      );
    }
  }
  if (
    contract &&
    taskId &&
    typeof contract.branch === "string" &&
    !new RegExp(
      `^codex/${taskId}-[a-z0-9]+(?:-[a-z0-9]+)*$`,
      "u",
    ).test(contract.branch)
  ) {
    diagnostics.push(
      diagnostic(
        "CONTRACT_BRANCH_INVALID",
        `Branch must match codex/${taskId}-<lowercase-short-name>.`,
        { file: normalizedFile, taskId },
      ),
    );
  }
  if (
    contract &&
    Array.isArray(contract.unresolvedDecisions) &&
    contract.unresolvedDecisions.length > 0 &&
    status === "Ready"
  ) {
    diagnostics.push(
      diagnostic(
        "READY_DECISIONS_UNRESOLVED",
        `Ready task has unresolved decision(s): ${contract.unresolvedDecisions.join(", ")}.`,
        { file: normalizedFile, taskId },
      ),
    );
  }

  return {
    task: {
      taskId,
      title,
      filename,
      file: normalizedFile,
      status,
      dependencies: dependencies.ids,
      requiredReading,
      contract,
      sections,
    },
    diagnostics,
  };
}

function parseIndex(markdown) {
  const diagnostics = [];
  const { sections, duplicates } = parseMarkdownSections(markdown);
  for (const heading of duplicates) {
    diagnostics.push(
      diagnostic(
        "INDEX_HEADING_DUPLICATE",
        `Task index repeats the heading "${heading}".`,
        { file: "docs/tasks/README.md" },
      ),
    );
  }

  const entries = [];
  for (const [heading, status] of Object.entries(INDEX_STATUS_SECTIONS)) {
    const section = sections.get(heading);
    if (!section) continue;
    const lines = section.body.split("\n");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const fileMatch = /`([^`\n]+\.md)`/u.exec(line);
      if (!fileMatch) continue;
      const filename = fileMatch[1].split("/").at(-1);
      const idMatch = TASK_FILENAME_RE.exec(filename);
      const ordinalMatch = /^\s*(\d+)\.\s+/u.exec(line);
      entries.push({
        section: heading,
        status,
        filename,
        taskId: idMatch?.[1] ?? null,
        ordinal: ordinalMatch
          ? Number.parseInt(ordinalMatch[1], 10)
          : null,
        line: lineIndex + 1,
      });
    }
  }

  const readyEntries = entries.filter((entry) => entry.status === "Ready");
  readyEntries.forEach((entry, index) => {
    if (entry.ordinal !== index + 1) {
      diagnostics.push(
        diagnostic(
          "READY_QUEUE_ORDER_INVALID",
          `Ready queue entry ${entry.filename} must have ordinal ${index + 1}; received ${entry.ordinal ?? "none"}.`,
          { file: "docs/tasks/README.md", taskId: entry.taskId },
        ),
      );
    }
  });

  return { entries, diagnostics };
}

function parsePackageScripts(root, diagnostics) {
  const packageFile = join(root, "package.json");
  if (!existsSync(packageFile)) {
    diagnostics.push(
      diagnostic("PACKAGE_JSON_MISSING", "package.json is missing.", {
        file: "package.json",
      }),
    );
    return {};
  }
  try {
    const parsed = JSON.parse(readFileSync(packageFile, "utf8"));
    if (!isPlainObject(parsed.scripts)) {
      diagnostics.push(
        diagnostic(
          "PACKAGE_SCRIPTS_INVALID",
          "package.json must contain a scripts object.",
          { file: "package.json" },
        ),
      );
      return {};
    }
    return parsed.scripts;
  } catch (error) {
    diagnostics.push(
      diagnostic(
        "PACKAGE_JSON_INVALID",
        `package.json is malformed: ${error.message}`,
        { file: "package.json" },
      ),
    );
    return {};
  }
}

function requiredScript(command) {
  if (command === "npm test") return "test";
  const match = /^npm run ([A-Za-z0-9:_-]+)(?: --(?: [A-Za-z0-9_./:=@-]+)+)?$/u.exec(
    command,
  );
  return match?.[1] ?? null;
}

function validateContractChecks(task, packageScripts, diagnostics) {
  if (!task.contract || !Array.isArray(task.contract.requiredChecks)) return;
  for (const command of task.contract.requiredChecks) {
    if (typeof command !== "string") continue;
    const script = requiredScript(command);
    if (
      command !== "npm ci" &&
      command !== "npm test" &&
      command !== "git diff --check" &&
      script === null
    ) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_CHECK_COMMAND_UNSAFE",
          `Required check is outside the safe command grammar: ${JSON.stringify(command)}.`,
          { file: task.file, taskId: task.taskId },
        ),
      );
      continue;
    }
    if (script && !Object.hasOwn(packageScripts, script)) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_CHECK_SCRIPT_UNKNOWN",
          `Required check "${command}" references unknown package script "${script}".`,
          { file: task.file, taskId: task.taskId },
        ),
      );
    } else if (
      script &&
      (typeof packageScripts[script] !== "string" ||
        packageScripts[script].trim() === "")
    ) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_CHECK_SCRIPT_EMPTY",
          `Required check "${command}" references an empty package script "${script}".`,
          { file: task.file, taskId: task.taskId },
        ),
      );
    }
  }
}

function validateRequiredReading(root, task, diagnostics) {
  if (!task.contract || !Array.isArray(task.contract.requiredReading)) return;
  let canonicalRoot;
  try {
    canonicalRoot = realpathSync(root);
  } catch (error) {
    diagnostics.push(
      diagnostic(
        "REPOSITORY_ROOT_UNRESOLVABLE",
        `Repository root cannot be resolved: ${error.message}`,
        { file: task.file, taskId: task.taskId },
      ),
    );
    return;
  }
  for (const reading of task.contract.requiredReading) {
    if (typeof reading !== "string") continue;
    if (!isSafeRepositoryPath(reading, false)) continue;
    const normalized = normalizePath(reading);
    const candidate = join(root, ...normalized.split("/"));
    if (!existsSync(candidate)) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_READING_MISSING",
          `Required reading path does not exist: ${reading}.`,
          { file: task.file, taskId: task.taskId },
        ),
      );
      continue;
    }
    let canonicalReading;
    try {
      canonicalReading = realpathSync(candidate);
    } catch (error) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_READING_UNRESOLVABLE",
          `Required reading path cannot be resolved: ${reading} (${error.message}).`,
          { file: task.file, taskId: task.taskId },
        ),
      );
      continue;
    }
    const fromRoot = relative(canonicalRoot, canonicalReading);
    if (
      fromRoot === ".." ||
      fromRoot.startsWith(`..${sep}`) ||
      isAbsolute(fromRoot)
    ) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_READING_OUTSIDE_ROOT",
          `Required reading resolves outside the repository: ${reading}.`,
          { file: task.file, taskId: task.taskId },
        ),
      );
      continue;
    }
    try {
      if (!statSync(canonicalReading).isFile()) {
        diagnostics.push(
          diagnostic(
            "CONTRACT_READING_NOT_FILE",
            `Required reading is not a regular file: ${reading}.`,
            { file: task.file, taskId: task.taskId },
          ),
        );
      }
    } catch (error) {
      diagnostics.push(
        diagnostic(
          "CONTRACT_READING_UNRESOLVABLE",
          `Required reading cannot be inspected: ${reading} (${error.message}).`,
          { file: task.file, taskId: task.taskId },
        ),
      );
    }
  }
}

function staticGlobPrefix(path) {
  const normalized = normalizePath(path);
  const wildcard = normalized.search(/[*?[\]{}]/u);
  return wildcard === -1 ? normalized : normalized.slice(0, wildcard);
}

function pathPatternsOverlap(left, right) {
  const a = normalizePath(left).replace(/\/+$/u, "").toLowerCase();
  const b = normalizePath(right).replace(/\/+$/u, "").toLowerCase();
  if (a === b) return true;
  const aWildcard = /[*?[\]{}]/u.test(a);
  const bWildcard = /[*?[\]{}]/u.test(b);
  if (!aWildcard && !bWildcard) {
    return a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
  }
  const aPrefix = staticGlobPrefix(a).replace(/\/+$/u, "");
  const bPrefix = staticGlobPrefix(b).replace(/\/+$/u, "");
  if (aPrefix === "" || bPrefix === "") return true;
  return (
    aPrefix === bPrefix ||
    aPrefix.startsWith(bPrefix) ||
    bPrefix.startsWith(aPrefix)
  );
}

function ownershipConflicts(left, right) {
  const boundaries = left.contract.ownership.boundaries.filter((boundary) =>
    right.contract.ownership.boundaries.includes(boundary),
  );
  const paths = [];
  for (const leftPath of left.contract.ownership.paths) {
    for (const rightPath of right.contract.ownership.paths) {
      if (pathPatternsOverlap(leftPath, rightPath)) {
        paths.push(`${leftPath} ↔ ${rightPath}`);
      }
    }
  }
  return { boundaries: unique(boundaries), paths: unique(paths) };
}

function hasValidOwnership(contract) {
  return (
    isPlainObject(contract?.ownership) &&
    isNonEmptyStringArray(contract.ownership.paths) &&
    isNonEmptyStringArray(contract.ownership.boundaries)
  );
}

function findDependencyCycle(startTask, tasksById) {
  const visited = new Set();
  const active = [];
  const activeSet = new Set();

  function visit(taskId) {
    if (activeSet.has(taskId)) {
      const start = active.indexOf(taskId);
      return [...active.slice(start), taskId];
    }
    if (visited.has(taskId)) return null;
    visited.add(taskId);
    active.push(taskId);
    activeSet.add(taskId);
    const task = tasksById.get(taskId);
    for (const dependency of task?.dependencies ?? []) {
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    active.pop();
    activeSet.delete(taskId);
    return null;
  }

  return visit(startTask.taskId);
}

function evaluateTaskDependencies(task, tasksById) {
  const blockers = [];
  const ready = task.status === "Ready";
  const prefix = ready ? "READY" : "ACTIVE";
  if (!task.contract) {
    // Legacy Review packets may omit the steering projection, but their
    // human-readable dependencies remain authoritative and validated here.
  }
  for (const dependencyId of task.dependencies) {
    const dependency = tasksById.get(dependencyId);
    if (!dependency) {
      blockers.push(
        diagnostic(
          `${prefix}_DEPENDENCY_MISSING`,
          `${task.status} task depends on missing task ${dependencyId}.`,
          { file: task.file, taskId: task.taskId },
        ),
      );
    } else if (dependency.status !== "Done") {
      blockers.push(
        diagnostic(
          `${prefix}_DEPENDENCY_NOT_DONE`,
          `${task.status} task dependency ${dependencyId} is ${dependency.status || "invalid"}, not Done.`,
          { file: task.file, taskId: task.taskId },
        ),
      );
    }
  }
  const cycle = findDependencyCycle(task, tasksById);
  if (cycle) {
    blockers.push(
      diagnostic(
        `${prefix}_DEPENDENCY_CYCLE`,
        `${task.status} task dependency cycle: ${cycle.join(" -> ")}.`,
        { file: task.file, taskId: task.taskId },
      ),
    );
  }
  return blockers;
}

function evaluateReadyTask(task, tasks) {
  const blockers = [];
  if (!task.contract) {
    blockers.push(
      diagnostic(
        "CONTRACT_REQUIRED",
        "Ready task lacks a valid Steering contract.",
        { file: task.file, taskId: task.taskId },
      ),
    );
  }
  if (
    task.contract &&
    Array.isArray(task.contract.unresolvedDecisions) &&
    task.contract.unresolvedDecisions.length > 0
  ) {
    blockers.push(
      diagnostic(
        "READY_DECISIONS_UNRESOLVED",
        `Ready task has unresolved decision(s): ${task.contract.unresolvedDecisions.join(", ")}.`,
        { file: task.file, taskId: task.taskId },
      ),
    );
  }

  if (hasValidOwnership(task.contract)) {
    for (const activeTask of tasks) {
      if (
        !ACTIVE_OWNERSHIP_STATUSES.has(activeTask.status) ||
        activeTask.taskId === task.taskId
      ) {
        continue;
      }
      if (!hasValidOwnership(activeTask.contract)) {
        blockers.push(
          diagnostic(
            "READY_ACTIVE_OWNERSHIP_UNVERIFIABLE",
            `Ready task cannot prove non-overlap because active ${activeTask.taskId} lacks a valid steering ownership projection.`,
            { file: task.file, taskId: task.taskId },
          ),
        );
        continue;
      }
      const conflict = ownershipConflicts(task, activeTask);
      if (conflict.paths.length > 0 || conflict.boundaries.length > 0) {
        blockers.push(
          diagnostic(
            "READY_OWNERSHIP_CONFLICT",
            `Ready task overlaps active ${activeTask.taskId}: paths [${conflict.paths.join(", ")}], boundaries [${conflict.boundaries.join(", ")}].`,
            { file: task.file, taskId: task.taskId },
          ),
        );
      }
    }
  }

  return blockers;
}

function validateActiveOwnership(tasks, diagnostics) {
  const active = tasks.filter(
    (task) =>
      ACTIVE_OWNERSHIP_STATUSES.has(task.status) &&
      hasValidOwnership(task.contract),
  );
  for (let leftIndex = 0; leftIndex < active.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < active.length;
      rightIndex += 1
    ) {
      const left = active[leftIndex];
      const right = active[rightIndex];
      const conflict = ownershipConflicts(left, right);
      if (conflict.paths.length > 0 || conflict.boundaries.length > 0) {
        diagnostics.push(
          diagnostic(
            "ACTIVE_OWNERSHIP_CONFLICT",
            `Active tasks ${left.taskId} and ${right.taskId} overlap: paths [${conflict.paths.join(", ")}], boundaries [${conflict.boundaries.join(", ")}].`,
            { file: left.file, taskId: left.taskId },
          ),
        );
      }
    }
  }
}

function validateIndex(index, tasks, tasksById, diagnostics) {
  const entriesById = new Map();
  for (const entry of index.entries) {
    if (!entry.taskId) {
      diagnostics.push(
        diagnostic(
          "INDEX_TASK_FILENAME_INVALID",
          `Indexed task filename is invalid: ${entry.filename}.`,
          { file: "docs/tasks/README.md" },
        ),
      );
      continue;
    }
    const values = entriesById.get(entry.taskId) ?? [];
    values.push(entry);
    entriesById.set(entry.taskId, values);
    const task = tasksById.get(entry.taskId);
    if (!task) {
      diagnostics.push(
        diagnostic(
          "INDEX_TASK_UNKNOWN",
          `Task index references missing task ${entry.taskId} (${entry.filename}).`,
          { file: "docs/tasks/README.md", taskId: entry.taskId },
        ),
      );
      continue;
    }
    if (task.filename !== entry.filename) {
      diagnostics.push(
        diagnostic(
          "INDEX_FILENAME_MISMATCH",
          `Index filename ${entry.filename} does not match task file ${task.filename}.`,
          { file: "docs/tasks/README.md", taskId: entry.taskId },
        ),
      );
    }
    if (task.status !== entry.status) {
      diagnostics.push(
        diagnostic(
          "INDEX_STATUS_MISMATCH",
          `Index lists ${entry.taskId} as ${entry.status}, but its packet status is ${task.status || "invalid"}.`,
          { file: "docs/tasks/README.md", taskId: entry.taskId },
        ),
      );
    }
  }

  for (const [taskId, entries] of entriesById) {
    if (entries.length > 1) {
      diagnostics.push(
        diagnostic(
          "INDEX_TASK_DUPLICATE",
          `Task ${taskId} is duplicated across index sections: ${entries.map((entry) => entry.section).join(", ")}.`,
          { file: "docs/tasks/README.md", taskId },
        ),
      );
    }
  }

  for (const task of tasks) {
    if (!["Ready", "In progress", "Review", "Blocked", "Done"].includes(task.status)) {
      continue;
    }
    const entries = entriesById.get(task.taskId) ?? [];
    if (entries.length === 0) {
      diagnostics.push(
        diagnostic(
          task.status === "Ready"
            ? "READY_QUEUE_TASK_MISSING"
            : "INDEX_TASK_MISSING",
          `${task.status} task ${task.taskId} is missing from its task-index section.`,
          { file: "docs/tasks/README.md", taskId: task.taskId },
        ),
      );
    }
  }
}

export function validateRepository(root = process.cwd()) {
  const absoluteRoot = resolve(root);
  const diagnostics = [];
  const tasksDirectory = join(absoluteRoot, "docs", "tasks");
  if (!existsSync(tasksDirectory) || !statSync(tasksDirectory).isDirectory()) {
    diagnostics.push(
      diagnostic(
        "TASK_DIRECTORY_MISSING",
        "docs/tasks directory is missing.",
        { file: "docs/tasks" },
      ),
    );
    return {
      ok: false,
      root: absoluteRoot,
      diagnostics,
      tasks: [],
      index: { entries: [] },
      readyEvaluations: [],
    };
  }

  const taskFiles = readdirSync(tasksDirectory)
    .filter((filename) => filename.endsWith(".md") && filename !== "README.md")
    .sort((left, right) => left.localeCompare(right, "en"));
  const tasks = [];
  for (const filename of taskFiles) {
    const parsed = parseTaskPacket({
      markdown: readFileSync(join(tasksDirectory, filename), "utf8"),
      filename,
    });
    tasks.push(parsed.task);
    diagnostics.push(...parsed.diagnostics);
  }

  const tasksById = new Map();
  for (const task of tasks) {
    if (!task.taskId) continue;
    if (tasksById.has(task.taskId)) {
      diagnostics.push(
        diagnostic(
          "TASK_ID_DUPLICATE",
          `Task ID ${task.taskId} is declared by both ${tasksById.get(task.taskId).filename} and ${task.filename}.`,
          { file: task.file, taskId: task.taskId },
        ),
      );
    } else {
      tasksById.set(task.taskId, task);
    }
  }

  const indexFile = join(tasksDirectory, "README.md");
  let index = { entries: [], diagnostics: [] };
  if (!existsSync(indexFile)) {
    diagnostics.push(
      diagnostic("TASK_INDEX_MISSING", "docs/tasks/README.md is missing.", {
        file: "docs/tasks/README.md",
      }),
    );
  } else {
    index = parseIndex(readFileSync(indexFile, "utf8"));
    diagnostics.push(...index.diagnostics);
    validateIndex(index, tasks, tasksById, diagnostics);
  }

  const packageScripts = parsePackageScripts(absoluteRoot, diagnostics);
  for (const task of tasks) {
    validateContractChecks(task, packageScripts, diagnostics);
    validateRequiredReading(absoluteRoot, task, diagnostics);
  }

  const dependencyBlockersByTask = new Map();
  for (const task of tasks) {
    if (!ACTIVE_PACKET_STATUSES.has(task.status)) continue;
    const blockers = evaluateTaskDependencies(task, tasksById);
    dependencyBlockersByTask.set(task.taskId, blockers);
    diagnostics.push(...blockers);
  }

  validateActiveOwnership(tasks, diagnostics);

  const readyTasks = index.entries
    .filter((entry) => entry.status === "Ready")
    .map((entry) => tasksById.get(entry.taskId))
    .filter(Boolean);
  const readyEvaluations = readyTasks.map((task) => {
    const dependencyBlockers =
      dependencyBlockersByTask.get(task.taskId) ?? [];
    const blockers = evaluateReadyTask(task, tasks);
    const completeBlockers = [...dependencyBlockers, ...blockers];
    diagnostics.push(...blockers);
    return {
      taskId: task.taskId,
      eligible: completeBlockers.length === 0,
      blockers: completeBlockers,
    };
  });

  return {
    ok: diagnostics.length === 0,
    root: absoluteRoot,
    diagnostics,
    tasks,
    index: { entries: index.entries },
    readyEvaluations,
    packageScripts,
  };
}

function taskContractProjection(task, tasksById) {
  return {
    taskId: task.taskId,
    title: task.title,
    taskFile: task.file,
    branch: task.contract.branch,
    dependencies: task.contract.dependencies.map((taskId) => ({
      taskId,
      status: tasksById.get(taskId)?.status ?? "Missing",
    })),
    requiredReading: [...task.contract.requiredReading],
    ownership: {
      paths: [...task.contract.ownership.paths],
      boundaries: [...task.contract.ownership.boundaries],
    },
    unresolvedDecisions: [...task.contract.unresolvedDecisions],
    requiredChecks: [...task.contract.requiredChecks],
    humanReview: [...task.contract.humanReview],
    stopBoundary: task.contract.stopBoundary,
  };
}

function hasCompleteLiveEvidence(liveEvidence) {
  const evidence = liveEvidence?.evidence;
  if (!isPlainObject(evidence)) return false;
  const sha = /^[0-9a-f]{40}$/u;
  return (
    typeof evidence.repository === "string" &&
    evidence.repository.includes("/") &&
    typeof evidence.repositoryRoot === "string" &&
    evidence.repositoryRoot !== "" &&
    evidence.gitTopLevel === evidence.repositoryRoot &&
    typeof evidence.defaultBranch === "string" &&
    evidence.defaultBranch !== "" &&
    typeof evidence.headSha === "string" &&
    sha.test(evidence.headSha) &&
    evidence.originRef === `origin/${evidence.defaultBranch}` &&
    typeof evidence.originSha === "string" &&
    evidence.originSha === evidence.headSha &&
    typeof evidence.remoteSha === "string" &&
    evidence.remoteSha === evidence.headSha &&
    evidence.worktreeClean === true &&
    evidence.authenticatedGitHubMetadata === true &&
    evidence.openPullRequestCount === 0 &&
    isPlainObject(evidence.qualityGates) &&
    Number.isInteger(evidence.qualityGates.runId) &&
    evidence.qualityGates.runId > 0 &&
    typeof evidence.qualityGates.runUrl === "string" &&
    /^https:\/\//u.test(evidence.qualityGates.runUrl) &&
    evidence.qualityGates.status === "completed" &&
    evidence.qualityGates.conclusion === "success" &&
    evidence.commandsWereReadOnly === true
  );
}

export function selectNextTask(validation, liveEvidence = null) {
  const tasksById = new Map(
    validation.tasks
      .filter((task) => task.taskId)
      .map((task) => [task.taskId, task]),
  );
  const candidates = validation.readyEvaluations.map((evaluation) => ({
    taskId: evaluation.taskId,
    eligible: evaluation.eligible,
    blockers: evaluation.blockers.map((entry) => ({
      code: entry.code,
      message: entry.message,
    })),
  }));
  const blockers = validation.diagnostics.map((entry) => ({
    code: entry.code,
    message: entry.message,
    ...(entry.file ? { file: entry.file } : {}),
    ...(entry.taskId ? { taskId: entry.taskId } : {}),
  }));
  const reasons = [];

  let selectedTask = null;
  if (validation.ok) {
    const eligible = validation.readyEvaluations.find(
      (evaluation) => evaluation.eligible,
    );
    if (eligible) {
      const task = tasksById.get(eligible.taskId);
      if (task?.contract) {
        selectedTask = taskContractProjection(task, tasksById);
      }
    } else {
      reasons.push({
        code: "NO_READY_TASK",
        message: "The task index contains no locally eligible Ready task.",
      });
    }
  }

  let liveVerified = false;
  if (liveEvidence) {
    if (liveEvidence.ok === true && hasCompleteLiveEvidence(liveEvidence)) {
      liveVerified = true;
    } else if (
      liveEvidence.ok === false &&
      Array.isArray(liveEvidence.diagnostics) &&
      liveEvidence.diagnostics.length > 0 &&
      liveEvidence.diagnostics.every(
        (entry) =>
          isPlainObject(entry) &&
          typeof entry.code === "string" &&
          typeof entry.message === "string",
      )
    ) {
      blockers.push(
        ...liveEvidence.diagnostics.map((entry) => ({
          code: entry.code,
          message: entry.message,
        })),
      );
      selectedTask = null;
    } else {
      blockers.push({
        code: "LIVE_EVIDENCE_INVALID",
        message:
          "Live preflight evidence is incomplete or internally inconsistent; repository-only evidence cannot be promoted to live-verified.",
      });
      selectedTask = null;
    }
  }

  const eligible = selectedTask !== null && blockers.length === 0;
  const valid = blockers.length === 0;
  return {
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    valid,
    eligible,
    selectionStatus: eligible
      ? "selected"
      : valid
        ? "no-ready-task"
        : "refused",
    evidenceMode: liveVerified ? "live-verified" : "repository-only",
    evidenceStatement: liveVerified
      ? "Repository validation and the explicit read-only GitHub preflight completed for the exact default-branch HEAD; branch-protection configuration was not reverified."
      : "Repository files were validated locally; external GitHub state, open pull requests, branch protection, and exact-main Quality Gates were not verified.",
    selectedTask: eligible ? selectedTask : null,
    candidates,
    blockers,
    reasons,
    ...(liveVerified ? { liveEvidence: liveEvidence.evidence } : {}),
    autonomyBoundary: {
      oneTask: true,
      oneBranch: true,
      oneReviewablePullRequest: true,
      automaticMerge: false,
      automaticDeployment: false,
      automaticNextTask: false,
      humanReviewRemainsBlocking: true,
    },
  };
}

export function formatDiagnostic(entry) {
  const location = entry.file ? `${entry.file}: ` : "";
  return `[${entry.code}] ${location}${entry.message}`;
}

export function formatRunContract(result) {
  if (!result.eligible) {
    return [
      result.valid
        ? "No eligible Ready task is currently declared."
        : "Steering selection refused.",
      `Evidence: ${result.evidenceMode}`,
      result.evidenceStatement,
      ...result.reasons.map(
        (entry) => `- [${entry.code}] ${entry.message}`,
      ),
      ...result.blockers.map(
        (entry) => `- [${entry.code}] ${entry.message}`,
      ),
    ].join("\n");
  }

  const task = result.selectedTask;
  return [
    `Selected ${task.taskId} — ${task.title}`,
    `Task file: ${task.taskFile}`,
    `Branch: ${task.branch}`,
    `Evidence: ${result.evidenceMode}`,
    result.evidenceStatement,
    "",
    "Dependencies:",
    ...task.dependencies.map(
      (entry) => `- ${entry.taskId}: ${entry.status}`,
    ),
    "",
    "Required reading:",
    ...task.requiredReading.map((entry) => `- ${entry}`),
    "",
    "Owned paths:",
    ...task.ownership.paths.map((entry) => `- ${entry}`),
    "Owned boundaries:",
    ...task.ownership.boundaries.map((entry) => `- ${entry}`),
    "",
    "Unresolved decisions:",
    ...(task.unresolvedDecisions.length === 0
      ? ["- None."]
      : task.unresolvedDecisions.map((entry) => `- ${entry}`)),
    "",
    "Required checks:",
    ...task.requiredChecks.map((entry) => `- ${entry}`),
    "",
    "Human review:",
    ...task.humanReview.map((entry) => `- ${entry}`),
    "",
    `Stop boundary: ${task.stopBoundary}`,
    "The run must stop after one reviewable PR. It may not merge, deploy, resolve product decisions, or select another task.",
  ].join("\n");
}

export function relativeRepositoryPath(root, file) {
  return relative(resolve(root), resolve(file)).split(sep).join("/");
}
