
import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, isConfigured } from '../lib/supabase';
import { CommunityPost, NewsItem } from '../types';
import { UserContext } from '../App';
import { BOARD_CATEGORIES, VIP_CATEGORIES } from '../constants';
import { GoogleGenAI } from "@google/genai";

interface Profile {
  id: string;
  email: string;
  nickname: string;
  role: 'ADMIN' | 'GOLD' | 'SILVER';
  created_at: string;
  persona_memo?: string;
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
  const [searchParams] = useSearchParams();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  
  // 탭 상태 초기화: URL 파라미터가 있으면 해당 탭 사용, 없으면 'posts'
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'posts' | 'users' | 'news' | 'questions' | 'auto_post'>(
    (tabFromUrl === 'users' || tabFromUrl === 'news' || tabFromUrl === 'questions' || tabFromUrl === 'auto_post' || tabFromUrl === 'posts') 
      ? tabFromUrl as any 
      : 'posts'
  );
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // 질문 관리용 상태
  const [questions, setQuestions] = useState<ChatQuestion[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Ai부업경험담');
  const [newQuestionText, setNewQuestionText] = useState('');

  // 자동 게시글 생성 상태
  const [autoPostEmail, setAutoPostEmail] = useState('');
  const [autoPostCategory, setAutoPostCategory] = useState('Ai부업경험담');
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [persona, setPersona] = useState({
    level: '초보',
    scam: '피해 없음',
    exp: '미경험',
    attitude: '긍정적',
    job: '직장인',
    marital: '미혼',
    children: '자녀 없음'
  });

  const allCategories = [...BOARD_CATEGORIES.map(c => c.name), ...VIP_CATEGORIES.map(v => v.name)].filter(n => n !== '전체');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [newsForm, setNewsForm] = useState({
    title: '',
    category: 'NEWS',
    summary: '',
    content: '',
    image_url: ''
  });
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);

  // URL 파라미터 변경 감지하여 탭 업데이트
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['posts', 'users', 'news', 'questions', 'auto_post'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

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
    setCurrentPage(1);
  }, [activeTab, selectedCategory]);

  const fetchAdminData = async () => {
    if (!isConfigured) return;
    setLoading(true);
    try {
      if (activeTab === 'posts') {
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*, profiles(email)')
          .order('created_at', { ascending: false });
        
        const { data: profilesData } = await supabase.from('profiles').select('id, email, persona_memo');
        if (profilesData) setProfiles(profilesData as any);

        if (postsError) {
          const { data: fallbackData } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
          setPosts(fallbackData || []);
        } else {
          setPosts(postsData || []);
        }
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

  const handleAutoPostGenerate = async () => {
    if (!autoPostEmail.trim()) return alert('발행 대상 이메일을 입력해주세요.');
    if (isManualMode && (!manualTitle.trim() || !manualContent.trim())) return alert('제목과 내용을 입력해주세요.');
    
    setIsPublishing(true);

    try {
      // 1. 대상 사용자 조회
      const { data: targetProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', autoPostEmail.trim())
        .single();

      if (profileError || !targetProfile) throw new Error('해당 이메일을 가진 회원을 찾을 수 없습니다.');

      let finalTitle = '';
      let finalContent = '';

      if (isManualMode) {
        // 직접 작성 모드
        finalTitle = manualTitle;
        finalContent = manualContent;
      } else {
        // AI 자동 생성 모드
        // 2. 카테고리 질문지 조회
        const { data: catQuestions } = await supabase
          .from('chat_questions')
          .select('question_text')
          .eq('category', autoPostCategory)
          .order('order_index', { ascending: true });

        const questionTexts = catQuestions?.map(q => q.question_text) || ["제목을 정해주세요.", "내용을 작성해주세요."];

        // 3. AI 답변 생성 (Gemini)
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `
          당신은 지금부터 아래 페르소나를 가진 커뮤니티 사용자입니다.
          페르소나: ${persona.level}, ${persona.scam}, ${persona.exp}, ${persona.attitude}, ${persona.job}, ${persona.marital}, ${persona.children}
          
          이 페르소나에 완벽히 빙의하여, 아래 질문들에 대해 자연스럽고 생생한 한국어 구어체로 답변을 작성해주세요. 
          실제 사람이 쓴 것처럼 감정과 디테일이 살아있어야 합니다.
          
          질문 목록:
          ${questionTexts.map((q, i) => `${i+1}. ${q}`).join('\n')}
          
          응답은 반드시 질문 순서대로 답변만 나열하되, 각 답변은 줄바꿈으로 구분해주세요.
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
        });

        const aiAnswers = response.text.split('\n').filter(line => line.trim().length > 0);
        
        // 4. 리포트 본문 구성
        finalTitle = aiAnswers[0]?.slice(0, 50) || `[${autoPostCategory}] AI 자동 생성 리포트`;
        finalContent = `## 📊 AI Generated Intelligence Report\n\n`;
        finalContent += `> **Auditor Persona**: ${persona.level} 모험가 / ${persona.job} / ${persona.exp}\n\n`;
        
        questionTexts.forEach((q, i) => {
          finalContent += `### 🔍 ${q}\n> ${aiAnswers[i] || 'AI가 답변을 생성하지 못했습니다.'}\n\n`;
        });
      }

      // 5. 게시글 등록
      const postData = {
        title: finalTitle,
        author: targetProfile.nickname,
        category: autoPostCategory,
        content: finalContent,
        result: isManualMode ? 'Direct Entry' : 'AI Verified Archive',
        user_id: targetProfile.id,
        tool: isManualMode ? 'Manual Admin Action' : 'Gemini AI Integration',
        daily_time: 'N/A',
        created_at: new Date().toISOString(),
        likes: Math.floor(Math.random() * 5)
      };

      const { error: insertError } = await supabase.from('posts').insert([postData]);
      if (insertError) throw insertError;

      alert(`${targetProfile.nickname} 님의 이름으로 글이 성공적으로 발행되었습니다.`);
      setAutoPostEmail('');
      setManualTitle('');
      setManualContent('');
      setActiveTab('posts');
    } catch (err: any) {
      alert('오류 발생: ' + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deletePost = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) throw error;
      setPosts(posts.filter(p => p.id !== id));
    } catch (e) { alert('삭제 실패'); }
  };

  const deleteNews = async (id: string) => {
    if (!window.confirm('뉴스를 삭제하시겠습니까?')) return;
    try {
      const { error } = await supabase.from('news').delete().eq('id', id);
      if (error) throw error;
      setNews(news.filter(n => n.id !== id));
    } catch (e) { alert('삭제 실패'); }
  };

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);
    try {
      if (editingNewsId) {
        // 기존 뉴스 수정
        const { error } = await supabase
          .from('news')
          .update({
            title: newsForm.title,
            category: newsForm.category,
            summary: newsForm.summary,
            content: newsForm.content,
            image_url: newsForm.image_url
          })
          .eq('id', editingNewsId);

        if (error) throw error;
        alert('뉴스 수정 성공!');
      } else {
        // 새 뉴스 발행
        const { data, error } = await supabase.from('news').insert([{
          ...newsForm,
          date: new Date().toLocaleDateString()
        }]).select().single();
        if (error) throw error;
        setNews(prev => [data, ...prev]);
        alert('뉴스 발행 성공!');
      }
      
      // 상태 초기화
      setNewsForm({ title: '', category: 'NEWS', summary: '', content: '', image_url: '' });
      setImagePreview(null);
      setEditingNewsId(null);
      fetchAdminData();
    } catch (err: any) { 
      alert('에러: ' + err.message); 
    } finally { 
      setIsPublishing(false); 
    }
  };

  const startEditNews = (n: NewsItem) => {
    setNewsForm({
      title: n.title,
      category: n.category,
      summary: n.summary,
      content: n.content,
      image_url: n.image_url
    });
    setImagePreview(n.image_url);
    setEditingNewsId(n.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      if (error) throw error;
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole as any } : p));
      alert(`회원 등급이 ${newRole} 등급으로 변경되었습니다.`);
    } catch (err: any) { alert('등급 변경 실패'); }
  };

  const forceWithdrawal = async (userId: string) => {
    if (userId === user?.id) return alert('본인 탈퇴 불가');
    if (!window.confirm('회원을 강제 탈퇴시키겠습니까?')) return;
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
      setProfiles(prev => prev.filter(p => p.id !== userId));
      alert('탈퇴 처리 완료');
    } catch (err: any) { alert('탈퇴 처리 실패'); }
  };

  const getAuthorEmail = (post: any) => {
    const joinedProfile = post.profiles;
    if (joinedProfile) {
      if (Array.isArray(joinedProfile) && joinedProfile[0]?.email) return joinedProfile[0].email;
      if (joinedProfile.email) return joinedProfile.email;
    }
    const foundProfile = profiles.find(p => p.id === post.user_id);
    if (foundProfile) return foundProfile.email;
    return 'N/A';
  };

  if (loading && activeTab !== 'questions' && activeTab !== 'news' && activeTab !== 'auto_post') return <div className="text-center pt-48 font-black text-emerald-500 animate-pulse">SYNCHRONIZING ADMIN INTERFACE...</div>;

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
          <button onClick={() => setActiveTab('auto_post')} className={`px-8 py-4 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'auto_post' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}>자동 게시글 생성</button>
        </div>

        {/* 자동 게시글 생성 섹션 */}
        {activeTab === 'auto_post' && (
          <div className="animate-fadeIn max-w-4xl mx-auto">
            <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-10 shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <h2 className="text-2xl font-black uppercase italic flex items-center gap-3">
                  <span className="text-emerald-500">🤖</span> Publisher Control
                </h2>
                
                {/* 모드 전환 토글 */}
                <div className="flex bg-black/50 border border-white/10 p-1 rounded-xl">
                  <button 
                    onClick={() => setIsManualMode(false)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!isManualMode ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-gray-500 hover:text-white'}`}
                  >
                    AI Auto
                  </button>
                  <button 
                    onClick={() => setIsManualMode(true)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isManualMode ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-gray-500 hover:text-white'}`}
                  >
                    Direct Write
                  </button>
                </div>
              </div>
              
              <div className="space-y-8">
                {/* 대상 회원 이메일 및 카테고리 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Target User Email</label>
                    <input 
                      type="email"
                      value={autoPostEmail}
                      onChange={(e) => setAutoPostEmail(e.target.value)}
                      placeholder="글을 발행할 회원의 이메일 입력"
                      className="w-full bg-black/50 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-emerald-500/50 text-white text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Board Category</label>
                    <select 
                      value={autoPostCategory}
                      onChange={(e) => setAutoPostCategory(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-emerald-500/50 text-white text-sm"
                    >
                      {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                </div>

                {isManualMode ? (
                  /* 직접 작성 모드 UI */
                  <div className="bg-white/5 rounded-3xl p-8 border border-white/5 animate-fadeIn">
                    <h3 className="text-xs font-black text-emerald-500 uppercase tracking-[0.3em] mb-6 italic">Direct Content Entry</h3>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Post Title</label>
                        <input 
                          type="text"
                          value={manualTitle}
                          onChange={(e) => setManualTitle(e.target.value)}
                          placeholder="발행할 제목을 입력하세요"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-3 text-sm text-white focus:border-emerald-500/50 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Content Body (Markdown Support)</label>
                        <textarea 
                          value={manualContent}
                          onChange={(e) => setManualContent(e.target.value)}
                          placeholder="발행할 내용을 입력하세요. 마크다운 문법을 지원합니다."
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-3 text-sm text-white focus:border-emerald-500/50 outline-none h-64 resize-none leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 페르소나 설정 섹션 (AI 모드) */
                  <div className="bg-white/5 rounded-3xl p-8 border border-white/5 animate-fadeIn">
                    <h3 className="text-xs font-black text-emerald-500 uppercase tracking-[0.3em] mb-6 italic">Persona Configuration</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* 레벨 */}
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">숙련도</label>
                        <div className="flex gap-2">
                          {['초보', '중수', '고수'].map(v => (
                            <button key={v} onClick={() => setPersona({...persona, level: v})} className={`flex-1 py-2 rounded-lg text-[10px] font-black border transition-all ${persona.level === v ? 'bg-white text-black border-white' : 'bg-black/40 border-white/5 text-gray-500'}`}>{v}</button>
                          ))}
                        </div>
                      </div>
                      {/* 강팔이 피해 */}
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">강팔이 피해</label>
                        <div className="flex gap-2">
                          {['피해 있음', '피해 없음'].map(v => (
                            <button key={v} onClick={() => setPersona({...persona, scam: v})} className={`flex-1 py-2 rounded-lg text-[10px] font-black border transition-all ${persona.scam === v ? 'bg-white text-black border-white' : 'bg-black/40 border-white/5 text-gray-500'}`}>{v}</button>
                          ))}
                        </div>
                      </div>
                      {/* 부업 경험 */}
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">부업 경험</label>
                        <div className="flex gap-2">
                          {['성공경험', '실패경험', '미경험'].map(v => (
                            <button key={v} onClick={() => setPersona({...persona, exp: v})} className={`flex-1 py-2 rounded-lg text-[10px] font-black border transition-all ${persona.exp === v ? 'bg-white text-black border-white' : 'bg-black/40 border-white/5 text-gray-500'}`}>{v}</button>
                          ))}
                        </div>
                      </div>
                      {/* 성향 */}
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">부업 성향</label>
                        <div className="flex gap-2">
                          {['긍정적', '부정적'].map(v => (
                            <button key={v} onClick={() => setPersona({...persona, attitude: v})} className={`flex-1 py-2 rounded-lg text-[10px] font-black border transition-all ${persona.attitude === v ? 'bg-white text-black border-white' : 'bg-black/40 border-white/5 text-gray-500'}`}>{v}</button>
                          ))}
                        </div>
                      </div>
                      {/* 결혼 */}
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">결혼 상태</label>
                        <div className="flex gap-2">
                          {['미혼', '기혼'].map(v => (
                            <button key={v} onClick={() => setPersona({...persona, marital: v})} className={`flex-1 py-2 rounded-lg text-[10px] font-black border transition-all ${persona.marital === v ? 'bg-white text-black border-white' : 'bg-black/40 border-white/5 text-gray-500'}`}>{v}</button>
                          ))}
                        </div>
                      </div>
                      {/* 자녀 */}
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">자녀 유무</label>
                        <div className="flex gap-2">
                          {['자녀 있음', '자녀 없음'].map(v => (
                            <button key={v} onClick={() => setPersona({...persona, children: v})} className={`flex-1 py-2 rounded-lg text-[10px] font-black border transition-all ${persona.children === v ? 'bg-white text-black border-white' : 'bg-black/40 border-white/5 text-gray-500'}`}>{v}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 직업 성향 (길어서 따로 처리) */}
                    <div className="mt-8 space-y-3">
                      <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">직업군</label>
                      <div className="flex flex-wrap gap-2">
                        {['직장인', '사업자', '1인 창업', '주부', '학생', '은퇴자', '백수'].map(v => (
                          <button key={v} onClick={() => setPersona({...persona, job: v})} className={`px-4 py-2 rounded-lg text-[10px] font-black border transition-all ${persona.job === v ? 'bg-white text-black border-white' : 'bg-black/40 border-white/5 text-gray-500'}`}>{v}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <button 
                  onClick={handleAutoPostGenerate}
                  disabled={isPublishing}
                  className="w-full bg-emerald-500 text-black font-black py-6 rounded-2xl uppercase tracking-[0.3em] text-sm hover:bg-white transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-4 disabled:opacity-50"
                >
                  {isPublishing ? (
                    <><div className="size-5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> {isManualMode ? 'PUBLISHING...' : 'GENERATING INTELLIGENCE...'}</>
                  ) : isManualMode ? '즉시 발행하기' : 'AI 답변 생성 및 글 발행'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 질문 관리 탭 */}
        {activeTab === 'questions' && (
          <div className="animate-fadeIn">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="md:w-64 shrink-0">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 px-2 italic">Board Categories</h3>
                <div className="space-y-1">
                  {allCategories.map(cat => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)} className={`w-full text-left px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-tight transition-all border ${selectedCategory === cat ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-neutral-900/50 text-gray-400 border-white/5 hover:border-white/20'}`}>{cat}</button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 size-64 bg-emerald-500/5 blur-[100px] pointer-events-none" />
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <h2 className="text-xl font-black uppercase italic tracking-tight">Chat Questions: <span className="text-emerald-500">{selectedCategory}</span></h2>
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
                        <input type="text" value={q.question_text} onChange={(e) => updateQuestionText(q.id, e.target.value)} className="flex-1 bg-transparent border-none outline-none text-sm text-white font-medium" />
                        <button onClick={() => deleteQuestion(q.id)} className="text-red-500/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all font-bold text-[10px] uppercase">Remove</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3 pt-8 border-t border-white/5 relative z-10">
                    <input type="text" value={newQuestionText} onChange={(e) => setNewQuestionText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addQuestion()} placeholder="새 질문을 입력하고 Enter를 누르세요..." className="flex-1 bg-black border border-white/10 rounded-xl px-5 py-3 text-sm outline-none focus:border-emerald-500/50" />
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
                    <th className="px-8 py-6">Author & Email</th>
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
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="text-xs text-white font-bold">{post.author}</span>
                          <span className="text-[10px] text-gray-500">{getAuthorEmail(post)}</span>
                        </div>
                      </td>
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
                        <Link to={`/admin/user/${p.id}`} className="flex flex-col group/user">
                          <span className="font-bold text-sm text-white group-hover/user:text-emerald-400 transition-colors">{p.nickname}</span>
                          <span className="text-[10px] text-gray-500">{p.email}</span>
                        </Link>
                      </td>
                      <td className="px-8 py-6 text-[11px] text-gray-500">{new Date(p.created_at).toLocaleDateString()}</td>
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
              <div className="bg-neutral-900/40 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl">
                <h2 className="text-xl font-black mb-8 uppercase italic flex items-center gap-3"> {editingNewsId ? 'Edit News' : 'Publish News'} </h2>
                <form onSubmit={handleCreateNews} className="space-y-5">
                  <input type="text" required value={newsForm.title} onChange={e => setNewsForm({...newsForm, title: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-3 text-sm text-white focus:border-emerald-500/50 outline-none" placeholder="뉴스 제목 입력" />
                  <select value={newsForm.category} onChange={e => setNewsForm({...newsForm, category: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-3 text-sm text-white focus:border-emerald-500/50 outline-none">
                    <option value="NEWS">NEWS</option>
                    <option value="공지">공지</option>
                    <option value="리뷰">리뷰</option>
                    <option value="Ai Trend">Ai Trend</option>
                  </select>
                  <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-video bg-black/40 border border-dashed border-white/10 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden group relative">
                    {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <span className="text-[9px] font-black text-gray-600 uppercase">Select Image</span>}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                  <textarea value={newsForm.summary} onChange={e => setNewsForm({...newsForm, summary: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-3 text-sm text-white focus:border-emerald-500/50 outline-none h-24 resize-none" placeholder="짧은 요약글" />
                  <textarea required value={newsForm.content} onChange={e => setNewsForm({...newsForm, content: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-xl px-5 py-3 text-sm text-white focus:border-emerald-500/50 outline-none h-48 resize-none" placeholder="본문 내용" />
                  <button type="submit" disabled={isPublishing} className="w-full bg-emerald-500 text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs hover:bg-white transition-all">
                    {isPublishing ? (editingNewsId ? 'UPDATING...' : 'PUBLISHING...') : (editingNewsId ? 'UPDATE NEWS' : 'PUBLISH NOW')}
                  </button>
                  {editingNewsId && (
                    <button type="button" onClick={() => {
                      setEditingNewsId(null);
                      setNewsForm({ title: '', category: 'NEWS', summary: '', content: '', image_url: '' });
                      setImagePreview(null);
                    }} className="w-full mt-2 bg-white/5 border border-white/10 text-gray-500 font-black py-3 rounded-xl uppercase tracking-widest text-[10px] hover:text-white transition-all">
                      Cancel Edit
                    </button>
                  )}
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
                      <tr key={n.id} className="group hover:bg-white/[0.03] transition-all">
                        <td className="px-8 py-4 w-24">
                          <div className="size-12 rounded-lg overflow-hidden border border-white/5 bg-black">
                            <img src={n.image_url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <p className="font-bold text-sm text-white">{n.title}</p>
                          <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mt-1">{n.category} • {n.date}</p>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button onClick={() => startEditNews(n)} className="text-emerald-500 hover:text-white font-bold text-[10px] uppercase transition-colors">Edit</button>
                            <button onClick={() => deleteNews(n.id)} className="text-red-500/30 hover:text-red-500 font-bold text-[10px] uppercase transition-colors">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
