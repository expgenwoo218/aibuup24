
import React, { useEffect, useState, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import AboutUs from './pages/AboutUs';
import AboutDetail from './pages/AboutDetail';
import Community from './pages/Community';
import CommunityDetail from './pages/CommunityDetail';
import CommunityWrite from './pages/CommunityWrite';
import CommunityDirectWrite from './pages/CommunityDirectWrite';
import ScamReportChat from './pages/ScamReportChat';
import Contact from './pages/Contact';
import VettingReport from './pages/VettingReport';
import Login from './pages/Login';
import Register from './pages/Register';
import Admin from './pages/Admin';
import News from './pages/News';
import NewsDetail from './pages/NewsDetail';
import { supabase, isConfigured } from './lib/supabase';

export const UserContext = createContext<{user: any, profile: any, refreshProfile: () => void}>({user: null, profile: null, refreshProfile: () => {}});

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const Navbar = () => {
  const location = useLocation();
  const { user, profile } = useContext(UserContext);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (e) {
      console.error("Logout error", e);
    }
  };
  
  const getLinkStyles = (path: string) => {
    const isActive = path === '/' ? location.pathname === '/' : location.pathname.includes(path);
    return `px-5 py-2 rounded-full border transition-all duration-300 whitespace-nowrap font-black text-[11px] md:text-[13px] uppercase tracking-wider ${
      isActive 
        ? 'text-emerald-400 border-emerald-500/50 bg-emerald-500/20' 
        : 'text-gray-400 border-white/5 bg-white/5 hover:border-emerald-500/30 hover:text-emerald-300'
    }`;
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-black/80 backdrop-blur-3xl border-b border-white/5 flex flex-col">
      <div className="flex items-center justify-between px-6 md:px-12 pt-6 pb-2 w-full max-w-[1920px] mx-auto">
        <Link to="/" className="text-xl md:text-2xl font-black tracking-tighter text-white hover:text-emerald-400 transition-colors shrink-0">
          Ai BuUp
        </Link>
        <div className="flex items-center gap-4 md:gap-8">
          {profile && (
            <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
              profile.role === 'ADMIN' ? 'bg-red-500/10 border-red-500/50 text-red-500' :
              profile.role === 'GOLD' ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500' : 'bg-white/5 border-white/10 text-gray-500'
            }`}>
              {profile.role} GRADE
            </div>
          )}
          <Link to="/contact" className="text-gray-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em]">Contact</Link>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-[10px] text-gray-500 font-bold uppercase">{profile?.nickname || user.email?.split('@')[0]}</span>
              <button onClick={handleLogout} className="bg-white/5 border border-white/10 text-gray-300 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-white hover:text-black transition-all">Logout</button>
            </div>
          ) : (
            <Link to="/login" className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-2 rounded-xl transition-all shadow-xl shadow-emerald-500/20 text-[11px] font-black uppercase">Login</Link>
          )}
        </div>
      </div>

      <div className="flex justify-center items-center gap-2 md:gap-4 py-5 px-4 overflow-x-auto no-scrollbar">
        <Link to="/about" className={getLinkStyles('/about')}>MISSION</Link>
        <Link to="/news" className={getLinkStyles('/news')}>TRENDS</Link>
        <Link to="/community" className={getLinkStyles('/community')}>COMMUNITY</Link>
        {profile?.role === 'ADMIN' && <Link to="/admin" className={getLinkStyles('/admin')}>ADMIN</Link>}
      </div>
    </nav>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (!error && data) setProfile(data);
    } catch (e) {
      console.error("Profile fetch error", e);
    }
  };

  useEffect(() => {
    if (!isConfigured) return;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, profile, refreshProfile: () => user && fetchProfile(user.id) }}>
      <HashRouter>
        <ScrollToTop />
        <div className="min-h-screen bg-black text-white selection:bg-emerald-500/30">
          <Navbar />
          <main className="pt-28 md:pt-36">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<AboutUs />} />
              <Route path="/about/:id" element={<AboutDetail />} />
              <Route path="/news" element={<News />} />
              <Route path="/news/:id" element={<NewsDetail />} />
              <Route path="/community" element={<Community />} />
              <Route path="/community/:id" element={<CommunityDetail />} />
              <Route path="/community/write" element={<CommunityWrite />} />
              <Route path="/community/direct-write" element={<CommunityDirectWrite />} />
              <Route path="/community/scam-chat" element={<ScamReportChat />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/vetting" element={<VettingReport />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </main>
          
          {!isConfigured && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-lg">
              <div className="bg-red-500/10 backdrop-blur-xl border border-red-500/20 p-6 rounded-3xl shadow-2xl flex items-center gap-6 animate-bounce">
                <div className="size-12 rounded-2xl bg-red-500 flex items-center justify-center text-2xl shrink-0">⚠️</div>
                <div className="flex-1">
                  <h4 className="text-white font-black text-xs uppercase tracking-widest mb-1">Configuration Required</h4>
                  <p className="text-gray-400 text-[10px] leading-relaxed break-keep">
                    수퍼베이스 환경 변수가 설정되지 않았습니다. Cloudflare 설정에서 URL과 KEY를 입력해주세요.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </HashRouter>
    </UserContext.Provider>
  );
};

export default App;
