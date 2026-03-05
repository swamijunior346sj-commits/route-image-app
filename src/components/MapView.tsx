import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getActiveRoute, updateActiveRoute, updateRecord, saveRecord, clearActiveRoute } from '../services/db';
import type { RoutePoint } from '../services/db';
import L from 'leaflet';
import { MapPin, Navigation, Trash2, LocateFixed, Route, Loader2, Search, X, Plus, Save } from 'lucide-react';

// Fix leaflet icon
const customIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

export const MapView = () => {
    const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
    const [osrmPath, setOsrmPath] = useState<[number, number][]>([]);
    const [isRouting, setIsRouting] = useState(false);

    // Marker Editing
    const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
    const [editingMarkerName, setEditingMarkerName] = useState('');

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
    const autocompleteTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Silently try to get location on mount for better search suggestions
    useEffect(() => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.log('Silently failed to get location for search bias:', err),
                { enableHighAccuracy: false, timeout: 5000 }
            );
        }
    }, []);

    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.length < 3) {
            setSearchResults([]);
            return;
        }

        if (autocompleteTimerRef.current) {
            clearTimeout(autocompleteTimerRef.current);
        }

        autocompleteTimerRef.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`;
                if (userLocation) {
                    url += `&lat=${userLocation.lat}&lon=${userLocation.lng}`;
                }
                const res = await fetch(url);
                const data = await res.json();
                setSearchResults(data);
            } catch (err) {
                console.error(err);
            } finally {
                setIsSearching(false);
            }
        }, 700); // 700ms debounce for typing

        return () => {
            if (autocompleteTimerRef.current) clearTimeout(autocompleteTimerRef.current);
        };
    }, [searchQuery]);

    const loadRoute = async () => {
        const points = await getActiveRoute();
        setRoutePoints(points);
        setOsrmPath([]);

        // If the map is empty, try to auto-center on the user's current GPS location implicitly
        if (points.length === 0) {
            handleLocateMe(true);
        }
    };

    useEffect(() => {
        loadRoute();
    }, []);

    const handleClear = async () => {
        await clearActiveRoute();
        setRoutePoints([]);
        setOsrmPath([]);
    };

    const handleLocateMe = (silent = false) => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;

                    setRoutePoints(prev => {
                        // Remove previous "current" marker if it exists
                        const filtered = prev.filter(p => p.id !== 'current');
                        return [...filtered, { id: 'current', name: 'Você está aqui', lat, lng, scannedAt: Date.now() }];
                    });
                },
                (err) => {
                    console.error('Localização automática falhou:', err);
                    if (!silent) {
                        alert('Não foi possível obter sua localização. Verifique as permissões de GPS.');
                    }
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        } else {
            if (!silent) alert('Geolocalização não suportada no seu navegador.');
        }
    };

    const handleMarkerDragEnd = async (index: number, e: unknown) => {
        const marker = (e as L.DragEndEvent).target as L.Marker;
        const position = marker.getLatLng();
        const pointToUpdate = routePoints[index];

        // Exclude the volatile "current" location from updating DB
        if (pointToUpdate.id === 'current') return;

        // Visual instant state update
        const updatedPoints = [...routePoints];
        updatedPoints[index] = { ...pointToUpdate, lat: position.lat, lng: position.lng };
        setRoutePoints(updatedPoints);

        // Update active route session
        await updateActiveRoute(updatedPoints.filter(p => p.id !== 'current'));
        // Permanently update location DB based on precise repositioning
        await updateRecord(pointToUpdate.id, { lat: position.lat, lng: position.lng });
        setOsrmPath([]); // invalidate the osrm drawn line if you drag!
    };

    const handleSaveMarkerEdit = async (id: string) => {
        if (!editingMarkerName.trim()) return;

        // Update local list
        const updatedPoints = routePoints.map(p =>
            p.id === id ? { ...p, name: editingMarkerName.trim() } : p
        );
        setRoutePoints(updatedPoints);

        // Update active route session
        await updateActiveRoute(updatedPoints.filter(p => p.id !== 'current'));

        // Permanently update location DB
        await updateRecord(id, { name: editingMarkerName.trim() });

        setEditingMarkerId(null);
    };

    const handleRoteirizar = async () => {
        const validPoints = routePoints.filter(p => p.lat !== null && p.lng !== null);
        if (validPoints.length < 2) {
            alert("É necessário ter pelo menos 2 locais registrados na rota atual para roteirizar.");
            return;
        }

        setIsRouting(true);
        try {
            // Nearest Neighbor TSP Simple Sort
            const unvisited = [...validPoints];
            const sorted = [];
            let current = unvisited.shift()!;
            sorted.push(current);

            while (unvisited.length > 0) {
                let nearestIdx = 0;
                let minDist = Infinity;
                for (let i = 0; i < unvisited.length; i++) {
                    const el = unvisited[i];
                    // Euclidean dist is sufficient for localized points
                    const dist = Math.pow(el.lat! - current.lat!, 2) + Math.pow(el.lng! - current.lng!, 2);
                    if (dist < minDist) {
                        minDist = dist;
                        nearestIdx = i;
                    }
                }
                current = unvisited.splice(nearestIdx, 1)[0];
                sorted.push(current);
            }

            setRoutePoints(sorted); // Updates the pins instantly
            await updateActiveRoute(sorted.filter(p => p.id !== 'current'));

            // Fetch real road geometries from OSRM
            const coordsString = sorted.map(p => `${p.lng},${p.lat}`).join(';');
            const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.code === 'Ok' && data.routes && data.routes[0]) {
                const geojsonCoords = data.routes[0].geometry.coordinates;
                const leafletCoords: [number, number][] = geojsonCoords.map((c: number[]) => [c[1], c[0]]);
                setOsrmPath(leafletCoords);
            } else {
                alert("Não foi possível traçar ruas entre estes pontos. Talvez estejam muito distantes ou no oceano.");
            }
        } catch (err) {
            console.error(err);
            alert("Erro ao buscar o trajeto de ruas. Verifique a internet e tente novamente.");
        } finally {
            setIsRouting(false);
        }
    };

    const handleAddSearchToMap = async (result: any) => {
        const newPoint: RoutePoint = {
            id: crypto.randomUUID(),
            name: result.display_name.split(',')[0],
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            scannedAt: Date.now()
        };
        const updated = [...routePoints, newPoint];
        setRoutePoints(updated);
        await updateActiveRoute(updated.filter(p => p.id !== 'current'));
        setSearchResults([]);
        setSearchQuery('');
    };

    const handleSaveSearchToCatalog = async (result: any) => {
        await saveRecord(
            result.display_name.split(',')[0],
            parseFloat(result.lat),
            parseFloat(result.lon),
            '', // mock photo
            [] // mock features
        );
        alert('Endereço salvo no catálogo de Registros com sucesso!');
        setSearchResults([]);
        setSearchQuery('');
    };

    const center: [number, number] = routePoints.length > 0 && routePoints[routePoints.length - 1].lat !== null && routePoints[routePoints.length - 1].lng !== null
        ? [routePoints[routePoints.length - 1].lat as number, routePoints[routePoints.length - 1].lng as number]
        : [-23.55052, -46.633309]; // default center (São Paulo)

    const positions = routePoints
        .filter(p => p.lat !== null && p.lng !== null)
        .map(p => [p.lat, p.lng] as [number, number]);

    return (
        <div className="relative w-full h-full flex flex-col pt-safe bg-black">
            <div className="absolute top-0 z-[1000] w-full p-4 glass-panel border-b-0 animate-fade-in flex flex-col gap-2 pointer-events-none">
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">Mapa de Rotas</h1>
                <p className="text-sm text-zinc-300 font-medium">Visualização da rota escaneada</p>

                <form onSubmit={(e) => e.preventDefault()} className="relative mt-2 pointer-events-auto flex items-center">
                    <input
                        type="text"
                        placeholder="Buscar endereço no mundo..."
                        className="w-full bg-zinc-900/90 backdrop-blur-md border border-white/20 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:border-blue-500/50 focus:outline-none placeholder:text-zinc-500 shadow-xl"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button type="submit" disabled={isSearching} className="absolute right-2 p-1.5 text-blue-400 hover:text-blue-300 bg-white/5 rounded-lg transition-colors">
                        {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                    </button>
                </form>

                {searchResults.length > 0 && (
                    <div className="mt-2 bg-zinc-900/95 backdrop-blur-xl border border-white/20 rounded-2xl max-h-60 overflow-y-auto pointer-events-auto shadow-2xl flex flex-col p-2 gap-1 animate-slide-up relative">
                        <div className="sticky top-0 bg-zinc-900/95 py-1 px-2 mb-2 flex justify-between items-center z-10 border-b border-white/10 pb-2">
                            <span className="text-xs text-zinc-400 font-bold">Sugestões de Endereços ({searchResults.length})</span>
                            <button type="button" onClick={() => setSearchResults([])} className="text-zinc-400 hover:text-white p-1 bg-white/5 rounded-lg"><X size={14} /></button>
                        </div>
                        {searchResults.map((res: any, i: number) => (
                            <div key={i} className="flex flex-col gap-2 p-3 hover:bg-white/5 rounded-xl transition-colors border-b border-white/5 last:border-0">
                                <span className="text-sm font-medium text-zinc-200 line-clamp-2 leading-tight">{res.display_name}</span>
                                <div className="flex gap-2 justify-end mt-1">
                                    <button
                                        type="button"
                                        onClick={() => handleAddSearchToMap(res)}
                                        className="text-[10px] flex items-center gap-1 bg-blue-500/20 text-blue-400 px-3 py-2 rounded-lg font-bold hover:bg-blue-500/30 transition-colors"
                                    >
                                        <Plus size={14} /> NA ROTA
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSaveSearchToCatalog(res)}
                                        className="text-[10px] flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-3 py-2 rounded-lg font-bold hover:bg-emerald-500/30 transition-colors"
                                    >
                                        <Save size={14} /> SALVAR CATALOGO
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-1 w-full relative z-0">
                <MapContainer
                    center={center}
                    zoom={13}
                    className="w-full h-full"
                    zoomControl={false}
                >
                    {/* CartoDB Dark Matter base map */}
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; CARTO'
                    />

                    {osrmPath.length > 0 ? (
                        <Polyline positions={osrmPath} color="#a855f7" weight={5} opacity={0.9} />
                    ) : positions.length > 1 ? (
                        <Polyline positions={positions} color="#3b82f6" weight={4} opacity={0.5} dashArray="10, 10" />
                    ) : null}

                    {routePoints.map((point, index) => {
                        if (point.lat === null || point.lng === null) return null;
                        return (
                            <Marker
                                key={`${point.id}-${index}`}
                                position={[point.lat, point.lng]}
                                icon={customIcon}
                                draggable={point.id !== 'current'}
                                eventHandlers={{
                                    dragend: (e) => handleMarkerDragEnd(index, e)
                                }}
                            >
                                <Popup className="glass-popup" eventHandlers={{ remove: () => setEditingMarkerId(null) }}>
                                    {editingMarkerId === point.id ? (
                                        <div className="flex flex-col gap-2 min-w-[150px] p-1">
                                            <input
                                                value={editingMarkerName}
                                                onChange={e => setEditingMarkerName(e.target.value)}
                                                className="w-full bg-zinc-100 border border-zinc-300 rounded p-1.5 text-sm text-black focus:outline-blue-500"
                                                autoFocus
                                                placeholder="Nome do local"
                                            />
                                            <button
                                                onClick={() => handleSaveMarkerEdit(point.id)}
                                                className="bg-blue-600 text-white px-2 py-1.5 rounded text-xs font-bold w-full hover:bg-blue-700 transition"
                                            >
                                                Salvar
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col">
                                            <div className="font-bold text-black border-b border-gray-200 pb-1 mb-1">{point.name}</div>
                                            <div className="text-xs text-gray-700">⌚ Scan: {new Date(point.scannedAt).toLocaleTimeString()}</div>
                                            <div className="text-xs text-gray-700 font-mono mt-0.5">📍 Lat: {point.lat.toFixed(5)}<br />📍 Lng: {point.lng.toFixed(5)}</div>

                                            {point.id !== 'current' && (
                                                <div className="flex flex-col mt-2 gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingMarkerId(point.id);
                                                            setEditingMarkerName(point.name);
                                                        }}
                                                        className="bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1.5 rounded text-xs font-bold hover:bg-blue-200 transition"
                                                    >
                                                        ✏️ Editar Nome
                                                    </button>
                                                    <div className="text-[10px] text-gray-500 italic pointer-events-none leading-tight border-t border-gray-200 pt-1.5 mt-0.5">
                                                        *(Arraste e solte o pino no mapa para ajustar a localização exata no banco de dados)*
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </Popup>
                            </Marker>
                        );
                    })}
                </MapContainer>
            </div>

            <div className="absolute top-24 right-4 z-[9999] flex flex-col gap-2">
                <button
                    onClick={handleRoteirizar}
                    disabled={isRouting}
                    className="bg-purple-600/90 backdrop-blur-md p-3 rounded-xl border border-white/20 text-white hover:bg-purple-500 transition shadow-[0_0_15px_rgba(168,85,247,0.5)] disabled:opacity-50"
                    title="Roteirizar Trajeto Real"
                >
                    {isRouting ? <Loader2 size={20} className="animate-spin" /> : <Route size={20} />}
                </button>
                <div className="h-px bg-white/10 w-full my-1"></div>
                <button
                    onClick={loadRoute}
                    className="bg-zinc-800/80 backdrop-blur-md p-3 rounded-xl border border-white/10 text-white hover:bg-zinc-700 transition"
                    title="Centralizar Câmera"
                >
                    <Navigation size={20} />
                </button>
                <button
                    onClick={() => handleLocateMe(false)}
                    className="bg-blue-600/80 backdrop-blur-md p-3 rounded-xl border border-white/10 text-white hover:bg-blue-500 transition"
                    title="Minha Localização Atual"
                >
                    <LocateFixed size={20} />
                </button>
                <button
                    onClick={handleClear}
                    className="bg-red-500/80 backdrop-blur-md p-3 rounded-xl border border-white/10 text-white hover:bg-red-400 transition"
                    title="Limpar Rota"
                >
                    <Trash2 size={20} />
                </button>
            </div>

            {routePoints.length === 0 && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                    <div className="glass-panel px-6 py-4 rounded-2xl flex items-center gap-3">
                        <MapPin className="text-zinc-400" />
                        <span className="text-zinc-300 font-medium">Nenhum ponto registrado na rota atual</span>
                    </div>
                </div>
            )}
        </div>
    );
};
