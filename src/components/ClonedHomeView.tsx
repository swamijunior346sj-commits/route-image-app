import { useRef, useState, useEffect } from 'react';
import {
    GoogleMap,
    useJsApiLoader,
    OverlayView,
    Autocomplete,
    DirectionsRenderer
} from '@react-google-maps/api';
import { getActiveRoute, type RoutePoint } from '../services/db';
import { ActiveRouteView } from './ActiveRouteView';

const libraries: ("places" | "geometry")[] = ['places', 'geometry'];
const defaultCenter = { lat: -23.5505, lng: -46.6333 };
const mapContainerStyle = { width: '100%', height: '100dvh' };

const CLEAN_MAP_STYLE = [
    { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
    { "featureType": "all", "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
    { "featureType": "all", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
    { "featureType": "landscape.man_made", "elementType": "geometry.fill", "stylers": [{ "color": "#f7f9fc" }] },
    { "featureType": "landscape.man_made", "elementType": "geometry.stroke", "stylers": [{ "color": "#e2e8f0" }] },
    { "featureType": "landscape.natural", "elementType": "geometry", "stylers": [{ "color": "#f8fafc" }] },
    { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
    { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#e5e7eb" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#cce2ff" }] }
];

const SpokeMarker = ({ number, type }: { number: number, type: 'active' | 'future' | 'passed' }) => (
    <div className="relative" style={{ position: 'absolute', transform: 'translate(-50%, -50%)' }}>
        <div className={`
            flex items-center justify-center
            size-8 rounded-xl
            border-2 shadow-lg
            transition-all duration-300
            ${type === 'active'
                ? 'bg-[#2970ff] border-white scale-125 z-20 shadow-[0_4px_12px_rgba(41,112,255,0.4)] text-white'
                : type === 'future'
                    ? 'bg-white border-[#2970ff] text-[#2970ff] z-10'
                    : 'bg-gray-100 border-white text-gray-400 opacity-60 grayscale scale-90'}
        `}>
            <span className="text-[13px] font-black leading-none">
                {number}
            </span>

            {/* Minimal Pulse for active only */}
            {type === 'active' && (
                <div className="absolute inset-0 rounded-xl bg-[#2970ff] animate-ping opacity-20 -z-10"></div>
            )}
        </div>
    </div>
);

interface ClonedHomeViewProps {
    googleMapsApiKey: string;
    onOpenMenu: () => void;
    onAddStops: () => void;
    onOpenMapPicker: () => void;
    onImport: () => void;
    onNavigateToRecords: () => void;
}

export const ClonedHomeView = ({ googleMapsApiKey, onOpenMenu, onAddStops, onOpenMapPicker, onImport, onNavigateToRecords }: ClonedHomeViewProps) => {
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
    const startY = useRef(0);
    const lastY = useRef(0);
    const mapRef = useRef<google.maps.Map | null>(null);

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

    const onPlaceChanged = () => {
        if (autocomplete) {
            const place = autocomplete.getPlace();
            if (place.geometry?.location) {
                const newPos = {
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng()
                };
                setMapCenter(newPos);
            }
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

    if (!isLoaded) return (
        <div className="w-full h-screen bg-[#f8fafc] flex items-center justify-center">
            <div className="size-8 border-2 border-blue-100 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="relative w-full h-screen bg-[#f8fafc] overflow-hidden font-sans light-mode">
            {/* 1. Map Backdrop (Hidden or blurred when expanded) */}
            <div className={`absolute inset-0 z-0 transition-all duration-500 ${isExpanded ? 'scale-110 blur-sm opacity-50' : 'scale-100 opacity-100'}`}>
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={mapCenter}
                    zoom={15}
                    onLoad={m => { mapRef.current = m; }}
                    options={{
                        styles: CLEAN_MAP_STYLE,
                        disableDefaultUI: true,
                        zoomControl: false,
                        mapTypeControl: false,
                        scaleControl: false,
                        streetViewControl: false,
                        rotateControl: false,
                        fullscreenControl: false
                    }}
                >
                    {/* Real Route Renderer */}
                    {directions && (
                        <DirectionsRenderer
                            directions={directions}
                            options={{
                                suppressMarkers: true, // We use our custom markers
                                polylineOptions: {
                                    strokeColor: "#2970ff",
                                    strokeOpacity: 0.8,
                                    strokeWeight: 6
                                }
                            }}
                        />
                    )}

                    {/* Markers */}
                    {routePoints.map((point, idx) => (
                        point.lat && point.lng && (
                            <OverlayView
                                key={point.id}
                                position={{ lat: point.lat, lng: point.lng }}
                                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                            >
                                <SpokeMarker
                                    number={idx + 1}
                                    type={idx === 0 ? 'active' : (point.isDelivered ? 'passed' : 'future')}
                                />
                            </OverlayView>
                        )
                    ))}

                    {/* Current User Marker */}
                    <OverlayView position={currentPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div className="relative flex items-center justify-center">
                            <div className="absolute size-10 bg-blue-500/20 rounded-full animate-ping"></div>
                            <div className="size-5 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-white ring-4 ring-blue-500/10">
                                <div className="size-3.5 bg-blue-500 rounded-full"></div>
                            </div>
                        </div>
                    </OverlayView>
                </GoogleMap>
            </div>

            {/* 2. Top Floating Hamburger Button (Hidden when expanded) */}
            <button
                onClick={onOpenMenu}
                className={`absolute top-6 left-6 z-[120] size-14 bg-white rounded-full flex items-center justify-center shadow-lg border border-gray-100 active:scale-95 transition-all duration-300 ${isExpanded ? 'opacity-0 pointer-events-none -translate-y-10' : 'opacity-100'}`}
            >
                <span className="material-symbols-outlined !text-[28px] text-gray-800">menu</span>
            </button>

            {/* 3. Bottom Right Floating Buttons (Hidden when expanded) */}
            <div className={`absolute right-6 bottom-[40%] z-50 flex flex-col gap-4 transition-all duration-300 ${isExpanded ? 'opacity-0 pointer-events-none translate-x-10' : 'opacity-100'}`}>
                <button className="size-14 bg-white rounded-full flex items-center justify-center shadow-lg border border-gray-100 active:scale-95 transition-all">
                    <span className="material-symbols-outlined !text-[24px] text-gray-800">layers</span>
                </button>
                <button
                    onClick={() => setMapCenter(currentPos)}
                    className="size-14 bg-white rounded-full flex items-center justify-center shadow-lg border border-gray-100 active:scale-95 transition-all"
                >
                    <span className="material-symbols-outlined !text-[24px] text-gray-800 filled-icon">my_location</span>
                </button>
            </div>

            {/* 4. Bottom Sheet Container */}
            <div
                className={`absolute bottom-0 left-0 right-0 z-[150] bg-white flex flex-col px-6 pt-4 
                ${!isDragging ? 'transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]' : ''}
                ${isExpanded ? 'h-[95dvh] rounded-t-[32px] shadow-[0_-20px_80px_rgba(0,0,0,0.15)] shadow-black/20' : 'h-[180px] rounded-t-[32px] shadow-[0_-15px_40px_rgba(0,0,0,0.1)]'}`}
                style={{
                    transform: isDragging ? `translateY(${dragY}px)` : 'translateY(0)',
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
                        <div className="flex-1 h-14 bg-[#f3f4f9] rounded-2xl flex items-center px-4 border border-gray-50 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                            <span className="material-symbols-outlined text-gray-400 mr-3">search</span>
                            <Autocomplete className="flex-1" onLoad={setAutocomplete} onPlaceChanged={onPlaceChanged}>
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
                                className="size-10 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <span className="material-symbols-outlined !text-[24px]">close</span>
                            </button>
                        )}
                        {!isExpanded && (
                            <button className="size-10 flex items-center justify-center text-gray-400">
                                <span className="material-symbols-outlined">more_vert</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col items-center justify-center py-10 space-y-4">
                    <div className="size-12 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center">
                        <span className="material-symbols-outlined text-gray-300">add</span>
                    </div>
                    <p className="text-gray-400 text-center text-[15px] font-medium leading-tight max-w-[240px]">
                        Adicione as primeiras paradas para começar a criar sua rota
                    </p>
                </div>

                {/* Footer Controls (Expanded only) */}
                {isExpanded && (
                    <div className="mt-auto pb-8 pt-4 animate-in slide-in-from-bottom duration-500">
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <button
                                onClick={onOpenMapPicker}
                                className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-[#f8fafc] border border-gray-50 active:scale-95 transition-all"
                            >
                                <span className="material-symbols-outlined text-blue-600 !text-[28px]">map</span>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Alfinete</span>
                            </button>
                            <button
                                onClick={onAddStops}
                                className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-[#f8fafc] border border-gray-50 active:scale-95 transition-all"
                            >
                                <span className="material-symbols-outlined text-blue-600 !text-[28px]">photo_camera</span>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Capturar</span>
                            </button>
                            <button
                                onClick={onNavigateToRecords}
                                className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-[#f8fafc] border border-gray-50 active:scale-95 transition-all"
                            >
                                <span className="material-symbols-outlined text-blue-600 !text-[28px]">inventory_2</span>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Endereços</span>
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
                                className="w-full h-16 bg-[#2970ff] rounded-[1.5rem] flex items-center justify-center gap-3 text-white shadow-[0_8px_20px_rgba(41,112,255,0.3)] active:scale-95 transition-all"
                            >
                                <span className="material-symbols-outlined filled-icon">play_arrow</span>
                                <span className="text-[16px] font-black tracking-wide">Iniciar Rota</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Action Buttons (Collapsed View only) */}
                {!isExpanded && (
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
            </div>

            {/* Map Attribution */}
            <div className={`absolute bottom-4 left-6 z-10 transition-opacity duration-300 ${isExpanded ? 'opacity-0' : 'opacity-30'}`}>
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
