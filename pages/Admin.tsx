
import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isConfigured } from '../lib/supabase';
import { CommunityPost, NewsItem } from '../types';
import { UserContext } from '../App';
import { BOARD_CATEGORIES, VIP_CATEGORIES } from '../constants';

interface Profile {
  id: string;
  email: string;
  nickname: string;
  role: 'ADMIN' | 'GOLD' | 'SILVER';
  created_at: string;
}

interface ChatQuestion {
  id: string;
  category: string;
  question_text: string;
  order_index: number;
}

const Admin: React.FC = () => {
  const { user, profile } = useContext(UserContext);
  const navigate = useNavigate();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'users' | 'news' | 'questions'>('posts');
  
  // 페이지네이션 상태 (30개 단위로 변경)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // 질문 관리용 상태
  const [questions, setQuestions] = useState<ChatQuestion[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Ai부업경험담');
  const [newQuestionText, setNewQuestionText] = useState('');

  // 뉴스 프리뷰 상태
  const [previewNews, setPreviewNews] = useState<NewsItem | null>(null);

  const allCategories = [...BOARD_CATEGORIES.map(c => c.name), ...VIP_CATEGORIES.map(v => v.name)].filter(n => n !== '전체');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [newsForm, setNewsForm] = useState({
    title: '',
    category: 'Trend',
    summary: '',
    content: '',
    image_url: ''
  });

  useEffect(() => {
    if (!user && !loading) {
      navigate('/login');
      return;
    }
    if (profile && profile.role !== 'ADMIN') {
      alert('관리자 권한이 없습니다.');
      navigate('/');
      return;
    }
  }, [profile, user, loading, navigate]);

  useEffect(() => {
    fetchAdminData();
    setCurrentPage(1); // 탭 변경 시 페이지 리셋
  }, [activeTab, selectedCategory]);

  const fetchAdminData = async () => {
    if (!isConfigured) return;
    setLoading(true);
    try {
      if (activeTab === 'posts') {
        const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
        setPosts(data || []);
      } else if (activeTab === 'users') {
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        setProfiles(data || []);
      } else if (activeTab === 'news') {
        const { data } = await supabase.from('news').select('*').order('created_at', { ascending: false });
        setNews(data || []);
      } else if (activeTab === 'questions') {
        const { data } = await supabase.from('chat_questions')
          .select('*')
          .eq('category', selectedCategory)
          .order('order_index', { ascending: true });
        setQuestions(data || []);
      }
    } catch (error) {
      console.error('관리자 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 각 데이터별 페이지네이션 계산 (itemsPerPage = 30 적용)
  const currentPagedPosts = useMemo(() => posts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [posts, currentPage]);
  const currentPagedUsers = useMemo(() => profiles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [profiles, currentPage]);
  const currentPagedNews = useMemo(() => news.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [news, currentPage]);

  const totalPages = useMemo(() => {
    if (activeTab === 'posts') return Math.ceil(posts.length / itemsPerPage);
    if (activeTab === 'users') return Math.ceil(profiles.length / itemsPerPage);
    if (activeTab === 'news') return Math.ceil(news.length / itemsPerPage);
    return 0;
  }, [posts, profiles, news, activeTab]);

  const PaginationUI = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex justify-center items-center gap-2 mt-12 pb-8">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
          <button
            key={pageNum}
            onClick={() => {
              setCurrentPage(pageNum);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`size-10 rounded-xl font-black text-xs transition-all border ${
              currentPage === pageNum 
                ? 'bg-emerald-500 border-emerald-500 text-black shadow-lg shadow-emerald-500/20' 
                : 'border-white/5 text-gray-500 hover:text-white hover:border-white/20 hover:bg-white/5'
            }`}
          >
            {pageNum}
          </button>
        ))}
      </div>
    );
  };

  // 질문 관리 CRUD
  const addQuestion = async () => {
    if (!newQuestionText.trim()) return;
    try {
      const { data, error } = await supabase.from('chat_questions').insert([{
        category: selectedCategory,
        question_text: newQuestionText,
        order_index: questions.length
      }]).select().single();
      if (error) throw error;
      setQuestions([...questions, data]);
      setNewQuestionText('');
    } catch (e) { alert('질문 추가 실패'); }
  };

  const deleteQuestion = async (id: string) => {
    if (!window.confirm('질문을 삭제하시겠습니까?')) return;
    try {
      await supabase.from('chat_questions').delete().eq('id', id);
      setQuestions(questions.filter(q => q.id !== id));
    } catch (e) { alert('삭제 실패'); }
  };

  const updateQuestionText = async (id: string, text: string) => {
    try {
      await supabase.from('chat_questions').update({ question_text: text }).eq('id', id);
      setQuestions(questions.map(q => q.id === id ? { ...q, question_text: text } : q));
    } catch (e) { alert('수정 실패'); }
  };

  const moveQuestion = async (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newQuestions.length) return;

    [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
    
    try {
      await Promise.all(newQuestions.map((q, idx) => 
        supabase.from('chat_questions').update({ order_index: idx }).eq('id', q.id)
      ));
      setQuestions(newQuestions);
    } catch (e) { alert('순서 변경 실패'); }
  };

  // 기존 뉴스 관리 핸들러
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setNewsForm(prev => ({ ...prev, image_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setNewsForm(prev => ({ ...prev, image_url: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const deletePost = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) throw error;
      setPosts(posts.filter(p => p.id !== id));
    } catch (e) {
      alert('삭제 실패');
    }
  };

  const deleteNews = async (id: string) => {
    if (!window.confirm('뉴스를 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('news').delete().eq('id', id);
      if (error) throw error;
      setNews(news.filter(n => n.id !== id));
      if (previewNews?.id === id) setPreviewNews(null);
    } catch (e) {
      alert('삭제 실패');
    }
  };

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);
    try {
      const { data, error } = await supabase.from('news').insert([{
        ...newsForm,
        date: new Date().toLocaleDateString()
      }]).select().single();
      if (error) throw error;
      setNews(prev => [data, ...prev]);
      setNewsForm({ title: '', category: 'Trend', summary: '', content: '', image_url: '' });
      setImagePreview(null);
      alert('뉴스 발행 성공!');
    } catch (err: any) {
      alert('에러: ' + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      if (error) throw error;
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole as any } : p));
      alert(`회원 등급이 ${newRole} 등급으로 변경되었습니다.`);
    } catch (err: any) {
      alert('등급 변경 실패');
    }
  };

  const forceWithdrawal = async (userId: string) => {
    if (userId === user?.id) return alert('본인 탈퇴 불가');
    if (!window.confirm('회원을 강제 탈퇴시키겠습니까?')) return;
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
      setProfiles(prev => prev.filter(p => p.id !== userId));
      alert('탈퇴 처리 완료');
    } catch (err: any) {
      alert('탈퇴 처리 실패');
    }
  };

  if (loading && activeTab !== 'questions' && activeTab !== 'news') return <div className="text-center pt-48 font-black text-emerald-500 animate-pulse">SYNCHRONIZING ADMIN INTERFACE...</div>;

  return (
    <div className="min-h-screen bg-black pt-12 pb-32 px-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-2 uppercase italic">Admin Panel</h1>
            <p className="text-emerald-500 font-bold uppercase text-xs tracking-[0.4em]">Audit Intelligence & Ecosystem Management</p>
          </div>
          <div className="flex gap-4">
             <button onClick={fetchAdminData} className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl font-bold text-xs uppercase hover:bg-white/10 transition-all">Refresh</button>
             <Link to="/" className="px-6 py-3 bg-emerald-500 text-black rounded-2xl font-black text-xs hover:bg-white transition-all uppercase tracking-widest">Exit</Link>
          </div>
        </header>

        <div className="flex flex-wrap gap-2 mb-8 bg-neutral-900/50 p-2 rounded-[2rem] w-fit border border-white/5">
          <button onClick={() => setActiveTab('posts')} className={`px-8 py-4 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'posts' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}>게시글 관리</button>
          <button onClick={() => setActiveTab('users')} className={`px-8 py-4 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}>회원 관리</button>
          <button onClick={() => setActiveTab('news')} className={`px-8 py-4 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'news' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}>뉴스피드 관리</button>
          <button onClick={() => setActiveTab('questions')} className={`px-8 py-4 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'questions' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}>대화 질문 관리</button>
        </div>

        {/* 질문 관리 탭 */}
        {activeTab === 'questions' && (
          <div className="animate-fadeIn">
            <div className="flex flex-col md:flex-row gap-8">
              {/* 카테고리 사이드바 */}
              <div className="md:w-64 shrink-0">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 px-2 italic">Board Categories</h3>
                <div className="space-y-1">
                  {allCategories.map(cat => (
                    <button 
                      key={cat} 
                      onClick={() => setSelectedCategory(cat)}
                      className={`w-full text-left px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-tight transition-all border ${selectedCategory === cat ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-neutral-900/50 text-gray-400 border-white/5 hover:border-white/20'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* 질문 편집 영역 */}
              <div className="flex-1">
                <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 size-64 bg-emerald-500/5 blur-[100px] pointer-events-none" />
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <h2 className="text-xl font-black uppercase italic tracking-tight">
                      Chat Questions: <span className="text-emerald-500">{selectedCategory}</span>
                    </h2>
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{questions.length} Questions Defined</span>
                  </div>

                  <div className="space-y-4 mb-10 relative z-10">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="group flex items-center gap-4 bg-white/5 border border-white/5 rounded-2xl p-4 transition-all hover:border-emerald-500/30">
                        <div className="flex flex-col gap-1 shrink-0">
                          <button onClick={() => moveQuestion(idx, 'up')} className="text-gray-600 hover:text-white transition-colors">▲</button>
                          <button onClick={() => moveQuestion(idx, 'down')} className="text-gray-600 hover:text-white transition-colors">▼</button>
                        </div>
                        <span className="text-emerald-500 font-black text-xs w-6 text-center">{idx + 1}</span>
                        <input 
                          type="text" 
                          value={q.question_text} 
                          onChange={(e) => updateQuestionText(q.id, e.target.value)}
                          className="flex-1 bg-transparent border-none outline-none text-sm text-white font-medium"
                        />
                        <button onClick={() => deleteQuestion(q.id)} className="text-red-500/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all font-bold text-[10px] uppercase">Remove</button>
                      </div>
                    ))}
                    {questions.length === 0 && <div className="py-20 text-center text-gray-600 text-[10px] font-black uppercase tracking-[0.4em]">No customized questions for this category.</div>}
                  </div>

                  <div className="flex gap-3 pt-8 border-t border-white/5 relative z-10">
                    <input 
                      type="text" 
                      value={newQuestionText} 
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addQuestion()}
                      placeholder="새 질문을 입력하고 Enter를 누르세요..."
                      className="flex-1 bg-black border border-white/10 rounded-xl px-5 py-3 text-sm outline-none focus:border-emerald-500/50"
                    />
                    <button onClick={addQuestion} className="bg-emerald-500 text-black font-black px-8 rounded-xl text-xs uppercase hover:bg-white transition-all shadow-xl shadow-emerald-500/20">Add Question</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 게시글 관리 */}
        {activeTab === 'posts' && (
          <div className="animate-fadeIn">
            <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest italic mb-6 px-4">Intelligence Archive ({posts.length})</h2>
            <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] text-gray-600 uppercase font-black tracking-widest">
                    <th className="px-8 py-6">Title</th>
                    <th className="px-8 py-6">Author</th>
                    <th className="px-8 py-6">Category</th>
                    <th className="px-8 py-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {currentPagedPosts.map(post => (
                    <tr key={post.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-6">
                        <Link to={`/community/${post.id}`} className="font-bold text-sm line-clamp-1 hover:text-emerald-400 transition-colors">{post.title}</Link>
                      </td>
                      <td className="px-8 py-6 text-xs text-gray-500">{post.author}</td>
                      <td className="px-8 py-6">
                        <span className="text-[9px] font-black px-3 py-1 bg-white/5 border border-white/10 rounded-full uppercase text-gray-400">{post.category}</span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button onClick={() => deletePost(post.id)} className="text-red-500/30 hover:text-red-500 font-bold text-[10px] uppercase transition-colors">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationUI />
            </div>
          </div>
        )}

        {/* 회원 관리 */}
        {activeTab === 'users' && (
          <div className="animate-fadeIn">
            <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest italic mb-6 px-4">Member Directory ({profiles.length})</h2>
            <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] text-gray-600 uppercase font-black tracking-widest">
                    <th className="px-8 py-6">User Info</th>
                    <th className="px-8 py-6">Joined Date</th>
                    <th className="px-8 py-6">Current Role</th>
                    <th className="px-8 py-6 text-right">Management</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {currentPagedUsers.map(p => (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-white">{p.nickname}</span>
                          <span className="text-[10px] text-gray-500">{p.email}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-[11px] text-gray-500">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-8 py-6">
                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase border shadow-sm ${
                          p.role === 'ADMIN' ? 'bg-red-500/10 border-red-500/30 text-red-500' : 
                          p.role === 'GOLD' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' : 'bg-gray-500/10 border-white/5 text-gray-500'
                        }`}>{p.role}</span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-4">
                          <select value={p.role} onChange={(e) => updateUserRole(p.id, e.target.value)} className="bg-black border border-white/10 text-[10px] font-black uppercase text-gray-400 rounded-lg px-3 py-1.5 outline-none focus:border-emerald-500 transition-all">
                            <option value="SILVER">Silver</option>
                            <option value="GOLD">Gold</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                          <button onClick={() => forceWithdrawal(p.id)} className="text-red-500 hover:bg-red-500 hover:text-black px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all">Withdraw</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PaginationUI />
            </div>
          </div>
        )}

        {/* 뉴스피드 관리 */}
        {activeTab === 'news' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
            <div className="lg:col-span-1 space-y-8">
              {/* 프리뷰 영역 (선택 시 보임) */}
              {previewNews && (
                <div className="bg-[#0a0a0a] border border-emerald-500/30 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-slideUp">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-lg font-black uppercase italic text-emerald-500">News Preview</h3>
                    <button onClick={() => setPreviewNews(null)} className="text-gray-500 hover:text-white font-black text-xs uppercase">Close</button>
                  </div>
                  <div className="aspect-video w-full overflow-hidden rounded-2xl mb-6 bg-black border border-white/5">
                    <img src={previewNews.image_url} alt={previewNews.title} className="w-full h-full object-cover" />
                  </div>
                  <h4 className="text-white font-black text-xl mb-4 leading-tight">{previewNews.title}</h4>
                  <p className="text-gray-400 text-sm font-light leading-relaxed line-clamp-4 mb-6">{previewNews.summary}</p>
                  <Link to={`/news/${previewNews.id}`} className="inline-block bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all">Go to Detail →</Link>
                </div>
              )}

              {/* 발행 폼 */}
              <div className="bg-neutral-900/40 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl">
                <h2 className="text-xl font-black mb-8 uppercase italic flex items-center gap-3"> Publish News </h2>
                <form onSubmit={handleCreateNews} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">News Title</label>
                    <input type="text" required value={newsForm.title} onChange={e => setNewsForm({...newsForm, title: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-3 text-sm text-white focus:border-emerald-500/50 outline-none" placeholder="뉴스 제목 입력" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Category</label>
                    <select value={newsForm.category} onChange={e => setNewsForm({...newsForm, category: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-3 text-sm text-white focus:border-emerald-500/50 outline-none">
                      <option value="Trend">Trend</option>
                      <option value="Tutorial">Tutorial</option>
                      <option value="Review">Review</option>
                      <option value="Update">Update</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Cover Image</label>
                    <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-video bg-black/40 border border-dashed border-white/10 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden group relative">
                      {imagePreview ? (
                        <img src={imagePreview} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[9px] font-black text-gray-600 uppercase">Select Image</span>
                      )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Summary</label>
                    <textarea value={newsForm.summary} onChange={e => setNewsForm({...newsForm, summary: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-3 text-sm text-white focus:border-emerald-500/50 outline-none h-24 resize-none" placeholder="짧은 요약글" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Content (Markdown)</label>
                    <textarea required value={newsForm.content} onChange={e => setNewsForm({...newsForm, content: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-3 text-sm text-white focus:border-emerald-500/50 outline-none h-48 resize-none" placeholder="본문 내용" />
                  </div>
                  <button type="submit" disabled={isPublishing} className="w-full bg-emerald-500 text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs hover:bg-white transition-all disabled:opacity-50">
                    {isPublishing ? 'PUBLISHING...' : 'PUBLISH NOW'}
                  </button>
                </form>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] text-gray-600 uppercase font-black tracking-widest">
                      <th className="px-8 py-6">Image</th>
                      <th className="px-8 py-6">News Feed</th>
                      <th className="px-8 py-6 text-right">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {currentPagedNews.map(n => (
                      <tr key={n.id} 
                        onClick={() => setPreviewNews(n)}
                        className={`group cursor-pointer hover:bg-white/[0.03] transition-all ${previewNews?.id === n.id ? 'bg-emerald-500/5 border-l-2 border-emerald-500' : ''}`}
                      >
                        <td className="px-8 py-4 w-24">
                          <div className="size-12 rounded-lg overflow-hidden border border-white/5 bg-black">
                            <img src={n.image_url} alt={n.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <p className={`font-bold text-sm transition-colors ${previewNews?.id === n.id ? 'text-emerald-500' : 'text-white group-hover:text-emerald-400'}`}>{n.title}</p>
                          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-1">{n.category} • {n.date}</p>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button onClick={(e) => { e.stopPropagation(); deleteNews(n.id); }} className="text-red-500/30 hover:text-red-500 font-bold text-[10px] uppercase">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {news.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-8 py-20 text-center text-gray-600 text-[10px] font-black uppercase tracking-[0.4em]">No news items found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <PaginationUI />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
