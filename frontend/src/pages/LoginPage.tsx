import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // using framer-motion as it is standard in the project (or motion/react as previously imported, but framer-motion is common)
import { Activity, AlertCircle, Eye, EyeOff, KeyRound } from 'lucide-react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useGoogleLogin } from '../hooks/api/useAuth';
import { useAuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { setToken } from '../lib/api';

export default function LoginPage() {
  // Legacy login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sprint 12: Google Login & Frictionless Onboarding
  const [inviteCode, setInviteCode] = useState('');
  const [isNewEmployee, setIsNewEmployee] = useState(false);
  
  const googleLoginMutation = useGoogleLogin();
  const { login } = useAuthContext();
  const navigate = useNavigate();

  const handleLegacySubmit = async (e: React.FormEvent) => {
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
      
      // Update Context
      const payload = JSON.parse(atob(data.token.split('.')[1]));
      login(data.token, {
        id: payload.id,
        username: payload.username,
        role: payload.role,
        employee_id: payload.employee_id,
      });
      navigate('/'); // Redirect to dashboard
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Errore di connessione.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setError("Token Google non ricevuto.");
      return;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      const payload = {
        idToken: credentialResponse.credential,
        ...(isNewEmployee && inviteCode.trim() ? { inviteCode: inviteCode.trim() } : {}),
      };
      
      const data = await googleLoginMutation.mutateAsync(payload);
      
      // Success! Update AuthContext
      login(data.token, {
        id: data.user.id,
        username: data.user.username,
        role: data.user.role,
        employee_id: data.user.employee_id,
        nome: data.user.nome,
        cognome: data.user.cognome,
      });
      navigate('/');
    } catch (err: any) {
      if (err.needsInviteCode) {
        setIsNewEmployee(true);
        setError("Account Google non registrato. Inserisci il codice invito ricevuto dall'amministratore.");
      } else {
        setError(err.error || "Errore durante l'accesso con Google.");
      }
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
        <div
          className="absolute -inset-1 rounded-3xl blur-xl opacity-25"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        />

        <div
          className="relative rounded-3xl overflow-hidden"
          style={{
            background: 'rgba(15,23,42,0.96)',
            border: '1px solid rgba(99,102,241,0.2)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}
        >
          <div
            className="h-1.5 w-full"
            style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)' }}
          />

          <div className="p-8 sm:p-10">
            <div className="flex flex-col items-center justify-center mb-8">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-4"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                }}
              >
                <Activity size={24} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-none mb-2 text-center">
                Benvenuto in Fabrar
              </h1>
              <p className="text-sm text-center" style={{ color: '#94a3b8' }}>
                Accedi al sistema ERP
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-start gap-2 p-3.5 rounded-xl mb-6 text-sm font-medium"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5',
                }}
              >
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Google OAuth & Invite Code Section */}
            <div className="mb-6 space-y-4 bg-slate-800/50 p-5 rounded-2xl border border-slate-700/50">
              <AnimatePresence>
                {isNewEmployee && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
                    exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    className="space-y-2 mb-4"
                  >
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Codice Invito (6 caratteri)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <KeyRound size={16} className="text-indigo-400" />
                      </div>
                      <input
                        type="text"
                        maxLength={6}
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        placeholder="A7B9X2"
                        className="w-full pl-10 pr-4 py-3 rounded-xl outline-none text-center font-mono text-lg font-bold tracking-[0.2em] transition-all bg-white/5 border border-white/10 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Autenticazione con Google fallita.")}
                  useOneTap={false}
                  theme="filled_black"
                  shape="pill"
                  text={isNewEmployee ? "signup_with" : "signin_with"}
                />
              </div>

              <div className="text-center mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewEmployee(!isNewEmployee);
                    setError(null);
                  }}
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-2"
                >
                  {isNewEmployee 
                    ? "Hai già un account? Accedi normalmente" 
                    : "Sei un nuovo dipendente? Clicca qui per inserire il codice invito"}
                </button>
              </div>
            </div>

            <div className="relative flex items-center py-2 mb-6">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-medium uppercase tracking-wider">oppure login classico</span>
              <div className="flex-grow border-t border-slate-700"></div>
            </div>

            {/* Legacy Form */}
            <form onSubmit={handleLegacySubmit} className="space-y-4">
              <div>
                <input
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Nome Utente"
                  className="w-full px-4 py-3 rounded-xl outline-none text-sm font-medium transition-all bg-white/5 border border-white/10 text-white focus:border-indigo-500"
                />
              </div>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-4 py-3 pr-12 rounded-xl outline-none text-sm font-medium transition-all bg-white/5 border border-white/10 text-white focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full font-bold py-3.5 px-4 rounded-xl transition-all text-white bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 border border-slate-600"
              >
                {isLoading ? 'Accesso in corso...' : 'Accedi con Password'}
              </button>
            </form>

            <p className="text-center text-[10px] mt-8 uppercase tracking-widest font-medium text-slate-500">
              Accesso Riservato al Personale Autorizzato
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
