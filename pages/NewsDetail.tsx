
import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MOCK_NEWS } from '../constants';
import { supabase, isConfigured } from '../lib/supabase';
import { NewsItem } from '../types';
import { UserContext } from '../App';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface NewsComment {
  id: string;
  author_name: string;
  role: string;
  text: string;
  created_at: string;
}

const NewsDetail: React.FC = () => {
  const { id } = useParams();
  const { user, profile } = useContext(UserContext);
  const [news, setNews] = useState<NewsItem | null>(null);
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [prevNews, setPrevNews] = useState<{ id: string; title: string } | null>(null);
  const [nextNews, setNextNews] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    fetchNewsDetail();
    fetchComments();
  }, [id]);

  const fetchNewsDetail = async () => {
    setLoading(true);
    if (!isConfigured) {
      const currentNews = MOCK_NEWS.find(n => n.id === id) || null;
      setNews(currentNews);
      
      if (currentNews) {
        const currentIndex = MOCK_NEWS.findIndex(n => n.id === id);
        setPrevNews(MOCK_NEWS[currentIndex - 1] || null);
        setNextNews(MOCK_NEWS[currentIndex + 1] || null);
      }
      
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setNews(data);

      if (data) {
        // 이전 뉴스 (더 과거의 뉴스)
        const { data: pData } = await supabase
          .from('news')
          .select('id, title')
          .lt('created_at', data.created_at)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setPrevNews(pData);

        // 다음 뉴스 (더 최신의 뉴스)
        const { data: nData } = await supabase
          .from('news')
          .select('id, title')
          .gt('created_at', data.created_at)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        setNextNews(nData);
      }
    } catch (err) {
      console.warn("Detailed news fetch failed");
      const fallbackNews = MOCK_NEWS.find(n => n.id === id) || null;
      setNews(fallbackNews);
      if (fallbackNews) {
        const currentIndex = MOCK_NEWS.findIndex(n => n.id === id);
        setPrevNews(MOCK_NEWS[currentIndex - 1] || null);
        setNextNews(MOCK_NEWS[currentIndex + 1] || null);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    if (!isConfigured || !id) return;
    try {
      const { data, error } = await supabase
        .from('news_comments')
        .select('*')
        .eq('news_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error('Comments fetch failed:', err);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user || !id || submitting) return;

    setSubmitting(true);
    try {
      const authorName = profile?.nickname || user?.email?.split('@')[0] || '익명의모험가';
      const authorRole = profile?.role || 'SILVER';

      const { data, error } = await supabase.from('news_comments').insert({
        news_id: id,
        user_id: user.id,
        author_name: authorName,
        role: authorRole,
        text: newComment
      }).select().single();

      if (error) throw error;
      setComments([data, ...comments]);
      setNewComment('');
    } catch (err) {
      console.error('Comment submission failed:', err);
      alert('댓글 작성 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'text-red-500 border-red-500/30 bg-red-500/10';
      case 'GOLD': return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10';
      default: return 'text-gray-400 border-white/10 bg-white/5';
    }
  };

  if (loading) return (
    <div className="pt-48 pb-32 min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="size-16 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-emerald-500 font-black tracking-[0.4em] text-[10px] uppercase animate-pulse">Decrypting Signal</p>
      </div>
    </div>
  );

  if (!news) return (
    <div className="pt-48 text-center min-h-screen bg-black px-6">
      <h2 className="text-4xl font-black mb-8 tracking-tighter">DATA UNAVAILABLE</h2>
      <p className="text-gray-500 mb-12">요청하신 뉴스가 삭제되었거나 존재하지 않습니다.</p>
      <Link to="/news" className="bg-emerald-500 text-black px-12 py-5 rounded-2xl font-black uppercase text-sm">Back to Feed</Link>
    </div>
  );

  return (
    <div className="pt-12 pb-32 min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        <Link to="/news" className="group text-gray-500 hover:text-emerald-400 transition-colors mb-16 inline-flex items-center gap-3 font-black uppercase tracking-[0.2em] text-[10px]">
          <span className="group-hover:-translate-x-2 transition-transform">←</span> Back to Archive
        </Link>
        
        <header className="mb-16">
          <div className="flex items-center gap-4 mb-10">
            <span className="bg-emerald-500/10 text-emerald-400 font-black uppercase text-[10px] tracking-widest px-4 py-1.5 rounded-full border border-emerald-500/20">
              {news.category}
            </span>
          </div>
          <h1 className="text-3xl md:text-7xl font-black tracking-tighter leading-[1.1] break-words">
            {news.title}
          </h1>
          <div className="mt-12 flex items-center gap-6 border-t border-white/5 pt-12">
            <div className="size-12 bg-neutral-800 rounded-full flex items-center justify-center font-black text-emerald-500">AB</div>
            <div className="flex flex-col">
              <span className="text-white font-bold">Ai BuUp Editorial</span>
              <span className="text-gray-500 text-xs">Senior Tech Analyst</span>
            </div>
          </div>
        </header>

        <div className="rounded-[2rem] md:rounded-[3.5rem] overflow-hidden mb-16 md:mb-20 shadow-2xl border border-white/10 relative group">
          <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <img src={news.image_url} alt={news.title} className="w-full h-auto object-cover max-h-[600px]" />
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="prose prose-invert prose-emerald max-w-none">
            <p className="text-xl md:text-3xl text-gray-200 leading-snug mb-12 md:mb-16 font-light italic border-l-4 border-emerald-500 pl-6 md:pl-8 break-words whitespace-pre-wrap">
              {news.summary}
            </p>
            <div className="text-base md:text-xl text-gray-400 leading-relaxed font-light break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {news.content}
              </ReactMarkdown>
            </div>
          </div>

          {/* 이전 뉴스 / 다음 뉴스 네비게이션 */}
          <div className="flex flex-col sm:flex-row gap-4 mt-20 mb-24">
            {prevNews ? (
              <Link 
                to={`/news/${prevNews.id}`} 
                className="flex-1 group bg-neutral-900/50 border border-white/5 p-6 rounded-3xl transition-all hover:border-emerald-500/30"
              >
                <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Previous News</div>
                <div className="text-sm font-bold text-gray-400 group-hover:text-emerald-400 transition-colors line-clamp-1">{prevNews.title}</div>
              </Link>
            ) : (
              <div className="flex-1 bg-neutral-900/10 border border-white/5 p-6 rounded-3xl opacity-30 cursor-not-allowed">
                <div className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-2">Previous News</div>
                <div className="text-sm font-bold text-gray-700 italic">No more items.</div>
              </div>
            )}

            {nextNews ? (
              <Link 
                to={`/news/${nextNews.id}`} 
                className="flex-1 group bg-neutral-900/50 border border-white/5 p-6 rounded-3xl text-right transition-all hover:border-emerald-500/30"
              >
                <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Next News</div>
                <div className="text-sm font-bold text-gray-400 group-hover:text-emerald-400 transition-colors line-clamp-1">{nextNews.title}</div>
              </Link>
            ) : (
              <div className="flex-1 bg-neutral-900/10 border border-white/5 p-6 rounded-3xl text-right opacity-30 cursor-not-allowed">
                <div className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-2">Next News</div>
                <div className="text-sm font-bold text-gray-700 italic">Latest news reached.</div>
              </div>
            )}
          </div>

          {/* 댓글 섹션 */}
          <section className="mt-24 pt-16 border-t border-white/10">
            <div className="flex items-center gap-4 mb-10">
              <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter">Reader Feedback</h3>
              <span className="text-emerald-500 font-bold text-sm px-3 py-1 bg-emerald-500/10 rounded-lg">{comments.length}</span>
            </div>

            <form onSubmit={handleCommentSubmit} className="mb-16 bg-neutral-900/50 border border-white/5 p-6 md:p-8 rounded-[2rem] shadow-xl">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={user ? "이 뉴스 트렌드에 대한 모험가님의 생각을 공유해 주세요." : "댓글을 작성하려면 로그인이 필요합니다."}
                disabled={!user || submitting}
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 md:p-6 text-white outline-none focus:border-emerald-500/50 transition-all min-h-[120px] mb-6 resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newComment.trim() || !user || submitting}
                  className="bg-white text-black font-black px-8 md:px-10 py-3 md:py-4 rounded-xl hover:bg-emerald-500 transition-all uppercase text-[10px] md:text-[11px] tracking-widest disabled:opacity-30"
                >
                  {submitting ? 'Sending...' : 'Post Thought'}
                </button>
              </div>
            </form>

            <div className="space-y-6">
              {comments.length > 0 ? comments.map((comment) => (
                <div key={comment.id} className="bg-neutral-900/30 border border-white/5 p-6 md:p-8 rounded-[2rem] transition-all hover:bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-black text-sm">{comment.author_name}</span>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-md border uppercase tracking-widest ${getRoleColor(comment.role)}`}>
                        {comment.role}
                      </span>
                    </div>
                    <span className="text-gray-600 text-[10px] font-bold">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed break-words">
                    {comment.text}
                  </p>
                </div>
              )) : (
                <div className="py-20 text-center border border-dashed border-white/5 rounded-[2.5rem]">
                  <p className="text-gray-600 font-black text-xs uppercase tracking-[0.3em]">No Thoughts Shared Yet</p>
                </div>
              )}
            </div>
          </section>

          <footer className="mt-20 md:mt-32 pt-16 border-t border-white/10">
            <div className="bg-neutral-900 border border-white/10 rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-20 text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <h4 className="text-2xl md:text-4xl font-black mb-6 tracking-tighter break-words relative z-10">이 트렌드에 대해 질문이 있나요?</h4>
              <p className="text-gray-400 mb-12 font-light text-base md:text-lg break-words relative z-10">커뮤니티의 전문가들이 실시간으로 답변해 드립니다.</p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 relative z-10">
                <Link 
                  to="/community" 
                  className="bg-emerald-500 text-black px-10 py-5 rounded-2xl font-black text-lg hover:bg-white transition-all shadow-xl shadow-emerald-500/20"
                >
                  커뮤니티 이동하기
                </Link>
                <Link 
                  to="/news" 
                  className="bg-white/5 border border-white/10 text-white px-10 py-5 rounded-2xl font-black text-lg hover:bg-white/10 transition-all"
                >
                  다른 뉴스 보기
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default NewsDetail;