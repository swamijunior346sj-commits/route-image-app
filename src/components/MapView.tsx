import { useEffect, useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, DirectionsRenderer, Circle, OverlayView, TrafficLayer } from '@react-google-maps/api';
import { getActiveRoute, updateActiveRoute } from '../services/db';
import type { RoutePoint } from '../services/db';
import {
    X,
    CheckCircle2,
    Plus,
    Loader2,
    Navigation,
    LocateFixed,
    PackageSearch,
    Settings
} from 'lucide-react';
import confetti from 'canvas-confetti';

const libraries: ("places" | "geometry")[] = ['places', 'geometry'];
const defaultCenter = { lat: -23.5505, lng: -46.6333 };
const mapContainerStyle = { width: '100%', height: '100%' };

// Premium Custom Markers
const NumberedMarker = ({ number, color }: { number: number, color: string }) => (
    <div className="relative group" style={{ position: 'absolute', transform: 'translate(-50%, -100%)' }}>
        <div
            className="size-9 rounded-full border-4 border-white shadow-xl flex items-center justify-center relative z-10 active:scale-95 transition-transform"
            style={{ backgroundColor: color }}
        >
            <span className="text-white font-black text-sm italic">{number}</span>
        </div>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-4 rotate-45 z-0" style={{ backgroundColor: color }}></div>
    </div>
);

const DeliveredMarker = () => (
    <div className="relative" style={{ position: 'absolute', transform: 'translate(-50%, -100%)' }}>
        <div className="size-9 rounded-full bg-emerald-500 border-4 border-white shadow-xl flex items-center justify-center relative z-10 transition-all scale-90 opacity-60">
            <CheckCircle2 size={18} className="text-white" />
        </div>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-4 rotate-45 bg-emerald-500 z-0"></div>
    </div>
);

const CurrentMarker = () => (
    <div style={{ position: 'absolute', transform: 'translate(-50%, -50%)' }}>
        <div className="relative">
            <div className="absolute inset-0 bg-primary/30 rounded-full animate-ping scale-150"></div>
            <div className="size-8 bg-primary rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                <Navigation size={16} className="text-white transform -rotate-45" />
            </div>
        </div>
    </div>
);

const darkMapStyles = [
    { elementType: "geometry", stylers: [{ color: "#0F172A" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0F172A" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#94A3B8" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#60A5FA" }] },
    { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#1E293B" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#64748B" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#334155" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#475569" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#020617" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#334155" }] },
];

export const MapView = ({ onBack }: { onBack?: () => void }) => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        libraries,
    });

    const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);
    const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
    const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [navigationIndex, setNavigationIndex] = useState(0);
    const [accuracy, setAccuracy] = useState<number | null>(null);
    const [showCheckAnimation, setShowCheckAnimation] = useState(false);

    useEffect(() => {
        loadData();
        let watchId: number | null = null;
        if ('geolocation' in navigator) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setUserLocation(coords);
                    setAccuracy(pos.coords.accuracy);
                },
                (err) => console.log('GPS error:', err),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }
        return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); };
    }, []);

    const loadData = async () => {
        const points = await getActiveRoute();
        setRoutePoints(points);
    };

    const handleLocateMe = () => {
        if (userLocation && mapRef) {
            mapRef.panTo(userLocation);
            mapRef.setZoom(17);
        }
    };

    useEffect(() => {
        if (!isLoaded || !userLocation || routePoints.length === 0) return;
        const pending = routePoints.filter(p => !p.isDelivered && p.lat && p.lng);
        if (pending.length === 0) {
            setDirectionsResponse(null);
            return;
        }
        const directionsService = new window.google.maps.DirectionsService();
        const waypoints = pending.map(p => ({
            location: { lat: p.lat!, lng: p.lng! },
            stopover: true
        }));
        directionsService.route(
            {
                origin: userLocation,
                destination: waypoints[waypoints.length - 1].location,
                waypoints: waypoints.slice(0, -1),
                travelMode: window.google.maps.TravelMode.DRIVING,
                optimizeWaypoints: false,
            },
            (result, status) => {
                if (status === 'OK' && result) setDirectionsResponse(result);
            }
        );
    }, [userLocation, routePoints, isLoaded]);

    const handleCompleteStop = async (delivered: boolean) => {
        const pending = routePoints.filter(p => !p.isDelivered);
        const point = pending[navigationIndex];
        if (!point) return;
        setShowCheckAnimation(true);
        setTimeout(() => setShowCheckAnimation(false), 1000);
        const updated = routePoints.map(p => p.id === point.id ? { ...p, isDelivered: delivered } : p);
        setRoutePoints(updated);
        await updateActiveRoute(updated);
        if (navigationIndex < pending.length - 1) {
            setNavigationIndex(prev => prev + 1);
        } else {
            setIsNavigating(false);
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }
    };

    const onLoadMap = useCallback((map: google.maps.Map) => {
        setMapRef(map);
    }, []);

    const currentLeg = directionsResponse?.routes[0].legs[navigationIndex];
    const destinationStop = routePoints.filter(p => !p.isDelivered)[navigationIndex];

    if (!isLoaded) return <div className="h-full bg-bg-deep flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;

    return (
        <div className="relative w-full h-full bg-bg-deep overflow-hidden font-sans antialiased">
            <div className="absolute inset-0 z-0">
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={userLocation || defaultCenter}
                    zoom={15}
                    onLoad={onLoadMap}
                    options={{
                        disableDefaultUI: true,
                        styles: darkMapStyles,
                        gestureHandling: 'greedy'
                    }}
                >
                    <TrafficLayer />
                    {directionsResponse && (
                        <DirectionsRenderer
                            options={{
                                directions: directionsResponse,
                                suppressMarkers: true,
                                polylineOptions: { strokeColor: '#3B82F6', strokeWeight: 6, strokeOpacity: 0.8 }
                            }}
                        />
                    )}
                    {userLocation && (
                        <OverlayView position={userLocation} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                            <CurrentMarker />
                        </OverlayView>
                    )}
                    {routePoints.map((p, i) => (
                        p.lat && p.lng && (
                            <OverlayView key={p.id} position={{ lat: p.lat, lng: p.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                <div>
                                    {p.isDelivered ? <DeliveredMarker /> : <NumberedMarker number={i + 1} color="#3B82F6" />}
                                </div>
                            </OverlayView>
                        )
                    ))}
                    {userLocation && accuracy && (
                        <Circle center={userLocation} radius={accuracy} options={{ fillColor: '#3B82F6', fillOpacity: 0.05, strokeWeight: 0 }} />
                    )}
                </GoogleMap>
            </div>

            <header className="absolute top-0 left-0 right-0 z-20 p-6 flex items-center justify-between pointer-events-none">
                <button onClick={onBack} className="map-control pointer-events-auto shadow-2xl">
                    <X size={24} />
                </button>
                <div className="glass-morphism px-5 py-3 rounded-2xl flex items-center gap-3 pointer-events-auto shadow-2xl text-white">
                    <div className="size-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-sm font-bold tracking-tight">Trânsito em tempo real</span>
                </div>
                <button className="map-control pointer-events-auto shadow-2xl">
                    <Settings size={22} className="text-white/60" />
                </button>
            </header>

            <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
                <button onClick={() => mapRef?.setZoom((mapRef?.getZoom() || 15) + 1)} className="map-control shadow-xl">
                    <Plus size={24} />
                </button>
                <button onClick={() => mapRef?.setZoom((mapRef?.getZoom() || 15) - 1)} className="map-control shadow-xl">
                    <div className="w-5 h-1 bg-white/80 rounded-full" />
                </button>
                <button onClick={handleLocateMe} className="map-control shadow-xl mt-4">
                    <LocateFixed size={22} className="text-primary" />
                </button>
                {!isNavigating && routePoints.filter(p => !p.isDelivered).length > 0 && (
                    <button
                        onClick={() => {
                            if (navigator.vibrate) navigator.vibrate(100);
                            setIsNavigating(true);
                        }}
                        className="size-14 rounded-2xl bg-primary shadow-lg text-white flex items-center justify-center active:scale-95 transition-all mt-4 animate-in zoom-in duration-500 border border-white/20"
                    >
                        <Navigation size={28} className="fill-white" />
                    </button>
                )}
            </div>

            <div
                className={`absolute bottom-10 left-6 right-6 z-30 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] transform ${isNavigating && destinationStop
                        ? 'translate-y-0 opacity-100 scale-100'
                        : 'translate-y-[120%] opacity-0 scale-95 pointer-events-none'
                    }`}
            >
                {destinationStop && (
                    <div className="glass-morphism rounded-[2.5rem] p-6 shadow-2xl border border-white/20 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-primary/20">
                            <div className="h-full bg-primary animate-pulse" style={{ width: '30%' }}></div>
                        </div>
                        <div className="flex items-start justify-between mb-6">
                            <div className="space-y-1">
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">Navegação Ativa</p>
                                <h2 className="text-xl font-extrabold text-white leading-tight italic">{destinationStop.name}</h2>
                                <p className="text-sm text-slate-400 font-medium opacity-80">{destinationStop.neighborhood || 'Bairro ñ identificado'}</p>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-black text-primary italic">
                                    {currentLeg?.duration?.text?.split(' ')[0] || '--'}
                                    <span className="text-sm font-bold ml-1 uppercase">{currentLeg?.duration?.text?.split(' ')[1] || 'min'}</span>
                                </div>
                                <p className="text-[11px] font-bold text-emerald-400 uppercase">Fluido</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handleCompleteStop(true)}
                                className="nav-gradient h-14 rounded-2xl flex items-center justify-center gap-2 shadow-[0_10px_20px_-5px_rgba(59,130,246,0.5)] active:scale-[0.97] transition-all"
                            >
                                <CheckCircle2 size={20} className="text-white" />
                                <span className="text-white font-extrabold text-sm tracking-wide uppercase">Entregue</span>
                            </button>
                            <button
                                onClick={() => setIsNavigating(false)}
                                className="bg-white/5 border border-white/10 h-14 rounded-2xl flex items-center justify-center gap-2 active:bg-white/10 transition-all"
                            >
                                <X size={20} className="text-slate-300" />
                                <span className="text-slate-300 font-extrabold text-sm tracking-wide uppercase">Parar</span>
                            </button>
                        </div>
                        <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/10">
                                    <PackageSearch size={16} className="text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Restante</p>
                                    <p className="text-xs font-bold text-slate-300">{(routePoints.length - routePoints.filter(p => p.isDelivered).length).toString().padStart(2, '0')} paradas</p>
                                </div>
                            </div>

                            <button
                                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${destinationStop.lat},${destinationStop.lng}`, '_blank')}
                                className="p-2 px-4 rounded-xl glass-morphism text-[10px] font-bold text-white/60 uppercase hover:text-white transition-colors"
                            >
                                GPS Externo
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showCheckAnimation && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center pointer-events-none bg-emerald-500/10 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-emerald-500 size-32 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.5)] animate-bounce">
                        <CheckCircle2 size={64} className="text-white" />
                    </div>
                </div>
            )}
        </div>
    );
};
