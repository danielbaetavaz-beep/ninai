-- Execute este SQL no Supabase SQL Editor (supabase.com > seu projeto > SQL Editor)

-- Perfis de usuário
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'nutritionist')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Planos (ciclos)
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'pending_review', 'consultation_requested', 'approved', 'completed')),
  duration_months INT,
  start_date DATE,
  end_date DATE,
  onboarding_conversation JSONB DEFAULT '[]',
  goals JSONB DEFAULT '[]',
  meal_plan_base JSONB DEFAULT '{}',
  exercise_plan_base JSONB DEFAULT '{}',
  scientific_rationale TEXT,
  technical_diagnosis TEXT,
  nina_notes TEXT,
  consultation_notes TEXT,
  exam_results JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

-- Semanas
CREATE TABLE weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id),
  week_number INT NOT NULL,
  week_start DATE NOT NULL,
  routine JSONB DEFAULT '{}',
  meal_plan_detailed JSONB DEFAULT '{}',
  exercise_plan_detailed JSONB DEFAULT '{}',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Refeições registradas
CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id),
  weekly_plan_id UUID REFERENCES weekly_plans(id),
  date DATE NOT NULL,
  meal_name TEXT NOT NULL,
  planned_description TEXT,
  photo_url TEXT,
  ai_analysis JSONB DEFAULT '{}',
  flag TEXT CHECK (flag IN ('green', 'yellow', 'red')),
  feedback TEXT,
  macros JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exercícios registrados
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id),
  weekly_plan_id UUID REFERENCES weekly_plans(id),
  date DATE NOT NULL,
  planned_type TEXT,
  actual_type TEXT,
  done BOOLEAN DEFAULT FALSE,
  has_gym_access BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Check-ins diários
CREATE TABLE daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id),
  date DATE NOT NULL,
  sleep_hours NUMERIC,
  energy_level INT CHECK (energy_level BETWEEN 1 AND 10),
  digestion TEXT CHECK (digestion IN ('boa', 'regular', 'ruim')),
  water_glasses INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, date)
);

-- Alertas para a Nina
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES profiles(id),
  plan_id UUID REFERENCES plans(id),
  type TEXT NOT NULL CHECK (type IN ('no_meals', 'no_weekly_plan', 'score_drop', 'plan_ready', 'consultation_result')),
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Policies: pacientes veem só os próprios dados
CREATE POLICY "Users see own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Patients see own plans" ON plans FOR ALL USING (auth.uid() = patient_id);
CREATE POLICY "Patients see own weekly plans" ON weekly_plans FOR ALL USING (
  plan_id IN (SELECT id FROM plans WHERE patient_id = auth.uid())
);
CREATE POLICY "Patients see own meals" ON meals FOR ALL USING (
  plan_id IN (SELECT id FROM plans WHERE patient_id = auth.uid())
);
CREATE POLICY "Patients see own exercises" ON exercises FOR ALL USING (
  plan_id IN (SELECT id FROM plans WHERE patient_id = auth.uid())
);
CREATE POLICY "Patients see own checkins" ON daily_checkins FOR ALL USING (
  plan_id IN (SELECT id FROM plans WHERE patient_id = auth.uid())
);

-- Policies: Nina vê tudo (role = nutritionist)
CREATE POLICY "Nina sees all profiles" ON profiles FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);
CREATE POLICY "Nina sees all plans" ON plans FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);
CREATE POLICY "Nina sees all weekly plans" ON weekly_plans FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);
CREATE POLICY "Nina sees all meals" ON meals FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);
CREATE POLICY "Nina sees all exercises" ON exercises FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);
CREATE POLICY "Nina sees all checkins" ON daily_checkins FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);
CREATE POLICY "Nina sees all alerts" ON alerts FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);

-- Storage bucket para fotos
INSERT INTO storage.buckets (id, name, public) VALUES ('meal-photos', 'meal-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('exam-results', 'exam-results', true);
