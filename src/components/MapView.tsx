import { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer, Circle } from '@react-google-maps/api';
import { getActiveRoute, updateActiveRoute, clearActiveRoute } from '../services/db';
import type { RoutePoint } from '../services/db';
import { Navigation, Trash2, LocateFixed, Route, Loader2, Search, X, CheckCircle2, Plus, MapPin, ChevronDown, ChevronUp, Package } from 'lucide-react';
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

// Map configuration constants

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
    const [accuracy, setAccuracy] = useState<number | null>(null);
    const [showRouteConfirmation, setShowRouteConfirmation] = useState(false);
    const [sheetExpanded, setSheetExpanded] = useState(false);

    // Touch drag for bottom sheet
    const touchStartY = useRef<number>(0);
    const handleSheetTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
    };
    const handleSheetTouchEnd = (e: React.TouchEvent) => {
        const delta = touchStartY.current - e.changedTouches[0].clientY;
        if (delta > 40) setSheetExpanded(true);   // swipe up
        if (delta < -40) setSheetExpanded(false);  // swipe down
    };

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
        let watchId: number | null = null;

        if ('geolocation' in navigator) {
            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setUserLocation(coords);
                    setAccuracy(pos.coords.accuracy);

                    // Keep "You are here" point in sync silently
                    setRoutePoints(prev => {
                        const others = prev.filter(p => p.id !== 'current');
                        return [...others, { id: 'current', name: 'Você está aqui', ...coords, scannedAt: Date.now() }];
                    });
                },
                (err) => console.log('Continuous GPS error:', err),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }
        loadRoute();

        return () => {
            if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        };
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
                    setAccuracy(pos.coords.accuracy);
                    if (map) map.panTo(coords);
                    if (map) map.setZoom(17); // Professional precision zoom level

                    setRoutePoints(prev => {
                        const filtered = prev.filter(p => p.id !== 'current');
                        return [...filtered, { id: 'current', name: 'Você está aqui', ...coords, scannedAt: Date.now() }];
                    });
                },
                () => {
                    if (!silent) alert('GPS indisponível para alta precisão.');
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
                setShowRouteConfirmation(true);
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
                <div className="flex flex-wrap items-center gap-2">
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
                    <div className="mt-2 bg-zinc-950/90 backdrop-blur-3xl border border-white/10 rounded-3xl max-h-72 overflow-y-auto pointer-events-auto flex flex-col p-3 gap-2 animate-slide-up max-w-lg shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] custom-scrollbar">
                        {searchResults.map((res, i) => (
                            <div key={i} className="flex items-center gap-3 p-1">
                                <button
                                    onClick={() => selectPrediction(res)}
                                    className="flex-1 text-left p-4 bg-white/[0.02] hover:bg-white/5 rounded-2xl transition-all border border-transparent hover:border-white/10 group flex items-start gap-4"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center border border-white/5 group-hover:border-blue-500/30 transition-colors">
                                        <MapPin size={18} className="text-zinc-600 group-hover:text-blue-500 transition-colors" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-black text-white uppercase tracking-tight truncate">{res.structured_formatting.main_text}</p>
                                        <p className="text-[9px] text-zinc-500 uppercase truncate mt-0.5">{res.structured_formatting.secondary_text}</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => selectPrediction(res)}
                                    className="w-14 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-blue-400/20"
                                    title="Adicionar à Rota"
                                >
                                    <Plus size={24} />
                                </button>
                            </div>
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
                    disableDefaultUI: false,
                    clickableIcons: true,
                    zoomControl: true,
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

                {userLocation && accuracy && (
                    <Circle
                        center={userLocation}
                        radius={accuracy}
                        options={{
                            fillColor: '#3b82f6',
                            fillOpacity: 0.1,
                            strokeColor: '#3b82f6',
                            strokeOpacity: 0.3,
                            strokeWeight: 1,
                            clickable: false
                        }}
                    />
                )}

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

            {/* Route Confirmation Bottom Sheet */}
            {showRouteConfirmation && directionsResponse && (
                <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm pointer-events-none">
                    <div className="bg-zinc-950/95 border-t border-white/10 p-8 pb-12 rounded-t-[3.5rem] animate-slide-up pointer-events-auto max-h-[85vh] flex flex-col shadow-[0_-25px_60px_rgba(0,0,0,0.9)]">
                        <div className="w-16 h-1.5 bg-zinc-800 rounded-full mx-auto mb-10" />

                        <div className="flex justify-between items-center mb-8 px-2">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter">Manifesto de Rota</h2>
                                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">{routePoints.filter(p => p.id !== 'current' && !p.isDelivered).length} Pontos de Entrega</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Total Estimado</p>
                                <p className="text-xl font-black text-white italic">
                                    {(directionsResponse.routes[0].legs.reduce((acc, leg) => acc + (leg.distance?.value || 0), 0) / 1000).toFixed(1)}KM
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 space-y-4 mb-10">
                            {routePoints.filter(p => p.id !== 'current' && !p.isDelivered).map((point, idx) => (
                                <div key={point.id} className="bg-white/[0.03] border border-white/5 p-5 rounded-3xl flex items-center gap-5 group hover:bg-white/[0.06] transition-all">
                                    <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center text-[12px] font-black text-blue-500 italic">
                                        #{idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-black text-white uppercase truncate tracking-tight">{point.name}</p>
                                        <p className="text-[10px] text-zinc-500 uppercase truncate mt-0.5">{point.neighborhood || 'Zona_Operacional'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setShowRouteConfirmation(false)}
                                className="bg-white/[0.03] border border-white/10 py-6 rounded-3xl text-[12px] font-black uppercase text-zinc-400 tracking-widest active:scale-95 transition-all"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={() => {
                                    setShowRouteConfirmation(false);
                                    setIsNavigating(true);
                                    setNavigationIndex(0);
                                }}
                                className="bg-blue-600 hover:bg-blue-500 border border-blue-400/30 py-6 rounded-3xl flex items-center justify-center gap-3 shadow-[0_20px_40px_rgba(37,99,235,0.4)] text-[12px] font-black uppercase text-white tracking-widest active:scale-95 transition-all"
                            >
                                Iniciar Operação
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* === SPOKE-STYLE NAVIGATION BOTTOM SHEET === */}
            {isNavigating && (() => {
                const pendingPoints = routePoints.filter(p => p.id !== 'current' && !p.isDelivered);
                const currentStop = pendingPoints[navigationIndex];
                const totalStops = pendingPoints.length;
                const progress = totalStops > 0 ? ((navigationIndex) / totalStops) * 100 : 0;

                return (
                    <div
                        className={`absolute left-0 right-0 z-30 transition-all duration-500 ease-out ${sheetExpanded
                            ? 'bottom-0 top-auto'
                            : 'bottom-[80px]'
                            }`}
                        onTouchStart={handleSheetTouchStart}
                        onTouchEnd={handleSheetTouchEnd}
                    >
                        {/* Backdrop blur when expanded */}
                        {sheetExpanded && (
                            <div
                                className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10"
                                onClick={() => setSheetExpanded(false)}
                            />
                        )}

                        <div className={`bg-zinc-950 border-t border-white/10 shadow-[0_-30px_80px_rgba(0,0,0,0.8)] transition-all duration-500 ease-out ${sheetExpanded
                            ? 'rounded-t-[2.5rem] max-h-[85vh] flex flex-col'
                            : 'rounded-t-[2.5rem]'
                            }`}>

                            {/* Drag Handle + Progress Bar */}
                            <div
                                className="flex flex-col items-center pt-4 pb-2 cursor-grab active:cursor-grabbing"
                                onClick={() => setSheetExpanded(prev => !prev)}
                            >
                                <div className="w-12 h-1 bg-zinc-700 rounded-full mb-3" />
                                {/* Progress track */}
                                <div className="w-full px-6 mb-1">
                                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between mt-1.5 px-0.5">
                                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">
                                            Parada {navigationIndex + 1} de {totalStops}
                                        </span>
                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                                            {totalStops - navigationIndex - 1} restantes
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Current Stop - always visible */}
                            <div className="px-6 pb-4">
                                <div className="flex items-center gap-4">
                                    {/* Stop number badge */}
                                    <div className="w-14 h-14 rounded-2xl bg-blue-600 flex flex-col items-center justify-center shrink-0 shadow-[0_8px_24px_rgba(37,99,235,0.4)]">
                                        <span className="text-[8px] font-black text-blue-200 uppercase">STOP</span>
                                        <span className="text-xl font-black text-white leading-none">{navigationIndex + 1}</span>
                                    </div>

                                    {/* Address Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest truncate">
                                            {currentStop?.neighborhood || 'ZONA OPERACIONAL'}
                                        </p>
                                        <h3 className="text-lg font-black italic uppercase text-white tracking-tighter leading-tight truncate">
                                            {currentStop?.name || '---'}
                                        </h3>
                                        {currentStop?.notes && (
                                            <p className="text-[9px] text-zinc-500 mt-0.5 truncate">{currentStop.notes}</p>
                                        )}
                                    </div>

                                    {/* Expand toggle */}
                                    <button
                                        onClick={() => setSheetExpanded(prev => !prev)}
                                        className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 shrink-0"
                                    >
                                        {sheetExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                                    </button>
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <button
                                        onClick={() => {
                                            // Skip this stop — mark as not-visited but move on
                                            if (navigationIndex < pendingPoints.length - 1) {
                                                setNavigationIndex(prev => prev + 1);
                                            }
                                        }}
                                        className="bg-white/[0.03] border border-white/10 py-4 rounded-2xl text-[11px] font-black uppercase text-zinc-400 tracking-widest active:scale-95 transition-all"
                                    >
                                        Pular
                                    </button>
                                    <button
                                        onClick={handleCompleteStop}
                                        className="bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl text-[11px] font-black uppercase text-white tracking-widest shadow-[0_10px_30px_rgba(37,99,235,0.4)] active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 size={16} /> Concluído
                                    </button>
                                </div>
                            </div>

                            {/* Expanded: Full stop list */}
                            {sheetExpanded && (
                                <div className="flex-1 overflow-y-auto px-6 pb-32 space-y-3 border-t border-white/5 pt-4 mt-2">
                                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-4">Todas as Paradas</p>
                                    {pendingPoints.map((point, idx) => {
                                        const isCurrent = idx === navigationIndex;
                                        const isPast = idx < navigationIndex;
                                        return (
                                            <div
                                                key={point.id}
                                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isCurrent
                                                    ? 'bg-blue-600/10 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                                                    : isPast
                                                        ? 'bg-white/[0.01] border-white/5 opacity-40'
                                                        : 'bg-white/[0.02] border-white/5'
                                                    }`}
                                            >
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black shrink-0 ${isCurrent ? 'bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.6)]' : 'bg-zinc-900 text-zinc-500 border border-white/10'
                                                    }`}>
                                                    {isPast ? '✓' : idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-[12px] font-black uppercase truncate tracking-tight ${isCurrent ? 'text-white' : 'text-zinc-400'
                                                        }`}>{point.name}</p>
                                                    <p className="text-[9px] text-zinc-600 uppercase truncate mt-0.5">{point.neighborhood || '---'}</p>
                                                </div>
                                                {isCurrent && (
                                                    <Package size={16} className="text-blue-400 animate-pulse shrink-0" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

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

