import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { Activity, ArrowRight, Check, Moon, Sun, X } from 'lucide-react'
import { supabase, loadCoreData } from '@/lib/supabase'
import { previewData, previewUser } from '@/lib/fixtures'
import { buildViewModel } from '@/lib/business'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BrandMark, MobileNav, Sidebar, Topbar } from '@/components/app-chrome'
import Dashboard from '@/screens/dashboard'
import { cn } from '@/lib/utils'
import { applyPreferences, tr } from '@/lib/preferences'

const isPreview = new URLSearchParams(window.location.search).get('preview') === '1'
const loadStudentsScreen = () => import('@/screens/students')
const loadPaymentsScreen = () => import('@/screens/payments')
const loadAnalyticsScreen = () => import('@/screens/analytics')
const loadConfigurationScreen = () => import('@/screens/configuration')
const loadActionSheets = () => import('@/components/action-sheets')
const StudentsScreen = lazy(loadStudentsScreen)
const PaymentsScreen = lazy(loadPaymentsScreen)
const AnalyticsScreen = lazy(loadAnalyticsScreen)
const ConfigurationScreen = lazy(loadConfigurationScreen)
const NewStudentSheet = lazy(() => loadActionSheets().then(module => ({ default: module.NewStudentSheet })))
const StudentSheet = lazy(() => loadActionSheets().then(module => ({ default: module.StudentSheet })))
const PaymentSheet = lazy(() => loadActionSheets().then(module => ({ default: module.PaymentSheet })))
const ReceiptSheet = lazy(() => loadActionSheets().then(module => ({ default: module.ReceiptSheet })))

const readCachedRates = () => {
  try { return JSON.parse(localStorage.getItem('beva-exchange-rates') || 'null') || { XOF: 1 } }
  catch { return { XOF: 1 } }
}

export default function App() {
  const [session, setSession] = useState(isPreview ? { user: previewUser } : null)
  const [data, setData] = useState(isPreview ? previewData : null)
  const [loading, setLoading] = useState(!isPreview)
  const [error, setError] = useState('')
  const [section, setSection] = useState('dashboard')
  const [intakeId, setIntakeId] = useState(isPreview ? 'v2' : null)
  const [toast, setToast] = useState(null)
  const [studentSheet, setStudentSheet] = useState(null)
  const [paymentSheet, setPaymentSheet] = useState(null)
  const [receiptSheet, setReceiptSheet] = useState(null)
  const [newStudentOpen, setNewStudentOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [theme,setTheme]=useState(()=>localStorage.getItem('beva-theme')||'light')
  const [language,setLanguage]=useState(()=>localStorage.getItem('beva-language')||'fr')
  const [currency,setCurrency]=useState(()=>localStorage.getItem('beva-currency')||'XOF')
  const [exchangeRates,setExchangeRates]=useState(readCachedRates)
  const [ratesUpdatedAt,setRatesUpdatedAt]=useState(()=>localStorage.getItem('beva-exchange-rates-date')||null)
  const [ratesStatus,setRatesStatus]=useState('loading')

  applyPreferences({ language, currency, rates: exchangeRates, ratesUpdatedAt })

  useEffect(()=>{localStorage.setItem('beva-theme',theme);document.documentElement.classList.toggle('dark',theme==='dark')},[theme])
  useEffect(()=>{localStorage.setItem('beva-language',language);document.documentElement.lang=language},[language])
  useEffect(()=>{localStorage.setItem('beva-currency',currency)},[currency])

  const refreshExchangeRates = useCallback(async () => {
    setRatesStatus('loading')
    try {
      const response = await fetch('https://api.frankfurter.dev/v2/rates?base=XOF&quotes=EUR,USD,JPY')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json()
      const rows = Array.isArray(payload) ? payload : Object.entries(payload.rates || {}).map(([quote,rate]) => ({ quote, rate, date: payload.date }))
      const next = { XOF: 1 }
      rows.forEach(item => { if (['EUR','USD','JPY'].includes(String(item.quote).toUpperCase())) next[String(item.quote).toUpperCase()] = Number(item.rate) })
      if (!next.EUR || !next.USD || !next.JPY) throw new Error('Taux incomplets')
      const updatedAt = rows.find(item => item.date)?.date || new Date().toISOString().slice(0,10)
      setExchangeRates(next);setRatesUpdatedAt(updatedAt);setRatesStatus('ready')
      localStorage.setItem('beva-exchange-rates',JSON.stringify(next));localStorage.setItem('beva-exchange-rates-date',updatedAt)
    } catch {
      setRatesStatus(Object.keys(exchangeRates).length > 1 ? 'cached' : 'error')
    }
  }, [])

  useEffect(()=>{refreshExchangeRates()},[refreshExchangeRates])

  const showToast = useCallback((message, bad = false) => {
    setToast({ message, bad })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const userId = session?.user?.id

  const refresh = useCallback(async () => {
    if (isPreview || !userId) return
    const next = await loadCoreData(userId)
    setData(next)
    setIntakeId(current => next.intakes.some(item => item.id === current) ? current : (next.intakes.find(item => item.active)?.id || next.intakes[0]?.id || null))
  }, [userId])

  useEffect(() => {
    if (isPreview) return
    let alive = true
    supabase.auth.getSession().then(({ data: authData, error: authError }) => {
      if (!alive) return
      if (authError) setError(authError.message)
      setSession(authData.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return
      setSession(current => current?.access_token === nextSession?.access_token ? current : nextSession)
    })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (isPreview || !userId) return
    setLoading(true)
    loadCoreData(userId).then(next => {
      if (!next.staff?.active) throw new Error(tr('Ce compte ne dispose pas d’un accès actif à BEVA Gestion.', 'This account does not have active access to BEVA Gestion.'))
      setData(next)
      setIntakeId(next.intakes.find(item => item.active)?.id || next.intakes[0]?.id || null)
    }).catch(loadError => setError(loadError.message)).finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!data) return
    const prefetch = () => Promise.allSettled([loadStudentsScreen(), loadPaymentsScreen(), loadAnalyticsScreen(), loadConfigurationScreen()])
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 2400 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(prefetch, 900)
    return () => window.clearTimeout(id)
  }, [Boolean(data)])

  const view = useMemo(() => data && intakeId ? buildViewModel(data, intakeId) : null, [data, intakeId])

  const mutate = async ({ preview, live, success }) => {
    try {
      if (isPreview) setData(current => preview(current))
      else { const result = await live(); if (result?.error) throw result.error; await refresh() }
      showToast(success)
    } catch (mutationError) { showToast(mutationError.message || tr('L’opération a échoué.', 'The operation failed.'), true) }
  }

  if (loading) return <LoadingScreen />
  if (!session) return <LoginScreen onError={setError} error={error} theme={theme} onToggleTheme={()=>setTheme(value=>value==='dark'?'light':'dark')} />
  if (error && !data) return <ErrorScreen error={error} />
  if (!data || !view) return <LoadingScreen />

  const shared = { data, view, intakeId, showToast, mutate }
  return <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 390, damping: 36 }}><div className={cn('beva-shell',theme==='dark'&&'dark')}>
    <Sidebar section={section} onSection={value => { setSection(value); setMobileMenu(false) }} staff={data.staff} onLogout={() => supabase.auth.signOut()} className={mobileMenu ? 'mobile-open' : ''} />
    <div className="beva-workspace"><Topbar section={section} intakes={data.intakes} intakeId={intakeId} setIntakeId={setIntakeId} onNewStudent={() => setNewStudentOpen(true)} onMenu={() => setMobileMenu(value => !value)} theme={theme} onToggleTheme={()=>setTheme(value=>value==='dark'?'light':'dark')} /><main className="beva-content"><AnimatePresence initial={false}><motion.div key={section} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .16, ease: [.2,.8,.2,1] }}>
      <Suspense fallback={<SectionLoader />}>
        {section === 'dashboard' && <Dashboard {...shared} intake={data.intakes.find(item => item.id === intakeId)} onSection={setSection} />}
        {section === 'students' && <StudentsScreen {...shared} onStudent={setStudentSheet} onNew={() => setNewStudentOpen(true)} />}
        {section === 'payments' && <PaymentsScreen {...shared} onPayment={setPaymentSheet} onStudent={setStudentSheet} onReceipt={setReceiptSheet} />}
        {section === 'analytics' && <AnalyticsScreen {...shared} onStudent={setStudentSheet} />}
        {section === 'configuration' && <ConfigurationScreen {...shared} setIntakeId={setIntakeId} onSection={setSection} language={language} currency={currency} setLanguage={setLanguage} setCurrency={setCurrency} exchangeRates={exchangeRates} ratesUpdatedAt={ratesUpdatedAt} ratesStatus={ratesStatus} refreshExchangeRates={refreshExchangeRates} />}
      </Suspense>
    </motion.div></AnimatePresence></main><MobileNav section={section} onSection={setSection} /></div>
    <Suspense fallback={null}>
      {newStudentOpen&&<NewStudentSheet open={newStudentOpen} onOpenChange={setNewStudentOpen} data={data} intakeId={intakeId} mutate={mutate} />}
      {studentSheet&&<StudentSheet student={studentSheet} onClose={() => setStudentSheet(null)} data={data} view={view} mutate={mutate} onReceipt={setReceiptSheet} onPayment={enrollment => { setStudentSheet(null); setPaymentSheet(enrollment) }} />}
      {paymentSheet&&<PaymentSheet enrollment={paymentSheet} onClose={() => setPaymentSheet(null)} data={data} mutate={mutate} />}
      {receiptSheet&&<ReceiptSheet payment={receiptSheet} onClose={() => setReceiptSheet(null)} data={data} />}
    </Suspense>
    <AnimatePresence>{toast && <Toast {...toast} />}</AnimatePresence>{mobileMenu && <button type="button" className="mobile-overlay" aria-label="Fermer le menu" onClick={() => setMobileMenu(false)} />}
  </div></MotionConfig>
}

function SectionLoader() { return <div className="section-loader" aria-label="Chargement de la rubrique"><i/><i/><i/></div> }
function LoadingScreen() { return <div className="loading-screen"><motion.div className="grid justify-items-center gap-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><BrandMark large /><div className="grid gap-2 text-center"><strong className="text-sm">{tr('Préparation de votre espace', 'Preparing your workspace')}</strong><span>{tr('Synchronisation des dossiers BEVA…', 'Synchronising BEVA records…')}</span></div><div className="loading-track"><motion.i animate={{ x: ['-100%','200%'] }} transition={{ duration: 1.05, repeat: Infinity, ease: 'easeInOut' }} /></div></motion.div></div> }

function LoginScreen({ error, onError, theme, onToggleTheme }) {
  const [forgot, setForgot] = useState(false); const [busy, setBusy] = useState(false)
  async function submit(event) { event.preventDefault(); setBusy(true); onError(''); const form = new FormData(event.currentTarget); const email = form.get('email'); const result = forgot ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] }) : await supabase.auth.signInWithPassword({ email, password: form.get('password') }); if (result.error) onError(result.error.message); else if (forgot) onError('Un lien sécurisé a été envoyé à votre adresse e-mail.'); setBusy(false) }
  return <div className="login-v2"><section className="login-story"><BrandMark large /><div><p className="login-eyebrow">BEVA · {tr('Gestion interne', 'Internal management')}</p><h1>{tr('Gérer l’essentiel.', 'Manage what matters.')}<br/><span>{tr('Comprendre le reste.', 'Understand the rest.')}</span></h1><p>{tr('Un espace unique pour suivre les étudiants, les formations et les paiements avec clarté.', 'One clear workspace for students, courses and payments.')}</p></div><small>{tr('Accès réservé au personnel autorisé', 'Access restricted to authorised staff')}</small></section><section className="login-form-wrap"><button type="button" className="theme-switch-v2 login-theme-switch" onClick={onToggleTheme} aria-label={theme==='dark'?tr('Activer le mode clair', 'Enable light mode'):tr('Activer le mode sombre', 'Enable dark mode')}><span>{theme==='dark'?<Sun/>:<Moon/>}</span><b>{theme==='dark'?tr('Mode clair', 'Light mode'):tr('Mode sombre', 'Dark mode')}</b></button><motion.form className="login-form" onSubmit={submit} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}><Badge variant="info"><Activity/> {tr('Espace sécurisé', 'Secure workspace')}</Badge><h2>{forgot ? tr('Réinitialiser le mot de passe', 'Reset password') : tr('Heureux de vous revoir', 'Welcome back')}</h2><p>{forgot ? tr('Nous vous enverrons un lien de récupération.', 'We will send you a recovery link.') : tr('Connectez-vous pour ouvrir votre tableau de bord.', 'Sign in to open your dashboard.')}</p><label>{tr('Adresse e-mail', 'Email address')}<input name="email" type="email" required autoComplete="email" placeholder="vous@beva.bj" /></label>{!forgot && <label>{tr('Mot de passe', 'Password')}<input name="password" type="password" required autoComplete="current-password" /></label>}<p className={cn('min-h-5 text-xs', error?.startsWith('Un lien') ? 'text-emerald-600' : 'text-destructive')}>{error}</p><Button className="w-full" size="lg" disabled={busy}>{busy ? tr('Veuillez patienter…', 'Please wait…') : forgot ? tr('Envoyer le lien', 'Send link') : tr('Se connecter', 'Sign in')}<ArrowRight /></Button><button type="button" className="text-xs font-semibold text-primary" onClick={() => { setForgot(value => !value); onError('') }}>{forgot ? tr('Retour à la connexion', 'Back to sign in') : tr('Mot de passe oublié ?', 'Forgot password?')}</button></motion.form></section></div>
}

function ErrorScreen({ error }) { return <div className="grid min-h-screen place-items-center bg-background p-6"><div className="max-w-md rounded-3xl border bg-card p-8 text-center shadow-xl"><BrandMark /><h1 className="mt-5 text-xl font-bold">{tr('BEVA Gestion n’a pas pu démarrer', 'BEVA Gestion could not start')}</h1><p className="mt-3 text-sm text-muted-foreground">{error}</p><Button className="mt-6" onClick={() => window.location.reload()}>{tr('Réessayer', 'Try again')}</Button></div></div> }
function Toast({ message, bad }) { return <motion.div className={cn('toast-v2',bad&&'bad')} initial={{opacity:0,y:20,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:12,scale:.97}}><span>{bad?<X/>:<Check/>}</span>{message}</motion.div> }
