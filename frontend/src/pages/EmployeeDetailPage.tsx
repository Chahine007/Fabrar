/**
 * EmployeeDetailPage.tsx — Dettaglio Dipendente con editing inline.
 * Rotta: /hr/employees/:id
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronRight, User, Phone, Mail, MapPin, Calendar,
  Clock, Euro, Briefcase, FileText,
  Shield, Hash, Building2, ArrowLeft, Loader2,
  Pencil, Save, X, KeyRound,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useEmployeeDetail, useGenerateCV, useUpdateEmployee, useSetEmployeeCost } from '../hooks/api/useHr';
import { useGenerateInvite } from '../hooks/api/useAuth';
import type { EmployeeCVData, EmployeeDetail } from '../hooks/api/useHr';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';
import { useToast } from '../components/ui';

const COLORS = [
  'from-violet-500 to-purple-600', 'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600', 'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600', 'from-indigo-500 to-blue-700',
];

type TabId = 'anagrafica' | 'costi' | 'documenti';
const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: 'anagrafica', label: 'Anagrafica',        icon: User },
  { id: 'costi',      label: 'Costi & Tabulati',  icon: Euro },
  { id: 'documenti',  label: 'Documenti & CV',    icon: FileText },
];

// ─── Editable Field ───────────────────────────────────────────────────────────
interface FieldProps {
  icon: typeof User;
  label: string;
  name: string;
  value: string;
  editing: boolean;
  onChange: (name: string, val: string) => void;
  type?: string;
  placeholder?: string;
}

const EditableField = ({ icon: Icon, label, name, value, editing, onChange, type = 'text', placeholder }: FieldProps) => (
  <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
    <Icon size={16} className="text-text-secondary mt-0.5 shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="text-xs text-text-secondary uppercase tracking-wider font-bold">{label}</p>
      {editing ? (
        <input
          type={type}
          name={name}
          value={value}
          onChange={e => onChange(name, e.target.value)}
          placeholder={placeholder ?? label}
          className="w-full mt-1 px-3 py-2 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all"
        />
      ) : (
        <p className="text-sm text-text-primary font-medium mt-0.5">{value || '—'}</p>
      )}
    </div>
  </div>
);

// ─── Tab: Anagrafica ──────────────────────────────────────────────────────────
interface TabAnagraficaProps {
  emp: EmployeeDetail;
  editing: boolean;
  form: Record<string, string>;
  onChange: (name: string, val: string) => void;
}

const TabAnagrafica = ({ emp, editing, form, onChange }: TabAnagraficaProps) => {
  const competenze: string[] = (() => {
    if (emp.competenze && Array.isArray(emp.competenze)) return emp.competenze;
    if (emp.skills) return emp.skills.split(',').map((s: string) => s.trim()).filter(Boolean);
    return [];
  })();

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dati Personali */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
            <User size={16} className="text-accent" /> Dati Personali
          </h3>
          <EditableField icon={User}     label="Nome"             name="nome"               value={editing ? form.nome : (emp.nome ?? '')}               editing={editing} onChange={onChange} />
          <EditableField icon={User}     label="Cognome"          name="cognome"            value={editing ? form.cognome : (emp.cognome ?? '')}           editing={editing} onChange={onChange} />
          <EditableField icon={Hash}     label="Codice Fiscale"   name="codice_fiscale"     value={editing ? form.codice_fiscale : (emp.codice_fiscale ?? '')} editing={editing} onChange={onChange} />
          <EditableField icon={Calendar} label="Data di Nascita"  name="data_nascita"       value={editing ? form.data_nascita : (emp.data_nascita ? new Date(emp.data_nascita).toLocaleDateString('it-IT') : '')} editing={editing} onChange={onChange} type={editing ? 'date' : 'text'} />
          <EditableField icon={Phone}    label="Telefono"         name="telefono"           value={editing ? form.telefono : (emp.telefono ?? '')}         editing={editing} onChange={onChange} type="tel" />
          <EditableField icon={Phone}    label="Tel. Personale"   name="telefono_personale" value={editing ? form.telefono_personale : (emp.telefono_personale ?? '')} editing={editing} onChange={onChange} type="tel" />
          <EditableField icon={Mail}     label="Email Personale"  name="email_personale"    value={editing ? form.email_personale : (emp.email_personale ?? '')} editing={editing} onChange={onChange} type="email" />
        </div>

        {/* Indirizzo + Professionale */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <MapPin size={16} className="text-accent" /> Indirizzo
            </h3>
            <EditableField icon={MapPin}   label="Via/Indirizzo" name="indirizzo" value={editing ? form.indirizzo : (emp.indirizzo ?? '')} editing={editing} onChange={onChange} />
            <EditableField icon={Hash}     label="CAP"          name="cap"       value={editing ? form.cap : (emp.cap ?? '')}             editing={editing} onChange={onChange} />
            <EditableField icon={Building2} label="Città"       name="citta"     value={editing ? form.citta : (emp.citta ?? '')}         editing={editing} onChange={onChange} />
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
              <Briefcase size={16} className="text-accent" /> Profilo Professionale
            </h3>
            <EditableField icon={Briefcase}  label="Ruolo"           name="ruolo"           value={editing ? form.ruolo : (emp.ruolo ?? '')}               editing={editing} onChange={onChange} />
            <EditableField icon={Building2}  label="Dipartimento"    name="dipartimento"    value={editing ? form.dipartimento : (emp.dipartimento ?? '')} editing={editing} onChange={onChange} />
            <EditableField icon={Calendar}   label="Data Assunzione" name="data_assunzione" value={editing ? form.data_assunzione : (emp.data_assunzione ? new Date(emp.data_assunzione).toLocaleDateString('it-IT') : '')} editing={editing} onChange={onChange} type={editing ? 'date' : 'text'} />
            <div className="flex items-start gap-3 py-3">
              <Shield size={16} className="text-text-secondary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider font-bold">Stato</p>
                <p className="text-sm text-text-primary font-medium mt-0.5">{emp.attivo === 1 ? 'Attivo' : 'Inattivo'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Competenze */}
        <div className="bg-card border border-border rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4">Competenze</h3>
          {editing ? (
            <div>
              <input
                type="text"
                name="competenze"
                value={form.competenze}
                onChange={e => onChange('competenze', e.target.value)}
                placeholder="Es: Saldatore, Ponteggiatore, Carpentiere..."
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              />
              <p className="text-xs text-text-secondary mt-1.5">Separare le competenze con una virgola.</p>
            </div>
          ) : competenze.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {competenze.map((skill, i) => (
                <span key={i} className="px-3 py-1.5 bg-accent/10 text-accent border border-accent/20 rounded-xl text-xs font-bold">{skill}</span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary italic">Nessuna competenza registrata.</p>
          )}
        </div>

        {/* Note Admin */}
        <div className="bg-card border border-border rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4">Note Amministrative</h3>
          {editing ? (
            <textarea
              name="note_admin"
              value={form.note_admin}
              onChange={e => onChange('note_admin', e.target.value)}
              rows={3}
              placeholder="Note interne visibili solo agli admin..."
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 resize-none transition-all"
            />
          ) : (
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{emp.note_admin || 'Nessuna nota.'}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Tab: Costi & Tabulati ────────────────────────────────────────────────────
const TabCosti = ({ emp }: { emp: EmployeeDetail }) => {
  const navigate = useNavigate();
  const costMut = useSetEmployeeCost();
  const toast = useToast();
  const [newCosto, setNewCosto] = useState('');
  const [newValidoDal, setNewValidoDal] = useState(() => new Date().toISOString().slice(0, 10));
  const [saved, setSaved] = useState(false);

  const handleSetCost = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newCosto);
    if (isNaN(val) || val <= 0) {
      toast.error('Costo non valido', 'Inserire un costo orario valido.');
      return;
    }
    try {
      await costMut.mutateAsync({ id: emp.id, costo_orario: val, valido_dal: newValidoDal });
      setNewCosto('');
      setSaved(true);
      toast.success('Costo orario aggiornato');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast.error('Aggiornamento non riuscito', (err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tariffa Oraria',  value: `€${emp.costo_orario?.toFixed(2) ?? '0.00'}/h`, icon: Euro,  color: 'text-accent',      bg: 'bg-accent/10' },
          { label: 'Ore Totali',      value: `${emp.ore_totali ?? 0}h`,                       icon: Clock, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Costo Totale',    value: `€${(emp.costo_totale ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`, icon: Euro, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
          { label: 'Valido dal',      value: emp.valido_dal ? new Date(emp.valido_dal).toLocaleDateString('it-IT') : '—', icon: Calendar, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <motion.div key={label} whileHover={{ y: -2 }} className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
            <div className={cn('p-2.5 rounded-xl', bg, color)}><Icon size={20} /></div>
            <div><p className="text-xl font-bold text-text-primary">{value}</p><p className="text-xs text-text-secondary font-medium">{label}</p></div>
          </motion.div>
        ))}
      </div>

      {/* Modifica Tariffa */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
          <Euro size={16} className="text-accent" /> Aggiorna Tariffa Oraria
        </h3>
        <p className="text-sm text-text-secondary mb-4">
          Imposta una nuova tariffa oraria. La precedente rimarrà nello storico. La nuova tariffa sarà applicata a partire dalla data indicata.
        </p>
        <form onSubmit={handleSetCost} className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-text-secondary font-bold uppercase tracking-wider block mb-1.5">Costo Orario (€)</label>
            <input
              type="number" step="0.01" min="0" placeholder="Es: 25.00"
              value={newCosto} onChange={e => setNewCosto(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              required
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-text-secondary font-bold uppercase tracking-wider block mb-1.5">Valido dal</label>
            <input
              type="date" value={newValidoDal} onChange={e => setNewValidoDal(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20 transition-all"
              required
            />
          </div>
          <button type="submit" disabled={costMut.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-bold text-sm hover:bg-accent/90 disabled:opacity-50 shadow-lg shadow-accent/20 transition-all">
            {costMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salva Tariffa
          </button>
        </form>
        {saved && (
          <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
            className="text-sm text-emerald-500 font-bold mt-3">
            ✓ Tariffa aggiornata con successo!
          </motion.p>
        )}
      </div>

      {/* Tabulati Link */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4">Tabulati Orari</h3>
        <p className="text-sm text-text-secondary mb-4">Visualizza tutte le timbrature e le entry orarie di questo dipendente.</p>
        <button onClick={() => navigate(`/hr/tabulati?employee_id=${emp.id}`)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-bold text-sm hover:bg-accent/90 transition-all shadow-lg shadow-accent/20">
          <Clock size={16} /> Vai ai Tabulati <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};


// ─── Tab: Documenti & CV ──────────────────────────────────────────────────────
const TabDocumenti = ({ emp }: { emp: EmployeeDetail }) => {
  const { data: cvData, refetch: fetchCV, isFetching } = useGenerateCV(emp.id);
  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-2">Auto-compile CV</h3>
        <p className="text-sm text-text-secondary mb-5">Genera un curriculum vitae strutturato con i dati anagrafici, le competenze e l'esperienza lavorativa del dipendente.</p>
        <button onClick={() => fetchCV()} disabled={isFetching}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-bold text-sm hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 disabled:opacity-50">
          {isFetching ? <><Loader2 size={16} className="animate-spin" /> Generazione...</> : <><FileText size={16} /> 📄 Auto-compile CV</>}
        </button>
      </div>
      {cvData && <CVPreview cv={cvData} />}
      {emp.note_admin && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-2">Note Amministrative</h3>
          <p className="text-sm text-text-secondary whitespace-pre-wrap">{emp.note_admin}</p>
        </div>
      )}
    </div>
  );
};

const CVPreview = ({ cv }: { cv: EmployeeCVData }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    className="bg-card border border-accent/20 rounded-2xl p-6 space-y-5">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-bold text-accent uppercase tracking-wider">CV Generato</h3>
      <span className="text-[10px] text-text-secondary">{new Date(cv.generato_il).toLocaleString('it-IT')}</span>
    </div>
    <div>
      <p className="text-lg font-bold text-text-primary">{cv.anagrafica.nome} {cv.anagrafica.cognome}</p>
      <p className="text-sm text-text-secondary">{cv.professionale.ruolo}</p>
      {cv.anagrafica.indirizzo && <p className="text-xs text-text-secondary mt-1"><MapPin size={11} className="inline mr-1" />{cv.anagrafica.indirizzo}</p>}
      <div className="flex gap-4 mt-2 text-xs text-text-secondary">
        {cv.anagrafica.telefono && <span><Phone size={11} className="inline mr-1" />{cv.anagrafica.telefono}</span>}
        {cv.anagrafica.email && <span><Mail size={11} className="inline mr-1" />{cv.anagrafica.email}</span>}
      </div>
    </div>
    {cv.competenze.length > 0 && (
      <div>
        <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Competenze</p>
        <div className="flex flex-wrap gap-1.5">
          {cv.competenze.map((s, i) => (
            <span key={i} className="px-2.5 py-1 bg-accent/10 text-accent border border-accent/20 rounded-lg text-xs font-bold">{s}</span>
          ))}
        </div>
      </div>
    )}
    <div>
      <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Esperienza Lavorativa</p>
      <p className="text-sm text-text-primary">{cv.esperienza.ore_totali_lavorate}h totali lavorate</p>
      {cv.esperienza.cantieri_lavorati.length > 0 && (
        <ul className="mt-2 space-y-1">
          {cv.esperienza.cantieri_lavorati.map((c, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
              <Building2 size={12} className="text-accent shrink-0" /> {c}
            </li>
          ))}
        </ul>
      )}
    </div>
    <div className="flex items-center gap-4 pt-3 border-t border-border text-xs text-text-secondary">
      <span>Tariffa: <strong className="text-text-primary">€{cv.professionale.tariffa_oraria.toFixed(2)}/h</strong></span>
      {cv.professionale.dipartimento && <span>Dipartimento: <strong className="text-text-primary">{cv.professionale.dipartimento}</strong></span>}
      {cv.professionale.data_assunzione && <span>Assunto il: <strong className="text-text-primary">{new Date(cv.professionale.data_assunzione).toLocaleDateString('it-IT')}</strong></span>}
    </div>
  </motion.div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const empId = Number(id);
  const { data: emp, isLoading, error } = useEmployeeDetail(empId);
  const [activeTab, setActiveTab] = useState<TabId>('anagrafica');
  const toast = useToast();

  // ── Editing state (lifted from TabAnagrafica) ──
  const updateMut = useUpdateEmployee();
  const generateInviteMut = useGenerateInvite(empId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  useEffect(() => {
    if (editing && emp) {
      setForm({
        nome:               emp.nome ?? '',
        cognome:            emp.cognome ?? '',
        codice_fiscale:     emp.codice_fiscale ?? '',
        data_nascita:       emp.data_nascita ? emp.data_nascita.slice(0, 10) : '',
        telefono:           emp.telefono ?? '',
        telefono_personale: emp.telefono_personale ?? '',
        email_personale:    emp.email_personale ?? '',
        indirizzo:          emp.indirizzo ?? '',
        cap:                emp.cap ?? '',
        citta:              emp.citta ?? '',
        ruolo:              emp.ruolo ?? '',
        dipartimento:       emp.dipartimento ?? '',
        data_assunzione:    emp.data_assunzione ? emp.data_assunzione.slice(0, 10) : '',
        note_admin:         emp.note_admin ?? '',
        competenze:         Array.isArray(emp.competenze) ? emp.competenze.join(', ') : (emp.skills ?? ''),
      });
    }
  }, [editing, emp]);

  const handleChange = (name: string, val: string) => setForm(prev => ({ ...prev, [name]: val }));
  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({ id: empId, data: form });
      setEditing(false);
      toast.success('Dipendente aggiornato');
    } catch (err) {
      toast.error('Salvataggio non riuscito', (err as Error).message);
    }
  };

  const handleGenerateInvite = async () => {
    try {
      const res = await generateInviteMut.mutateAsync();
      setGeneratedCode(res.invite_code);
      toast.success('Codice invito generato');
    } catch (err) {
      toast.error('Generazione invito non riuscita', (err as Error).message);
    }
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center bg-background"><Spinner label="Caricamento..." /></div>;
  if (error || !emp) return <div className="flex-1 flex items-center justify-center bg-background"><ErrorMessage error={(error as Error)?.message ?? 'Dipendente non trovato'} /></div>;

  const name = `${emp.nome ?? ''} ${emp.cognome ?? ''}`.trim();
  const initials = `${(emp.nome?.[0] ?? '').toUpperCase()}${(emp.cognome?.[0] ?? '').toUpperCase()}`;

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      {/* Breadcrumb */}
      <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border px-8 h-14 flex items-center gap-2 text-sm">
        <Link to="/hr" className="text-text-secondary hover:text-accent transition-colors font-medium flex items-center gap-1">
          <ArrowLeft size={14} /> Gestione Personale
        </Link>
        <ChevronRight size={14} className="text-text-secondary" />
        <span className="text-text-primary font-bold truncate">{name || 'Dipendente'}</span>
      </div>

      <div className="p-8">
        {/* Profile Header */}
        <div className="bg-card border border-border rounded-3xl p-8 mb-8 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className={cn(
            'w-20 h-20 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-3xl shadow-xl shrink-0',
            COLORS[empId % COLORS.length]
          )}>
            {initials || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-text-primary">{name || 'N/D'}</h1>
            <p className="text-sm text-text-secondary mt-1">{emp.ruolo ?? 'Dipendente'} {emp.dipartimento ? `· ${emp.dipartimento}` : ''}</p>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-text-secondary">
              {(emp.telefono ?? emp.telefono_personale) && (
                <a href={`tel:${emp.telefono ?? emp.telefono_personale}`} className="flex items-center gap-1 hover:text-accent transition-colors">
                  <Phone size={12} /> {emp.telefono ?? emp.telefono_personale}
                </a>
              )}
              {emp.email_personale && (
                <a href={`mailto:${emp.email_personale}`} className="flex items-center gap-1 hover:text-accent transition-colors">
                  <Mail size={12} /> {emp.email_personale}
                </a>
              )}
              {emp.telegram_id && (
                <span className="px-2 py-0.5 bg-info-bg text-info-text border border-info-border rounded-full text-[10px] font-bold">Bot attivo</span>
              )}
              <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold',
                emp.attivo === 1 ? 'bg-success-bg text-success-text border border-success-border' : 'bg-danger-bg text-danger-text border border-danger-border')}>
                {emp.attivo === 1 ? 'Attivo' : 'Inattivo'}
              </span>
            </div>
          </div>
          <div className="flex gap-4">
            {/* Pulsante Genera Codice Accesso */}
            <div className="flex flex-col gap-2 items-end justify-center">
              {generatedCode ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-xl text-center">
                  <p className="text-[10px] uppercase font-bold text-emerald-500 mb-0.5">Codice Invito</p>
                  <p className="font-mono font-bold text-lg text-emerald-400 tracking-widest">{generatedCode}</p>
                </div>
              ) : (
                <button
                  onClick={handleGenerateInvite}
                  disabled={generateInviteMut.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold hover:bg-indigo-500/20 transition-all disabled:opacity-50"
                  title="Genera un codice a 6 cifre per permettere all'utente di registrarsi tramite Google"
                >
                  {generateInviteMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                  Genera Codice Accesso
                </button>
              )}
            </div>

            <div className="hidden md:block bg-background border border-border rounded-2xl p-4 text-center min-w-[90px]">
              <p className="text-xl font-bold text-text-primary">{emp.ore_totali ?? 0}h</p>
              <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider mt-1">Ore Tot.</p>
            </div>
            <div className="hidden md:block bg-background border border-border rounded-2xl p-4 text-center min-w-[90px]">
              <p className="text-xl font-bold text-text-primary">€{(emp.costo_totale ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })}</p>
              <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider mt-1">Costo Tot.</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation + Edit buttons on the same row */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all',
                  activeTab === tab.id ? 'bg-background text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary')}>
                <tab.icon size={16} /> {tab.label}
              </button>
            ))}
          </div>

          {/* Edit actions — visible only on Anagrafica tab */}
          {activeTab === 'anagrafica' && (
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <button onClick={() => setEditing(false)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-text-secondary text-sm font-bold hover:bg-background transition-all">
                    <X size={14} /> Annulla
                  </button>
                  <button onClick={handleSave} disabled={updateMut.isPending}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent/90 disabled:opacity-50 shadow-lg shadow-accent/20 transition-all">
                    {updateMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salva
                  </button>
                </>
              ) : (
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent/10 text-accent border border-accent/20 text-sm font-bold hover:bg-accent/20 transition-all">
                  <Pencil size={14} /> Modifica
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'anagrafica' && <TabAnagrafica emp={emp} editing={editing} form={form} onChange={handleChange} />}
        {activeTab === 'costi'      && <TabCosti emp={emp} />}
        {activeTab === 'documenti'  && <TabDocumenti emp={emp} />}
      </div>
    </div>
  );
}
