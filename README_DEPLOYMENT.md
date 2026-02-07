
# 🚀 Ai BuUp 배포 및 연동 가이드 (최종 점검 완료)

## 1. Supabase 설정 (필수)
1. [Supabase](https://supabase.com) 가입 후 새 프로젝트를 생성합니다.
2. **테이블 생성**: 좌측 메뉴의 **SQL Editor** -> **New query** 클릭 후, 프로젝트의 `DATABASE_SETUP.sql` 내용을 복사하여 실행(**Run**)합니다.
3. **이메일 인증 해제 (중요)**: 
   - **Authentication** > **Settings** > **Providers** > **Email** 섹션으로 이동.
   - **Confirm email** 스위치를 **OFF**로 끄고 저장합니다. (이 설정을 안 하면 로그인 시 "Email not confirmed" 에러가 발생합니다.)

## 2. 관리자 계정 생성 및 권한
1. 서비스 주소에서 **회원가입(Register)**을 진행합니다.
2. `DATABASE_SETUP.sql`에 설정된 대로, 아래 이메일로 가입하면 자동으로 **ADMIN** 권한이 부여됩니다:
   - `aibuup@aibuup.com`
   - `exp.gwonyoung.woo@gmail.com`

## 3. Cloudflare Pages 환경 변수 등록
Cloudflare Pages **Settings > Environment variables**에 다음 3개를 반드시 등록하고 **다시 배포**하세요:
- `VITE_SUPABASE_URL`: (Supabase 프로젝트 URL)
- `VITE_SUPABASE_ANON_KEY`: (Supabase Anon Key)
- `API_KEY`: (Google Gemini API Key)

## 4. 로그인 실패 시 체크리스트
- **Load failed 에러**: 환경 변수(`VITE_SUPABASE_URL`, `KEY`)가 오타 없이 Cloudflare에 등록되었는지 확인하세요.
- **가입은 되는데 로그인이 안 됨**: 위 1번의 **Confirm email** 설정을 껐는지 다시 확인하세요.
- **AI가 작동 안 함**: Cloudflare 설정에 `API_KEY`가 정확히 입력되었는지 확인하세요.
