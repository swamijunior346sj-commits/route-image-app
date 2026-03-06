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
import { SubscriptionView } from './components/SubscriptionView';
import { supabase } from './services/supabase';
import { getSettings, type AppSettings, defaultSettings } from './services/db';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const ADMIN_EMAIL = 'admin@admin.com';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'scanner' | 'map' | 'records' | 'profile' | 'dailyRoute'>('map');
  const [modelLoading, setModelLoading] = useState(true);
  const [mapVersion, setMapVersion] = useState(0);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [scannerInitialMode, setScannerInitialMode] = useState<'dashboard' | 'camera'>('dashboard');
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  // Use localStorage to pretend we have a real session active
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => localStorage.getItem('isAuthenticated') === 'true'
  );

  useEffect(() => {
    const initApp = async () => {
      console.log("🚀 Iniciando RouteVision...");
      try {
        // Run model loading in background to not block the main UI
        console.log("📦 Disparando modelos IA no background...");
        loadModel().then(() => console.log("✅ Modelos IA Carregados!")).catch(e => console.error("❌ Erro no carregamento do modelo:", e));

        console.log("🔑 Verificando sessão...");
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("❌ Erro na sessão:", sessionError);
        }

        if (session) {
          console.log("👤 Usuário logado detected:", session.user.email);
          setUser(session.user);
          setIsAuthenticated(true);

          console.log("⚙️ Carregando configurações...");
          try {
            const s = await getSettings();
            if (s) setSettings(s);
          } catch (e) {
            console.warn("⚠️ Falha ao carregar configurações, seguindo com padrão", e);
          }
        } else {
          console.log("📢 Nenhuma sessão ativa encontrada.");
          setIsAuthenticated(false);
          localStorage.removeItem('isAuthenticated');
        }
      } catch (err) {
        console.error("❌ Erro fatal na inicialização:", err);
      } finally {
        console.log("✅ Finalizando estado de carregamento.");
        setModelLoading(false);
      }
    };
    initApp();

    // Failsafe: Force stop loading after 5 seconds no matter what
    const timeout = setTimeout(() => {
      setModelLoading(false);
    }, 5000);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      const isAuth = !!session;
      setIsAuthenticated(isAuth);
      if (isAuth) {
        localStorage.setItem('isAuthenticated', 'true');
        const s = await getSettings();
        setSettings(s);
      }
      else {
        localStorage.removeItem('isAuthenticated');
        setSettings(defaultSettings);
      }
    });

    // Setup history for hardware back button navigation
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.tab) {
        setCurrentTab(e.state.tab);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const changeTab = (tab: 'scanner' | 'map' | 'records' | 'profile' | 'dailyRoute', options?: { scannerMode?: 'dashboard' | 'camera', showSubModal?: boolean }) => {
    if (options?.showSubModal) {
      setIsSubscriptionOpen(true);
      return;
    }
    if (tab === currentTab && !options?.scannerMode) return;
    window.history.pushState({ tab }, '');
    if (tab === 'map') setMapVersion(v => v + 1);
    if (tab === 'scanner') setScannerInitialMode(options?.scannerMode || 'dashboard');
    setCurrentTab(tab);
  };

  const handleSelectPlan = async (planId: 'free' | 'pro' | 'enterprise') => {
    if (!user) return;

    // 1. Update in profiles table in Supabase
    const { error } = await supabase
      .from('profiles')
      .update({ subscription_plan: planId })
      .eq('id', user.id);

    if (error) {
      console.error("Failed to update plan", error);
      alert("Erro ao processar plano. Tente novamente.");
      return;
    }

    // 2. Refresh settings locally
    const updatedSettings = await getSettings();
    setSettings(updatedSettings);
    setIsSubscriptionOpen(false);
    alert(`Parabéns! Você agora é um usuário ${planId.toUpperCase()}!`);
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
            initialViewMode={scannerInitialMode}
            onShowPaywall={() => setIsSubscriptionOpen(true)}
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
            onNavigateToScanner={() => changeTab('scanner', { scannerMode: 'camera' })}
            onBack={() => changeTab('map')}
          />
        )}
        {currentTab === 'profile' && (
          <ProfileView
            onLogout={async () => {
              console.log("👋 Encerrando sessão...");
              try {
                // Pre-clear state to be fast
                setIsAuthenticated(false);
                setUser(null);
                setSettings(defaultSettings);
                localStorage.removeItem('isAuthenticated');

                await supabase.auth.signOut();
              } catch (e) {
                console.error("Logout error:", e);
              } finally {
                // Ensure everything is clean
                window.location.reload();
              }
            }}
            onBack={() => changeTab('map')}
            onNavigateToAdmin={user?.email === ADMIN_EMAIL ? () => setIsAdminOpen(true) : undefined}
            isAdmin={user?.email === ADMIN_EMAIL}
            settings={settings}
            onUpdateSettings={setSettings}
          />
        )}
      </div>
      {!isAdminOpen && <BottomNav currentTab={currentTab} setTab={changeTab} />}

      {isAdminOpen && (
        <AdminView onBack={() => setIsAdminOpen(false)} />
      )}

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
