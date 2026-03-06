import { useEffect, useState } from 'react';
import { GoogleMap, useJsApiLoader, DirectionsRenderer, OverlayView, TrafficLayer } from '@react-google-maps/api';
import { getActiveRoute, updateActiveRoute, clearActiveRoute } from '../services/db';
import type { RoutePoint } from '../services/db';
import confetti from 'canvas-confetti';

const libraries: ("places" | "geometry")[] = ['places', 'geometry'];
const defaultCenter = { lat: -23.5505, lng: -46.6333 };
const mapContainerStyle = { width: '100%', height: '100%' };

// Premium Dark Style
const mapOptions = {
    disableDefaultUI: true,
    zoomControl: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    clickableIcons: false,
};

const getMapStyles = () => [
    { "elementType": "geometry", "stylers": [{ "color": "#0F172A" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#0F172A" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#475569" }] },
    { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#64748b" }] },
    { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1E293B" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3B82F6" }, { "lightness": -40 }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#082f49" }] },
];

// Custom Marker Components
const NumberedMarker = ({ number, color }: { number: number, color: string }) => (
    <div className="relative group" style={{ position: 'absolute', transform: 'translate(-50%, -100%)' }}>
        <div className="size-10 rounded-full border-[3px] border-white/20 shadow-2xl flex items-center justify-center relative z-10 active:scale-90 transition-transform backdrop-blur-md" style={{ backgroundColor: `${color}CC` }}>
            <span className="text-white font-black text-xs italic">{number}</span>
        </div>
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 z-0" style={{ backgroundColor: `${color}CC`, borderRight: '2px solid rgba(255,255,255,0.1)', borderBottom: '2px solid rgba(255,255,255,0.1)' }}></div>
    </div>
);

const DeliveredMarker = () => (
    <div className="relative" style={{ position: 'absolute', transform: 'translate(-50%, -100%)' }}>
        <div className="size-10 rounded-full bg-emerald-500/30 border-[3px] border-white/10 shadow-xl flex items-center justify-center relative z-10 transition-all scale-90 backdrop-blur-sm">
            <span className="material-symbols-outlined text-white text-[18px]">check</span>
        </div>
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-emerald-500/30 z-0"></div>
    </div>
);

const CurrentMarker = () => (
    <div style={{ position: 'absolute', transform: 'translate(-50%, -50%)' }}>
        <div className="relative">
            <div className="absolute inset-0 bg-primary/40 rounded-full animate-ping scale-150"></div>
            <div className="size-10 bg-primary/80 backdrop-blur-md rounded-full border-[3px] border-white shadow-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-white !text-[20px] transform -rotate-45">navigation</span>
            </div>
        </div>
    </div>
);

interface MapViewProps {
    googleMapsApiKey: string;
}

export const MapView = ({ googleMapsApiKey }: MapViewProps) => {
    const { isLoaded, loadError } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey, libraries });

    const [route, setRoute] = useState<RoutePoint[]>([]);
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
    const [currentPos, setCurrentPos] = useState(defaultCenter);
    const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
    const [traffic, setTraffic] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isHudMinimized, setIsHudMinimized] = useState(false);

    const activePoint = route.find(p => !p.isDelivered);

    useEffect(() => {
        loadRoute();
        const watchId = navigator.geolocation.watchPosition(
            pos => setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            undefined,
            { enableHighAccuracy: true }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    const loadRoute = async () => {
        const data = await getActiveRoute();
        setRoute(data);
    };

    useEffect(() => {
        if (isLoaded && activePoint && currentPos && isNavigating && activePoint.lat !== null && activePoint.lng !== null) {
            const directionsService = new google.maps.DirectionsService();
            directionsService.route(
                {
                    origin: currentPos,
                    destination: { lat: activePoint.lat, lng: activePoint.lng },
                    travelMode: google.maps.TravelMode.DRIVING,
                },
                (result, status) => {
                    if (status === google.maps.DirectionsStatus.OK) {
                        setDirections(result);
                    }
                }
            );
        } else if (!isNavigating) {
            setDirections(null);
        }
    }, [isLoaded, activePoint, currentPos, isNavigating]);

    const handleComplete = async (pointId: string) => {
        const updated = route.map(p => p.id === pointId ? { ...p, isDelivered: true } : p);
        setRoute(updated);
        await updateActiveRoute(updated);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#3B82F6', '#60A5FA', '#FFFFFF'] });
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    };

    const handleClearRoute = async () => {
        if (confirm("Deseja apagar toda a rota ativa? Esta ação não pode ser desfeita.")) {
            await clearActiveRoute();
            setRoute([]);
            setDirections(null);
            setIsNavigating(false);
            if (navigator.vibrate) navigator.vibrate(50);
        }
    };

    if (loadError) return (
        <div className="w-full h-full bg-bg-start flex flex-col items-center justify-center px-8 text-center">
            <span className="material-symbols-outlined !text-[48px] text-red-500 mb-6">map_error</span>
            <h2 className="text-white font-bold text-lg mb-2">Falha na Sincronização</h2>
            <p className="text-white/40 text-xs uppercase font-medium tracking-widest leading-relaxed">
                Não foi possível conectar aos servidores de mapas. Verifique sua conexão ou a chave de API.
            </p>
        </div>
    );

    if (!isLoaded) return (
        <div className="w-full h-full bg-bg-start flex flex-col items-center justify-center">
            <span className="material-symbols-outlined !text-[48px] text-primary animate-spin">sync</span>
            <p className="text-white/40 text-[10px] uppercase font-black tracking-[0.3em] mt-6">Sincronizando Mapas Digitalizados</p>
        </div>
    );

    return (
        <div className="relative w-full h-full bg-bg-start overflow-hidden font-sans">
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-20 px-6 pt-14 pb-12 flex items-center justify-between pointer-events-none">
                <div></div>

                <div className="flex gap-3 pointer-events-auto">
                    <button onClick={() => setTraffic(!traffic)} className={`size-12 rounded-[1.25rem] flex items-center justify-center transition-all ${traffic ? 'bg-primary text-white shadow-premium' : 'bg-bg-start/80 backdrop-blur-xl border border-white/5 text-slate-400'}`}>
                        <span className="material-symbols-outlined !text-[24px]">traffic</span>
                    </button>
                    <button onClick={handleClearRoute} className="size-12 rounded-[1.25rem] bg-red-500/10 border border-red-500/20 text-red-500 active:scale-95 transition-all flex items-center justify-center">
                        <span className="material-symbols-outlined !text-[24px]">delete_sweep</span>
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="absolute inset-0 z-0">
                {activeTab === 'map' ? (
                    <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={currentPos}
                        zoom={15}
                        options={{ ...mapOptions, styles: getMapStyles() }}
                    >
                        {traffic && <TrafficLayer />}
                        {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true, polylineOptions: { strokeColor: '#3B82F6', strokeWeight: 6, strokeOpacity: 0.8 } }} />}
                        <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}><CurrentMarker /></OverlayView>
                        {route.map((p, idx) => p.lat && p.lng && (
                            <OverlayView key={p.id} position={{ lat: p.lat, lng: p.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                {p.isDelivered ? <DeliveredMarker /> : <NumberedMarker number={idx + 1} color={idx === 0 ? '#3B82F6' : '#475569'} />}
                            </OverlayView>
                        ))}
                    </GoogleMap>
                ) : (
                    <div className="w-full h-full bg-bg-start pt-32 px-6 overflow-y-auto no-scrollbar pb-48">
                        {route.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-20 text-center">
                                <span className="material-symbols-outlined !text-[64px] mb-4">route</span>
                                <p className="font-black uppercase tracking-widest text-xs">Nenhuma rota ativa</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {route.map((p, idx) => (
                                    <div key={p.id} className={`glass-card rounded-3xl p-5 border-l-4 transition-all ${p.isDelivered ? 'border-emerald-500 opacity-60' : 'border-primary'}`}>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Parada #{idx + 1}</span>
                                                <h3 className="text-lg font-black text-white italic truncate uppercase">{p.name}</h3>
                                                <p className="text-xs text-slate-500 font-bold uppercase mt-1">{p.neighborhood}</p>
                                            </div>
                                            {p.isDelivered ? (
                                                <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                                            ) : (
                                                <button onClick={() => handleComplete(p.id)} className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center active:scale-95 transition-all">
                                                    <span className="material-symbols-outlined">check</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Navigation HUD */}
            {activeTab === 'map' && activePoint && isNavigating && !isHudMinimized && (
                <div className="absolute bottom-56 inset-x-6 z-20 animate-slide-up">
                    <div className="glass-card rounded-[2.5rem] p-6 shadow-2xl border-white/10 relative overflow-hidden group">
                        <button onClick={() => setIsHudMinimized(true)} className="absolute top-6 right-6 z-20 text-slate-500 hover:text-white transition-colors">
                            <span className="material-symbols-outlined !text-[20px]">close</span>
                        </button>
                        <div className="flex justify-between items-start mb-5 relative z-10">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-1 block">Próximo Alvo</span>
                                <h2 className="text-xl font-black text-white italic tracking-tight uppercase leading-tight">{activePoint.name}</h2>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-1 block">Estimativa</span>
                                <p className="text-lg font-black text-white italic">14 min</p>
                            </div>
                        </div>
                        <div className="flex gap-3 relative z-10">
                            <button className="size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all group"
                                onClick={() => { if (activePoint.lat && activePoint.lng) window.open(`https://waze.com/ul?ll=${activePoint.lat},${activePoint.lng}&navigate=yes`, '_blank'); }}
                            >
                                <img src="https://upload.wikimedia.org/wikipedia/commons/6/66/Waze_icon.svg" className="size-7 opacity-60 group-hover:opacity-100 transition-opacity" alt="Waze" />
                            </button>
                            <button className="size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all">
                                <span className="material-symbols-outlined !text-[24px]">phone</span>
                            </button>
                            <button onClick={() => handleComplete(activePoint.id)} className="flex-1 h-14 bg-emerald-500 shadow-premium text-white font-black italic uppercase tracking-[0.2em] rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all group/btn">
                                <span className="material-symbols-outlined group-hover:rotate-12 transition-transform">verified</span>
                                CONFIRMAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'map' && activePoint && (!isNavigating || isHudMinimized) && (
                <button onClick={() => { setIsNavigating(true); setIsHudMinimized(false); }} className="absolute bottom-56 right-6 z-20 h-16 px-6 rounded-2xl glass-card flex items-center gap-3 text-primary shadow-2xl animate-fade-in active:scale-95 transition-all">
                    <span className="material-symbols-outlined !text-[28px] animate-pulse">navigation</span>
                    <div className="flex flex-col items-start leading-none">
                        <span className="text-[10px] font-black uppercase tracking-widest">Iniciar</span>
                        <span className="text-[8px] font-bold text-slate-500 uppercase mt-1">Navegação</span>
                    </div>
                </button>
            )}

            {/* Tab Bar - Elevated to avoid overlap */}
            <div className="absolute bottom-32 inset-x-6 z-20 flex gap-4">
                <button
                    onClick={() => setActiveTab('map')}
                    className={`flex-1 h-14 rounded-[1.5rem] flex items-center justify-center gap-2 font-black italic uppercase tracking-widest text-[11px] transition-all ${activeTab === 'map' ? 'bg-white text-bg-start shadow-xl' : 'bg-bg-start/80 backdrop-blur-xl border border-white/5 text-slate-400'}`}
                >
                    <span className="material-symbols-outlined !text-[18px]">satellite_alt</span>
                    SATÉLITE
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`flex-1 h-14 rounded-[1.5rem] flex items-center justify-center gap-2 font-black italic uppercase tracking-widest text-[11px] transition-all ${activeTab === 'list' ? 'bg-white text-bg-start shadow-xl' : 'bg-bg-start/80 backdrop-blur-xl border border-white/5 text-slate-400'}`}
                >
                    <span className="material-symbols-outlined !text-[18px]">list_alt</span>
                    LISTAGEM
                </button>
            </div>

            {/* Nav Fade Overlay */}
            <nav className="fixed bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-bg-start via-bg-start/80 to-transparent pointer-events-none z-10"></nav>
        </div>
    );
};
