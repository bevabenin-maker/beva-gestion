const now = new Date()
const iso = days => new Date(now.getTime() - days * 86400000).toISOString()

export const previewUser = { id: 'preview-user', email: 'direction@beva.test' }

export const previewData = {
  staff: { user_id: 'preview-user', full_name: 'Ange-Hervé DANNON', role: 'direction', active: true },
  staffDirectory: [{ user_id: 'preview-user', full_name: 'Ange-Hervé DANNON' }],
  intakes: [
    { id: 'v2', name: 'Vague 2 · 2026', active: true, start_date: '2026-10-05', end_date: '2027-01-31' },
    { id: 'v1', name: 'Vague 1 · 2026', active: false, start_date: '2026-02-01', end_date: '2026-05-31' }
  ],
  formations: [
    { id: 'anglais', name: 'Anglais', active: true, duration_months: 3 },
    { id: 'japonais', name: 'Japonais', active: true, duration_months: 3 },
    { id: 'design', name: 'Design & Marketing Digital', active: true, duration_months: 3 },
    { id: 'montage', name: 'Montage vidéo', active: true, duration_months: 3 },
    { id: 'ia', name: 'IA — outils & applications', active: true, duration_months: 3 }
  ],
  students: [
    { id: 's1', intake_id: 'v2', intake_student_number: 47, last_name: 'KPODAR', first_name: 'Awa', phone: '+229 97 00 00 41', email: 'awa@example.com', birth_date: '2001-04-12', status: 'actif', created_at: iso(2) },
    { id: 's2', intake_id: 'v2', intake_student_number: 46, last_name: 'HOUNTON', first_name: 'Marius', phone: '+229 96 00 00 18', email: 'marius@example.com', birth_date: '1998-08-22', status: 'actif', created_at: iso(4) },
    { id: 's3', intake_id: 'v2', intake_student_number: 45, last_name: 'SOSSOU', first_name: 'Diane', phone: '+229 94 00 00 26', email: 'diane@example.com', birth_date: '2004-02-14', status: 'actif', created_at: iso(5) },
    { id: 's4', intake_id: 'v2', intake_student_number: 44, last_name: 'AGOSSOU', first_name: 'Olivier', phone: '+229 99 00 00 07', email: 'olivier@example.com', birth_date: '1996-11-03', status: 'actif', created_at: iso(7) },
    { id: 's5', intake_id: 'v2', intake_student_number: 43, last_name: 'TOGNON', first_name: 'Grâce', phone: '+229 95 00 00 12', email: 'grace@example.com', birth_date: '2000-06-30', status: 'actif', created_at: iso(9) },
    { id: 's6', intake_id: 'v2', intake_student_number: 42, last_name: 'DOSSOU', first_name: 'Christian', phone: '+229 91 00 00 32', email: 'christian@example.com', birth_date: '1994-03-19', status: 'actif', created_at: iso(10) },
    { id: 's7', intake_id: 'v2', intake_student_number: 41, last_name: 'ADJOVI', first_name: 'Merveille', phone: '+229 90 00 00 05', email: 'merveille@example.com', birth_date: '2003-09-11', status: 'suspendu', created_at: iso(11) },
    { id: 's8', intake_id: 'v2', intake_student_number: 40, last_name: 'AHOYO', first_name: 'Daniel', phone: '+229 98 00 00 28', email: 'daniel@example.com', birth_date: '1999-01-24', status: 'actif', created_at: iso(14) }
  ],
  enrollments: [
    { id: 'e1', student_id: 's1', slot: 1, dossier_code: 'IN-0021', formation_id: 'anglais', status: 'inscrit', scholarship_status: true, agreed_fee: 90000, enrolled_at: '2026-10-05' },
    { id: 'e2', student_id: 's2', slot: 1, dossier_code: 'IN-0020', formation_id: 'ia', status: 'inscrit', scholarship_status: false, agreed_fee: 180000, enrolled_at: '2026-10-05' },
    { id: 'e3', student_id: 's3', slot: 1, dossier_code: 'IN-0019', formation_id: 'montage', status: 'inscrit', scholarship_status: true, agreed_fee: 90000, enrolled_at: '2026-10-05' },
    { id: 'e4', student_id: 's4', slot: 1, dossier_code: 'IN-0018', formation_id: 'japonais', status: 'inscrit', scholarship_status: true, agreed_fee: 90000, enrolled_at: '2026-10-05' },
    { id: 'e5', student_id: 's5', slot: 1, dossier_code: 'IN-0017', formation_id: null, status: 'disponible', scholarship_status: false, agreed_fee: 180000 },
    { id: 'e6', student_id: 's6', slot: 1, dossier_code: 'IN-0016', formation_id: 'design', status: 'inscrit', scholarship_status: true, agreed_fee: 90000, enrolled_at: '2026-10-05' },
    { id: 'e7', student_id: 's7', slot: 1, dossier_code: 'IN-0015', formation_id: 'anglais', status: 'disponible', scholarship_status: true, agreed_fee: 90000 },
    { id: 'e8', student_id: 's8', slot: 1, dossier_code: 'IN-0014', formation_id: 'design', status: 'inscrit', scholarship_status: false, agreed_fee: 180000, enrolled_at: '2026-10-05' }
  ],
  payments: [
    { id: 'p1', enrollment_id: 'e1', amount: 30000, billing_month: 1, method: 'mobile_money', paid_at: iso(1), reference: 'BEVA-PAY-001' },
    { id: 'p2', enrollment_id: 'e1', amount: 30000, billing_month: 2, method: 'mobile_money', paid_at: iso(2), reference: 'BEVA-PAY-002' },
    { id: 'p3', enrollment_id: 'e2', amount: 60000, billing_month: 1, method: 'especes', paid_at: iso(3), reference: 'BEVA-PAY-003' },
    { id: 'p4', enrollment_id: 'e2', amount: 60000, billing_month: 2, method: 'especes', paid_at: iso(4), reference: 'BEVA-PAY-004' },
    { id: 'p5', enrollment_id: 'e3', amount: 90000, billing_month: 3, method: 'banque', paid_at: iso(5), reference: 'BEVA-PAY-005' },
    { id: 'p6', enrollment_id: 'e4', amount: 30000, billing_month: 1, method: 'mobile_money', paid_at: iso(6), reference: 'BEVA-PAY-006' },
    { id: 'p7', enrollment_id: 'e6', amount: 60000, billing_month: 2, method: 'especes', paid_at: iso(8), reference: 'BEVA-PAY-007' },
    { id: 'p8', enrollment_id: 'e8', amount: 60000, billing_month: 1, method: 'mobile_money', paid_at: iso(9), reference: 'BEVA-PAY-008' }
  ],
  studentNotes: [
    { id: 'n1', student_id: 's1', content: 'Paiera le reste le 24 octobre après réception de son salaire.', follow_up_on: '2026-10-24', created_by: 'preview-user', created_at: iso(1) },
    { id: 'n2', student_id: 's2', content: 'Préfère être contacté après 18 h.', follow_up_on: null, created_by: 'preview-user', created_at: iso(3) },
    { id: 'n3', student_id: 's6', content: 'Doit confirmer son mode de suivi.', follow_up_on: '2026-10-25', created_by: 'preview-user', created_at: iso(2) }
  ],
  paymentAudit: []
}
