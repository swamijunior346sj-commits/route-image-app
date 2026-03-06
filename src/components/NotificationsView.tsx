interface NotificationsViewProps {
    onBack: () => void;
}

export const NotificationsView = ({ onBack }: NotificationsViewProps) => {
    return (
        <div className="fixed inset-0 z-[150] bg-bg-start flex flex-col font-sans animate-in fade-in slide-in-from-right duration-500 overflow-hidden">
            {/* Header HUD */}
            <header className="sticky top-0 z-50 px-6 pt-14 pb-6 backdrop-blur-3xl bg-bg-start/60 flex items-center justify-between border-b border-white/5">
                <button
                    onClick={onBack}
                    className="flex items-center justify-center size-12 rounded-[1.25rem] bg-white/5 border border-white/10 text-white/90 active:scale-95 transition-all"
                >
                    <span className="material-symbols-outlined !text-[24px]">arrow_back_ios_new</span>
                </button>
                <div className="text-center flex flex-col items-center">
                    <span className="text-[10px] uppercase font-black tracking-[0.3em] text-primary/80 mb-0.5">Sistemas</span>
                    <h1 className="text-white font-black text-xl tracking-tighter italic">Notificações</h1>
                </div>
                <button className="flex items-center justify-center size-12 rounded-[1.25rem] bg-white/5 border border-white/10 text-slate-400 active:scale-95 transition-all">
                    <span className="material-symbols-outlined !text-[24px]">done_all</span>
                </button>
            </header>

            <main className="flex-1 overflow-y-auto px-6 py-8 space-y-8 pb-32 no-scrollbar">
                {/* Today Section */}
                <section className="space-y-4">
                    <h2 className="text-[11px] font-black tracking-[0.2em] uppercase text-slate-500 ml-1 opacity-60">Hoje</h2>
                    <div className="space-y-3">
                        <div className="glass-card rounded-[2rem] p-5 flex gap-5 items-start active:bg-white/10 transition-all group">
                            <div className="size-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 border border-amber-500/20">
                                <span className="material-symbols-outlined !text-[24px]">warning</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="text-sm font-bold text-white/90 tracking-tight italic">Atraso na Coleta</h3>
                                    <span className="text-[10px] font-bold text-slate-500 mt-0.5 shrink-0 ml-2">AGORA</span>
                                </div>
                                <p className="text-[12px] leading-relaxed text-slate-400 font-medium opacity-80 italic line-clamp-2">O Centro de Distribuição Norte reportou um pequeno atraso. Sua carga estará pronta em 10 min.</p>
                            </div>
                        </div>

                        <div className="glass-card rounded-[2rem] p-5 flex gap-5 items-start active:bg-white/10 transition-all group">
                            <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
                                <span className="material-symbols-outlined !text-[24px]">local_shipping</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="text-sm font-bold text-white/90 tracking-tight italic">Nova Rota Atribuída</h3>
                                    <span className="text-[10px] font-bold text-slate-500 mt-0.5 shrink-0 ml-2">10:45</span>
                                </div>
                                <p className="text-[12px] leading-relaxed text-slate-400 font-medium opacity-80 italic line-clamp-2">Uma nova rota com 12 pontos de entrega foi adicionada ao seu painel.</p>
                            </div>
                        </div>

                        <div className="glass-card rounded-[2rem] p-5 flex gap-5 items-start active:bg-white/10 transition-all group">
                            <div className="size-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 border border-emerald-500/20">
                                <span className="material-symbols-outlined !text-[24px]">chat_bubble_outline</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="text-sm font-bold text-white/90 tracking-tight italic">Suporte Operacional</h3>
                                    <span className="text-[10px] font-bold text-slate-500 mt-0.5 shrink-0 ml-2">08:20</span>
                                </div>
                                <p className="text-[12px] leading-relaxed text-slate-400 font-medium opacity-80 italic line-clamp-2">Olá Carlos, confirme se recebeu o novo crachá digital no seu e-mail.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Earlier Section */}
                <section className="space-y-4">
                    <h2 className="text-[11px] font-black tracking-[0.2em] uppercase text-slate-500 ml-1 opacity-60">Anteriores</h2>
                    <div className="space-y-3 opacity-60">
                        <div className="glass-card rounded-[2rem] p-5 flex gap-5 items-start grayscale-[0.5]">
                            <div className="size-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 shrink-0 border border-white/5">
                                <span className="material-symbols-outlined !text-[24px]">task_alt</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="text-sm font-bold text-white/90 tracking-tight italic">Relatório Semanal</h3>
                                    <span className="text-[10px] font-bold text-slate-500 mt-0.5 shrink-0 ml-2">ONTEM</span>
                                </div>
                                <p className="text-[12px] leading-relaxed text-slate-400 font-medium italic line-clamp-2">Seu resumo de desempenho da última semana já está disponível para visualização.</p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Bottom Safe Indicator Footer */}
            <footer className="fixed bottom-0 left-0 right-0 p-12 text-center pointer-events-none">
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.5em]">Central de Inteligência RouteVision™</p>
            </footer>
        </div>
    );
};
