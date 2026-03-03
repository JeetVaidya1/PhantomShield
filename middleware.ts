import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('phantom_token')?.value;

  // Protect dashboard routes — redirect to auth if not logged in
  if (request.nextUrl.pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  // Redirect authenticated users from landing/auth to dashboard
  if ((request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/auth') && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/auth', '/dashboard/:path*'],
};
