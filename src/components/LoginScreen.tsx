// ═══════════════════════════════════════════════════════════
// 📱 LOGIN SCREEN - RiderTrack V2
// Pantalla de login con Google Auth + Email/Password
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  loginConGoogleWeb,
  loginConGoogleAPK,
  loginConEmail,
  registrarConEmail,
  recuperarPassword,
} from '../services/firebase';

interface LoginScreenProps {
  onSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [isAPK, setIsAPK] = useState(false);

  // Detectar si es APK
  useEffect(() => {
    const apk = typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor?.isNative;
    setIsAPK(!!apk);
  }, []);

  // Login con Google
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      if (isAPK) {
        // APK: usar Capacitor GoogleAuth plugin
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        await GoogleAuth.signOut().catch(() => {});
        const googleUser = await GoogleAuth.signIn();
        const result = await loginConGoogleAPK(googleUser);
        if (!result.success) throw new Error(result.error);
      } else {
        // Web: usar popup
        const result = await loginConGoogleWeb();
        if (!result.success) throw new Error(result.error);
      }
    } catch (e: any) {
      let msg = 'Error al iniciar con Google';
      if (e.message?.includes('cancel')) msg = 'Inicio cancelado';
      if (e.message?.includes('network')) msg = 'Sin conexión a internet';
      // Mostrar el error completo para diagnosticar
      console.error('❌ Error Google login:', e);
      if (e.message) msg = `Error: ${e.message.substring(0, 100)}`;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Login con email
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await loginConEmail(email, password);
    if (!result.success) {
      setError(result.error || 'Error al iniciar sesión');
    }
    setLoading(false);
  };

  // Registrar
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!nombre.trim()) {
      setError('Ingresa tu nombre');
      setLoading(false);
      return;
    }

    const result = await registrarConEmail(email, password, nombre);
    if (!result.success) {
      setError(result.error || 'Error al registrar');
    }
    setLoading(false);
  };

  // Recuperar contraseña
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await recuperarPassword(email);
    if (result.success) {
      setInfo('✅ Te enviamos un email para resetear tu contraseña');
    } else {
      setError(result.error || 'Error al enviar email');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 overflow-y-auto">
      {/* Fondo con gradiente */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-950 to-emerald-900/20" />

      {/* Contenedor del login */}
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-600 to-emerald-600 mb-4 shadow-2xl">
            <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">RiderTrack V2</h1>
          <p className="text-sm text-slate-400 mt-1">Panel profesional de entregas</p>
        </div>

        {/* Card de login */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl">
          {!showForgot ? (
            <>
              {/* Tabs */}
              <div className="flex gap-2 mb-6 p-1 bg-slate-800/50 rounded-xl">
                <button
                  onClick={() => { setTab('login'); setError(''); }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                    tab === 'login' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  onClick={() => { setTab('register'); setError(''); }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                    tab === 'register' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Crear Cuenta
                </button>
              </div>

              {/* Botón Google */}
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full mb-4 flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-slate-100 text-slate-800 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar con Google
              </button>

              {/* Divisor */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-xs text-slate-600">o con email</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                  ⚠️ {error}
                </div>
              )}

              {/* Form Login */}
              {tab === 'login' ? (
                <form onSubmit={handleEmailLogin} className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                    className="w-full bg-slate-800 text-white text-sm rounded-xl px-4 py-3 border border-slate-700 focus:border-emerald-500 outline-none"
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Contraseña"
                      required
                      className="w-full bg-slate-800 text-white text-sm rounded-xl px-4 py-3 pr-12 border border-slate-700 focus:border-emerald-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? '⏳ Cargando...' : 'Entrar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForgot(true); setError(''); setInfo(''); }}
                    className="w-full text-xs text-slate-500 hover:text-emerald-400"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </form>
              ) : (
                /* Form Register */
                <form onSubmit={handleRegister} className="space-y-3">
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Nombre completo"
                    required
                    className="w-full bg-slate-800 text-white text-sm rounded-xl px-4 py-3 border border-slate-700 focus:border-emerald-500 outline-none"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                    className="w-full bg-slate-800 text-white text-sm rounded-xl px-4 py-3 border border-slate-700 focus:border-emerald-500 outline-none"
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Contraseña (mínimo 6 caracteres)"
                      required
                      className="w-full bg-slate-800 text-white text-sm rounded-xl px-4 py-3 pr-12 border border-slate-700 focus:border-emerald-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? '⏳ Creando...' : 'Crear Cuenta'}
                  </button>
                </form>
              )}
            </>
          ) : (
            /* Recuperar contraseña */
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Recuperar Contraseña</h2>
              {info && (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400">
                  {info}
                </div>
              )}
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                  ⚠️ {error}
                </div>
              )}
              <form onSubmit={handleForgot} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Tu email"
                  required
                  className="w-full bg-slate-800 text-white text-sm rounded-xl px-4 py-3 border border-slate-700 focus:border-emerald-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? '⏳ Enviando...' : 'Enviar Email'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForgot(false); setError(''); setInfo(''); }}
                  className="w-full text-xs text-slate-500 hover:text-emerald-400"
                >
                  ← Volver
                </button>
              </form>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          RiderTrack V2 · MATE Pharmacy © 2026
        </p>
      </div>
    </div>
  );
};
