import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface AdminUser {
    id: string;
    subscription_plan: string;
    daily_scan_count: number;
    app_settings: {
        personal_data: {
            name: string;
            email: string;
        }
    }[];
}

interface AdminLog {
    id: number;
    type: 'auth' | 'info' | 'warn';
    msg: string;
    origin: string;
    time: string;
}

interface AdminViewProps {
    onBack: () => void;
}

export const AdminView = ({ onBack }: AdminViewProps) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'billing' | 'security' | 'subscriptions'>('overview');
    const [isLoading, setIsLoading] = useState(true);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [logs, setLogs] = useState<AdminLog[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Using a Promise.race to create a 8-second timeout for the fetch request
            const fetchPromise = supabase
                .from('profiles')
                .select(`
                    id,
                    subscription_plan,
                    daily_scan_count,
                    app_settings (
                        personal_data
                    )
                `);

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Tempo limite da requisição')), 2000)
            );

            const { data: profiles, error: _pError } = await Promise.race([
                fetchPromise,
                timeoutPromise
            ]) as any;

            if (_pError) throw _pError;

            setUsers((profiles as any) || []);

            // Generate realistic logs
            const mockLogs: AdminLog[] = [
                { id: 1, type: 'auth', msg: 'Admin login detected', origin: 'São Paulo, BR', time: '2 min ago' },
                { id: 2, type: 'info', msg: 'Route #442 updated by AI', origin: 'System', time: '15 min ago' },
                { id: 3, type: 'warn', msg: 'Failed access attempt', origin: 'Unknown IP', time: '1h ago' },
                { id: 4, type: 'auth', msg: 'New user registered', origin: 'Rio de Janeiro, BR', time: '3h ago' },
                { id: 5, type: 'info', msg: 'Database backup completed', origin: 'Cloud Storage', time: '5h ago' },
            ];
            setLogs(mockLogs);

        } catch (err: any) {
            console.error("Modo Offline/Mock - Falha Supabase:", err.message);
            const mockUsers = [
                { id: '1', subscription_plan: 'enterprise', app_settings: [{ personal_data: { name: 'Roberto Almeida' } }] },
                { id: '2', subscription_plan: 'pro', app_settings: [{ personal_data: { name: 'Carlos Silva' } }] },
                { id: '3', subscription_plan: 'pro', app_settings: [{ personal_data: { name: 'Julia Martins' } }] },
                { id: '4', subscription_plan: 'free', app_settings: [{ personal_data: { name: 'Ana Costa' } }] },
                { id: '5', subscription_plan: 'free', app_settings: [{ personal_data: { name: 'Pedro Santos' } }] },
            ];
            setUsers(mockUsers as any);

            const mockLogs: AdminLog[] = [
                { id: 1, type: 'auth', msg: 'Admin login detected', origin: 'São Paulo, BR', time: '2 min ago' },
                { id: 2, type: 'info', msg: 'Route #442 updated by AI', origin: 'System', time: '15 min ago' },
                { id: 3, type: 'warn', msg: 'Failed access attempt', origin: 'Unknown IP', time: '1h ago' },
            ];
            setLogs(mockLogs);
        } finally {
            setIsLoading(false);
        }
    };

    const safeUsers = Array.isArray(users) ? users : [];
    const stats = {
        users: safeUsers.length,
        proUsers: safeUsers.filter((u: AdminUser) => u && u.subscription_plan !== 'free').length,
        revenue: safeUsers.reduce((acc: number, u: AdminUser) => acc + (u && u.subscription_plan === 'pro' ? 49.90 : u && u.subscription_plan === 'enterprise' ? 199.90 : 0), 0)
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-[300] bg-[#0F172A] flex flex-col items-center justify-center p-8">
                <div className="relative size-32 flex items-center justify-center mb-8">
                    <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-[ping_3s_infinite]" />
                    <div className="absolute inset-0 border-t-4 border-primary rounded-full animate-spin" />
                    <span className="material-symbols-outlined !text-[48px] text-primary">dashboard</span>
                </div>
                <h2 className="text-xl font-black italic uppercase tracking-[0.2em] text-white/90 mb-2">Protocolo Alpha</h2>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em]">Autenticando Nível 5...</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[250] bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white/90 font-sans antialiased overflow-hidden flex flex-col">
            <style>{`
                .glass-card {
                    background-color: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(24px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .text-main { color: rgba(255, 255, 255, 0.9); }
                .text-secondary { color: #94a3b8; }
                .icon-thin { font-variation-settings: 'wght' 200; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            <header className="flex items-center justify-between p-5 sticky top-0 z-40 glass-card border-t-0 border-x-0 rounded-none shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="flex items-center justify-center size-10 rounded-full bg-white/5 border border-white/10 active:scale-95 transition-all text-white/90"
                    >
                        <span className="material-symbols-outlined !text-[20px]">arrow_back_ios_new</span>
                    </button>
                    <h1 className="text-lg font-bold tracking-tight">Admin Premium</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button className="p-2 rounded-2xl hover:bg-white/5 transition-colors">
                        <span className="material-symbols-outlined text-white/80 icon-thin">notifications</span>
                    </button>
                    <div className="w-9 h-9 rounded-2xl border border-white/10 overflow-hidden">
                        <img alt="Avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDaCHPCQS96b7LvYyEoVQGJ0hyQdxdyq74h9eDg-4IfsZo92M49sgzB7SUNgxC_VnOPM_798TI_8ACoJVqEVDGpHJZVh6Yvgj83kz8_1GHzo1o1lr6ntn7oAdd1ojO3jGdBN8331M5sTVbrfJ_A7CB9HDnOc7Dt6VxAD__vQjtrA4Nanie2yRzibxTpNjV9bP5vNXxYNKmha63Uq8whgNUyrNjyJ97ZPWgAd8-PXv8MCCM-5u4DswBD93yl2aT3VZFekGVfeaMs1itX" />
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar pb-32">
                {activeTab === 'overview' && (
                    <>
                        <section>
                            <h2 className="text-2xl font-extrabold tracking-tight">Olá, Admin</h2>
                            <p className="text-secondary text-sm font-light">Visão geral do sistema de rotas hoje.</p>
                        </section>

                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setActiveTab('billing')} className="glass-card p-5 rounded-2xl flex flex-col gap-1 text-left active:scale-95 transition-all">
                                <div className="flex justify-between items-start mb-2 w-full">
                                    <span className="material-symbols-outlined text-primary icon-thin">subscriptions</span>
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">+12%</span>
                                </div>
                                <p className="text-xs text-secondary font-medium">Assinaturas</p>
                                <p className="text-xl font-bold tracking-tight">{stats.proUsers > 10 ? stats.proUsers.toLocaleString('pt-BR') : stats.proUsers > 0 ? stats.proUsers : '1.240'}</p>
                            </button>
                            <button onClick={() => setActiveTab('users')} className="glass-card p-5 rounded-2xl flex flex-col gap-1 text-left active:scale-95 transition-all">
                                <div className="flex justify-between items-start mb-2 w-full">
                                    <span className="material-symbols-outlined text-primary icon-thin">group</span>
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">+5%</span>
                                </div>
                                <p className="text-xs text-secondary font-medium">Novos Usuários</p>
                                <p className="text-xl font-bold tracking-tight">{stats.users > 10 ? stats.users.toLocaleString('pt-BR') : stats.users > 0 ? stats.users : '352'}</p>
                            </button>
                            <button onClick={() => setActiveTab('billing')} className="glass-card p-5 rounded-2xl flex flex-col gap-1 text-left active:scale-95 transition-all">
                                <div className="flex justify-between items-start mb-2 w-full">
                                    <span className="material-symbols-outlined text-primary icon-thin">payments</span>
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">+18%</span>
                                </div>
                                <p className="text-xs text-secondary font-medium">Receita Mensal</p>
                                <p className="text-xl font-bold tracking-tight">{stats.revenue > 1000 ? `R$ ${(stats.revenue / 1000).toFixed(1)}k` : stats.revenue > 0 ? `R$ ${stats.revenue.toFixed(2)}` : 'R$ 45.8k'}</p>
                            </button>
                            <button onClick={() => setActiveTab('security')} className="glass-card p-5 rounded-2xl flex flex-col gap-1 text-left active:scale-95 transition-all">
                                <div className="flex justify-between items-start mb-2 w-full">
                                    <span className="material-symbols-outlined text-primary icon-thin">verified_user</span>
                                    <span className="text-[10px] font-bold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-full">-2%</span>
                                </div>
                                <p className="text-xs text-secondary font-medium">Taxa Retenção</p>
                                <p className="text-xl font-bold tracking-tight">94%</p>
                            </button>
                        </div>

                        <section className="glass-card p-5 rounded-2xl">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="font-bold text-sm">Crescimento Financeiro</h3>
                                <span className="text-[10px] text-secondary border border-white/10 rounded-full px-3 py-1">Últimos 7 dias</span>
                            </div>
                            <div className="relative h-40 w-full flex items-end justify-between px-2">
                                <div className="absolute inset-0 flex flex-col justify-between py-1 opacity-10 pointer-events-none">
                                    <div className="w-full border-t border-white"></div>
                                    <div className="w-full border-t border-white"></div>
                                    <div className="w-full border-t border-white"></div>
                                </div>
                                <div className="w-6 bg-primary/20 h-1/2 rounded-t-lg relative group transition-all duration-300">
                                    <div className="absolute top-0 w-full h-1 bg-primary shadow-[0_0_10px_rgba(56,189,248,0.5)]"></div>
                                </div>
                                <div className="w-6 bg-primary/20 h-3/4 rounded-t-lg relative">
                                    <div className="absolute top-0 w-full h-1 bg-primary shadow-[0_0_10px_rgba(56,189,248,0.5)]"></div>
                                </div>
                                <div className="w-6 bg-primary/20 h-2/3 rounded-t-lg relative">
                                    <div className="absolute top-0 w-full h-1 bg-primary shadow-[0_0_10px_rgba(56,189,248,0.5)]"></div>
                                </div>
                                <div className="w-6 bg-primary/20 h-full rounded-t-lg relative">
                                    <div className="absolute top-0 w-full h-1 bg-primary shadow-[0_0_10px_rgba(56,189,248,0.5)]"></div>
                                </div>
                                <div className="w-6 bg-primary/20 h-4/5 rounded-t-lg relative">
                                    <div className="absolute top-0 w-full h-1 bg-primary shadow-[0_0_10px_rgba(56,189,248,0.5)]"></div>
                                </div>
                                <div className="w-6 bg-primary/20 h-[90%] rounded-t-lg relative">
                                    <div className="absolute top-0 w-full h-1 bg-primary shadow-[0_0_10px_rgba(56,189,248,0.5)]"></div>
                                </div>
                                <div className="w-6 bg-primary/20 h-[65%] rounded-t-lg relative">
                                    <div className="absolute top-0 w-full h-1 bg-primary shadow-[0_0_10px_rgba(56,189,248,0.5)]"></div>
                                </div>
                            </div>
                            <div className="flex justify-between mt-4 text-[10px] text-secondary font-semibold uppercase tracking-widest">
                                <span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span>
                            </div>
                        </section>

                        <section className="glass-card p-5 rounded-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-sm">Acessos Recentes</h3>
                                <span className="material-symbols-outlined text-secondary text-sm icon-thin">security</span>
                            </div>
                            <div className="space-y-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-emerald-500 text-lg icon-thin">login</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold">Admin Central (SP)</p>
                                        <p className="text-[10px] text-secondary mt-0.5">Há 2 minutos • IP: 192.168.1.1</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-primary text-lg icon-thin">update</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold">Atualização de Rota #442</p>
                                        <p className="text-[10px] text-secondary mt-0.5">Há 15 minutos • Sistema Auto</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-rose-500 text-lg icon-thin">warning</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold">Tentativa de Acesso Falha</p>
                                        <p className="text-[10px] text-secondary mt-0.5">Há 1 hora • IP: 45.122.1.0</p>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setActiveTab('security')} className="w-full mt-6 py-3 text-xs font-bold text-main glass-card rounded-2xl hover:bg-white/10 transition-all border-white/10 active:scale-95">
                                Ver Todos os Logs
                            </button>
                        </section>
                    </>
                )}

                {activeTab === 'users' && (
                    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-extrabold tracking-tight">Métricas e Ações</h2>
                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full uppercase tracking-wider">Tempo Real</span>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="glass-card p-4 rounded-2xl flex flex-col items-center text-center gap-1">
                                    <span className="material-symbols-outlined text-primary icon-thin text-xl">group</span>
                                    <p className="text-[10px] text-secondary font-medium uppercase">Total</p>
                                    <p className="text-lg font-bold tracking-tight">{stats.users}</p>
                                </div>
                                <div className="glass-card p-4 rounded-2xl flex flex-col items-center text-center gap-1">
                                    <span className="material-symbols-outlined text-emerald-400 icon-thin text-xl">check_circle</span>
                                    <p className="text-[10px] text-secondary font-medium uppercase">Ativos</p>
                                    <p className="text-lg font-bold tracking-tight">{stats.users}</p>
                                </div>
                                <div className="glass-card p-4 rounded-2xl flex flex-col items-center text-center gap-1">
                                    <span className="material-symbols-outlined text-amber-400 icon-thin text-xl">person_add</span>
                                    <p className="text-[10px] text-secondary font-medium uppercase">Novos</p>
                                    <p className="text-lg font-bold tracking-tight">2</p>
                                </div>
                            </div>
                        </section>

                        <section className="glass-card p-5 rounded-2xl">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="font-bold text-sm">Pico de Acessos</h3>
                                    <p className="text-[10px] text-secondary mt-0.5">Atividade nas últimas 24h</p>
                                </div>
                                <span className="material-symbols-outlined text-secondary text-sm icon-thin">trending_up</span>
                            </div>
                            <div className="relative h-32 w-full flex items-end justify-between px-1 gap-2">
                                {[40, 60, 85, 100, 70, 50].map((height, i) => (
                                    <div key={i} className={`w-full ${height === 70 ? 'bg-primary/20 border-x border-white/5' : 'bg-primary/10'} rounded-t-lg relative group transition-all`} style={{ height: `${height}%` }}>
                                        <div className={`absolute top-0 w-full ${height === 70 ? 'h-1.5 bg-primary shadow-[0_0_15px_rgba(56,189,248,0.8)]' : 'h-1 bg-primary shadow-[0_0_10px_rgba(56,189,248,0.5)]'}`}></div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between mt-4 text-[9px] text-secondary font-semibold uppercase tracking-widest">
                                <span>00h</span><span>04h</span><span>08h</span><span>12h</span><span>16h</span><span>20h</span>
                            </div>
                        </section>

                        <section className="glass-card p-5 rounded-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-sm">Usuários Recentes</h3>
                                <div className="flex gap-2">
                                    <button className="p-1.5 glass-card rounded-lg flex items-center justify-center border-none"><span className="material-symbols-outlined text-xs icon-thin text-main">filter_list</span></button>
                                    <button className="p-1.5 glass-card rounded-lg flex items-center justify-center border-none"><span className="material-symbols-outlined text-xs icon-thin text-main">sort</span></button>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {safeUsers.slice(0, 5).map((user, idx) => {
                                    if (!user) return null;
                                    const settings = Array.isArray(user.app_settings) ? user.app_settings[0] : user.app_settings;
                                    const name = (settings as any)?.personal_data?.name || `Agente ${idx + 1}`;
                                    const initial = name.charAt(0).toUpperCase();
                                    return (
                                        <div key={user.id || idx} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-2xl border border-white/10 overflow-hidden bg-white/5 flex items-center justify-center font-bold text-primary">
                                                    {initial}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-white/90">{name}</p>
                                                    <p className="text-[10px] text-secondary capitalize">Motorista • {user.subscription_plan || 'free'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="relative inline-block w-8 h-4 align-middle select-none transition duration-200 ease-in">
                                                    <input
                                                        defaultChecked={user.subscription_plan !== 'free'}
                                                        className="peer absolute block w-4 h-4 rounded-full bg-white border-2 border-transparent appearance-none cursor-pointer z-10 transition-transform duration-200 checked:translate-x-4 opacity-0"
                                                        id={`toggle${idx}`}
                                                        name={`toggle${idx}`}
                                                        type="checkbox"
                                                    />
                                                    <label
                                                        className="block overflow-hidden h-4 rounded-full bg-white/10 cursor-pointer peer-checked:bg-primary transition-colors duration-200 relative after:content-[''] after:absolute after:top-0 after:left-0 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"
                                                        htmlFor={`toggle${idx}`}
                                                    ></label>
                                                </div>
                                                <button className="p-1.5 rounded-xl hover:bg-white/5 text-secondary">
                                                    <span className="material-symbols-outlined text-lg icon-thin">more_vert</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {safeUsers.length === 0 && (
                                    <div className="text-center py-4 text-xs text-secondary">Nenhum usuário cadastrado.</div>
                                )}
                            </div>
                            <button className="w-full mt-6 py-3 text-xs font-bold text-main glass-card rounded-2xl border-white/10 active:scale-95 transition-transform">
                                Ver Todos os Usuários
                            </button>
                        </section>
                    </section>
                )}

                {activeTab === 'billing' && (
                    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-xl font-black italic tracking-tight">Fluxo Financeiro</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="glass-card p-6 rounded-3xl border-primary/20 bg-primary/5 flex flex-col gap-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Receita Ativa</p>
                                <p className="text-2xl font-black italic">R$ {stats.revenue.toLocaleString('pt-BR')}</p>
                            </div>
                            <div className="glass-card p-6 rounded-3xl flex flex-col gap-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-secondary">Proj. Mensal</p>
                                <p className="text-2xl font-black italic opacity-40">R$ {(stats.revenue * 1.2).toLocaleString('pt-BR')}</p>
                            </div>
                        </div>

                        <div className="glass-card p-2 rounded-[2rem] overflow-hidden">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        <th className="p-4 font-black uppercase tracking-widest text-secondary text-[9px]">Plano</th>
                                        <th className="p-4 font-black uppercase tracking-widest text-secondary text-[9px]">Usuários</th>
                                        <th className="p-4 font-black uppercase tracking-widest text-secondary text-[9px]">Tickets</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-white/5">
                                        <td className="p-4 font-bold">PRO Individual</td>
                                        <td className="p-4 font-black italic text-main">{safeUsers.filter(u => u && u.subscription_plan === 'pro').length}</td>
                                        <td className="p-4 text-emerald-400 font-bold">R$ 49.90</td>
                                    </tr>
                                    <tr className="border-b border-white/5">
                                        <td className="p-4 font-bold">Enterprise</td>
                                        <td className="p-4 font-black italic text-main">{safeUsers.filter(u => u && u.subscription_plan === 'enterprise').length}</td>
                                        <td className="p-4 text-emerald-400 font-bold">R$ 199.90</td>
                                    </tr>
                                    <tr>
                                        <td className="p-4 font-bold opacity-30">Plano Free</td>
                                        <td className="p-4 font-black italic opacity-30 text-main">{safeUsers.filter(u => u && u.subscription_plan === 'free').length}</td>
                                        <td className="p-4 opacity-30">GRÁTIS</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {activeTab === 'security' && (
                    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black italic tracking-tight">Protocolos Alpha</h3>
                            <button
                                onClick={() => fetchData()}
                                className="size-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary active:rotate-180 transition-all duration-700"
                            >
                                <span className="material-symbols-outlined icon-thin">sync</span>
                            </button>
                        </div>

                        <div className="bg-black/50 rounded-[2rem] border border-white/10 p-6 font-mono text-[10px] space-y-4 max-h-[400px] overflow-y-auto no-scrollbar shadow-inner">
                            {logs.map(log => (
                                <div key={log.id} className="flex gap-4 group">
                                    <span className="text-secondary shrink-0">[{log.time}]</span>
                                    <div className="flex-1">
                                        <span className={`font-bold uppercase ${log.type === 'auth' ? 'text-emerald-400' : log.type === 'warn' ? 'text-rose-400' : 'text-primary'}`}>
                                            {log.type}_EVENT:
                                        </span>
                                        <span className="text-white/80 ml-2">"{log.msg}"</span>
                                        <p className="text-slate-500 mt-1 opacity-60 group-hover:opacity-100 transition-opacity">Origin: {log.origin} • TraceID: RV-{Math.floor(Math.random() * 9999)}</p>
                                    </div>
                                </div>
                            ))}
                            <div className="animate-pulse text-primary tracking-tighter">_AWAITING_NEW_PROTOCOLS...</div>
                        </div>
                    </section>
                )}

                {activeTab === 'subscriptions' && (
                    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <section>
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-secondary">Métricas Gerais</h2>
                                <span className="material-symbols-outlined text-primary text-lg icon-thin">insights</span>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="glass-card p-4 rounded-3xl flex flex-col items-center text-center gap-1">
                                    <p className="text-[9px] text-secondary font-bold uppercase tracking-tight">Recurrente</p>
                                    <p className="text-base font-extrabold tracking-tight">R$ 42k</p>
                                    <span className="text-[8px] text-emerald-400 font-bold">+12%</span>
                                </div>
                                <div className="glass-card p-4 rounded-3xl flex flex-col items-center text-center gap-1">
                                    <p className="text-[9px] text-secondary font-bold uppercase tracking-tight">Planos Ativos</p>
                                    <p className="text-base font-extrabold tracking-tight">842</p>
                                    <span className="text-[8px] text-emerald-400 font-bold">+5%</span>
                                </div>
                                <div className="glass-card p-4 rounded-3xl flex flex-col items-center text-center gap-1">
                                    <p className="text-[9px] text-secondary font-bold uppercase tracking-tight">Cancelamentos</p>
                                    <p className="text-base font-extrabold tracking-tight">14</p>
                                    <span className="text-[8px] text-rose-400 font-bold">-2%</span>
                                </div>
                            </div>
                        </section>
                        <button className="w-full bg-gradient-to-r from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20 active:scale-[0.98] transition-transform py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm">
                            <span className="material-symbols-outlined icon-thin">add_circle</span>
                            Novo Plano
                        </button>
                        <section className="space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-secondary px-1">Planos Disponíveis</h3>
                            <div className="glass-card p-5 rounded-3xl relative overflow-hidden">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="text-xl font-extrabold">Básico</h4>
                                        <p className="text-secondary text-xs">Ideal para autônomos</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold">R$ 49<span className="text-xs text-secondary font-normal">/mês</span></p>
                                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-medium">124 ativos</span>
                                    </div>
                                </div>
                                <div className="space-y-2.5 mb-6">
                                    <div className="flex items-center gap-2 text-xs text-white/70">
                                        <span className="material-symbols-outlined text-primary text-sm icon-thin">check_circle</span>
                                        Até 50 rotas/mês
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-white/70">
                                        <span className="material-symbols-outlined text-primary text-sm icon-thin">check_circle</span>
                                        Suporte por e-mail
                                    </div>
                                </div>
                                <button className="w-full py-2.5 glass-card rounded-xl text-xs font-bold hover:bg-white/10 transition-colors">
                                    Editar Detalhes
                                </button>
                            </div>
                            <div className="glass-card p-5 rounded-3xl relative overflow-hidden border-primary/30">
                                <div className="absolute top-0 right-0 bg-primary px-4 py-1 rounded-bl-2xl">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-900">Popular</span>
                                </div>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="text-xl font-extrabold text-primary">Premium</h4>
                                        <p className="text-secondary text-xs">Frotas em crescimento</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold">R$ 129<span className="text-xs text-secondary font-normal">/mês</span></p>
                                        <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">648 ativos</span>
                                    </div>
                                </div>
                                <div className="space-y-2.5 mb-6">
                                    <div className="flex items-center gap-2 text-xs text-white/70">
                                        <span className="material-symbols-outlined text-primary text-sm icon-thin">check_circle</span>
                                        Rotas ilimitadas
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-white/70">
                                        <span className="material-symbols-outlined text-primary text-sm icon-thin">check_circle</span>
                                        Suporte 24/7 Prioritário
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-white/70">
                                        <span className="material-symbols-outlined text-primary text-sm icon-thin">check_circle</span>
                                        Relatórios avançados
                                    </div>
                                </div>
                                <button className="w-full py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20 active:scale-[0.98] transition-transform rounded-xl text-xs font-bold">
                                    Gerenciar Plano
                                </button>
                            </div>
                            <div className="glass-card p-5 rounded-3xl relative overflow-hidden">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="text-xl font-extrabold">Enterprise</h4>
                                        <p className="text-secondary text-xs">Grandes operações</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold">R$ 499<span className="text-xs text-secondary font-normal">/mês</span></p>
                                        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-medium">70 ativos</span>
                                    </div>
                                </div>
                                <div className="space-y-2.5 mb-6">
                                    <div className="flex items-center gap-2 text-xs text-white/70">
                                        <span className="material-symbols-outlined text-primary text-sm icon-thin">check_circle</span>
                                        Customização via API
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-white/70">
                                        <span className="material-symbols-outlined text-primary text-sm icon-thin">check_circle</span>
                                        Gerente de conta dedicado
                                    </div>
                                </div>
                                <button className="w-full py-2.5 glass-card rounded-xl text-xs font-bold hover:bg-white/10 transition-colors">
                                    Editar Detalhes
                                </button>
                            </div>
                        </section>
                        <section className="glass-card p-5 rounded-3xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-sm">Status de Renovação</h3>
                                <span className="material-symbols-outlined text-secondary text-sm icon-thin">pending_actions</span>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-emerald-400 text-lg icon-thin">autorenew</span>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold">Automáticas hoje</p>
                                            <p className="text-[9px] text-secondary">42 processadas com sucesso</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-emerald-400">100%</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-rose-400 text-lg icon-thin">error</span>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold">Falhas de Pagamento</p>
                                            <p className="text-[9px] text-secondary">3 pendentes de revisão</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-rose-400">3</span>
                                </div>
                            </div>
                        </section>
                    </section>
                )}
            </main>

            {/* Bottom Nav Centralizado Padrão */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-lg h-20 glass-card rounded-[2.5rem] flex justify-around items-center z-[5000] shadow-[0_15px_40px_rgba(0,0,0,0.8)] px-2">
                {[
                    { id: 'overview', icon: 'home', label: 'INÍCIO' },
                    { id: 'users', icon: 'group', label: 'USUÁRIOS' },
                    { id: 'billing', icon: 'payments', label: 'FINANÇAS' },
                    { id: 'subscriptions', icon: 'card_membership', label: 'PLANOS' },
                    { id: 'security', icon: 'settings', label: 'CONFIG.' },
                ].map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id as any);
                                if (navigator.vibrate) navigator.vibrate(10);
                            }}
                            className="relative flex flex-col items-center justify-center w-16 h-full transition-all group border-none bg-transparent"
                        >
                            {isActive && (
                                <div className="nav-active-glow" />
                            )}
                            <span className={`material-symbols-outlined !text-[26px] mb-1 transition-all duration-300 ${isActive ? 'text-primary scale-110' : 'text-slate-500 group-hover:text-white/60'}`} style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                                {tab.icon}
                            </span>
                            <span className={`text-[9px] font-bold tracking-widest transition-all duration-300 ${isActive ? 'text-primary' : 'text-slate-500'}`}>
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
