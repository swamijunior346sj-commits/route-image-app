import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../services/db';
import type { AppSettings } from '../services/db';
import { LoadingOverlay } from './LoadingOverlay';

interface ProfileViewProps {
    onLogout: () => void;
    onBack?: () => void;
    onNavigateToAdmin?: () => void;
}

export const ProfileView = ({ onLogout, onBack, onNavigateToAdmin }: ProfileViewProps) => {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const s = await getSettings();
            setSettings(s);
            setLoading(false);
        };
        load();
    }, []);

    const handleLogout = () => {
        if (confirm("Deseja realmente sair da sua conta?")) {
            onLogout();
        }
    };

    const toggleSetting = async (category: 'notifications' | 'mapPreferences', field: string) => {
        if (!settings) return;
        const categoryData = settings[category] as any;
        const newCat = { ...categoryData, [field]: !categoryData[field] };
        const updated = await updateSettings({ ...settings, [category]: newCat } as AppSettings);
        setSettings(updated);
        if (navigator.vibrate) navigator.vibrate(10);
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !settings) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            const updated = await updateSettings({
                ...settings,
                personalData: { ...settings.personalData, avatar: base64 }
            });
            setSettings(updated);
        };
        reader.readAsDataURL(file);
    };

    if (loading || !settings) return <LoadingOverlay title="Acessando Perfil" subtitle="Carregando dados biométricos..." />;

    return (
        <div className="relative w-full h-full bg-bg-start overflow-hidden flex flex-col font-sans">
            <header className="fixed top-0 left-0 right-0 z-50 px-6 pt-12 pb-6 flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center justify-center size-10 rounded-full bg-white/5 border border-white/10 active:scale-95 transition-all text-white/90"
                >
                    <span className="material-symbols-outlined !text-[24px]">arrow_back_ios_new</span>
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black tracking-[0.3em] text-primary/80 mb-0.5">Gestão de Conta</span>
                    <h1 className="text-white font-black text-xl tracking-tighter italic">Meu Perfil</h1>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center justify-center size-10 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 active:scale-95 transition-all"
                >
                    <span className="material-symbols-outlined !text-[22px]">logout</span>
                </button>
            </header>

            <main className="flex-1 overflow-y-auto px-6 pt-32 pb-40 no-scrollbar">
                {/* Profile Header Card */}
                <section className="relative mb-10">
                    <div className="glass-card rounded-[3rem] p-8 flex flex-col items-center text-center overflow-hidden">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 blur-[60px] -mr-20 -mt-20"></div>

                        <div className="relative mb-6">
                            <label className="cursor-pointer block">
                                <div className="size-28 rounded-[2.5rem] bg-gradient-to-br from-primary via-accent to-white p-[2px] shadow-2xl relative">
                                    <div className="w-full h-full rounded-[2.5rem] bg-bg-start overflow-hidden flex items-center justify-center">
                                        {settings.personalData.avatar ? (
                                            <img src={settings.personalData.avatar} alt="User avatar" className="w-full h-full object-cover shrink-0" />
                                        ) : (
                                            <span className="text-4xl font-black text-white italic">{settings.personalData.name[0]}</span>
                                        )}
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 size-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg border-2 border-bg-start">
                                        <span className="material-symbols-outlined !text-[18px]">edit</span>
                                    </div>
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                            </label>
                        </div>

                        <h2 className="text-2xl font-black text-white tracking-tight uppercase italic">{settings.personalData.name}</h2>
                        <div className="flex items-center gap-2 mt-2 px-4 py-1.5 bg-white/5 rounded-full border border-white/5">
                            <span className="size-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] uppercase font-bold text-white/50 tracking-widest">Status Activo</span>
                        </div>
                    </div>
                </section>

                {/* Dashboard Stats */}
                <section className="grid grid-cols-3 gap-3 mb-10">
                    <div className="glass-card rounded-[1.5rem] p-4 flex flex-col items-center text-center">
                        <span className="text-2xl font-black text-white">4.9</span>
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Rating</span>
                    </div>
                    <div className="glass-card rounded-[1.5rem] p-4 flex flex-col items-center text-center">
                        <span className="text-2xl font-black text-white">1.2k</span>
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Entregas</span>
                    </div>
                    <div className="glass-card rounded-[1.5rem] p-4 flex flex-col items-center text-center">
                        <span className="text-2xl font-black text-white">124h</span>
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Tempo</span>
                    </div>
                </section>

                {/* Settings Group */}
                <section className="space-y-4">
                    <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-slate-500 ml-1 opacity-60">Configurações Gerais</h3>

                    <div className="glass-card rounded-[2.5rem] p-2 border-white/5 divide-y divide-white/5">
                        <div className="flex items-center justify-between p-4 px-6">
                            <div className="flex items-center gap-4">
                                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined !text-[20px]">notifications</span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white/90">Notificações Push</p>
                                    <p className="text-[10px] text-slate-500 font-medium capitalize">Alertas de novas rotas</p>
                                </div>
                            </div>
                            <button
                                onClick={() => toggleSetting('notifications', 'push')}
                                className={`w-12 h-6 rounded-full transition-all relative ${settings.notifications.push ? 'bg-primary shadow-[0_0_10px_rgba(59,130,246,0.6)]' : 'bg-white/10'}`}
                            >
                                <div className={`absolute top-1 size-4 rounded-full bg-white transition-all ${settings.notifications.push ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-4 px-6">
                            <div className="flex items-center gap-4">
                                <div className="size-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                    <span className="material-symbols-outlined !text-[20px]">dark_mode</span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white/90">Tema Escuro IA</p>
                                    <p className="text-[10px] text-slate-500 font-medium capitalize">Otimização de contraste</p>
                                </div>
                            </div>
                            <div className="text-slate-600">
                                <span className="material-symbols-outlined">check_circle</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 px-6">
                            <div className="flex items-center gap-4">
                                <div className="size-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                    <span className="material-symbols-outlined !text-[20px]">map</span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white/90">Navegação Integrada</p>
                                    <p className="text-[10px] text-slate-500 font-medium capitalize">Google Maps vs Waze</p>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-slate-600">chevron_right</span>
                        </div>
                    </div>
                </section>

                <section className="space-y-4 mt-8">
                    <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-red-500/60 ml-1 opacity-60">Administração</h3>
                    <button
                        onClick={onNavigateToAdmin}
                        className="w-full glass-card rounded-[2.5rem] p-4 px-6 border-white/5 flex items-center justify-between active:scale-[0.98] transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="size-10 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400 group-hover:bg-red-500/20 transition-colors">
                                <span className="material-symbols-outlined !text-[20px]">admin_panel_settings</span>
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-bold text-white/90">Painel ADM</p>
                                <p className="text-[10px] text-slate-500 font-medium capitalize">Controle de sistema • ERP</p>
                            </div>
                        </div>
                        <span className="material-symbols-outlined text-slate-600 group-hover:translate-x-1 transition-transform">chevron_right</span>
                    </button>
                </section>

                {/* Footer Info inside scrollable area */}
                <div className="pt-12 pb-20 text-center opacity-40">
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.5em]">RouteVision v.2.4.0 • 2024</p>
                </div>
            </main>

            {/* Nav Fade Overlay */}
            <nav className="fixed bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-bg-start via-bg-start/80 to-transparent pointer-events-none z-10"></nav>
        </div>
    );
};
