
import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, isConfigured } from '../lib/supabase';
import { UserContext } from '../App';

interface Message {
  id: number;
  sender: 'bot' | 'user';
  text: string;
}

const QUESTIONS = [
  "실행한 부업명이 무엇인가요?",
  "강의 비용은 얼마였나요?",
  "강의에서 무엇을 배웠나요? 주요 커리큘럼을 알려주세요.",
  "강팔이가 제시한 가장 달콤한 약속(수익 등)은 무엇이었나요?",
  "실제로 실행했을 때 어떤 결과가 나왔나요?",
  "강팔이의 주법 중 가장 의심스러운 부분은 무엇이었나요?",
  "다른 피해자가 나오지 않도록 핵심 주의사항을 한 문장으로 정의한다면?",
  "마지막으로 하고 싶은 말씀이 있다면 적어주세요."
];

const ScamReportChat: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useContext(UserContext);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, sender: 'bot', text: "안녕하세요. 강팔이 피해 사례 정밀 분석 채팅방입니다. 🛡️" },
    { id: 2, sender: 'bot', text: "당신의 소중한 경험 데이터는 제2의 피해자를 막는 강력한 증거가 됩니다." },
  ]);
  const [currentStep, setCurrentStep] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => askQuestion(0), 1000);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (!isBotTyping && !isSubmitting) inputRef.current?.focus();
  }, [messages, isBotTyping]);

  const askQuestion = (index: number) => {
    setIsBotTyping(true);
    setTimeout(() => {
      setIsBotTyping(false);
      setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: QUESTIONS[index] }]);
    }, 1000);
  };

  const handleSend = () => {
    if (!userInput.trim() || isSubmitting || isBotTyping) return;
    const currentInput = userInput;
    const newAnswers = [...answers, currentInput];
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: currentInput }]);
    setAnswers(newAnswers);
    setUserInput('');

    if (currentStep < QUESTIONS.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      askQuestion(nextStep);
    } else {
      handleFinalSubmissionDirectly(newAnswers);
    }
  };

  const handleFinalSubmissionDirectly = async (finalAnswers: string[]) => {
    setIsSubmitting(true);
    setIsBotTyping(true);
    
    // AI 대신 질문과 답변을 구조화된 마크다운으로 결합
    let reportContent = `## 🛡️ 강팔이 피해 제보 데이터\n\n`;
    QUESTIONS.forEach((question, index) => {
      reportContent += `### ❗ ${question}\n> ${finalAnswers[index] || '답변 없음'}\n\n`;
    });

    const postData = {
      title: `[고발] ${finalAnswers[0]} 피해 사례 제보`,
      author: profile?.nickname || '익명모험가',
      category: '강팔이피해사례',
      content: reportContent,
      result: '피해 접수 완료',
      cost: finalAnswers[1],
      user_id: user?.id,
      created_at: new Date().toISOString()
    };

    try {
      if (isConfigured) {
        const { error } = await supabase.from('posts').insert([postData]);
        if (error) throw error;
        refreshProfile();
      }
      setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: "피해 데이터 접수가 완료되었습니다. 게시판에 등록했습니다. 🛡️" }]);
      setTimeout(() => navigate('/community?cat=강팔이피해사례'), 1500);
    } catch (err) {
      console.error("Save Error:", err);
      alert("데이터 저장 중 오류가 발생했습니다.");
      navigate('/community');
    } finally {
      setIsBotTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col pt-24 md:pt-32">
      <div className="flex-1 max-w-2xl mx-auto w-full flex flex-col px-4 md:px-0 mb-8 overflow-hidden rounded-[3rem] shadow-2xl border border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="bg-[#2a2a2a] p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-4">
            <Link to="/community" className="text-gray-500 hover:text-white"><svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg></Link>
            <div>
              <h2 className="text-white font-black text-sm flex items-center gap-2">피해 수사 도우미 <span className="size-2 bg-red-500 rounded-full animate-ping"></span></h2>
              <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">Criminal Intelligence</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar min-h-[500px]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'} animate-slideUp`}>
              <div className={`px-5 py-3.5 rounded-[1.8rem] text-sm leading-relaxed shadow-lg ${msg.sender === 'bot' ? 'bg-[#333] text-gray-200 rounded-tl-none border border-white/5' : 'bg-red-500 text-white font-bold rounded-tr-none'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isBotTyping && (
            <div className="flex justify-start">
              <div className="bg-[#333] px-5 py-3 rounded-[1.8rem] flex gap-1 items-center border border-white/5">
                <div className="size-1.5 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="size-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="size-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="bg-[#2a2a2a] p-6">
          <div className="flex gap-3">
            <input 
              ref={inputRef} type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isSubmitting ? "데이터 기록 중..." : "답변을 입력하세요..."} disabled={isSubmitting || isBotTyping}
              className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-red-500/50"
            />
            <button onClick={handleSend} disabled={isSubmitting || !userInput.trim() || isBotTyping} className="size-14 rounded-2xl bg-red-500 text-white flex items-center justify-center hover:scale-105 transition-all shadow-xl disabled:opacity-30">
              <svg className="size-6" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScamReportChat;
