import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { useCallback, useRef, useState, useEffect } from 'react';
import type { LocationPoint } from '../App';

const containerStyle = {
    width: '100%',
    height: '100%'
};

const defaultCenter = {
    lat: -23.5505,
    lng: -46.6333
};

const mapOptions: google.maps.MapOptions = {
    disableDefaultUI: true,
    styles: [
        { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
        { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
        { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
        { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
        { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
        { "featureType": "administrative.country", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
        { "featureType": "administrative.land_parcel", "stylers": [{ "visibility": "off" }] },
        { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
        { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
        { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#181818" }] },
        { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
        { "featureType": "poi.park", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1b1b1b" }] },
        { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
        { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
        { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#373737" }] },
        { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3c3c3c" }] },
        { "featureType": "road.highway.controlled_access", "elementType": "geometry", "stylers": [{ "color": "#4e4e4e" }] },
        { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
        { "featureType": "transit", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] },
        { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#3d3d3d" }] }
    ],
    zoomControl: false,
    gestureHandling: "greedy",
    mapTypeId: 'roadmap',
    tilt: 45
};

interface MapViewProps {
    points: LocationPoint[];
    onDeletePoint?: (id: string) => void;
    onToggleStatus?: (id: string, currentStatus: string) => void;
    isNavigating?: boolean;
    onStopNavigation?: () => void;
}

export const MapView = ({ points, onDeletePoint, onToggleStatus, isNavigating, onStopNavigation }: MapViewProps) => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
        libraries: ['places']
    });

    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
    const [userPos, setUserPos] = useState(defaultCenter); // Position of the blue dot
    const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral | undefined>(defaultCenter); // Fixed center only when snapping
    const [lastRouteUpdate, setLastRouteUpdate] = useState<number>(0);
    const mapRef = useRef<google.maps.Map | null>(null);

    const nextPoint = points.find(p => p.status === 'pending');

    useEffect(() => {
        if (!("geolocation" in navigator)) return;

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                setUserPos(pos);

                // If navigating, follow the user smoothly with panTo
                if (isNavigating && mapRef.current) {
                    mapRef.current.panTo(pos);
                }
            },
            (error) => console.error("GPS Watch Error:", error),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [isNavigating]);

    // Optimize Directions API calls
    useEffect(() => {
        const now = Date.now();
        if (isNavigating && nextPoint && userPos && (now - lastRouteUpdate > 30000)) {
            const directionsService = new google.maps.DirectionsService();
            directionsService.route(
                {
                    origin: userPos,
                    destination: { lat: nextPoint.lat, lng: nextPoint.lng },
                    travelMode: google.maps.TravelMode.DRIVING,
                },
                (result, status) => {
                    if (status === google.maps.DirectionsStatus.OK) {
                        setDirections(result);
                        setLastRouteUpdate(now);
                    }
                }
            );
        } else if (!isNavigating) {
            setDirections(null);
            setLastRouteUpdate(0);
        }
    }, [isNavigating, nextPoint, userPos, lastRouteUpdate]);

    const handleMyLocation = () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                const pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                setUserPos(pos);
                setMapCenter(pos); // This forces the map to jump back to user
                if (mapRef.current) mapRef.current.panTo(pos);
            });
        }
    };

    const onLoad = useCallback((m: google.maps.Map) => {
        mapRef.current = m;
    }, []);

    if (!isLoaded) return <div className="p-10 font-black text-slate-300 uppercase tracking-widest animate-pulse">Iniciando GPS...</div>;

    return (
        <div className="w-full h-full relative text-left">

            {/* Navigation HUD */}
            {isNavigating && nextPoint && (
                <div className="absolute top-16 left-4 right-4 z-20 animate-in slide-in-from-top-10 duration-500">
                    <div className="bg-slate-900 shadow-2xl rounded-[2rem] p-5 text-white border border-white/10 backdrop-blur-md">
                        <div className="flex items-center gap-4">
                            <div className="size-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <span className="material-symbols-outlined !text-32px animate-pulse">navigation</span>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-black leading-tight truncate">{nextPoint.name}</h2>
                                <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                                    {directions?.routes[0].legs[0].distance?.text || 'Calculando...'} • {directions?.routes[0].legs[0].duration?.text || '--'}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onToggleStatus?.(nextPoint.id, nextPoint.status)}
                                    className="size-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20 active:scale-90 transition-all"
                                >
                                    <span className="material-symbols-outlined !text-24px">check</span>
                                </button>
                                <button
                                    onClick={onStopNavigation}
                                    className="size-12 bg-slate-800 rounded-full flex items-center justify-center active:scale-90 transition-all"
                                >
                                    <span className="material-symbols-outlined !text-24px">pause</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Localize Floating Button */}
            {!isNavigating && (
                <button
                    onClick={handleMyLocation}
                    className="absolute bottom-24 left-6 z-10 size-14 bg-white rounded-2xl shadow-xl flex items-center justify-center text-blue-600 border border-white active:scale-90 transition-all"
                >
                    <span className="material-symbols-outlined filled-icon">my_location</span>
                </button>
            )}

            <GoogleMap
                mapContainerStyle={containerStyle}
                center={mapCenter}
                zoom={15}
                onLoad={onLoad}
                options={mapOptions}
                onDragStart={() => setMapCenter(undefined)} // Unlocks center when user drags
            >
                <Marker
                    position={userPos}
                    zIndex={100}
                    icon={{
                        url: 'https://cdn-icons-png.flaticon.com/512/3722/3722927.png',
                        scaledSize: new google.maps.Size(46, 46),
                        anchor: new google.maps.Point(23, 23)
                    }}
                />

                {directions && (
                    <DirectionsRenderer
                        directions={directions}
                        options={{
                            suppressMarkers: true,
                            polylineOptions: { strokeColor: "#3b82f6", strokeWeight: 6, strokeOpacity: 0.8 }
                        }}
                    />
                )}

                {points.map((p, idx) => (
                    <Marker
                        key={p.id}
                        position={{ lat: p.lat, lng: p.lng }}
                        onClick={() => {
                            const confirmDelete = window.confirm(`Remover "${p.name}"?`);
                            if (confirmDelete && onDeletePoint) onDeletePoint(p.id);
                        }}
                        visible={!isNavigating || p.id === nextPoint?.id}
                        label={{ text: (idx + 1).toString(), color: 'white', fontWeight: '800' }}
                        icon={{
                            url: p.status === 'delivered' ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' : 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                        }}
                    />
                ))}
            </GoogleMap>
        </div>
    );
};
