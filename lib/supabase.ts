
import { createClient } from '@supabase/supabase-js';

// Vite 환경 변수(import.meta.env)와 일반 환경 변수(process.env)를 모두 지원하도록 구성
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
