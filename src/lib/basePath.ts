/** Vite `base` (asset URLs, import.meta.env.BASE_URL). Always a path that starts and ends with `/`. */

/**
 * Derive the site base path.
 *
 * Precedence:
 * 1. `VITE_BASE_PATH` if set (for example `actions/configure-pages`'s `base_path`);
 * 2. otherwise `/kamui-demo/` when `GITHUB_PAGES=1`, matching the public project
 *    site at https://starknet-innovation.github.io/kamui-demo/;
 * 3. otherwise `/`, for local dev and CI.
 *
 * A project-site path such as `/kamui-demo` is normalised to `/kamui-demo/`.
 */
export function resolveViteBase(
  raw: string | undefined | null,
  githubPages?: string | undefined | null,
): string {
  const trimmed = (raw ?? '').trim();
  if (trimmed) {
    if (trimmed === '/') return '/';
    const withLead = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return withLead.endsWith('/') ? withLead : `${withLead}/`;
  }
  if ((githubPages ?? '').trim() === '1') return '/kamui-demo/';
  return '/';
}
