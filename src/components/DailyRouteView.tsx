import { useState, useEffect, useCallback } from 'react';
import {
    getDailyRoute,
    updateDailyRoute,
    updateActiveRoute,
    removeFromDailyRoute,
    clearDailyRoute,
    type RoutePoint
} from '../services/db';
import { EditAddressView } from './EditAddressView';

interface DailyRouteViewProps {
    onNavigateToMap?: () => void;
    onNavigateToScanner?: () => void;
    onBack?: () => void;
}

export const DailyRouteView = ({ onNavigateToMap, onNavigateToScanner, onBack }: DailyRouteViewProps) => {
    const [points, setPoints] = useState<RoutePoint[]>([]);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizationLog, setOptimizationLog] = useState('');
    const [editingPoint, setEditingPoint] = useState<RoutePoint | null>(null);

    // Stats
    const [deliveredCount, setDeliveredCount] = useState(0);
    const [progressPercent, setProgressPercent] = useState(0);

    const loadData = useCallback(async () => {
        const data = await getDailyRoute();
        setPoints(data);

        const delivered = data.filter(p => p.isDelivered).length;
        setDeliveredCount(delivered);
        setProgressPercent(data.length > 0 ? Math.round((delivered / data.length) * 100) : 0);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleClearAll = async () => {
        if (!confirm('Limpar toda a sua rota atual?')) return;
        await clearDailyRoute();
        setPoints([]);
        setDeliveredCount(0);
        setProgressPercent(0);
    };

    const handleOptimize = async () => {
        if (points.length < 2) return;
        setIsOptimizing(true);
        setOptimizationLog('Iniciando Motores de IA...');

        try {
            // Get current location
            setOptimizationLog('Localizando seu dispositivo...');
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
            });
            const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };

            // Filter points with coordinates
            const pointsToOptimize = points.filter(p => p.lat !== null && p.lng !== null);
            const pointsWithoutCoords = points.filter(p => p.lat === null || p.lng === null);

            if (pointsToOptimize.length === 0) {
                setOptimizationLog('Nenhum ponto válido para otimizar.');
                await new Promise(r => setTimeout(r, 1000));
                setIsOptimizing(false);
                return;
            }

            setOptimizationLog('Processando Matriz de Distância...');
            const service = new google.maps.DistanceMatrixService();
            const response = await service.getDistanceMatrix({
                origins: [origin],
                destinations: pointsToOptimize.map(p => ({ lat: p.lat!, lng: p.lng! })),
                travelMode: google.maps.TravelMode.DRIVING,
            });

            if (response.rows[0].elements) {
                setOptimizationLog('IA calculando melhor trajetória...');
                const distances = response.rows[0].elements.map((el, idx) => ({
                    index: idx,
                    distance: el.distance?.value || 999999,
                    duration: el.duration?.text || ''
                }));

                // Sort points based on distance
                const sortedPoints = [...pointsToOptimize].sort((a, b) => {
                    const distA = distances.find(d => pointsToOptimize[d.index].id === a.id)?.distance || 0;
                    const distB = distances.find(d => pointsToOptimize[d.index].id === b.id)?.distance || 0;
                    return distA - distB;
                });

                const finalRoute = [...sortedPoints, ...pointsWithoutCoords];
                setPoints(finalRoute);
                await updateDailyRoute(finalRoute);

                setOptimizationLog('Rota Otimizada com Sucesso!');
                if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
                await new Promise(r => setTimeout(r, 800));
            }
        } catch (error) {
            console.error('Optimization failed:', error);
            alert('Não foi possível otimizar a rota: ' + (error as Error).message);
        } finally {
            setIsOptimizing(false);
            setOptimizationLog('');
        }
    };

    const handleToggleDelivered = async (id: string) => {
        const updated = points.map(p => p.id === id ? { ...p, isDelivered: !p.isDelivered } : p);
        setPoints(updated);
        await updateDailyRoute(updated);

        const delivered = updated.filter(p => p.isDelivered).length;
        setDeliveredCount(delivered);
        setProgressPercent(updated.length > 0 ? Math.round((delivered / updated.length) * 100) : 0);
    };

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const updated = await removeFromDailyRoute(id);
        setPoints(updated);

        const delivered = updated.filter(p => p.isDelivered).length;
        setDeliveredCount(delivered);
        setProgressPercent(updated.length > 0 ? Math.round((delivered / updated.length) * 100) : 0);
    };

    const handleEdit = (point: RoutePoint, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingPoint(point);
    };

    const handleSaveEdit = async (updatedFields: Partial<RoutePoint>) => {
        if (!editingPoint) return;
        const updatedPoints = points.map(p =>
            p.id === editingPoint.id ? { ...p, ...updatedFields } : p
        );
        setPoints(updatedPoints);
        await updateDailyRoute(updatedPoints);
        setEditingPoint(null);
    };

    const handleSendToMap = async () => {
        if (points.length === 0) return;
        setLoading(true);
        try {
            await updateActiveRoute(points);
            onNavigateToMap?.();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const firstPendingIndex = points.findIndex(p => !p.isDelivered);
    const [loading, setLoading] = useState(false);

    if (editingPoint) {
        return (
            <EditAddressView
                item={editingPoint}
                onSave={handleSaveEdit}
                onBack={() => setEditingPoint(null)}
            />
        );
    }

    return (
        <div className="relative w-full h-full bg-bg-start overflow-hidden flex flex-col font-sans">
            <header className="pt-14 px-6 pb-6 bg-transparent z-10 transition-all">
                <div className="flex justify-between items-center mb-6">
                    <button
                        onClick={onBack}
                        className="flex items-center justify-center size-10 rounded-full bg-white/5 border border-white/10 active:scale-95 transition-all text-white/90"
                    >
                        <span className="material-symbols-outlined !text-[24px]">arrow_back_ios_new</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center justify-center size-10 rounded-full bg-white/5 border border-white/10 active:scale-95 transition-all text-white/90">
                            <span className="material-symbols-outlined !text-[24px]">more_vert</span>
                        </button>
                    </div>
                </div>
                <div className="flex justify-between items-end">
                    <div className="space-y-1">
                        <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase opacity-60">Roteiro do Dia</span>
                        <h1 className="text-3xl font-black tracking-tight text-white/90 italic">Minha Rota</h1>
                    </div>
                    <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2 border-white/5 shadow-lg">
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest leading-none">Status Online</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-6 pb-40 no-scrollbar">
                {/* Stats Card */}
                <section className="glass-card rounded-[2.5rem] p-6 mb-10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[40px] rounded-full -mr-16 -mt-16 group-hover:bg-primary/20 transition-all duration-700"></div>

                    <div className="flex justify-between items-center mb-4 relative z-10">
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">Progresso de Entrega</p>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-3xl font-black text-white">{deliveredCount}</span>
                                <span className="text-slate-500 text-sm font-medium">/ {points.length} paradas</span>
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

                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden relative z-10 shadow-inner">
                        <div
                            className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(59,130,246,0.6)]"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>

                    <div className="mt-6 flex gap-3 relative z-10">
                        <button
                            onClick={handleOptimize}
                            disabled={isOptimizing || points.length < 2}
                            className="flex-1 h-12 glass-card rounded-2xl text-[10px] font-bold text-primary uppercase tracking-[0.15em] flex items-center justify-center gap-2 active:scale-95 transition-all border-white/10 hover:bg-white/10"
                        >
                            {isOptimizing ? (
                                <span className="material-symbols-outlined animate-spin !text-[18px]">sync</span>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined !text-[18px]">auto_awesome</span>
                                    <span>Roteirizar</span>
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleSendToMap}
                            disabled={loading || points.length === 0}
                            className="flex-1 h-12 glass-card rounded-2xl text-[10px] font-bold text-emerald-500 uppercase tracking-[0.15em] flex items-center justify-center gap-2 active:scale-95 transition-all border-white/10 hover:bg-white/10"
                        >
                            <span className="material-symbols-outlined !text-[18px]">satellite_alt</span>
                            <span>Enviar</span>
                        </button>
                        <button
                            onClick={handleClearAll}
                            className="w-12 h-12 glass-card rounded-2xl text-red-500/60 hover:text-red-500 active:scale-95 transition-all border-red-500/10 hover:bg-red-500/5 flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined">delete_sweep</span>
                        </button>
                    </div>
                </section>

                {/* Timeline List */}
                <section className="space-y-2 relative">
                    {points.length > 0 && (
                        <div className="absolute left-[19px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-primary/40 to-white/5 opacity-20"></div>
                    )}

                    {points.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                            <div className="size-20 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined !text-[32px]">route</span>
                            </div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white">Rota Vazia</h3>
                            <p className="text-[10px] uppercase mt-2 font-medium text-slate-500">Escaneie etiquetas para popular o protocolo</p>
                        </div>
                    ) : (
                        points.map((p, idx) => {
                            const isNext = idx === firstPendingIndex;
                            const isDone = p.isDelivered;

                            return (
                                <div key={p.id} className="relative pl-12 pb-8 group animate-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
                                    {/* Icon Indicator */}
                                    <div
                                        onClick={() => handleToggleDelivered(p.id)}
                                        className={`absolute left-0 top-1.5 size-10 rounded-full flex items-center justify-center z-10 transition-all cursor-pointer ${isDone
                                            ? 'bg-emerald-500/20 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                            : isNext
                                                ? 'bg-primary border-4 border-bg-start shadow-[0_0_20px_rgba(59,130,246,0.5)] ring-4 ring-primary/10'
                                                : 'bg-white/5 border border-white/10'
                                            }`}
                                    >
                                        {isDone ? (
                                            <span className="material-symbols-outlined text-emerald-500 !text-[20px]">check</span>
                                        ) : isNext ? (
                                            <span className="material-symbols-outlined text-white animate-pulse !text-[22px]">navigation</span>
                                        ) : (
                                            <span className="text-[12px] font-black text-slate-500">{(idx + 1).toString().padStart(2, '0')}</span>
                                        )}
                                    </div>

                                    {/* Card */}
                                    <div className={`glass-card rounded-[2rem] p-6 transition-all ${isDone
                                        ? 'opacity-40 grayscale-[0.5]'
                                        : isNext
                                            ? 'border-primary/30 bg-primary/5 shadow-premium'
                                            : 'border-white/5'
                                        }`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${isDone ? 'text-emerald-400' : isNext ? 'text-primary' : 'text-slate-500'
                                                }`}>
                                                {isDone ? 'Missão Concluída' : isNext ? 'Próxima Parada' : `Etapa ${(idx + 1).toString().padStart(2, '0')}`}
                                            </span>
                                            {isNext && (
                                                <div className="bg-primary/20 px-2 py-0.5 rounded text-[8px] font-black text-primary uppercase tracking-widest animate-pulse">Prioridade IA</div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <button onClick={(e) => handleEdit(p, e)} className="text-slate-500/60 hover:text-primary transition-colors">
                                                    <span className="material-symbols-outlined !text-[18px]">edit</span>
                                                </button>
                                                <button onClick={(e) => handleDelete(p.id, e)} className="text-red-500/40 hover:text-red-500 transition-colors">
                                                    <span className="material-symbols-outlined !text-[18px]">delete</span>
                                                </button>
                                            </div>
                                        </div>

                                        <h3 className={`font-bold text-lg tracking-tight ${isDone ? 'text-slate-400 line-through' : 'text-white/90'}`}>
                                            {p.name}
                                        </h3>
                                        <p className="text-sm text-slate-400 mt-1 font-medium opacity-80">
                                            {p.neighborhood || 'Bairro ñ identificado'} • {p.city || 'Cidade ñ def.'}
                                        </p>

                                        {isNext && (
                                            <div className="mt-6 flex gap-3">
                                                <button
                                                    onClick={onNavigateToMap}
                                                    className="flex-1 h-12 bg-white text-bg-start font-black text-[12px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl"
                                                >
                                                    <span className="material-symbols-outlined !text-[20px]">navigation</span>
                                                    Navegar
                                                </button>
                                                <button className="size-12 glass-card rounded-2xl flex items-center justify-center text-white active:scale-95 transition-all border-white/10 hover:bg-white/10">
                                                    <span className="material-symbols-outlined !text-[22px]">phone</span>
                                                </button>
                                                <button className="size-12 glass-card rounded-2xl flex items-center justify-center text-slate-400 active:scale-95 transition-all border-white/5 hover:bg-white/10">
                                                    <span className="material-symbols-outlined !text-[22px]">more_horiz</span>
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
            <div className="fixed bottom-32 right-6 z-50">
                <button
                    onClick={onNavigateToScanner}
                    className="size-16 rounded-full bg-primary text-white shadow-fab flex items-center justify-center active:scale-90 transition-all border border-white/20 group relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary via-accent to-white opacity-20 group-hover:opacity-40 transition-opacity"></div>
                    <span className="material-symbols-outlined !text-[32px] group-hover:rotate-90 transition-all duration-500">add</span>
                </button>
            </div>

            {/* Nav Fade Overlay */}
            <nav className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-bg-start via-bg-start/80 to-transparent pointer-events-none z-10"></nav>

            {/* AI Optimization Overlay */}
            {isOptimizing && (
                <div className="fixed inset-0 z-[10000] bg-black/95 flex flex-col items-center justify-center p-8 backdrop-blur-3xl animate-in fade-in duration-500">
                    <div className="relative size-48 flex items-center justify-center mb-12">
                        <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-[ping_3s_infinite]" />
                        <div className="absolute inset-4 rounded-full border-2 border-primary/40 animate-[ping_2s_infinite]" />
                        <div className="absolute inset-0 border-t-4 border-primary rounded-full animate-spin" />
                        <span className="material-symbols-outlined !text-[64px] text-primary animate-pulse">auto_awesome</span>
                    </div>
                    <h2 className="text-2xl font-black italic uppercase tracking-widest text-white mb-3 text-center tracking-tighter">Otimizador Neural™</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.4em] text-center max-w-xs leading-loose">{optimizationLog}</p>
                    <div className="mt-12 flex gap-1">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="size-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
