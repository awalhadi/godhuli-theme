import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/signup', '/api/health'] as const;
const SUPPORTED_LOCALES = new Set(['en', 'bn', 'de']);
const BOT_UA = /bot|crawler|spider|slurp/i;

/**
 * Edge middleware: locale redirect, auth gate and a few security headers.
 * TODO: verify the session JWT signature here instead of only checking presence.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const segment = pathname.split('/')[1] ?? '';

  // Redirect bare paths to the preferred locale, e.g. /orders -> /en/orders
  if (!SUPPORTED_LOCALES.has(segment) && !pathname.startsWith('/api')) {
    const preferred = request.headers.get('accept-language')?.slice(0, 2) ?? 'en';
    const locale = SUPPORTED_LOCALES.has(preferred) ? preferred : 'en';
    return NextResponse.redirect(new URL(`/${locale}${pathname}${search}`, request.url), 308);
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.endsWith(p));
  const token = request.cookies.get('session')?.value;

  if (!isPublic && !token) {
    const loginUrl = new URL(`/${segment}/login`, request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next({
    request: { headers: new Headers({ ...Object.fromEntries(request.headers), 'x-locale': segment }) },
  });

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (BOT_UA.test(request.headers.get('user-agent') ?? '')) {
    response.headers.set('X-Robots-Tag', 'noindex');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match everything except static files and image optimisation routes.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)',
  ],
};
