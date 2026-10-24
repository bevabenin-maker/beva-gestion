import { motion } from 'motion/react'
import { BarChart3, Bell, ChevronDown, Layers3, LayoutDashboard, LogOut, Menu, Moon, Plus, Search, Settings2, Sun, Users, WalletCards, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { initials, roleLabel } from '@/lib/business'
import { tr } from '@/lib/preferences'

const getSectionMeta = () => ({
  dashboard: { label: tr('Accueil', 'Home'), title: tr('Tableau de bord', 'Dashboard'), subtitle: tr('L’essentiel de BEVA en un regard', 'BEVA at a glance'), icon: LayoutDashboard },
  students: { label: tr('Étudiants', 'Students'), title: tr('Étudiants', 'Students'), subtitle: tr('Dossiers, formations et notes de suivi', 'Records, courses and follow-up notes'), icon: Users },
  payments: { label: tr('Paiements', 'Payments'), title: tr('Paiements', 'Payments'), subtitle: tr('Situation financière par formation', 'Financial position by course'), icon: WalletCards },
  analytics: { label: tr('Analyses', 'Analytics'), title: tr('Analyses', 'Analytics'), subtitle: tr('Interrogez les données en langage naturel', 'Explore data using natural language'), icon: BarChart3 },
  configuration: { label: tr('Configuration', 'Settings'), title: tr('Configuration', 'Settings'), subtitle: tr('Formations, vagues et préférences', 'Courses, cohorts and preferences'), icon: Settings2 }
})

export function BrandMark({ large = false }) {
  return <div className={cn('brand-mark-v2', large && 'large')}><span>B</span></div>
}

export function Sidebar({ section, onSection, staff, onLogout, className }) {
  return <aside className={cn('sidebar-v2', className)}>
    <div className="sidebar-brand"><BrandMark /><div><strong>BEVA</strong><small>{tr('Gestion interne', 'Internal management')}</small></div><button type="button" className="sidebar-mobile-close" aria-label={tr('Fermer le menu', 'Close menu')} onClick={() => onSection(section)}><X /></button></div>
    <p className="sidebar-label">{tr('Pilotage', 'Management')}</p>
    <nav>{Object.entries(getSectionMeta()).map(([key,item]) => { const Icon=item.icon; return <button key={key} type="button" className={cn(section===key&&'active')} onClick={()=>onSection(key)}>{section===key&&<motion.i layoutId="nav-active" className="nav-active-bg" />}<Icon/><span>{item.label}</span></button> })}</nav>
    <div className="sidebar-foot"><div className="sidebar-account"><div className="staff-avatar">{initials({first_name:staff?.full_name?.split(' ')[0],last_name:staff?.full_name?.split(' ').slice(-1)[0]})}</div><div className="staff-identity"><strong title={staff?.full_name}>{staff?.full_name}</strong><small>{roleLabel(staff?.role)}</small></div><button type="button" className="sidebar-logout" aria-label={tr('Se déconnecter', 'Sign out')} title={tr('Se déconnecter', 'Sign out')} onClick={onLogout}><LogOut/><span>{tr('Déconnexion', 'Sign out')}</span></button></div></div>
  </aside>
}

export function Topbar({ section, intakes, intakeId, setIntakeId, onNewStudent, onMenu, theme, onToggleTheme }) {
  const meta=getSectionMeta()[section]
  return <header className="topbar-v2"><div className="topbar-title"><button type="button" className="mobile-menu-button" aria-label={tr('Ouvrir le menu', 'Open menu')} onClick={onMenu}><Menu /></button><div><motion.h1 layoutId="page-title">{meta.title}</motion.h1><p>{meta.subtitle}</p></div></div><div className="topbar-actions"><label className="global-search"><Search/><input placeholder={tr('Rechercher…', 'Search…')} aria-label={tr('Rechercher', 'Search')} /></label><label className="intake-select"><Layers3/><select value={intakeId || ''} onChange={event=>setIntakeId(event.target.value)}>{intakes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown/></label><button type="button" className="theme-switch-v2" aria-label={theme==='dark'?tr('Activer le mode clair', 'Enable light mode'):tr('Activer le mode sombre', 'Enable dark mode')} onClick={onToggleTheme}><span>{theme==='dark'?<Moon/>:<Sun/>}</span><b>{theme==='dark'?tr('Sombre', 'Dark'):tr('Clair', 'Light')}</b></button><Button variant="secondary" size="icon" aria-label={tr('Notifications', 'Notifications')}><Bell/></Button><Button onClick={onNewStudent} className="new-student-top"><Plus/>{tr('Nouvel étudiant', 'New student')}</Button></div></header>
}

export function MobileNav({ section, onSection }) {
  return <nav className="mobile-nav-v2">{Object.entries(getSectionMeta()).map(([key,item])=>{const Icon=item.icon;return <button key={key} className={section===key?'active':''} type="button" onClick={()=>onSection(key)}>{section===key&&<motion.i layoutId="mobile-nav-active"/>}<Icon/><span>{item.label}</span></button>})}</nav>
}
