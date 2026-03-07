import type { LocationPoint } from '../App';

export const RouteListView = ({ points }: { points: LocationPoint[] }) => {
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
                                <div className="size-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/20">
                                    <span className="text-lg font-black">{idx + 1}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className="font-bold text-slate-900 truncate">{p.name || 'Nova Parada'}</h3>
                                        <div className="size-2 bg-blue-500 rounded-full"></div>
                                    </div>
                                    <p className="text-[13px] font-medium text-slate-400 line-clamp-2 leading-snug mb-3">
                                        {p.address}
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            {p.status}
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-300">Há pouco tempo</p>
                                    </div>
                                </div>
                                <button className="size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 self-center">
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {points.length > 0 && (
                <div className="fixed bottom-24 left-6 right-6 z-40">
                    <button className="btn-primary w-full h-16 !bg-slate-900 group">
                        <span className="material-symbols-outlined">directions_car</span>
                        <span className="text-[14px]">Otimizar e Iniciar Rota</span>
                    </button>
                </div>
            )}
        </div>
    );
};
