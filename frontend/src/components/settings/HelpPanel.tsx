import { useState } from 'react';
import type { ElementType } from 'react';
import {
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  LifeBuoy,
  MessageCircle,
  Package,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { SectionHeader, SettingsEmptyState as EmptyState } from './settingsShared';

type HelpTab = 'manuals' | 'qa' | 'faq' | 'links';

interface HelpManual {
  id: string;
  title: string;
  desc: string;
  icon: ElementType;
  tags: string[];
  steps: string[];
  notes: string[];
}

interface HelpQuestion {
  id: string;
  question: string;
  answer: string;
  tags: string[];
}

const HELP_MANUALS: HelpManual[] = [
  {
    id: 'first-access',
    title: 'Primo accesso e account',
    desc: 'Login Google, profilo personale, password locale e collegamento Telegram.',
    icon: User,
    tags: ['account', 'login', 'telegram'],
    steps: [
      'Apri la pagina di login e accedi con Google usando l’account autorizzato.',
      'Se sei un nuovo dipendente, usa il codice invito generato da Admin o HR.',
      'Controlla i dati in Impostazioni > Il mio account.',
      'Per collegare Telegram, genera il codice pairing e invialo al bot quando richiesto.',
      'Se il tuo account usa Google Sign-In, la password locale non è modificabile.',
    ],
    notes: [
      'Il codice Telegram serve a collegare il profilo web al bot operativo.',
      'Gli account Google-only non hanno password locale nel database.',
    ],
  },
  {
    id: 'timesheets',
    title: 'Ore e spese',
    desc: 'Consultazione tabulati, stati di verifica, filtri e riepiloghi personali.',
    icon: Clock,
    tags: ['ore', 'spese', 'tabulati'],
    steps: [
      'Vai in Le mie ore e spese o nella pagina Tabulati.',
      'Usa i filtri per data, tipo record e stato di validazione.',
      'Leggi pending come record in attesa di verifica amministrativa.',
      'Leggi verified come record approvato e rejected come record rifiutato.',
      'Controlla il riepilogo per totale ore, totale spese e record ancora aperti.',
    ],
    notes: [
      'I Worker vedono solo i propri record.',
      'Admin e HR possono gestire e verificare i record secondo i permessi RBAC.',
    ],
  },
  {
    id: 'messages',
    title: 'Messaggi',
    desc: 'Chat dirette, ricerca colleghi, supporto e badge non letti.',
    icon: MessageCircle,
    tags: ['chat', 'messaggi', 'supporto'],
    steps: [
      'Apri Messaggi dalla sidebar o da Impostazioni > Supporto.',
      'Cerca una conversazione esistente dalla barra laterale.',
      'Se non trovi il collega, usa la ricerca globale e avvia una chat diretta.',
      'Scrivi il messaggio e invialo: i partecipanti ricevono l’evento realtime.',
      'Il badge non letti si aggiorna sulle conversazioni in cui sei partecipante.',
    ],
    notes: [
      'Le chat sono filtrate per partecipante: non sono pubbliche.',
      'Il supporto apre una conversazione con il referente configurato.',
    ],
  },
  {
    id: 'projects',
    title: 'Cantieri e attività',
    desc: 'Progetti, attività assegnate, documenti e dati operativi di cantiere.',
    icon: Briefcase,
    tags: ['cantieri', 'attività', 'documenti'],
    steps: [
      'Apri Cantieri per vedere l’elenco dei progetti accessibili.',
      'Entra nel dettaglio cantiere per attività, documenti, materiali e dati economici.',
      'Consulta Le mie attività per i task assegnati al tuo nome.',
      'Usa i documenti del cantiere per file operativi, fatture, DDT e allegati.',
      'Aggiorna stati e attività solo se il tuo ruolo lo consente.',
    ],
    notes: [
      'La visibilità dei cantieri dipende dal ruolo e dalle policy applicate.',
      'I dati economici sensibili sono riservati ai ruoli autorizzati.',
    ],
  },
  {
    id: 'personnel',
    title: 'Gestione personale',
    desc: 'Creazione dipendente, ruoli, codice invito e accessi Admin/HR.',
    icon: ShieldCheck,
    tags: ['hr', 'dipendenti', 'ruoli'],
    steps: [
      'Apri Gestione Personale con ruolo Admin o HR.',
      'Crea un nuovo dipendente inserendo nome, cognome, ruolo e costo orario se disponibile.',
      'Genera il codice invito per consentire il primo accesso web.',
      'Imposta il ruolo corretto: ADMIN, HR, PROJECT_MANAGER o WORKER.',
      'Controlla il dettaglio dipendente per dati anagrafici, KPI e storico.',
    ],
    notes: [
      'Solo Admin e HR possono creare o modificare dipendenti.',
      'Il ruolo determina sia le rotte accessibili sia i pulsanti visibili in UI.',
    ],
  },
  {
    id: 'warehouse',
    title: 'Magazzino e materiali',
    desc: 'Movimenti materiali, richieste personali e scarichi su cantiere.',
    icon: Package,
    tags: ['magazzino', 'materiali', 'ordini'],
    steps: [
      'Usa Magazzino per articoli, ubicazioni, giacenze e movimenti.',
      'Registra carichi o scarichi su cantiere secondo il flusso operativo.',
      'In Impostazioni > Richieste materiali trovi i movimenti eseguiti dal tuo account.',
      'Associa il materiale a cantiere e WBS quando serve al job costing.',
      'Controlla quantità, valore e data movimento per verifiche successive.',
    ],
    notes: [
      'Il magazzino completo è riservato ai ruoli autorizzati.',
      'I movimenti personali sono letti dal tuo utente loggato.',
    ],
  },
  {
    id: 'settings',
    title: 'Impostazioni',
    desc: 'Notifiche, preferenze, sicurezza, azienda, ruoli e supporto.',
    icon: SettingsIcon,
    tags: ['impostazioni', 'sicurezza', 'preferenze'],
    steps: [
      'Usa Notifiche per scegliere canali e priorità.',
      'Usa Preferenze per tema, lingua, timezone e formato data.',
      'Usa Password solo se hai un account con password locale.',
      'Usa Ruoli e permessi per leggere la matrice RBAC applicata.',
      'Usa Supporto per aprire una chat diretta con il referente interno.',
    ],
    notes: [
      'Le preferenze sono salvate sul profilo utente.',
      'Sessioni e 2FA mostrano lo stato reale disponibile, senza azioni simulate.',
    ],
  },
];

const HELP_QA: HelpQuestion[] = [
  {
    id: 'qa-section-hidden',
    question: 'Perché non vedo una sezione?',
    answer: 'La sidebar e le rotte sono filtrate dal ruolo. Per esempio Dashboard, Finanza e Magazzino sono riservate ad Admin, mentre Gestione Personale è riservata ad Admin e HR.',
    tags: ['ruoli', 'permessi'],
  },
  {
    id: 'qa-telegram',
    question: 'Come genero o uso il codice Telegram?',
    answer: 'Vai in Impostazioni > Il mio account, genera il codice Telegram e invialo al bot quando richiesto. Il codice collega il profilo web al dipendente Telegram.',
    tags: ['telegram', 'account'],
  },
  {
    id: 'qa-pending',
    question: 'Perché una spesa o un’ora è in attesa?',
    answer: 'Lo stato pending indica che il record è stato acquisito ma non ancora verificato. Admin o HR possono approvarlo o rifiutarlo dai tabulati.',
    tags: ['ore', 'spese'],
  },
  {
    id: 'qa-chat',
    question: 'Come apro una chat con un collega?',
    answer: 'Vai in Messaggi, cerca il collega. Se non c’è una conversazione esistente, la ricerca globale ti permette di crearne una diretta.',
    tags: ['messaggi', 'chat'],
  },
  {
    id: 'qa-password',
    question: 'Perché non posso cambiare password?',
    answer: 'Gli account Google-only non hanno password locale. In quel caso la sicurezza della password è gestita dall’account Google.',
    tags: ['password', 'login'],
  },
];

const HELP_FAQ: HelpQuestion[] = [
  {
    id: 'faq-hours',
    question: 'Dove trovo le mie ore?',
    answer: 'Apri Impostazioni > Le mie ore e spese oppure la rotta Timesheets. I Worker vedono solo i propri dati.',
    tags: ['ore', 'timesheets'],
  },
  {
    id: 'faq-create-employee',
    question: 'Chi può creare dipendenti?',
    answer: 'Solo gli utenti con ruolo ADMIN o HR possono creare dipendenti e generare codici invito.',
    tags: ['hr', 'dipendenti'],
  },
  {
    id: 'faq-tunnel',
    question: 'Cosa fare se tunnel o servizio non rispondono?',
    answer: 'Prima verifica che il backend sia avviato su localhost:3000. Se cloudflared segnala connection refused, il tunnel è attivo ma l’origine locale non sta rispondendo.',
    tags: ['cloudflared', 'backend'],
  },
  {
    id: 'faq-roles',
    question: 'Come vengono gestiti ADMIN, HR, PROJECT_MANAGER e WORKER?',
    answer: 'Il backend protegge le API con JWT e middleware RBAC. Il frontend nasconde rotte e pulsanti non consentiti, ma la protezione effettiva resta sul backend.',
    tags: ['rbac', 'ruoli'],
  },
  {
    id: 'faq-support',
    question: 'Come contatto il supporto?',
    answer: 'Apri Impostazioni > Supporto. Il sistema usa il referente configurato e crea o recupera una chat diretta.',
    tags: ['supporto', 'messaggi'],
  },
];

function matchesHelpQuery(query: string, item: HelpManual | HelpQuestion) {
  if (!query) return true;
  const haystack = 'steps' in item
    ? [
        item.title,
        item.desc,
        ...item.tags,
        ...item.steps,
        ...item.notes,
      ]
    : [
        item.question,
        item.answer,
        ...item.tags,
      ];

  return haystack.join(' ').toLowerCase().includes(query);
}

export function HelpPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<HelpTab>('manuals');
  const [searchQuery, setSearchQuery] = useState('');
  const [openManualId, setOpenManualId] = useState<string | null>(HELP_MANUALS[0]?.id ?? null);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);

  const links = [
    { title: 'Il mio account', desc: 'Profilo, codice Telegram e stato accesso.', to: '/settings/account', icon: User },
    { title: 'Tabulati', desc: 'Ore, spese e verifiche personali.', to: '/timesheets', icon: Clock },
    { title: 'Messaggi', desc: 'Chat dirette, supporto e conversazioni di progetto.', to: '/messages', icon: MessageCircle },
    { title: 'Cantieri', desc: 'Attività, documenti e dati operativi.', to: '/projects', icon: Briefcase },
    { title: 'Supporto', desc: 'Apri una chat con il referente interno.', to: '/settings/support', icon: LifeBuoy },
  ];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const manuals = HELP_MANUALS.filter((item) => matchesHelpQuery(normalizedQuery, item));
  const qa = HELP_QA.filter((item) => matchesHelpQuery(normalizedQuery, item));
  const faq = HELP_FAQ.filter((item) => matchesHelpQuery(normalizedQuery, item));
  const filteredLinks = links.filter((item) =>
    [item.title, item.desc, item.to].join(' ').toLowerCase().includes(normalizedQuery)
  );

  const tabs = [
    { id: 'manuals', label: 'Manuali', count: manuals.length },
    { id: 'qa', label: 'Q&A', count: qa.length },
    { id: 'faq', label: 'FAQ', count: faq.length },
    { id: 'links', label: 'Link rapidi', count: filteredLinks.length },
  ] as const;

  const hasResults = {
    manuals: manuals.length > 0,
    qa: qa.length > 0,
    faq: faq.length > 0,
    links: filteredLinks.length > 0,
  }[activeTab];

  const renderQuestionList = (items: HelpQuestion[], prefix: string) => (
    <div className="space-y-3">
      {items.map((item) => {
        const key = `${prefix}-${item.id}`;
        const isOpen = openQuestionId === key;
        return (
          <div key={item.id} className="overflow-hidden rounded-2xl border border-border bg-background">
            <button
              type="button"
              onClick={() => setOpenQuestionId(isOpen ? null : key)}
              className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-card/40"
            >
              <div>
                <p className="font-bold text-text-primary">{item.question}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-bold text-text-secondary">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <ChevronDown size={18} className={cn('shrink-0 text-text-secondary transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 text-sm leading-relaxed text-text-secondary">
                {item.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4">
        <SectionHeader title="Guida" description="Manuali operativi, Q&A e FAQ per usare Fabrar ERP." />
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Cerca manuali, FAQ, ruoli, Telegram, ore, messaggi..."
            className="w-full rounded-2xl border border-border bg-background py-3 pl-10 pr-4 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'rounded-xl border px-3 py-2 text-xs font-bold transition-all',
                activeTab === tab.id
                  ? 'border-accent bg-accent text-white shadow-sm'
                  : 'border-border bg-background text-text-secondary hover:text-text-primary'
              )}
            >
              {tab.label}
              <span className={cn('ml-2', activeTab === tab.id ? 'text-white/80' : 'text-text-secondary')}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {!hasResults && (
        <div className="space-y-4">
          <EmptyState icon={BookOpen} title="Nessun risultato" description="Prova con una ricerca diversa oppure contatta il supporto interno." />
          <button
            type="button"
            onClick={() => navigate('/settings/support')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-bold text-white shadow-lg transition-all hover:bg-accent/90"
          >
            <LifeBuoy size={16} />
            Contatta supporto
          </button>
        </div>
      )}

      {activeTab === 'manuals' && manuals.length > 0 && (
        <div className="space-y-4">
          {manuals.map((manual) => {
            const Icon = manual.icon;
            const isOpen = openManualId === manual.id;
            return (
              <div key={manual.id} className="overflow-hidden rounded-2xl border border-border bg-background">
                <button
                  type="button"
                  onClick={() => setOpenManualId(isOpen ? null : manual.id)}
                  className="flex w-full items-start justify-between gap-4 p-5 text-left transition-colors hover:bg-card/40"
                >
                  <div className="flex min-w-0 gap-4">
                    <div className="shrink-0 rounded-xl bg-card p-2 text-text-secondary">
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-text-primary">{manual.title}</p>
                      <p className="mt-1 text-sm text-text-secondary">{manual.desc}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {manual.tags.map((tag) => (
                          <span key={tag} className="rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-bold text-text-secondary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <ChevronDown size={18} className={cn('mt-1 shrink-0 text-text-secondary transition-transform', isOpen && 'rotate-180')} />
                </button>

                {isOpen && (
                  <div className="space-y-5 px-5 pb-5">
                    <div className="pl-12">
                      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-text-secondary">Procedura</p>
                      <ol className="space-y-2">
                        {manual.steps.map((step, index) => (
                          <li key={step} className="flex gap-3 text-sm leading-relaxed text-text-secondary">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-[11px] font-bold text-text-primary">
                              {index + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="ml-12 rounded-xl border border-border bg-card p-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-text-secondary">Note operative</p>
                      <ul className="space-y-1.5">
                        {manual.notes.map((note) => (
                          <li key={note} className="flex gap-2 text-sm text-text-secondary">
                            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success-text" />
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'qa' && qa.length > 0 && renderQuestionList(qa, 'qa')}
      {activeTab === 'faq' && faq.length > 0 && renderQuestionList(faq, 'faq')}

      {activeTab === 'links' && filteredLinks.length > 0 && (
        <div className="grid gap-3">
          {filteredLinks.map(({ title, desc, to, icon: Icon }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4 text-left transition-all hover:border-accent/30"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-card p-2 text-text-secondary"><Icon size={20} /></div>
                <div>
                  <p className="font-semibold text-text-primary">{title}</p>
                  <p className="text-xs text-text-secondary">{desc}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-text-secondary" />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-text-primary">Non hai trovato la risposta?</p>
          <p className="text-sm text-text-secondary">Apri una conversazione con il referente supporto configurato.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/settings/support')}
          className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white transition-all hover:bg-accent/90"
        >
          <LifeBuoy size={16} />
          Contatta supporto
        </button>
      </div>
    </div>
  );
}
