export const AUTH_EMAIL_KEY = "sitemind_auth_email";

export function readSignedInEmail(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_EMAIL_KEY) ?? "";
}

export function writeSignedInEmail(email: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_EMAIL_KEY, email);
}

export function clearSignedInEmail(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_EMAIL_KEY);
}
