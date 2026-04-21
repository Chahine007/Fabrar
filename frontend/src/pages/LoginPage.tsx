import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Activity, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { setToken } from '../lib/api';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [isLoading, setIsLoading]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Inserisci username e password.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Credenziali non valide.');
      setToken(data.token);
      onLoginSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore di connessione.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e2139 60%, #1e1b4b 100%)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative w-full max-w-md mx-4"
      >
        {/* Glow backdrop */}
        <div
          className="absolute -inset-1 rounded-3xl blur-xl opacity-25"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        />

        {/* Card */}
        <div
          className="relative rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(15,23,42,0.96)',
            border: '1px solid rgba(99,102,241,0.2)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}
        >
          {/* Top accent bar */}
          <div
            className="h-1.5 w-full"
            style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)' }}
          />

          <div className="p-10">
            {/* Logo */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                }}
              >
                <Activity size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight leading-none">
                  Fabrar ERP
                </h1>
                <p className="text-xs font-medium mt-0.5" style={{ color: '#6366f1' }}>
                  Gestionale Cantieri
                </p>
              </div>
            </div>

            <p className="text-center text-sm mb-8" style={{ color: '#94a3b8' }}>
              Accedi al pannello di controllo riservato
            </p>

            {/* Error Banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-2 p-3.5 rounded-xl mb-6 text-sm font-medium"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5',
                }}
              >
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username */}
              <div>
                <label
                  htmlFor="fab-username"
                  className="block text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ color: '#64748b' }}
                >
                  Nome Utente
                </label>
                <input
                  id="fab-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="nomeutente"
                  className="w-full px-4 py-3.5 rounded-xl outline-none text-sm font-medium transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#f8fafc',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#6366f1';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="fab-password"
                  className="block text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ color: '#64748b' }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="fab-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3.5 pr-12 rounded-xl outline-none text-sm font-medium transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#f8fafc',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = '#6366f1';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors"
                    style={{ color: '#64748b' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#94a3b8'}
                    onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full font-bold py-3.5 px-4 rounded-xl transition-all text-white mt-2 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                }}
                onMouseEnter={e => {
                  if (!isLoading) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(99,102,241,0.5)';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.4)';
                }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span
                      className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#ffffff' }}
                    />
                    Accesso in corso...
                  </span>
                ) : (
                  'Accedi'
                )}
              </button>
            </form>

            <p
              className="text-center text-xs mt-8 uppercase tracking-widest font-medium"
              style={{ color: '#334155' }}
            >
              Accesso Riservato al Personale Autorizzato
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
