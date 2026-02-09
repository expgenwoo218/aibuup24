
-- 11. 대화형 질문 관리 테이블
CREATE TABLE IF NOT EXISTS public.chat_questions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    category text NOT NULL,
    question_text text NOT NULL,
    order_index integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.chat_questions ENABLE ROW LEVEL SECURITY;

-- 정책 설정
DROP POLICY IF EXISTS "Anyone can view chat questions" ON public.chat_questions;
CREATE POLICY "Anyone can view chat questions" ON public.chat_questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage chat questions" ON public.chat_questions;
CREATE POLICY "Admins can manage chat questions" ON public.chat_questions FOR ALL USING (public.is_admin());

-- 초기 데이터 삽입 (기존 질문들 마이그레이션)
-- 일반 질문들
INSERT INTO public.chat_questions (category, question_text, order_index) VALUES 
('Ai부업경험담', '공유해주실 부업이나 프로젝트의 ''제목''을 정해주세요.', 0),
('Ai부업경험담', '이 부업을 시작하게 된 계기나 배경은 무엇인가요?', 1),
('Ai부업경험담', '주로 어떤 도구(AI 툴, 플랫폼 등)를 사용하셨나요?', 2),
('Ai부업경험담', '하루 평균 투자 시간과 월 발생 비용은 어느 정도인가요?', 3),
('Ai부업경험담', '지금까지의 성과(수익이나 결과)를 솔직하게 알려주세요.', 4),
('Ai부업경험담', '이 부업을 다른 분들에게 추천하시나요? 그 이유와 함께 장단점을 알려주세요.', 5),
('Ai부업경험담', '마지막으로 이 길을 걷고자 하는 다른 모험가분들에게 한마디 부탁드립니다.', 6);

-- 강팔이 피해 질문들
INSERT INTO public.chat_questions (category, question_text, order_index) VALUES 
('강팔이피해사례', '실행한 부업명이 무엇인가요?', 0),
('강팔이피해사례', '강의 비용은 얼마였나요?', 1),
('강팔이피해사례', '강의에서 무엇을 배웠나요? 주요 커리큘럼을 알려주세요.', 2),
('강팔이피해사례', '강팔이가 제시한 가장 달콤한 약속(수익 등)은 무엇이었나요?', 3),
('강팔이피해사례', '실제로 실행했을 때 어떤 결과가 나왔나요?', 4),
('강팔이피해사례', '강팔이의 주법 중 가장 의심스러운 부분은 무엇이었나요?', 5),
('강팔이피해사례', '다른 피해자가 나오지 않도록 핵심 주의사항을 한 문장으로 정의한다면?', 6),
('강팔이피해사례', '마지막으로 하고 싶은 말씀이 있다면 적어주세요.', 7);
