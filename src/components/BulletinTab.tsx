'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const typeConfig: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  promo: { icon: '🏷️', color: 'text-purple-700', bg: 'bg-purple-50', label: 'Promoção' },
  conteudo: { icon: '📚', color: 'text-blue-700', bg: 'bg-blue-50', label: 'Conteúdo' },
  aviso: { icon: '📢', color: 'text-amber-700', bg: 'bg-amber-50', label: 'Aviso' },
  receita: { icon: '👨‍🍳', color: 'text-green-700', bg: 'bg-green-50', label: 'Receita' },
  evento: { icon: '📅', color: 'text-teal-700', bg: 'bg-teal-50', label: 'Evento' },
  produto: { icon: '🎁', color: 'text-pink-700', bg: 'bg-pink-50', label: 'Produto' },
};

export default function BulletinTab() {
  const [posts, setPosts] = useState<any[]>([]);
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => { loadPosts(); }, []);

  async function loadPosts() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setUserId(session.user.id);

    const { data: postsData } = await supabase.from('bulletin_posts').select('*').order('created_at', { ascending: false });
    setPosts(postsData || []);

    const { data: likes } = await supabase.from('bulletin_likes').select('post_id').eq('user_id', session.user.id);
    setMyLikes(new Set((likes || []).map((l: any) => l.post_id)));
    setLoading(false);
  }

  async function toggleLike(postId: string) {
    if (myLikes.has(postId)) {
      await supabase.from('bulletin_likes').delete().eq('post_id', postId).eq('user_id', userId);
      await supabase.from('bulletin_posts').update({ likes_count: Math.max(0, (posts.find(p => p.id === postId)?.likes_count || 1) - 1) }).eq('id', postId);
      setMyLikes(prev => { const n = new Set(Array.from(prev)); n.delete(postId); return n; });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: Math.max(0, (p.likes_count || 1) - 1) } : p));
    } else {
      await supabase.from('bulletin_likes').insert({ post_id: postId, user_id: userId });
      await supabase.from('bulletin_posts').update({ likes_count: (posts.find(p => p.id === postId)?.likes_count || 0) + 1 }).eq('id', postId);
      setMyLikes(prev => new Set([...Array.from(prev), postId]));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: (p.likes_count || 0) + 1 } : p));
    }
  }

  if (loading) return <div className="p-4 text-center text-gray-400 text-sm">Carregando...</div>;

  if (posts.length === 0) {
    return (
      <div className="p-4 text-center py-12">
        <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">📋</span>
        </div>
        <p className="text-sm text-gray-500">Nenhuma publicação ainda</p>
        <p className="text-xs text-gray-400 mt-1">A Nina publicará novidades, dicas e promoções aqui.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <p className="text-lg font-medium mb-1">Mural</p>
      <p className="text-xs text-gray-400 mb-4">Novidades e dicas da sua nutricionista</p>

      <div className="space-y-3">
        {posts.map(post => {
          const config = typeConfig[post.post_type] || typeConfig.aviso;
          const liked = myLikes.has(post.id);
          const timeAgo = getTimeAgo(post.created_at);

          return (
            <div key={post.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* Image */}
              {post.image_url && (
                <img src={post.image_url} alt="" className="w-full h-40 object-cover" />
              )}

              <div className="p-4">
                {/* Type badge + time */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${config.bg} ${config.color}`}>
                    {config.icon} {config.label}
                  </span>
                  <span className="text-[10px] text-gray-400">{timeAgo}</span>
                </div>

                {/* Title */}
                <p className="text-sm font-medium mb-1">{post.title}</p>

                {/* Content */}
                <p className="text-xs text-gray-600 leading-relaxed">{post.content}</p>

                {/* Attachment */}
                {post.attachment_url && (
                  <a href={post.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mt-3 p-2.5 bg-gray-50 rounded-xl">
                    <span className="text-lg">📎</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{post.attachment_name || 'Arquivo'}</p>
                      <p className="text-[10px] text-gray-400">Toque para abrir</p>
                    </div>
                  </a>
                )}

                {/* Action button */}
                {post.action_label && post.action_url && (
                  <a href={post.action_url} target="_blank" rel="noopener noreferrer" className="block mt-3 py-2.5 text-center bg-teal-400 text-white rounded-xl text-xs font-medium">
                    {post.action_label}
                  </a>
                )}

                {/* Like */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <button onClick={() => toggleLike(post.id)} className={`flex items-center gap-1.5 text-xs font-medium transition-all ${liked ? 'text-red-500' : 'text-gray-400'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? '#E24B4A' : 'none'} stroke={liked ? '#E24B4A' : '#ccc'} strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    {(post.likes_count || 0) > 0 && <span>{post.likes_count}</span>}
                  </button>
                  <span className="text-[10px] text-gray-300">Publicado por Nina</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
