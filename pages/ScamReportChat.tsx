
import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, isConfigured } from '../lib/supabase';
import { UserContext } from '../App';

interface Message {
  id: number;
  sender: 'bot' | 'user';
  text: string;
}

const ScamReportChat: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useContext(UserContext);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, sender: 'bot', text: "안녕하세요. 강팔이 피해 사례 정밀 분석 채팅방입니다. 🛡️" },
    { id: 2, sender: 'bot', text: "당신의 소중한 경험 데이터는 제2의 피해자를 막는 강력한 증거가 됩니다." },
  ]);
  const [dynamicQuestions, setDynamicQuestions] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const { data } = await supabase.from('chat_questions')
        .select('question_text')
        .eq('category', '강팔이피해사례')
        .order('order_index', { ascending: true });
      
      const qs = (data && data.length > 0) 
        ? data.map(q => q.question_text) 
        : ["부업명을 적어주세요.", "피해 내용을 적어주세요."];
      
      setDynamicQuestions(qs);
      setTimeout(() => askQuestion(0, qs), 1000);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    scrollToBottom();
    if (!isBotTyping && !isSubmitting) {
      inputRef.current?.focus();
    }
  }, [messages, isBotTyping]);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  };

  const askQuestion = (index: number, qs: string[]) => {
    setIsBotTyping(true);
    setTimeout(() => {
      setIsBotTyping(false);
      setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: qs[index] }]);
    }, 1000);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userInput.trim() || isSubmitting || isBotTyping) return;
    
    const currentInput = userInput;
    const newAnswers = [...answers, currentInput];
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: currentInput }]);
    setAnswers(newAnswers);
    setUserInput('');

    // 전송 즉시 포커스 유지
    inputRef.current?.focus();

    if (currentStep < dynamicQuestions.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      askQuestion(nextStep, dynamicQuestions);
    } else {
      handleFinalSubmissionDirectly(newAnswers);
    }
  };

  const handleFinalSubmissionDirectly = async (finalAnswers: string[]) => {
    setIsSubmitting(true);
    setIsBotTyping(true);
    
    let reportContent = `## 🛡️ 강팔이 피해 제보 데이터\n\n`;
    dynamicQuestions.forEach((question, index) => {
      reportContent += `### ❗ ${question}\n> ${finalAnswers[index] || 'No Response'}\n\n`;
    });

    const postData = {
      title: `[고발] ${finalAnswers[0]} 피해 사례 제보`,
      author: profile?.nickname || '익명모험가',
      category: '강팔이피해사례',
      content: reportContent,
      result: 'Investigation Initiated',
      cost: finalAnswers[1] || '0',
      user_id: user?.id,
      created_at: new Date().toISOString()
    };

    try {
      if (isConfigured) {
        const { error } = await supabase.from('posts').insert([postData]);
        if (error) throw error;
        refreshProfile();
      }
      setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: "데이터 접수가 완료되었습니다. 정의를 위해 사용하겠습니다. 🛡️" }]);
      setTimeout(() => navigate('/community?cat=강팔이피해사례'), 1500);
    } catch (err) {
      console.error("Save Error:", err);
      navigate('/community');
    } finally {
      setIsBotTyping(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1a1a1a] flex flex-col pt-20 md:pt-32">
      <div className="flex-1 max-w-2xl mx-auto w-full flex flex-col bg-black/40 backdrop-blur-xl md:rounded-t-[3rem] border-x border-t border-white/5 overflow-hidden relative shadow-2xl">
        
        {/* 헤더 */}
        <div className="bg-[#2a2a2a] p-4 md:p-6 border-b border-white/5 flex items-center justify-between z-30 shrink-0">
          <div className="flex items-center gap-4">
            <Link to="/community" className="text-gray-500 hover:text-white transition-colors">
              <svg className="size-5 md:size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <div className="flex flex-col">
              <h2 className="text-white font-black text-xs md:text-sm flex items-center gap-2">피해 수사 도우미 <span className="size-1.5 bg-red-500 rounded-full animate-ping"></span></h2>
              <p className="text-[8px] text-red-500 font-bold uppercase tracking-widest">Criminal Intelligence</p>
            </div>
          </div>
        </div>

        {/* 채팅 영역 */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 no-scrollbar scroll-smooth"
        >
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'} animate-slideUp`}>
              <div className={`max-w-[85%] px-5 py-3 rounded-[1.5rem] text-xs md:text-sm leading-relaxed shadow-lg ${msg.sender === 'bot' ? 'bg-[#333] text-gray-200 rounded-tl-none border border-white/5' : 'bg-red-500 text-white font-bold rounded-tr-none'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isBotTyping && (
            <div className="flex justify-start">
              <div className="bg-[#333] px-5 py-3 rounded-[1.5rem] flex gap-1 items-center border border-white/5">
                <div className="size-1 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="size-1 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="size-1 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} className="h-4 w-full" />
        </div>

        {/* 하단 고정 컨트롤 */}
        <div className="bg-[#2a2a2a] border-t border-white/5 shrink-0 z-40">
          {/* 현재 질문 가이드 (키보드 바로 위에 고정) */}
          {!isSubmitting && dynamicQuestions.length > 0 && (
            <div className="px-4 py-2 bg-red-500/5 border-b border-red-500/10">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest shrink-0">Report Task</span>
                <p className="text-[11px] text-gray-400 font-medium truncate italic">
                  {dynamicQuestions[currentStep]}
                </p>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSend} className="p-4 flex gap-3">
            <input 
              ref={inputRef} 
              type="text" 
              value={userInput} 
              onChange={(e) => setUserInput(e.target.value)} 
              onFocus={() => {
                setTimeout(scrollToBottom, 300);
              }}
              placeholder={isSubmitting ? "Processing..." : "내용을 입력하세요..."} 
              disabled={isSubmitting || isBotTyping}
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-5 py-3.5 text-sm text-white outline-none focus:border-red-500/50 transition-all"
            />
            <button 
              type="submit"
              disabled={isSubmitting || !userInput.trim() || isBotTyping} 
              className="size-12 md:size-14 rounded-xl bg-red-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-30"
            >
              <svg className="size-5 md:size-6" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ScamReportChat;
