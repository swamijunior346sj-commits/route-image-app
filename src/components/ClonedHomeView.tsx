import { useRef, useState, useEffect } from 'react';
import {
    GoogleMap,
    useJsApiLoader,
    OverlayView,
    Autocomplete,
    DirectionsRenderer
} from '@react-google-maps/api';
import { getActiveRoute, clearActiveRoute, addPointToActiveRoute, type RoutePoint } from '../services/db';
import { ActiveRouteView } from './ActiveRouteView';

const libraries: ("places" | "geometry")[] = ['places', 'geometry'];
const defaultCenter = { lat: -23.5505, lng: -46.6333 };
const mapContainerStyle = { width: '100%', height: '100dvh' };

const CLEAN_MAP_STYLE = [
    { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "featureType": "all", "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }, { "visibility": "off" }] },
    { "featureType": "all", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }, { "visibility": "off" }] },
    { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#f1f5f9" }] },
    { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#e2e8f0" }, { "visibility": "off" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#cbd5e1" }] },
    { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#e2e8f0" }] },
    { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#f8fafc" }, { "visibility": "off" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#3b82f6" }, { "lightness": 60 }] }
];

const SpokeMarker = ({ point, index, isCurrent }: { point: RoutePoint, index: number, isCurrent: boolean }) => (
    <OverlayView
        position={{ lat: point.lat!, lng: point.lng! }}
        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
        <div className="relative -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className={`size-8 rounded-lg flex items-center justify-center border-2 shadow-lg transition-all
                ${isCurrent ? 'bg-blue-500 border-blue-400' : (point.isDelivered ? 'bg-white border-gray-100' : 'bg-white border-blue-100')}`}>
                <span className={`text-[12px] font-black ${isCurrent ? 'text-white' : (point.isDelivered ? 'text-gray-300' : 'text-blue-500')}`}>
                    {index + 1}
                </span>
            </div>
            {isCurrent && (
                <div className="absolute -inset-2 bg-blue-500/20 rounded-xl animate-pulse -z-10"></div>
            )}
        </div>
    </OverlayView>
);

// Minimalist Map Markers Optimized for Precision

interface ClonedHomeViewProps {
    googleMapsApiKey: string;
    onOpenMenu: () => void;
    onAddStops: () => void;
    onImport: () => void;
    onNavigateToDailyRoute: () => void;
}

export const ClonedHomeView = ({ googleMapsApiKey, onOpenMenu, onAddStops, onImport, onNavigateToDailyRoute }: ClonedHomeViewProps) => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey,
        libraries
    });

    const [currentPos, setCurrentPos] = useState(defaultCenter);
    const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
    const [routeInfo, setRouteInfo] = useState({ distance: '...', duration: '...' });
    const [mapCenter, setMapCenter] = useState(defaultCenter);
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [dragY, setDragY] = useState(0);
    const [isRouteActive, setIsRouteActive] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    // Pin Mode State
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isPinMode, setIsPinMode] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [pinAddress, setPinAddress] = useState("");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [pinSubAddress, setPinSubAddress] = useState("");
    const [isPinDragging, setIsPinDragging] = useState(false);
    const geocoderRef = useRef<google.maps.Geocoder | null>(null);

    const startY = useRef(0);
    const lastY = useRef(0);
    const mapRef = useRef<google.maps.Map | null>(null);

    // Init Geocoder
    useEffect(() => {
        if (isLoaded && !geocoderRef.current) {
            geocoderRef.current = new google.maps.Geocoder();
        }
    }, [isLoaded]);

    const reverseGeocode = (lat: number, lng: number) => {
        if (geocoderRef.current) {
            geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
                if (status === 'OK' && results?.[0]) {
                    const fullAddress = results[0].formatted_address;
                    const parts = fullAddress.split(',');
                    setPinAddress(parts[0] || '');
                    setPinSubAddress(parts.slice(1, 4).join(',').trim() || '');
                }
            });
        }
    };

    const handleCenterChanged = () => {
        if (mapRef.current && isPinMode) {
            const newCenter = mapRef.current.getCenter();
            if (newCenter) {
                const lat = newCenter.lat();
                const lng = newCenter.lng();
                setMapCenter({ lat, lng });
                reverseGeocode(lat, lng);
            }
        }
    };

    useEffect(() => {
        const loadRoute = async () => {
            const data = await getActiveRoute();
            setRoutePoints(data);
        };
        loadRoute();
    }, []);

    useEffect(() => {
        if (routePoints.length > 1) {
            const origin = { lat: routePoints[0].lat!, lng: routePoints[0].lng! };
            const destination = { lat: routePoints[routePoints.length - 1].lat!, lng: routePoints[routePoints.length - 1].lng! };
            const waypoints = routePoints.slice(1, -1).map(p => ({
                location: { lat: p.lat!, lng: p.lng! },
                stopover: true
            }));

            const service = new google.maps.DirectionsService();
            service.route(
                {
                    origin,
                    destination,
                    waypoints,
                    travelMode: google.maps.TravelMode.DRIVING,
                    optimizeWaypoints: false
                },
                (result, status) => {
                    if (status === 'OK' && result) {
                        setDirections(result);
                        // Calculate total distance and duration
                        let totalDist = 0;
                        let totalTime = 0;
                        result.routes[0].legs.forEach(leg => {
                            totalDist += leg.distance?.value || 0;
                            totalTime += leg.duration?.value || 0;
                        });
                        setRouteInfo({
                            distance: (totalDist / 1000).toFixed(1) + ' km',
                            duration: Math.round(totalTime / 60) + ' min'
                        });
                    }
                }
            );
        } else {
            setDirections(null);
            setRouteInfo({ distance: '0 km', duration: '0 min' });
        }
    }, [routePoints]);

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            pos => {
                const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setCurrentPos(p);
                setMapCenter(p);
            },
            () => { },
            { enableHighAccuracy: true }
        );
    }, []);

    const onPlaceChanged = async () => {
        if (autocomplete) {
            const place = autocomplete.getPlace();
            if (place.geometry?.location) {
                const newPos = {
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng()
                };
                setMapCenter(newPos);

                const newPoint = {
                    id: Date.now().toString(),
                    name: place.name || place.formatted_address || "Endereço Buscado",
                    lat: newPos.lat,
                    lng: newPos.lng,
                    scannedAt: Date.now(),
                    isRecent: true
                };

                const updatedRoute = await addPointToActiveRoute(newPoint);
                setRoutePoints(updatedRoute);

                if (navigator.vibrate) navigator.vibrate(50);
                setIsExpanded(false);
            }
        }
    };

    const handleClearRoute = async () => {
        if (confirm("Deseja realmente limpar toda a rota atual?")) {
            await clearActiveRoute();
            setRoutePoints([]);
            setDirections(null);
            setRouteInfo({ distance: '...', duration: '...' });
            setIsMoreMenuOpen(false);
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        startY.current = e.touches[0].clientY;
        lastY.current = e.touches[0].clientY;
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const currentY = e.touches[0].clientY;
        const delta = currentY - startY.current;

        // Se estiver expandido, só permite arrastar para baixo
        if (isExpanded) {
            if (delta > 0) setDragY(delta);
        } else {
            // Se estiver recolhido, só permite arrastar para cima
            if (delta < 0) setDragY(delta);
        }
        lastY.current = currentY;
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        const threshold = 100;

        if (isExpanded) {
            if (dragY > threshold) setIsExpanded(false);
        } else {
            if (dragY < -threshold) setIsExpanded(true);
        }
        setDragY(0);
    };

    const activePointIndex = routePoints.findIndex(p => !p.isDelivered);

    if (!isLoaded) return (
        <div className="w-full h-screen bg-[#f8fafc] flex items-center justify-center">
            <div className="size-8 border-2 border-blue-100 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="w-full h-screen bg-[#f8fafc] text-gray-900 overflow-hidden flex flex-col font-sans relative">
            {/* 1. Interactive Map Backdrop */}
            <div className={`absolute inset-0 z-0 ${isExpanded ? 'blur-sm grayscale-[0.2] opacity-60' : 'opacity-100'}`}>
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={mapCenter}
                    zoom={15}
                    onLoad={map => { mapRef.current = map; }}
                    onCenterChanged={handleCenterChanged}
                    onDragStart={() => isPinMode && setIsPinDragging(true)}
                    onDragEnd={() => isPinMode && setIsPinDragging(false)}
                    options={{
                        disableDefaultUI: true,
                        styles: CLEAN_MAP_STYLE,
                        gestureHandling: 'greedy'
                    }}
                >
                    {isPinMode && (
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none flex flex-col items-center transition-opacity duration-200`}>
                            {/* Lifting Pin */}
                            <div className={`relative transition-all duration-300 ease-out flex items-center justify-center`}
                                style={{ transform: `translateY(${isPinDragging ? '-24px' : '0px'})` }}>
                                <div className="size-10 bg-[#2563eb] rounded-xl rounded-bl-none rotate-45 flex items-center justify-center shadow-lg border-2 border-white">
                                    <div className="size-3 bg-white rounded-full -rotate-45"></div>
                                </div>
                            </div>
                            {/* Shrinking Shadow */}
                            <div className="mt-[-4px] h-1.5 bg-black/30 rounded-full blur-[2px] transition-all duration-300 ease-out"
                                style={{ width: isPinDragging ? '12px' : '20px', opacity: isPinDragging ? 0.3 : 1 }}
                            />
                        </div>
                    )}
                    {directions && !isRouteActive && (
                        <DirectionsRenderer
                            directions={directions || undefined}
                            options={{
                                suppressMarkers: true,
                                polylineOptions: {
                                    strokeColor: '#3b82f6',
                                    strokeWeight: 6,
                                    strokeOpacity: 0.8
                                }
                            }}
                        />
                    )}

                    {!isPinMode && routePoints.map((point, index) => (
                        <SpokeMarker
                            key={point.id || index}
                            point={point}
                            index={index}
                            isCurrent={index === activePointIndex}
                        />
                    ))}

                    {/* Motorcycle User Location Marker */}
                    {currentPos && !isPinMode && (
                        <OverlayView
                            position={currentPos}
                            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                        >
                            <div className="relative -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                                <div className="size-10 bg-white rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.15)] border-2 border-blue-500 relative z-10 transition-transform">
                                    <span className="material-symbols-outlined filled-icon text-blue-600 !text-[22px]">motorcycle</span>
                                </div>
                                {/* Navigation pulse effect */}
                                <div className="absolute -inset-2 bg-blue-500/30 rounded-full animate-ping -z-10"></div>
                                <div className="absolute -inset-4 bg-blue-500/10 rounded-full animate-pulse -z-20"></div>
                            </div>
                        </OverlayView>
                    )}
                </GoogleMap>
            </div>

            {/* 2. Top Floating Hamburger Button (Hidden when expanded) */}
            <button
                onClick={onOpenMenu}
                className={`absolute top-6 left-6 z-[120] size-14 bg-white rounded-full flex items-center justify-center shadow-lg border border-gray-100 active:scale-95 ${isExpanded || isPinMode ? 'opacity-0 pointer-events-none -translate-y-10' : 'opacity-100'}`}
            >
                <span className="material-symbols-outlined !text-[28px] text-gray-800">menu</span>
            </button>

            {/* 3. Bottom Right Floating Buttons (Hidden when expanded) */}
            <div className={`absolute right-6 bottom-[40%] z-50 flex flex-col gap-4 ${isExpanded || isPinMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                <button
                    onClick={() => setMapCenter(currentPos)}
                    className="size-14 bg-white rounded-full flex items-center justify-center shadow-lg border border-gray-100 active:scale-95"
                >
                    <span className="material-symbols-outlined !text-[24px] text-gray-800">my_location</span>
                </button>
            </div>

            {/* Pin Mode HUD Overlay */}
            {isPinMode && (
                <div className="absolute top-2 left-0 right-0 z-[300] p-6 animate-in slide-in-from-top-10 duration-500">
                    <div className="bg-white rounded-[2rem] shadow-2xl p-6 border border-gray-100 backdrop-blur-md bg-white/95">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="size-12 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                                <span className="material-symbols-outlined text-blue-600">location_on</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-[17px] font-black text-gray-900 truncate leading-tight mb-1">
                                    {pinAddress || "Buscando endereço..."}
                                </h3>
                                <p className="text-[13px] text-gray-500 font-medium truncate">
                                    {pinSubAddress || "Ajuste o marcador no mapa"}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsPinMode(false)}
                                className="flex-1 h-14 bg-gray-50 text-gray-600 font-bold rounded-2xl active:scale-95 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    const newPoint = {
                                        id: Date.now().toString(),
                                        name: pinAddress || "Novo Ponto",
                                        lat: mapCenter.lat,
                                        lng: mapCenter.lng,
                                        scannedAt: Date.now(),
                                        isRecent: true
                                    };
                                    const updatedRoute = await addPointToActiveRoute(newPoint);
                                    setRoutePoints(updatedRoute);
                                    setIsPinMode(false);
                                    if (navigator.vibrate) navigator.vibrate(50);
                                }}
                                className="flex-[2] h-14 bg-[#2563eb] text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined !text-[20px]">add</span>
                                Adicionar Parada
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Bottom Sheet Container */}
            <div
                className={`absolute bottom-0 left-0 right-0 z-[150] bg-white flex flex-col px-6 pt-4 
                ${isPinMode ? 'translate-y-full opacity-0' : ''}
                ${isExpanded ? 'h-[95dvh] rounded-t-[32px] shadow-[0_-20px_80px_rgba(0,0,0,0.15)] shadow-black/20' : 'h-[180px] rounded-t-[32px] shadow-[0_-15px_40px_rgba(0,0,0,0.1)]'}`}
                style={{
                    transform: isDragging ? `translateY(${dragY}px)` : (isPinMode ? 'translateY(100%)' : 'translateY(0)'),
                    transition: isDragging ? 'none' : 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
            >
                {/* Handle / Gesture Area - Only this part slides the sheet */}
                <div
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className="flex flex-col select-none"
                >
                    {/* Drag Indicator */}
                    <div
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 cursor-pointer hover:bg-gray-300 transition-colors"
                    />

                    {/* Search Bar Row */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="flex-1 h-14 bg-[#f3f4f9] rounded-2xl flex items-center px-4 border border-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
                            <span className="material-symbols-outlined text-gray-400 mr-3">search</span>
                            <Autocomplete
                                className="flex-1"
                                onLoad={setAutocomplete}
                                onPlaceChanged={onPlaceChanged}
                                options={{
                                    componentRestrictions: { country: 'br' },
                                    ...(currentPos ? {
                                        bounds: {
                                            north: currentPos.lat + 0.5,
                                            south: currentPos.lat - 0.5,
                                            east: currentPos.lng + 0.5,
                                            west: currentPos.lng - 0.5,
                                        },
                                        strictBounds: false,
                                    } : {})
                                }}
                            >
                                <input
                                    type="text"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsExpanded(true);
                                    }}
                                    placeholder={isExpanded ? "Digite para adicionar" : "Toque para adicionar"}
                                    className="w-full bg-transparent border-none p-0 text-gray-800 placeholder:text-gray-400 text-base outline-none focus:ring-0"
                                />
                            </Autocomplete>
                            <div className="flex items-center gap-3 ml-2 border-l border-gray-200 pl-3">
                                <span
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddStops();
                                    }}
                                    className="material-symbols-outlined text-gray-400 !text-[22px] cursor-pointer hover:text-blue-500"
                                >
                                    barcode_scanner
                                </span>
                                <span
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onImport();
                                    }}
                                    className="material-symbols-outlined text-gray-400 !text-[22px] cursor-pointer hover:text-blue-500"
                                >
                                    image
                                </span>
                            </div>
                        </div>
                        {isExpanded && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsExpanded(false);
                                }}
                                className="size-10 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-full"
                            >
                                <span className="material-symbols-outlined !text-[24px]">close</span>
                            </button>
                        )}
                        {!isExpanded && (
                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsMoreMenuOpen(!isMoreMenuOpen);
                                    }}
                                    className={`size-10 flex items-center justify-center rounded-full ${isMoreMenuOpen ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}
                                >
                                    <span className="material-symbols-outlined">more_vert</span>
                                </button>

                                {isMoreMenuOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-[200]"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsMoreMenuOpen(false);
                                            }}
                                        />
                                        <div className="absolute right-0 top-12 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-[210] origin-top-right">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onNavigateToDailyRoute(); setIsMoreMenuOpen(false); }}
                                                className="w-full px-4 py-3 flex items-center gap-3 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[20px] text-blue-500">route</span>
                                                <span className="text-[14px] font-bold">Ver Rota do Dia</span>
                                            </button>
                                            <div className="mx-4 my-1 h-[1px] bg-gray-50" />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleClearRoute(); }}
                                                className="w-full px-4 py-3 flex items-center gap-3 text-red-500 hover:bg-red-50 active:bg-red-100"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
                                                <span className="text-[14px] font-bold">Limpar Rota</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <button
                        onClick={() => {
                            setIsPinMode(true);
                            setIsExpanded(false);
                            reverseGeocode(mapCenter.lat, mapCenter.lng);
                        }}
                        className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-[#f8fafc] border border-gray-50 active:scale-95 transition-all"
                    >
                        <span className="material-symbols-outlined text-blue-600 !text-[28px]">push_pin</span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Alfinete</span>
                    </button>
                    <button
                        onClick={onAddStops}
                        className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-[#f8fafc] border border-gray-100 active:scale-95 transition-all"
                    >
                        <span className="material-symbols-outlined text-blue-600 !text-[28px]">photo_camera</span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Capturar</span>
                    </button>
                </div>

                <div className="bg-white border-t border-gray-100 flex items-center justify-between py-4 select-none">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-gray-400">schedule</span>
                        <span className="text-[14px] font-bold text-gray-700">{routeInfo.duration}</span>
                    </div>
                    <div className="h-4 w-[1px] bg-gray-100"></div>
                    <div className="text-[14px] font-bold text-gray-700">
                        {routePoints.length} paradas
                    </div>
                    <div className="h-4 w-[1px] bg-gray-100"></div>
                    <div className="text-[14px] font-bold text-gray-700">
                        {routeInfo.distance}
                    </div>
                    <button className="size-10 flex items-center justify-center text-gray-400">
                        <span className="material-symbols-outlined">search</span>
                    </button>
                </div>

                {/* Start Route Button */}
                <div className="pt-2">
                    <button
                        onClick={() => setIsRouteActive(true)}
                        className="w-full h-16 bg-[#2970ff] rounded-[1.5rem] flex items-center justify-center gap-3 text-white shadow-[0_8px_20px_rgba(41,112,255,0.3)] active:scale-95"
                    >
                        <span className="material-symbols-outlined filled-icon">play_arrow</span>
                        <span className="text-[16px] font-black tracking-wide">Iniciar Rota</span>
                    </button>
                </div>
            </div>

            {/* Action Buttons (Collapsed View only) */}
            {!isExpanded && !isPinMode && (
                <div className="mt-8 space-y-3 animate-in fade-in duration-300">
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="w-full h-14 bg-[#2563eb] text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg"
                    >
                        <span className="material-symbols-outlined !text-[20px]">add</span>
                        Adicionar paradas
                    </button>
                    <button className="w-full h-14 bg-white text-[#2563eb] font-bold rounded-2xl flex items-center justify-center border border-gray-100 active:scale-[0.98] transition-all">
                        Copiar paradas de uma rota anterior
                    </button>
                </div>
            )}

            {/* Map Attribution */}
            <div className={`absolute bottom-4 left-6 z-10 ${isExpanded ? 'opacity-0' : 'opacity-30'}`}>
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Google_Maps_Logo_2020.svg/512px-Google_Maps_Logo_2020.svg.png" className="h-6 grayscale" alt="Google" />
            </div>

            {isRouteActive && (
                <ActiveRouteView
                    routePoints={routePoints}
                    onClose={() => setIsRouteActive(false)}
                    onArrived={(point) => {
                        const url = `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}&travelmode=driving`;
                        window.open(url, '_blank');
                    }}
                />
            )}
        </div>
    );
};
