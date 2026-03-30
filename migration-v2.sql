-- ==========================================
-- MIGRATION v2: Execute no Supabase SQL Editor
-- Adiciona campos necessários para:
-- - Status de aprovação no plano semanal (Nina aprova)
-- - Datas reais nos dias da semana
-- - Descrição real da refeição pelo paciente
-- - Campo de refeição completada/não completada
-- ==========================================

-- Novas colunas em weekly_plans
ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_nina_approval';
ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS day_dates JSONB DEFAULT '{}';
ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Novas colunas em meals
ALTER TABLE meals ADD COLUMN IF NOT EXISTS actual_description TEXT;
ALTER TABLE meals ADD COLUMN IF NOT EXISTS completed BOOLEAN;

-- Atualizar weekly_plans existentes para status 'approved' (para não quebrar dados antigos)
UPDATE weekly_plans SET status = 'approved' WHERE status IS NULL;
