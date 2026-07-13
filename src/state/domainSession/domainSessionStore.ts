import { createDomainSessionStore } from "./createDomainSessionStore";

/** Runtime-owned canonical session adapter. It is intentionally not persisted. */
export const domainSessionStore = createDomainSessionStore();
