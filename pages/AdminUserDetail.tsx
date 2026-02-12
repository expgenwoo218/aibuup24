
import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase, isConfigured } from '../lib/supabase';
import { UserContext } from '../App';
import { CommunityPost } from '../types';

interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  role: string;
  created_at: string;
}

interface UserComment {
  id: string;
  post_id: string;
  text: string;
  created_at: string;
  post_title?: string;
}

const AdminUserDetail: React.FC = () => {
  const { userId } = useParams();
  const { profile } = useContext(UserContext);
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<CommunityPost[]>([]);
  const [userComments, setUserComments] = useState<UserComment[]>([]);

  useEffect(() => {
    if (profile && profile.role !== 'ADMIN') {
      alert('관리자 권한이 없습니다.');
      navigate('/');
      return;
    }
    if (userId) {
      fetchUserActivity();
    }
  }, [userId, profile, navigate]);

  const fetchUserActivity = async () => {
    if (!isConfigured) return;
    setLoading(true);
    try {
      // 1. 프로필 정보
      const { data: pData } = await supabase.from('profiles').select('*').eq('id', userId).single();
      setUserProfile(pData);

      // 2. 작성한 게시글
      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setUserPosts(postsData || []);

      // 3. 작성한 댓글 (게시글 제목 포함)
      const { data: commentsData } = await supabase
        .from('comments')
        .select(`
          *,
          posts (
            title
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      const formattedComments = (commentsData || []).map((c: any) => ({
        ...c,
        post_title: c.posts?.title || '삭제된 게시글'
      }));
      setUserComments(formattedComments);

    } catch (error) {
      console.error('회원 활동 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="pt-48 pb-32 min-h-screen bg-black flex items-center justify-center">
      <div className="text-emerald-500 font-black animate-pulse">RECONSTRUCTING MEMBER ACTIVITY...</div>
    </div>
  );

  if (!userProfile) return (
    <div className="pt-48 text-center min-h-screen bg-black">
      <h2 className="text-4xl font-black mb-4">MEMBER NOT FOUND</h2>
      <Link to="/admin" className="text-emerald-500 font-bold hover:underline">Back to Admin</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-black pt-12 pb-32 px-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12">
          <Link to="/admin" className="text-gray-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest mb-4 inline-block">← Back to Admin Panel</Link>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-2 uppercase italic">{userProfile.nickname} <span className="text-emerald-500/50 text-2xl">Log</span></h1>
              <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">Email: {userProfile.email} | Role: {userProfile.role}</p>
            </div>
            <div className="bg-neutral-900/50 border border-white/5 p-4 rounded-2xl">
              <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Join Date</p>
              <p className="text-white font-bold text-sm">{new Date(userProfile.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* 게시글 목록 */}
          <section>
            <div className="flex items-center justify-between mb-6 px-4">
              <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest italic">Authored Reports ({userPosts.length})</h2>
            </div>
            <div className="space-y-4">
              {userPosts.length > 0 ? userPosts.map(post => (
                <div key={post.id} className="bg-neutral-900/40 border border-white/5 p-6 rounded-[2rem] hover:border-emerald-500/30 transition-all group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[8px] font-black px-2 py-0.5 bg-white/5 border border-white/10 rounded-md uppercase text-gray-500 tracking-widest">{post.category}</span>
                    <span className="text-[9px] text-gray-700 font-bold">{new Date(post.created_at).toLocaleDateString()}</span>
                  </div>
                  <Link to={`/community/${post.id}`} className="block text-white font-bold text-lg leading-tight group-hover:text-emerald-400 transition-colors mb-4">{post.title}</Link>
                  <div className="flex items-center gap-4 text-[10px] text-gray-600 font-black uppercase">
                    <span>🛡️ Result: <span className="text-emerald-500">{post.result || 'Pending'}</span></span>
                    <span>💎 Likes: {post.likes || 0}</span>
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center bg-neutral-900/20 border border-dashed border-white/5 rounded-[2rem]">
                  <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest">No intelligence reports found.</p>
                </div>
              )}
            </div>
          </section>

          {/* 댓글 목록 */}
          <section>
            <div className="flex items-center justify-between mb-6 px-4">
              <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest italic">Communication Logs ({userComments.length})</h2>
            </div>
            <div className="space-y-4">
              {userComments.length > 0 ? userComments.map(comment => (
                <div key={comment.id} className="bg-neutral-900/40 border border-white/5 p-6 rounded-[2rem] hover:border-emerald-500/30 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-emerald-500 font-black text-[8px] uppercase tracking-widest shrink-0">RE:</span>
                      <Link to={`/community/${comment.post_id}`} className="text-[10px] text-gray-500 font-bold truncate hover:text-white transition-colors">{comment.post_title}</Link>
                    </div>
                    <span className="text-[9px] text-gray-700 font-bold shrink-0">{new Date(comment.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed italic">"{comment.text}"</p>
                </div>
              )) : (
                <div className="py-20 text-center bg-neutral-900/20 border border-dashed border-white/5 rounded-[2rem]">
                  <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest">No reconnaissance logs recorded.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminUserDetail;
