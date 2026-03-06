import { useState, useEffect } from 'react';
import {
    getDailyRoute,
    updateDailyRoute,
    removeFromDailyRoute,
    clearDailyRoute,
    type RoutePoint
} from '../services/db';
import {
    Check,
    Navigation,
    Phone,
    MoreVertical,
    Plus,
    Loader2,
    Sparkles,
    Trash2,
    Route as RouteIcon,
    ChevronLeft
} from 'lucide-react';

interface DailyRouteViewProps {
    onNavigateToMap?: () => void;
    onNavigateToScanner?: () => void;
    onBack?: () => void;
}

export const DailyRouteView = ({ onNavigateToMap, onNavigateToScanner, onBack }: DailyRouteViewProps) => {
    const [points, setPoints] = useState<RoutePoint[]>([]);
    const [isOptimizing, setIsOptimizing] = useState(false);

    // Stats
    const [deliveredCount, setDeliveredCount] = useState(0);
    const [progressPercent, setProgressPercent] = useState(0);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const data = await getDailyRoute();
        setPoints(data);

        const delivered = data.filter(p => p.isDelivered).length;
        setDeliveredCount(delivered);
        setProgressPercent(data.length > 0 ? Math.round((delivered / data.length) * 100) : 0);
    };

    const handleClearAll = async () => {
        if (!confirm('Limpar toda a sua rota atual?')) return;
        await clearDailyRoute();
        setPoints([]);
        setDeliveredCount(0);
        setProgressPercent(0);
    };

    const handleOptimize = async () => {
        setIsOptimizing(true);
        // Simulate thinking time for "Premium AI" feel
        await new Promise(r => setTimeout(r, 1500));

        // Simple shuffle as a placeholder for re-sorting logic if needed, 
        // but typically user wants the nearest-neighbor logic if they have GPS.
        // For now, let's keep it as is or implement a quick visual "sort".
        setIsOptimizing(false);
    };

    const handleToggleDelivered = async (id: string) => {
        const updated = points.map(p => p.id === id ? { ...p, isDelivered: !p.isDelivered } : p);
        setPoints(updated);
        await updateDailyRoute(updated);

        const delivered = updated.filter(p => p.isDelivered).length;
        setDeliveredCount(delivered);
        setProgressPercent(updated.length > 0 ? Math.round((delivered / updated.length) * 100) : 0);
    };

    const handleDelete = async (id: string) => {
        const updated = await removeFromDailyRoute(id);
        setPoints(updated);

        const delivered = updated.filter(p => p.isDelivered).length;
        setDeliveredCount(delivered);
        setProgressPercent(updated.length > 0 ? Math.round((delivered / updated.length) * 100) : 0);
    };

    const firstPendingIndex = points.findIndex(p => !p.isDelivered);

    return (
        <div className="relative w-full h-full bg-bg-deep overflow-hidden flex flex-col font-sans">
            <header className="pt-14 px-6 pb-6 bg-gradient-to-b from-bg-deep to-transparent z-10">
                <div className="flex justify-between items-center mb-6">
                    <button
                        onClick={onBack}
                        className="flex items-center justify-center size-10 rounded-full bg-white/5 border border-white/10 active:scale-95 transition-all text-white/90"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center justify-center size-10 rounded-full bg-white/5 border border-white/10 active:scale-95 transition-all text-white/90">
                            <MoreVertical size={24} />
                        </button>
                    </div>
                </div>
                <div className="flex justify-between items-end">
                    <div className="space-y-1">
                        <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase opacity-60">Roteiro do Dia</span>
                        <h1 className="text-3xl font-extrabold tracking-tight text-white italic">Minha Rota</h1>
                    </div>
                    <div className="glass-panel px-3 py-1.5 rounded-full flex items-center gap-2 border-white/5 shadow-lg">
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Online</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-6 pb-40 no-scrollbar">
                {/* Stats Card */}
                <section className="glass-panel rounded-[2rem] p-6 mb-10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[40px] rounded-full -mr-16 -mt-16 group-hover:bg-primary/20 transition-all duration-700"></div>

                    <div className="flex justify-between items-center mb-4 relative z-10">
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">Progresso Total</p>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-2xl font-black text-white">{deliveredCount}</span>
                                <span className="text-slate-400 text-sm font-medium">/ {points.length} paradas</span>
                            </div>
                        </div>

                        <div className="relative size-16">
                            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                                <path className="stroke-white/5" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3" />
                                <path
                                    className="stroke-primary transition-all duration-1000 ease-out"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    strokeWidth="3"
                                    strokeDasharray={`${progressPercent}, 100`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[10px] font-black text-white">{progressPercent}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden relative z-10">
                        <div
                            className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>

                    <div className="mt-6 flex gap-2 relative z-10">
                        <button
                            onClick={handleOptimize}
                            disabled={isOptimizing || points.length < 2}
                            className="flex-1 h-10 glass-panel rounded-xl text-[10px] font-bold text-primary uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                            {isOptimizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            Otimizar
                        </button>
                        <button
                            onClick={handleClearAll}
                            className="h-10 px-4 glass-panel rounded-xl text-red-500/60 hover:text-red-500 active:scale-95 transition-all"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </section>

                {/* Timeline List */}
                <section className="space-y-1 relative">
                    {points.length > 0 && (
                        <div className="absolute left-[19px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-primary/40 to-white/5 opacity-30"></div>
                    )}

                    {points.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                            <div className="size-20 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-6">
                                <RouteIcon size={32} />
                            </div>
                            <h3 className="text-sm font-bold uppercase tracking-widest">Rota Vazia</h3>
                            <p className="text-[10px] uppercase mt-2 font-medium">Escaneie etiquetas para popular</p>
                        </div>
                    ) : (
                        points.map((p, idx) => {
                            const isNext = idx === firstPendingIndex;
                            const isDone = p.isDelivered;

                            return (
                                <div key={p.id} className="relative pl-12 pb-8 group animate-in fade-in slide-in-from-left-4 transition-all duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                                    {/* Icon Indicator */}
                                    <div
                                        onClick={() => handleToggleDelivered(p.id)}
                                        className={`absolute left-0 top-1.5 size-10 rounded-full flex items-center justify-center z-10 transition-all cursor-pointer ${isDone
                                            ? 'bg-emerald-500/20 border border-emerald-500/30'
                                            : isNext
                                                ? 'bg-primary border-4 border-bg-deep shadow-lg shadow-primary/40 ring-4 ring-primary/10'
                                                : 'bg-white/5 border border-white/10'
                                            }`}
                                    >
                                        {isDone ? (
                                            <Check size={20} className="text-emerald-500" />
                                        ) : isNext ? (
                                            <Navigation size={22} className="text-white animate-pulse" />
                                        ) : (
                                            <span className="text-[12px] font-black text-slate-500">{(idx + 1).toString().padStart(2, '0')}</span>
                                        )}
                                    </div>

                                    {/* Card */}
                                    <div className={`glass-panel rounded-[1.5rem] p-5 transition-all ${isDone
                                        ? 'opacity-40 grayscale-[0.5]'
                                        : isNext
                                            ? 'border-primary/30 bg-primary/[0.04] shadow-xl'
                                            : 'border-white/5'
                                        }`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`text-[9px] font-black uppercase tracking-widest ${isDone ? 'text-emerald-400' : isNext ? 'text-primary' : 'text-slate-500'
                                                }`}>
                                                {isDone ? 'Concluído' : isNext ? 'Parada Atual' : `Parada ${(idx + 1).toString().padStart(2, '0')}`}
                                            </span>
                                            {isNext && (
                                                <div className="bg-primary/20 px-2 py-0.5 rounded text-[8px] font-black text-primary uppercase tracking-tighter">Prioridade</div>
                                            )}
                                            {isDone && (
                                                <button onClick={() => handleDelete(p.id)} className="text-red-500/40 hover:text-red-500">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>

                                        <h3 className={`font-extrabold tracking-tight ${isDone ? 'text-slate-400 line-through' : 'text-white'}`}>
                                            {p.name}
                                        </h3>
                                        <p className="text-sm text-slate-400 mt-1 font-medium opacity-70">
                                            {p.neighborhood || 'Bairro ñ identificado'} • {p.city || 'Cidade ñ def.'}
                                        </p>

                                        {isNext && (
                                            <div className="mt-5 flex gap-2">
                                                <button
                                                    onClick={onNavigateToMap}
                                                    className="flex-1 h-12 bg-white text-bg-deep font-black text-[13px] rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                                                >
                                                    <Navigation size={18} />
                                                    Navegar
                                                </button>
                                                <button className="size-12 glass-panel rounded-xl flex items-center justify-center text-white active:scale-95 transition-all border-white/10">
                                                    <Phone size={20} />
                                                </button>
                                                <button className="size-12 glass-panel rounded-xl flex items-center justify-center text-slate-400 active:scale-95 transition-all border-white/5">
                                                    <MoreVertical size={20} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </section>
            </main>

            {/* Premium FAB */}
            <div className="fixed bottom-10 right-6 z-50">
                <button
                    onClick={onNavigateToScanner}
                    className="size-18 rounded-full bg-gradient-to-tr from-blue-700 via-blue-600 to-accent text-white shadow-fab flex items-center justify-center active:scale-90 transition-all border-t border-white/20 relative group"
                >
                    <Plus size={32} className="group-hover:rotate-90 transition-all duration-500" />
                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
                </button>
            </div>

            {/* Nav Fade Overlay */}
            <nav className="fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-bg-deep via-bg-deep/80 to-transparent pointer-events-none"></nav>
        </div>
    );
};
