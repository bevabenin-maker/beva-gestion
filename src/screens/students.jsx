import { useState } from 'react'
import { LayoutGroup, motion } from 'motion/react'
import { ArrowRight, FileSpreadsheet, NotebookPen, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FormationOrbit } from '@/components/visuals'
import { cn } from '@/lib/utils'
import { displayCode, initials, noteSummary, studentName, studentStatusLabel } from '@/lib/business'

export default function StudentsScreen({ data, view, intakeId, onStudent, onNew, showToast }) {
  const [formationId,setFormationId]=useState('all')
  const [search,setSearch]=useState('')
  const filtered=view.students.filter(student=>{const active=view.activeEnrollments.filter(enrollment=>enrollment.student_id===student.id);const formationMatch=formationId==='all'||(formationId==='unclassified'?active.length===0:active.some(enrollment=>enrollment.formation_id===formationId));const text=`${studentName(student)} ${student.phone||''} ${student.intake_student_number||''}`.toLocaleLowerCase('fr');return formationMatch&&text.includes(search.toLocaleLowerCase('fr'))})
  async function exportAll(){try{const { downloadStudentsExcel }=await import('../excelExport.js');await downloadStudentsExcel({...data,intakeFilter:intakeId},intakeId);showToast('Export Excel préparé.')}catch(error){showToast(error.message,true)}}
  return <LayoutGroup><section className="students-command"><div><Badge variant="info">{view.students.length} profils</Badge><h2>Retrouvez une personne<br/><span>par son parcours.</span></h2><p>Choisissez une formation dans l’espace ci-dessous, ou recherchez directement un étudiant.</p></div><FormationOrbit items={view.formationCounts} selected={formationId} onSelect={setFormationId}/></section><div className="student-controls"><label><Search/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Nom, numéro ou téléphone…" /></label><div><Button variant="outline" onClick={exportAll}><FileSpreadsheet/>Exporter</Button><Button onClick={onNew}><Plus/>Ajouter</Button></div></div><div className="student-grid">{filtered.map((student,index)=><StudentCard key={student.id} student={student} view={view} data={data} onOpen={()=>onStudent(student)} index={index}/>)}</div>{filtered.length===0&&<EmptyState/>}</LayoutGroup>
}

function StudentCard({ student, view, data, onOpen, index }) {
  const enrollments=view.activeEnrollments.filter(item=>item.student_id===student.id);const formationNames=enrollments.map(item=>view.formationMap.get(item.formation_id)?.name).filter(Boolean);const statusVariant=student.status==='actif'?'success':student.status==='abandonne'?'danger':'warning'
  return <motion.button layout type="button" className="student-card-v2" onClick={onOpen} initial={{opacity:0,scale:.97}} animate={{opacity:1,scale:1}} transition={{delay:Math.min(index,8)*.035}} whileHover={{y:-4}}><div className="student-card-top"><span className={cn('avatar-shape',`shape-${index%5}`)}>{initials(student)}</span><Badge variant={statusVariant} dot>{studentStatusLabel(student.status)}</Badge></div><div className="student-card-name"><strong>{studentName(student)}</strong><span>N° {student.intake_student_number||displayCode(student.registration_code)}</span></div><div className="student-card-path">{formationNames.length?formationNames.map(name=><span key={name}>{name}</span>):<span className="unclassified">À classer</span>}</div><div className="student-card-foot"><span><NotebookPen/>{noteSummary(data.studentNotes,student.id)}</span><i><ArrowRight/></i></div></motion.button>
}

function EmptyState(){return <div className="empty-state-v2"><div><Search/></div><strong>Aucun étudiant trouvé</strong><p>Modifiez la recherche ou choisissez une autre formation.</p></div>}
