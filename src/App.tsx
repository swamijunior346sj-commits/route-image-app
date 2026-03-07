import { useState, useEffect } from 'react';
import { loadModel } from './services/imageProcessing';
import { ScannerView } from './components/ScannerView';
import { SideNav } from './components/SideNav';
import { DailyRouteView } from './components/DailyRouteView';
import { SettingsView } from './components/SettingsView';
import { SubscriptionView } from './components/SubscriptionView';
import { AdminView } from './components/AdminView';
import { AuthView } from './components/AuthView';
import { getSettings, defaultSettings, type AppSettings } from './services/db';
import { supabase } from './services/supabase';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

import { ClonedHomeView } from './components/ClonedHomeView';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'home' | 'scanner' | 'dailyRoute'>('home');
  const [modelLoading, setModelLoading] = useState(true);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [lastTab, setLastTab] = useState<'home' | 'dailyRoute'>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [scannerInitialMode, setScannerInitialMode] = useState<'camera' | 'confirm'>('camera');
  const [scannerInitialAction, setScannerInitialAction] = useState<'camera' | 'import' | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isSideNavOpen, setIsSideNavOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => localStorage.getItem('isAuthenticated') === 'true'
  );
  const [routeKey, setRouteKey] = useState(0);

  useEffect(() => {
    const initApp = async () => {
      console.log("🚀 Iniciando RouteVision Cloned...");
      try {
        loadModel().catch(console.error);
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          setIsAuthenticated(true);
          const s = await getSettings();
          if (s) setSettings(s);
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error("Init error:", err);
      } finally {
        setModelLoading(false);
      }
    };
    initApp();

    // Failsafe timeout
    const timer = setTimeout(() => {
      setModelLoading(false);
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session);
      if (session) {
        const s = await getSettings();
        setSettings(s);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const changeTab = (tab: any, options?: any) => {
    if (tab !== 'scanner') {
      setLastTab(tab);
    }
    if (tab === 'scanner') {
      setScannerInitialMode(options?.scannerMode || 'camera');
      setScannerInitialAction(options?.initialAction || null);
    } else {
      setScannerInitialAction(null);
    }
    if (tab === 'home') {
      setRouteKey(prev => prev + 1);
    }
    setCurrentTab(tab);
  };

  const handleImportStops = () => {
    changeTab('scanner', { initialAction: 'import' });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('isAuthenticated');
    window.location.reload();
  };

  const handleSelectPlan = async (planId: 'free' | 'pro' | 'enterprise') => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ subscription_plan: planId })
      .eq('id', user.id);
    if (error) {
      console.error("Failed to update plan", error);
      alert("Erro ao processar plano. Tente novamente.");
      return;
    }
    const updatedSettings = await getSettings();
    setSettings(updatedSettings);
    setIsSubscriptionOpen(false);
    alert(`Parabéns! Você agora é um usuário ${planId.toUpperCase()}!`);
  };

  if (modelLoading) return (
    <div className="fixed inset-0 bg-white flex items-center justify-center">
      <div className="size-8 border-2 border-blue-100 border-t-blue-500 rounded-full animate-spin"></div>
    </div>
  );
  if (!isAuthenticated) return <AuthView onLogin={() => setIsAuthenticated(true)} />;

  return (
    <div className="w-full h-screen bg-white text-gray-900 overflow-hidden flex flex-col font-sans">

      {/* Main Viewport */}
      <div className="flex-1 w-full h-full relative">
        <div className={(currentTab === 'home' || (currentTab === 'scanner' && lastTab === 'home')) ? 'block h-full' : 'hidden'}>
          <ClonedHomeView
            key={routeKey}
            googleMapsApiKey={GOOGLE_MAPS_API_KEY}
            onOpenMenu={() => setIsSideNavOpen(true)}
            onAddStops={() => changeTab('scanner', { initialAction: 'camera' })}
            onImport={handleImportStops}
            onNavigateToDailyRoute={() => changeTab('dailyRoute')}
          />
        </div>



        <div className={(currentTab === 'dailyRoute' || (currentTab === 'scanner' && lastTab === 'dailyRoute')) ? 'block h-full' : 'hidden'}>
          <DailyRouteView
            onNavigateToMap={() => changeTab('home')}
            onNavigateToScanner={() => changeTab('scanner', { scannerMode: 'camera' })}
            onBack={() => changeTab('home')}
          />
        </div>

        {/* Global Scanner Overlay - Absolute Transparency Layer */}
        {currentTab === 'scanner' && (
          <div className="fixed inset-0 z-[10000]">
            <ScannerView
              onNavigateToDailyRoute={() => changeTab('dailyRoute')}
              onBack={() => changeTab('home')}
              initialViewMode={scannerInitialMode}
              initialAction={scannerInitialAction}
              onShowPaywall={() => setIsSubscriptionOpen(true)}
            />
          </div>
        )}
      </div>

      {isSettingsOpen && (
        <SettingsView
          onBack={() => setIsSettingsOpen(false)}
          onNavigateToAdmin={() => {
            setIsAdminOpen(true);
            setIsSettingsOpen(false);
          }}
          onLogout={handleLogout}
        />
      )}

      {isAdminOpen && <AdminView onBack={() => setIsAdminOpen(false)} />}

      <SideNav
        isOpen={isSideNavOpen}
        onClose={() => setIsSideNavOpen(false)}
        onLogout={handleLogout}
        onNavigateToAdmin={() => setIsSettingsOpen(true)}
        onAddStops={() => changeTab('scanner', { initialAction: 'camera' })}
        onNavigateToHome={() => changeTab('home')}
      />

      {isSubscriptionOpen && (
        <SubscriptionView
          onBack={() => setIsSubscriptionOpen(false)}
          currentPlan={settings?.subscriptionPlan}
          onSelectPlan={handleSelectPlan}
        />
      )}

    </div>
  );
}
