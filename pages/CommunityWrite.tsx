
import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { VIP_CATEGORIES, BOARD_CATEGORIES } from '../constants';
import { supabase, isConfigured } from '../lib/supabase';
import { UserContext } from '../App';

interface Message {
  id: number;
  sender: 'bot' | 'user';
  text: string;
}

const CommunityWrite: React.FC = () => {
  const { user, profile, refreshProfile } = useContext(UserContext);
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, sender: 'bot', text: "환영합니다, 모험가님! 🦾 데이터 수집 센터에 오신 것을 환영합니다." },
    { id: 2, sender: 'bot', text: "기록하고 싶은 주제를 선택해 주세요. 선택하신 주제에 맞춰 제가 질문을 드리고, 답변을 모아 리포트를 작성해 드립니다." }
  ]);
  
  const [step, setStep] = useState<'SELECT' | 'CHATTING' | 'GENERATING' | 'DONE'>('SELECT');
  const [selectedCat, setSelectedCat] = useState('');
  const [dynamicQuestions, setDynamicQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    scrollToBottom();
    if (step === 'CHATTING') {
      // 키보드가 올라올 때의 딜레이를 고려하여 약간의 시간차를 두고 스크롤
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, step, isBotTyping]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCategorySelect = async (name: string, isVip: boolean) => {
    if (isVip && (!profile || (profile.role !== 'GOLD' && profile.role !== 'ADMIN'))) {
      setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: "⚠️ 고수의 방은 GOLD 등급 이상만 작성이 가능합니다." }]);
      return;
    }

    setSelectedCat(name);
    setIsBotTyping(true);

    try {
      const { data, error } = await supabase.from('chat_questions')
        .select('question_text')
        .eq('category', name)
        .order('order_index', { ascending: true });
      
      if (error) throw error;

      const fetchedQuestions = (data && data.length > 0) 
        ? data.map(q => q.question_text) 
        : ["제목을 입력해주세요.", "상세 내용을 기록해주세요."];

      setDynamicQuestions(fetchedQuestions);
      setStep('CHATTING');
      
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          { id: Date.now(), sender: 'user', text: name },
          { id: Date.now() + 1, sender: 'bot', text: `감사합니다. [${name}] 분석을 시작합니다.` },
          { id: Date.now() + 2, sender: 'bot', text: fetchedQuestions[0] }
        ]);
        setIsBotTyping(false);
      }, 800);
    } catch (e) {
      console.error(e);
      alert("데이터 로드 실패");
      setIsBotTyping(false);
    }
  };

  const handleSend = () => {
    if (!userInput.trim() || isBotTyping) return;
    const currentInput = userInput;
    const nextAnswers = [...answers, currentInput];
    setAnswers(nextAnswers);
    setUserInput('');
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: currentInput }]);
    
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < dynamicQuestions.length) {
      setIsBotTyping(true);
      setCurrentQuestionIndex(nextIndex);
      setTimeout(() => {
        setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: dynamicQuestions[nextIndex] }]);
        setIsBotTyping(false);
      }, 800);
    } else {
      saveReportDirectly(nextAnswers);
    }
  };

  const saveReportDirectly = async (finalAnswers: string[]) => {
    setStep('GENERATING');
    setIsBotTyping(true);
    
    let reportContent = `## 📊 Intelligence Archive Report\n\n`;
    dynamicQuestions.forEach((question, index) => {
      reportContent += `### 🔍 ${question}\n> ${finalAnswers[index] || 'No Data'}\n\n`;
    });

    const postData = {
      title: finalAnswers[0] || `[${selectedCat}] Data Entry`,
      author: profile?.nickname || user?.email?.split('@')[0] || '모험가',
      category: selectedCat,
      content: reportContent,
      result: 'Archive Ready',
      user_id: user?.id,
      tool: finalAnswers[2] || 'System',
      daily_time: finalAnswers[3] || 'N/A',
      created_at: new Date().toISOString()
    };

    try {
      if (isConfigured) {
        const { error } = await supabase.from('posts').insert([postData]);
        if (error) throw error;
        refreshProfile();
      }
      setStep('DONE');
      setTimeout(() => navigate(`/community?cat=${selectedCat}`), 1000);
    } catch (err) {
      console.error("Save Error:", err);
      navigate(`/community`);
    } finally {
      setIsBotTyping(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col pt-20 md:pt-32">
      <div className="flex-1 max-w-2xl mx-auto w-full flex flex-col bg-[#0a0a0a] md:rounded-t-[3rem] border-x border-t border-white/5 overflow-hidden relative">
        
        {/* 헤더 */}
        <div className="bg-[#111] p-4 md:p-6 border-b border-white/5 flex items-center justify-between z-30 shrink-0">
          <div className="flex items-center gap-4">
            <Link to="/community" className="text-gray-600 hover:text-white transition-colors">
              <svg className="size-5 md:size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div className="flex items-center gap-3">
              <div className="size-8 md:size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-500 text-[10px] font-black">AI</span>
              </div>
              <div>
                <h2 className="text-white font-black text-xs md:text-sm uppercase tracking-tight">Intelligence Log</h2>
                <p className="text-[8px] font-black uppercase text-emerald-500/50 tracking-widest animate-pulse">System Active</p>
              </div>
            </div>
          </div>
        </div>

        {/* 채팅 영역 */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 no-scrollbar"
        >
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'} animate-slideUp`}>
              <div className={`max-w-[85%] ${msg.sender === 'user' ? 'bg-emerald-500 text-black font-bold' : 'bg-[#151515] text-gray-300 border border-white/5'} px-5 py-3 rounded-[1.5rem] ${msg.sender === 'bot' ? 'rounded-tl-none' : 'rounded-tr-none'} shadow-xl text-xs md:text-sm leading-relaxed break-words whitespace-pre-wrap`}>
                {msg.text}
              </div>
            </div>
          ))}

          {step === 'SELECT' && (
            <div className="space-y-6 mt-4 animate-slideUp">
              <div>
                <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.3em] mb-3 ml-2 italic">Exclusive Vault</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {VIP_CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => handleCategorySelect(cat.name, true)} className="bg-[#111] border border-yellow-500/10 p-3.5 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all text-left text-yellow-500/80 hover:bg-yellow-500 hover:text-black">
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.3em] mb-3 ml-2 italic">Standard Archive</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BOARD_CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                    <button key={cat.id} onClick={() => handleCategorySelect(cat.name, false)} className="bg-[#111] hover:bg-emerald-500 hover:text-black border border-white/5 p-3.5 rounded-xl text-[10px] font-black uppercase tracking-tight text-gray-500 transition-all text-left">
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(isBotTyping || step === 'GENERATING') && (
            <div className="flex justify-start">
              <div className="bg-[#151515] px-5 py-3 rounded-[1.5rem] rounded-tl-none flex gap-1 items-center border border-white/5">
                <div className="size-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="size-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="size-1 bg-emerald-500 rounded-full animate-bounce"></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} className="h-4" />
        </div>

        {/* 하단 고정 입력 컨트롤 영역 */}
        {step === 'CHATTING' && (
          <div className="bg-[#111] border-t border-white/5 shrink-0 z-40">
            {/* 현재 질문 안내 바 (키보드 바로 위에 위치) */}
            <div className="px-4 py-2 bg-emerald-500/5 border-b border-emerald-500/10">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest shrink-0">Current Q.</span>
                <p className="text-[11px] text-gray-400 font-medium truncate italic">
                  {dynamicQuestions[currentQuestionIndex]}
                </p>
              </div>
            </div>
            
            <div className="p-4 flex gap-3">
              <input 
                ref={inputRef} 
                type="text" 
                value={userInput} 
                onChange={(e) => setUserInput(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
                disabled={isBotTyping}
                onFocus={scrollToBottom}
                placeholder={isBotTyping ? "Syncing..." : "답변을 입력하세요..."}
                className="flex-1 bg-black border border-white/10 rounded-xl px-5 py-3.5 text-sm text-white outline-none focus:border-emerald-500/50 transition-all"
              />
              <button 
                onClick={handleSend} 
                disabled={!userInput.trim() || isBotTyping} 
                className="size-12 rounded-xl bg-emerald-500 text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-lg shadow-emerald-500/20"
              >
                <svg className="size-5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityWrite;
