import { useState } from 'react';
import { updateSettings, clearAllUserData } from '../services/db';
import type { AppSettings } from '../services/db';
import { LoadingOverlay } from './LoadingOverlay';

interface ProfileViewProps {
    onLogout: () => void;
    onBack?: () => void;
    onNavigateToAdmin?: () => void;
    isAdmin?: boolean;
    settings: AppSettings;
    onUpdateSettings: (s: AppSettings) => void;
}

export const ProfileView = ({ onLogout, onBack, onNavigateToAdmin, isAdmin, settings, onUpdateSettings }: ProfileViewProps) => {
    const [loading] = useState(false);

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
        onUpdateSettings(updated);
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
            onUpdateSettings(updated);
        };
        reader.readAsDataURL(file);
    };

    if (loading) return <LoadingOverlay title="Acessando Perfil" subtitle="Carregando dados biométricos..." />;

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
                <div className="size-10"></div>
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
                                            <span className="text-4xl font-black text-white italic">
                                                {settings.personalData.name ? settings.personalData.name[0].toUpperCase() : 'U'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 size-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg border-2 border-bg-start">
                                        <span className="material-symbols-outlined !text-[18px]">edit</span>
                                    </div>
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                            </label>
                        </div>

                        <h2 className="text-2xl font-black text-white tracking-tight uppercase italic">{settings.personalData.name || 'Usuário'}</h2>
                        <div className="flex items-center gap-3 mt-4">
                            <span className="px-3 py-1 bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl border border-primary/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                                Plano {settings.subscriptionPlan}
                            </span>
                            <div className="flex items-center gap-1.5 opacity-60">
                                <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                <span className="text-[10px] uppercase font-bold text-white tracking-widest">Activo</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Dashboard Stats */}
                <section className="grid grid-cols-3 gap-3 mb-10">
                    <div className="glass-card rounded-[1.5rem] p-4 flex flex-col items-center text-center">
                        <span className="text-2xl font-black text-white">---</span>
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Rating</span>
                    </div>
                    <div className="glass-card rounded-[1.5rem] p-4 flex flex-col items-center text-center">
                        <span className="text-2xl font-black text-white">0</span>
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Entregas</span>
                    </div>
                    <div className="glass-card rounded-[1.5rem] p-4 flex flex-col items-center text-center">
                        <span className="text-2xl font-black text-white">0h</span>
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
                                    <span className="material-symbols-outlined !text-[20px]">{settings.mapPreferences.darkMode ? 'dark_mode' : 'light_mode'}</span>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white/90">Tema Escuro</p>
                                    <p className="text-[10px] text-slate-500 font-medium capitalize">Otimização de contraste</p>
                                </div>
                            </div>
                            <button
                                onClick={() => toggleSetting('mapPreferences', 'darkMode')}
                                className={`w-12 h-6 rounded-full transition-all relative ${settings.mapPreferences.darkMode ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]' : 'bg-white/10'}`}
                            >
                                <div className={`absolute top-1 size-4 rounded-full bg-white transition-all ${settings.mapPreferences.darkMode ? 'left-7' : 'left-1'}`}></div>
                            </button>
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

                {isAdmin && (
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
                )}

                {/* Account Actions */}
                <section className="space-y-4 mt-12 mb-20">
                    <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-slate-500 ml-1 opacity-60">Ações Destrutivas</h3>

                    <button
                        onClick={async () => {
                            if (confirm("ATENÇÃO: Isso apagará TODOS os seus endereços, rotas e configurações. O processo é irreversível. Deseja continuar?")) {
                                await clearAllUserData();
                                window.location.reload();
                            }
                        }}
                        className="w-full glass-card rounded-[2.5rem] p-5 px-6 border-red-500/10 flex items-center justify-between active:scale-[0.98] transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="size-10 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                                <span className="material-symbols-outlined !text-[20px]">delete_forever</span>
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-bold text-red-500/90">Limpar Todos os Dados</p>
                                <p className="text-[10px] text-red-500/40 font-medium capitalize">Reset total da conta • Manter Login</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={handleLogout}
                        className="w-full glass-card rounded-[2.5rem] p-5 px-6 border-white/5 flex items-center justify-between active:scale-[0.98] transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="size-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/50">
                                <span className="material-symbols-outlined !text-[20px]">logout</span>
                            </div>
                            <div className="text-left">
                                <p className="text-sm font-bold text-white/90">Sair da Conta</p>
                                <p className="text-[10px] text-slate-500 font-medium capitalize">Encerrar sessão no dispositivo</p>
                            </div>
                        </div>
                        <span className="material-symbols-outlined text-slate-600">chevron_right</span>
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
