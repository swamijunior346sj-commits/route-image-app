import { useState, useEffect } from 'react';
import { ScannerView } from './components/ScannerView';
import { MapView } from './components/MapView';
import { RecordsView } from './components/RecordsView';
import { BottomNav } from './components/BottomNav';
import { AuthView } from './components/AuthView';
import { ProfileView } from './components/ProfileView';
import { loadModel } from './services/imageProcessing';
import { ScanEye, Loader2 } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'scanner' | 'map' | 'records' | 'profile'>('map');
  const [modelLoading, setModelLoading] = useState(true);

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
  }, []);

  if (modelLoading) {
    return (
      <div className="w-full h-screen bg-[#020205] flex flex-col items-center justify-center text-white relative overflow-hidden">
        {/* Background Ambient Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-indigo-600/5 rounded-full blur-[100px] animate-spin-slow" />

        <div className="relative z-10 flex flex-col items-center">
          {/* AI Core Visual */}
          <div className="relative mb-12 group">
            <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
            <div className="relative w-32 h-32 rounded-[2.5rem] bg-zinc-950 border border-white/10 flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.2)]">
              <div className="absolute inset-2 border border-blue-500/20 rounded-[2rem] animate-spin-slow" />
              <ScanEye size={56} className="text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
            </div>

            {/* Orbitals */}
            <div className="absolute -top-4 -right-4 w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center animate-bounce">
              <Loader2 size={20} className="text-blue-400 animate-spin" />
            </div>
          </div>

          {/* Typography */}
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-black italic tracking-tighter uppercase">
              Scanner <span className="text-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">Visão</span>
            </h1>
            <div className="flex items-center gap-2 justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">Iniciando Motor de IA</p>
            </div>
          </div>

          {/* Progress Bar HUD */}
          <div className="mt-12 w-64 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
            <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full w-full animate-[loading_3s_ease-in-out_infinite] shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
          </div>

          <p className="mt-6 text-[8px] font-black text-zinc-700 uppercase tracking-[0.5em] italic">Protocolo de Segurança Ativo</p>
        </div>

        {/* Corner Decos */}
        <div className="absolute top-12 left-12 w-12 h-12 border-t-2 border-l-2 border-white/5 rounded-tl-2xl" />
        <div className="absolute bottom-12 right-12 w-12 h-12 border-b-2 border-r-2 border-white/5 rounded-br-2xl" />
      </div>
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
            onNavigateToMap={() => setCurrentTab('map')}
            onNavigateToRecords={() => setCurrentTab('records')}
          />
        )}
        {currentTab === 'map' && <MapView />}
        {currentTab === 'records' && <RecordsView />}
        {currentTab === 'profile' && <ProfileView onLogout={() => setIsAuthenticated(false)} />}
      </div>
      <BottomNav currentTab={currentTab} setTab={setCurrentTab} />
    </div>
  );
}
