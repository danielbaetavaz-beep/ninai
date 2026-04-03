-- ==========================================
-- MIGRATION v10: Patient measurements for evolution tracking
-- ==========================================

CREATE TABLE IF NOT EXISTS patient_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id),
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  weight_kg NUMERIC,
  height_cm NUMERIC,
  body_fat_pct NUMERIC,
  lean_mass_kg NUMERIC,
  water_pct NUMERIC,
  waist_cm NUMERIC,
  hip_cm NUMERIC,
  notes TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE patient_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nina manages measurements" ON patient_measurements FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);
CREATE POLICY "Patients read own measurements" ON patient_measurements FOR SELECT USING (
  patient_id = auth.uid()
);

-- Add anamnesis and consultation data to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS anamnesis TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS restrictions TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS medications TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pathologies TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS objectives TEXT;
