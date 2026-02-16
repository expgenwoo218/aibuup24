
import React from 'react';
import { Link } from 'react-router-dom';
import { BOARD_CATEGORIES, VIP_CATEGORIES } from '../constants';

const Sitemap: React.FC = () => {
  const allBoardCategories = [...BOARD_CATEGORIES, ...VIP_CATEGORIES];

  return (
    <div className="pt-32 pb-32 min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6">
        <header className="mb-20">
          <span className="text-emerald-500 font-black uppercase text-[10px] tracking-[0.4em] mb-4 block">Archive Directory</span>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic">Sitemap</h1>
          <p className="text-gray-500 mt-6 text-lg font-light max-w-2xl">
            Ai BuUp 서비스의 모든 경로를 한눈에 확인하실 수 있습니다. <br />
            이 페이지는 검색 엔진 로봇이 사이트의 전체 구조를 완벽하게 인덱싱하도록 돕습니다.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16">
          {/* Main Services */}
          <section className="space-y-6">
            <h2 className="text-emerald-500 font-black text-xs uppercase tracking-widest border-b border-emerald-500/20 pb-4">Main Navigation</h2>
            <ul className="space-y-4">
              <li><Link to="/" className="text-gray-300 hover:text-white transition-colors font-bold text-sm">홈 화면 (Home)</Link></li>
              <li><Link to="/about" className="text-gray-300 hover:text-white transition-colors font-bold text-sm">설립취지 (About Us)</Link></li>
              <li><Link to="/news" className="text-gray-300 hover:text-white transition-colors font-bold text-sm">Ai News Feed</Link></li>
              <li><Link to="/community" className="text-gray-300 hover:text-white transition-colors font-bold text-sm">커뮤니티 광장 (Community)</Link></li>
              <li><Link to="/vetting" className="text-gray-300 hover:text-white transition-colors font-bold text-sm">검증 리포트 (Vetting)</Link></li>
            </ul>
          </section>

          {/* Community Categories */}
          <section className="space-y-6">
            <h2 className="text-emerald-500 font-black text-xs uppercase tracking-widest border-b border-emerald-500/20 pb-4">Board Categories</h2>
            <ul className="space-y-4">
              {allBoardCategories.map(cat => (
                <li key={cat.id}>
                  <Link to={`/community?cat=${cat.name}`} className="text-gray-400 hover:text-emerald-400 transition-colors text-sm">
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* User & Support */}
          <section className="space-y-6">
            <h2 className="text-emerald-500 font-black text-xs uppercase tracking-widest border-b border-emerald-500/20 pb-4">Account & Help</h2>
            <ul className="space-y-4">
              <li><Link to="/contact" className="text-gray-300 hover:text-white transition-colors font-bold text-sm">고객지원 (Contact)</Link></li>
              <li><Link to="/login" className="text-gray-400 hover:text-white transition-colors text-sm">로그인 (Login)</Link></li>
              <li><Link to="/register" className="text-gray-400 hover:text-white transition-colors text-sm">회원가입 (Join)</Link></li>
              <li><Link to="/community/scam-chat" className="text-red-500/70 hover:text-red-500 transition-colors text-sm font-bold">강팔이 피해 신고</Link></li>
            </ul>
          </section>
        </div>

        <div className="mt-32 p-12 bg-neutral-900/50 border border-white/5 rounded-[3rem] text-center">
          <p className="text-gray-600 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Search Engine Optimization</p>
          <p className="text-gray-500 text-xs italic leading-relaxed">
            본 사이트는 구글 및 네이버 검색 엔진 가이드라인을 준수하며, <br />
            SPA(Single Page Application) 환경에서도 완벽한 크롤링을 지원하기 위해 이 페이지를 제공합니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Sitemap;
