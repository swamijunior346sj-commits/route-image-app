import { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Circle } from '@react-google-maps/api';
import { getActiveRoute, updateActiveRoute, clearActiveRoute } from '../services/db';
import type { RoutePoint } from '../services/db';
import { Navigation, Trash2, LocateFixed, Route, Loader2, Search, X, CheckCircle2, Plus, MapPin, Pencil, Trash } from 'lucide-react';
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
    const [showRouteConfirmation, setShowRouteConfirmation] = useState(false);
    const [showCheckAnimation, setShowCheckAnimation] = useState(false);

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

    const handleCompleteStop = async () => {
        const dests = routePoints.filter(p => p.id !== 'current' && !p.isDelivered);
        const point = dests[navigationIndex];
        if (!point) return;

        setShowCheckAnimation(true);
        setTimeout(async () => {
            setShowCheckAnimation(false);
            const updated = routePoints.map(p => p.id === point.id ? { ...p, isDelivered: true } : p);
            await updateActiveRoute(updated);
            setRoutePoints(updated);

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
        }, 1200);
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

    if (!isLoaded) return <div className="w-full h-full bg-white flex items-center justify-center font-black">CARREGANDO MAPA...</div>;

    return (
        <div className="relative w-full h-full bg-white overflow-hidden">
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
                    styles: [] // Light theme default
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

            {/* EDIT PANEL */}
            {editingPoint && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-2xl font-black italic uppercase text-zinc-900 mb-6">Modificar Ponto</h3>
                        <div className="space-y-4 mb-8">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Identificação</label>
                                <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-zinc-900 font-bold" placeholder="Nome..." />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Bairro</label>
                                <input value={editNeighborhood} onChange={e => setEditNeighborhood(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-zinc-900" placeholder="Bairro..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Latitude GPS</label>
                                    <input value={editLat} onChange={e => setEditLat(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-zinc-900 text-xs font-mono" placeholder="-20.000..." />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Longitude GPS</label>
                                    <input value={editLng} onChange={e => setEditLng(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-zinc-900 text-xs font-mono" placeholder="-44.000..." />
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
                                className="w-full bg-blue-50 text-blue-600 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-100 transition-all"
                            >
                                <LocateFixed size={14} /> Usar Minha Localização Atual
                            </button>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Observações</label>
                                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-zinc-900 h-24 text-sm" placeholder="Notas..." />
                            </div>
                        </div>
                        <button onClick={handleSavePointEdit} className="w-full bg-blue-600 py-4 rounded-3xl font-black uppercase text-white shadow-lg">Salvar Alterações</button>
                        <button onClick={() => setEditingPoint(null)} className="w-full mt-4 text-zinc-400 font-black uppercase text-xs">Cancelar</button>
                    </div>
                </div>
            )}

            {/* ROUTE CONFIRMATION */}
            {showRouteConfirmation && (
                <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/20 backdrop-blur-sm pointer-events-none">
                    <div className="bg-white border-t-2 border-zinc-100 p-8 pb-12 rounded-t-[3.5rem] pointer-events-auto shadow-2xl animate-slide-up">
                        <div className="w-12 h-1.5 bg-zinc-200 rounded-full mx-auto mb-10" />
                        <h2 className="text-2xl font-black italic text-zinc-900 uppercase mb-8">Manifesto de Rota</h2>
                        <div className="max-h-[50vh] overflow-y-auto space-y-3 mb-10">
                            {routePoints.filter(p => !p.isDelivered && p.id !== 'current').map((p, idx) => (
                                <div key={p.id} className="bg-zinc-50 border border-zinc-100 p-5 rounded-3xl flex items-center gap-4 group/item relative">
                                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black italic shrink-0">#{idx + 1}</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-zinc-900 font-black uppercase text-xs truncate">{p.name}</p>
                                        <p className="text-zinc-500 text-[10px] uppercase truncate">{p.neighborhood}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(!p.lat || !p.lng) && <div className="text-[7px] bg-red-100 text-red-600 px-2 py-1 rounded-full font-black uppercase whitespace-nowrap">Sem GPS</div>}
                                        <button onClick={() => openEditPanel(p)} className="p-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-400 hover:text-blue-500 transition-all shadow-sm">
                                            <Pencil size={14} />
                                        </button>
                                        <button onClick={() => handleDeletePoint(p.id)} className="p-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-400 hover:text-red-500 transition-all shadow-sm">
                                            <Trash size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => { setShowRouteConfirmation(false); setIsNavigating(true); setNavigationIndex(0); }} className="w-full bg-blue-600 py-6 rounded-3xl font-black uppercase text-white shadow-xl">Iniciar Rota</button>
                    </div>
                </div>
            )}

            {/* NAV SHEET */}
            {isNavigating && (() => {
                const pending = routePoints.filter(p => p.id !== 'current' && !p.isDelivered);
                const currentStop = pending[navigationIndex];
                if (!currentStop) return null;
                return (
                    <div className="absolute bottom-10 left-0 right-0 z-[30] px-6">
                        <div className="bg-white border-2 border-zinc-100 rounded-[2.5rem] p-6 shadow-2xl">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 rounded-2xl bg-blue-600 flex flex-col items-center justify-center shrink-0">
                                    <span className="text-[10px] font-black text-blue-200">PARADA</span>
                                    <span className="text-xl font-black text-white">{navigationIndex + 1}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{currentStop.neighborhood || 'PENDENTE'}</p>
                                    <h3 className="text-lg font-black italic uppercase text-zinc-900 truncate">{currentStop.name}</h3>
                                </div>
                                <button onClick={() => setIsNavigating(false)} className="text-zinc-300"><X /></button>
                            </div>
                            <button onClick={handleCompleteStop} className="w-full bg-emerald-500 py-5 rounded-3xl font-black uppercase text-white shadow-emerald-500/20 shadow-xl flex items-center justify-center gap-3">
                                <CheckCircle2 size={20} /> Concluir Entrega
                            </button>
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
