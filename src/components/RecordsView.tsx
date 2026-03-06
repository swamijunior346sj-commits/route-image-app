import { useState, useEffect } from 'react';
import { getRecords, deleteRecord, updateRecord, getActiveRoute, updateActiveRoute, saveRecord } from '../services/db';
import type { LocationRecord } from '../services/db';
import {
    X,
    Search,
    Plus,
    MoreVertical,
    ChevronLeft,
    MapPin,
    Navigation,
    Trash2,
    Edit2,
    LocateFixed,
    ClipboardList,
    CheckCircle2,
    Database,
    Loader2,
    Image as ImageIcon,
    Camera
} from 'lucide-react';
import { analyzeAddressImage } from '../services/geminiService';
import { extractFeatures } from '../services/imageProcessing';
import { DeliveryDetailView } from './DeliveryDetailView';

interface RecordsViewProps {
    onNavigateToMap?: () => void;
    onBack?: () => void;
}

export const RecordsView = ({ onNavigateToMap, onBack }: RecordsViewProps) => {
    const [records, setRecords] = useState<LocationRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingRecord, setEditingRecord] = useState<LocationRecord | null>(null);
    const [selectedDetail, setSelectedDetail] = useState<LocationRecord | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);

    // Edit States
    const [editName, setEditName] = useState('');
    const [editLat, setEditLat] = useState('');
    const [editLng, setEditLng] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editNeighborhood, setEditNeighborhood] = useState('');
    const [editCity, setEditCity] = useState('');
    const [editMainImage, setEditMainImage] = useState<string | null>(null);
    const [editAdditionalImages, setEditAdditionalImages] = useState<{ id: string, image: string, features: number[] }[]>([]);
    const [editMainFeatures, setEditMainFeatures] = useState<number[] | null>(null);
    const [photoActionTarget, setPhotoActionTarget] = useState<'main' | 'extra' | null>(null);

    const displayRecords = searchQuery.length >= 2
        ? records.filter(r =>
            r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (r.neighborhood && r.neighborhood.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        : records;

    const loadRecords = async () => {
        const data = await getRecords();
        setRecords(data);
    };

    useEffect(() => {
        loadRecords();
    }, []);

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (confirm('Tem certeza que deseja excluir este endereço?')) {
            await deleteRecord(id);
            loadRecords();
        }
    };

    const handleSendToMap = async (record: LocationRecord, e: React.MouseEvent) => {
        e.stopPropagation();
        const currentRoute = await getActiveRoute();
        const newPoint = {
            id: record.id,
            name: record.name,
            lat: record.lat,
            lng: record.lng,
            scannedAt: Date.now(),
            notes: record.notes,
            neighborhood: record.neighborhood,
            city: record.city
        };

        const finalRoute = [...currentRoute.filter(p => p.id !== record.id), newPoint];
        try {
            await updateActiveRoute(finalRoute);
            if (onNavigateToMap) onNavigateToMap();
        } catch (err) {
            console.error("Erro ao enviar rota:", err);
            alert("Houve um problema ao sincronizar. Verifique sua conexão.");
        }
    };

    const openEdit = (record: LocationRecord, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setEditingRecord(record);
        setEditName(record.name);
        setEditLat(record.lat ? String(record.lat) : '');
        setEditLng(record.lng ? String(record.lng) : '');
        setEditNotes(record.notes || '');
        setEditNeighborhood(record.neighborhood || '');
        setEditCity(record.city || '');
        setEditMainImage(record.imageThumbnail);
        setEditAdditionalImages(record.additionalImages || []);
        setEditMainFeatures(record.featureVector);
    };

    const openCreate = () => {
        setEditingRecord({
            id: 'new',
            name: '',
            lat: null,
            lng: null,
            imageThumbnail: '',
            featureVector: [],
            additionalImages: [],
            notes: '',
            neighborhood: '',
            city: '',
            createdAt: Date.now(),
        });
        setEditName('');
        setEditLat('');
        setEditLng('');
        setEditNotes('');
        setEditNeighborhood('');
        setEditCity('');
        setEditMainImage(null);
        setEditAdditionalImages([]);
        setEditMainFeatures(null);
    };

    const handleSaveEdit = async () => {
        const lat = parseFloat(editLat);
        const lng = parseFloat(editLng);

        if (editingRecord && editingRecord.id !== 'new') {
            await updateRecord(editingRecord.id, {
                name: editName,
                lat: isNaN(lat) ? null : lat,
                lng: isNaN(lng) ? null : lng,
                notes: editNotes.trim(),
                neighborhood: editNeighborhood.trim(),
                city: editCity.trim(),
                imageThumbnail: editMainImage || editingRecord.imageThumbnail,
                additionalImages: editAdditionalImages,
                featureVector: editMainFeatures || editingRecord.featureVector
            });
        } else {
            if (!editName.trim()) return alert('Nome é obrigatório.');
            await saveRecord(
                editName,
                isNaN(lat) ? null : lat,
                isNaN(lng) ? null : lng,
                editMainImage || '',
                editMainFeatures || [],
                {
                    notes: editNotes.trim(),
                    neighborhood: editNeighborhood.trim(),
                    city: editCity.trim()
                }
            );
        }
        setEditingRecord(null);
        loadRecords();
    };

    const handleReplaceMainImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhotoActionTarget(null);
        const file = e.target.files?.[0];
        if (!file) return;
        setIsExtracting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const imageSrc = event.target?.result as string;
            if (!imageSrc) { setIsExtracting(false); return; }
            try {
                const img = new Image();
                img.src = imageSrc;
                await new Promise(r => { img.onload = r; });
                const features = await extractFeatures(img);
                setEditMainImage(imageSrc);
                setEditMainFeatures(features);
                const aiReading = await analyzeAddressImage(imageSrc);
                if (aiReading) {
                    if (aiReading.address) setEditName(aiReading.address);
                    if (aiReading.neighborhood) setEditNeighborhood(aiReading.neighborhood);
                    if (aiReading.city) setEditCity(aiReading.city);
                    if (aiReading.notes) setEditNotes(aiReading.notes);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsExtracting(false);
            }
        };
        reader.readAsDataURL(file);
    };

    if (!records) return <div className="h-full bg-[#0F172A] flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;

    return (
        <div className="relative w-full h-full bg-gradient-to-b from-[#0F172A] to-[#1E293B] overflow-hidden">
            {/* Header HUD */}
            <header className="fixed top-0 left-0 right-0 z-50 px-6 pt-14 pb-6 flex items-center justify-between bg-[#0F172A]/40 backdrop-blur-md border-b border-white/5">
                <button
                    onClick={onBack}
                    className="flex items-center justify-center size-10 rounded-full glass-effect-premium active:scale-95 transition-all text-white/90"
                >
                    <ChevronLeft size={24} />
                </button>
                <div className="text-center">
                    <h1 className="text-[10px] font-black uppercase letter-spacing-premium text-slate-400 mb-0.5">SISTEMA</h1>
                    <p className="text-lg font-bold tracking-tight text-white/90">Meus Endereços</p>
                </div>
                <button className="flex items-center justify-center size-10 rounded-full glass-effect-premium active:scale-95 transition-all text-white/90">
                    <MoreVertical size={24} />
                </button>
            </header>

            {/* Main Content Area */}
            <main className="h-full overflow-y-auto custom-scrollbar pt-36 pb-32 px-6">
                {/* Search Bar */}
                <div className="mb-8">
                    <div className="glass-effect-premium h-14 rounded-2xl flex items-center px-4 gap-3">
                        <Search className="text-slate-500" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por endereço ou nome..."
                            className="bg-transparent border-none text-sm text-white/90 placeholder:text-slate-500 placeholder:font-light focus:ring-0 w-full outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Listing */}
                <div className="space-y-4">
                    {displayRecords.map(record => (
                        <div
                            key={record.id}
                            onClick={() => setSelectedDetail(record)}
                            className="glass-effect-premium rounded-[2.5rem] p-5 active:scale-[0.98] transition-all cursor-pointer group"
                        >
                            <div className="flex gap-4 items-start mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`size-2 rounded-full shadow-lg ${record.lat ? 'bg-primary shadow-primary/50' : 'bg-orange-500 shadow-orange-500/50'}`}></span>
                                        <h3 className="text-base font-bold text-white/90 line-clamp-1 italic">{record.name}</h3>
                                    </div>
                                    <p className="text-[14px] text-slate-400 leading-snug mb-3">
                                        {record.neighborhood || 'Setor ñ identificado'}<br />
                                        {record.city || 'São Paulo'}, SP
                                    </p>
                                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                                        <MapPin size={14} className="text-primary" />
                                        {record.lat ? `${record.lat.toFixed(4)}, ${record.lng?.toFixed(4)}` : 'Coords Pendentes'}
                                    </div>
                                </div>
                                <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10 shrink-0 bg-slate-900 flex items-center justify-center">
                                    {record.imageThumbnail ? (
                                        <img src={record.imageThumbnail} alt="Thumbnail" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                    ) : (
                                        <ImageIcon size={32} className="text-slate-700" />
                                    )}
                                </div>
                            </div>

                            {record.notes && (
                                <div className="pt-4 border-t border-white/5 flex items-center gap-2">
                                    <ClipboardList size={16} className="text-slate-500" />
                                    <p className="text-[12px] text-slate-500 italic truncate">{record.notes}</p>
                                </div>
                            )}

                            {/* Hover/Active Actions */}
                            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                                <div className="flex gap-2">
                                    <button
                                        onClick={(e) => openEdit(record, e)}
                                        className="size-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 active:bg-white/10"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(record.id, e)}
                                        className="size-10 rounded-xl bg-red-500/10 border border-red-500/10 flex items-center justify-center text-red-500 active:bg-red-500/20"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <button
                                    onClick={(e) => handleSendToMap(record, e)}
                                    className="px-4 h-10 rounded-xl bg-primary text-white font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20"
                                >
                                    <Navigation size={14} />
                                    Enviar
                                </button>
                            </div>
                        </div>
                    ))}

                    {displayRecords.length === 0 && (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-600 opacity-40">
                            <Database size={64} className="mb-4" />
                            <p className="font-bold uppercase tracking-widest text-sm">Nenhum registro</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Fab Create */}
            <button
                onClick={openCreate}
                className="fixed bottom-10 right-6 size-16 fab-premium text-white rounded-2xl flex items-center justify-center active:scale-90 transition-all z-50"
            >
                <Plus size={36} />
            </button>

            {/* Modals - Simplified for the new design flow */}
            {editingRecord && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setEditingRecord(null)}></div>
                    <div className="w-full max-w-xl bg-[#0F172A] border border-white/10 rounded-[2.5rem] shadow-2xl relative z-10 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                        <div className="p-8 overflow-y-auto custom-scrollbar">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-black italic uppercase text-white tracking-widest">Modificar Registro</h3>
                                <button onClick={() => setEditingRecord(null)} className="p-2 bg-white/5 rounded-full text-slate-400 hover:text-white"><X size={20} /></button>
                            </div>

                            <div className="space-y-4">
                                <div className="glass-effect-premium p-4 rounded-2xl border border-white/5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Endereço Principal</label>
                                    <input
                                        className="w-full bg-transparent text-white font-bold outline-none"
                                        placeholder="Nome do local..."
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="glass-effect-premium p-4 rounded-2xl border border-white/5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Bairro</label>
                                        <input
                                            className="w-full bg-transparent text-white outline-none text-sm"
                                            placeholder="Bairro..."
                                            value={editNeighborhood}
                                            onChange={(e) => setEditNeighborhood(e.target.value)}
                                        />
                                    </div>
                                    <div className="glass-effect-premium p-4 rounded-2xl border border-white/5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Cidade</label>
                                        <input
                                            className="w-full bg-transparent text-white outline-none text-sm"
                                            placeholder="Cidade..."
                                            value={editCity}
                                            onChange={(e) => setEditCity(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="glass-effect-premium p-4 rounded-2xl border border-white/5 relative">
                                        <label className="text-[10px] font-black text-primary uppercase tracking-widest block mb-2">Latitude</label>
                                        <input
                                            className="w-full bg-transparent text-white font-mono text-xs outline-none"
                                            value={editLat}
                                            onChange={(e) => setEditLat(e.target.value)}
                                        />
                                        <LocateFixed size={14} className="absolute top-4 right-4 text-primary opacity-40" />
                                    </div>
                                    <div className="glass-effect-premium p-4 rounded-2xl border border-white/5 relative">
                                        <label className="text-[10px] font-black text-primary uppercase tracking-widest block mb-2">Longitude</label>
                                        <input
                                            className="w-full bg-transparent text-white font-mono text-xs outline-none"
                                            value={editLng}
                                            onChange={(e) => setEditLng(e.target.value)}
                                        />
                                        <LocateFixed size={14} className="absolute top-4 right-4 text-primary opacity-40" />
                                    </div>
                                </div>

                                <div className="relative group rounded-3xl overflow-hidden aspect-video border border-white/10 bg-black/20 flex items-center justify-center">
                                    {editMainImage ? (
                                        <img src={editMainImage} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center">
                                            <ImageIcon size={48} className="text-slate-800 mx-auto mb-2" />
                                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Sem Imagem</p>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setPhotoActionTarget('main')}
                                        className="absolute bottom-4 right-4 size-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl active:scale-90 transition-all"
                                    >
                                        <Camera size={20} />
                                    </button>
                                </div>

                                <textarea
                                    className="w-full glass-effect-premium rounded-2xl p-4 text-sm text-slate-300 italic h-24 resize-none outline-none focus:border-primary/50"
                                    placeholder="Notas adicionais..."
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                />

                                <button
                                    onClick={handleSaveEdit}
                                    disabled={isExtracting}
                                    className="w-full bg-primary h-14 rounded-2xl text-white font-black uppercase tracking-widest text-[13px] shadow-xl shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    {isExtracting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                    Salvar Registro
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Action Sub-modal */}
            {photoActionTarget && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-8 animate-fade-in">
                    <div className="w-full max-w-sm flex flex-col gap-5">
                        <div className="text-center mb-6">
                            <h4 className="text-3xl font-black italic uppercase tracking-tighter text-white">Capturar Mídia</h4>
                            <p className="text-primary/60 font-black uppercase tracking-widest text-[10px] mt-2">Selecione a fonte de entrada</p>
                        </div>
                        <label className="w-full bg-primary text-white py-6 rounded-[2rem] flex items-center justify-center gap-4 cursor-pointer font-black uppercase tracking-widest text-xs shadow-2xl active:scale-95">
                            <Camera size={24} />
                            <span>Tirar Foto</span>
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReplaceMainImage} />
                        </label>
                        <label className="w-full bg-slate-900 border border-white/10 text-white py-6 rounded-[2rem] flex items-center justify-center gap-4 cursor-pointer font-black uppercase tracking-widest text-xs active:scale-95">
                            <ImageIcon size={24} className="text-primary" />
                            <span>Abrir Galeria</span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleReplaceMainImage} />
                        </label>
                        <button onClick={() => setPhotoActionTarget(null)} className="w-full py-4 text-slate-500 font-black uppercase tracking-widest text-[10px]">Cancelar</button>
                    </div>
                </div>
            )}

            {/* Detail Pop-up */}
            {selectedDetail && (
                <DeliveryDetailView
                    record={selectedDetail}
                    onClose={() => setSelectedDetail(null)}
                    onConfirm={() => {
                        handleSendToMap(selectedDetail, {} as any);
                        setSelectedDetail(null);
                    }}
                />
            )}
        </div>
    );
};
