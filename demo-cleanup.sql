-- ==========================================
-- DEMO DATA: 5 pacientes de exemplo para apresentação à Nina
-- EXECUTE NO SQL EDITOR DO SUPABASE
-- ==========================================

-- PASSO 1: Limpar todos os dados EXCETO a Nina (izagiffoni@hotmail.com)
-- Primeiro pega o ID da Nina
DO $$
DECLARE
  nina_id UUID;
BEGIN
  SELECT id INTO nina_id FROM auth.users WHERE email = 'izagiffoni@hotmail.com';
  
  -- Delete all data for non-Nina users
  DELETE FROM app_sessions WHERE user_id != nina_id;
  DELETE FROM bulletin_likes WHERE user_id != nina_id;
  DELETE FROM direct_messages WHERE plan_id IN (SELECT id FROM plans WHERE patient_id != nina_id);
  DELETE FROM favorite_meals WHERE plan_id IN (SELECT id FROM plans WHERE patient_id != nina_id);
  DELETE FROM patient_files WHERE patient_id != nina_id;
  DELETE FROM meals WHERE plan_id IN (SELECT id FROM plans WHERE patient_id != nina_id);
  DELETE FROM exercises WHERE plan_id IN (SELECT id FROM plans WHERE patient_id != nina_id);
  DELETE FROM daily_plans WHERE plan_id IN (SELECT id FROM plans WHERE patient_id != nina_id);
  DELETE FROM daily_schedule WHERE plan_id IN (SELECT id FROM plans WHERE patient_id != nina_id);
  DELETE FROM daily_checkins WHERE plan_id IN (SELECT id FROM plans WHERE patient_id != nina_id);
  DELETE FROM alerts WHERE patient_id != nina_id;
  DELETE FROM plans WHERE patient_id != nina_id;
  DELETE FROM profiles WHERE id != nina_id AND id IN (SELECT id FROM auth.users WHERE email != 'izagiffoni@hotmail.com');
  
  -- Delete auth users (except Nina)
  DELETE FROM auth.users WHERE email != 'izagiffoni@hotmail.com';
END $$;

-- PASSO 2: Criar os 5 usuarios de teste no auth
-- Nota: Isso precisa ser feito via API ou Dashboard. 
-- O SQL abaixo cria os profiles e plans DEPOIS que os usuarios forem criados via Dashboard.

-- ==========================================
-- IMPORTANTE: Antes de rodar o PASSO 3, crie os 5 usuarios manualmente:
-- Supabase → Authentication → Users → Add User
-- n1@gmail.com / 121212
-- n2@gmail.com / 121212
-- n3@gmail.com / 121212
-- n4@gmail.com / 121212
-- n5@gmail.com / 121212
-- 
-- Depois volte aqui e rode o PASSO 3
-- ==========================================
