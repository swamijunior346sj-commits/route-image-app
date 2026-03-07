import type { LocationPoint } from '../App';
import { archiveCurrentRoute, deletePoint, saveToActiveRoute, clearActiveRoute } from '../services/db';
import { optimizeRoute } from '../services/gemini';
import { useState } from 'react';

interface RouteListProps {
    points: LocationPoint[];
    onRefresh: () => void;
    onToggleStatus?: (id: string, currentStatus: string) => void;
    onStartInternalNav?: () => void;
}

export const RouteListView = ({ points, onRefresh, onToggleStatus, onStartInternalNav }: RouteListProps) => {

    const handleToggleLocal = (id: string, status: string) => {
        if (onToggleStatus) onToggleStatus(id, status);
    };

    const handleDelete = async (id: string, name: string) => {
        if (confirm(`Remover "${name}" da rota?`)) {
            try {
                await deletePoint(id);
                onRefresh();
            } catch (error) {
                console.error(error);
            }
        }
    };

    const handleClear = async () => {
        if (points.length === 0) return;

        if (confirm("Deseja finalizar e arquivar esta rota no histórico?")) {
            try {
                await archiveCurrentRoute(points);
                onRefresh();
                alert("Rota arquivada com sucesso!");
            } catch (error) {
                console.error(error);
                alert("Erro ao arquivar rota.");
            }
        }
    };

    const [isOptimizing, setIsOptimizing] = useState(false);

    const handleOptimize = async () => {
        if (points.length < 2) return;

        setIsOptimizing(true);
        try {
            const optimizedIds = await optimizeRoute(points);
            if (optimizedIds && optimizedIds.length > 0) {
                await clearActiveRoute();
                for (const id of optimizedIds) {
                    const p = points.find(point => point.id === id);
                    if (p) {
                        await saveToActiveRoute({
                            name: p.name,
                            address: p.address,
                            lat: p.lat,
                            lng: p.lng,
                            neighborhood: p.neighborhood,
                            city: p.city,
                            notes: p.notes
                        });
                    }
                }
                onRefresh();
                alert("Rota otimizada com sucesso pela IA!");
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao otimizar rota.");
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleExternalMaps = () => {
        const nextPoint = points.find(p => p.status === 'pending');
        if (!nextPoint) {
            alert("Todas as entregas foram concluídas!");
            return;
        }
        const url = `https://www.google.com/maps/dir/?api=1&destination=${nextPoint.lat},${nextPoint.lng}&travelmode=driving`;
        window.open(url, '_blank');
    };

    return (
        <div className="w-full h-full bg-slate-50 overflow-y-auto px-6 pt-12 pb-32 no-scrollbar">
            <header className="mb-10 animate-in fade-in duration-700 slide-in-from-top-4">
                <h1 className="text-4xl font-black text-slate-900 tracking-tightest">Minha Rota</h1>
                <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-2">{points.length} paradas registradas</p>
            </header>

            {points.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-in zoom-in-95 duration-500">
                    <div className="size-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 mb-6 border-2 border-dashed border-slate-200">
                        <span className="material-symbols-outlined !text-40px">receipt_long</span>
                    </div>
                    <p className="font-bold text-slate-500 max-w-[200px] leading-snug">Você ainda não escaneou nenhum pacote</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {points.map((p, idx) => (
                        <div key={p.id} className="group glass-morphism p-5 rounded-[2rem] shadow-sm border border-white hover:shadow-xl hover:-translate-y-1 transition-all animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                            <div className="flex gap-4">
                                <div
                                    onClick={() => handleToggleLocal(p.id, p.status)}
                                    className={`size-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg transition-all cursor-pointer ${p.status === 'delivered' ? 'bg-green-500' : 'bg-blue-600 shadow-blue-500/20 active:scale-90'}`}
                                >
                                    {p.status === 'delivered' ? (
                                        <span className="material-symbols-outlined">check</span>
                                    ) : (
                                        <span className="text-lg font-black">{idx + 1}</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className="font-bold text-slate-900 truncate">{p.name || 'Nova Parada'}</h3>
                                        <div className={`size-2 rounded-full ${p.status === 'delivered' ? 'bg-green-500' : 'bg-blue-600'}`}></div>
                                    </div>
                                    <p className="text-[13px] font-medium text-slate-400 line-clamp-2 leading-snug mb-3 text-left">
                                        {p.address}
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${p.status === 'delivered' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                            {p.status === 'delivered' ? 'Entregue' : 'Pendente'}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(p.id, p.name)}
                                    className="size-10 rounded-full bg-red-50 flex items-center justify-center text-red-300 hover:text-red-500 transition-colors self-center"
                                >
                                    <span className="material-symbols-outlined !text-[20px]">delete</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {points.length > 0 && (
                <div className="fixed bottom-24 left-6 right-6 z-40 flex flex-col gap-3">
                    <div className="flex gap-2">
                        <button
                            onClick={handleClear}
                            className="flex-1 h-14 bg-white/80 backdrop-blur-md rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 border border-slate-200"
                            title="Arquivar rota e limpar tudo"
                        >
                            Arquivar Dia
                        </button>
                        <button
                            onClick={handleOptimize}
                            disabled={isOptimizing || points.length < 2}
                            className="flex-[2] h-14 bg-slate-900 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined !text-16px">{isOptimizing ? 'refresh' : 'auto_awesome'}</span>
                            {isOptimizing ? 'Otimizando...' : 'Otimizar por IA'}
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExternalMaps}
                            className="flex-1 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-blue-600 shadow-xl active:scale-95 transition-all"
                        >
                            <span className="material-symbols-outlined !text-24px">directions</span>
                        </button>
                        <button
                            onClick={onStartInternalNav}
                            className="flex-[4] btn-primary h-16 !bg-blue-600 group shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            <span className="material-symbols-outlined">navigation</span>
                            <span className="text-[14px] font-black">Navegar no App</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
