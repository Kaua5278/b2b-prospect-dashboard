'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, AlertCircle, CheckCircle, Loader2, Eye, EyeOff, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ParticleBackground } from '@/components/3d/ParticleBackground';
import { createClient } from '@/lib/supabase/client';
import { Suspense } from 'react';
import { cn } from '@/lib/utils';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';
  
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

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <ParticleBackground />
      
      <div className="relative z-10 w-full max-w-md px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 mb-6">
            <Shield className="h-8 w-8 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Prospecção B2B
          </h1>
          <p className="mt-2 text-slate-400">Dashboard Privado de Mineração de Leads</p>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key="login-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="glass-card shadow-2xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Entrar no Sistema</CardTitle>
                <CardDescription className="text-slate-400">
                  Acesse sua conta para iniciar a prospecção
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm"
                  >
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span>{success}</span>
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">
                      E-mail
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-slate-900/50 border-slate-700 focus:border-cyan-500"
                        required
                        autoComplete="email"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-300">
                      Senha
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 bg-slate-900/50 border-slate-700 focus:border-cyan-500"
                        required
                        autoComplete="current-password"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full py-3 text-base"
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
                      </>
                    )}
                  </Button>
                </form>

                <Separator className="border-slate-700/50" />

                <div className="text-center text-sm text-slate-500">
                  <p>Ambiente restrito - Acesso autorizado apenas</p>
                  <p className="mt-1">Dados protegidos por LGPD e criptografia</p>
                </div>

                {/* Credenciais de desenvolvimento */}
                <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400">
                  <p className="font-medium text-slate-300 mb-1">Credenciais de teste:</p>
                  <p className="font-mono">shlia@b2b.com</p>
                  <p className="font-mono">admin</p>
                  <p className="mt-1 text-slate-500">(Senha 'admin' → 'admin123' auto)</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
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