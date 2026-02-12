
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase, isConfigured } from '../lib/supabase';
import { UserContext } from '../App';
import { CommunityPost } from '../types';
import { BOARD_CATEGORIES, VIP_CATEGORIES } from '../constants';

interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  role: string;
  created_at: string;
  persona_memo?: string;
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
  const [personaMemo, setPersonaMemo] = useState('');
  const [isSavingMemo, setIsSavingMemo] = useState(false);

  // 대리 게시글 발행용 상태
  const [isPublishing, setIsPublishing] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postCategory, setPostCategory] = useState('Ai부업경험담');
  const [postContent, setPostContent] = useState('');

  // 대상 회원의 등급에 따라 선택 가능한 카테고리 필터링
  const availableCategories = useMemo(() => {
    const standard = BOARD_CATEGORIES.map(c => c.name).filter(n => n !== '전체');
    if (!userProfile) return standard;
    
    // 대상 회원이 GOLD 혹은 ADMIN인 경우에만 VIP 카테고리 허용
    if (userProfile.role === 'GOLD' || userProfile.role === 'ADMIN') {
      return [...standard, ...VIP_CATEGORIES.map(v => v.name)];
    }
    return standard;
  }, [userProfile]);

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
      // 1. 프로필 정보 (페르소나 메모 포함)
      const { data: pData } = await supabase.from('profiles').select('*').eq('id', userId).single();
      setUserProfile(pData);
      if (pData?.persona_memo) {
        setPersonaMemo(pData.persona_memo);
      }
      
      // 등급에 따른 초기 카테고리 설정
      const initialCat = pData?.role === 'SILVER' ? 'Ai부업경험담' : 'Ai부업경험담';
      setPostCategory(initialCat);
      loadCategoryTemplate(initialCat);

      // 2. 작성한 게시글
      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setUserPosts(postsData || []);

      // 3. 작성한 댓글
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

  // 카테고리 질문지 기반 마크다운 템플릿 생성 및 적용
  const loadCategoryTemplate = async (categoryName: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_questions')
        .select('question_text')
        .eq('category', categoryName)
        .order('order_index', { ascending: true });
      
      if (error) throw error;

      let template = `## 📊 ${categoryName} Intelligence Report\n\n`;
      
      if (data && data.length > 0) {
        data.forEach((q) => {
          template += `### 🔍 ${q.question_text}\n> \n\n`;
        });
      } else {
        template += `### 🔍 제목을 입력해주세요.\n> \n\n### 🔍 상세 내용을 기록해주세요.\n> \n\n`;
      }
      
      setPostContent(template);
    } catch (err) {
      console.error("Template load error:", err);
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCat = e.target.value;
    setPostCategory(newCat);
    
    // 본문이 비어있거나 기존 템플릿 형태인 경우에만 템플릿 자동 교체
    if (postContent.trim() === '' || postContent.startsWith('## 📊')) {
      loadCategoryTemplate(newCat);
    }
  };

  const handleSaveMemo = async () => {
    if (!userId || isSavingMemo) return;
    setIsSavingMemo(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ persona_memo: personaMemo })
        .eq('id', userId);
      
      if (error) throw error;
      alert('해당 회원의 페르소나 메모가 안전하게 저장되었습니다.');
    } catch (err: any) {
      alert('메모 저장 실패: ' + err.message);
    } finally {
      setIsSavingMemo(false);
    }
  };

  const handleDirectPost = async () => {
    if (!userId || !userProfile || isPublishing) return;
    if (!postTitle.trim() || !postContent.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    if (!window.confirm(`${userProfile.nickname} 님의 명의로 게시글을 발행하시겠습니까?`)) return;

    setIsPublishing(true);
    try {
      const postData = {
        title: postTitle,
        author: userProfile.nickname,
        category: postCategory,
        content: postContent,
        result: 'Direct Entry',
        user_id: userId,
        tool: 'Manual Admin Action',
        daily_time: 'N/A',
        created_at: new Date().toISOString(),
        likes: Math.floor(Math.random() * 3)
      };

      const { error } = await supabase.from('posts').insert([postData]);
      if (error) throw error;

      alert('게시글이 성공적으로 발행되었습니다.');
      setPostTitle('');
      // 성공 후 템플릿 재설정
      loadCategoryTemplate(postCategory);
      fetchUserActivity(); // 목록 갱신
    } catch (err: any) {
      alert('발행 실패: ' + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  if (loading) return (
    <div className="pt-48 pb-32 min-h-screen bg-black flex items-center justify-center">
      <div className="text-emerald-500 font-black animate-pulse uppercase tracking-[0.4em]">Synchronizing Intelligence...</div>
    </div>
  );

  if (!userProfile) return (
    <div className="pt-48 text-center min-h-screen bg-black">
      <h2 className="text-4xl font-black mb-4">MEMBER DATA NOT FOUND</h2>
      <Link to="/admin" className="text-emerald-500 font-bold hover:underline">Back to Admin</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-black pt-12 pb-32 px-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12">
          <Link to="/admin?tab=users" className="text-gray-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest mb-4 inline-block">← 뒤로가기</Link>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-2 uppercase italic">{userProfile.nickname} <span className="text-emerald-500/50 text-2xl">Profile Audit</span></h1>
              <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">Email: {userProfile.email} | Role: {userProfile.role}</p>
            </div>
            <div className="bg-neutral-900/50 border border-white/5 p-4 rounded-2xl">
              <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Registration Date</p>
              <p className="text-white font-bold text-sm">{new Date(userProfile.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            {/* 페르소나 메모 섹션 */}
            <section>
              <div className="bg-[#0a0a0a] border border-emerald-500/20 rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden h-full">
                <div className="absolute top-0 right-0 size-64 bg-emerald-500/5 blur-[100px] pointer-events-none" />
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <h2 className="text-xl font-black uppercase italic tracking-tight flex items-center gap-3">
                    <span className="text-emerald-500 text-2xl">📝</span> Persona Note <span className="text-[10px] text-gray-600 italic font-bold">(Admin Private)</span>
                  </h2>
                  <button 
                    onClick={handleSaveMemo}
                    disabled={isSavingMemo}
                    className="bg-emerald-500 text-black px-8 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-white transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                  >
                    {isSavingMemo ? 'Saving...' : 'Save Persona Memo'}
                  </button>
                </div>
                <textarea 
                  value={personaMemo}
                  onChange={(e) => setPersonaMemo(e.target.value)}
                  placeholder="회원의 특성, 선호 부업, 주의사항 등 페르소나 정보를 기록하세요. (관리자 전용)"
                  className="w-full bg-black/50 border border-white/5 rounded-2xl p-6 text-gray-300 text-sm outline-none focus:border-emerald-500/30 transition-all min-h-[150px] md:min-h-[250px] resize-none leading-relaxed relative z-10"
                />
              </div>
            </section>

            {/* 대리 게시글 발행 섹션 */}
            <section>
              <div className="bg-neutral-900/40 border border-white/5 rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-black uppercase italic tracking-tight flex items-center gap-3">
                    <span className="text-emerald-500 text-2xl">🚀</span> Proxy Publishing <span className="text-[10px] text-gray-600 italic font-bold">(Post as {userProfile.nickname})</span>
                  </h2>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Archive Title</label>
                      <input 
                        type="text"
                        value={postTitle}
                        onChange={(e) => setPostTitle(e.target.value)}
                        placeholder="발행할 제목 입력"
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-3 text-sm text-white focus:border-emerald-500/50 outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Category {userProfile.role === 'SILVER' && <span className="text-[8px] text-red-500 ml-1 italic">(Silver restricted to Standard)</span>}</label>
                      <select 
                        value={postCategory}
                        onChange={handleCategoryChange}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-3 text-sm text-white focus:border-emerald-500/50 outline-none appearance-none"
                      >
                        {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Content Body (Markdown Support)</label>
                    <textarea 
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      placeholder="회원의 명의로 발행할 내용을 작성하세요. 마크다운 문법을 지원합니다."
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-4 text-sm text-white focus:border-emerald-500/50 outline-none h-48 resize-none leading-relaxed"
                    />
                  </div>
                  <button 
                    onClick={handleDirectPost}
                    disabled={isPublishing}
                    className="w-full bg-white text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all shadow-xl disabled:opacity-50"
                  >
                    {isPublishing ? 'PUBLISHING...' : `Publish as ${userProfile.nickname}`}
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div className="lg:col-span-1 space-y-12">
            {/* 게시글 목록 */}
            <section>
              <div className="flex items-center justify-between mb-6 px-4">
                <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest italic">Authored Intelligence ({userPosts.length})</h2>
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
                {userPosts.length > 0 ? userPosts.map(post => (
                  <div key={post.id} className="bg-neutral-900/40 border border-white/5 p-6 rounded-[2rem] hover:border-emerald-500/30 transition-all group">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[8px] font-black px-2 py-0.5 bg-white/5 border border-white/10 rounded-md uppercase text-gray-500 tracking-widest">{post.category}</span>
                      <span className="text-[9px] text-gray-700 font-bold">{new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                    <Link to={`/community/${post.id}`} className="block text-white font-bold text-sm leading-tight group-hover:text-emerald-400 transition-colors mb-4 line-clamp-1">{post.title}</Link>
                    <div className="flex items-center gap-4 text-[9px] text-gray-600 font-black uppercase">
                      <span>💎 Verified: {post.likes || 0}</span>
                    </div>
                  </div>
                )) : (
                  <div className="py-10 text-center bg-neutral-900/20 border border-dashed border-white/5 rounded-[2rem]">
                    <p className="text-gray-600 text-[9px] font-black uppercase tracking-widest">No intelligence logs.</p>
                  </div>
                )}
              </div>
            </section>

            {/* 댓글 목록 */}
            <section>
              <div className="flex items-center justify-between mb-6 px-4">
                <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest italic">Signal Logs ({userComments.length})</h2>
              </div>
              <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
                {userComments.length > 0 ? userComments.map(comment => (
                  <div key={comment.id} className="bg-neutral-900/40 border border-white/5 p-6 rounded-[2rem] hover:border-emerald-500/30 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-emerald-500 font-black text-[8px] uppercase tracking-widest shrink-0">RE:</span>
                        <Link to={`/community/${comment.post_id}`} className="text-[9px] text-gray-500 font-bold truncate hover:text-white transition-colors">{comment.post_title}</Link>
                      </div>
                      <span className="text-[9px] text-gray-700 font-bold shrink-0">{new Date(comment.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-400 text-[11px] leading-relaxed italic line-clamp-2">"{comment.text}"</p>
                  </div>
                )) : (
                  <div className="py-10 text-center bg-neutral-900/20 border border-dashed border-white/5 rounded-[2rem]">
                    <p className="text-gray-600 text-[9px] font-black uppercase tracking-widest">No reconnaissance logs.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUserDetail;
