import type { RoutePoint } from '../services/db';

interface ActiveRouteViewProps {
    routePoints: RoutePoint[];
    onClose: () => void;
    onArrived: (point: RoutePoint) => void;
}

export const ActiveRouteView = ({ routePoints, onClose, onArrived }: ActiveRouteViewProps) => {
    const activeStop = routePoints.find(p => !p.isDelivered) || routePoints[routePoints.length - 1];
    const completedCount = routePoints.filter(p => p.isDelivered).length;

    // Simular instrução de navegação
    const instruction = "Siga para o próximo destino";

    const handleOpenNavigation = () => {
        if (!activeStop) return;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${activeStop.lat},${activeStop.lng}&travelmode=driving`;
        window.open(url, '_blank');
    };

    return (
        <div className="fixed inset-0 z-[15000] flex flex-col pointer-events-none font-sans">
            {/* Top Navigation Card */}
            <div className="w-full px-6 pt-14 pb-6 pointer-events-auto">
                <div className="bg-white rounded-[2rem] shadow-2xl border border-blue-50 p-6 flex items-center justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Próxima Parada</span>
                            <div className="size-1.5 rounded-full bg-blue-600"></div>
                        </div>
                        <h2 className="text-[18px] font-black text-gray-900 leading-tight truncate">
                            {activeStop?.name || "Destino final"}
                        </h2>
                        {activeStop?.notes && (
                            <div className="flex items-center gap-1.5 mt-1 bg-yellow-50 px-2 py-0.5 rounded-lg w-fit">
                                <span className="material-symbols-outlined !text-[14px] text-yellow-600">sticky_note_2</span>
                                <p className="text-[12px] text-yellow-700 font-bold truncate max-w-[200px]">
                                    {activeStop.notes}
                                </p>
                            </div>
                        )}
                        <p className="text-[13px] text-gray-400 font-medium mt-1">
                            {instruction}
                        </p>
                    </div>

                    <button
                        onClick={handleOpenNavigation}
                        className="ml-4 size-16 bg-[#2970ff] rounded-2xl flex flex-col items-center justify-center text-white shadow-[0_8px_16px_rgba(41,112,255,0.3)] active:scale-95"
                    >
                        <span className="material-symbols-outlined !text-[28px] filled-icon">navigation</span>
                        <span className="text-[9px] font-black uppercase mt-1">Ir</span>
                    </button>
                </div>
            </div>

            <div className="flex-1"></div>

            {/* Bottom Controls */}
            <div className="w-full px-6 pb-12 pointer-events-auto flex flex-col gap-4">
                {/* Progress Bar */}
                <div className="bg-white/80 backdrop-blur-md rounded-full h-12 px-6 flex items-center justify-between border border-white shadow-lg overflow-hidden relative">
                    <div
                        className="absolute left-0 top-0 bottom-0 bg-blue-50"
                        style={{ width: `${routePoints.length > 0 ? (completedCount / routePoints.length) * 100 : 0}%` }}
                    ></div>
                    <span className="relative z-10 text-[12px] font-black text-gray-400 uppercase tracking-widest">
                        Progresso: {completedCount}/{routePoints.length}
                    </span>
                    <span className="relative z-10 text-[12px] font-black text-blue-600">
                        {routePoints.length > 0 ? Math.round((completedCount / routePoints.length) * 100) : 0}%
                    </span>
                </div>

                {/* Primary Actions */}
                <div className="flex gap-4">
                    <button
                        onClick={onClose}
                        className="h-18 flex-1 bg-white rounded-[2rem] shadow-xl border border-gray-100 flex items-center justify-center text-gray-400 active:scale-95"
                    >
                        <span className="material-symbols-outlined !text-[32px]">close</span>
                    </button>

                    <button
                        onClick={() => onArrived(activeStop)}
                        className="h-18 flex-[3] bg-[#2970ff] rounded-[2rem] shadow-[0_12px_24px_rgba(41,112,255,0.3)] flex items-center justify-center gap-3 text-white active:scale-95"
                    >
                        <span className="text-[18px] font-black tracking-tight tracking-wide">Cheguei ao Local</span>
                        <span className="material-symbols-outlined !text-[24px]">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
