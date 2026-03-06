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
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'billing' | 'security'>('overview');
    const [isLoading, setIsLoading] = useState(true);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [logs, setLogs] = useState<AdminLog[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch users with profiles
            const { data: profiles, error: _pError } = await supabase
                .from('profiles')
                .select(`
                    id,
                    subscription_plan,
                    daily_scan_count,
                    app_settings (
                        personal_data
                    )
                `);

            if (profiles) setUsers(profiles as any);

            // Generate realistic logs
            const mockLogs: AdminLog[] = [
                { id: 1, type: 'auth', msg: 'Admin login detected', origin: 'São Paulo, BR', time: '2 min ago' },
                { id: 2, type: 'info', msg: 'Route #442 updated by AI', origin: 'System', time: '15 min ago' },
                { id: 3, type: 'warn', msg: 'Failed access attempt', origin: 'Unknown IP', time: '1h ago' },
                { id: 4, type: 'auth', msg: 'New user registered', origin: 'Rio de Janeiro, BR', time: '3h ago' },
                { id: 5, type: 'info', msg: 'Database backup completed', origin: 'Cloud Storage', time: '5h ago' },
            ];
            setLogs(mockLogs);

        } catch (err) {
            console.error("Error fetching admin data:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const stats = {
        users: users.length,
        proUsers: users.filter((u: AdminUser) => u.subscription_plan !== 'free').length,
        revenue: users.reduce((acc: number, u: AdminUser) => acc + (u.subscription_plan === 'pro' ? 49.90 : u.subscription_plan === 'enterprise' ? 199.90 : 0), 0)
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
            {/* Custom Styles for Chart and Icons */}
            <style>{`
                .icon-thin { font-variation-settings: 'wght' 200; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            {/* Header */}
            <header className="flex items-center justify-between p-5 sticky top-0 z-40 bg-white/5 backdrop-blur-xl border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="bg-primary/10 p-2 rounded-2xl active:scale-95 transition-all text-primary"
                    >
                        <span className="material-symbols-outlined icon-thin">arrow_back</span>
                    </button>
                    <h1 className="text-lg font-bold tracking-tight">Admin Premium</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button className="p-2 rounded-2xl hover:bg-white/5 transition-colors relative">
                        <span className="material-symbols-outlined text-white/80 icon-thin">notifications</span>
                        <span className="absolute top-2 right-2 size-2 bg-primary rounded-full ring-2 ring-[#0F172A]"></span>
                    </button>
                    <div className="w-9 h-9 rounded-2xl border border-white/10 overflow-hidden ring-2 ring-primary/20">
                        <img alt="Avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDaCHPCQS96b7LvYyEoVQGJ0hyQdxdyq74h9eDg-4IfsZo92M49sgzB7SUNgxC_VnOPM_798TI_8ACoJVqEVDGpHJZVh6Yvgj83kz8_1GHzo1o1lr6ntn7oAdd1ojO3jGdBN8331M5sTVbrfJ_A7CB9HDnOc7Dt6VxAD__vQjtrA4Nanie2yRzibxTpNjV9bP5vNXxYNKmha63Uq8whgNUyrNjyJ97ZPWgAd8-PXv8MCCM-5u4DswBD93yl2aT3VZFekGVfeaMs1itX" />
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar pb-32">
                {activeTab === 'overview' && (
                    <>
                        <section>
                            <h2 className="text-2xl font-extrabold tracking-tight">Olá, Admin</h2>
                            <p className="text-slate-400 text-sm font-light">Visão geral do sistema de rotas hoje.</p>
                        </section>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setActiveTab('billing')}
                                className="glass-card p-5 rounded-2xl flex flex-col gap-1 border border-white/10 bg-white/5 backdrop-blur-md text-left active:scale-95 transition-all"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="material-symbols-outlined text-primary icon-thin">subscriptions</span>
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">+12%</span>
                                </div>
                                <p className="text-xs text-slate-400 font-medium whitespace-nowrap">Assinaturas</p>
                                <p className="text-xl font-bold tracking-tight">{stats.proUsers}</p>
                            </button>
                            <button
                                onClick={() => setActiveTab('users')}
                                className="glass-card p-5 rounded-2xl flex flex-col gap-1 border border-white/10 bg-white/5 backdrop-blur-md text-left active:scale-95 transition-all"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="material-symbols-outlined text-primary icon-thin">group</span>
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">+5%</span>
                                </div>
                                <p className="text-xs text-slate-400 font-medium whitespace-nowrap">Novos Usuários</p>
                                <p className="text-xl font-bold tracking-tight">{stats.users}</p>
                            </button>
                            <button
                                onClick={() => setActiveTab('billing')}
                                className="glass-card p-5 rounded-2xl flex flex-col gap-1 border border-white/10 bg-white/5 backdrop-blur-md text-left active:scale-95 transition-all"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="material-symbols-outlined text-primary icon-thin">payments</span>
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">+18%</span>
                                </div>
                                <p className="text-xs text-slate-400 font-medium whitespace-nowrap">Receita Estimada</p>
                                <p className="text-xl font-bold tracking-tight">R$ {stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </button>
                            <button
                                onClick={() => setActiveTab('security')}
                                className="glass-card p-5 rounded-2xl flex flex-col gap-1 border border-white/10 bg-white/5 backdrop-blur-md text-left active:scale-95 transition-all"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="material-symbols-outlined text-primary icon-thin">verified_user</span>
                                    <span className="text-[10px] font-bold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-full">-2%</span>
                                </div>
                                <p className="text-xs text-slate-400 font-medium whitespace-nowrap">Taxa Retenção</p>
                                <p className="text-xl font-bold tracking-tight">94%</p>
                            </button>
                        </div>

                        {/* Chart Section */}
                        <section className="glass-card p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="font-bold text-sm uppercase tracking-widest opacity-60">Crescimento Financeiro</h3>
                                <span className="text-[10px] text-slate-400 border border-white/10 rounded-full px-3 py-1">Últimos 7 dias</span>
                            </div>
                            <div className="relative h-40 w-full flex items-end justify-between px-2">
                                <div className="absolute inset-0 flex flex-col justify-between py-1 opacity-10 pointer-events-none">
                                    <div className="w-full border-t border-white"></div>
                                    <div className="w-full border-t border-white"></div>
                                    <div className="w-full border-t border-white"></div>
                                </div>
                                {/* Bar components */}
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
                            <div className="flex justify-between mt-4 text-[10px] text-slate-500 font-semibold uppercase tracking-widest">
                                <span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span>
                            </div>
                        </section>

                        {/* Recent Access Logs */}
                        <section className="glass-card p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-sm uppercase tracking-widest opacity-60">Segurança & Logs</h3>
                                <span className="material-symbols-outlined text-slate-400 text-sm icon-thin">security</span>
                            </div>
                            <div className="space-y-5">
                                {logs.slice(0, 3).map(log => (
                                    <div key={log.id} className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${log.type === 'auth' ? 'bg-emerald-500/10 text-emerald-500' : log.type === 'warn' ? 'bg-rose-500/10 text-rose-500' : 'bg-primary/10 text-primary'}`}>
                                            <span className="material-symbols-outlined text-lg icon-thin">
                                                {log.type === 'auth' ? 'login' : log.type === 'warn' ? 'warning' : 'update'}
                                            </span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-semibold">{log.msg}</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5 font-bold uppercase tracking-tighter">{log.time} • {log.origin}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => setActiveTab('security')}
                                className="w-full mt-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/60 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all active:scale-95"
                            >
                                Ver Todos os Logs ERP
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
                                    <p className="text-[10px] text-slate-400 font-medium uppercase">Total</p>
                                    <p className="text-lg font-bold tracking-tight">{stats.users}</p>
                                </div>
                                <div className="glass-card p-4 rounded-2xl flex flex-col items-center text-center gap-1">
                                    <span className="material-symbols-outlined text-emerald-400 icon-thin text-xl">check_circle</span>
                                    <p className="text-[10px] text-slate-400 font-medium uppercase">Ativos</p>
                                    <p className="text-lg font-bold tracking-tight">{stats.users}</p>
                                </div>
                                <div className="glass-card p-4 rounded-2xl flex flex-col items-center text-center gap-1">
                                    <span className="material-symbols-outlined text-amber-400 icon-thin text-xl">person_add</span>
                                    <p className="text-[10px] text-slate-400 font-medium uppercase">Novos</p>
                                    <p className="text-lg font-bold tracking-tight">2</p>
                                </div>
                            </div>
                        </section>

                        <section className="glass-card p-5 rounded-2xl">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="font-bold text-sm">Pico de Acessos</h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Atividade nas últimas 24h</p>
                                </div>
                                <span className="material-symbols-outlined text-slate-400 text-sm icon-thin">trending_up</span>
                            </div>
                            <div className="relative h-32 w-full flex items-end justify-between px-1 gap-2">
                                {[40, 60, 85, 100, 70, 50].map((height, i) => (
                                    <div key={i} className={`w-full ${height === 70 ? 'bg-primary/20 border-x border-white/5' : 'bg-primary/10'} rounded-t-lg relative group transition-all`} style={{ height: `${height}%` }}>
                                        <div className={`absolute top-0 w-full ${height === 70 ? 'h-1.5 bg-primary shadow-[0_0_15px_rgba(56,189,248,0.8)]' : 'h-1 bg-primary shadow-[0_0_10px_rgba(56,189,248,0.5)]'}`}></div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between mt-4 text-[9px] text-slate-400 font-semibold uppercase tracking-widest">
                                <span>00h</span><span>04h</span><span>08h</span><span>12h</span><span>16h</span><span>20h</span>
                            </div>
                        </section>

                        <section className="glass-card p-5 rounded-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-sm">Usuários Recentes</h3>
                                <div className="flex gap-2">
                                    <button className="p-1.5 glass-card rounded-lg flex items-center justify-center"><span className="material-symbols-outlined text-xs icon-thin">filter_list</span></button>
                                    <button className="p-1.5 glass-card rounded-lg flex items-center justify-center"><span className="material-symbols-outlined text-xs icon-thin">sort</span></button>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {users.slice(0, 5).map((user, idx) => (
                                    <div key={user.id} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl border border-white/10 overflow-hidden bg-white/5 flex items-center justify-center font-bold text-primary">
                                                {user.app_settings?.[0]?.personal_data?.name?.[0]?.toUpperCase() || 'A'}
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-white/90">{user.app_settings?.[0]?.personal_data?.name || `Agente ${idx + 1}`}</p>
                                                <p className="text-[10px] text-slate-400 capitalize">Motorista • {user.subscription_plan}</p>
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
                                            <button className="p-1.5 rounded-xl hover:bg-white/5 text-slate-400">
                                                <span className="material-symbols-outlined text-lg icon-thin">more_vert</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {users.length === 0 && (
                                    <div className="text-center py-4 text-xs text-slate-500">Nenhum usuário cadastrado.</div>
                                )}
                            </div>
                            <button className="w-full mt-6 py-3 text-xs font-bold text-white/90 glass-card rounded-2xl hover:bg-white/10 transition-all border-white/10">
                                Ver Todos os Usuários
                            </button>
                        </section>

                        <section className="glass-card p-5 rounded-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-sm">Alertas de Status</h3>
                                <span className="material-symbols-outlined text-slate-400 text-sm icon-thin">history</span>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0"></div>
                                    <div>
                                        <p className="text-[11px] font-medium text-white/90">Sistema de segurança atualizado</p>
                                        <p className="text-[9px] text-slate-400 mt-0.5">Há 5 minutos</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                                    <div>
                                        <p className="text-[11px] font-medium text-white/90">Novo upgrade premium ativado</p>
                                        <p className="text-[9px] text-slate-400 mt-0.5">Há 24 minutos</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </section>
                )}

                {activeTab === 'billing' && (
                    <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-xl font-black italic tracking-tight">Fluxo Financeiro</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="glass-card p-6 rounded-3xl border border-primary/20 bg-primary/5 flex flex-col gap-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Receita Ativa</p>
                                <p className="text-2xl font-black italic">R$ {stats.revenue.toLocaleString('pt-BR')}</p>
                            </div>
                            <div className="glass-card p-6 rounded-3xl border border-white/5 bg-white/5 flex flex-col gap-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Proj. Mensal</p>
                                <p className="text-2xl font-black italic opacity-40">R$ {(stats.revenue * 1.2).toLocaleString('pt-BR')}</p>
                            </div>
                        </div>

                        <div className="glass-card p-2 rounded-[2rem] border border-white/5 bg-white/5 overflow-hidden">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        <th className="p-4 font-black uppercase tracking-widest text-slate-500 text-[9px]">Plano</th>
                                        <th className="p-4 font-black uppercase tracking-widest text-slate-500 text-[9px]">Usuários</th>
                                        <th className="p-4 font-black uppercase tracking-widest text-slate-500 text-[9px]">Tickets</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-white/5">
                                        <td className="p-4 font-bold">PRO Individual</td>
                                        <td className="p-4 font-black italic">{users.filter(u => u.subscription_plan === 'pro').length}</td>
                                        <td className="p-4 text-emerald-400 font-bold">R$ 49.90</td>
                                    </tr>
                                    <tr className="border-b border-white/5">
                                        <td className="p-4 font-bold">Enterprise</td>
                                        <td className="p-4 font-black italic">{users.filter(u => u.subscription_plan === 'enterprise').length}</td>
                                        <td className="p-4 text-emerald-400 font-bold">R$ 199.90</td>
                                    </tr>
                                    <tr>
                                        <td className="p-4 font-bold opacity-30">Plano Free</td>
                                        <td className="p-4 font-black italic opacity-30">{users.filter(u => u.subscription_plan === 'free').length}</td>
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
                                    <span className="text-slate-600 shrink-0">[{log.time}]</span>
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
            </main>

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 bg-[#0F172A]/80 backdrop-blur-2xl border-t border-white/10 px-8 pt-4 pb-10 z-50">
                <div className="flex justify-between items-center max-w-md mx-auto">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'overview' ? 'text-primary' : 'text-slate-500'}`}
                    >
                        <span className="material-symbols-outlined icon-thin !text-[26px]" style={{ fontVariationSettings: activeTab === 'overview' ? "'FILL' 1" : "'FILL' 0" }}>home</span>
                        <p className="text-[9px] font-bold uppercase tracking-widest">Início</p>
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'users' ? 'text-primary' : 'text-slate-500'}`}
                    >
                        <span className="material-symbols-outlined icon-thin !text-[26px]" style={{ fontVariationSettings: activeTab === 'users' ? "'FILL' 1" : "'FILL' 0" }}>group</span>
                        <p className="text-[9px] font-bold uppercase tracking-widest">Usuários</p>
                    </button>
                    <button
                        onClick={() => setActiveTab('billing')}
                        className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'billing' ? 'text-primary' : 'text-slate-500'}`}
                    >
                        <span className="material-symbols-outlined icon-thin !text-[26px]" style={{ fontVariationSettings: activeTab === 'billing' ? "'FILL' 1" : "'FILL' 0" }}>payments</span>
                        <p className="text-[9px] font-bold uppercase tracking-widest">Finanças</p>
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'security' ? 'text-primary' : 'text-slate-500'}`}
                    >
                        <span className="material-symbols-outlined icon-thin !text-[26px]" style={{ fontVariationSettings: activeTab === 'security' ? "'FILL' 1" : "'FILL' 0" }}>settings</span>
                        <p className="text-[9px] font-bold uppercase tracking-widest">Config.</p>
                    </button>
                </div>
            </nav>
        </div>
    );
};
