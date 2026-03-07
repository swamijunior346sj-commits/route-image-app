import { useState, useEffect } from 'react';
import { MapView } from './components/MapView';
import { ScannerView } from './components/ScannerView';
import { RouteListView } from './components/RouteListView';
import { HistoryView } from './components/HistoryView';
import { getActiveRoute, saveToActiveRoute, deletePoint, updatePointStatus } from './services/db';
import confetti from 'canvas-confetti';

// --- Global Types ---
export type LocationPoint = {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    neighborhood: string;
    city: string;
    notes: string;
    status: 'pending' | 'delivered';
    createdAt: number;
};

function App() {
    const [activeTab, setActiveTab] = useState<'map' | 'list' | 'history'>('map');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [points, setPoints] = useState<LocationPoint[]>([]);
    const [isNavigating, setIsNavigating] = useState(false);

    // Load points from Supabase
    useEffect(() => {
        loadPoints();
    }, []);

    const loadPoints = async () => {
        const data = await getActiveRoute();
        setPoints(data);
    };

    const handleAddPoint = async (newPoint: Omit<LocationPoint, 'id' | 'status' | 'createdAt'>) => {
        try {
            await saveToActiveRoute(newPoint);
            loadPoints();
            setIsScannerOpen(false);
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar rota.");
        }
    };

    const handleDeletePoint = async (id: string) => {
        try {
            await deletePoint(id);
            setPoints((prev: LocationPoint[]) => prev.filter(p => p.id !== id));
        } catch (error) {
            console.error(error);
            alert("Erro ao remover ponto.");
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: string) => {
        try {
            const nextStatus = currentStatus === 'pending';
            await updatePointStatus(id, nextStatus);

            if (nextStatus && points.filter(p => p.status === 'pending').length === 1) {
                confetti({
                    particleCount: 150,
                    spread: 100,
                    origin: { y: 0.6 }
                });
            }

            loadPoints();
        } catch (error) {
            console.error("Toggle status error:", error);
        }
    };

    return (
        <div className="relative w-full h-[100dvh] overflow-hidden bg-slate-50">

            {/* Main Content Area */}
            <div className="w-full h-full pb-20">
                {activeTab === 'map' && (
                    <MapView
                        points={points}
                        onDeletePoint={handleDeletePoint}
                        onToggleStatus={handleToggleStatus}
                        isNavigating={isNavigating}
                        onStopNavigation={() => setIsNavigating(false)}
                    />
                )}
                {activeTab === 'list' && (
                    <RouteListView
                        points={points}
                        onRefresh={loadPoints}
                        onToggleStatus={handleToggleStatus}
                        onStartInternalNav={() => {
                            setActiveTab('map');
                            setIsNavigating(true);
                        }} />
                )}
                {activeTab === 'history' && <HistoryView />}
            </div>

            {/* Bottom Navigation Control Bar */}
            <nav className="fixed bottom-0 left-0 right-0 h-24 bg-white/95 backdrop-blur-xl flex items-center justify-around px-2 pb-6 z-50 border-t border-slate-100 shadow-[0_-8px_40px_rgba(0,0,0,0.04)]">

                {/* Map Button */}
                <button
                    onClick={() => setActiveTab('map')}
                    className={`flex flex-col items-center gap-1.5 min-w-[64px] transition-all duration-300 ${activeTab === 'map' ? 'text-blue-600 scale-110' : 'text-slate-300'}`}
                >
                    <div className={`p-2 rounded-2xl ${activeTab === 'map' ? 'bg-blue-50' : 'bg-transparent'}`}>
                        <span className="material-symbols-outlined filled-icon !text-24px">explore</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">MAPA</span>
                </button>

                {/* Main Action: Scanner (Floating) */}
                <button
                    onClick={() => setIsScannerOpen(true)}
                    className="relative -top-6 size-20 bg-slate-900 rounded-[2.5rem] shadow-2xl shadow-slate-900/30 flex items-center justify-center text-white active:scale-90 transition-all group overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <span className="material-symbols-outlined !text-36px relative z-10">photo_camera</span>
                </button>

                {/* Route List Button */}
                <button
                    onClick={() => setActiveTab('list')}
                    className={`flex flex-col items-center gap-1.5 min-w-[64px] transition-all duration-300 ${activeTab === 'list' ? 'text-blue-600 scale-110' : 'text-slate-300'}`}
                >
                    <div className={`p-2 rounded-2xl ${activeTab === 'list' ? 'bg-blue-50' : 'bg-transparent'}`}>
                        <span className="material-symbols-outlined filled-icon !text-24px">route</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">ROTA</span>
                </button>

                {/* History Button (New) */}
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex flex-col items-center gap-1.5 min-w-[64px] transition-all duration-300 ${activeTab === 'history' ? 'text-blue-600 scale-110' : 'text-slate-300'}`}
                >
                    <div className={`p-2 rounded-2xl ${activeTab === 'history' ? 'bg-blue-50' : 'bg-transparent'}`}>
                        <span className="material-symbols-outlined filled-icon !text-24px">history</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">ARQUIVO</span>
                </button>

            </nav>

            {/* Scanner Overlay */}
            {isScannerOpen && (
                <div className="fixed inset-0 z-[100] bg-black">
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
