import { useState, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';

const mapContainerStyle = { width: '100%', height: '100vh' };
const defaultCenter = { lat: -23.5505, lng: -46.6333 };

const LIGHT_MAP_STYLE = [
    { "featureType": "landscape", "stylers": [{ "color": "#fdfaf3" }] },
    { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
    { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#e1e1e1" }, { "weight": 1.5 }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#ffcc66" }] },
    { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#f1c40f" }, { "weight": 2 }] },
    { "featureType": "water", "stylers": [{ "color": "#7fc9bd" }] }
];

interface MapPickerViewProps {
    googleMapsApiKey: string;
    onBack: () => void;
    onConfirm: (address: string, location: { lat: number, lng: number }) => void;
}

const libraries: ("places" | "geometry")[] = ['places', 'geometry'];

export const MapPickerView = ({ googleMapsApiKey, onBack, onConfirm }: MapPickerViewProps) => {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey,
        libraries
    });

    const [mapCenter, setMapCenter] = useState(defaultCenter);
    const [isDragging, setIsDragging] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [address, setAddress] = useState('Buscando endereço...');
    const [subAddress, setSubAddress] = useState('');

    // Form States
    const [houseNumber, setHouseNumber] = useState('');
    const [complement, setComplement] = useState('');
    const [notes, setNotes] = useState('');

    const mapRef = useRef<google.maps.Map | null>(null);
    const geocoderRef = useRef<google.maps.Geocoder | null>(null);

    useEffect(() => {
        if (isLoaded && !geocoderRef.current) {
            geocoderRef.current = new window.google.maps.Geocoder();
        }
    }, [isLoaded]);

    const handleCenterChanged = () => {
        if (mapRef.current && !isEditing) {
            const newCenter = mapRef.current.getCenter();
            if (newCenter) {
                const lat = newCenter.lat();
                const lng = newCenter.lng();
                setMapCenter({ lat, lng });

                // Debounce geocoding to avoid API limits
                reverseGeocode(lat, lng);
            }
        }
    };

    const reverseGeocode = (lat: number, lng: number) => {
        if (geocoderRef.current) {
            geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
                if (status === 'OK' && results?.[0]) {
                    const fullAddress = results[0].formatted_address;
                    const parts = fullAddress.split(',');
                    setAddress(parts[0] || '');
                    setSubAddress(parts.slice(1, 3).join(',') || '');
                }
            });
        }
    };

    if (!isLoaded) return (
        <div className="w-full h-screen bg-white flex flex-col items-center justify-center p-12 text-center">
            <div className="size-16 border-4 border-blue-50 border-t-blue-500 rounded-full animate-spin mb-6"></div>
            <h2 className="text-xl font-bold text-gray-800">Preparando Mapa...</h2>
        </div>
    );

    return (
        <div className="relative w-full h-screen bg-white overflow-hidden font-sans">
            {/* 1. Map Canvas */}
            <div className={`absolute inset-0 z-0 transition-all duration-500 ${isEditing ? 'scale-110 blur-sm opacity-50' : 'scale-100'}`}>
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={defaultCenter}
                    zoom={17}
                    onLoad={m => {
                        mapRef.current = m;
                        // Trigger initial geocode
                        const center = m.getCenter();
                        if (center) reverseGeocode(center.lat(), center.lng());
                    }}
                    onDragStart={() => !isEditing && setIsDragging(true)}
                    onDragEnd={() => setIsDragging(false)}
                    onCenterChanged={handleCenterChanged}
                    options={{
                        styles: LIGHT_MAP_STYLE,
                        disableDefaultUI: true,
                        zoomControl: false,
                        gestureHandling: isEditing ? 'none' : 'greedy'
                    }}
                />
            </div>

            {/* 2. Top Close Button */}
            {!isEditing && (
                <button
                    onClick={onBack}
                    className="absolute top-6 left-6 z-50 size-12 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all animate-in fade-in"
                >
                    <span className="material-symbols-outlined text-gray-800">close</span>
                </button>
            )}

            {/* 3. Center Screen Marker (The Custom Pin) */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none flex flex-col items-center transition-opacity duration-300 ${isEditing ? 'opacity-0' : 'opacity-100'}`}>
                {/* Lifting Pin */}
                <div
                    className={`relative transition-all duration-300 ease-out flex items-center justify-center`}
                    style={{
                        transform: `translateY(${isDragging ? '-24px' : '0px'})`,
                    }}
                >
                    {/* The Blue Pin Body */}
                    <div className="size-10 bg-[#2563eb] rounded-lg rounded-bl-none rotate-45 flex items-center justify-center shadow-md">
                        <div className="size-2.5 bg-white rounded-full -rotate-45"></div>
                    </div>
                </div>

                {/* Shrinking Shadow */}
                <div
                    className="mt-[-4px] h-1.5 bg-black/20 rounded-full blur-[2px] transition-all duration-300 ease-out"
                    style={{
                        width: isDragging ? '12px' : '24px',
                        opacity: isDragging ? 0.3 : 0.6,
                        transform: `scale(${isDragging ? 0.7 : 1})`
                    }}
                ></div>
            </div>

            {/* 4. Bottom Info Card (Picker Mode) */}
            {!isEditing && (
                <div className="absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-[32px] shadow-[0_-20px_40px_rgba(0,0,0,0.1)] px-6 pt-8 pb-12 flex flex-col animate-in slide-in-from-bottom duration-500">
                    <div className="flex items-start justify-between mb-8">
                        <div className="flex-1">
                            <h2 className="text-[18px] font-bold text-gray-800 leading-tight mb-1">
                                {address}
                            </h2>
                            <p className="text-[14px] text-gray-400 font-medium">
                                {subAddress}
                            </p>
                        </div>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                        >
                            <span className="material-symbols-outlined !text-[24px]">edit</span>
                        </button>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => onConfirm(address, mapCenter)}
                            className="w-full h-14 bg-[#2563eb] text-white font-bold rounded-2xl flex items-center justify-center active:scale-[0.98] transition-all shadow-lg"
                        >
                            Adicionar parada
                        </button>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="w-full h-14 bg-[#eff4ff] text-[#2563eb] font-bold rounded-2xl flex items-center justify-center active:scale-[0.98] transition-all"
                        >
                            Adicionar parada e editar
                        </button>
                    </div>
                </div>
            )}

            {/* 5. Details Editor (Edit Mode) */}
            {isEditing && (
                <div className="absolute inset-0 z-[100] flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/10" onClick={() => setIsEditing(false)}></div>
                    <div className="relative bg-white rounded-t-[40px] shadow-[0_-20px_80px_rgba(0,0,0,0.2)] px-8 pt-12 pb-14 flex flex-col animate-in slide-in-from-bottom duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
                        <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8 cursor-pointer" onClick={() => setIsEditing(false)}></div>

                        <h2 className="text-[24px] font-black text-gray-900 mb-8 leading-none">Detalhes da Parada</h2>

                        <div className="space-y-6">
                            {/* Selected Address Preview */}
                            <div className="bg-[#f8fafc] rounded-3xl p-6 border border-gray-50">
                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-2 leading-none">Endereço selecionado</p>
                                <p className="text-[16px] font-bold text-gray-800 leading-tight">{address}</p>
                                <p className="text-[13px] text-gray-400 mt-1 font-medium">{subAddress}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Número</label>
                                    <input
                                        type="text"
                                        value={houseNumber}
                                        onChange={e => setHouseNumber(e.target.value)}
                                        placeholder="Ex: 124"
                                        className="w-full h-16 bg-[#f8fafc] rounded-2xl px-5 text-gray-800 font-bold placeholder:text-gray-300 border border-gray-50 focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Complemento</label>
                                    <input
                                        type="text"
                                        value={complement}
                                        onChange={e => setComplement(e.target.value)}
                                        placeholder="Apt, Bloco..."
                                        className="w-full h-16 bg-[#f8fafc] rounded-2xl px-5 text-gray-800 font-bold placeholder:text-gray-300 border border-gray-50 focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Notas da Entrega</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Instruções para o entregador..."
                                    rows={3}
                                    className="w-full bg-[#f8fafc] rounded-2xl p-5 text-gray-800 font-medium placeholder:text-gray-300 border border-gray-50 focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all resize-none"
                                />
                            </div>

                            <button
                                onClick={() => {
                                    setIsEditing(false);
                                    onConfirm(`${address}, ${houseNumber} ${complement}`, mapCenter);
                                }}
                                className="w-full h-16 bg-[#2563eb] text-white font-black text-lg uppercase tracking-widest rounded-[2rem] shadow-[0_12px_40px_rgba(37,99,235,0.3)] active:scale-95 transition-all mt-4"
                            >
                                Concluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Google Attribution */}
            <div className={`absolute bottom-[240px] left-6 transition-opacity duration-300 ${isEditing ? 'opacity-0' : 'opacity-30'}`}>
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Google_Maps_Logo_2020.svg/512px-Google_Maps_Logo_2020.svg.png" className="h-6 grayscale" alt="Google" />
            </div>
        </div>
    );
};
