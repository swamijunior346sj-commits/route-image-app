import { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Circle } from '@react-google-maps/api';
import { getActiveRoute, updateActiveRoute, clearActiveRoute } from '../services/db';
import type { RoutePoint } from '../services/db';
import { Navigation, Trash2, LocateFixed, Route, Loader2, Search, X, CheckCircle2, Plus, MapPin, Pencil, Trash, RotateCcw, PackageCheck, PackageX, ChevronUp } from 'lucide-react';
import confetti from 'canvas-confetti';
import { LoadingOverlay } from './LoadingOverlay';

const mapContainerStyle = {
    width: '100%',
    height: '100%'
};

const defaultCenter = {
    lat: -20.143196,
    lng: -44.2174965
};

const LIBRARIES: ("places" | "drawing" | "geometry" | "visualization")[] = ["places"];

const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
    { elementType: 'labels.text.stroke', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
    { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
    { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] }
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
    const [showCelebration, setShowCelebration] = useState(false);
    const [accuracy, setAccuracy] = useState<number | null>(null);
    const [showCheckAnimation, setShowCheckAnimation] = useState(false);
    const [showRouteConfirmation, setShowRouteConfirmation] = useState(false);
    const [manifestExpanded, setManifestExpanded] = useState(false);
    const [editExpanded, setEditExpanded] = useState(false);
    const [sheetExpanded, setSheetExpanded] = useState(false);
    const [undoTimeout, setUndoTimeout] = useState<any>(null);
    const [lastActionPointId, setLastActionPointId] = useState<string | null>(null);

    // Marker edit panel
    const [editingPoint, setEditingPoint] = useState<RoutePoint | null>(null);
    const [editName, setEditName] = useState('');
    const [editNeighborhood, setEditNeighborhood] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editLat, setEditLat] = useState('');
    const [editLng, setEditLng] = useState('');

    const placesServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
    const geocoderRef = useRef<google.maps.Geocoder | null>(null);

    const openEditPanel = (p: RoutePoint) => {
        if (p.id === 'current') return;
        setEditingPoint(p);
        setEditName(p.name);
        setEditNeighborhood(p.neighborhood || '');
        setEditNotes(p.notes || '');
        setEditLat(p.lat ? String(p.lat) : '');
        setEditLng(p.lng ? String(p.lng) : '');
    };

    const handleSavePointEdit = async () => {
        if (!editingPoint) return;
        try {
            const lat = parseFloat(editLat);
            const lng = parseFloat(editLng);
            const updated = routePoints.map(p =>
                p.id === editingPoint.id
                    ? {
                        ...p,
                        name: editName,
                        neighborhood: editNeighborhood,
                        notes: editNotes,
                        lat: isNaN(lat) ? p.lat : lat,
                        lng: isNaN(lng) ? p.lng : lng
                    }
                    : p
            );
            await updateActiveRoute(updated);
            setRoutePoints(updated);
            setEditingPoint(null);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeletePoint = async (id: string) => {
        if (!confirm("Remover este ponto da rota?")) return;
        try {
            const updated = routePoints.filter(p => p.id !== id);
            await updateActiveRoute(updated);
            setRoutePoints(updated);
        } catch (err) {
            console.error(err);
        }
    };

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

    // Efeito para Geocodificar pontos que não tem lat/lng mas tem nome (endereço)
    useEffect(() => {
        if (!isLoaded || !geocoderRef.current || routePoints.length === 0) return;

        const pointsToGeocode = routePoints.filter(p => (p.lat === null || p.lng === null) && p.name && p.id !== 'current');

        if (pointsToGeocode.length > 0) {
            pointsToGeocode.forEach(p => {
                const query = [p.name, p.neighborhood, p.city].filter(Boolean).join(', ');
                geocoderRef.current?.geocode({ address: query }, (results, status) => {
                    if (status === 'OK' && results?.[0]) {
                        const loc = results[0].geometry.location;
                        setRoutePoints(prev => prev.map(item =>
                            item.id === p.id ? { ...item, lat: loc.lat(), lng: loc.lng() } : item
                        ));
                    }
                });
            });
        }
    }, [isLoaded, routePoints.length]);

    // Efeito para centralizar o mapa nos pontos da rota
    useEffect(() => {
        if (map && routePoints.length > 1) {
            const bounds = new google.maps.LatLngBounds();
            let hasValidPoints = false;
            routePoints.forEach(p => {
                if (p.lat !== null && p.lng !== null) {
                    bounds.extend({ lat: p.lat, lng: p.lng });
                    hasValidPoints = true;
                }
            });
            if (hasValidPoints) {
                map.fitBounds(bounds, 50);
            }
        }
    }, [map, routePoints]); // Depender do array inteiro para re-enquadrar ao reordenar

    const handleLocateMe = (silent = false) => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setUserLocation(coords);
                    setAccuracy(pos.coords.accuracy);
                    if (map) map.panTo(coords);
                    if (map) map.setZoom(17);

                    setRoutePoints(prev => {
                        const filtered = prev.filter(p => p.id !== 'current');
                        return [...filtered, { id: 'current', name: 'Você está aqui', ...coords, scannedAt: Date.now() }];
                    });
                },
                () => {
                    if (!silent) alert('GPS indisponível.');
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
        const validPoints = routePoints.filter(p => !p.isDelivered && p.id !== 'current');
        if (validPoints.length < 1) return alert("Adicione destinos primeiro.");

        setIsRouting(true);
        const origin = userLocation || (validPoints[0].lat && validPoints[0].lng ? { lat: validPoints[0].lat, lng: validPoints[0].lng } : validPoints[0].name);

        const buildLocation = (p: any) => {
            if (p.lat !== null && p.lng !== null && p.lat !== 0) return new google.maps.LatLng(p.lat, p.lng);
            return [p.name, p.neighborhood, p.city].filter(Boolean).join(', ');
        };

        const destPoint = validPoints[validPoints.length - 1];
        const waypointsList = validPoints.slice(0, -1);

        const waypoints = waypointsList.map(p => ({
            location: buildLocation(p),
            stopover: true
        }));

        const directionsService = new google.maps.DirectionsService();

        try {
            const result = await directionsService.route({
                origin: origin as any,
                destination: buildLocation(destPoint) as any,
                waypoints: waypoints as any,
                optimizeWaypoints: true,
                travelMode: google.maps.TravelMode.DRIVING,
            });

            if (result && result.routes && result.routes.length > 0) {
                setDirectionsResponse(result);

                // Extrair a nova ordem otimizada
                const order = result.routes[0].waypoint_order;
                const sortedIntermediate = order.map(idx => waypointsList[idx]);

                // Criar nova lista com timestamps sequenciais para persistir a ordem otimizada
                const baseTime = Date.now();
                const reorderedPoints = [
                    ...sortedIntermediate,
                    destPoint
                ].map((p, idx) => ({
                    ...p,
                    scannedAt: baseTime + (idx * 1000) // Incrementa 1s para cada ponto
                }));

                const finalRoute = [
                    ...routePoints.filter(p => p.isDelivered || p.id === 'current'),
                    ...reorderedPoints
                ];

                await updateActiveRoute(finalRoute);
                setRoutePoints(finalRoute);
                setShowRouteConfirmation(true);
            }
        } catch (err) {
            console.error("Routing error:", err);
            alert("Erro na roteirização Google.");
        } finally {
            setIsRouting(false);
        }
    };

    const handleCompleteStop = async (delivered: boolean) => {
        const dests = routePoints.filter(p => p.id !== 'current' && !p.isDelivered);
        const point = dests[navigationIndex];
        if (!point) return;

        // Limpar timeouts anteriores se houver
        if (undoTimeout) clearTimeout(undoTimeout);

        // Salvar estado para desfazer
        setLastActionPointId(point.id);

        // Efeito visual imediato
        setShowCheckAnimation(true);
        setTimeout(() => setShowCheckAnimation(false), 800);

        // Marcar localmente primeiro para resposta instantânea
        const updated = routePoints.map(p => p.id === point.id ? { ...p, isDelivered: delivered } : p);
        setRoutePoints(updated);

        // Timer de 3 segundos para confirmar a ação (UNDO)
        const timeout = setTimeout(async () => {
            await updateActiveRoute(updated);
            setLastActionPointId(null);

            if (navigationIndex < dests.length - 1) {
                setNavigationIndex(prev => prev + 1);
            } else {
                setIsNavigating(false);
                setShowCelebration(true);
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 }
                });
                setTimeout(() => setShowCelebration(false), 5000);
            }
        }, 3000);

        setUndoTimeout(timeout);
    };

    const handleUndoAction = () => {
        if (undoTimeout) {
            clearTimeout(undoTimeout);
            setUndoTimeout(null);

            // Reverter localmente
            if (lastActionPointId) {
                setRoutePoints(prev => prev.map(p => p.id === lastActionPointId ? { ...p, isDelivered: false } : p));
            }
            setLastActionPointId(null);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded || !placesServiceRef.current || !searchQuery.trim()) return;
        setIsSearching(true);
        placesServiceRef.current.getPlacePredictions(
            {
                input: searchQuery,
                locationBias: userLocation ? new google.maps.LatLng(userLocation.lat, userLocation.lng) : undefined
            },
            (predictions: google.maps.places.AutocompletePrediction[] | null, status: google.maps.places.PlacesServiceStatus) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                    setSearchResults(predictions);
                }
                setIsSearching(false);
            }
        );
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.trim().length > 2) {
                // Trigger search automatically
                if (isLoaded && placesServiceRef.current) {
                    setIsSearching(true);
                    placesServiceRef.current.getPlacePredictions(
                        {
                            input: searchQuery,
                            locationBias: userLocation ? new google.maps.LatLng(userLocation.lat, userLocation.lng) : undefined
                        },
                        (predictions, status) => {
                            if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
                                setSearchResults(predictions);
                            } else {
                                setSearchResults([]);
                            }
                            setIsSearching(false);
                        }
                    );
                }
            } else {
                setSearchResults([]);
            }
        }, 500); // Debounce of 500ms

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, isLoaded, userLocation]);

    const selectPrediction = (prediction: google.maps.places.AutocompletePrediction) => {
        if (!geocoderRef.current) return;
        geocoderRef.current.geocode({ placeId: prediction.place_id }, async (results, status) => {
            if (status === 'OK' && results?.[0]) {
                const loc = results[0].geometry.location;
                const newPoint: RoutePoint = {
                    id: Date.now().toString(),
                    name: prediction.structured_formatting.main_text,
                    lat: loc.lat(),
                    lng: loc.lng(),
                    scannedAt: Date.now(),
                    neighborhood: results[0].address_components.find(c => c.types.includes('sublocality'))?.long_name || '',
                    city: results[0].address_components.find(c => c.types.includes('administrative_area_level_2'))?.long_name || '',
                };
                const updated = [...routePoints.filter(p => p.id !== 'current'), newPoint];
                await updateActiveRoute(updated);
                setRoutePoints([...updated, ...(userLocation ? [{ id: 'current', name: 'Você está aqui', ...userLocation, scannedAt: Date.now() }] : [])]);
                setSearchQuery('');
                setSearchResults([]);
            }
        });
    };

    if (!isLoaded) return (
        <LoadingOverlay
            title="Motor Cartográfico"
            subtitle="Renderizando Vetores e Camadas de Tráfego"
            icon={<MapPin size={32} className="text-white animate-pulse" />}
        />
    );

    return (
        <div className="relative w-full h-full bg-black overflow-hidden">
            {/* SEARCH HUD */}
            <div className={`absolute top-10 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-6 transition-all duration-700 ${isNavigating ? '-translate-y-32' : ''}`}>
                <div className="relative group">
                    <form onSubmit={handleSearch} className="relative bg-white border-2 border-zinc-200 rounded-[2rem] p-4 flex items-center gap-4 shadow-[0_20px_40px_rgba(0,0,0,0.1)] focus-within:border-blue-500">
                        <Search size={20} className="text-zinc-400 ml-2" />
                        <input
                            placeholder="Pesquisar endereço Google..."
                            className="bg-transparent flex-1 outline-none text-zinc-900 text-sm font-bold placeholder:text-zinc-400"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {isSearching && <Loader2 size={18} className="animate-spin text-blue-500" />}
                        {searchQuery && (
                            <button type="button" onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400">
                                <X size={16} />
                            </button>
                        )}
                    </form>
                </div>
                {searchResults.length > 0 && (
                    <div className="mt-4 bg-white border border-zinc-100 rounded-[2.5rem] overflow-hidden shadow-2xl p-3 flex flex-col gap-1 max-h-[60vh] overflow-y-auto">
                        {searchResults.map((res) => (
                            <div key={res.place_id} className="flex gap-2">
                                <button
                                    onClick={() => selectPrediction(res)}
                                    className="flex-1 flex items-center gap-4 p-5 hover:bg-zinc-50 rounded-[1.8rem] transition-all text-left"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
                                        <MapPin size={18} className="text-zinc-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12px] font-black text-zinc-900 truncate">{res.structured_formatting.main_text}</p>
                                        <p className="text-[9px] text-zinc-500 truncate">{res.structured_formatting.secondary_text}</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => selectPrediction(res)}
                                    className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90"
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
                    disableDefaultUI: true,
                    styles: darkMapStyle
                }}
            >
                {routePoints.map((p, i) => (
                    p.lat !== null && p.lng !== null && (
                        <Marker
                            key={`${p.id}-${i}`}
                            position={{ lat: p.lat, lng: p.lng }}
                            onClick={() => openEditPanel(p)}
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
                                anchor: new google.maps.Point(16, 32)
                            }}
                        />
                    )
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
            </GoogleMap>

            {/* Float Actions */}
            <div className="absolute top-40 right-6 z-10 flex flex-col gap-3">
                <button onClick={() => setIsNavigating(prev => !prev)} className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-white border border-zinc-200 shadow-xl transition-all ${isNavigating ? 'text-blue-600' : 'text-zinc-500'}`}>
                    <Navigation size={24} />
                </button>
                <button onClick={handleRoteirizar} className="w-14 h-14 bg-white border border-zinc-200 rounded-2xl text-indigo-600 flex items-center justify-center shadow-xl">
                    {isRouting ? <Loader2 size={24} className="animate-spin" /> : <Route size={24} />}
                </button>
                <button onClick={() => handleLocateMe()} className="w-14 h-14 bg-white border border-zinc-200 rounded-2xl text-emerald-600 flex items-center justify-center shadow-xl">
                    <LocateFixed size={24} />
                </button>
                <button onClick={handleClear} className="w-14 h-14 bg-white border border-zinc-200 rounded-2xl text-red-400 flex items-center justify-center shadow-xl">
                    <Trash2 size={24} />
                </button>
            </div>

            {/* EDIT PANEL (Standardized Bottom Sheet) */}
            {editingPoint && (
                <div className="absolute inset-0 z-[100] flex flex-col justify-end bg-black/40 backdrop-blur-sm pointer-events-none">
                    <div className={`w-full bg-white border-t-2 border-zinc-100 rounded-t-[3.5rem] shadow-2xl transition-all duration-500 pointer-events-auto ${editExpanded ? 'h-[85vh]' : 'h-[500px]'}`}>
                        <div onClick={() => setEditExpanded(!editExpanded)} className="py-4 flex flex-col items-center gap-1 cursor-pointer">
                            <div className="w-12 h-1.5 bg-zinc-200 rounded-full" />
                            <ChevronUp size={20} className={`text-zinc-300 transition-transform duration-500 ${editExpanded ? 'rotate-180' : ''}`} />
                        </div>

                        <div className="px-8 pb-12 h-full overflow-y-auto custom-scrollbar">
                            <h3 className="text-2xl font-black italic uppercase text-zinc-900 mb-6">Modificar Ponto</h3>
                            <div className="space-y-5 mb-8">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Identificação</label>
                                    <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-3xl p-5 text-zinc-900 font-bold focus:border-blue-500 outline-none" placeholder="Nome..." />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Bairro</label>
                                    <input value={editNeighborhood} onChange={e => setEditNeighborhood(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-3xl p-5 text-zinc-900 focus:border-blue-500 outline-none" placeholder="Bairro..." />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Latitude GPS</label>
                                        <input value={editLat} onChange={e => setEditLat(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-3xl p-5 text-zinc-900 text-xs font-mono" placeholder="-20.000..." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Longitude GPS</label>
                                        <input value={editLng} onChange={e => setEditLng(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-3xl p-5 text-zinc-900 text-xs font-mono" placeholder="-44.000..." />
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if ('geolocation' in navigator) {
                                            navigator.geolocation.getCurrentPosition(pos => {
                                                setEditLat(String(pos.coords.latitude));
                                                setEditLng(String(pos.coords.longitude));
                                            });
                                        }
                                    }}
                                    className="w-full bg-blue-50 text-blue-600 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-blue-100 active:scale-95 transition-all shadow-sm shadow-blue-500/10"
                                >
                                    <LocateFixed size={14} /> Sincronizar GPS Atual
                                </button>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Observações Adicionais</label>
                                    <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-3xl p-5 text-zinc-900 h-28 text-sm outline-none focus:border-blue-500" placeholder="Informações extras..." />
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <button onClick={handleSavePointEdit} className="w-full bg-blue-600 py-6 rounded-[2.5rem] font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/20 active:scale-95 transition-all">Salvar Alterações</button>
                                <button onClick={() => { setEditingPoint(null); setEditExpanded(false); }} className="w-full py-4 text-zinc-400 font-extrabold uppercase text-[10px] tracking-[0.3em]">Cancelar Operação</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ROUTE CONFIRMATION (Standardized Bottom Sheet) */}
            {showRouteConfirmation && (
                <div className="absolute inset-0 z-[100] flex flex-col justify-end bg-black/20 backdrop-blur-sm pointer-events-none">
                    <div className={`bg-white border-t-2 border-zinc-100 rounded-t-[3.5rem] pointer-events-auto shadow-2xl transition-all duration-500 ${manifestExpanded ? 'h-[85vh]' : 'h-[550px]'}`}>
                        <div onClick={() => setManifestExpanded(!manifestExpanded)} className="py-4 flex flex-col items-center gap-1 cursor-pointer">
                            <div className="w-12 h-1.5 bg-zinc-200 rounded-full" />
                            <ChevronUp size={20} className={`text-zinc-300 transition-transform duration-500 ${manifestExpanded ? 'rotate-180' : ''}`} />
                        </div>

                        <div className="px-8 pb-12 flex flex-col h-full overflow-hidden">
                            <h2 className="text-2xl font-black italic text-zinc-900 uppercase mb-8">Manifesto de Rota</h2>
                            <div className="flex-1 overflow-y-auto space-y-3 mb-8 custom-scrollbar bg-zinc-50/50 p-2 rounded-[2.5rem]">
                                {routePoints.filter(p => !p.isDelivered && p.id !== 'current').map((p, idx) => (
                                    <div key={p.id} className="bg-white border border-zinc-100 p-5 rounded-3xl flex items-center gap-4 group/item relative shadow-sm">
                                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black italic shrink-0">#{idx + 1}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-zinc-900 font-black uppercase text-[11px] truncate">{p.name}</p>
                                            <p className="text-zinc-500 text-[9px] uppercase tracking-widest truncate">{p.neighborhood}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {(!p.lat || !p.lng) && <div className="text-[7px] bg-red-50 text-red-600 px-2 py-1 rounded-full font-black uppercase whitespace-nowrap">Sem GPS</div>}
                                            <button onClick={() => openEditPanel(p)} className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-zinc-400 hover:text-blue-500 transition-all shadow-sm active:scale-90">
                                                <Pencil size={14} />
                                            </button>
                                            <button onClick={() => handleDeletePoint(p.id)} className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-zinc-400 hover:text-red-500 transition-all shadow-sm active:scale-90">
                                                <Trash size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col gap-3">
                                <button onClick={() => { setShowRouteConfirmation(false); setIsNavigating(true); setNavigationIndex(0); setManifestExpanded(false); }} className="w-full bg-blue-600 py-6 rounded-[2.5rem] font-black uppercase tracking-widest text-white shadow-2xl shadow-blue-500/30 active:scale-95 transition-all">Iniciar Jornada</button>
                                <button onClick={() => { setShowRouteConfirmation(false); setManifestExpanded(false); }} className="w-full py-4 text-zinc-400 font-extrabold uppercase text-[10px] tracking-[0.3em]">Recolher Manifesto</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* NAV DRAWER (Maps Style) */}
            {isNavigating && (() => {
                const pending = routePoints.filter(p => p.id !== 'current' && !p.isDelivered);
                const currentStop = pending[navigationIndex];
                if (!currentStop) return null;
                return (
                    <div className="absolute inset-x-0 bottom-0 z-50 pointer-events-none">
                        {/* Undo Notification Popup */}
                        {lastActionPointId && (
                            <div className="absolute -top-20 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-full flex items-center gap-4 shadow-2xl animate-in slide-in-from-bottom-5 duration-300 pointer-events-auto">
                                <span className="text-white font-black uppercase text-[10px] tracking-widest">Ação registrada!</span>
                                <button onClick={handleUndoAction} className="flex items-center gap-2 text-blue-400 font-black uppercase text-[10px] hover:text-white transition-colors border-l border-white/10 pl-4">
                                    <RotateCcw size={14} /> Desfazer
                                </button>
                            </div>
                        )}

                        <div className={`w-full bg-white border-t-2 border-zinc-100 rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.1)] transition-all duration-500 pointer-events-auto ${sheetExpanded ? 'h-[70vh]' : 'h-[300px]'}`}>
                            <div className="w-full flex flex-col h-full">
                                {/* Drag Handle */}
                                <div onClick={() => setSheetExpanded(!sheetExpanded)} className="py-4 flex flex-col items-center gap-1 cursor-pointer">
                                    <div className="w-12 h-1.5 bg-zinc-100 rounded-full" />
                                    <ChevronUp size={20} className={`text-zinc-300 transition-transform duration-500 ${sheetExpanded ? 'rotate-180' : ''}`} />
                                </div>

                                <div className="px-8 pb-10 flex-1 overflow-y-auto">
                                    {/* Stop ID & Address HUD */}
                                    <div className="flex items-start justify-between mb-8">
                                        <div className="flex items-center gap-5">
                                            <div className="w-16 h-16 rounded-[1.5rem] bg-blue-600 flex flex-col items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                                                <span className="text-[10px] font-black text-blue-200">#</span>
                                                <span className="text-2xl font-black text-white">{navigationIndex + 1}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">{currentStop.neighborhood || 'SETOR PENDENTE'}</p>
                                                <h3 className="text-2xl font-black italic uppercase text-zinc-900 leading-tight truncate pr-4">{currentStop.name}</h3>
                                            </div>
                                        </div>
                                        <button onClick={() => setIsNavigating(false)} className="p-3 bg-zinc-50 rounded-full text-zinc-300 hover:text-red-500 transition-all">
                                            <X size={20} />
                                        </button>
                                    </div>

                                    {/* Action Grid */}
                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        <button
                                            onClick={() => handleCompleteStop(true)}
                                            className="h-20 bg-emerald-500 rounded-3xl flex flex-col items-center justify-center gap-1 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                                        >
                                            <PackageCheck size={28} />
                                            <span className="text-[10px] font-black uppercase">Entregue</span>
                                        </button>
                                        <button
                                            onClick={() => handleCompleteStop(false)}
                                            className="h-20 bg-zinc-900 rounded-3xl flex flex-col items-center justify-center gap-1 text-white shadow-lg shadow-zinc-900/20 active:scale-95 transition-all"
                                        >
                                            <PackageX size={28} />
                                            <span className="text-[10px] font-black uppercase">Não Entregue</span>
                                        </button>
                                    </div>

                                    {/* Map Link / Navigation Button */}
                                    <button
                                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${currentStop.lat},${currentStop.lng}`, '_blank')}
                                        className="w-full bg-blue-50 border border-blue-100 py-6 rounded-3xl flex items-center justify-center gap-4 text-blue-600 hover:bg-blue-100 transition-all font-black uppercase tracking-widest text-xs"
                                    >
                                        <Navigation size={20} fill="currentColor" /> Abrir no Google Maps
                                    </button>

                                    {sheetExpanded && (
                                        <div className="mt-10 animate-in fade-in slide-in-from-top-4 duration-500">
                                            <h4 className="text-[10px] font-black uppercase text-zinc-400 mb-4 tracking-widest">Informações Adicionais</h4>
                                            <div className="bg-zinc-50 rounded-3xl p-6 space-y-4">
                                                <div>
                                                    <p className="text-[9px] font-black text-zinc-400 uppercase">Cidade</p>
                                                    <p className="text-zinc-900 font-bold">{currentStop.city || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-zinc-400 uppercase">Notas do Operador</p>
                                                    <p className="text-zinc-600 text-sm leading-relaxed">{currentStop.notes || 'Sem observações para este local.'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* CHECK ANIMATION */}
            {showCheckAnimation && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
                    <div className="bg-emerald-500 w-32 h-32 rounded-full flex items-center justify-center animate-ping text-white">
                        <CheckCircle2 size={64} />
                    </div>
                </div>
            )}

            {/* CELEBRATION OVERLAY */}
            {showCelebration && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none bg-blue-600/20 backdrop-blur-sm animate-in fade-in duration-500">
                    <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl text-center scale-up-center">
                        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 size={48} className="text-emerald-500" />
                        </div>
                        <h2 className="text-3xl font-black italic uppercase text-zinc-900 mb-2">Rota Concluída!</h2>
                        <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Excelente trabalho hoje.</p>
                    </div>
                </div>
            )}
        </div>
    );
};
