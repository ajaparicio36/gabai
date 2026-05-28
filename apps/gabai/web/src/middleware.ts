import { NextResponse, type NextRequest } from 'next/server';

const protectedPaths = ['/map', '/admin'];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('accessToken')?.value;

  if (!accessToken) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/admin')) {
    const userCookie = request.cookies.get('user')?.value;
    if (userCookie) {
      try {
        const user = JSON.parse(userCookie) as { role?: string };
        if (user.role !== 'admin') {
          return new NextResponse('Forbidden', { status: 403 });
        }
      } catch {
        return new NextResponse('Forbidden', { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/map/:path*', '/admin/:path*'],
};
