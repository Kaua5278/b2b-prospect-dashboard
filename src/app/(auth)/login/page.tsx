'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, AlertCircle, CheckCircle, Loader2, Eye, EyeOff, Shield, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ParticleBackground } from '@/components/3d/ParticleBackground';
import { createClient } from '@/lib/supabase/client';
import { Suspense } from 'react';
import { cn } from '@/lib/utils';

const EASE = [0.16, 1, 0.3, 1] as const;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';
  const reduceMotion = useReducedMotion();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    // Validação estrita: APENAS esta credencial funciona
    const VALID_EMAIL = 'shlia@b2b.com';
    const VALID_PASSWORD = 'admin';
    
    if (email.trim().toLowerCase() !== VALID_EMAIL || password !== VALID_PASSWORD) {
      setError('Credenciais inválidas. Acesso restrito.');
      setIsLoading(false);
      return;
    }

    // Mapeia senha 'admin' -> 'admin123' para compatibilidade Supabase (mín 8 chars)
    const passwordForAuth = password === 'admin' ? 'admin123' : password;

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: passwordForAuth,
      });

      if (error) {
        // Em modo mock (Supabase local não roda), simula login bem-sucedido
        // APENAS em desenvolvimento — em produção, erro real é exibido
        const isProd = process.env.NODE_ENV === 'production';
        if (!isProd && (error.message.includes('fetch') || error.message.includes('Failed') || error.message.includes('AuthRetryableFetchError'))) {
          document.cookie = `sb-mock-auth=${btoa(JSON.stringify({ email: email.trim(), role: 'authenticated' }))}; path=/; max-age=86400`;
          setSuccess('Login realizado com sucesso! Redirecionando...');
          setTimeout(() => {
            router.push(redirectTo);
            router.refresh();
          }, 800);
          return;
        }
        setError(error.message);
        return;
      }

      setSuccess('Login realizado com sucesso! Redirecionando...');
      setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 800);
    } catch (err) {
      // Qualquer erro de rede = modo mock (apenas em desenvolvimento)
      const isProd = process.env.NODE_ENV === 'production';
      if (!isProd) {
        document.cookie = `sb-mock-auth=${btoa(JSON.stringify({ email: email.trim(), role: 'authenticated' }))}; path=/; max-age=86400`;
        setSuccess('Login realizado com sucesso! Redirecionando...');
        setTimeout(() => {
          router.push(redirectTo);
          router.refresh();
        }, 800);
        return;
      }
      setError('Erro de rede ao conectar com o servidor de autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  const fadeUp = (delay: number) => ({
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay, ease: EASE },
  });

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden px-4 py-10">
      <ParticleBackground />

      {/* Ambient glow accents */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo / Brand */}
        <motion.div {...fadeUp(0)} className="text-center mb-8">
          <motion.div
            whileHover={reduceMotion ? undefined : { scale: 1.05, rotate: -3 }}
            whileTap={reduceMotion ? undefined : { scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-lg shadow-cyan-500/30 mx-auto mb-5"
          >
            <Shield className="h-8 w-8 text-white" />
          </motion.div>
          <motion.h1
            {...fadeUp(0.08)}
            className="text-3xl font-semibold text-white tracking-tight"
          >
            Prospecção B2B
          </motion.h1>
          <motion.p {...fadeUp(0.14)} className="mt-3 text-sm text-slate-500">
            Dashboard privado de mineração de leads
          </motion.p>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key="login-form"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            <Card className="bg-slate-900/60 border border-slate-800 shadow-2xl shadow-black/40">
              <CardHeader className="pb-5 pt-7">
                <CardTitle className="text-xl font-semibold text-white">
                  Entrar no Sistema
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Acesse sua conta para iniciar a prospecção
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}

                  {success && (
                    <motion.div
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm"
                    >
                      <CheckCircle className="h-4 w-4 shrink-0" />
                      <span>{success}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <motion.div {...fadeUp(0.1)}>
                    <Label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">
                      E-mail
                    </Label>
                    <div className="relative group">
                      <Mail className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-cyan-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-11 h-12 bg-slate-900/60 border-slate-700 focus:border-cyan-500 transition-all"
                        required
                        autoComplete="email"
                        disabled={isLoading}
                      />
                    </div>
                  </motion.div>

                  <motion.div {...fadeUp(0.16)}>
                    <Label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-300">
                      Senha
                    </Label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-cyan-400" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-11 pr-11 h-12 bg-slate-900/60 border-slate-700 focus:border-cyan-500 transition-all"
                        required
                        autoComplete="current-password"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1 rounded-md"
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </motion.div>

                  <motion.div {...fadeUp(0.22)}>
                    <motion.div
                      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                      className="btn-shine"
                    >
                      <Button
                        type="submit"
                        className="w-full h-12 text-base rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                            Entrando...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-5 w-5 mr-2" />
                            Acessar Dashboard
                            <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-0.5" />
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </motion.div>
                </form>

                <motion.div {...fadeUp(0.28)}>
                  <Separator className="border-slate-700/50" />

                  <div className="flex items-center justify-center gap-2 pt-1 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Ambiente restrito
                    </span>
                    <span className="text-slate-700">•</span>
                    <span>Dados protegidos por LGPD</span>
                  </div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-8 text-center text-xs text-slate-600"
        >
          v1.0.0 &copy; 2024 Sistema Privado de Prospecção B2B
        </motion.p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" /></div>}>
      <LoginForm />
    </Suspense>
  );
}