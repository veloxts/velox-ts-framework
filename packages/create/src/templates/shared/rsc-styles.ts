/**
 * RSC Navigation Configurations
 *
 * Provides navigation item configs for RSC templates.
 * Separates basic RSC nav from auth-aware RSC nav.
 */

/**
 * Navigation item structure
 */
export interface NavItem {
  href: string;
  label: string;
  authRequired?: boolean; // Only show when authenticated
  guestOnly?: boolean; // Only show when NOT authenticated
}

/**
 * Navigation items for basic RSC template (no auth)
 *
 * Routes:
 * - / (Home)
 * - /users (Users list)
 * - /about (About page)
 * - /docs/getting-started (Documentation)
 */
export const RSC_NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/users', label: 'Users' },
  { href: '/about', label: 'About' },
  { href: '/docs/getting-started', label: 'Docs' },
];

/**
 * Navigation items for RSC-Auth template (with authentication)
 *
 * Routes:
 * - / (Home)
 * - /users (Users list)
 * - /dashboard (Dashboard - auth required)
 * - /auth/login (Login - guest only)
 * - /auth/register (Register - guest only)
 */
export const RSC_AUTH_NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/users', label: 'Users' },
  { href: '/dashboard', label: 'Dashboard', authRequired: true },
  { href: '/auth/login', label: 'Login', guestOnly: true },
  { href: '/auth/register', label: 'Register', guestOnly: true },
];

/**
 * Filter navigation items based on authentication status
 *
 * @param items - Full navigation items list
 * @param isAuthenticated - Whether the user is authenticated
 * @returns Filtered navigation items
 */
export function filterNavByAuth(items: NavItem[], isAuthenticated: boolean): NavItem[] {
  return items.filter((item) => {
    if (item.authRequired && !isAuthenticated) return false;
    if (item.guestOnly && isAuthenticated) return false;
    return true;
  });
}

/**
 * Detect authentication from cookie header (server-side)
 *
 * This is a simple cookie-based auth detection for navigation purposes.
 * The actual auth validation happens in the API layer.
 *
 * @param cookieHeader - Cookie header string from request
 * @returns Whether an access token cookie exists
 */
export function hasAuthToken(cookieHeader: string | undefined | null): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.includes('accessToken=');
}
