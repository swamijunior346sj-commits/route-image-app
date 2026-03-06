import { useEffect, useState, useRef } from 'react';
import { GoogleMap, useJsApiLoader, DirectionsRenderer, OverlayView, Autocomplete } from '@react-google-maps/api';
import { getActiveRoute, updateActiveRoute, clearActiveRoute } from '../services/db';
import type { RoutePoint } from '../services/db';
import confetti from 'canvas-confetti';

const libraries: ("places" | "geometry")[] = ['places', 'geometry'];
const defaultCenter = { lat: -23.5505, lng: -46.6333 };
const mapContainerStyle = { width: '100%', height: '100%' };

const NIGHT_MAP_STYLE = [
    { "elementType": "geometry", "stylers": [{ "color": "#0F172A" }] },
    { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#475569" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#0F172A" }] },
    { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "visibility": "off" }] },
    { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1E293B" }] },
    { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#64748B" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#1E293B" }] },
    { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#334155" }] },
    { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#CBD5E1" }] },
    { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#082F49" }] }
];

const SILVER_MAP_STYLE = [
    { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
    { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
    { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] }
];

// Custom Marker Components
const NumberedMarker = ({ number, color }: { number: number, color: string }) => (
    <div className="relative cursor-pointer" style={{ position: 'absolute', transform: 'translate(-50%, -50%)' }}>
        <div className="size-6 rounded-full border-[1.5px] border-white shadow-md flex items-center justify-center relative z-10 backdrop-blur-md" style={{ backgroundColor: `${color}E6` }}>
            <span className="text-white font-black text-[11px] leading-none tracking-tighter" style={{ marginTop: '1px' }}>{number}</span>
        </div>
    </div>
);

const DeliveredMarker = () => (
    <div className="relative group" style={{ position: 'absolute', transform: 'translate(-50%, -50%)' }}>
        <div className="size-4 rounded-full bg-slate-500/80 border-[1px] border-white/20 flex items-center justify-center relative z-10 backdrop-blur-md">
            <span className="material-symbols-outlined text-white/80 !text-[10px] font-black">check</span>
        </div>
    </div>
);

const CurrentMarker = () => (
    <div style={{ position: 'absolute', transform: 'translate(-50%, -50%)' }}>
        <div className="relative flex items-center justify-center">
            {/* The Beam (Farol Aceso) - Animate glow */}
            <div
                className="absolute w-[40px] h-[40px] bg-gradient-to-t from-primary/30 to-transparent animate-pulse"
                style={{
                    clipPath: 'polygon(50% 100%, 15% 0%, 85% 0%)',
                    transform: 'translateY(-40%)',
                    filter: 'blur(4px)',
                    opacity: 0.8
                }}
            />
            {/* Pulsing Outer Halo */}
            <div className="absolute inset-0 size-6 bg-primary/20 rounded-full animate-ping scale-[1.2]"></div>

            {/* Driver "Blue Bullet" Dot */}
            <div className="relative size-4 bg-primary rounded-full border-[2px] border-white shadow-[0_0_10px_rgba(59,130,246,0.8)] z-10 flex items-center justify-center">
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
    const [mapCenter, setMapCenter] = useState(defaultCenter);
    const [fullDirections, setFullDirections] = useState<google.maps.DirectionsResult | null>(null);
    const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
    const [zoom, setZoom] = useState(15);
    const mapRef = useRef<google.maps.Map | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isHudMinimized, setIsHudMinimized] = useState(false);
    const [mapTheme, setMapTheme] = useState<'night' | 'silver'>('night');
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const activePoint = route.find(p => !p.isDelivered);

    // Sync Google Maps Theme with Global App Theme
    useEffect(() => {
        const checkTheme = () => {
            const isLight = document.documentElement.classList.contains('light-mode');
            setMapTheme(isLight ? 'silver' : 'night');
        };
        checkTheme();
        const observer = new MutationObserver(checkTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        loadRoute();
        const watchId = navigator.geolocation.watchPosition(
            pos => {
                // Ignore very imprecise locations (often IP-based city jumps)
                if (pos.coords.accuracy > 1500) {
                    console.warn('Ignoring imprecise location update:', pos.coords.accuracy);
                    return;
                }

                const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setCurrentPos(newPos);
                // Set map center only on initial lock so user can drag freely afterwards
                setMapCenter(prev => prev === defaultCenter ? newPos : prev);
            },
            undefined,
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    const loadRoute = async () => {
        const data = await getActiveRoute();
        setRoute(data);
    };

    // Active Leg Highlight (Current Position -> Next Point)
    useEffect(() => {
        if (isLoaded && activePoint && currentPos && activePoint.lat !== null && activePoint.lng !== null) {
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
        } else {
            setDirections(null);
        }
    }, [isLoaded, activePoint, currentPos]);

    // Full Optimized Path (Current Position -> Next Point -> ... -> Final Point)
    useEffect(() => {
        if (!isLoaded || !currentPos || route.length === 0) {
            setFullDirections(null);
            return;
        }

        const pending = route.filter(p => !p.isDelivered && p.lat !== null && p.lng !== null);
        if (pending.length < 1) {
            setFullDirections(null);
            return;
        }

        const directionsService = new google.maps.DirectionsService();

        // Destination is the final point in the pending segment
        const finalPoint = pending[pending.length - 1];
        const destination = { lat: finalPoint.lat!, lng: finalPoint.lng! };

        // Waypoints are all pending points between the CURRENT position and the final point
        // excluding the final point itself (which is the destination)
        // We include the next point (activePoint) in the waypoints if it's not the final point
        const waypoints = pending.slice(0, -1).map(p => ({
            location: { lat: p.lat!, lng: p.lng! },
            stopover: true
        }));

        directionsService.route(
            {
                origin: currentPos,
                destination: destination,
                waypoints: waypoints.slice(0, 23), // Google limit (approx 25)
                travelMode: google.maps.TravelMode.DRIVING,
                optimizeWaypoints: false, // Already optimized by our algorithm
            },
            (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    setFullDirections(result);
                } else {
                    console.warn('Full path directions failed:', status);
                    setFullDirections(null);
                }
            }
        );
    }, [isLoaded, route, currentPos]);

    const handleComplete = async (pointId: string) => {
        const updated = route.map(p => p.id === pointId ? { ...p, isDelivered: true } : p);
        setRoute(updated);
        await updateActiveRoute(updated);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#3B82F6', '#60A5FA', '#FFFFFF'] });
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    };

    const handleNotDelivered = async (pointId: string) => {
        // Marcamos como entregue para remover da lista pendente, mas com uma tag de falha
        const updated = route.map(p => p.id === pointId ? { ...p, isDelivered: true, status: 'FAILED' } as any : p);
        setRoute(updated);
        await updateActiveRoute(updated);
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
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

    const onLoad = (auto: google.maps.places.Autocomplete) => {
        setAutocomplete(auto);
    };

    const onPlaceChanged = () => {
        if (autocomplete !== null) {
            const place = autocomplete.getPlace();
            if (place.geometry && place.geometry.location) {
                const newPos = {
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng()
                };
                setMapCenter(newPos);
                setZoom(17); // Focus on searched place
                // Optional: Clear search after selection to keep UI clean
                if (searchInputRef.current) searchInputRef.current.value = '';
            }
        }
    };

    const onIdle = () => {
        if (!mapRef.current) return;
        const newCenter = mapRef.current.getCenter();
        const newZoom = mapRef.current.getZoom();
        if (newCenter) {
            const centerObj = { lat: newCenter.lat(), lng: newCenter.lng() };
            // Update state so it doesn't snap back on next re-render
            setMapCenter(centerObj);
        }
        if (newZoom !== undefined) {
            setZoom(newZoom);
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
            {/* Header / Search Bar */}
            <header className="absolute top-0 left-0 right-0 z-20 px-6 pt-14 pb-12 flex items-center justify-between pointer-events-none gap-4">
                <div className="flex-1 pointer-events-auto max-w-md">
                    {isLoaded && (
                        <Autocomplete
                            onLoad={onLoad}
                            onPlaceChanged={onPlaceChanged}
                        >
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-primary !text-[20px] group-focus-within:scale-110 transition-transform">search</span>
                                </div>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Buscar endereços ou locais..."
                                    className="w-full h-12 pl-12 pr-4 bg-bg-start/80 backdrop-blur-xl border border-white/10 rounded-2xl text-white text-sm font-medium placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-2xl transition-all"
                                />
                            </div>
                        </Autocomplete>
                    )}
                </div>

                <div className="flex gap-3 pointer-events-auto">
                    <button
                        onClick={() => setMapTheme(prev => prev === 'night' ? 'silver' : 'night')}
                        className={`size-12 rounded-[1.25rem] border backdrop-blur-xl transition-all flex items-center justify-center shadow-2xl ${mapTheme === 'night'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                            : 'bg-primary/10 border-primary/20 text-primary'
                            }`}
                    >
                        <span className="material-symbols-outlined !text-[24px]">
                            {mapTheme === 'night' ? 'light_mode' : 'dark_mode'}
                        </span>
                    </button>
                    <button onClick={handleClearRoute} className="size-12 rounded-[1.25rem] bg-red-500/10 border border-red-500/20 text-red-500 active:scale-95 transition-all flex items-center justify-center shadow-2xl">
                        <span className="material-symbols-outlined !text-[24px]">delete_sweep</span>
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="absolute inset-0 z-0">
                {activeTab === 'map' ? (
                    <GoogleMap
                        onLoad={(map) => { mapRef.current = map; }}
                        onIdle={onIdle}
                        mapContainerStyle={mapContainerStyle}
                        center={mapCenter}
                        zoom={zoom}
                        options={{
                            disableDefaultUI: true,
                            zoomControl: false,
                            mapTypeControl: false,
                            streetViewControl: false,
                            fullscreenControl: false,
                            clickableIcons: false,
                            gestureHandling: 'greedy', // Better for mobile touch
                            styles: mapTheme === 'night' ? NIGHT_MAP_STYLE : SILVER_MAP_STYLE
                        }}
                    >
                        {/* Full Route Outline (Subtle Background Path) */}
                        {fullDirections && (
                            <DirectionsRenderer
                                directions={fullDirections}
                                options={{
                                    suppressMarkers: true,
                                    preserveViewport: true, // Crucial: Stop auto-zoom out on route change
                                    polylineOptions: {
                                        strokeColor: '#3B82F6',
                                        strokeWeight: 4,
                                        strokeOpacity: 0.3,
                                        zIndex: 1
                                    }
                                }}
                            />
                        )}

                        {/* Active Leg Highlight (Vibrant Glowing Path to Next Stop) */}
                        {directions && (
                            <DirectionsRenderer
                                directions={directions}
                                options={{
                                    suppressMarkers: true,
                                    preserveViewport: true, // Crucial: Stop auto-zoom out on route change
                                    polylineOptions: {
                                        strokeColor: '#60A5FA',
                                        strokeWeight: 7,
                                        strokeOpacity: 1,
                                        zIndex: 10
                                    }
                                }}
                            />
                        )}
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
                                                {p.deadline && (
                                                    <div className="mt-2 flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded w-fit">
                                                        <span className="material-symbols-outlined !text-[12px] text-red-500">schedule</span>
                                                        <span className="text-[9px] font-black text-red-400">ATÉ {p.deadline}</span>
                                                    </div>
                                                )}
                                                {p.isReturnPoint && (
                                                    <div className="mt-2 flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded w-fit">
                                                        <span className="material-symbols-outlined !text-[12px] text-primary">warehouse</span>
                                                        <span className="text-[9px] font-black text-primary">BASE DE RETORNO</span>
                                                    </div>
                                                )}
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
                <div className="absolute bottom-6 inset-x-4 z-30 flex flex-col gap-3 animate-slide-up">
                    <div className="bg-bg-start/95 backdrop-blur-xl rounded-[2rem] p-5 shadow-2xl border border-white/10 relative overflow-hidden flex flex-col gap-4">
                        <button onClick={() => setIsHudMinimized(true)} className="absolute top-4 right-4 z-20 size-8 flex items-center justify-center bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors">
                            <span className="material-symbols-outlined !text-[18px]">expand_more</span>
                        </button>

                        <div className="flex items-center gap-3 pr-10">
                            <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
                                <span className="material-symbols-outlined text-primary !text-[20px]">location_on</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary truncate mb-0.5">
                                    Entregar Agora <span className="text-white/40 ml-1">ID: {activePoint.id.substring(activePoint.id.length - 6).toUpperCase()}</span>
                                </p>
                                <h2 className="text-base font-bold text-white truncate">{activePoint.name}</h2>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">{activePoint.neighborhood} {activePoint.city && `- ${activePoint.city}`}</p>
                                {activePoint.notes && (
                                    <p className="text-[11px] text-amber-400/90 font-medium truncate mt-1.5 border-l-[3px] border-amber-400/50 pl-2">
                                        Obs: {activePoint.notes}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-between gap-2 mt-2">
                            <div className="flex gap-2">
                                <button className="size-12 shrink-0 rounded-2xl bg-[#1E293B] border border-white/5 flex items-center justify-center text-white active:scale-95 transition-all group"
                                    onClick={() => { if (activePoint.lat && activePoint.lng) window.open(`https://waze.com/ul?ll=${activePoint.lat},${activePoint.lng}&navigate=yes`, '_blank'); }}
                                >
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/6/66/Waze_icon.svg" className="size-5 opacity-80 group-hover:opacity-100 transition-opacity" alt="Waze" />
                                </button>
                                <button className="size-12 shrink-0 rounded-2xl bg-[#1E293B] border border-white/5 flex items-center justify-center text-[#25D366] active:scale-95 transition-all"
                                    onClick={() => {
                                        const phoneMatch = activePoint.notes?.match(/\d{10,14}/);
                                        const phone = phoneMatch ? phoneMatch[0] : '5511000000000'; // Fallback simulado
                                        window.open(`https://wa.me/${phone}`, '_blank');
                                    }}
                                >
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-6">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                                    </svg>
                                </button>
                            </div>

                            <div className="flex gap-2 flex-1 min-w-0">
                                <button onClick={() => handleNotDelivered(activePoint.id)} className="flex-1 h-12 bg-red-500 shadow-premium text-white font-black text-[11px] uppercase tracking-widest rounded-2xl flex flex-col items-center justify-center -gap-1 active:scale-95 transition-all">
                                    <span className="material-symbols-outlined !text-[16px]">package_2</span>
                                    FALHA
                                </button>
                                <button onClick={() => handleComplete(activePoint.id)} className="flex-1 h-12 bg-emerald-500 shadow-premium text-white font-black text-[11px] uppercase tracking-widest rounded-2xl flex flex-col items-center justify-center -gap-1 active:scale-95 transition-all">
                                    <span className="material-symbols-outlined !text-[16px]">package_2</span>
                                    FEITO
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'map' && activePoint && (!isNavigating || isHudMinimized) && (
                <div className="absolute bottom-6 inset-x-4 z-30 flex justify-between gap-3">
                    <button onClick={() => { setIsNavigating(true); setIsHudMinimized(false); }} className="flex-1 h-14 px-5 rounded-2xl bg-primary shadow-premium flex justify-between items-center text-white animate-in slide-in-from-bottom active:scale-95 transition-all">
                        <div className="flex flex-col items-start leading-none text-left min-w-0 pr-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/70 truncate w-full">Próxima Parada</span>
                            <span className="text-[14px] font-bold truncate w-full mt-1.5">{activePoint.name}</span>
                        </div>
                        <span className="material-symbols-outlined !text-[24px]">navigation</span>
                    </button>
                </div>
            )}

            {/* Tab Bar - Repositioned to left, smaller size */}
            <div className={`absolute right-4 z-20 flex flex-col gap-3 items-end transition-all duration-500 ${isNavigating ? 'top-6' : 'top-24'}`}>
                {activeTab === 'map' && (
                    <button
                        onClick={() => setMapCenter({ ...currentPos })}
                        className="size-10 rounded-xl flex items-center justify-center bg-bg-start/80 backdrop-blur-md border border-white/10 text-primary shadow-[0_10px_20px_rgba(0,0,0,0.2)] transition-all active:scale-95 mb-1"
                    >
                        <span className="material-symbols-outlined !text-[20px]">my_location</span>
                    </button>
                )}
                {!isNavigating && (
                    <>
                        <button
                            onClick={() => setActiveTab('map')}
                            className={`h-10 px-4 rounded-xl flex items-center w-full min-w-[120px] gap-2 font-bold text-[10px] uppercase tracking-wider transition-all shadow-[0_10px_20px_rgba(0,0,0,0.2)] ${activeTab === 'map' ? 'bg-primary text-white border border-primary/40' : 'bg-bg-start/80 backdrop-blur-md border border-white/10 text-slate-400'}`}
                        >
                            <span className="material-symbols-outlined !text-[16px]">satellite_alt</span>
                            <span className="flex-1 text-left">MAPA</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('list')}
                            className={`h-10 px-4 rounded-xl flex items-center w-full min-w-[120px] gap-2 font-bold text-[10px] uppercase tracking-wider transition-all shadow-[0_10px_20px_rgba(0,0,0,0.2)] ${activeTab === 'list' ? 'bg-primary text-white border border-primary/40' : 'bg-bg-start/80 backdrop-blur-md border border-white/10 text-slate-400'}`}
                        >
                            <span className="material-symbols-outlined !text-[16px]">list_alt</span>
                            <span className="flex-1 text-left">LISTAGEM</span>
                        </button>
                    </>
                )}
            </div>

            {/* Nav Fade Overlay */}
            <nav className="fixed bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-bg-start via-bg-start/80 to-transparent pointer-events-none z-10"></nav>
        </div>
    );
};
