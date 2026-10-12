export type EditorSession = {
  tabs: string[];
  active?: string;
  secondary?: string;
};
export function parseSession(value: unknown): EditorSession {
  if (!value || typeof value !== "object") return { tabs: [] };
  const row = value as Partial<EditorSession>;
  const tabs = Array.isArray(row.tabs)
    ? [
        ...new Set(
          row.tabs.filter(
            (v): v is string =>
              typeof v === "string" && /^[a-z0-9-]{1,80}$/i.test(v),
          ),
        ),
      ].slice(-50)
    : [];
  return {
    tabs,
    active: tabs.includes(row.active ?? "") ? row.active : undefined,
    secondary: tabs.includes(row.secondary ?? "") ? row.secondary : undefined,
  };
}
export function readSession(user: string, project: string): EditorSession {
  try {
    return parseSession(
      JSON.parse(
        localStorage.getItem(`ultrapad-session:${user}:${project}`) ?? "null",
      ),
    );
  } catch {
    return { tabs: [] };
  }
}
export function writeSession(
  user: string,
  project: string,
  value: EditorSession,
) {
  try {
    localStorage.setItem(
      `ultrapad-session:${user}:${project}`,
      JSON.stringify(parseSession(value)),
    );
  } catch {
    /* Preferences never substitute document persistence. */
  }
}
export function ancestors<T extends { id: string; parent_id: string | null }>(
  file: T,
  files: T[],
): T[] {
  const rows: T[] = [];
  const seen = new Set([file.id]);
  let id = file.parent_id;
  while (id && !seen.has(id)) {
    seen.add(id);
    const parent = files.find((f) => f.id === id);
    if (!parent) break;
    rows.unshift(parent);
    id = parent.parent_id;
  }
  return rows;
}
