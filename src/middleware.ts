import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          supabaseResponse = NextResponse.next({
            request,
          });
          supabaseResponse.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          supabaseResponse = NextResponse.next({
            request,
          });
          supabaseResponse.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple await supabase.auth.getUser() is enough.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname === '/login';
  const isDashboardRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/');

  // Em modo mock: verifica cookie de auth fake
  const mockAuth = request.cookies.get('sb-mock-auth')?.value;
  const isMockLoggedIn = !!mockAuth;

  // Se não está logado (nem real nem mock) e tenta acessar dashboard, redireciona para login
  if (!user && !isMockLoggedIn && isDashboardRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  // Se está logado (real ou mock) e tenta acessar login, redireciona para dashboard
  if ((user || isMockLoggedIn) && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object like NextResponse.next() make sure to:
  // 1. Pass the request in it, like so: NextResponse.next({ request })
  // 2. Copy over the cookies, like so: supabaseResponse.cookies.set(...)
  // 3. Change the supabaseResponse object to fit your needs, but avoid creating
  //    a new NextResponse object. If you do create a new NextResponse object, you
  //    must re-fetch the user with supabase.auth.getUser()
  
  // Preserve mock auth cookie through Supabase's response manipulation
  const mockAuthValue = request.cookies.get('sb-mock-auth')?.value;
  if (mockAuthValue) {
    supabaseResponse.cookies.set('sb-mock-auth', mockAuthValue, {
      path: '/',
      maxAge: 86400,
      sameSite: 'lax',
    });
  }
  
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/ (API routes handle their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};