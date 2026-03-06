import { useState, useEffect } from 'react';

interface AdminViewProps {
    onBack: () => void;
}

export const AdminView = ({ onBack }: AdminViewProps) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'billing' | 'security'>('overview');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Simulate loading ERP data
        const timer = setTimeout(() => setIsLoading(false), 1500);
        return () => clearTimeout(timer);
    }, []);

    const stats = [
        { label: 'Usuários Ativos', value: '1,284', trend: '+12%', icon: 'group' },
        { label: 'Receita Mensal', value: 'R$ 42.5k', trend: '+8%', icon: 'payments' },
        { label: 'Assinaturas PRO', value: '856', trend: '+15%', icon: 'verified' },
        { label: 'Uptime Sistema', value: '99.9%', trend: 'Estável', icon: 'dns' },
    ];

    const mockUsers = [
        { id: 1, name: 'João Silva', role: 'Motorista PRO', status: 'Ativo', lastSeen: '2 min atrás' },
        { id: 2, name: 'Maria Santos', role: 'Motorista Base', status: 'Pendente', lastSeen: '1h atrás' },
        { id: 3, name: 'Carlos Oliveira', role: 'Administrador', status: 'Ativo', lastSeen: 'Agora' },
    ];

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-[300] bg-bg-deep flex flex-col items-center justify-center p-8 backdrop-blur-3xl">
                <div className="relative size-32 flex items-center justify-center mb-8">
                    <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-[ping_3s_infinite]" />
                    <div className="absolute inset-0 border-t-4 border-primary rounded-full animate-spin" />
                    <span className="material-symbols-outlined !text-[48px] text-primary">admin_panel_settings</span>
                </div>
                <h2 className="text-xl font-black italic uppercase tracking-[0.2em] text-white mb-2">Acessando ERP Central</h2>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em]">Sincronizando Banco de Dados...</p>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[250] bg-bg-deep flex flex-col font-sans overflow-hidden">
            {/* Header */}
            <header className="px-6 pt-14 pb-6 bg-white/5 border-b border-white/5 backdrop-blur-3xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="size-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all"
                    >
                        <span className="material-symbols-outlined !text-[24px]">close</span>
                    </button>
                    <div>
                        <span className="text-[10px] font-black tracking-[0.3em] text-primary uppercase">Painel de Controle</span>
                        <h1 className="text-xl font-black text-white italic tracking-tighter uppercase">RouteVision ERP™</h1>
                    </div>
                </div>
                <div className="size-10 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">shield_person</span>
                </div>
            </header>

            {/* Sidebar Navigation (Mobile Horizontal) */}
            <nav className="px-6 py-4 flex gap-4 overflow-x-auto no-scrollbar border-b border-white/5">
                {[
                    { id: 'overview', label: 'Dashboard', icon: 'dashboard' },
                    { id: 'users', label: 'Agentes', icon: 'badge' },
                    { id: 'billing', label: 'Assinaturas', icon: 'subscriptions' },
                    { id: 'security', label: 'Protocolos', icon: 'security' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all whitespace-nowrap text-xs font-bold uppercase tracking-widest ${activeTab === tab.id ? 'bg-primary text-white shadow-lg' : 'bg-white/5 text-slate-500 border border-white/5'}`}
                    >
                        <span className="material-symbols-outlined !text-[18px]">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto px-6 py-8 space-y-8 no-scrollbar pb-32">

                {activeTab === 'overview' && (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {stats.map((stat) => (
                                <div key={stat.label} className="glass-card rounded-[2rem] p-5 relative overflow-hidden group">
                                    <div className="absolute -top-10 -right-10 size-24 bg-primary/5 blur-3xl group-hover:bg-primary/10 transition-all"></div>
                                    <span className="material-symbols-outlined text-primary mb-3 opacity-60">{stat.icon}</span>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                                    <h3 className="text-xl font-black text-white italic">{stat.value}</h3>
                                    <span className="text-[9px] font-bold text-emerald-400 mt-2 block">{stat.trend}</span>
                                </div>
                            ))}
                        </div>

                        {/* Recent Activity Mini Log */}
                        <section className="space-y-4">
                            <h3 className="text-xs font-black tracking-widest uppercase text-slate-400 opacity-50 ml-1">Atividade Recente</h3>
                            <div className="glass-card rounded-[2.5rem] divide-y divide-white/5 border-white/5 overflow-hidden">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center gap-4 p-5 hover:bg-white/5 transition-colors">
                                        <div className="size-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                            <span className="material-symbols-outlined !text-[18px]">verified_user</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-white/90">Novo Agente Autorizado</p>
                                            <p className="text-[10px] text-slate-500 font-medium">Terminal ID: #882{i} • há {i * 5} min</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}

                {activeTab === 'users' && (
                    <section className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="text-xs font-black tracking-widest uppercase text-slate-400 opacity-50">Base de Agentes</h3>
                            <button className="text-[10px] font-bold text-primary uppercase tracking-widest border border-primary/20 px-3 py-1.5 rounded-lg">+ Novo Agente</button>
                        </div>
                        <div className="space-y-3">
                            {mockUsers.map(user => (
                                <div key={user.id} className="glass-card rounded-[2rem] p-5 flex items-center justify-between border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 font-black italic">
                                            {user.name[0]}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white/90">{user.name}</p>
                                            <p className="text-[10px] text-slate-500 font-medium">{user.role}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${user.status === 'Ativo' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                            {user.status}
                                        </span>
                                        <p className="text-[9px] text-slate-600 font-bold mt-1 uppercase tracking-tighter">{user.lastSeen}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {activeTab === 'billing' && (
                    <section className="space-y-6">
                        <div className="glass-card rounded-[2.5rem] p-8 border-l-4 border-l-primary relative overflow-hidden">
                            <div className="absolute bottom-0 right-0 w-40 h-40 bg-primary/10 blur-3xl p-10 -mr-20 -mb-20"></div>
                            <h4 className="text-sm font-black text-white uppercase italic tracking-widest mb-4">Plano Enterprise</h4>
                            <div className="flex items-baseline gap-2 mb-6">
                                <span className="text-4xl font-black text-white italic">R$ 4.250</span>
                                <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">/ mensal</span>
                            </div>
                            <button className="w-full h-12 bg-white text-bg-deep font-black italic uppercase tracking-widest text-[11px] rounded-2xl active:scale-95 transition-all">
                                Gerenciar Faturamento
                            </button>
                        </div>
                    </section>
                )}

                {activeTab === 'security' && (
                    <section className="space-y-4">
                        <h3 className="text-xs font-black tracking-widest uppercase text-slate-400 opacity-50 ml-1">Logs de Segurança</h3>
                        <div className="bg-black/40 rounded-[2rem] p-6 font-mono text-[10px] text-emerald-500/80 border border-white/5 shadow-inner min-h-[300px] overflow-x-auto whitespace-pre">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="mb-2">
                                    <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span> SYS_AUTH: User_#00{i} login successful from 192.168.1.{i}
                                    <br />
                                    <span className="text-primary/60">[{new Date().toLocaleTimeString()}]</span> DB_SYNC: Remote cluster synchronization complete.
                                </div>
                            ))}
                            <div className="animate-pulse">_</div>
                        </div>
                    </section>
                )}
            </main>

            {/* Admin Action Bar */}
            <footer className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-bg-deep via-bg-deep/90 to-transparent">
                <button className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-black italic uppercase tracking-[0.3em] rounded-2xl shadow-premium active:scale-95 transition-all flex items-center justify-center gap-3">
                    <span className="material-symbols-outlined !text-[24px]">backup</span>
                    Sincronizar Cloud
                </button>
            </footer>
        </div>
    );
};
