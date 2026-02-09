
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
    { id: 2, sender: 'bot', text: "기록하고 싶은 주제를 선택해 주세요. 선택하신 주제에 맞춰 제가 질문을 드리고, 답변을 모아 전문적인 리포트를 작성해 드립니다." }
  ]);
  
  const [step, setStep] = useState<'SELECT' | 'CHATTING' | 'GENERATING' | 'DONE'>('SELECT');
  const [selectedCat, setSelectedCat] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [isBotTyping, setIsBotTyping] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isGold = profile?.role === 'GOLD' || profile?.role === 'ADMIN';

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (step === 'CHATTING') inputRef.current?.focus();
  }, [messages, step, isBotTyping]);

  const handleCategorySelect = (name: string, isVip: boolean) => {
    if (isVip && !isGold) {
      setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: "⚠️ 고수의 방 카테고리는 GOLD 등급 이상만 작성이 가능합니다. 일반 게시판에서 활동하여 등급을 높여보세요!" }]);
      return;
    }

    setSelectedCat(name);
    setStep('CHATTING');
    setIsBotTyping(true);

    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { id: Date.now(), sender: 'user', text: name },
        { id: Date.now() + 1, sender: 'bot', text: `감사합니다. [${name}] 카테고리 기록을 시작하겠습니다. 첫 번째 질문입니다.` },
        { id: Date.now() + 2, sender: 'bot', text: COMMON_QUESTIONS[0] }
      ]);
      setIsBotTyping(false);
    }, 1000);
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
      }, 1000);
    } else {
      generateFinalReport(nextAnswers);
    }
  };

  const generateFinalReport = async (finalAnswers: string[]) => {
    setStep('GENERATING');
    setIsBotTyping(true);

    // AI 없이 수집된 데이터를 템플릿에 맞게 조합
    const title = finalAnswers[0];
    const reportContent = `
### 📊 부업 인텔리전스 리포트

**1. 시작 계기 및 배경**
> ${finalAnswers[1]}

**2. 활용 도구 및 플랫폼**
* **주요 툴:** ${finalAnswers[2]}

**3. 투자 자원 및 성과**
* **투자 규모:** ${finalAnswers[3]}
* **수익 및 결과:** ${finalAnswers[4]}

**4. 종합 분석 및 제언**
* **추천 여부 및 분석:** ${finalAnswers[5]}
* **동료 모험가에게 한마디:** ${finalAnswers[6]}

---
*본 리포트는 모험가님의 실제 답변을 바탕으로 구조화되었습니다.*
    `.trim();

    try {
      const newPost: any = {
        title: title || `[${selectedCat}] 새로운 리포트`,
        author: profile?.nickname || user?.email?.split('@')[0] || '익명',
        category: selectedCat,
        content: reportContent,
        result: '검증 대기 중',
        user_id: user?.id,
        created_at: new Date().toISOString(),
        likes: 0,
        tool: finalAnswers[2],
        daily_time: finalAnswers[3]
      };

      if (isConfigured && user) {
        const { error } = await supabase.from('posts').insert([newPost]);
        if (error) throw error;
        refreshProfile();
      }

      setStep('DONE');
      setTimeout(() => navigate(`/community?cat=${selectedCat}`), 1500);

    } catch (err) {
      console.error("Report Save Error:", err);
      setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: "리포트 저장 중 오류가 발생했습니다." }]);
      setStep('CHATTING');
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
                <span className="text-emerald-500 text-xs font-black">CHAT</span>
              </div>
              <div>
                <h2 className="text-white font-black text-sm uppercase tracking-tight">기록 도우미</h2>
                <div className="flex items-center gap-1.5">
                  <span className={`size-1 rounded-full ${step === 'GENERATING' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                  <p className={`text-[8px] font-black uppercase tracking-widest ${step === 'GENERATING' ? 'text-amber-500' : 'text-emerald-500/50'}`}>
                    {step === 'GENERATING' ? 'Processing...' : 'Recording Session'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 no-scrollbar min-h-[500px]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'} animate-slideUp`}>
              <div className={`max-w-[85%] ${msg.sender === 'user' ? 'bg-emerald-500 text-black font-bold' : 'bg-[#151515] text-gray-300 border border-white/5'} px-6 py-4 rounded-[1.8rem] ${msg.sender === 'bot' ? 'rounded-tl-none' : 'rounded-tr-none'} shadow-xl text-sm leading-relaxed whitespace-pre-line`}>
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
                    <button 
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.name, true)}
                      className={`relative overflow-hidden bg-[#111] border border-yellow-500/10 p-4 rounded-2xl text-[10px] font-black uppercase tracking-tight transition-all text-left shadow-lg ${
                        isGold ? 'hover:bg-yellow-500 hover:text-black text-yellow-500/80 hover:border-yellow-500' : 'opacity-40 grayscale cursor-not-allowed text-gray-600'
                      }`}
                    >
                      {!isGold && <span className="absolute top-2 right-2 opacity-50">🔒</span>}
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em] mb-4 ml-2">일반 게시판 (모든 권한)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BOARD_CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                    <button 
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.name, false)}
                      className="bg-[#111] hover:bg-emerald-500 hover:text-black border border-white/5 p-4 rounded-2xl text-[10px] font-black uppercase tracking-tight text-gray-500 transition-all text-left shadow-lg"
                    >
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
                {step === 'GENERATING' && <span className="text-[10px] font-black text-emerald-500 ml-2 uppercase tracking-widest">데이터 리포트 생성 중...</span>}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {step === 'CHATTING' && (
          <div className="p-6 bg-[#111] border-t border-white/5">
            <div className="flex gap-3">
              <input 
                ref={inputRef}
                type="text" 
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={isBotTyping}
                placeholder={isBotTyping ? "기다려주세요..." : "답변을 입력하고 Enter를 누르세요..."}
                className="flex-1 bg-black border border-white/10 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-emerald-500/50 transition-all"
              />
              <button 
                onClick={handleSend}
                disabled={!userInput.trim() || isBotTyping}
                className="size-14 rounded-2xl bg-emerald-500 text-black flex items-center justify-center hover:scale-105 transition-all shadow-lg disabled:opacity-30"
              >
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
