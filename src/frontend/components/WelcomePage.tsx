import React from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRight, 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  Activity, 
  ShieldCheck,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function WelcomePage({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background overflow-y-auto no-scrollbar">
      <div className="max-w-4xl w-full space-y-12 py-12">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent rounded-full text-sm font-bold"
          >
            <Zap size={16} />
            <span>Versione 2.0 disponibile</span>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-6xl font-black text-text-primary tracking-tight leading-tight"
          >
            Benvenuto in <span className="text-accent">Fabdar ERP</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed"
          >
            La piattaforma integrata per la gestione intelligente dei tuoi progetti, 
            risorse e flussi di lavoro aziendali.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex items-center justify-center gap-4 pt-4"
          >
            <button 
              onClick={onGetStarted}
              className="px-8 py-4 bg-accent text-white rounded-2xl font-bold shadow-xl shadow-accent/20 hover:bg-accent/90 hover:scale-105 transition-all flex items-center gap-2 group"
            >
              Vai alla Dashboard <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="px-8 py-4 bg-card border border-border text-text-primary rounded-2xl font-bold hover:bg-background transition-all">
              Documentazione
            </button>
          </motion.div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: LayoutDashboard,
              title: "Dashboard Intuitiva",
              desc: "Visualizza i tuoi KPI e l'andamento dei progetti in tempo reale con grafici interattivi.",
              color: "bg-info-bg text-info-text"
            },
            {
              icon: Briefcase,
              title: "Gestione Progetti",
              desc: "Pianifica, traccia e completa i tuoi progetti con strumenti di collaborazione avanzati.",
              color: "bg-success-bg text-success-text"
            },
            {
              icon: Activity,
              title: "Monitoraggio Attività",
              desc: "Tieni traccia del tempo e delle risorse impiegate per ogni singola attività aziendale.",
              color: "bg-warning-bg text-warning-text"
            }
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + (i * 0.1) }}
              className="p-6 rounded-3xl bg-card border border-border hover:shadow-xl transition-all group"
            >
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg", feature.color)}>
                <feature.icon size={24} />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2">{feature.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="p-8 rounded-3xl bg-sidebar text-white flex flex-col md:flex-row items-center justify-between gap-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <ShieldCheck size={28} className="text-accent" />
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">Sicurezza Garantita</p>
              <p className="text-lg font-bold">Crittografia End-to-End</p>
            </div>
          </div>
          
          <div className="flex gap-12">
            <div className="text-center">
              <p className="text-3xl font-black">18</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Progetti Attivi</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black">124</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Task Completati</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black">99%</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Uptime Sistema</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
