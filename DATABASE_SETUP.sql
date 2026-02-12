
-- 1. 회원 프로필 테이블 생성
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email text NOT NULL,
    nickname text,
    role text DEFAULT 'SILVER' CHECK (role IN ('ADMIN', 'GOLD', 'SILVER')),
    created_at timestamptz DEFAULT now()
);

-- 2. 관리자 확인을 위한 보안 정의자 함수 (RLS 무한 루프 방지)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 회원가입 시 자동으로 profiles에 기본 정보를 삽입하는 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    assigned_role text;
BEGIN
  -- 특정 관리자 이메일 목록에 있으면 ADMIN 부여
  IF new.email IN ('aibuup@aibuup.com', 'exp.gwonyoung.woo@gmail.com') THEN
    assigned_role := 'ADMIN';
  ELSE
    assigned_role := 'SILVER';
  END IF;

  INSERT INTO public.profiles (id, email, nickname, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1)), 
    assigned_role
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 트리거 설정
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. 게시글 테이블
CREATE TABLE IF NOT EXISTS public.posts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    title text NOT NULL,
    author text NOT NULL,
    category text NOT NULL,
    content text NOT NULL,
    result text,
    daily_time text,
    likes integer DEFAULT 0,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    tool text,
    cost text,
    score integer DEFAULT 5
);

-- 6. 댓글 테이블 (커뮤니티용)
CREATE TABLE IF NOT EXISTS public.comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name text NOT NULL,
    role text DEFAULT 'SILVER',
    text text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 7. 뉴스 테이블
CREATE TABLE IF NOT EXISTS public.news (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    title text NOT NULL,
    category text NOT NULL,
    date text NOT NULL,
    summary text NOT NULL,
    content text NOT NULL,
    image_url text NOT NULL
);

-- 8. 연락처 테이블
CREATE TABLE IF NOT EXISTS public.contacts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    name text NOT NULL,
    email text NOT NULL,
    message text NOT NULL
);

-- 11. 대화형 질문 관리 테이블 (추가됨)
CREATE TABLE IF NOT EXISTS public.chat_questions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    category text NOT NULL,
    question_text text NOT NULL,
    order_index integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- 12. 뉴스 댓글 테이블 (추가됨)
CREATE TABLE IF NOT EXISTS public.news_comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    news_id uuid REFERENCES public.news(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name text NOT NULL,
    role text DEFAULT 'SILVER',
    text text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 9. 보안 정책 (RLS) 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;

-- 10. 정책 설정

-- Profiles 정책
DROP POLICY IF EXISTS "Public profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- Posts 정책
DROP POLICY IF EXISTS "Posts viewable by everyone" ON public.posts;
CREATE POLICY "Posts viewable by everyone" ON public.posts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users insert posts" ON public.posts;
CREATE POLICY "Authenticated users insert posts" ON public.posts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users modify own posts" ON public.posts;
CREATE POLICY "Users modify own posts" ON public.posts FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- Comments 정책
DROP POLICY IF EXISTS "Comments viewable by everyone" ON public.comments;
CREATE POLICY "Comments viewable by everyone" ON public.comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users insert comments" ON public.comments;
CREATE POLICY "Authenticated users insert comments" ON public.comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users modify own comments" ON public.comments;
CREATE POLICY "Users modify own comments" ON public.comments FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- News 정책
DROP POLICY IF EXISTS "News viewable by everyone" ON public.news;
CREATE POLICY "News viewable by everyone" ON public.news FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage news" ON public.news;
CREATE POLICY "Admins manage news" ON public.news FOR ALL USING (public.is_admin());

-- Contacts 정책
DROP POLICY IF EXISTS "Anyone can insert contacts" ON public.contacts;
CREATE POLICY "Anyone can insert contacts" ON public.contacts FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can view contacts" ON public.contacts;
CREATE POLICY "Admins can view contacts" ON public.contacts FOR SELECT USING (public.is_admin());

-- Chat Questions 정책
DROP POLICY IF EXISTS "Anyone can view chat questions" ON public.chat_questions;
CREATE POLICY "Anyone can view chat questions" ON public.chat_questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage chat questions" ON public.chat_questions;
CREATE POLICY "Admins can manage chat questions" ON public.chat_questions FOR ALL USING (public.is_admin());

-- News Comments 정책 (추가됨)
DROP POLICY IF EXISTS "News comments viewable by everyone" ON public.news_comments;
CREATE POLICY "News comments viewable by everyone" ON public.news_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users insert news comments" ON public.news_comments;
CREATE POLICY "Authenticated users insert news comments" ON public.news_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users/Admins manage own news comments" ON public.news_comments;
CREATE POLICY "Users/Admins manage own news comments" ON public.news_comments FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- 초기 데이터 삽입 (기존 질문들 마이그레이션)
INSERT INTO public.chat_questions (category, question_text, order_index) VALUES 
('Ai부업경험담', '공유해주실 부업이나 프로젝트의 ''제목''을 정해주세요.', 0),
('Ai부업경험담', '이 부업을 시작하게 된 계기나 배경은 무엇인가요?', 1),
('Ai부업경험담', '주로 어떤 도구(AI 툴, 플랫폼 등)를 사용하셨나요?', 2),
('Ai부업경험담', '하루 평균 투자 시간과 월 발생 비용은 어느 정도인가요?', 3),
('Ai부업경험담', '지금까지의 성과(수익이나 결과)를 솔직하게 알려주세요.', 4),
('Ai부업경험담', '이 부업을 다른 분들에게 추천하시나요? 그 이유와 함께 장단점을 알려주세요.', 5),
('Ai부업경험담', '마지막으로 이 길을 걷고자 하는 다른 모험가분들에게 한마디 부탁드립니다.', 6),
('강팔이피해사례', '실행한 부업명이 무엇인가요?', 0),
('강팔이피해사례', '강의 비용은 얼마였나요?', 1),
('강팔이피해사례', '강의에서 무엇을 배웠나요? 주요 커리큘럼을 알려주세요.', 2),
('강팔이피해사례', '강팔이가 제시한 가장 달콤한 약속(수익 등)은 무엇이었나요?', 3),
('강팔이피해사례', '실제로 실행했을 때 어떤 결과가 나왔나요?', 4),
('강팔이피해사례', '강팔이의 주법 중 가장 의심스러운 부분은 무엇이었나요?', 5),
('강팔이피해사례', '다른 피해자가 나오지 않도록 핵심 주의사항을 한 문장으로 정의한다면?', 6),
('강팔이피해사례', '마지막으로 하고 싶은 말씀이 있다면 적어주세요.', 7);
