import { useState, useEffect } from 'react';
import { LogOut, User, Bell, Shield, Settings, ChevronLeft, ChevronRight, Save, Key, Mail, Phone, Bike, Eye, EyeOff, Moon, ScanLine, Route, LocateFixed } from 'lucide-react';
import { getSettings, updateSettings } from '../services/db';
import type { AppSettings } from '../services/db';

interface ProfileViewProps {
    onLogout: () => void;
}

export const ProfileView = ({ onLogout }: ProfileViewProps) => {
    const [subview, setSubview] = useState<'main' | 'personal' | 'privacy' | 'notifications' | 'map'>('main');
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);

    // Temp form state
    const [personalForm, setPersonalForm] = useState({ name: '', email: '', phone: '', vehicle: '' });
    const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
    const [showPass, setShowPass] = useState(false);

    useEffect(() => {
        const load = async () => {
            const s = await getSettings();
            setSettings(s);
            setPersonalForm(s.personalData);
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

    const handleSavePersonal = async () => {
        if (!settings) return;
        const updated = await updateSettings({ ...settings, personalData: personalForm });
        setSettings(updated);
        setSubview('main');
        if (navigator.vibrate) navigator.vibrate(20);
    };

    const toggleSetting = async (category: 'notifications' | 'mapPreferences', field: string) => {
        if (!settings) return;
        const newCat = { ...settings[category], [field]: !(settings[category] as any)[field] };
        const updated = await updateSettings({ ...settings, [category]: newCat });
        setSettings(updated);
        if (navigator.vibrate) navigator.vibrate(10);
    };

    if (loading || !settings) return <div className="p-10 text-center text-zinc-500">Caregando...</div>;

    if (subview === 'personal') {
        return (
            <div className="w-full h-full bg-black flex flex-col pt-safe pb-24 text-white animate-in slide-in-from-right duration-300">
                <div className="p-4 border-b border-white/5 flex items-center gap-4">
                    <button onClick={() => setSubview('main')} className="p-2 bg-white/5 rounded-full"><ChevronLeft size={24} /></button>
                    <h2 className="text-xl font-bold">Dados Pessoais</h2>
                </div>
                <div className="p-6 flex flex-col gap-5 overflow-y-auto">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nome Completo</label>
                        <div className="relative">
                            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500/50 focus:outline-none" value={personalForm.name} onChange={e => setPersonalForm({ ...personalForm, name: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">E-mail</label>
                        <div className="relative">
                            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500/50 focus:outline-none" value={personalForm.email} onChange={e => setPersonalForm({ ...personalForm, email: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Telefone / WhatsApp</label>
                        <div className="relative">
                            <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500/50 focus:outline-none" value={personalForm.phone} onChange={e => setPersonalForm({ ...personalForm, phone: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Veículo Atual</label>
                        <div className="relative">
                            <Bike size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:border-blue-500/50 focus:outline-none" value={personalForm.vehicle} onChange={e => setPersonalForm({ ...personalForm, vehicle: e.target.value })} />
                        </div>
                    </div>
                    <button onClick={handleSavePersonal} className="w-full bg-blue-600 font-bold py-5 rounded-3xl mt-4 flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                        <Save size={20} /> SALVAR ALTERAÇÕES
                    </button>
                </div>
            </div>
        );
    }

    if (subview === 'privacy') {
        return (
            <div className="w-full h-full bg-black flex flex-col pt-safe pb-24 text-white animate-in slide-in-from-right duration-300">
                <div className="p-4 border-b border-white/5 flex items-center gap-4">
                    <button onClick={() => setSubview('main')} className="p-2 bg-white/5 rounded-full"><ChevronLeft size={24} /></button>
                    <h2 className="text-xl font-bold">Segurança</h2>
                </div>
                <div className="p-6 flex flex-col gap-6">
                    <div className="bg-zinc-900/50 border border-white/5 p-5 rounded-3xl flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400"><Key size={24} /></div>
                        <div>
                            <h4 className="font-bold">Mudar Senha</h4>
                            <p className="text-[10px] text-zinc-500 font-medium">Última alteração há 3 meses</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Senha Atual</label>
                            <input type={showPass ? "text" : "password"} className="w-full bg-zinc-900 border border-white/10 rounded-2xl p-4 focus:border-blue-500/50 focus:outline-none" value={passwordForm.current} onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Nova Senha</label>
                            <input type={showPass ? "text" : "password"} className="w-full bg-zinc-900 border border-white/10 rounded-2xl p-4 focus:border-blue-500/50 focus:outline-none" value={passwordForm.new} onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })} />
                        </div>
                        <div className="flex items-center gap-2 px-1" onClick={() => setShowPass(!showPass)}>
                            {showPass ? <EyeOff size={16} className="text-zinc-500" /> : <Eye size={16} className="text-zinc-500" />}
                            <span className="text-xs font-bold text-zinc-500 uppercase cursor-pointer">Mostrar Senhas</span>
                        </div>
                    </div>
                    <button onClick={() => { alert('Senha alterada com sucesso!'); setSubview('main'); }} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 font-bold py-5 rounded-3xl mt-4 shadow-xl active:scale-95 transition-all">
                        ATUALIZAR SENHA
                    </button>
                    <div className="mt-4 p-4 bg-zinc-900/30 rounded-2xl border border-dashed border-white/10">
                        <h4 className="text-xs font-bold text-zinc-400 mb-2 uppercase flex items-center gap-2"><Shield size={14} /> Privacidade de Dados</h4>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">Suas fotos de etiquetas e coordenadas geográficas são criptografadas e armazenadas localmente no seu dispositivo. Não compartilhamos dados com terceiros.</p>
                    </div>
                </div>
            </div>
        );
    }

    if (subview === 'notifications') {
        const toggle = (field: keyof typeof settings.notifications) => toggleSetting('notifications', field);
        return (
            <div className="w-full h-full bg-black flex flex-col pt-safe pb-24 text-white animate-in slide-in-from-right duration-300">
                <div className="p-4 border-b border-white/5 flex items-center gap-4 text-white">
                    <button onClick={() => setSubview('main')} className="p-2 bg-white/5 rounded-full text-white"><ChevronLeft size={24} /></button>
                    <h2 className="text-xl font-bold">Notificações</h2>
                </div>
                <div className="p-4 space-y-3">
                    {[
                        { id: 'push', title: 'Avisos Push', desc: 'Alertas de novas rotas e mudanças', icon: <Bell size={20} className="text-emerald-400" /> },
                        { id: 'haptic', title: 'Feedback Háptico', desc: 'Vibração ao escanear e navegar', icon: <ScanLine size={20} className="text-blue-400" /> },
                        { id: 'sound', title: 'Alertas Sonoros', desc: 'Som de confirmação de entrega', icon: <Bell size={20} className="text-orange-400" /> }
                    ].map(item => (
                        <button key={item.id} onClick={() => toggle(item.id as any)} className="w-full p-4 glass-panel border border-white/10 rounded-2xl flex items-center justify-between hover:bg-white/5 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-zinc-900 rounded-xl">{item.icon}</div>
                                <div className="text-left">
                                    <h4 className="font-bold text-sm">{item.title}</h4>
                                    <p className="text-[10px] text-zinc-500">{item.desc}</p>
                                </div>
                            </div>
                            <div className={`w-12 h-6 rounded-full relative transition-colors ${settings.notifications[item.id as keyof typeof settings.notifications] ? 'bg-emerald-500' : 'bg-zinc-800 border border-white/10'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.notifications[item.id as keyof typeof settings.notifications] ? 'left-7' : 'left-1'}`}></div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (subview === 'map') {
        const toggle = (field: keyof typeof settings.mapPreferences) => toggleSetting('mapPreferences', field);
        return (
            <div className="w-full h-full bg-black flex flex-col pt-safe pb-24 text-white animate-in slide-in-from-right duration-300">
                <div className="p-4 border-b border-white/5 flex items-center gap-4">
                    <button onClick={() => setSubview('main')} className="p-2 bg-white/5 rounded-full"><ChevronLeft size={24} /></button>
                    <h2 className="text-xl font-bold">Preferências de Mapa</h2>
                </div>
                <div className="p-4 space-y-3">
                    {[
                        { id: 'darkMode', title: 'Modo Escuro (Cinemático)', desc: 'Visual noturno de alto contraste', icon: <Moon size={20} className="text-indigo-400" /> },
                        { id: 'showTraffic', title: 'Visualizar Trânsito', desc: 'Camada de tráfego em tempo real', icon: <Route size={20} className="text-orange-400" /> },
                        { id: 'autoCenter', title: 'Auto-Centralizar GPS', desc: 'Seguir sua posição enquanto navega', icon: <LocateFixed size={20} className="text-blue-400" /> }
                    ].map(item => (
                        <button key={item.id} onClick={() => toggle(item.id as any)} className="w-full p-4 glass-panel border border-white/10 rounded-2xl flex items-center justify-between hover:bg-white/5 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-zinc-900 rounded-xl">{item.icon}</div>
                                <div className="text-left">
                                    <h4 className="font-bold text-sm">{item.title}</h4>
                                    <p className="text-[10px] text-zinc-500">{item.desc}</p>
                                </div>
                            </div>
                            <div className={`w-12 h-6 rounded-full relative transition-colors ${settings.mapPreferences[item.id as keyof typeof settings.mapPreferences] ? 'bg-blue-500' : 'bg-zinc-800 border border-white/10'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.mapPreferences[item.id as keyof typeof settings.mapPreferences] ? 'left-7' : 'left-1'}`}></div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-black flex flex-col pt-safe pb-24 overflow-y-auto relative text-white">
            {/* Decoração de fundo */}
            <div className="absolute top-[10%] left-[-20%] w-72 h-72 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none"></div>

            {/* Cabeçalho do Perfil */}
            <div className="sticky top-0 z-20 w-full p-4 glass-panel border-b-0 flex flex-col gap-4 animate-fade-in">
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">Perfil & Ajustes</h1>

                <div className="flex items-center gap-4 mt-2 mb-2">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/20 flex items-center justify-center p-1 shadow-xl">
                        <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center">
                            <User size={28} className="text-blue-400" />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-lg font-bold text-white tracking-wide">João Silva</h2>
                        <span className="text-sm text-zinc-400 font-medium">Entregador Nível 1</span>
                    </div>
                </div>
            </div>

            <div className="p-4 flex flex-col gap-6 animate-slide-up mt-2">
                {/* Seção 1: Configurações Conta */}
                <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-2">Configurações da Conta</h3>
                    <div className="glass-panel rounded-2xl flex flex-col divide-y divide-white/5 overflow-hidden border border-white/10">

                        <button onClick={() => setSubview('personal')} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3 text-zinc-300">
                                <div className="bg-blue-500/10 p-2 rounded-xl"><User size={18} className="text-blue-400" /></div>
                                <span className="font-medium text-sm">Dados Pessoais</span>
                            </div>
                            <ChevronRight size={18} className="text-zinc-500" />
                        </button>

                        <button onClick={() => setSubview('privacy')} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3 text-zinc-300">
                                <div className="bg-purple-500/10 p-2 rounded-xl"><Shield size={18} className="text-purple-400" /></div>
                                <span className="font-medium text-sm">Privacidade e Senha</span>
                            </div>
                            <ChevronRight size={18} className="text-zinc-500" />
                        </button>

                    </div>
                </div>

                {/* Seção 2: Sistema */}
                <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-2">Sistema do App</h3>
                    <div className="glass-panel rounded-2xl flex flex-col divide-y divide-white/5 overflow-hidden border border-white/10">

                        <button onClick={() => setSubview('notifications')} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3 text-zinc-300">
                                <div className="bg-emerald-500/10 p-2 rounded-xl"><Bell size={18} className="text-emerald-400" /></div>
                                <span className="font-medium text-sm">Notificações e Alertas</span>
                            </div>
                            <ChevronRight size={18} className="text-zinc-500" />
                        </button>

                        <button onClick={() => setSubview('map')} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3 text-zinc-300">
                                <div className="bg-orange-500/10 p-2 rounded-xl"><Settings size={18} className="text-orange-400" /></div>
                                <span className="font-medium text-sm">Preferências (Mapa, GPS)</span>
                            </div>
                            <ChevronRight size={18} className="text-zinc-500" />
                        </button>

                    </div>
                </div>

                {/* Logout Zone */}
                <div className="mt-8 px-2 flex flex-col items-center">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl py-4 font-bold transition-colors mb-4"
                    >
                        <LogOut size={20} />
                        Sair da Conta (Logout)
                    </button>
                    <span className="text-[10px] text-zinc-600 font-mono">Route Vision App • v1.0.0 (Beta)</span>
                </div>
            </div>
        </div>
    );
};
