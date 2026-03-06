import { useState, useRef, useEffect } from 'react';
import type { RoutePoint, LocationRecord } from '../services/db';
import { extractFeatures } from '../services/imageProcessing';

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
    const [additionalImages, setAdditionalImages] = useState<{ id: string; image: string; features: number[] }[]>((item as LocationRecord).additionalImages || []);

    // UI State
    const [showCockpit, setShowCockpit] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cockpitRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (cockpitRef.current && !cockpitRef.current.contains(event.target as Node)) {
                setShowCockpit(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const processNewCapture = async (file: File) => {
        setIsCapturing(true);
        setShowCockpit(false);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;

                // AI Feature Extraction
                const img = new Image();
                img.src = base64;
                await img.decode();

                const features = await extractFeatures(img);

                // Update memory without replacing main photo
                const newImg = {
                    id: crypto.randomUUID(),
                    image: base64,
                    features
                };

                setAdditionalImages(prev => [...prev, newImg]);
                if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Erro no processamento IA:", error);
        } finally {
            setIsCapturing(false);
        }
    };

    const handleSave = () => {
        onSave({
            name,
            neighborhood,
            city,
            lat: lat ? parseFloat(lat) : null,
            lng: lng ? parseFloat(lng) : null,
            notes,
            ...(image ? { imageThumbnail: image } : {}),
            additionalImages
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
                    <div className="flex justify-between items-end px-1">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Foto & Memória IA</h3>
                        <span className="text-[9px] font-black text-primary uppercase tracking-tighter">
                            {additionalImages.length + (image ? 1 : 0)} capturas em cache
                        </span>
                    </div>

                    <div className="relative group">
                        <div className="w-full h-56 rounded-[2.5rem] overflow-hidden border border-white/10 glass-card relative bg-slate-900/40">
                            {image ? (
                                <img alt="Etiqueta Fotografada" className="w-full h-full object-cover opacity-60 grayscale-[0.3]" src={image} />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center">
                                    <span className="material-symbols-outlined !text-[48px] text-slate-700 animate-pulse">image_not_supported</span>
                                    <p className="text-[10px] font-bold text-slate-600 uppercase mt-2 tracking-widest">Sem imagem base</p>
                                </div>
                            )}

                            {/* Floating Stats Badge */}
                            <div className="absolute top-4 left-4 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                                <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                <span className="text-[9px] font-black text-white/70 uppercase">IA Ativa</span>
                            </div>

                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end justify-center pb-6">
                                <button
                                    onClick={() => setShowCockpit(!showCockpit)}
                                    className="size-16 bg-primary shadow-[0_0_30px_rgba(59,130,246,0.6)] rounded-full flex items-center justify-center active:scale-95 transition-all z-20 border border-white/20"
                                >
                                    <span className="material-symbols-outlined !text-[28px] text-white">photo_camera</span>
                                </button>
                            </div>

                            {/* Cockpit Overlay Menu */}
                            {showCockpit && (
                                <div
                                    ref={cockpitRef}
                                    className="absolute inset-0 bg-[#0F172A]/95 backdrop-blur-2xl z-30 animate-fade-in flex flex-col p-4 overflow-y-auto no-scrollbar"
                                >
                                    <div className="flex justify-between items-center mb-4 px-2">
                                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Sistemas Cockpit</span>
                                        <button onClick={() => setShowCockpit(false)}>
                                            <span className="material-symbols-outlined text-slate-500 !text-[18px]">close</span>
                                        </button>
                                    </div>

                                    <div className="space-y-2.5">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full p-4 bg-white/5 border border-white/10 rounded-[1.5rem] flex items-center justify-between group active:bg-primary/20 transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                                                    <span className="material-symbols-outlined !text-[20px]">add_a_photo</span>
                                                </div>
                                                <div className="text-left leading-tight">
                                                    <p className="text-xs font-black text-white italic uppercase">Nova Captura</p>
                                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Treinar IA</p>
                                                </div>
                                            </div>
                                            <span className="material-symbols-outlined text-slate-600 !text-[18px]">chevron_right</span>
                                        </button>

                                        <button className="w-full p-4 bg-white/5 border border-white/10 rounded-[1.5rem] flex items-center justify-between active:bg-white/10 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                                                    <span className="material-symbols-outlined !text-[20px]">memory</span>
                                                </div>
                                                <div className="text-left leading-tight">
                                                    <p className="text-xs font-black text-white italic uppercase">Memória IA</p>
                                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{additionalImages.length} itens</p>
                                                </div>
                                            </div>
                                            <span className="material-symbols-outlined text-slate-600 !text-[18px]">chevron_right</span>
                                        </button>

                                        <button
                                            onClick={() => { if (confirm("Limpar toda a memória IA deste endereço?")) { setImage(''); setAdditionalImages([]); setShowCockpit(false); } }}
                                            className="w-full p-4 bg-red-500/10 border border-red-500/20 rounded-[1.5rem] flex items-center justify-between active:bg-red-500/30 transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-500">
                                                    <span className="material-symbols-outlined !text-[20px]">delete_sweep</span>
                                                </div>
                                                <div className="text-left leading-tight">
                                                    <p className="text-xs font-black text-red-500 italic uppercase">Excluir</p>
                                                    <p className="text-[9px] text-red-500/50 font-bold uppercase tracking-widest">Limpar cache</p>
                                                </div>
                                            </div>
                                        </button>
                                    </div>

                                    <div className="mt-4 pb-2 text-center">
                                        <p className="text-[8px] font-bold text-slate-600 uppercase tracking-[0.3em]">Protocolo v.2.4 Active</p>
                                    </div>
                                </div>
                            )}

                            {/* Processing Overlay */}
                            {isCapturing && (
                                <div className="absolute inset-0 bg-bg-start/90 backdrop-blur-3xl z-40 flex flex-col items-center justify-center space-y-4">
                                    <div className="size-20 rounded-full border border-primary/30 flex items-center justify-center relative">
                                        <div className="absolute inset-0 border-t-2 border-primary rounded-full animate-spin"></div>
                                        <span className="material-symbols-outlined text-primary animate-pulse !text-[32px]">neurology</span>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-black text-white italic uppercase tracking-tighter">Processamento IA</p>
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Extraindo vetores de OCR</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) processNewCapture(file);
                            }}
                        />
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
