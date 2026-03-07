import { useState } from 'react';
import { MapView } from './components/MapView';
import { ScannerView } from './components/ScannerView';
import { RouteListView } from './components/RouteListView';

// --- Global Types ---
export type LocationPoint = {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    neighborhood?: string;
    city?: string;
    notes?: string;
    status: 'pending' | 'delivered' | 'failed';
    createdAt: number;
};

function App() {
    const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [points, setPoints] = useState<LocationPoint[]>([]);

    // Add a new point to the route
    const handleAddPoint = (newPoint: Omit<LocationPoint, 'id' | 'status' | 'createdAt'>) => {
        const point: LocationPoint = {
            ...newPoint,
            id: Math.random().toString(36).substring(7),
            status: 'pending',
            createdAt: Date.now()
        };
        setPoints(prev => [...prev, point]);
        setIsScannerOpen(false);
        setActiveTab('map');
    };

    return (
        <div className="relative w-full h-[100dvh] overflow-hidden bg-slate-50">

            {/* Main Content Area */}
            <div className="w-full h-full pb-20">
                {activeTab === 'map' ? (
                    <MapView points={points} />
                ) : (
                    <RouteListView points={points} />
                )}
            </div>

            {/* Navigation Bar - Premium Glass Mode */}
            <nav className="fixed bottom-0 left-0 right-0 h-20 glass-morphism border-t border-white/50 flex items-center justify-around px-6 z-50">
                <button
                    onClick={() => setActiveTab('map')}
                    className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'map' ? 'text-blue-600 scale-110' : 'text-slate-400'}`}
                >
                    <span className="material-symbols-outlined filled-icon">map</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Mapa</span>
                </button>

                {/* Center Floating Action Button */}
                <button
                    onClick={() => setIsScannerOpen(true)}
                    className="absolute -top-6 bg-blue-600 size-16 rounded-full shadow-[0_8px_25px_rgba(37,99,235,0.4)] flex items-center justify-center text-white active:scale-90 transition-all border-4 border-white"
                >
                    <span className="material-symbols-outlined !text-32px">photo_camera</span>
                </button>

                <button
                    onClick={() => setActiveTab('list')}
                    className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'list' ? 'text-blue-600 scale-110' : 'text-slate-400'}`}
                >
                    <span className="material-symbols-outlined">route</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Rota</span>
                </button>
            </nav>

            {/* Scanner Modal Overlay */}
            {isScannerOpen && (
                <div className="fixed inset-0 z-[100] animate-in fade-in duration-300">
                    <ScannerView
                        onClose={() => setIsScannerOpen(false)}
                        onConfirm={handleAddPoint}
                    />
                </div>
            )}

        </div>
    );
}

export default App;
