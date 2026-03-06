import { useState, useEffect, useRef } from 'react';
import { getDailyRoute, updateDailyRoute, removeFromDailyRoute, clearDailyRoute, getActiveRoute, updateActiveRoute } from '../services/db';
import type { RoutePoint } from '../services/db';
import { Route, MapPinned, Trash2, CheckSquare, Square, X, Sparkles, Loader2, LocateFixed, Trash } from 'lucide-react';

interface DailyRouteViewProps {
    onNavigateToMap?: () => void;
}

// Haversine distance in km
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const DailyRouteView = ({ onNavigateToMap }: DailyRouteViewProps) => {
    const [points, setPoints] = useState<RoutePoint[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isOptimized, setIsOptimized] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        loadPoints();
        // Get user location for optimization
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => { },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }
    }, []);

    const loadPoints = async () => {
        const data = await getDailyRoute();
        setPoints(data);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === points.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(points.map(p => p.id)));
        }
    };

    const handleDelete = async (id: string) => {
        const updated = await removeFromDailyRoute(id);
        setPoints(updated);
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Excluir ${selectedIds.size} endereço(s)?`)) return;
        let current = points;
        for (const id of selectedIds) {
            current = current.filter(p => p.id !== id);
        }
        await updateDailyRoute(current);
        setPoints(current);
        setSelectedIds(new Set());
    };

    const handleClearAll = async () => {
        if (!confirm('Limpar toda a Rota do Dia?')) return;
        await clearDailyRoute();
        setPoints([]);
        setSelectedIds(new Set());
        setIsOptimized(false);
    };

    // Nearest Neighbor Algorithm
    const handleOptimize = async () => {
        const validPoints = points.filter(p => p.lat !== null && p.lng !== null && p.lat !== 0 && p.lng !== 0);
        const invalidPoints = points.filter(p => p.lat === null || p.lng === null || p.lat === 0 || p.lng === 0);

        if (validPoints.length < 2) {
            alert('Adicione pelo menos 2 endereços com coordenadas para otimizar.');
            return;
        }

        setIsOptimizing(true);

        // Simulate processing time for UX
        await new Promise(r => setTimeout(r, 1500));

        // Start from user location or first point
        let currentLat = userLocation?.lat ?? validPoints[0].lat!;
        let currentLng = userLocation?.lng ?? validPoints[0].lng!;

        const unvisited = [...validPoints];
        const optimized: RoutePoint[] = [];

        while (unvisited.length > 0) {
            let nearestIndex = 0;
            let nearestDist = Infinity;

            for (let i = 0; i < unvisited.length; i++) {
                const dist = haversine(currentLat, currentLng, unvisited[i].lat!, unvisited[i].lng!);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestIndex = i;
                }
            }

            const nearest = unvisited.splice(nearestIndex, 1)[0];
            optimized.push(nearest);
            currentLat = nearest.lat!;
            currentLng = nearest.lng!;
        }

        // Add invalid points at the end
        const finalOrder = [...optimized, ...invalidPoints].map((p, i) => ({
            ...p,
            scannedAt: Date.now() + i * 1000
        }));

        await updateDailyRoute(finalOrder);
        setPoints(finalOrder);
        setIsOptimized(true);
        setIsOptimizing(false);
    };

    // Send to map
    const handleSendToMap = async () => {
        const toSend = selectedIds.size > 0
            ? points.filter(p => selectedIds.has(p.id))
            : points;

        if (toSend.length === 0) return;

        setIsSending(true);

        try {
            const currentRoute = await getActiveRoute();
            const existingIds = new Set(currentRoute.map(p => p.id));
            const newPoints = toSend.filter(p => !existingIds.has(p.id));

            const finalRoute = [
                ...currentRoute.filter(p => p.id !== 'current'),
                ...newPoints.map((p, i) => ({ ...p, scannedAt: Date.now() + i * 1000 }))
            ];

            await updateActiveRoute(finalRoute);

            // Os endereços são enviados à tela de rota, não precisam ser excluídos após serem adicionados.
            setSelectedIds(new Set());
            setIsSending(false);

            if (onNavigateToMap) onNavigateToMap();
        } catch (err) {
            console.error(err);
            alert('Erro ao enviar para o mapa.');
            setIsSending(false);
        }
    };

    const handleLongPress = (id: string) => {
        timerRef.current = setTimeout(() => {
            toggleSelect(id);
            if (navigator.vibrate) navigator.vibrate(30);
        }, 500);
    };

    const cancelLongPress = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const pendingGeocode = points.filter(p => p.lat === null || p.lng === null || p.lat === 0 || p.lng === 0);

    return (
        <div className="relative w-full h-full bg-black overflow-y-auto pt-safe pb-32">
            {/* Header */}
            <div className="sticky top-0 z-30 w-full animate-fade-in pointer-events-none">
                <div className="bg-zinc-950/40 backdrop-blur-2xl border-b border-white/5 p-6 pointer-events-auto">
                    <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase leading-none">Rota do Dia</h1>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,1)]" />
                                <p className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.2em]">{points.length} Paradas</p>
                                {isOptimized && (
                                    <span className="text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-black uppercase">Otimizada</span>
                                )}
                            </div>
                        </div>
                        {points.length > 0 && (
                            <button onClick={handleClearAll} className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 hover:bg-red-500/20 transition-all">
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>

                    {/* Action Buttons */}
                    {points.length > 0 && (
                        <div className="flex gap-3">
                            <button
                                onClick={handleOptimize}
                                disabled={isOptimizing || points.length < 2}
                                className="flex-1 bg-blue-600/10 border border-blue-500/20 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-blue-500 hover:bg-blue-600/20 transition-all active:scale-95 disabled:opacity-30"
                            >
                                {isOptimizing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                <span className="text-[10px] font-black uppercase tracking-wider">Roteirizar</span>
                            </button>
                            <button
                                onClick={handleSendToMap}
                                disabled={isSending}
                                className="flex-1 bg-emerald-500/10 border border-emerald-500/20 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-emerald-400 hover:bg-emerald-500/20 transition-all active:scale-95 disabled:opacity-30 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                            >
                                {isSending ? <Loader2 size={16} className="animate-spin" /> : <MapPinned size={16} />}
                                <span className="text-[10px] font-black uppercase tracking-wider">
                                    {selectedIds.size > 0 ? `Enviar ${selectedIds.size}` : 'Enviar ao Mapa'}
                                </span>
                            </button>
                        </div>
                    )}

                    {/* Selection bar */}
                    {selectedIds.size > 0 && (
                        <div className="mt-3 flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-2.5">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setSelectedIds(new Set())} className="text-zinc-500 hover:text-white p-1">
                                    <X size={16} />
                                </button>
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{selectedIds.size} selecionados</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={toggleSelectAll} className="flex items-center gap-1 text-blue-400 p-1">
                                    {selectedIds.size === points.length ? <CheckSquare size={16} /> : <Square size={16} />}
                                    <span className="text-[8px] font-black uppercase">Todos</span>
                                </button>
                                <button onClick={handleBulkDelete} className="flex items-center gap-1 text-red-500 p-1">
                                    <Trash2 size={16} />
                                    <span className="text-[8px] font-black uppercase">Excluir</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Pending geocode info */}
            {pendingGeocode.length > 0 && (
                <div className="mx-6 mt-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
                    <LocateFixed size={16} className="text-amber-500 animate-pulse" />
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider">
                        {pendingGeocode.length} endereço(s) aguardando localização GPS
                    </p>
                </div>
            )}

            {/* Point list */}
            <div className="px-6 mt-4 space-y-3">
                {points.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-6 animate-fade-in">
                        <div className="w-24 h-24 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center">
                            <Route size={40} className="text-zinc-700" />
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-black italic text-zinc-600 uppercase">Nenhuma parada</h3>
                            <p className="text-zinc-700 text-xs max-w-[200px]">
                                Escaneie endereços na tela de <span className="text-blue-500 font-bold">Scan</span> para adicioná-los aqui.
                            </p>
                        </div>
                    </div>
                ) : (
                    points.map((p, idx) => (
                        <div
                            key={p.id}
                            onClick={() => selectedIds.size > 0 ? toggleSelect(p.id) : null}
                            onMouseDown={() => handleLongPress(p.id)}
                            onMouseUp={cancelLongPress}
                            onMouseLeave={cancelLongPress}
                            onTouchStart={() => handleLongPress(p.id)}
                            onTouchEnd={cancelLongPress}
                            className={`relative bg-white/[0.02] border rounded-3xl p-5 flex items-center gap-4 transition-all active:scale-[0.98] cursor-pointer group ${selectedIds.has(p.id)
                                ? 'border-blue-500/30 bg-blue-500/5'
                                : 'border-white/5 hover:border-white/10'
                                }`}
                        >
                            {/* Order badge */}
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black italic shrink-0 shadow-lg ${isOptimized ? 'bg-blue-600' : 'bg-zinc-800'
                                }`}>
                                {selectedIds.has(p.id) ? (
                                    <CheckSquare size={18} className="text-blue-400" />
                                ) : (
                                    <span className="text-sm">#{idx + 1}</span>
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-black uppercase text-[11px] truncate leading-tight">{p.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    {p.neighborhood && (
                                        <span className="text-zinc-500 text-[9px] uppercase tracking-widest truncate">{p.neighborhood}</span>
                                    )}
                                    {p.city && (
                                        <span className="text-zinc-600 text-[9px] truncate">• {p.city}</span>
                                    )}
                                </div>
                                {(p.lat === null || p.lng === null || p.lat === 0 || p.lng === 0) && (
                                    <span className="text-[7px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-black uppercase mt-1 inline-block">Sem GPS</span>
                                )}
                            </div>

                            {/* Delete */}
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                                className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-zinc-600 hover:text-red-500 hover:border-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                            >
                                <Trash size={14} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Optimization overlay */}
            {isOptimizing && (
                <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-center justify-center">
                    <div className="bg-zinc-900/90 border border-white/10 p-10 rounded-[3rem] flex flex-col items-center gap-6 shadow-2xl">
                        <div className="relative">
                            <Sparkles size={40} className="text-blue-500 animate-pulse" />
                            <div className="absolute inset-0 blur-xl bg-blue-500/30 rounded-full animate-ping" />
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-black italic text-white uppercase">Otimizando Rota</h3>
                            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Algoritmo de vizinho mais próximo</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
