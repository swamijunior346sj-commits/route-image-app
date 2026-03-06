import { useState, useEffect } from 'react';

interface LoadingOverlayProps {
    title?: string;
    subtitle?: string;
    icon?: React.ReactNode;
}

export const LoadingOverlay = ({
    title = 'Processando Dados',
    subtitle = 'Sincronizando registros com o banco central',
    icon = <span className="material-symbols-outlined !text-[44px] text-primary animate-pulse">auto_awesome</span>
}: LoadingOverlayProps) => {
    const [showReload, setShowReload] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShowReload(true), 5000);
        return () => clearTimeout(timer);
    }, []);
    return (
        <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
            <div className="relative size-48 flex items-center justify-center mb-12">
                <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-[ping_3s_infinite]" />
                <div className="absolute inset-4 rounded-full border-2 border-primary/40 animate-[ping_2s_infinite]" />
                <div className="absolute inset-0 border-t-4 border-primary rounded-full animate-spin" />
                <div className="relative z-10 scale-[1.5]">
                    {icon}
                </div>
            </div>

            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-3 relative z-10 drop-shadow-2xl">
                {title}
            </h3>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.4em] relative z-10 max-w-xs leading-loose">
                {subtitle}
            </p>

            <div className="mt-12 flex gap-1 relative z-10">
                {[0, 1, 2].map(i => (
                    <div key={i} className="size-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
            </div>

            {showReload && (
                <button
                    onClick={() => window.location.reload()}
                    className="mt-12 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/40 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all animate-in zoom-in duration-300"
                >
                    Recarregar App
                </button>
            )}

            {/* Premium Accents */}
            <div className="absolute top-12 left-12 w-10 h-10 border-t border-l border-white/5 rounded-tl-3xl" />
            <div className="absolute bottom-12 right-12 w-10 h-10 border-b border-r border-white/5 rounded-br-3xl" />
        </div>
    );
};
