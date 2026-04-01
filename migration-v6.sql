-- ==========================================
-- MIGRATION v6: Patient files (exams, photos, documents)
-- ==========================================

CREATE TABLE IF NOT EXISTS patient_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id),
  patient_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  file_url TEXT NOT NULL,
  file_type TEXT DEFAULT 'other',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE patient_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nina manages patient files" ON patient_files FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);

CREATE POLICY "Patients see own files" ON patient_files FOR SELECT USING (
  patient_id = auth.uid()
);
