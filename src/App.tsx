import { useState, useEffect } from 'react';
import { ScannerView } from './components/ScannerView';
import { MapView } from './components/MapView';
import { RecordsView } from './components/RecordsView';
import { DailyRouteView } from './components/DailyRouteView';
import { BottomNav } from './components/BottomNav';
import { AuthView } from './components/AuthView';
import { ProfileView } from './components/ProfileView';
import { loadModel } from './services/imageProcessing';
import { LoadingOverlay } from './components/LoadingOverlay';
import { AdminView } from './components/AdminView';
import { supabase } from './services/supabase';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const ADMIN_EMAIL = 'admin@admin.com';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'scanner' | 'map' | 'records' | 'profile' | 'dailyRoute'>('map');
  const [modelLoading, setModelLoading] = useState(true);
  const [mapVersion, setMapVersion] = useState(0);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Use localStorage to pretend we have a real session active
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => localStorage.getItem('isAuthenticated') === 'true'
  );

  useEffect(() => {
    const initApp = async () => {
      try {
        await loadModel();
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        if (session) setIsAuthenticated(true);
      } catch (err) {
        console.error("Failed to load model", err);
      } finally {
        setModelLoading(false);
      }
    };
    initApp();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      const isAuth = !!session;
      setIsAuthenticated(isAuth);
      if (isAuth) localStorage.setItem('isAuthenticated', 'true');
      else localStorage.removeItem('isAuthenticated');
    });

    // Setup history for hardware back button navigation
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.tab) {
        setCurrentTab(e.state.tab);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const changeTab = (tab: 'scanner' | 'map' | 'records' | 'profile' | 'dailyRoute') => {
    if (tab === currentTab) return;
    window.history.pushState({ tab }, '');
    if (tab === 'map') setMapVersion(v => v + 1);
    setCurrentTab(tab);
  };



  if (modelLoading) {
    return (
      <LoadingOverlay
        title="Protocolo RouteVision"
        subtitle="Iniciando Motores de IA e Reconhecimento Neural"
        icon={<span className="material-symbols-outlined !text-[44px] text-primary drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]">center_focus_weak</span>}
      />
    );
  }

  if (!isAuthenticated) {
    return <AuthView onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden flex flex-col font-sans">
      <div className="flex-1 w-full h-full relative">
        {currentTab === 'scanner' && (
          <ScannerView
            onNavigateToMap={() => changeTab('map')}
            onNavigateToDailyRoute={() => changeTab('dailyRoute')}
          />
        )}
        {currentTab === 'map' && <MapView key={mapVersion} googleMapsApiKey={GOOGLE_MAPS_API_KEY} />}
        {currentTab === 'records' && (
          <RecordsView
            onNavigateToMap={() => changeTab('map')}
            onBack={() => changeTab('map')}
          />
        )}
        {currentTab === 'dailyRoute' && (
          <DailyRouteView
            onNavigateToMap={() => changeTab('map')}
            onBack={() => changeTab('map')}
          />
        )}
        {currentTab === 'profile' && (
          <ProfileView
            onLogout={async () => {
              await supabase.auth.signOut();
              localStorage.removeItem('isAuthenticated');
              setIsAuthenticated(false);
            }}
            onBack={() => changeTab('map')}
            onNavigateToAdmin={user?.email === ADMIN_EMAIL ? () => setIsAdminOpen(true) : undefined}
            isAdmin={user?.email === ADMIN_EMAIL}
          />
        )}
      </div>
      {!isAdminOpen && <BottomNav currentTab={currentTab} setTab={changeTab} />}

      {isAdminOpen && (
        <AdminView onBack={() => setIsAdminOpen(false)} />
      )}


    </div>
  );
}
