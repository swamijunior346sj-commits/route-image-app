import { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer } from '@react-google-maps/api';
import { getActiveRoute, updateActiveRoute, clearActiveRoute } from '../services/db';
import type { RoutePoint } from '../services/db';
import { Navigation, Trash2, LocateFixed, Route, Loader2, Search, X, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

const mapContainerStyle = {
    width: '100%',
    height: '100%'
};

const defaultCenter = {
    lat: -20.143196,
    lng: -44.2174965
};

const LIBRARIES: ("places" | "drawing" | "geometry" | "visualization")[] = ["places"];

// Dark mode style for Google Maps
const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#212121" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
    { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
    { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] }
];

export const MapView = () => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        libraries: LIBRARIES
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
    const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
    const [isRouting, setIsRouting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<google.maps.places.AutocompletePrediction[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [isNavigating, setIsNavigating] = useState(false);
    const [navigationIndex, setNavigationIndex] = useState(0);
    const [selectedPoint, setSelectedPoint] = useState<RoutePoint | null>(null);
    const [showCelebration, setShowCelebration] = useState(false);

    const autocompleteTimerRef = useRef<any>(null);
    const placesServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
    const geocoderRef = useRef<google.maps.Geocoder | null>(null);

    const onLoad = useCallback((map: google.maps.Map) => {
        setMap(map);
        placesServiceRef.current = new google.maps.places.AutocompleteService();
        geocoderRef.current = new google.maps.Geocoder();
    }, []);

    const onUnmount = useCallback(() => {
        setMap(null);
    }, []);

    useEffect(() => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.log('Location bias failed:', err),
                { enableHighAccuracy: false, timeout: 5000 }
            );
        }
        loadRoute();
    }, []);

    const loadRoute = async () => {
        const points = await getActiveRoute();
        setRoutePoints(points);
        if (points.length === 0) handleLocateMe(true);
    };

    const handleLocateMe = (silent = false) => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setUserLocation(coords);
                    if (map) map.panTo(coords);

                    setRoutePoints(prev => {
                        const filtered = prev.filter(p => p.id !== 'current');
                        return [...filtered, { id: 'current', name: 'Você está aqui', ...coords, scannedAt: Date.now() }];
                    });
                },
                () => {
                    if (!silent) alert('GPS indisponível.');
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }
    };

    const handleClear = async () => {
        if (confirm("Limpar rota ativa?")) {
            await clearActiveRoute();
            setRoutePoints([]);
            setDirectionsResponse(null);
        }
    };

    const handleRoteirizar = async () => {
        const validPoints = routePoints.filter(p => !p.isDelivered && p.lat !== null && p.lng !== null);
        if (validPoints.length < 1) return alert("Adicione destinos primeiro.");

        setIsRouting(true);
        const origin = userLocation || { lat: routePoints[0].lat, lng: routePoints[0].lng };

        // Define waypoints (intermediate points)
        const waypoints = validPoints.map(p => ({
            location: new google.maps.LatLng(p.lat, p.lng),
            stopover: true
        }));

        const directionsService = new google.maps.DirectionsService();

        try {
            const result = await directionsService.route({
                origin: origin,
                destination: waypoints[waypoints.length - 1].location,
                waypoints: waypoints.slice(0, -1),
                optimizeWaypoints: true,
                travelMode: google.maps.TravelMode.DRIVING,
            });

            if (result && result.routes && result.routes.length > 0) {
                setDirectionsResponse(result);
                // Update route order based on optimization
                const order = result.routes[0].waypoint_order;
                const sortedIntermediate = order.map(idx => validPoints[idx]);
                // This is a simplified sort - in production we'd map all fields carefully
                setRoutePoints(prev => [
                    ...prev.filter(p => p.isDelivered || p.id === 'current'),
                    ...sortedIntermediate,
                    validPoints[validPoints.length - 1]
                ]);
            }
        } catch (err) {
            console.error("Routing error:", err);
            alert("Erro na otimização de rota.");
        } finally {
            setIsRouting(false);
        }
    };

    const handleStartNavigation = () => {
        const dests = routePoints.filter(p => p.id !== 'current' && !p.isDelivered);
        if (dests.length === 0) return alert("Sem destinos pendentes.");
        setIsNavigating(true);
        setNavigationIndex(0);
        if (!directionsResponse) handleRoteirizar();
    };

    const handleCompleteStop = async () => {
        const dests = routePoints.filter(p => p.id !== 'current' && !p.isDelivered);
        const point = dests[navigationIndex];
        if (!point) return;

        if (navigator.vibrate) navigator.vibrate(50);
        await finalizeCompletion(point.id);
    };

    const finalizeCompletion = async (id: string) => {
        const updated = routePoints.map(p => p.id === id ? { ...p, isDelivered: true } : p);
        setRoutePoints(updated);
        await updateActiveRoute(updated.filter(p => p.id !== 'current'));

        const remaining = updated.filter(p => p.id !== 'current' && !p.isDelivered);
        if (remaining.length === 0) {
            setShowCelebration(true);
            triggerConfetti();
            setIsNavigating(false);
            setDirectionsResponse(null);
        } else {
            // Recalculate route if needed or just move to next
            const nextIdx = updated.filter(p => p.id !== 'current' && !p.isDelivered).findIndex(p => !p.isDelivered);
            if (nextIdx !== -1) setNavigationIndex(0); // Index 0 of pendings
        }
    };

    const triggerConfetti = () => {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#3b82f6', '#ffffff', '#6366f1'] });
    };

    // Google Places Search
    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.length < 3 || !placesServiceRef.current) return setSearchResults([]);

        if (autocompleteTimerRef.current) clearTimeout(autocompleteTimerRef.current);
        autocompleteTimerRef.current = setTimeout(() => {
            setIsSearching(true);
            placesServiceRef.current?.getPlacePredictions({
                input: searchQuery,
                componentRestrictions: { country: 'br' },
                locationBias: userLocation ? new google.maps.LatLng(userLocation.lat, userLocation.lng) : undefined
            }, (predictions, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                    setSearchResults(predictions);
                }
                setIsSearching(false);
            });
        }, 500);
    }, [searchQuery, userLocation]);

    const selectPrediction = (prediction: google.maps.places.AutocompletePrediction) => {
        geocoderRef.current?.geocode({ placeId: prediction.place_id }, (results, status) => {
            if (status === 'OK' && results?.[0]) {
                const loc = results[0].geometry.location;
                const p: RoutePoint = {
                    id: crypto.randomUUID(),
                    name: prediction.structured_formatting.main_text,
                    lat: loc.lat(),
                    lng: loc.lng(),
                    scannedAt: Date.now(),
                    neighborhood: results[0].address_components.find(c => c.types.includes('sublocality'))?.long_name || ''
                };
                const updated = [...routePoints, p];
                setRoutePoints(updated);
                updateActiveRoute(updated.filter(x => x.id !== 'current'));
                map?.panTo(loc);
                setSearchResults([]);
                setSearchQuery('');
            }
        });
    };

    if (!isLoaded) return <div className="h-full w-full bg-black flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

    return (
        <div className="relative w-full h-full flex flex-col pt-safe bg-black overflow-hidden">
            {/* Header HUD */}
            <div className="absolute top-0 z-20 w-full p-6 flex flex-col gap-4 pointer-events-none">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase">Operação <span className="text-blue-500">Mapa</span></h1>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,1)]" />
                            <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em]">Sistemas Google Ativos</p>
                        </div>
                    </div>
                </div>

                <div className="relative pointer-events-auto max-w-lg">
                    <input
                        type="text"
                        placeholder="BUSCAR ENDEREÇO OU LOCAL..."
                        className="w-full bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-2xl py-4 px-6 text-xs text-white focus:outline-none focus:border-blue-500/50 italic font-bold tracking-widest uppercase shadow-2xl"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center">
                        {isSearching ? <Loader2 size={18} className="animate-spin text-blue-500" /> : <Search className="text-zinc-600" size={18} />}
                    </div>
                </div>

                {searchResults.length > 0 && (
                    <div className="mt-2 bg-zinc-950/90 backdrop-blur-3xl border border-white/10 rounded-3xl max-h-60 overflow-y-auto pointer-events-auto flex flex-col p-2 gap-1 animate-slide-up max-w-lg shadow-2xl">
                        {searchResults.map((res, i) => (
                            <button key={i} onClick={() => selectPrediction(res)} className="text-left p-4 hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/5 group">
                                <p className="text-[10px] font-bold text-white uppercase tracking-tight">{res.structured_formatting.main_text}</p>
                                <p className="text-[8px] text-zinc-500 uppercase">{res.structured_formatting.secondary_text}</p>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={userLocation || defaultCenter}
                zoom={14}
                onLoad={onLoad}
                onUnmount={onUnmount}
                options={{
                    styles: darkMapStyle,
                    disableDefaultUI: true,
                    clickableIcons: false,
                    zoomControl: false,
                    gestureHandling: 'greedy'
                }}
            >
                {routePoints.map((p, i) => (
                    <Marker
                        key={p.id + i}
                        position={{ lat: p.lat, lng: p.lng }}
                        onClick={() => setSelectedPoint(p)}
                        icon={p.id === 'current' ? {
                            path: google.maps.SymbolPath.CIRCLE,
                            fillColor: '#3b82f6',
                            fillOpacity: 1,
                            strokeColor: '#ffffff',
                            strokeWeight: 2,
                            scale: 8
                        } : {
                            url: 'https://cdn-icons-png.flaticon.com/512/679/679821.png',
                            scaledSize: new google.maps.Size(32, 32),
                            origin: new google.maps.Point(0, 0),
                            anchor: new google.maps.Point(16, 32)
                        }}
                    />
                ))}

                {directionsResponse && (
                    <DirectionsRenderer
                        directions={directionsResponse}
                        options={{
                            suppressMarkers: true,
                            polylineOptions: {
                                strokeColor: '#3b82f6',
                                strokeWeight: 5,
                                strokeOpacity: 0.8
                            }
                        }}
                    />
                )}

                {selectedPoint && (
                    <InfoWindow
                        position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
                        onCloseClick={() => setSelectedPoint(null)}
                    >
                        <div className="p-2 min-w-[150px] bg-zinc-950 text-white rounded-xl">
                            <h4 className="text-sm font-black italic uppercase italic leading-none mb-1">{selectedPoint.name}</h4>
                            <p className="text-[9px] text-zinc-500 uppercase tracking-widest">{selectedPoint.neighborhood || 'Zona de Entrega'}</p>
                        </div>
                    </InfoWindow>
                )}
            </GoogleMap>

            {/* Float Actions */}
            <div className="absolute top-40 right-6 z-10 flex flex-col gap-3">
                <button onClick={isNavigating ? () => setIsNavigating(false) : handleStartNavigation} className={`w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-3xl shadow-2xl transition-all border ${isNavigating ? 'bg-red-500/20 border-red-500/40 text-red-500' : 'bg-zinc-900/60 border-white/10 text-blue-500'}`}>
                    {isNavigating ? <X size={24} /> : <Navigation size={24} />}
                </button>
                <button onClick={handleRoteirizar} className="w-14 h-14 bg-zinc-900/60 backdrop-blur-3xl border border-white/10 rounded-2xl text-indigo-400 flex items-center justify-center shadow-2xl">
                    {isRouting ? <Loader2 size={24} className="animate-spin" /> : <Route size={24} />}
                </button>
                <button onClick={() => handleLocateMe()} className="w-14 h-14 bg-zinc-900/60 backdrop-blur-3xl border border-white/10 rounded-2xl text-emerald-400 flex items-center justify-center shadow-2xl">
                    <LocateFixed size={24} />
                </button>
                <button onClick={handleClear} className="w-14 h-14 bg-zinc-900/60 backdrop-blur-3xl border border-white/10 rounded-2xl text-zinc-600 flex items-center justify-center shadow-2xl">
                    <Trash2 size={24} />
                </button>
            </div>

            {/* Navigation Bar Bottom */}
            {isNavigating && (
                <div className="absolute bottom-24 left-6 right-6 z-20 animate-slide-up">
                    <div className="bg-zinc-950/90 backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/10 shadow-2xl flex items-center gap-5 relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 h-1 bg-blue-500/20 w-full">
                            <div className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,1)] transition-all duration-500" style={{ width: `${((navigationIndex + 1) / routePoints.filter(p => p.id !== 'current' && !p.isDelivered).length) * 100}%` }} />
                        </div>
                        <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                            <Navigation size={24} className="text-blue-500 animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest block mb-1">Missão {navigationIndex + 1} de {routePoints.filter(p => p.id !== 'current' && !p.isDelivered).length}</span>
                            <h4 className="text-base font-black italic uppercase text-white truncate">{routePoints.filter(p => p.id !== 'current' && !p.isDelivered)[navigationIndex]?.name || "COORDENADA_X"}</h4>
                        </div>
                        <button onClick={handleCompleteStop} className="bg-white text-black font-black uppercase tracking-widest px-6 py-3 rounded-xl text-[10px] active:scale-95 transition-all">OK</button>
                    </div>
                </div>
            )}

            {/* Roteirizando Overlay */}
            {isRouting && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center text-center p-12">
                    <div className="relative mb-8">
                        <div className="w-24 h-24 border-2 border-blue-500/10 rounded-full animate-spin border-t-blue-500"></div>
                        <Route size={32} className="absolute inset-0 m-auto text-blue-500 animate-pulse" />
                    </div>
                    <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">Inteligência de Rota Ativada</h3>
                    <p className="text-blue-500/40 text-[9px] font-black uppercase tracking-[0.4em] mt-2">Otimizando Waypoints via Google Cloud</p>
                </div>
            )}

            {/* CELEBRATION */}
            {showCelebration && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in bg-black/95 backdrop-blur-2xl text-center">
                    <div className="flex flex-col items-center gap-6">
                        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                            <CheckCircle2 size={40} className="text-emerald-500" />
                        </div>
                        <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Operação Concluída</h2>
                        <p className="text-zinc-500 font-black uppercase tracking-widest text-[9px]">Todos os destinos foram alcançados.</p>
                        <button onClick={() => setShowCelebration(false)} className="bg-white text-black font-black uppercase tracking-widest py-4 px-10 rounded-2xl text-[10px] mt-4">Retornar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

