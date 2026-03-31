-- ==========================================
-- MIGRATION v5: Knowledge base, chat Nina<>patient, favorites, stats
-- ==========================================

-- Nina's distilled knowledge (from material teaching sessions)
CREATE TABLE IF NOT EXISTS nina_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_materials JSONB DEFAULT '[]',
  conversation JSONB DEFAULT '[]',
  status TEXT DEFAULT 'approved' CHECK (status IN ('draft', 'approved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Direct messages between Nina and patients
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id),
  sender_id UUID NOT NULL REFERENCES profiles(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('patient', 'nutritionist')),
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Favorite meals (patient favorites a meal for reuse)
CREATE TABLE IF NOT EXISTS favorite_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id),
  meal_name TEXT NOT NULL,
  description TEXT NOT NULL,
  macros JSONB DEFAULT '{}',
  source_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE nina_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_meals ENABLE ROW LEVEL SECURITY;

-- Nina manages knowledge
CREATE POLICY "Nina manages knowledge" ON nina_knowledge FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);
-- Knowledge readable by all authenticated (used in plan generation)
CREATE POLICY "All read knowledge" ON nina_knowledge FOR SELECT USING (auth.uid() IS NOT NULL);

-- Direct messages: sender or plan owner can see
CREATE POLICY "Users see own messages" ON direct_messages FOR ALL USING (
  sender_id = auth.uid() OR plan_id IN (SELECT id FROM plans WHERE patient_id = auth.uid())
);
CREATE POLICY "Nina sees all messages" ON direct_messages FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);

-- Favorites: patient owns
CREATE POLICY "Patients own favorites" ON favorite_meals FOR ALL USING (
  plan_id IN (SELECT id FROM plans WHERE patient_id = auth.uid())
);
CREATE POLICY "Nina sees favorites" ON favorite_meals FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);
