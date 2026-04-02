-- ==========================================
-- MIGRATION v7: Bulletin/Mural posts
-- ==========================================

CREATE TABLE IF NOT EXISTS bulletin_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES profiles(id),
  post_type TEXT NOT NULL DEFAULT 'aviso' CHECK (post_type IN ('promo', 'conteudo', 'aviso', 'receita', 'evento', 'produto')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  action_label TEXT,
  action_url TEXT,
  audience TEXT DEFAULT 'all',
  audience_ids UUID[] DEFAULT '{}',
  send_as_message BOOLEAN DEFAULT FALSE,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bulletin_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES bulletin_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE bulletin_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulletin_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nina manages posts" ON bulletin_posts FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'nutritionist'
);
CREATE POLICY "Patients read posts" ON bulletin_posts FOR SELECT USING (
  auth.uid() IS NOT NULL AND (audience = 'all' OR auth.uid() = ANY(audience_ids))
);

CREATE POLICY "Users manage own likes" ON bulletin_likes FOR ALL USING (user_id = auth.uid());
CREATE POLICY "All read likes" ON bulletin_likes FOR SELECT USING (auth.uid() IS NOT NULL);
