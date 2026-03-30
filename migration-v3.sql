-- ==========================================
-- MIGRATION v3: Execute no Supabase SQL Editor
-- Adiciona campo day_closed para a funcionalidade de encerrar dia
-- ==========================================

ALTER TABLE daily_checkins ADD COLUMN IF NOT EXISTS day_closed BOOLEAN DEFAULT FALSE;
