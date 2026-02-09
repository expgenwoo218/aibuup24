
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

const COMMON_QUESTIONS = [
  "공유해주실 부업이나 프로젝트의 '제목'을 정해주세요.",
  "이 부업을 시작하게 된 계기나 배경은 무엇인가요?",
  "주로 어떤 도구(AI 툴, 플랫폼 등)를 사용하셨나요?",
  "하루 평균 투자 시간과 월 발생 비용은 어느 정도인가요?",
  "지금까지의 성과(수익이나 결과)를 솔직하게 알려주세요.",
  "이 부업을 다른 분들에게 추천하시나요? 그 이유와 함께 장단점을 알려주세요.",
  "마지막으로 이 길을 걷고자 하는 다른 모험가분들에게 한마디 부탁드립니다."
];

const CommunityWrite: React.FC = () => {
  const { user, profile, refreshProfile } = useContext(UserContext);
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, sender: 'bot', text: "환영합니다, 모험가님! 🦾 데이터 수집 센터에 오신 것을 환영합니다." },
    { id: 2, sender: 'bot', text: "기록하고 싶은 주제를 선택해 주세요. 선택하신 주제에 맞춰 제가 질문을 드리고, 답변을 모아 리포트를 작성해 드립니다." }
  ]);
  
  const [step, setStep] = useState<'SELECT' | 'CHATTING' | 'GENERATING' | 'DONE'>('SELECT');
  const [selectedCat, setSelectedCat] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (step === 'CHATTING') inputRef.current?.focus();
  }, [messages, step, isBotTyping]);

  const handleCategorySelect = (name: string, isVip: boolean) => {
    if (isVip && (!profile || (profile.role !== 'GOLD' && profile.role !== 'ADMIN'))) {
      setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: "⚠️ 고수의 방은 GOLD 등급 이상만 작성이 가능합니다." }]);
      return;
    }
    setSelectedCat(name);
    setStep('CHATTING');
    setIsBotTyping(true);
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { id: Date.now(), sender: 'user', text: name },
        { id: Date.now() + 1, sender: 'bot', text: `감사합니다. [${name}] 분석을 시작합니다. 첫 번째 질문입니다.` },
        { id: Date.now() + 2, sender: 'bot', text: COMMON_QUESTIONS[0] }
      ]);
      setIsBotTyping(false);
    }, 800);
  };

  const handleSend = () => {
    if (!userInput.trim() || isBotTyping) return;
    const currentInput = userInput;
    const nextAnswers = [...answers, currentInput];
    setAnswers(nextAnswers);
    setUserInput('');
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: currentInput }]);
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < COMMON_QUESTIONS.length) {
      setIsBotTyping(true);
      setCurrentQuestionIndex(nextIndex);
      setTimeout(() => {
        setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: COMMON_QUESTIONS[nextIndex] }]);
        setIsBotTyping(false);
      }, 800);
    } else {
      saveReportDirectly(nextAnswers);
    }
  };

  const saveReportDirectly = async (finalAnswers: string[]) => {
    setStep('GENERATING');
    setIsBotTyping(true);
    
    // AI 대신 질문과 답변을 구조화된 마크다운으로 결합
    let reportContent = `## 📊 부업 데이터 리포트\n\n`;
    COMMON_QUESTIONS.forEach((question, index) => {
      reportContent += `### 🔍 ${question}\n> ${finalAnswers[index] || '답변 없음'}\n\n`;
    });

    const postData = {
      title: finalAnswers[0] || `[${selectedCat}] 데이터 리포트`,
      author: profile?.nickname || user?.email?.split('@')[0] || '모험가',
      category: selectedCat,
      content: reportContent,
      result: '기록 완료',
      user_id: user?.id,
      tool: finalAnswers[2],
      daily_time: finalAnswers[3],
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
      alert("리포트 저장 중 오류가 발생했습니다.");
      navigate(`/community`);
    } finally {
      setIsBotTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col pt-24 md:pt-32 pb-10">
      <div className="flex-1 max-w-2xl mx-auto w-full flex flex-col px-4 md:px-0 mb-4 overflow-hidden rounded-[2.5rem] md:rounded-[4rem] border border-white/5 bg-[#0a0a0a] shadow-2xl relative">
        <div className="bg-[#111] p-6 border-b border-white/5 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <Link to="/community" className="text-gray-600 hover:text-white transition-colors">
              <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-500 text-xs font-black">LOG</span>
              </div>
              <div>
                <h2 className="text-white font-black text-sm uppercase tracking-tight">지능형 기록 도우미</h2>
                <div className="flex items-center gap-1.5">
                  <span className={`size-1 rounded-full ${step === 'GENERATING' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                  <p className={`text-[8px] font-black uppercase tracking-widest ${step === 'GENERATING' ? 'text-amber-500' : 'text-emerald-500/50'}`}>
                    {step === 'GENERATING' ? 'Recording Data...' : 'Standard Ready'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 no-scrollbar min-h-[500px]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'} animate-slideUp`}>
              <div className={`max-w-[85%] ${msg.sender === 'user' ? 'bg-emerald-500 text-black font-bold' : 'bg-[#151515] text-gray-300 border border-white/5'} px-6 py-4 rounded-[1.8rem] ${msg.sender === 'bot' ? 'rounded-tl-none' : 'rounded-tr-none'} shadow-xl text-sm leading-relaxed break-words whitespace-pre-wrap`}>
                {msg.text}
              </div>
            </div>
          ))}

          {step === 'SELECT' && (
            <div className="space-y-8 mt-4 animate-slideUp">
              <div>
                <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em] mb-4 ml-2">고수의 방 (GOLD 권한)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {VIP_CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => handleCategorySelect(cat.name, true)} className="bg-[#111] border border-yellow-500/10 p-4 rounded-2xl text-[10px] font-black uppercase tracking-tight transition-all text-left text-yellow-500/80 hover:bg-yellow-500 hover:text-black">
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em] mb-4 ml-2">일반 게시판</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BOARD_CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                    <button key={cat.id} onClick={() => handleCategorySelect(cat.name, false)} className="bg-[#111] hover:bg-emerald-500 hover:text-black border border-white/5 p-4 rounded-2xl text-[10px] font-black uppercase tracking-tight text-gray-500 transition-all text-left">
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(isBotTyping || step === 'GENERATING') && (
            <div className="flex justify-start">
              <div className="bg-[#151515] px-6 py-4 rounded-[1.8rem] rounded-tl-none flex gap-1 items-center border border-white/5">
                <div className="size-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="size-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="size-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
                {step === 'GENERATING' && <span className="text-[10px] font-black text-emerald-500 ml-2 uppercase tracking-widest">리포트 아카이브 기록 중...</span>}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {step === 'CHATTING' && (
          <div className="p-6 bg-[#111] border-t border-white/5">
            <div className="flex gap-3">
              <input 
                ref={inputRef} type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} disabled={isBotTyping}
                placeholder={isBotTyping ? "기다려주세요..." : "답변을 입력하고 Enter를 누르세요..."}
                className="flex-1 bg-black border border-white/10 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-emerald-500/50"
              />
              <button onClick={handleSend} disabled={!userInput.trim() || isBotTyping} className="size-14 rounded-2xl bg-emerald-500 text-black flex items-center justify-center hover:scale-105 transition-all disabled:opacity-30">
                <svg className="size-6" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityWrite;
