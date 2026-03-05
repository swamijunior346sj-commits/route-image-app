import { Camera, Map, List, User } from 'lucide-react';

interface BottomNavProps {
    currentTab: 'scanner' | 'map' | 'records' | 'profile';
    setTab: (tab: 'scanner' | 'map' | 'records' | 'profile') => void;
}

export const BottomNav = ({ currentTab, setTab }: BottomNavProps) => {
    const tabs = [
        { id: 'scanner', icon: Camera, label: 'VISÃO' },
        { id: 'map', icon: Map, label: 'MAPA' },
        { id: 'records', icon: List, label: 'LISTA' },
        { id: 'profile', icon: User, label: 'CONTA' },
    ] as const;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm h-16 bg-zinc-950/40 backdrop-blur-2xl border border-white/5 rounded-[2rem] flex justify-around items-center z-50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* High-tech accent line */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

            {tabs.map(tab => {
                const isActive = currentTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setTab(tab.id);
                            if (navigator.vibrate) navigator.vibrate(10);
                        }}
                        className="relative flex flex-col items-center justify-center w-16 h-full transition-all group overflow-visible"
                    >
                        {/* Dynamic background glow on hover/active */}
                        <div className={`absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors duration-500 rounded-xl`} />

                        {isActive && (
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse" />
                        )}

                        <tab.icon
                            size={20}
                            className={`mb-1.5 transition-all duration-300 ${isActive
                                ? 'text-blue-500 scale-125 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]'
                                : 'text-zinc-600 group-hover:text-zinc-400 group-hover:scale-110'
                                }`}
                        />

                        <span className={`text-[8px] font-black italic uppercase tracking-[0.2em] transition-all duration-300 ${isActive ? 'text-blue-500/80 translate-y-0.5' : 'text-zinc-700'
                            }`}>
                            {tab.label}
                        </span>

                        {isActive && (
                            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,1)] animate-ping" />
                        )}
                    </button>
                );
            })}
        </div>
    );
};
