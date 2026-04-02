-- ==========================================
-- MIGRATION v9: Add monthly_plan column to plans
-- ==========================================

ALTER TABLE plans ADD COLUMN IF NOT EXISTS monthly_plan JSONB;
