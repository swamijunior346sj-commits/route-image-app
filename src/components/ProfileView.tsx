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
        const categoryData = settings[category] as any;
        const newCat = { ...categoryData, [field]: !categoryData[field] };
        const updated = await updateSettings({ ...settings, [category]: newCat } as AppSettings);
        setSettings(updated);
        if (navigator.vibrate) navigator.vibrate(10);
    };

    if (loading || !settings) return <div className="p-10 text-center text-zinc-500">Caregando...</div>;

    if (subview === 'personal') {
        return (
            <div className="w-full h-full bg-black flex flex-col pt-safe pb-24 text-white animate-[slideRight_0.4s_ease-out]">
                <div className="p-6 border-b border-white/5 flex items-center gap-6 bg-zinc-950/20 backdrop-blur-md">
                    <button onClick={() => setSubview('main')} className="p-3 bg-white/[0.03] border border-white/10 rounded-2xl text-zinc-400 hover:text-white transition-all"><ChevronLeft size={20} /></button>
                    <div>
                        <h2 className="text-2xl font-black italic uppercase italic tracking-tighter">Dados Pessoais</h2>
                        <p className="text-[9px] font-black text-blue-500/60 uppercase tracking-[0.3em]">Módulo de Perfil do Agente</p>
                    </div>
                </div>
                <div className="p-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
                    <div className="space-y-2 group">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Nome Operacional</label>
                        <div className="relative">
                            <User size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-500/40 group-focus-within:text-blue-500 transition-colors" />
                            <input className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all italic font-medium" value={personalForm.name} onChange={e => setPersonalForm({ ...personalForm, name: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-2 group">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Comunicação Digital</label>
                        <div className="relative">
                            <Mail size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-500/40 group-focus-within:text-blue-500 transition-colors" />
                            <input className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all italic font-medium" value={personalForm.email} onChange={e => setPersonalForm({ ...personalForm, email: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-2 group">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Terminal Móvel</label>
                        <div className="relative">
                            <Phone size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-500/40 group-focus-within:text-blue-500 transition-colors" />
                            <input className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all italic font-medium" value={personalForm.phone} onChange={e => setPersonalForm({ ...personalForm, phone: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-2 group">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Unidade de Transporte</label>
                        <div className="relative">
                            <Bike size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-500/40 group-focus-within:text-blue-500 transition-colors" />
                            <input className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-sm text-white focus:border-blue-500/50 focus:outline-none transition-all italic font-medium" value={personalForm.vehicle} onChange={e => setPersonalForm({ ...personalForm, vehicle: e.target.value })} />
                        </div>
                    </div>

                    <button onClick={handleSavePersonal} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black italic uppercase tracking-[0.2em] py-5 rounded-[2rem] shadow-[0_20px_50px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-3 text-xs mt-6 active:scale-95">
                        <Save size={18} /> Sincronizar Novos Dados
                    </button>
                </div>
            </div>
        );
    }

    if (subview === 'privacy') {
        return (
            <div className="w-full h-full bg-black flex flex-col pt-safe pb-24 text-white animate-[slideRight_0.4s_ease-out]">
                <div className="p-6 border-b border-white/5 flex items-center gap-6 bg-zinc-950/20 backdrop-blur-md">
                    <button onClick={() => setSubview('main')} className="p-3 bg-white/[0.03] border border-white/10 rounded-2xl text-zinc-400 hover:text-white transition-all"><ChevronLeft size={20} /></button>
                    <div>
                        <h2 className="text-2xl font-black italic uppercase italic tracking-tighter">Segurança</h2>
                        <p className="text-[9px] font-black text-purple-500/60 uppercase tracking-[0.3em]">Criptografia de Terminal</p>
                    </div>
                </div>
                <div className="p-8 flex flex-col gap-8">
                    <div className="bg-zinc-950 border border-white/5 p-6 rounded-[2rem] flex items-center gap-5 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                        <div className="w-14 h-14 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.1)]"><Key size={24} /></div>
                        <div>
                            <h4 className="font-black italic uppercase text-sm tracking-tight text-white">Chave de Acesso</h4>
                            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-0.5">Nível de Segurança: Máximo</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Assinatura Atual</label>
                            <input type={showPass ? "text" : "password"} className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-5 text-sm text-white focus:border-purple-500/50 focus:outline-none transition-all font-mono italic" value={passwordForm.current} onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Nova Assinatura Digital</label>
                            <input type={showPass ? "text" : "password"} className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-5 text-sm text-white focus:border-purple-500/50 focus:outline-none transition-all font-mono italic" value={passwordForm.new} onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })} />
                        </div>
                        <button onClick={() => setShowPass(!showPass)} className="flex items-center gap-3 px-2 text-zinc-600 hover:text-zinc-400 transition-colors group">
                            {showPass ? <EyeOff size={16} className="group-hover:text-purple-400" /> : <Eye size={16} className="group-hover:text-purple-400" />}
                            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Alternar Visibilidade de Código</span>
                        </button>
                    </div>

                    <button onClick={() => { alert('Assinatura atualizada!'); setSubview('main'); }} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black italic uppercase tracking-[0.2em] py-5 rounded-[2rem] shadow-[0_20px_50px_rgba(147,51,234,0.3)] transition-all flex items-center justify-center gap-3 text-xs mt-2 active:scale-95">
                        Codificar Nova Assinatura
                    </button>

                    <div className="p-6 bg-zinc-950/20 rounded-[2rem] border border-dashed border-white/10 relative group overflow-hidden">
                        <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/[0.02] transition-colors" />
                        <h4 className="text-[10px] font-black text-zinc-400 mb-3 uppercase tracking-widest flex items-center gap-2"><Shield size={14} className="text-zinc-500" /> Diretiva de Sigilo</h4>
                        <p className="text-[9px] font-medium text-zinc-600 leading-relaxed italic uppercase tracking-wider">Seus dados biométricos e geográficos são processados via hardware local e protegidos por protocolo de ponta-a-ponta.</p>
                    </div>
                </div>
            </div>
        );
    }

    if (subview === 'notifications') {
        const toggle = (field: keyof typeof settings.notifications) => toggleSetting('notifications', field);
        return (
            <div className="w-full h-full bg-black flex flex-col pt-safe pb-24 text-white animate-[slideRight_0.4s_ease-out]">
                <div className="p-6 border-b border-white/5 flex items-center gap-6 bg-zinc-950/20 backdrop-blur-md">
                    <button onClick={() => setSubview('main')} className="p-3 bg-white/[0.03] border border-white/10 rounded-2xl text-zinc-400 hover:text-white transition-all"><ChevronLeft size={20} /></button>
                    <div>
                        <h2 className="text-2xl font-black italic uppercase italic tracking-tighter">Alertas</h2>
                        <p className="text-[9px] font-black text-emerald-500/60 uppercase tracking-[0.3em]">Comunicação de Interface</p>
                    </div>
                </div>
                <div className="p-8 space-y-4">
                    {[
                        { id: 'push', title: 'Broadcast Push', desc: 'Sinalização de novas coordenadas', icon: <Bell size={20} className="text-emerald-400" /> },
                        { id: 'haptic', title: 'Feedback Háptico', desc: 'Vibração de pulso por proximidade', icon: <ScanLine size={20} className="text-blue-400" /> },
                        { id: 'sound', title: 'Resposta Acústica', desc: 'Confirmação sonora de sucesso', icon: <Bell size={20} className="text-orange-400" /> }
                    ].map(item => (
                        <button key={item.id} onClick={() => toggle(item.id as any)} className="group w-full p-6 bg-zinc-950/40 border border-white/5 rounded-[2rem] flex items-center justify-between hover:border-white/20 transition-all shadow-xl">
                            <div className="flex items-center gap-6">
                                <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl group-hover:scale-110 transition-transform">{item.icon}</div>
                                <div className="text-left">
                                    <h4 className="font-black italic uppercase text-xs tracking-tight text-white">{item.title}</h4>
                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">{item.desc}</p>
                                </div>
                            </div>
                            <div className={`w-14 h-7 rounded-full relative transition-all duration-500 overflow-hidden ${settings.notifications[item.id as keyof typeof settings.notifications] ? 'bg-emerald-500' : 'bg-zinc-900 border border-white/10'}`}>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-150%] animate-[shimmer_2s_infinite]" />
                                <div className={`absolute top-1.5 w-4 h-4 rounded-full transition-all duration-300 shadow-md ${settings.notifications[item.id as keyof typeof settings.notifications] ? 'left-8 bg-white' : 'left-2 bg-zinc-600'}`}></div>
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
            <div className="w-full h-full bg-black flex flex-col pt-safe pb-24 text-white animate-[slideRight_0.4s_ease-out]">
                <div className="p-6 border-b border-white/5 flex items-center gap-6 bg-zinc-950/20 backdrop-blur-md">
                    <button onClick={() => setSubview('main')} className="p-3 bg-white/[0.03] border border-white/10 rounded-2xl text-zinc-400 hover:text-white transition-all"><ChevronLeft size={20} /></button>
                    <div>
                        <h2 className="text-2xl font-black italic uppercase italic tracking-tighter">Navegação</h2>
                        <p className="text-[9px] font-black text-orange-500/60 uppercase tracking-[0.3em]">Calibragem de HUD Cartográfico</p>
                    </div>
                </div>
                <div className="p-8 space-y-4">
                    {[
                        { id: 'darkMode', title: 'Render Noturno', desc: 'Visual cinemático de alta gama', icon: <Moon size={20} className="text-indigo-400" /> },
                        { id: 'showTraffic', title: 'Vetor de Tráfego', desc: 'Monitoramento termográfico de fluxo', icon: <Route size={20} className="text-orange-400" /> },
                        { id: 'autoCenter', title: 'Foco Dinâmico', desc: 'Lock-on automático do agente', icon: <LocateFixed size={20} className="text-blue-400" /> }
                    ].map(item => (
                        <button key={item.id} onClick={() => toggle(item.id as any)} className="group w-full p-6 bg-zinc-950/40 border border-white/5 rounded-[2rem] flex items-center justify-between hover:border-white/20 transition-all shadow-xl">
                            <div className="flex items-center gap-6">
                                <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl group-hover:scale-110 transition-transform">{item.icon}</div>
                                <div className="text-left">
                                    <h4 className="font-black italic uppercase text-xs tracking-tight text-white">{item.title}</h4>
                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">{item.desc}</p>
                                </div>
                            </div>
                            <div className={`w-14 h-7 rounded-full relative transition-all duration-500 overflow-hidden ${settings.mapPreferences[item.id as keyof typeof settings.mapPreferences] ? 'bg-blue-600' : 'bg-zinc-900 border border-white/10'}`}>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-150%] animate-[shimmer_2s_infinite]" />
                                <div className={`absolute top-1.5 w-4 h-4 rounded-full transition-all duration-300 shadow-md ${settings.mapPreferences[item.id as keyof typeof settings.mapPreferences] ? 'left-8 bg-white' : 'left-2 bg-zinc-600'}`}></div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-black flex flex-col pt-safe pb-24 overflow-y-auto relative text-white custom-scrollbar">
            {/* Cinematic Background Decoration */}
            <div className="absolute top-[5%] right-[-10%] w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-[20%] left-[-10%] w-[300px] h-[300px] bg-purple-600/5 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>

            {/* Profile HUD Header */}
            <div className="sticky top-0 z-20 w-full p-8 bg-black/40 backdrop-blur-2xl border-b border-white/5 animate-fade-in">
                <div className="flex justify-between items-start mb-10">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase italic">Central <span className="text-blue-500">Operacional</span></h1>
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">ID Agente: SV-2026-ALPHA</p>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full">
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Ativo</span>
                    </div>
                </div>

                <div className="flex items-center gap-8 px-2">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                        <div className="relative w-24 h-24 rounded-[2.5rem] bg-zinc-950 border border-white/10 flex items-center justify-center p-1 overflow-hidden shadow-2xl">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
                            <div className="w-full h-full rounded-[2rem] bg-zinc-900 flex items-center justify-center border border-white/5">
                                <User size={40} className="text-blue-500/60" />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col space-y-1">
                        <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">João Silva</h2>
                        <div className="flex items-center gap-3">
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= 4 ? 'bg-blue-500' : 'bg-zinc-800'}`} />
                                ))}
                            </div>
                            <span className="text-[10px] font-black text-blue-500/60 uppercase tracking-widest">Elite Operator</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-8 flex flex-col gap-10 animate-[slideUp_0.6s_ease-out]">
                {/* Section 1: Command Settings */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] ml-4 italic">Protocolos de Identidade</h3>
                    <div className="bg-zinc-950/40 border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-sm shadow-2xl transition-all hover:border-white/10">
                        <button onClick={() => setSubview('personal')} className="group w-full flex items-center justify-between p-6 hover:bg-white/[0.02] transition-all">
                            <div className="flex items-center gap-6">
                                <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-2xl group-hover:scale-110 transition-transform"><User size={20} className="text-blue-500" /></div>
                                <div className="text-left">
                                    <span className="block font-black italic uppercase text-xs tracking-tight text-white/80 group-hover:text-white">Dados Operacionais</span>
                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">Sincronização de Perfil</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-zinc-700 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                        </button>
                        <div className="h-[1px] w-[80%] mx-auto bg-white/5" />
                        <button onClick={() => setSubview('privacy')} className="group w-full flex items-center justify-between p-6 hover:bg-white/[0.02] transition-all">
                            <div className="flex items-center gap-6">
                                <div className="bg-purple-500/5 border border-purple-500/10 p-4 rounded-2xl group-hover:scale-110 transition-transform"><Shield size={20} className="text-purple-500" /></div>
                                <div className="text-left">
                                    <span className="block font-black italic uppercase text-xs tracking-tight text-white/80 group-hover:text-white">Segurança & Criptografia</span>
                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">Gerenciar Chaves de Segurança</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-zinc-700 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                        </button>
                    </div>
                </div>

                {/* Section 2: HUD Calibrations */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] ml-4 italic">Calibragem de Interface</h3>
                    <div className="bg-zinc-950/40 border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-sm shadow-2xl transition-all hover:border-white/10">
                        <button onClick={() => setSubview('notifications')} className="group w-full flex items-center justify-between p-6 hover:bg-white/[0.02] transition-all">
                            <div className="flex items-center gap-6">
                                <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl group-hover:scale-110 transition-transform"><Bell size={20} className="text-emerald-500" /></div>
                                <div className="text-left">
                                    <span className="block font-black italic uppercase text-xs tracking-tight text-white/80 group-hover:text-white">Matriz de Notificações</span>
                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">Configurar Alertas de Missão</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-zinc-700 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                        </button>
                        <div className="h-[1px] w-[80%] mx-auto bg-white/5" />
                        <button onClick={() => setSubview('map')} className="group w-full flex items-center justify-between p-6 hover:bg-white/[0.02] transition-all">
                            <div className="flex items-center gap-6">
                                <div className="bg-orange-500/5 border border-orange-500/10 p-4 rounded-2xl group-hover:scale-110 transition-transform"><Settings size={20} className="text-orange-500" /></div>
                                <div className="text-left">
                                    <span className="block font-black italic uppercase text-xs tracking-tight text-white/80 group-hover:text-white">Motor Cartográfico (GPS)</span>
                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">Otimização de Renderização</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-zinc-700 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                        </button>
                    </div>
                </div>

                {/* Logout Zone */}
                <div className="mt-12 mb-10 space-y-8 flex flex-col items-center">
                    <button
                        onClick={handleLogout}
                        className="group w-full relative h-20 rounded-[2.5rem] overflow-hidden transition-all active:scale-95"
                    >
                        <div className="absolute inset-0 bg-red-600 opacity-10 group-hover:opacity-20 transition-opacity" />
                        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-red-600/50" />
                        <div className="relative h-full flex items-center justify-center gap-4 text-red-500">
                            <LogOut size={22} className="group-hover:translate-x-[-4px] transition-transform" />
                            <span className="font-black italic uppercase text-sm tracking-[0.3em]">Encerrar Sessão</span>
                        </div>
                    </button>

                    <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-4 text-[9px] font-black text-zinc-700 uppercase tracking-[0.5em] italic">
                            <div className="w-8 h-[1px] bg-zinc-800" />
                            Core.OS 1.0.0.Stable
                            <div className="w-8 h-[1px] bg-zinc-800" />
                        </div>
                        <p className="text-[8px] font-black text-zinc-800 uppercase tracking-widest">Desenvolvido sob protocolo RouteVision™</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
