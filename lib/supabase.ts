
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.45.0';

// Vite 환경 변수(import.meta.env)와 일반 환경 변수(process.env)를 모두 지원하도록 구성
// Use 'as any' to bypass TypeScript errors when 'env' is not defined on ImportMeta
const supabaseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || 
                    (typeof process !== 'undefined' && (process as any).env?.VITE_SUPABASE_URL) || 
                    '';

const supabaseAnonKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 
                        (typeof process !== 'undefined' && (process as any).env?.VITE_SUPABASE_ANON_KEY) || 
                        '';

// 설정 여부 확인 로직 (공백이거나 placeholder인 경우 false)
export const isConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  supabaseUrl !== '' &&
  supabaseAnonKey !== 'placeholder' &&
  supabaseAnonKey !== ''
);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);
