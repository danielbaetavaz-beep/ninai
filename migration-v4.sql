-- ==========================================
-- MIGRATION v4: Simplificação do fluxo
-- - Nova tabela daily_schedule (programação diária do paciente)
-- - Nova tabela daily_plans (cardápio/exercício gerado por dia)
-- - Nova tabela nina_materials (banco de conhecimento da Nina)
-- - plans ganha campo initial_schedule (10 dias do onboarding)
-- - plans ganha campo detailed_plan (cardápio detalhado dos 10 dias para Nina aprovar)
-- ==========================================

-- Programação diária: paciente preenche se está em casa/fora e se tem academia
CREATE TABLE IF NOT EXISTS daily_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id),
  date DATE NOT NULL,
  morning TEXT DEFAULT 'casa' CHECK (morning IN ('casa', 'fora')),
  afternoon TEXT DEFAULT 'casa' CHECK (afternoon IN ('casa', 'fora')),
  evening TEXT DEFAULT 'casa' CHECK (evening IN ('casa', 'fora')),
  has_gym BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, date)
);

-- Plano diário gerado: cardápio + exercício para um dia específico
CREATE TABLE IF NOT EXISTS daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id),
  date DATE NOT NULL,
  meals JSONB DEFAULT '[]',
  exercise JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'regenerating')),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, date)
);

-- Materiais de referência da Nina
CREATE TABLE IF NOT EXISTS nina_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT DEFAULT 'pdf',
  content_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Novos campos em plans
ALTER TABLE plans ADD COLUMN IF NOT EXISTS initial_schedule JSONB DEFAULT '[]';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS detailed_plan JSONB DEFAULT '{}';

-- RLS para novas tabelas
ALTER TABLE daily_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE nina_materials ENABLE ROW LEVEL SECURITY;

-- Pacientes veem próprios dados
CREATE POLICY "Patients own daily_schedule" ON daily_schedule FOR ALL USING (
  plan_id IN (SELECT id FROM plans WHERE patient_id = auth.uid())
);
CREATE POLICY "Patients own daily_plans" ON daily_plans FOR ALL USING (
  plan_id IN (SELECT id FROM plans WHERE patient_id = auth.uid())
);

-- Nina vê tudo
CREATE POLICY "Nina sees all daily_schedule" ON daily_schedule FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);
CREATE POLICY "Nina sees all daily_plans" ON daily_plans FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);
CREATE POLICY "Nina manages materials" ON nina_materials FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);

-- Storage bucket for nina materials
INSERT INTO storage.buckets (id, name, public) VALUES ('nina-materials', 'nina-materials', true) ON CONFLICT DO NOTHING;
