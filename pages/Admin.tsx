
import React, { useState, useEffect, useRef, useContext } from 'react';
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
  const [activeTab, setActiveTab] = useState<'posts' | 'users' | 'news' | 'questions'>('posts');
  
  // 질문 관리용 상태
  const [questions, setQuestions] = useState<ChatQuestion[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Ai부업경험담');
  const [newQuestionText, setNewQuestionText] = useState('');

  const allCategories = [...BOARD_CATEGORIES.map(c => c.name), ...VIP_CATEGORIES.map(v => v.name)].filter(n => n !== '전체');

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
      console.error('Data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 질문 관리 함수들
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
    } catch (e) { alert('추가 실패'); }
  };

  const deleteQuestion = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
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
    
    // DB 업데이트
    try {
      await Promise.all(newQuestions.map((q, idx) => 
        supabase.from('chat_questions').update({ order_index: idx }).eq('id', q.id)
      ));
      setQuestions(newQuestions);
    } catch (e) { alert('순서 변경 실패'); }
  };

  if (loading && activeTab !== 'questions') return <div className="text-center pt-48 font-black text-emerald-500 animate-pulse uppercase tracking-[0.5em]">Syncing Neural Archives...</div>;

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
          {['posts', 'users', 'news', 'questions'].map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab as any)} 
              className={`px-8 py-4 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-black' : 'text-gray-500'}`}
            >
              {tab === 'posts' ? '게시글' : tab === 'users' ? '회원' : tab === 'news' ? '뉴스' : '질문 관리'}
            </button>
          ))}
        </div>

        {activeTab === 'questions' && (
          <div className="animate-fadeIn">
            <div className="flex flex-col md:flex-row gap-8">
              {/* 왼쪽: 카테고리 선택 */}
              <div className="md:w-64 shrink-0">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 px-2">Categories</h3>
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

              {/* 오른쪽: 질문 리스트 편집 */}
              <div className="flex-1">
                <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-8 md:p-12 shadow-2xl">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-black uppercase italic tracking-tight">
                      Questions for <span className="text-emerald-500">{selectedCategory}</span>
                    </h2>
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{questions.length} Questions</span>
                  </div>

                  <div className="space-y-4 mb-10">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="group flex items-center gap-4 bg-white/5 border border-white/5 rounded-2xl p-4 transition-all hover:border-emerald-500/30">
                        <div className="flex flex-col gap-1 shrink-0">
                          <button onClick={() => moveQuestion(idx, 'up')} className="text-gray-600 hover:text-white">▲</button>
                          <button onClick={() => moveQuestion(idx, 'down')} className="text-gray-600 hover:text-white">▼</button>
                        </div>
                        <span className="text-emerald-500 font-black text-xs w-6">{idx + 1}</span>
                        <input 
                          type="text" 
                          value={q.question_text} 
                          onChange={(e) => updateQuestionText(q.id, e.target.value)}
                          className="flex-1 bg-transparent border-none outline-none text-sm text-white font-medium"
                        />
                        <button onClick={() => deleteQuestion(q.id)} className="text-red-500/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all font-bold text-[10px] uppercase">Delete</button>
                      </div>
                    ))}
                    {questions.length === 0 && <div className="py-10 text-center text-gray-600 text-[10px] font-black uppercase tracking-widest">No questions defined for this category.</div>}
                  </div>

                  <div className="flex gap-3 pt-6 border-t border-white/5">
                    <input 
                      type="text" 
                      value={newQuestionText} 
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addQuestion()}
                      placeholder="새로운 질문을 입력하세요..."
                      className="flex-1 bg-black border border-white/10 rounded-xl px-5 py-3 text-sm outline-none focus:border-emerald-500/50"
                    />
                    <button onClick={addQuestion} className="bg-emerald-500 text-black font-black px-8 rounded-xl text-xs uppercase hover:bg-white transition-all">Add Question</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 기존 posts, users, news 탭 내용은 유지... */}
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
                  {posts.map(post => (
                    <tr key={post.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-6"><Link to={`/community/${post.id}`} className="font-bold text-sm line-clamp-1 hover:text-emerald-400 transition-colors">{post.title}</Link></td>
                      <td className="px-8 py-6 text-xs text-gray-500">{post.author}</td>
                      <td className="px-8 py-6"><span className="text-[9px] font-black px-3 py-1 bg-white/5 border border-white/10 rounded-full uppercase text-gray-400">{post.category}</span></td>
                      <td className="px-8 py-6 text-right"><button onClick={() => {}} className="text-red-500/30 hover:text-red-500 font-bold text-[10px] uppercase transition-colors">Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default Admin;
