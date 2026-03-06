interface LoadingOverlayProps {
    title?: string;
    subtitle?: string;
    icon?: React.ReactNode;
}

export const LoadingOverlay = ({
    title = 'Processando Dados',
    subtitle = 'Sincronizando registros com o banco central',
    icon = <span className="material-symbols-outlined !text-4xl text-white animate-pulse">database</span>
}: LoadingOverlayProps) => {
    return (
        <div className="fixed inset-0 z-[9999] bg-bg-start/80 backdrop-blur-3xl flex flex-col items-center justify-center p-12 text-center animate-fade-in">
            <div className="relative mb-8">
                {/* Outer Glow */}
                <div className="absolute inset-0 bg-primary/20 blur-[60px] animate-pulse rounded-full scale-150" />

                {/* Rings */}
                <div className="w-24 h-24 border border-white/10 rounded-full flex items-center justify-center relative z-10 shadow-premium">
                    <div className="absolute inset-0 border-t border-primary rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
                    <div className="absolute inset-2 border-b border-accent rounded-full animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
                    {icon}
                </div>
            </div>

            <h3 className="text-2xl font-black text-white/90 italic tracking-tighter uppercase mb-2 relative z-10 drop-shadow-2xl">
                {title}
            </h3>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.4em] relative z-10">
                {subtitle}
            </p>

            <div className="mt-10 w-44 h-1 bg-white/5 rounded-full overflow-hidden relative z-10 border border-white/5 shadow-inner">
                <div className="h-full bg-gradient-to-r from-primary via-accent to-primary w-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
            </div>

            {/* Corner Accents */}
            <div className="absolute top-12 left-12 w-10 h-10 border-t border-l border-white/10 rounded-tl-3xl" />
            <div className="absolute bottom-12 right-12 w-10 h-10 border-b border-r border-white/10 rounded-br-3xl" />
        </div>
    );
};
