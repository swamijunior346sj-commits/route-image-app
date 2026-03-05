import { Database } from 'lucide-react';

interface LoadingOverlayProps {
    title?: string;
    subtitle?: string;
    icon?: React.ReactNode;
}

export const LoadingOverlay = ({
    title = 'Processando Dados',
    subtitle = 'Sincronizando registros com o banco geográfico',
    icon = <Database size={32} className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-pulse" />
}: LoadingOverlayProps) => {
    return (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-3xl flex flex-col items-center justify-center p-12 text-center animate-fade-in">
            <div className="relative mb-8">
                {/* Outer Glow */}
                <div className="absolute inset-0 bg-blue-500/30 blur-[50px] animate-pulse rounded-full scale-150" />

                {/* Rings */}
                <div className="w-24 h-24 border-2 border-white/5 rounded-full flex items-center justify-center relative z-10">
                    <div className="absolute inset-0 border-t-2 border-blue-500 rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
                    <div className="absolute inset-2 border-b-2 border-emerald-400 rounded-full animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
                    {icon}
                </div>
            </div>

            <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-2 relative z-10 drop-shadow-2xl">
                {title}
            </h3>
            <p className="text-blue-400/60 text-[10px] font-black uppercase tracking-[0.4em] relative z-10">
                {subtitle}
            </p>

            <div className="mt-10 w-40 h-1 bg-white/5 rounded-full overflow-hidden relative z-10 border border-white/10">
                <div className="h-full bg-gradient-to-r from-blue-600 via-emerald-400 to-blue-600 w-full animate-[loading_2s_ease-in-out_infinite]" />
            </div>

            {/* Cinematic Corner Accents */}
            <div className="absolute top-12 left-12 w-8 h-8 border-t border-l border-white/10 rounded-tl-xl" />
            <div className="absolute bottom-12 right-12 w-8 h-8 border-b border-r border-white/10 rounded-br-xl" />
        </div>
    );
};
