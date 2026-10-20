import { motion } from 'motion/react'
import { BarChart3, Bell, ChevronDown, Layers3, LayoutDashboard, LogOut, Menu, Moon, Plus, Search, Settings2, Sun, Users, WalletCards, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { initials, roleLabel } from '@/lib/business'

export const sectionMeta = {
  dashboard: { label: 'Accueil', title: 'Tableau de bord', subtitle: 'L’essentiel de BEVA en un regard', icon: LayoutDashboard },
  students: { label: 'Étudiants', title: 'Étudiants', subtitle: 'Dossiers, formations et notes de suivi', icon: Users },
  payments: { label: 'Paiements', title: 'Paiements', subtitle: 'Situation financière par formation', icon: WalletCards },
  analytics: { label: 'Analyses', title: 'Analyses', subtitle: 'Interrogez les données en langage naturel', icon: BarChart3 },
  configuration: { label: 'Configuration', title: 'Configuration', subtitle: 'Formations et vagues réunies au même endroit', icon: Settings2 }
}

export function BrandMark({ large = false }) {
  return <div className={cn('brand-mark-v2', large && 'large')}><span>B</span></div>
}

export function Sidebar({ section, onSection, staff, onLogout, className }) {
  return <aside className={cn('sidebar-v2', className)}>
    <div className="sidebar-brand"><BrandMark /><div><strong>BEVA</strong><small>Gestion interne</small></div><button type="button" className="sidebar-mobile-close" onClick={() => onSection(section)}><X /></button></div>
    <p className="sidebar-label">Pilotage</p>
    <nav>{Object.entries(sectionMeta).map(([key,item]) => { const Icon=item.icon; return <button key={key} type="button" className={cn(section===key&&'active')} onClick={()=>onSection(key)}>{section===key&&<motion.i layoutId="nav-active" className="nav-active-bg" />}<Icon/><span>{item.label}</span></button> })}</nav>
    <div className="sidebar-foot"><div className="staff-chip"><div className="staff-avatar">{initials({first_name:staff?.full_name?.split(' ')[0],last_name:staff?.full_name?.split(' ').slice(-1)[0]})}</div><div><strong>{staff?.full_name}</strong><small>{roleLabel(staff?.role)}</small></div></div><Button variant="ghost" size="sm" className="w-full justify-start text-slate-300 hover:bg-white/8 hover:text-white" onClick={onLogout}><LogOut/>Déconnexion</Button></div>
  </aside>
}

export function Topbar({ section, intakes, intakeId, setIntakeId, onNewStudent, onMenu, theme, onToggleTheme }) {
  const meta=sectionMeta[section]
  return <header className="topbar-v2"><div className="topbar-title"><button type="button" className="mobile-menu-button" onClick={onMenu}><Menu /></button><div><motion.h1 layoutId="page-title">{meta.title}</motion.h1><p>{meta.subtitle}</p></div></div><div className="topbar-actions"><label className="global-search"><Search/><input placeholder="Rechercher…" aria-label="Rechercher" /></label><label className="intake-select"><Layers3/><select value={intakeId || ''} onChange={event=>setIntakeId(event.target.value)}>{intakes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown/></label><button type="button" className="theme-switch-v2" aria-label={theme==='dark'?'Activer le mode clair':'Activer le mode sombre'} onClick={onToggleTheme}><span>{theme==='dark'?<Moon/>:<Sun/>}</span><b>{theme==='dark'?'Sombre':'Clair'}</b></button><Button variant="secondary" size="icon" aria-label="Notifications"><Bell/></Button><Button onClick={onNewStudent} className="new-student-top"><Plus/>Nouvel étudiant</Button></div></header>
}

export function MobileNav({ section, onSection }) {
  return <nav className="mobile-nav-v2">{Object.entries(sectionMeta).map(([key,item])=>{const Icon=item.icon;return <button key={key} className={section===key?'active':''} type="button" onClick={()=>onSection(key)}>{section===key&&<motion.i layoutId="mobile-nav-active"/>}<Icon/><span>{item.label}</span></button>})}</nav>
}
