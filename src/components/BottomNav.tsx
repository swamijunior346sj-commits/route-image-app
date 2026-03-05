import { Camera, Map, List, Download, Upload } from 'lucide-react';

interface BottomNavProps {
    currentTab: 'scanner' | 'map' | 'records';
    setTab: (tab: 'scanner' | 'map' | 'records') => void;
}

export const BottomNav = ({ currentTab, setTab }: BottomNavProps) => {
    const tabs = [
        { id: 'scanner', icon: Camera, label: 'Escanear' },
        { id: 'map', icon: Map, label: 'Mapa' },
        { id: 'records', icon: List, label: 'Registros' },
    ] as const;

    return (
        <div className="fixed bottom-0 w-full h-16 glass-panel border-t flex justify-around items-center z-50">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setTab(tab.id)}
                    className={`flex flex-col items-center justify-center w-20 transition-colors ${currentTab === tab.id ? 'text-primary' : 'text-zinc-400'}`}
                >
                    <tab.icon size={24} className={`mb-1 transition-transform ${currentTab === tab.id ? 'scale-110 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' : ''}`} />
                    <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
                </button>
            ))}
        </div>
    );
};
