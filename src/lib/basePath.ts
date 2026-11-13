/** Vite `base` (asset URLs, import.meta.env.BASE_URL). Always a path that starts and ends with `/`. */

/**
 * Derive the site base path from an env value such as actions/configure-pages
 * `base_path`. Empty or unset defaults to `/`, which is correct for private
 * GitHub Pages (served at the root of a unique `*.pages.github.io` host) and
 * for local dev. A project-site path such as `/kamui-demo` is normalised to
 * `/kamui-demo/`.
 */
export function resolveViteBase(raw: string | undefined | null): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed === '/') return '/';
  const withLead = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLead.endsWith('/') ? withLead : `${withLead}/`;
}
