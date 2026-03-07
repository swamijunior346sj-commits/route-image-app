import { useEffect, useState } from 'react';
import { getRouteHistory } from '../services/db';

interface HistoryItem {
    id: string;
    route_date: string;
    points_count: number;
    delivered_count: number;
    route_data: any[];
    created_at: string;
}

export const HistoryView = () => {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const data = await getRouteHistory();
            setHistory(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    if (isLoading) return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50">
            <div className="size-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Buscando Arquivos...</p>
        </div>
    );

    return (
        <div className="w-full h-full bg-slate-50 overflow-y-auto px-6 pt-12 pb-32 no-scrollbar">
            <header className="mb-10 animate-in fade-in duration-700 slide-in-from-top-4">
                <h1 className="text-4xl font-black text-slate-900 tracking-tightest">Histórico</h1>
                <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-2">Suas jornadas passadas</p>
            </header>

            {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-slate-300">
                    <span className="material-symbols-outlined !text-64px mb-4">history_toggle_off</span>
                    <p className="font-bold">Nenhum histórico encontrado ainda.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {history.map((item, idx) => (
                        <div key={item.id} className="group glass-morphism p-6 rounded-[2rem] border border-white hover:shadow-2xl hover:-translate-y-1 transition-all animate-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 100}ms` }}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                                        <span className="material-symbols-outlined !text-20px">calendar_today</span>
                                    </div>
                                    <h3 className="font-black text-slate-900">{formatDate(item.route_date)}</h3>
                                </div>
                                <div className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    Finalizada
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/50 rounded-2xl p-4 border border-white/50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de Paradas</p>
                                    <p className="text-2xl font-black text-slate-900">{item.points_count}</p>
                                </div>
                                <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Entregas</p>
                                    <p className="text-2xl font-black text-blue-600">{item.delivered_count}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => alert("Função para Re-visualizar Rota será implementada em breve!")}
                                className="w-full mt-4 h-12 rounded-xl bg-slate-100 flex items-center justify-center gap-2 text-slate-500 font-bold text-xs hover:bg-slate-200 transition-colors"
                            >
                                <span className="material-symbols-outlined !text-16px">visibility</span>
                                Ver Detalhes
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
