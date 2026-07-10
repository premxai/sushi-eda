export type AuthIntent = "upload" | "sample";

export interface LocalSession {
  email: string;
  name?: string;
}

const SESSION_KEY = "sushi_demo_session";

export function getLocalSession(): LocalSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as LocalSession;
    return typeof value.email === "string" && value.email.includes("@") ? value : null;
  } catch {
    return null;
  }
}

export function saveLocalSession(session: LocalSession): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function authReturnPath(intent: AuthIntent): string {
  return intent === "sample" ? "/?sample=1" : "/?auth=ready";
}
