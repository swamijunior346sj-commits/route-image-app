import { useState, useEffect, useCallback } from 'react';
import {
    getDailyRoute,
    updateDailyRoute,
    updateActiveRoute,
    removeFromDailyRoute,
    type RoutePoint
} from '../services/db';
import { EditAddressView } from './EditAddressView';
import { LoadingOverlay } from './LoadingOverlay';

interface DailyRouteViewProps {
    onNavigateToMap?: () => void;
    onNavigateToScanner?: () => void;
    onBack?: () => void;
}

interface RouteCardProps {
    p: RoutePoint;
    idx: number;
    isNext: boolean;
    onToggleDelivered: (id: string) => void;
    onEdit: (point: RoutePoint, e: React.MouseEvent) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onNotDelivered: (id: string) => void;
    onNavigateToMap?: () => void;
    isRecent?: boolean;
}

const RouteCard = ({ p, idx, isNext, onToggleDelivered, onEdit, onDelete, onNotDelivered, isRecent }: RouteCardProps) => {
    const isDone = p.isDelivered;

    return (
        <div className="relative pl-12 pb-8 group animate-slide-up">
            {/* Icon Indicator */}
            <div
                onClick={() => onToggleDelivered(p.id)}
                className={`absolute left-0 top-1.5 size-10 rounded-full flex items-center justify-center z-10 transition-all cursor-pointer ${isDone
                    ? 'bg-emerald-500/20 border border-emerald-500/30'
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
                } ${isRecent ? 'ring-2 ring-primary/20' : ''}`}>
                <div className="flex justify-between items-start mb-3">
                    <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${isDone ? 'text-emerald-400' : isNext ? 'text-primary' : isRecent ? 'text-primary' : 'text-slate-500'
                        }`}>
                        {isDone ? 'Missão Concluída' : isNext ? 'Próxima Parada' : isRecent ? 'Recém Sincronizado' : `Etapa ${(idx + 1).toString().padStart(2, '0')}`}
                    </span>
                    <div className="flex items-center gap-2">
                        <button onClick={(e) => onEdit(p, e)} className="text-slate-500/60 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined !text-[18px]">edit</span>
                        </button>
                        <button onClick={(e) => onDelete(p.id, e)} className="text-red-500/40 hover:text-red-500 transition-colors">
                            <span className="material-symbols-outlined !text-[18px]">delete</span>
                        </button>
                    </div>
                </div>

                <p className="text-[10px] font-black uppercase tracking-widest text-primary truncate mb-0.5 mt-2">
                    ID: {p.id.substring(p.id.length - 6).toUpperCase()}
                </p>
                <h3 className={`font-bold text-lg tracking-tight leading-tight ${isDone ? 'text-slate-400 line-through' : 'text-white/90'}`}>
                    {p.name}
                </h3>
                <p className="text-sm text-slate-400 mt-1 font-medium opacity-80">
                    {p.neighborhood || 'Bairro ñ identificado'} • {p.city || 'Cidade ñ def.'}
                </p>

                {p.notes && (
                    <div className="mt-3 pl-3 border-l-[3px] border-amber-400/50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/90 block mb-0.5">Observações</span>
                        <p className="text-sm font-medium text-slate-300">{p.notes}</p>
                    </div>
                )}

                {p.deadline && (
                    <div className="mt-3 flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full w-fit">
                        <span className="material-symbols-outlined !text-[14px] text-red-500">schedule</span>
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Entrega até {p.deadline}</span>
                    </div>
                )}

                {p.isReturnPoint && (
                    <div className="mt-3 flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full w-fit">
                        <span className="material-symbols-outlined !text-[14px] text-primary">warehouse</span>
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Ponto de Retorno (Base)</span>
                    </div>
                )}

                {isNext && (
                    <div className="mt-6 flex justify-between gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex gap-2">
                            <button className="size-12 shrink-0 rounded-2xl bg-[#1E293B] border border-white/5 flex items-center justify-center text-[#25D366] active:scale-95 transition-all shadow-[0_10px_20px_rgba(37,211,102,0.1)]"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const phoneMatch = p.notes?.match(/\d{10,14}/);
                                    const phone = phoneMatch ? phoneMatch[0] : '5511000000000';
                                    window.open(`https://wa.me/${phone}`, '_blank');
                                }}
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex gap-2 flex-1 min-w-0">
                            <button
                                onClick={() => onNotDelivered(p.id)}
                                className="flex-1 h-12 bg-red-500 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl flex flex-col items-center justify-center -gap-1 active:scale-95 transition-all shadow-[0_10px_20px_rgba(239,68,68,0.3)]"
                            >
                                <span className="material-symbols-outlined !text-[16px]">package_2</span>
                                FALHA
                            </button>
                            <button
                                onClick={() => onToggleDelivered(p.id)}
                                className="flex-1 h-12 bg-emerald-500 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl flex flex-col items-center justify-center -gap-1 active:scale-95 transition-all shadow-[0_10px_20px_rgba(16,185,129,0.3)]"
                            >
                                <span className="material-symbols-outlined !text-[16px]">package_2</span>
                                FEITO
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const DailyRouteView = ({ onNavigateToMap, onNavigateToScanner, onBack }: DailyRouteViewProps) => {
    const [points, setPoints] = useState<RoutePoint[]>([]);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizationLog, setOptimizationLog] = useState('');
    const [editingPoint, setEditingPoint] = useState<RoutePoint | null>(null);
    const [loading, setLoading] = useState(false);

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



    const handleOptimize = async () => {
        if (points.length < 2) return;
        setIsOptimizing(true);
        setOptimizationLog('Iniciando Motores de IA...');

        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
            });
            const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };

            const pointsToOptimize = points.filter(p => p.lat !== null && p.lng !== null);
            const pointsWithoutCoords = points.filter(p => p.lat === null || p.lng === null);

            if (pointsToOptimize.length === 0) {
                setIsOptimizing(false);
                return;
            }

            const service = new google.maps.DistanceMatrixService();
            const response = await service.getDistanceMatrix({
                origins: [origin],
                destinations: pointsToOptimize.map(p => ({ lat: p.lat!, lng: p.lng! })),
                travelMode: google.maps.TravelMode.DRIVING,
            });

            if (response.rows[0].elements) {
                const distances = response.rows[0].elements.map((el, idx) => ({
                    index: idx,
                    distance: el.distance?.value || 999999,
                }));

                const sortedPoints = [...pointsToOptimize].sort((a, b) => {
                    // Always put return base at the very end
                    if (a.isReturnPoint) return 1;
                    if (b.isReturnPoint) return -1;

                    // Prioritize by Deadline (Earliest first)
                    if (a.deadline && b.deadline) {
                        return a.deadline.localeCompare(b.deadline);
                    }
                    if (a.deadline) return -1;
                    if (b.deadline) return 1;

                    // If no deadlines, sort by physical distance
                    const distA = distances.find(d => pointsToOptimize[d.index].id === a.id)?.distance || 0;
                    const distB = distances.find(d => pointsToOptimize[d.index].id === b.id)?.distance || 0;
                    return distA - distB;
                });

                const finalRoute = [...sortedPoints, ...pointsWithoutCoords].map(p => ({ ...p, isRecent: false })); // Reset recent on optimization
                setPoints(finalRoute);
                await updateDailyRoute(finalRoute);
            }
        } catch (error) {
            console.error('Optimization failed:', error);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleToggleDelivered = async (id: string) => {
        const updated = points.map(p => p.id === id ? { ...p, isDelivered: !p.isDelivered, isRecent: false } : p);
        setPoints(updated);
        await updateDailyRoute(updated);
        loadData();
    };

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const updated = await removeFromDailyRoute(id);
        const data = updated;
        setPoints(data);

        const delivered = data.filter(p => p.isDelivered).length;
        setDeliveredCount(delivered);
        setProgressPercent(data.length > 0 ? Math.round((delivered / data.length) * 100) : 0);
    };

    const handleNotDelivered = async (id: string) => {
        // Simple skip logic for now - could add a 'failed' status later
        const updated = points.map(p => p.id === id ? { ...p, isDelivered: false, isRecent: false, tag: 'FAILED' } : p);
        if (navigator.vibrate) navigator.vibrate(100);

        // Find the index of the point just marked
        // setPoints(updated); // already done below

        // Move failed item to end or just keep it there but skip it
        // For simplicity, we'll just toggle the 'next' indicator by updating the list
        setPoints(updated);
        await updateDailyRoute(updated);
        loadData();
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
            await updateActiveRoute(points.map(p => ({ ...p, isRecent: false })));
            onNavigateToMap?.();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (editingPoint) {
        return (
            <EditAddressView
                item={editingPoint}
                onSave={handleSaveEdit}
                onBack={() => setEditingPoint(null)}
            />
        );
    }

    const firstPendingIndex = points.findIndex(p => !p.isDelivered);
    const recentPoints = points.filter(p => p.isRecent);
    const standardPoints = points.filter(p => !p.isRecent);

    return (
        <div className="relative w-full h-full bg-bg-start overflow-hidden flex flex-col font-sans">
            <header className="pt-24 px-6 pb-6 bg-transparent z-10">
                <div className="flex justify-between items-center mb-6">
                    <div className="w-12 h-12"></div> {/* Spacer for global hamburger menu on top-left to avoid any possible touch targets */}
                    <div className="flex gap-3">
                        <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2 border-white/5 shadow-premium">
                            <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Online</span>
                        </div>
                        <button onClick={onBack} className="size-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/90 shadow-premium active:scale-95 transition-all">
                            <span className="material-symbols-outlined !text-[20px]">arrow_back</span>
                        </button>
                    </div>
                </div>
                <div className="space-y-1">
                    <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase opacity-60">Roteiro do Dia</span>
                    <h1 className="text-3xl font-black tracking-tight text-white/90 italic">Minha Rota</h1>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-6 pb-40 no-scrollbar">
                {/* Stats & Actions */}
                <section className="glass-card rounded-[2.5rem] p-6 mb-10 border-white/5">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">Progresso</p>
                            <p className="text-3xl font-black text-white mt-1">{deliveredCount}<span className="text-slate-500 text-lg">/{points.length}</span></p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">Eficiência</p>
                            <p className="text-3xl font-black text-primary mt-1">{progressPercent}%</p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={handleOptimize} disabled={isOptimizing || points.length < 2} className="flex-1 h-12 glass-card rounded-2xl text-[10px] font-black text-primary uppercase tracking-widest flex items-center justify-center gap-2 border-primary/20 bg-primary/5">
                            <span className="material-symbols-outlined !text-[20px]">auto_awesome</span>
                            Otimizar
                        </button>
                        <button onClick={handleSendToMap} disabled={loading || points.length === 0} className="flex-1 h-12 glass-card rounded-2xl text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center justify-center gap-2 border-emerald-500/20 bg-emerald-500/5">
                            <span className="material-symbols-outlined !text-[20px]">satellite_alt</span>
                            Enviar
                        </button>
                    </div>
                </section>

                {/* List Sections */}
                <section className="space-y-12">
                    {points.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-20 border-2 border-dashed border-white/10 rounded-[3rem]">
                            <span className="material-symbols-outlined !text-[60px]">barcode_scanner</span>
                            <p className="text-xs font-black uppercase mt-4 tracking-widest text-center px-10">Aguardando Protocolos via Cockpit</p>
                        </div>
                    ) : (
                        <>
                            {recentPoints.length > 0 && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4 ml-1">
                                        <div className="size-2 bg-primary rounded-full animate-ping"></div>
                                        <h3 className="text-[12px] font-black tracking-widest uppercase text-primary">Recém Sincronizados</h3>
                                        <div className="h-[1px] flex-1 bg-primary/20"></div>
                                    </div>
                                    {recentPoints.map((p) => (
                                        <RouteCard
                                            key={p.id}
                                            p={p}
                                            idx={points.indexOf(p)}
                                            isNext={points.indexOf(p) === firstPendingIndex}
                                            onToggleDelivered={handleToggleDelivered}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                            onNotDelivered={handleNotDelivered}
                                            isRecent
                                        />
                                    ))}
                                </div>
                            )}

                            <div className="space-y-6">
                                {recentPoints.length > 0 && (
                                    <div className="flex items-center gap-4 ml-1 pt-4">
                                        <h3 className="text-[12px] font-black tracking-widest uppercase text-slate-500 opacity-50">Fluxo de Rota</h3>
                                        <div className="h-[1px] flex-1 bg-white/5"></div>
                                    </div>
                                )}
                                {standardPoints.map((p) => (
                                    <RouteCard
                                        key={p.id}
                                        p={p}
                                        idx={points.indexOf(p)}
                                        isNext={points.indexOf(p) === firstPendingIndex}
                                        onToggleDelivered={handleToggleDelivered}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                        onNotDelivered={handleNotDelivered}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </section>
            </main>

            <div className="fixed bottom-32 right-6 z-50">
                <button onClick={onNavigateToScanner} className="size-16 rounded-full bg-primary text-white shadow-fab flex items-center justify-center active:scale-90 transition-all border border-white/20 group relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary via-accent to-white opacity-20 group-hover:opacity-40 transition-opacity"></div>
                    <span className="material-symbols-outlined !text-[32px] group-hover:rotate-90 transition-all duration-500">add</span>
                </button>
            </div>

            <nav className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-bg-start via-bg-start/80 to-transparent pointer-events-none z-10"></nav>

            {isOptimizing && (
                <LoadingOverlay title="Otimizador Neural™" subtitle={optimizationLog} />
            )}
        </div>
    );
};
