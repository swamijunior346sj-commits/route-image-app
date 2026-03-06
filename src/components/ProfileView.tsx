import { useState, useEffect } from 'react';
import { ChevronLeft, LogOut, Check, Bike, Star, Clock, CreditCard, Bell, Eye, Moon, Navigation, ChevronRight } from 'lucide-react';
import { getSettings, updateSettings } from '../services/db';
import type { AppSettings } from '../services/db';
import { LoadingOverlay } from './LoadingOverlay';

interface ProfileViewProps {
    onLogout: () => void;
    onBack?: () => void;
}

export const ProfileView = ({ onLogout, onBack }: ProfileViewProps) => {
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
            localStorage.removeItem('isAuthenticated');
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

    if (loading || !settings) return (
        <LoadingOverlay
            title="Sincronizando Perfil"
            subtitle="Carregando estatísticas e preferências..."
        />
    );

    return (
        <div className="fixed inset-0 bg-bg-deep flex flex-col font-sans overflow-x-hidden pb-12 overflow-y-auto no-scrollbar">
            {/* Header Banner Section */}
            <div className="relative h-72 w-full overflow-hidden shrink-0">
                <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary/20 rounded-full blur-[80px]"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-64 h-64 bg-accent/10 rounded-full blur-[80px]"></div>

                <div className="absolute inset-0 pt-10 px-6 flex flex-col items-center justify-start bg-white/[0.02] backdrop-blur-xl border-b border-white/5">
                    {/* Back Button */}
                    <button
                        onClick={onBack}
                        className="absolute top-10 left-6 size-11 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/90 active:scale-90 transition-all"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div className="relative group">
                        <label className="cursor-pointer block">
                            <div className="size-24 rounded-full border-2 border-primary/30 p-1 bg-white/5 shadow-2xl relative overflow-hidden group">
                                {settings.personalData.avatar ? (
                                    <img alt="Perfil" className="w-full h-full rounded-full object-cover group-hover:opacity-75 transition-opacity" src={settings.personalData.avatar} />
                                ) : (
                                    <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                                        <span className="text-3xl font-black text-primary">{settings.personalData.name?.charAt(0) || 'R'}</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold uppercase tracking-widest">Alterar</div>
                            </div>
                            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                        </label>
                        <div className="absolute bottom-0 right-0 size-7 bg-primary rounded-full border-2 border-[#0F172A] flex items-center justify-center shadow-lg">
                            <Check size={14} className="text-white font-bold" />
                        </div>
                    </div>
                    <h2 className="mt-4 text-2xl font-bold text-white tracking-tight">{settings.personalData.name || 'Ricardo Oliveira'}</h2>
                    <p className="text-sm font-medium text-slate-400">Entregador Premium • Nível 4</p>
                </div>
            </div>

            <main className="px-6 -mt-10 relative z-10 space-y-8 pb-20">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] p-5 flex flex-col justify-between h-32 shadow-xl">
                        <Bike size={24} className="text-primary" />
                        <div>
                            <p className="text-[22px] font-bold text-white">482</p>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Entregas/Mês</p>
                        </div>
                    </div>
                    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] p-5 flex flex-col justify-between h-32 shadow-xl">
                        <Star size={24} className="text-emerald-400" />
                        <div>
                            <p className="text-[22px] font-bold text-white">4.98</p>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Avaliação</p>
                        </div>
                    </div>
                    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] p-5 flex flex-col justify-between h-32 shadow-xl">
                        <Clock size={24} className="text-amber-400" />
                        <div>
                            <p className="text-[22px] font-bold text-white">124h</p>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tempo Online</p>
                        </div>
                    </div>
                    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] p-5 flex flex-col justify-between h-32 shadow-xl">
                        <CreditCard size={24} className="text-blue-400" />
                        <div>
                            <p className="text-[22px] font-bold text-white">R$ 3.2k</p>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ganhos</p>
                        </div>
                    </div>
                </div>

                {/* Vehicle Section */}
                <section className="space-y-4">
                    <h3 className="text-[13px] font-bold uppercase tracking-widest text-slate-400 ml-1">Veículo Principal</h3>
                    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex items-center gap-5 shadow-xl group active:scale-[0.98] transition-all">
                        <div className="size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
                            <span className="material-symbols-outlined !text-3xl text-primary font-light">two_wheeler</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-white font-bold text-base">{settings.personalData.vehicle || 'Honda CB 500X'}</p>
                            <p className="text-slate-400 text-sm">Placa: ABC-1234 • Cor: Cinza</p>
                        </div>
                        <ChevronRight size={20} className="text-slate-600 group-hover:text-primary transition-colors" />
                    </div>
                </section>

                {/* Settings Section */}
                <section className="space-y-4">
                    <h3 className="text-[13px] font-bold uppercase tracking-widest text-slate-400 ml-1">Configurações</h3>
                    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2.5rem] divide-y divide-white/5 shadow-2xl">
                        {/* Notifications Toggle */}
                        <div className="flex items-center justify-between p-6">
                            <div className="flex items-center gap-4">
                                <Bell size={20} className="text-slate-400" />
                                <span className="text-[15px] font-medium text-white/90">Notificações Push</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('notifications', 'push')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${settings.notifications.push ? 'bg-primary shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-white/10'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${settings.notifications.push ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Invisible Mode (Mapped to a placeholder toggle) */}
                        <div className="flex items-center justify-between p-6">
                            <div className="flex items-center gap-4">
                                <Eye size={20} className="text-slate-400" />
                                <span className="text-[15px] font-medium text-white/90">Modo Invisível</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('notifications', 'haptic')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${settings.notifications.haptic ? 'bg-primary shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-white/10'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${settings.notifications.haptic ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Dark Mode Toggle */}
                        <div className="flex items-center justify-between p-6">
                            <div className="flex items-center gap-4">
                                <Moon size={20} className="text-slate-400" />
                                <span className="text-[15px] font-medium text-white/90">Tema Escuro Automático</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('mapPreferences', 'darkMode')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${settings.mapPreferences.darkMode ? 'bg-primary shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-white/10'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${settings.mapPreferences.darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Route Optimization Toggle */}
                        <div className="flex items-center justify-between p-6">
                            <div className="flex items-center gap-4">
                                <Navigation size={20} className="text-slate-400" />
                                <span className="text-[15px] font-medium text-white/90">Otimização de Rota</span>
                            </div>
                            <button
                                onClick={() => toggleSetting('mapPreferences', 'autoCenter')}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${settings.mapPreferences.autoCenter ? 'bg-primary shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-white/10'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${settings.mapPreferences.autoCenter ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>
                </section>

                <button
                    onClick={handleLogout}
                    className="w-full py-6 text-red-400 font-bold text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 transition-all opacity-80 hover:opacity-100"
                >
                    <LogOut size={20} />
                    Sair da Conta
                </button>
            </main>
        </div>
    );
};
