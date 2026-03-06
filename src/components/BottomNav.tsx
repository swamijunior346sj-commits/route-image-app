interface BottomNavProps {
    currentTab: 'scanner' | 'map' | 'records' | 'profile' | 'dailyRoute';
    setTab: (tab: 'scanner' | 'map' | 'records' | 'profile' | 'dailyRoute') => void;
}

export const BottomNav = ({ currentTab, setTab }: BottomNavProps) => {
    const tabs = [
        { id: 'scanner', icon: 'barcode_scanner', label: 'SCAN' },
        { id: 'dailyRoute', icon: 'route', label: 'ROTA' },
        { id: 'map', icon: 'map', label: 'MAPA' },
        { id: 'records', icon: 'format_list_bulleted', label: 'ENDEREÇOS' },
        { id: 'profile', icon: 'person', label: 'CONTA' },
    ] as const;

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-lg h-20 glass-card rounded-[2.5rem] flex justify-around items-center z-[9999] shadow-premium px-2">
            {tabs.map(tab => {
                const isActive = currentTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setTab(tab.id);
                            if (navigator.vibrate) navigator.vibrate(10);
                        }}
                        className="relative flex flex-col items-center justify-center w-16 h-full transition-all group"
                    >
                        {isActive && (
                            <div className="nav-active-glow" />
                        )}

                        <span className={`material-symbols-outlined !text-[26px] mb-1 transition-all duration-300 ${isActive
                            ? 'text-primary scale-110'
                            : 'text-slate-500 group-hover:text-white/60'
                            }`}>
                            {tab.icon}
                        </span>

                        <span className={`text-[9px] font-bold tracking-widest transition-all duration-300 ${isActive ? 'text-primary' : 'text-slate-500'
                            }`}>
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};
