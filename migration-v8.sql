-- ==========================================
-- MIGRATION v8: App session tracking for engagement metrics
-- ==========================================

CREATE TABLE IF NOT EXISTS app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users log own sessions" ON app_sessions FOR INSERT USING (user_id = auth.uid());
CREATE POLICY "Nina reads all sessions" ON app_sessions FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);
CREATE POLICY "Patients read own sessions" ON app_sessions FOR SELECT USING (user_id = auth.uid());
