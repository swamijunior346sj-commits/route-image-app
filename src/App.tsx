import { useState, useEffect } from 'react';
import { ScannerView } from './components/ScannerView';
import { MapView } from './components/MapView';
import { RecordsView } from './components/RecordsView';
import { BottomNav } from './components/BottomNav';
import { AuthView } from './components/AuthView';
import { ProfileView } from './components/ProfileView';
import { loadModel } from './services/imageProcessing';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'scanner' | 'map' | 'records' | 'profile'>('scanner');
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
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">Scanner Visão</h2>
        <p className="text-zinc-400 text-sm mt-2">Inicializando Motor de Inteligência Artificial...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthView onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden flex flex-col font-sans">
      <div className="flex-1 w-full h-full relative">
        {currentTab === 'scanner' && <ScannerView />}
        {currentTab === 'map' && <MapView />}
        {currentTab === 'records' && <RecordsView />}
        {currentTab === 'profile' && <ProfileView onLogout={() => setIsAuthenticated(false)} />}
      </div>
      <BottomNav currentTab={currentTab} setTab={setCurrentTab} />
    </div>
  );
}
