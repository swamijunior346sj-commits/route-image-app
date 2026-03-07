import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { useCallback } from 'react';
import type { LocationPoint } from '../App';

const containerStyle = {
    width: '100%',
    height: '100%'
};

const defaultCenter = {
    lat: -23.5505,
    lng: -46.6333
};

const mapOptions = {
    disableDefaultUI: true,
    styles: [
        {
            "featureType": "poi",
            "stylers": [{ "visibility": "off" }]
        }
    ],
    zoomControl: false,
};

export const MapView = ({ points }: { points: LocationPoint[] }) => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""
    });

    const onLoad = useCallback(function callback(m: google.maps.Map) {
        console.log("Map Loaded", m);
    }, []);

    const onUnmount = useCallback(function callback() {
        console.log("Map Unmounted");
    }, []);

    if (!isLoaded) return <div className="w-full h-full bg-slate-100 animate-pulse flex items-center justify-center font-bold text-slate-400">Carregando Mapa...</div>;

    return (
        <div className="w-full h-full">
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={points.length > 0 ? { lat: points[points.length - 1].lat, lng: points[points.length - 1].lng } : defaultCenter}
                zoom={14}
                onLoad={onLoad}
                onUnmount={onUnmount}
                options={mapOptions}
            >
                {points.map((p, idx) => (
                    <Marker
                        key={p.id}
                        position={{ lat: p.lat, lng: p.lng }}
                        label={{
                            text: (idx + 1).toString(),
                            color: 'white',
                            fontWeight: 'bold'
                        }}
                    />
                ))}
            </GoogleMap>

            {/* Floating Actions on Map */}
            <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
                <div className="pointer-events-auto bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-white flex items-center gap-3">
                    <div className="size-3 bg-green-500 rounded-full animate-ping"></div>
                    <span className="text-[13px] font-bold text-slate-700">Online</span>
                </div>
            </div>
        </div>
    );
};
