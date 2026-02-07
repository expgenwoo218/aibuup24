
import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CommunityPost } from '../types';
import { supabase, isConfigured } from '../lib/supabase';
import { UserContext } from '../App';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Comment {
  id: string;
  author_name: string;
  role: string;
  text: string;
  created_at: string;
}

const CommunityDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useContext(UserContext);
  const [post, setPost] = useState<CommunityPost | any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPostAndComments();
    }
  }, [id]);

  const fetchPostAndComments = async () => {
    if (!isConfigured) return;
    setLoading(true);
    
    try {
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single();

      if (postError) throw postError;

      if (postData) {
        setPost(postData);
        setLikeCount(postData.likes || 0);

        const { data: commentData } = await supabase
          .from('comments')
          .select('*')
          .eq('post_id', id)
          .order('created_at', { ascending: false });

        setComments(commentData || []);
      }
    } catch (error) {
      console.error('Fetch detail failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!user || isLiked) return;
    try {
      const newCount = likeCount + 1;
      const { error } = await supabase.from('posts').update({ likes: newCount }).eq('id', id);
      if (error) throw error;
      
      setLikeCount(newCount);
      setIsLiked(true);
      if (post?.user_id === user?.id) refreshProfile();
    } catch (err) {
      console.error('좋아요 실패:', err);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;

    try {
      const authorName = profile?.nickname || user?.email?.split('@')[0] || '익명의모험가';
      const authorRole = profile?.role || 'SILVER';

      const { data, error } = await supabase.from('comments').insert({
        post_id: id,
        user_id: user.id,
        author_name: authorName,
        role: authorRole,
        text: newComment
      }).select().single();

      if (error) throw error;
      setComments([data, ...comments]);
      setNewComment('');
    } catch (err) {
      console.error('댓글 작성 실패:', err);
      alert('댓글 작성 중 오류가 발생했습니다.');
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm('정말로 이 리포트를 폐기하시겠습니까?')) return;
    setIsDeleting(true);
    
    try {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) throw error;
      navigate('/community');
    } catch (err) {
      alert('삭제 실패');
      setIsDeleting(false);
    }
  };

  if (loading) return (
    <div className="pt-48 pb-32 min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="size-16 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-emerald-500 font-black tracking-[0.4em] text-[10px] uppercase animate-pulse">Scanning Intelligence Data</p>
      </div>
    </div>
  );

  if (!post) return (
    <div className="pt-48 text-center min-h-screen bg-black px-6">
      <h2 className="text-4xl font-black mb-8 tracking-tighter">SIGNAL LOST</h2>
      <p className="text-gray-500 mb-12 max-w-md mx-auto">요청하신 데이터 리포트를 찾을 수 없습니다.</p>
      <Link to="/community" className="bg-emerald-500 text-black px-12 py-5 rounded-2xl font-black uppercase text-sm inline-block shadow-2xl shadow-emerald-500/20">Back to Archives</Link>
    </div>
  );

  const isScam = post.category === '강팔이피해사례';
  const isVip = post.category.includes('검증된부업분석') || post.category.includes('회원노하우');
  const themeColor = isScam ? 'red' : isVip ? 'yellow' : 'emerald';

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'text-red-500 border-red-500/30 bg-red-500/10';
      case 'GOLD': return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10';
      default: return 'text-gray-400 border-white/10 bg-white/5';
    }
  };

  return (
    <div className="pt-24 md:pt-32 pb-32 min-h-screen bg-[#050505]">
      <div className="max-w-5xl mx-auto px-6">
        
        <div className="flex items-center justify-between mb-12">
          <Link to={`/community?cat=${post.category}`} className="group flex items-center gap-4 text-gray-500 hover:text-white transition-all">
            <div className="size-10 bg-white/5 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-black transition-all">
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.2em]">{post.category} 목록</span>
          </Link>
          
          {(user?.id === post.user_id || profile?.role === 'ADMIN') && (
            <button onClick={handleDeletePost} disabled={isDeleting} className="text-red-500/50 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-colors">
              {isDeleting ? 'DELETING...' : 'DISCARD REPORT'}
            </button>
          )}
        </div>

        <article className={`relative bg-neutral-900/40 border ${
          themeColor === 'red' ? 'border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.05)]' :
          themeColor === 'yellow' ? 'border-yellow-500/20 shadow-[0_0_50px_rgba(234,179,8,0.05)]' :
          'border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.05)]'
        } rounded-[3rem] md:rounded-[4rem] overflow-hidden mb-16 animate-slideUp`}>
          
          <div className="p-8 md:p-16 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
            <div className="flex flex-wrap items-center gap-4 mb-10">
              <div className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl ${
                themeColor === 'red' ? 'bg-red-500 text-black' :
                themeColor === 'yellow' ? 'bg-yellow-500 text-black' : 'bg-emerald-500 text-black'
              }`}>
                {post.category}
              </div>
              <span className="text-gray-600 text-[11px] font-bold uppercase tracking-widest">
                ID: #{post.id.toString().split('-')[0].toUpperCase()} / {new Date(post.created_at).toLocaleDateString()}
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-[1.1] mb-12 break-keep">
              {post.title}
            </h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-black/40 border border-white/5 p-6 rounded-3xl">
                <p className="text-gray-600 text-[9px] uppercase font-black tracking-widest mb-2">Auditor</p>
                <p className="text-white font-bold text-sm truncate">{post.author}</p>
              </div>
              <div className="bg-black/40 border border-white/5 p-6 rounded-3xl">
                <p className="text-gray-600 text-[9px] uppercase font-black tracking-widest mb-2">Tool Used</p>
                <p className="text-emerald-500 font-bold text-sm truncate">{post.tool || '전용 툴'}</p>
              </div>
              <div className="bg-black/40 border border-white/5 p-6 rounded-3xl">
                <p className="text-gray-600 text-[9px] uppercase font-black tracking-widest mb-2">Investment</p>
                <p className="text-white font-bold text-sm">{post.cost || post.daily_time || 'N/A'}</p>
              </div>
              <div className="bg-black/40 border border-white/5 p-6 rounded-3xl">
                <p className="text-gray-600 text-[9px] uppercase font-black tracking-widest mb-2">Verdict</p>
                <p className={`${themeColor === 'red' ? 'text-red-500' : 'text-emerald-400'} font-bold text-sm`}>
                  {post.result || '분석 중'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-16">
            <div className="prose prose-invert prose-emerald max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {post.content}
              </ReactMarkdown>
            </div>
          </div>

          <div className="p-8 md:p-16 bg-black/40 border-t border-white/5 flex flex-col items-center text-center gap-8">
            <div className="space-y-2">
              <p className="text-gray-600 text-[10px] font-black uppercase tracking-[0.4em]">Community Vetting</p>
              <p className="text-white/30 text-[9px] font-medium italic">이 리포트가 유익했다면 인증을 진행해주세요.</p>
            </div>
            
            <button 
              onClick={handleLike}
              disabled={isLiked || !user}
              className={`group flex items-center gap-5 px-16 py-6 rounded-full border transition-all duration-500 ${
                isLiked 
                  ? 'bg-emerald-500 border-emerald-500 text-black scale-105 shadow-[0_0_50px_rgba(16,185,129,0.3)]' 
                  : 'border-white/10 text-white hover:border-emerald-500/50 hover:bg-emerald-500/5'
              } disabled:cursor-not-allowed`}
            >
              <span className={`text-3xl transition-transform ${isLiked ? 'scale-125' : 'group-hover:rotate-12'}`}>
                {isLiked ? '🛡️' : '💎'}
              </span>
              <div className="text-left">
                <div className="font-black text-sm uppercase tracking-widest">
                  {isLiked ? 'Intelligence Verified' : 'Confirm Intelligence'}
                </div>
                <div className={`text-[10px] font-bold ${isLiked ? 'text-black/60' : 'text-gray-500'}`}>
                  Current Score: {likeCount}
                </div>
              </div>
            </button>
          </div>
        </article>

        {/* 댓글 섹션 */}
        <section className="max-w-4xl mx-auto mt-20">
          <div className="flex items-center gap-4 mb-10">
            <h3 className="text-2xl font-black uppercase italic tracking-tighter">Reconnaissance Logs</h3>
            <span className="text-emerald-500 font-bold text-sm px-3 py-1 bg-emerald-500/10 rounded-lg">{comments.length}</span>
          </div>

          <form onSubmit={handleCommentSubmit} className="mb-16 bg-neutral-900/50 border border-white/5 p-8 rounded-[2rem] shadow-xl">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={user ? "데이터에 대한 분석이나 추가 정보를 공유해 주세요." : "로그인이 필요한 기능입니다."}
              disabled={!user}
              className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-white outline-none focus:border-emerald-500/50 transition-all min-h-[120px] mb-6 resize-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newComment.trim() || !user}
                className="bg-white text-black font-black px-10 py-4 rounded-xl hover:bg-emerald-500 transition-all uppercase text-[11px] tracking-widest disabled:opacity-30"
              >
                Post Log
              </button>
            </div>
          </form>

          <div className="space-y-6">
            {comments.length > 0 ? comments.map((comment) => (
              <div key={comment.id} className="bg-neutral-900/30 border border-white/5 p-8 rounded-[2rem] transition-all hover:bg-white/[0.02]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-black text-sm">{comment.author_name}</span>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-md border uppercase tracking-widest ${getRoleColor(comment.role)}`}>
                      {comment.role}
                    </span>
                  </div>
                  <span className="text-gray-600 text-[10px] font-bold">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed break-keep">
                  {comment.text}
                </p>
              </div>
            )) : (
              <div className="py-20 text-center border border-dashed border-white/5 rounded-[2.5rem]">
                <p className="text-gray-600 font-black text-xs uppercase tracking-[0.3em]">No Logs Registered Yet</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CommunityDetail;
