import { useState, useEffect } from 'react';
import { ScannerView } from './components/ScannerView';
import { MapView } from './components/MapView';
import { RecordsView } from './components/RecordsView';
import { DailyRouteView } from './components/DailyRouteView';
import { BottomNav } from './components/BottomNav';
import { AuthView } from './components/AuthView';
import { ProfileView } from './components/ProfileView';
import { loadModel } from './services/imageProcessing';
import { ScanEye } from 'lucide-react';
import { LoadingOverlay } from './components/LoadingOverlay';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'scanner' | 'map' | 'records' | 'profile' | 'dailyRoute'>('map');
  const [modelLoading, setModelLoading] = useState(true);
  const [mapVersion, setMapVersion] = useState(0);


  // Use localStorage to pretend we have a real session active
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => localStorage.getItem('isAuthenticated') === 'true'
  );

  useEffect(() => {
    const initApp = async () => {
      try {
        await loadModel();
      } catch (err) {
        console.error("Failed to load model", err);
      } finally {
        setModelLoading(false);
      }
    };
    initApp();

    // Setup history for hardware back button navigation
    window.history.replaceState({ tab: currentTab }, '');
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.tab) {
        setCurrentTab(e.state.tab);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // Intentionally leaving currentTab out of deps so it registers the initial handler

  const changeTab = (tab: 'scanner' | 'map' | 'records' | 'profile' | 'dailyRoute') => {
    if (tab === currentTab) return;
    window.history.pushState({ tab }, '');
    if (tab === 'map') setMapVersion(v => v + 1);
    setCurrentTab(tab);
  };



  if (modelLoading) {
    return (
      <LoadingOverlay
        title="Scanner"
        subtitle="Iniciando Motor de IA e Reconhecimento"
        icon={<ScanEye size={36} className="text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" />}
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
        {currentTab === 'map' && <MapView key={mapVersion} />}
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
        {currentTab === 'profile' && <ProfileView
          onLogout={() => setIsAuthenticated(false)}
          onBack={() => changeTab('map')}
        />}
      </div>
      <BottomNav currentTab={currentTab} setTab={changeTab} />


    </div>
  );
}
