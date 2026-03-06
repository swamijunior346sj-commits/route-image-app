import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getActiveRoute, updateActiveRoute, clearActiveRoute } from '../services/db';
import type { RoutePoint } from '../services/db';
import { Navigation, Trash2, LocateFixed, Search, X, CheckCircle2, Plus, MapPin, Pencil, Trash, RotateCcw, PackageCheck, PackageX, ChevronUp, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

// ── Custom Leaflet Icons ──
const createIcon = (color: string, size: number = 32) => L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    html: `<div style="
        position: relative;
        width:${size}px;height:${size}px;
        background:${color};
        border:2px solid white;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow: 2px 2px 10px rgba(0,0,0,0.4);
    ">
        <div style="
            position: absolute;
            top: 50%; left: 50%;
            width: ${size * 0.35}px; height: ${size * 0.35}px;
            background: white;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
        "></div>
    </div>`
});

const routeIcon = createIcon('#3b82f6');
const deliveredIcon = createIcon('#22c55e');
const currentIcon = L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<div style="
        width:22px;height:22px;
        background:#3b82f6;
        border:3px solid white;
        border-radius:50%;
        box-shadow: 0 0 15px rgba(59,130,246,0.9), inset 0 2px 5px rgba(0,0,0,0.3);
    "></div>`
});

// ── Map Controller (reacts to state changes) ──
const MapController = ({ center, zoom, routePoints }: { center: [number, number] | null, zoom: number | null, routePoints: RoutePoint[] }) => {
    const map = useMap();

    useEffect(() => {
        if (center && zoom) {
            map.setView(center, zoom);
        }
    }, [center, zoom, map]);

    useEffect(() => {
        const validPoints = routePoints.filter(p => p.lat !== null && p.lng !== null);
        if (validPoints.length > 1) {
            const bounds = L.latLngBounds(validPoints.map(p => [p.lat!, p.lng!]));
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [routePoints.length, map]);

    return null;
};

const defaultCenter: [number, number] = [-20.143196, -44.2174965];

export const MapView = () => {
    const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
    const [routeLine, setRouteLine] = useState<[number, number][]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
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
    const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
    const [mapZoom, setMapZoom] = useState<number | null>(null);

    // Marker edit panel
    const [editingPoint, setEditingPoint] = useState<RoutePoint | null>(null);
    const [editName, setEditName] = useState('');
    const [editNeighborhood, setEditNeighborhood] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editLat, setEditLat] = useState('');
    const [editLng, setEditLng] = useState('');

    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const sheetTouchStartY = useRef<number | null>(null);

    const handleSheetTouchStart = (e: React.TouchEvent) => {
        sheetTouchStartY.current = e.touches[0].clientY;
    };

    const handleEditSheetTouchMove = (e: React.TouchEvent) => {
        if (!sheetTouchStartY.current) return;
        const deltaY = e.touches[0].clientY - sheetTouchStartY.current;
        if (deltaY < -50) { setEditExpanded(true); sheetTouchStartY.current = null; }
        else if (deltaY > 50) { setEditExpanded(false); sheetTouchStartY.current = null; }
    };

    const handleManifestSheetTouchMove = (e: React.TouchEvent) => {
        if (!sheetTouchStartY.current) return;
        const deltaY = e.touches[0].clientY - sheetTouchStartY.current;
        if (deltaY < -50) { setManifestExpanded(true); sheetTouchStartY.current = null; }
        else if (deltaY > 50) { setManifestExpanded(false); sheetTouchStartY.current = null; }
    };

    const handleSheetTouchEnd = () => {
        sheetTouchStartY.current = null;
    };

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

    // Geocode points without coordinates using Nominatim
    const geocodedIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const pointsToGeocode = routePoints.filter(p =>
            (p.lat === null || p.lng === null || p.lat === 0 || p.lng === 0) &&
            p.name &&
            p.id !== 'current' &&
            !geocodedIdsRef.current.has(p.id)
        );

        if (pointsToGeocode.length === 0) return;

        // Mark as being processed to avoid duplicate requests
        pointsToGeocode.forEach(p => geocodedIdsRef.current.add(p.id));

        const geocodeSequentially = async () => {
            let updated = false;
            let currentPoints = [...routePoints];

            for (let i = 0; i < pointsToGeocode.length; i++) {
                const p = pointsToGeocode[i];
                const query = [p.name, p.neighborhood, p.city].filter(Boolean).join(', ');
                try {
                    // Add delay between requests to respect Nominatim rate limits (1 req/sec)
                    if (i > 0) await new Promise(r => setTimeout(r, 1100));

                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`);
                    const data = await res.json();
                    if (data && data.length > 0) {
                        const lat = parseFloat(data[0].lat);
                        const lng = parseFloat(data[0].lon);
                        currentPoints = currentPoints.map(item =>
                            item.id === p.id ? { ...item, lat, lng } : item
                        );
                        updated = true;
                    }
                } catch (err) {
                    console.warn('Geocoding failed for', query, err);
                    // Remove from set so it can be retried
                    geocodedIdsRef.current.delete(p.id);
                }
            }

            if (updated) {
                setRoutePoints(currentPoints);
                // Persist geocoded coordinates to DB
                try {
                    await updateActiveRoute(currentPoints.filter(p => p.id !== 'current'));
                } catch (err) {
                    console.warn('Failed to persist geocoded coordinates:', err);
                }
            }
        };

        geocodeSequentially();
    }, [routePoints]);


    const handleLocateMe = (silent = false) => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setUserLocation(coords);
                    setAccuracy(pos.coords.accuracy);
                    setMapCenter([coords.lat, coords.lng]);
                    setMapZoom(17);

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
            setRouteLine([]);
        }
    };


    const handleCompleteStop = async (delivered: boolean) => {
        const dests = routePoints.filter(p => p.id !== 'current' && !p.isDelivered);
        const point = dests[navigationIndex];
        if (!point) return;

        if (undoTimeout) clearTimeout(undoTimeout);
        setLastActionPointId(point.id);

        setShowCheckAnimation(true);
        setTimeout(() => setShowCheckAnimation(false), 800);

        const updated = routePoints.map(p => p.id === point.id ? { ...p, isDelivered: delivered } : p);
        setRoutePoints(updated);

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

            if (lastActionPointId) {
                setRoutePoints(prev => prev.map(p => p.id === lastActionPointId ? { ...p, isDelivered: false } : p));
            }
            setLastActionPointId(null);
        }
    };

    // Search using Nominatim
    useEffect(() => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (searchQuery.trim().length > 2) {
            searchTimeoutRef.current = setTimeout(async () => {
                setIsSearching(true);
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`);
                    const data = await res.json();
                    setSearchResults(data || []);
                } catch {
                    setSearchResults([]);
                } finally {
                    setIsSearching(false);
                }
            }, 500);
        } else {
            setSearchResults([]);
        }

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchQuery]);

    const selectSearchResult = async (result: any) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        const addr = result.address || {};
        const newPoint: RoutePoint = {
            id: Date.now().toString(),
            name: result.display_name?.split(',')[0] || result.name || 'Endereço',
            lat,
            lng,
            scannedAt: Date.now(),
            neighborhood: addr.suburb || addr.neighbourhood || '',
            city: addr.city || addr.town || addr.village || '',
        };
        const updated = [...routePoints.filter(p => p.id !== 'current'), newPoint];
        await updateActiveRoute(updated);
        setRoutePoints([...updated, ...(userLocation ? [{ id: 'current', name: 'Você está aqui', ...userLocation, scannedAt: Date.now() }] : [])]);
        setSearchQuery('');
        setSearchResults([]);
        setMapCenter([lat, lng]);
        setMapZoom(15);
    };

    const initialCenter: [number, number] = userLocation ? [userLocation.lat, userLocation.lng] : defaultCenter;

    return (
        <div className="relative w-full h-full bg-black overflow-hidden">
            {/* SEARCH HUD */}
            <div className={`absolute top-10 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-lg px-6 transition-all duration-700 ${isNavigating ? '-translate-y-32' : ''}`}>
                <div className="relative group">
                    <form onSubmit={e => e.preventDefault()} className="relative bg-white border-2 border-zinc-200 rounded-[2rem] p-4 flex items-center gap-4 shadow-[0_20px_40px_rgba(0,0,0,0.1)] focus-within:border-blue-500">
                        <Search size={20} className="text-zinc-400 ml-2" />
                        <input
                            placeholder="Pesquisar endereço..."
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
                        {searchResults.map((res: any) => (
                            <div key={res.place_id} className="flex gap-2">
                                <button
                                    onClick={() => selectSearchResult(res)}
                                    className="flex-1 flex items-center gap-4 p-5 hover:bg-zinc-50 rounded-[1.8rem] transition-all text-left"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
                                        <MapPin size={18} className="text-zinc-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12px] font-black text-zinc-900 truncate">{res.display_name?.split(',')[0]}</p>
                                        <p className="text-[9px] text-zinc-500 truncate">{res.display_name?.split(',').slice(1).join(',')}</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => selectSearchResult(res)}
                                    className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90"
                                >
                                    <Plus size={24} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* LEAFLET MAP */}
            <MapContainer
                center={initialCenter}
                zoom={14}
                style={{ width: '100%', height: '100%' }}
                zoomControl={false}
                attributionControl={false}
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                <MapController center={mapCenter} zoom={mapZoom} routePoints={routePoints} />

                {routePoints.map((p, i) => (
                    p.lat !== null && p.lng !== null && (
                        <Marker
                            key={`${p.id}-${i}`}
                            position={[p.lat, p.lng]}
                            icon={p.id === 'current' ? currentIcon : p.isDelivered ? deliveredIcon : routeIcon}
                            eventHandlers={{ click: () => openEditPanel(p) }}
                        >
                            <Popup>
                                <div className="text-xs font-bold">{p.name}</div>
                                {p.neighborhood && <div className="text-[10px] text-gray-500">{p.neighborhood}</div>}
                            </Popup>
                        </Marker>
                    )
                ))}

                {userLocation && accuracy && (
                    <Circle
                        center={[userLocation.lat, userLocation.lng]}
                        radius={accuracy}
                        pathOptions={{
                            fillColor: '#3b82f6',
                            fillOpacity: 0.1,
                            color: '#3b82f6',
                            weight: 1,
                            opacity: 0.3
                        }}
                    />
                )}

                {routeLine.length > 0 && (
                    <Polyline
                        positions={routeLine}
                        pathOptions={{
                            color: '#3b82f6',
                            weight: 5,
                            opacity: 0.8
                        }}
                    />
                )}
            </MapContainer>

            {/* Float Actions */}
            <div className="absolute top-40 right-6 z-[1000] flex flex-col gap-3">
                <button onClick={() => setIsNavigating(prev => !prev)} className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-white border border-zinc-200 shadow-xl transition-all ${isNavigating ? 'text-blue-600' : 'text-zinc-500'}`}>
                    <Navigation size={24} />
                </button>
                <button onClick={() => handleLocateMe()} className="w-14 h-14 bg-white border border-zinc-200 rounded-2xl text-emerald-600 flex items-center justify-center shadow-xl">
                    <LocateFixed size={24} />
                </button>
                {routePoints.filter(p => p.id !== 'current').length > 0 && (
                    <button onClick={handleClear} className="w-14 h-14 bg-white border border-zinc-200 rounded-2xl text-red-400 flex items-center justify-center shadow-xl">
                        <Trash2 size={24} />
                    </button>
                )}
            </div>

            {/* EDIT PANEL (Standardized Bottom Sheet) */}
            {editingPoint && (
                <div className="absolute inset-0 z-[1100] flex flex-col justify-end bg-black/40 backdrop-blur-sm pointer-events-none">
                    <div className={`w-full bg-white border-t-2 border-zinc-100 rounded-t-[3.5rem] shadow-2xl transition-all duration-500 pointer-events-auto ${editExpanded ? 'h-[85vh]' : 'h-[500px]'}`}>
                        <div
                            onClick={() => setEditExpanded(!editExpanded)}
                            onTouchStart={handleSheetTouchStart}
                            onTouchMove={handleEditSheetTouchMove}
                            onTouchEnd={handleSheetTouchEnd}
                            className="py-4 flex flex-col items-center gap-1 cursor-pointer"
                        >
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
                <div className="absolute inset-0 z-[1100] flex flex-col justify-end bg-black/20 backdrop-blur-sm pointer-events-none">
                    <div className={`bg-white border-t-2 border-zinc-100 rounded-t-[3.5rem] pointer-events-auto shadow-2xl transition-all duration-500 ${manifestExpanded ? 'h-[85vh]' : 'h-[550px]'}`}>
                        <div
                            onClick={() => setManifestExpanded(!manifestExpanded)}
                            onTouchStart={handleSheetTouchStart}
                            onTouchMove={handleManifestSheetTouchMove}
                            onTouchEnd={handleSheetTouchEnd}
                            className="py-4 flex flex-col items-center gap-1 cursor-pointer"
                        >
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

            {/* NAV DRAWER */}
            {isNavigating && (() => {
                const pending = routePoints.filter(p => p.id !== 'current' && !p.isDelivered);
                const currentStop = pending[navigationIndex];
                if (!currentStop) return null;
                return (
                    <div className="absolute inset-x-0 bottom-0 z-[1100] pointer-events-none">
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
                                <div onClick={() => setSheetExpanded(!sheetExpanded)} className="py-4 flex flex-col items-center gap-1 cursor-pointer">
                                    <div className="w-12 h-1.5 bg-zinc-100 rounded-full" />
                                    <ChevronUp size={20} className={`text-zinc-300 transition-transform duration-500 ${sheetExpanded ? 'rotate-180' : ''}`} />
                                </div>

                                <div className="px-8 pb-10 flex-1 overflow-y-auto">
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

                                    <button
                                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${currentStop.lat},${currentStop.lng}`, '_blank')}
                                        className="w-full bg-blue-50 border border-blue-100 py-6 rounded-3xl flex items-center justify-center gap-4 text-blue-600 hover:bg-blue-100 transition-all font-black uppercase tracking-widest text-xs"
                                    >
                                        <Navigation size={20} fill="currentColor" /> Abrir Navegação
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
                <div className="fixed inset-0 z-[2000] flex items-center justify-center pointer-events-none">
                    <div className="bg-emerald-500 w-32 h-32 rounded-full flex items-center justify-center animate-ping text-white">
                        <CheckCircle2 size={64} />
                    </div>
                </div>
            )}

            {/* CELEBRATION OVERLAY */}
            {showCelebration && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center pointer-events-none bg-blue-600/20 backdrop-blur-sm animate-in fade-in duration-500">
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
