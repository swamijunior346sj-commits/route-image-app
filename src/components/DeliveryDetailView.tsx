interface DeliveryDetailViewProps {
    delivery: {
        id: string;
        name: string;
        address: string;
        neighborhood: string;
        isDelivered: boolean;
        distance: string;
        eta: string;
        lat?: string;
        lng?: string;
        img?: string;
        notes?: string;
    };
    onBack?: () => void;
    onNavigateToMap?: () => void;
}

export const DeliveryDetailView = ({ delivery, onBack, onNavigateToMap }: DeliveryDetailViewProps) => {
    return (
        <div className="fixed inset-0 z-[200] bg-bg-start flex flex-col font-sans overflow-hidden">
            <header className="sticky top-0 z-50 pt-14 pb-5 px-6 flex items-center justify-between backdrop-blur-3xl bg-bg-start/80 border-b border-white/5">
                <button
                    onClick={onBack}
                    className="flex items-center justify-center size-12 rounded-[1.25rem] bg-white/5 border border-white/10 text-white/90 active:scale-95 transition-all"
                >
                    <span className="material-symbols-outlined !text-[24px]">arrow_back_ios_new</span>
                </button>
                <div className="text-center flex flex-col items-center">
                    <span className="text-[10px] uppercase font-black tracking-[0.3em] text-primary/80 mb-0.5">Visão do Alvo</span>
                    <h1 className="text-white font-black text-xl tracking-tighter italic">Detalhamento</h1>
                </div>
                <button className="flex items-center justify-center size-12 rounded-[1.25rem] bg-white/5 border border-white/10 text-slate-400 active:scale-95 transition-all">
                    <span className="material-symbols-outlined !text-[24px]">share</span>
                </button>
            </header>

            <main className="flex-1 overflow-y-auto px-6 py-8 space-y-8 no-scrollbar pb-40">
                {/* Visual ID Card */}
                <section className="relative">
                    <div className="glass-card rounded-[2.5rem] overflow-hidden group">
                        <div className="relative aspect-[16/10] bg-bg-graphite">
                            {delivery.img ? (
                                <img src={delivery.img} className="w-full h-full object-cover" alt="Delivery" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-white/5">
                                    <span className="material-symbols-outlined !text-[56px] text-white/10">photo_library</span>
                                </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent"></div>
                            <div className="absolute bottom-5 left-6">
                                <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${delivery.isDelivered ? 'bg-emerald-500 text-white' : 'bg-primary text-white shadow-lg'}`}>
                                    {delivery.isDelivered ? 'Protocolo Finalizado' : 'Intervenção Necessária'}
                                </span>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <h1 className="text-2xl font-black text-white/90 tracking-tight leading-tight uppercase italic">{delivery.name}</h1>
                                <p className="text-slate-400 font-medium text-sm mt-1 flex items-center gap-2">
                                    <span className="material-symbols-outlined !text-[18px] text-primary/60">location_on</span>
                                    {delivery.neighborhood ? `${delivery.neighborhood}, ` : ''}{delivery.address}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Metrics Grid */}
                <section className="grid grid-cols-2 gap-4">
                    <div className="glass-card rounded-3xl p-5 border-white/5 hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined text-primary mb-3">distance</span>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Distância</p>
                        <p className="text-xl font-black text-white">{delivery.distance}</p>
                    </div>
                    <div className="glass-card rounded-3xl p-5 border-white/5 hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined text-accent mb-3">schedule</span>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Previsão</p>
                        <p className="text-xl font-black text-white">{delivery.eta}</p>
                    </div>
                </section>

                {/* Context & Notes */}
                <section className="space-y-4">
                    <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-slate-500 ml-1 opacity-60">Observações Operacionais</h3>
                    <div className="glass-card rounded-[2rem] p-6 border-white/5">
                        <div className="flex items-start gap-4">
                            <div className="size-10 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 shrink-0">
                                <span className="material-symbols-outlined !text-[20px]">sticky_note</span>
                            </div>
                            <p className="text-sm text-slate-400 font-medium leading-relaxed italic">
                                "{delivery.notes || 'Sem observações táticas registradas para este alvo.'}"
                            </p>
                        </div>
                    </div>
                </section>

                {/* Logistics Trace */}
                <section className="space-y-4">
                    <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-slate-500 ml-1 opacity-60">Rastro Logístico</h3>
                    <div className="glass-card rounded-[2rem] p-6 border-white/5 divide-y divide-white/5">
                        <div className="flex items-center justify-between pb-4">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined !text-[18px] text-slate-600">inventory_2</span>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Protocolo ID</span>
                            </div>
                            <span className="text-xs font-mono font-black text-white italic">#RV-{delivery.id.slice(0, 6).toUpperCase()}</span>
                        </div>
                        <div className="flex items-center justify-between pt-4">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined !text-[18px] text-slate-600">map</span>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Coordenadas</span>
                            </div>
                            <span className="text-xs font-mono font-black text-white italic">{delivery.lat || '00.000'}, {delivery.lng || '00.000'}</span>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="fixed bottom-0 left-0 right-0 p-6 pb-12 z-50 bg-gradient-to-t from-bg-start via-bg-start/95 to-transparent flex gap-3">
                <button
                    onClick={onBack}
                    className="size-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all"
                >
                    <span className="material-symbols-outlined !text-[24px]">phone</span>
                </button>
                <button
                    onClick={onNavigateToMap}
                    className="flex-1 h-16 bg-primary text-white text-sm font-black italic uppercase tracking-[0.3em] rounded-2xl shadow-fab active:scale-[0.96] transition-all flex items-center justify-center gap-3 group"
                >
                    <span className="material-symbols-outlined !text-[24px]">navigation</span>
                    <span>INICIAR ROTA</span>
                </button>
            </footer>
        </div>
    );
};
