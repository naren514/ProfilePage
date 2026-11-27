// The public site's address and name, for links that leave the browser
// (feeds, emails, share cards). SITE_URL overrides the address, e.g. for a
// preview deployment or tests.
export const SITE_NAME = "Naren Challa";

export function siteUrl(path = ""): string {
  const base = (process.env.SITE_URL || "https://narenc.com").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") || !path ? path : `/${path}`}`;
}
