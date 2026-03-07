import { GoogleMap, useJsApiLoader, Marker, StandaloneSearchBox, DirectionsRenderer } from '@react-google-maps/api';
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
        { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
        { "featureType": "transit", "stylers": [{ "visibility": "off" }] }
    ],
    zoomControl: false,
    gestureHandling: "greedy",
};

interface MapViewProps {
    points: LocationPoint[];
    onAddManualPoint?: (point: Omit<LocationPoint, 'id' | 'status' | 'createdAt'>) => void;
    onDeletePoint?: (id: string) => void;
    isNavigating?: boolean;
    onStopNavigation?: () => void;
}

export const MapView = ({ points, onAddManualPoint, onDeletePoint, isNavigating, onStopNavigation }: MapViewProps) => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
        libraries: ['places']
    });

    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
    const [center, setCenter] = useState(defaultCenter);
    const mapRef = useRef<google.maps.Map | null>(null);
    const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);

    const nextPoint = points.find(p => p.status === 'pending');

    useEffect(() => {
        handleMyLocation();
    }, []);

    // Update directions when navigation starts or next point changes
    useEffect(() => {
        if (isNavigating && nextPoint && center) {
            const directionsService = new google.maps.DirectionsService();
            directionsService.route(
                {
                    origin: center,
                    destination: { lat: nextPoint.lat, lng: nextPoint.lng },
                    travelMode: google.maps.TravelMode.DRIVING,
                },
                (result, status) => {
                    if (status === google.maps.DirectionsStatus.OK) {
                        setDirections(result);
                    } else {
                        console.error(`error fetching directions ${result}`);
                    }
                }
            );
        } else {
            setDirections(null);
        }
    }, [isNavigating, nextPoint, center]);

    const handleMyLocation = () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                const pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                setCenter(pos);
                mapRef.current?.panTo(pos);
            });
        }
    };

    const onLoad = useCallback((m: google.maps.Map) => {
        mapRef.current = m;
    }, []);

    if (!isLoaded) return <div className="p-10 font-black uppercase text-slate-300">Iniciando GPS Interno...</div>;

    return (
        <div className="w-full h-full relative">

            {/* Navigation HUD (Head-Up Display) */}
            {isNavigating && nextPoint && directions && (
                <div className="absolute top-16 left-4 right-4 z-20 animate-in slide-in-from-top-10 duration-500">
                    <div className="bg-blue-600 shadow-2xl rounded-[1.5rem] p-5 text-white border border-blue-400/30 backdrop-blur-md">
                        <div className="flex items-center gap-4">
                            <div className="size-14 bg-white/20 rounded-2xl flex items-center justify-center">
                                <span className="material-symbols-outlined !text-32px">navigation</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase tracking-[2px] opacity-70">Siga para</p>
                                <h2 className="text-lg font-black leading-tight line-clamp-1">{nextPoint.name}</h2>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-sm font-bold opacity-90">{directions.routes[0].legs[0].distance?.text}</span>
                                    <div className="size-1 bg-white/30 rounded-full"></div>
                                    <span className="text-sm font-bold opacity-90">{directions.routes[0].legs[0].duration?.text}</span>
                                </div>
                            </div>
                            <button
                                onClick={onStopNavigation}
                                className="size-10 bg-red-500/20 hover:bg-red-500/40 rounded-full flex items-center justify-center transition-colors"
                            >
                                <span className="material-symbols-outlined !text-20px">close</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Search (Hidden when Navigating) */}
            {!isNavigating && (
                <div className="absolute top-20 left-4 right-4 z-10 flex gap-2">
                    <StandaloneSearchBox
                        onLoad={(ref) => searchBoxRef.current = ref}
                        onPlacesChanged={() => {
                            const places = searchBoxRef.current?.getPlaces();
                            if (places && places[0]) {
                                const place = places[0];
                                if (place.geometry && place.geometry.location) {
                                    const p = place.geometry.location;
                                    const newPos = { lat: p.lat(), lng: p.lng() };

                                    setCenter(newPos);
                                    mapRef.current?.setZoom(17);

                                    if (onAddManualPoint) {
                                        const confirmAdd = window.confirm(`Adicionar "${place.name || 'Ponto Manual'}" como um novo ponto?`);
                                        if (confirmAdd) {
                                            onAddManualPoint({
                                                name: place.name || 'Ponto Manual',
                                                address: place.formatted_address || '',
                                                lat: newPos.lat,
                                                lng: newPos.lng,
                                                city: place.address_components?.find(c => c.types.includes('locality'))?.long_name || '',
                                                notes: `Adicionado via busca premium`
                                            });
                                        }
                                    }
                                }
                            }
                        }}
                    >
                        <div className="flex-1 bg-white/95 backdrop-blur-xl px-5 h-14 rounded-2xl shadow-xl border border-white flex items-center gap-3">
                            <span className="material-symbols-outlined text-slate-400">search</span>
                            <input className="flex-1 bg-transparent border-none outline-none font-bold text-slate-800" placeholder="Buscar endereço..." />
                        </div>
                    </StandaloneSearchBox>
                    <button onClick={handleMyLocation} className="size-14 bg-white rounded-2xl shadow-xl flex items-center justify-center text-blue-600 border border-white"><span className="material-symbols-outlined filled-icon">my_location</span></button>
                </div>
            )}

            <GoogleMap
                mapContainerStyle={containerStyle}
                center={center}
                zoom={14}
                onLoad={onLoad}
                options={mapOptions}
            >
                {/* User Moto */}
                <Marker
                    position={center}
                    icon={{
                        url: 'https://cdn-icons-png.flaticon.com/512/3722/3722927.png',
                        scaledSize: new google.maps.Size(46, 46),
                        anchor: new google.maps.Point(23, 23)
                    }}
                />

                {/* Directions Renderer */}
                {directions && (
                    <DirectionsRenderer
                        directions={directions}
                        options={{
                            suppressMarkers: true,
                            polylineOptions: {
                                strokeColor: "#2563eb",
                                strokeWeight: 6,
                                strokeOpacity: 0.8
                            }
                        }}
                    />
                )}

                {/* Stop Markers */}
                {!isNavigating && points.map((p, idx) => (
                    <Marker
                        key={p.id}
                        position={{ lat: p.lat, lng: p.lng }}
                        onClick={() => {
                            if (confirm(`Remover "${p.name}"?`)) onDeletePoint?.(p.id);
                        }}
                        label={{ text: (idx + 1).toString(), color: 'white', fontWeight: '800' }}
                        icon={{ url: p.status === 'delivered' ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' : 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' }}
                    />
                ))}

                {isNavigating && nextPoint && (
                    <Marker
                        position={{ lat: nextPoint.lat, lng: nextPoint.lng }}
                        label={{ text: "DESTINO", color: 'white', fontWeight: '900', fontSize: '10px' }}
                        icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' }}
                    />
                )}
            </GoogleMap>
        </div>
    );
};
