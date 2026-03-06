import { useState } from 'react';
import type { RoutePoint, LocationRecord } from '../services/db';

interface EditAddressViewProps {
    item: RoutePoint | LocationRecord;
    onSave: (updatedItem: Partial<RoutePoint & LocationRecord>) => void;
    onBack: () => void;
}

export const EditAddressView = ({ item, onSave, onBack }: EditAddressViewProps) => {
    const [name, setName] = useState(item.name || '');
    const [neighborhood, setNeighborhood] = useState(item.neighborhood || '');
    const [city, setCity] = useState(item.city || '');
    const [lat, setLat] = useState(item.lat?.toString() || '');
    const [lng, setLng] = useState(item.lng?.toString() || '');
    const [notes, setNotes] = useState(item.notes || '');
    const [image, setImage] = useState((item as LocationRecord).imageThumbnail || '');

    const handleSave = () => {
        onSave({
            name,
            neighborhood,
            city,
            lat: lat ? parseFloat(lat) : null,
            lng: lng ? parseFloat(lng) : null,
            notes,
            ...(image ? { imageThumbnail: image } : {})
        });
    };

    const handleUpdateGPS = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setLat(pos.coords.latitude.toFixed(6));
                setLng(pos.coords.longitude.toFixed(6));
            });
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-gradient-to-b from-[#0F172A] to-[#1E293B] text-white/90 font-sans overflow-hidden flex flex-col">
            <header className="fixed top-0 left-0 right-0 z-50 px-6 pt-14 pb-6 flex items-center justify-between bg-[#0F172A]/40 backdrop-blur-md border-b border-white/5">
                <button
                    onClick={onBack}
                    className="flex items-center justify-center size-12 rounded-full glass-card active:scale-95 transition-all"
                >
                    <span className="material-symbols-outlined text-white/90">chevron_left</span>
                </button>
                <div className="text-center">
                    <h1 className="text-lg font-bold tracking-tight text-white/90">Editar Endereço</h1>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-medium">ID #{item.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="size-12"></div>
            </header>

            <main className="flex-1 overflow-y-auto px-6 pt-36 pb-44 space-y-8 no-scrollbar">
                <div className="space-y-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Nome do Destinatário</label>
                        <input
                            className="glass-input"
                            placeholder="Nome completo"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Bairro</label>
                        <input
                            className="glass-input"
                            placeholder="Bairro"
                            type="text"
                            value={neighborhood}
                            onChange={(e) => setNeighborhood(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Cidade / Endereço Completo</label>
                        <textarea
                            className="glass-input resize-none"
                            placeholder="Rua, número, complemento, cidade - UF"
                            rows={3}
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Latitude</label>
                            <input
                                className="glass-input"
                                placeholder="0.0000"
                                type="text"
                                value={lat}
                                onChange={(e) => setLat(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Longitude</label>
                            <input
                                className="glass-input"
                                placeholder="0.0000"
                                type="text"
                                value={lng}
                                onChange={(e) => setLng(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleUpdateGPS}
                        className="w-full flex items-center justify-center gap-2 py-3.5 glass-card rounded-2xl active:scale-95 transition-all text-sm font-semibold text-secondary-blue"
                    >
                        <span className="material-symbols-outlined !text-[20px]">my_location</span>
                        Atualizar GPS
                    </button>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Observações de Entrega</label>
                        <textarea
                            className="glass-input resize-none"
                            placeholder="Instruções para o entregador..."
                            rows={4}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Foto da Etiqueta</h3>
                    <div className="relative group">
                        <div className="w-full h-48 rounded-[2rem] overflow-hidden border border-white/10 glass-card">
                            {image ? (
                                <img alt="Etiqueta Fotografada" className="w-full h-full object-cover opacity-70" src={image} />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-white/5">
                                    <span className="material-symbols-outlined !text-[48px] text-slate-700">image</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                <label className="flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-sm font-semibold text-white active:scale-95 transition-all cursor-pointer">
                                    <span className="material-symbols-outlined !text-[20px]">photo_camera</span>
                                    Substituir Foto
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => setImage(reader.result as string);
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="fixed bottom-0 left-0 right-0 p-6 pb-12 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/90 to-transparent z-50">
                <button
                    onClick={handleSave}
                    className="w-full bg-gradient-to-r from-primary-blue to-secondary-blue h-16 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-2xl"
                >
                    <span className="text-white font-bold text-base">Salvar Alterações</span>
                    <span className="material-symbols-outlined text-white !text-[20px]">check_circle</span>
                </button>
            </footer>
        </div>
    );
};
