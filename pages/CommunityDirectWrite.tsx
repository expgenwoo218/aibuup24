
import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { BOARD_CATEGORIES, VIP_CATEGORIES } from '../constants';
import { supabase, isConfigured } from '../lib/supabase';
import { UserContext } from '../App';
import { BoardCategoryType } from '../types';

const CommunityDirectWrite: React.FC = () => {
  const { user, profile } = useContext(UserContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const isEdit = !!id;

  const [formData, setFormData] = useState({
    title: '',
    category: 'Ai부업경험담' as BoardCategoryType,
    tool: '',
    cost: '',
    dailyTime: '',
    result: '',
    content: ''
  });

  const isGold = profile?.role === 'GOLD' || profile?.role === 'ADMIN';

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (isEdit) {
      fetchPostForEdit();
    }
  }, [id]);

  const fetchPostForEdit = async () => {
    if (!isConfigured || !id) return;
    setFetching(true);
    try {
      const { data, error } = await supabase.from('posts').select('*').eq('id', id).single();
      if (error) throw error;
      if (data) {
        // 권한 확인: 작성자 본인 혹은 관리자만 수정 가능
        if (data.user_id !== user?.id && profile?.role !== 'ADMIN') {
          alert('수정 권한이 없습니다.');
          navigate('/community');
          return;
        }
        setFormData({
          title: data.title,
          category: data.category as BoardCategoryType,
          tool: data.tool || '',
          cost: data.cost || '',
          dailyTime: data.daily_time || '',
          result: data.result || '',
          content: data.content
        });
      }
    } catch (err) {
      console.error('Fetch post error:', err);
      alert('데이터를 불러오지 못했습니다.');
      navigate('/community');
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.title.trim() || !formData.content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    const isVipCat = VIP_CATEGORIES.some(v => v.name === formData.category);
    if (isVipCat && !isGold) {
      alert('고수의 방 카테고리는 GOLD 등급 이상만 작성 가능합니다.');
      return;
    }

    setLoading(true);

    try {
      const postData: any = {
        title: formData.title,
        category: formData.category,
        content: formData.content,
        tool: formData.tool,
        cost: formData.cost,
        daily_time: formData.dailyTime,
        result: formData.result,
      };

      if (!isEdit) {
        postData.author = profile?.nickname || user?.email?.split('@')[0] || '익명';
        postData.user_id = user?.id;
        postData.created_at = new Date().toISOString();
        postData.likes = 0;
      }

      if (isConfigured && user) {
        if (isEdit) {
          const { error } = await supabase.from('posts').update(postData).eq('id', id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('posts').insert([postData]);
          if (error) throw error;
        }
      }

      alert(isEdit ? '리포트가 성공적으로 수정되었습니다.' : '리포트가 성공적으로 등록되었습니다.');
      navigate(`/community?cat=${formData.category}`);
    } catch (err: any) {
      console.error('Save error:', err);
      alert(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-emerald-500 font-black animate-pulse">RECOVERING INTELLIGENCE...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-32 pb-32 px-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <Link to="/community" className="text-gray-500 hover:text-emerald-500 transition-colors text-[10px] font-black uppercase tracking-widest mb-4 inline-block">← Back to Archives</Link>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic mb-4">{isEdit ? 'Edit Archive' : 'Manual Archive'}</h1>
          <p className="text-gray-500 text-sm md:text-base font-light break-keep">{isEdit ? '기존 리포트 데이터를 수정하여 최신화합니다.' : 'AI의 도움 없이 모험가님의 지식을 직접 데이터베이스에 기록합니다.'}</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8 animate-fadeIn">
          <div className="bg-neutral-900/50 border border-white/5 rounded-[2.5rem] p-8 md:p-12 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Archive Title</label>
                <input 
                  type="text" required
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-emerald-500/50 transition-all text-white"
                  placeholder="리포트 제목을 입력하세요"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Archive Category</label>
                <select 
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value as BoardCategoryType})}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-emerald-500/50 transition-all text-white appearance-none"
                >
                  <optgroup label="일반 게시판" className="bg-neutral-900">
                    {BOARD_CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="고수의 방 (GOLD+)" className="bg-neutral-900">
                    {VIP_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.name} disabled={!isGold}>{cat.name} {!isGold && '(권한필요)'}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Tool Used</label>
                <input type="text" value={formData.tool} onChange={e => setFormData({...formData, tool: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:border-emerald-500/30 outline-none" placeholder="예: Midjourney" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Investment</label>
                <input type="text" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:border-emerald-500/30 outline-none" placeholder="예: 월 3만원" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Time (Daily)</label>
                <input type="text" value={formData.dailyTime} onChange={e => setFormData({...formData, dailyTime: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:border-emerald-500/30 outline-none" placeholder="예: 2시간" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Final Verdict</label>
                <input type="text" value={formData.result} onChange={e => setFormData({...formData, result: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:border-emerald-500/30 outline-none" placeholder="예: 강력 추천" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Detailed Intelligence (Markdown Support)</label>
              <textarea 
                required
                value={formData.content}
                onChange={e => setFormData({...formData, content: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-8 py-6 outline-none focus:border-emerald-500/50 transition-all text-white h-[400px] resize-none leading-relaxed text-base"
                placeholder="# 제목을 입력하고 본문을 작성하세요.&#10;&#10;마크다운 문법을 지원합니다. (###, **, - 등)"
              />
            </div>
          </div>

          <div className="flex gap-4">
             <button 
               type="submit" 
               disabled={loading}
               className="flex-1 bg-emerald-500 text-black font-black py-5 rounded-2xl hover:bg-white transition-all uppercase text-sm tracking-[0.2em] shadow-2xl shadow-emerald-500/20 disabled:opacity-50"
             >
               {loading ? 'Archiving...' : isEdit ? 'Update Intelligence Report' : 'Publish Intelligence Report'}
             </button>
             <button 
               type="button" 
               onClick={() => navigate(isEdit ? `/community/${id}` : '/community')}
               className="px-10 py-5 border border-white/10 text-gray-500 font-black rounded-2xl hover:text-white transition-all uppercase text-sm"
             >
               Cancel
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CommunityDirectWrite;
