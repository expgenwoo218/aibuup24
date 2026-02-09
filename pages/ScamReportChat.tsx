
import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, isConfigured } from '../lib/supabase';
import { UserContext } from '../App';

interface Message {
  id: number;
  sender: 'bot' | 'user';
  text: string;
  isTyping?: boolean;
}

const QUESTIONS = [
  "실행한 부업명이 무엇인가요?",
  "강의 비용은 얼마였나요?",
  "강의에서 무엇을 배웠나요? 생각나시는대로 서술해 주세요.",
  "강팔이가 제시한 장밋빛 미래를 문장으로 표현하면?",
  "모험가님이 실행한 결과는 어떠했나요?",
  "강팔이가 속았다고 생각하시나요?",
  "왜 그렇게 생각하시나요? 길게 써도 됩니다.",
  "이런 강팔이를 만났을 때, 주의할 사항을 한 수 가르쳐 주세요.",
  "자유롭게 하시고 싶은 말씀 부탁드려요."
];

const ScamReportChat: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useContext(UserContext);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, sender: 'bot', text: "안녕하세요. 강팔이 피해 사례 공유를 위한 정밀 분석 채팅방입니다. 🛡️" },
    { id: 2, sender: 'bot', text: "공유해주신 데이터는 익명으로 처리되며, 다른 분들의 추가 피해를 막는 강력한 방패가 됩니다." },
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [authorName, setAuthorName] = useState(profile?.nickname || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => {
      askQuestion(0);
    }, 1000);
  }, []);

  useEffect(() => {
    scrollToBottom();
    if (!isBotTyping && !isSubmitting) {
      inputRef.current?.focus();
    }
  }, [messages, isBotTyping, isSubmitting]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const askQuestion = (index: number) => {
    setIsBotTyping(true);
    setTimeout(() => {
      setIsBotTyping(false);
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        sender: 'bot', 
        text: QUESTIONS[index] 
      }]);
    }, 1200);
  };

  const handleSend = () => {
    if (!userInput.trim() || isSubmitting || isBotTyping) return;

    const newUserMsg: Message = { id: Date.now(), sender: 'user', text: userInput };
    const newAnswers = [...answers, userInput];
    
    setMessages(prev => [...prev, newUserMsg]);
    setAnswers(newAnswers);
    setUserInput('');

    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    if (currentStep < QUESTIONS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      askQuestion(nextStep);
    } else {
      handleFinalSubmission(newAnswers);
    }
  };

  const handleFinalSubmission = async (finalAnswers: string[]) => {
    setIsSubmitting(true);
    setIsBotTyping(true);
    
    setMessages(prev => [...prev, { 
      id: Date.now(), 
      sender: 'bot', 
      text: "제공해주신 데이터를 바탕으로 정밀 분석 리포트를 작성 중입니다... 🛡️" 
    }]);

    const reportContent = `
### ⚠️ [강팔이 피해 고발] 정밀 분석 리포트

**1. 피해 개요**
* **실행 부업:** ${finalAnswers[0]}
* **강의 비용:** ${finalAnswers[1]}

**2. 기망 기법 및 수법 분석**
* **강팔이의 주장:** "${finalAnswers[3]}"
* **주요 교육 내용:** ${finalAnswers[2]}

**3. 실제 피해 사실**
* **실행 결과:** ${finalAnswers[4]}
* **피해자 판단 사유:** ${finalAnswers[5]} (${finalAnswers[6]})

**4. 모험가 가이드 및 주의사항**
* **주의할 점:** ${finalAnswers[7]}
* **추가 의견:** ${finalAnswers[8]}

---
*본 리포트는 제보자의 실제 답변을 기반으로 구조화된 공익 제보 리포트입니다.*
    `.trim();

    try {
      const newPost: any = {
        title: `[피해사례] ${finalAnswers[0]} 관련 제보 리포트`,
        author: authorName || profile?.nickname || '익명의모험가',
        category: '강팔이피해사례',
        content: reportContent,
        result: '검증 완료: 사기 주의보',
        cost: finalAnswers[1],
        user_id: user?.id,
        created_at: new Date().toISOString(),
        likes: 0
      };

      if (isConfigured && user) {
        const { error } = await supabase.from('posts').insert([newPost]);
        if (error) throw error;
        refreshProfile();
      }

      setIsBotTyping(false);
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        sender: 'bot', 
        text: "데이터 분석이 완료되었습니다. 생성된 리포트는 게시판에 즉시 등록되었습니다. 🛡️ 당신의 용기 있는 제보에 감사드립니다." 
      }]);

      setTimeout(() => {
        navigate('/community?cat=강팔이피해사례');
      }, 2000);

    } catch (err: any) {
      console.error("Save Error:", err);
      navigate('/community?cat=강팔이피해사례');
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col pt-24 md:pt-32">
      <div className="flex-1 max-w-2xl mx-auto w-full flex flex-col px-4 md:px-0 mb-8 overflow-hidden rounded-[3rem] shadow-2xl border border-white/5 bg-black/40 backdrop-blur-xl">
        
        <div className="bg-[#2a2a2a] p-6 flex items-center justify-between z-20 border-b border-white/5">
          <div className="flex items-center gap-4">
            <Link to="/community" className="text-gray-500 hover:text-white transition-colors">
              <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <span className="text-emerald-500 text-xs font-black">LOG</span>
              </div>
              <div>
                <h2 className="text-white font-black text-sm tracking-tight flex items-center gap-2">
                  기록 도우미
                  <span className="flex size-2">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </h2>
                <p className="text-[10px] text-emerald-500/60 font-bold uppercase tracking-widest">Active Intelligence</p>
              </div>
            </div>
          </div>
          <div className="hidden sm:block text-right">
             <div className="text-[10px] font-black text-gray-600 uppercase mb-1 tracking-widest">Audit Progress</div>
             <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-emerald-500 transition-all duration-700 ease-out" 
                 style={{ width: `${((currentStep + 1) / QUESTIONS.length) * 100}%` }}
               />
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar min-h-[500px]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'} animate-[slideUp_0.3s_ease-out]`}>
              <div className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`px-5 py-3.5 rounded-[1.8rem] text-[14px] leading-relaxed shadow-lg ${
                  msg.sender === 'bot' 
                    ? 'bg-[#333] text-gray-200 rounded-tl-none border border-white/5' 
                    : 'bg-[#fee500] text-black font-semibold rounded-tr-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            </div>
          ))}
          
          {isBotTyping && (
            <div className="flex justify-start animate-pulse">
              <div className="bg-[#333] px-5 py-3 rounded-[1.8rem] rounded-tl-none flex gap-1 items-center border border-white/5">
                <div className="size-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="size-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="size-1.5 bg-gray-500 rounded-full animate-bounce"></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="bg-[#2a2a2a] p-6 space-y-4 shadow-2xl">
          {currentStep === 0 && !authorName && (
            <div className="animate-fadeIn bg-black/20 p-4 rounded-2xl border border-white/5">
               <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">당신의 모험가 닉네임</label>
               <input 
                 type="text"
                 placeholder="예: 깨어있는모험가"
                 value={authorName}
                 onChange={(e) => setAuthorName(e.target.value)}
                 className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/30"
               />
            </div>
          )}
          
          <div className="flex gap-3">
            <input 
              ref={inputRef}
              type="text" 
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isSubmitting ? "리포트 작성 중..." : "답변을 입력하세요..."}
              disabled={isSubmitting || isBotTyping}
              className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-emerald-500/50 transition-all placeholder:text-gray-600"
            />
            <button 
              onClick={handleSend}
              disabled={isSubmitting || !userInput.trim() || isBotTyping}
              className={`size-14 rounded-2xl flex items-center justify-center transition-all shadow-xl ${
                userInput.trim() && !isBotTyping ? 'bg-[#fee500] text-black scale-100' : 'bg-neutral-800 text-gray-600 scale-95 opacity-50'
              }`}
            >
              <svg className="size-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScamReportChat;
