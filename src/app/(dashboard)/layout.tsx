'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { User, LogOut, LayoutDashboard, Users, Target, ChevronRight, Menu, X, Shield, Sparkles, BarChart3, Search, Briefcase, LifeBuoy, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-provider';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { AuroraBackground } from '@/components/3d/AuroraBackground';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, badge: null },
  { name: 'Prospecção', href: '/prospect', icon: Search, badge: null },
  { name: 'Pipeline', href: '/pipeline', icon: Briefcase, badge: null },
];

const EASE = [0.16, 1, 0.3, 1] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    // Check mock cookie first - synchronous, instant
    if (typeof window !== 'undefined') {
      const cookies = document.cookie.split('; ');
      const mockCookie = cookies.find(c => c.startsWith('sb-mock-auth='));
      if (mockCookie) {
        try {
          const mockData = JSON.parse(atob(mockCookie.split('=')[1]));
          setUser({ email: mockData.email, user_metadata: { full_name: mockData.email.split('@')[0] } } as any);
          setLoading(false);
          return;
        } catch { /* fallback */ }
      }
    }

    // Only try Supabase if no mock cookie
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setUser(null);
        setLoading(false);
      }
    }, 3000);

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled) {
        clearTimeout(timeout);
        setUser(user);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        clearTimeout(timeout);
        setUser(null);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Atalhos globais de navegação (G = Dashboard, P = Pipeline, N = Prospecção)
  useKeyboardShortcuts({
    onDashboard: () => router.push('/dashboard'),
    onProspect: () => router.push('/prospect'),
    onPipeline: () => router.push('/pipeline'),
  });

  // Notificação de follow-up pendente (opcional, no topbar)
  const [pendingFollowUps, setPendingFollowUps] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('leads')
          .select('id, status, contacted_at, created_at')
          .eq('status', 'contacted');
        if (cancelled || !data) return;
        const now = Date.now();
        const count = data.filter((l: any) => {
          const ref = l.contacted_at || l.created_at;
          if (!ref) return false;
          return now - new Date(ref).getTime() > 48 * 60 * 60 * 1000;
        }).length;
        setPendingFollowUps(count);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, pathname]);

  const handleSignOut = async () => {
    // Clear mock cookie
    document.cookie = 'sb-mock-auth=; path=/; max-age=0';
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    router.push('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <span className="text-sm text-slate-400">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const currentPage = navigation.find(n => pathname === n.href || pathname.startsWith(n.href + '/'));

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Ambient aurora background glow */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
        <AuroraBackground
          variant="b2b"
          opacity={0.5}
          speed={1}
          blobCount={3}
          className="absolute inset-0 size-full"
        />
        <div className="absolute -top-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-slate-950/95 backdrop-blur-xl border-r border-slate-800/80',
          'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          sidebarOpen ? 'translate-x-0 shadow-2xl shadow-black/50' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-5 border-b border-slate-800/80">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <motion.div
                whileHover={reduceMotion ? undefined : { scale: 1.06 }}
                whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-lg shadow-cyan-500/25"
              >
                {/* Animated ring */}
                <motion.span
                  className="absolute -inset-1 rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-400 opacity-0 blur-md"
                  animate={reduceMotion ? undefined : { opacity: [0, 0.35, 0], scale: [0.9, 1.05, 0.9] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
                <Shield className="h-5 w-5 text-white relative z-10" />
              </motion.div>
              <span className="font-semibold text-lg text-white tracking-tight">
                Prospecção B2B
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-200 border border-cyan-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  )}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-gradient-to-b from-cyan-400 to-emerald-400"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon className={cn('h-5 w-5 shrink-0 transition-transform duration-200', !isActive && 'group-hover:scale-110')} />
                  <span>{item.name}</span>
                  {item.badge && (
                    <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-cyan-500/20 text-cyan-400 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-slate-800/80">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/50 transition-colors group">
                  <Avatar className="h-9 w-9 ring-2 ring-cyan-500/30 group-hover:ring-cyan-500/50 transition-all">
                    <AvatarImage src={user.user_metadata?.avatar_url || ''} alt={user.email || ''} />
                    <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-emerald-500 text-white font-medium">
                      {user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 w-56 z-[60]">
                <DropdownMenuLabel className="font-medium text-white">
                  Minha conta
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-slate-300 hover:bg-slate-800 cursor-pointer">
                  <User className="h-4 w-4 mr-2" />
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuItem className="text-slate-300 hover:bg-slate-800 cursor-pointer">
                  <Shield className="h-4 w-4 mr-2" />
                  Segurança
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-red-400 hover:bg-red-500/10 focus:text-red-400 cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72 relative z-10">
        {/* Top bar */}
        <header className={cn(
          'sticky top-0 z-30 flex h-16 items-center justify-between gap-4 px-4 lg:px-8 transition-all duration-300',
          scrolled ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80' : 'bg-transparent border-b border-transparent'
        )}>
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:bg-slate-800/50 hover:text-white transition-colors"
              aria-label="Abrir menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold text-white truncate">
              {currentPage?.name || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Atalhos de teclado (dica) */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800/80 text-[11px] text-slate-500">
              <span className="flex items-center gap-0.5">
                <kbd className="px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700/80 font-mono text-[10px] text-slate-400">G</kbd>
                <kbd className="px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700/80 font-mono text-[10px] text-slate-400">P</kbd>
                <kbd className="px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700/80 font-mono text-[10px] text-slate-400">N</kbd>
              </span>
              <span className="hidden lg:inline">navega</span>
            </div>

            {/* Notificações de follow-up */}
            <button
              onClick={() => router.push('/pipeline')}
              className="relative inline-flex items-center justify-center h-9 w-9 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
              title={pendingFollowUps > 0 ? `${pendingFollowUps} lead(s) aguardando follow-up` : 'Ir para o pipeline'}
            >
              <Bell className="h-4 w-4" />
              {pendingFollowUps > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white"
                >
                  {pendingFollowUps}
                </motion.span>
              )}
            </button>

            <ThemeToggle />

            <button
              onClick={handleSignOut}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </header>

        {/* Page content */}
        <motion.main
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="px-4 lg:px-8 pt-6 pb-12"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}