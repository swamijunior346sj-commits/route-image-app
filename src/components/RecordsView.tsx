import { useState, useEffect, useRef } from 'react';
import { getRecords, deleteRecord, updateRecord, getActiveRoute, updateActiveRoute, saveRecord } from '../services/db';
import type { LocationRecord } from '../services/db';
import { Download, Upload, Trash2, Database, Image as ImageIcon, Edit2, LocateFixed, X, Camera, Trash, Search, CheckSquare, Square, CheckCircle2, MapPinned, Plus, Save } from 'lucide-react';
import { exportRecords, importRecords as processImport } from '../services/importExport';
import { extractFeatures } from '../services/imageProcessing';

export const RecordsView = () => {
    const [records, setRecords] = useState<LocationRecord[]>([]);

    // Edit/Create Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<LocationRecord | null>(null);
    const [editName, setEditName] = useState('');
    const [editLat, setEditLat] = useState('');
    const [editLng, setEditLng] = useState('');
    const [editMainImage, setEditMainImage] = useState<string | null>(null);
    const [editMainFeatures, setEditMainFeatures] = useState<number[] | null>(null);
    const [editAdditionalImages, setEditAdditionalImages] = useState<{ id: string, image: string, features: number[] }[]>([]);
    const [editNotes, setEditNotes] = useState('');
    const [editNeighborhood, setEditNeighborhood] = useState('');
    const [editCity, setEditCity] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);
    const [photoActionTarget, setPhotoActionTarget] = useState<'main' | 'extra' | null>(null);

    // Multi-selection and Search
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [isSendingRoute, setIsSendingRoute] = useState(false);

    const displayRecords = searchQuery.length >= 3
        ? records.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
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
        if (confirm('Tem certeza que deseja excluir este registro?')) {
            await deleteRecord(id);
            loadRecords();
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (confirm(`Tem certeza que deseja excluir ${selectedIds.size} registros selecionados?`)) {
            for (const id of Array.from(selectedIds)) {
                await deleteRecord(id);
            }
            setSelectedIds(new Set());
            loadRecords();
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === displayRecords.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(displayRecords.map(r => r.id)));
        }
    };

    const handlePressStart = (id: string) => {
        if (selectedIds.size > 0) return; // Se já está em modo de seleção, o clique normal resolve
        timerRef.current = setTimeout(() => {
            toggleSelection(id);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500); // 500ms long press
    };

    const handlePressEnd = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const handleExport = async () => {
        await exportRecords();
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await processImport(file);
            alert('Registros importados com sucesso!');
            loadRoute();
        }
    };

    // Detail View State
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState<LocationRecord | null>(null);

    const loadRoute = () => loadRecords();

    const openDetail = (record: LocationRecord) => {
        setSelectedDetail(record);
        setIsDetailModalOpen(true);
    };

    const openEdit = (record: LocationRecord, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setIsEditModalOpen(true);
        setEditingRecord(record);
        setEditName(record.name);
        setEditLat(record.lat ? String(record.lat) : '');
        setEditLng(record.lng ? String(record.lng) : '');
        setEditMainImage(record.imageThumbnail);
        setEditMainFeatures(record.featureVector);
        setEditAdditionalImages(record.additionalImages || []);
        setEditNotes(record.notes || '');
        setEditNeighborhood(record.neighborhood || '');
        setEditCity(record.city || '');
    };

    const openCreate = () => {
        setIsEditModalOpen(true);
        setEditingRecord(null);
        setEditName('');
        setEditLat('');
        setEditLng('');
        setEditMainImage(null);
        setEditMainFeatures(null);
        setEditAdditionalImages([]);
        setEditNotes('');
        setEditNeighborhood('');
        setEditCity('');
    };

    const handleSaveEdit = async () => {
        const lat = parseFloat(editLat);
        const lng = parseFloat(editLng);

        if (editingRecord) {
            await updateRecord(editingRecord.id, {
                name: editName,
                lat: isNaN(lat) ? null : lat,
                lng: isNaN(lng) ? null : lng,
                additionalImages: editAdditionalImages,
                imageThumbnail: editMainImage || editingRecord.imageThumbnail,
                featureVector: editMainFeatures || editingRecord.featureVector,
                notes: editNotes.trim(),
                neighborhood: editNeighborhood.trim(),
                city: editCity.trim()
            });
        } else {
            if (!editName.trim()) {
                alert('Por favor, informe um nome para o registro.');
                return;
            }
            const newRec = await saveRecord(
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
            if (editAdditionalImages.length > 0) {
                await updateRecord(newRec.id, { additionalImages: editAdditionalImages });
            }
        }

        setIsEditModalOpen(false);
        setEditingRecord(null);
        setEditNotes('');
        setEditNeighborhood('');
        setEditCity('');
        loadRecords();
    };

    const handleUseCurrentLocationForEdit = () => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setEditLat(String(pos.coords.latitude));
                    setEditLng(String(pos.coords.longitude));
                },
                (err) => {
                    console.error(err);
                    alert('Não foi possível obter sua localização. Verifique as permissões de GPS.');
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        } else {
            alert('Geolocalização não suportada no seu navegador.');
        }
    };

    const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

                setEditAdditionalImages(prev => [...prev, {
                    id: crypto.randomUUID(),
                    image: imageSrc,
                    features
                }]);
            } catch (err) {
                console.error(err);
                alert('Erro ao processar imagem para reconhecimento');
            } finally {
                setIsExtracting(false);
            }
        };
        reader.readAsDataURL(file);
        // Reset input
        e.target.value = '';
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
            } catch (err) {
                console.error(err);
                alert('Erro ao processar a nova foto principal.');
            } finally {
                setIsExtracting(false);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleRemoveAdditionalImage = (idx: string) => {
        setEditAdditionalImages(prev => prev.filter(img => img.id !== idx));
    };

    const handleSendToMap = async () => {
        if (selectedIds.size === 0) return;

        const selectedRecords = records.filter(r => selectedIds.has(r.id) && r.lat !== null && r.lng !== null);

        if (selectedRecords.length === 0) {
            alert("Nenhum dos locais selecionados possui coordenadas de GPS válidas.");
            return;
        }

        const currentRoute = await getActiveRoute();
        const newPoints = selectedRecords.map(r => ({
            id: r.id,
            name: r.name,
            lat: r.lat as number,
            lng: r.lng as number,
            scannedAt: Date.now()
        }));

        setIsSendingRoute(true);

        setTimeout(async () => {
            await updateActiveRoute([...currentRoute, ...newPoints]);
            setIsSendingRoute(false);
            setSelectedIds(new Set());
            // Optional: You could navigate to Map here, but keeping it an alert for now
            // or maybe just a subtle toast.
        }, 3000);
    };

    return (
        <div className="relative w-full h-full bg-black overflow-y-auto pt-safe pb-24">
            <div className="sticky top-0 z-20 w-full p-4 glass-panel border-b-0 flex flex-col gap-2 transition-all">
                {selectedIds.size > 0 ? (
                    <div className="flex justify-between items-center w-full my-1 animate-fade-in">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setSelectedIds(new Set())} className="text-zinc-400 hover:text-white p-2">
                                <X size={20} />
                            </button>
                            <span className="font-bold text-lg text-white">{selectedIds.size} selecionados</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={handleSendToMap} className="text-emerald-400 hover:text-emerald-300 p-2" title="Enviar para Rota do Mapa">
                                <MapPinned size={20} />
                            </button>
                            <button onClick={toggleSelectAll} className="text-blue-400 hover:text-blue-300 flex items-center gap-1 p-2">
                                {selectedIds.size === displayRecords.length ? <CheckSquare size={20} /> : <Square size={20} />}
                                <span className="text-sm font-bold">Todos</span>
                            </button>
                            <button onClick={handleBulkDelete} className="text-red-400 hover:text-red-300 p-2">
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">Registros e Memória</h1>
                        <p className="text-sm text-zinc-300 font-medium">Banco de dados de endereços escaneados ({records.length})</p>
                        <div className="relative mt-3">
                            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Buscar endereço (mín. 3 letras)..."
                                className="w-full bg-zinc-900/80 border border-white/10 rounded-xl py-3 pl-9 pr-4 text-sm text-white focus:border-blue-500/50 focus:outline-none placeholder:text-zinc-500 transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 flex gap-4 my-2">
                <button
                    onClick={handleExport}
                    className="flex-1 glass-panel py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                >
                    <Download size={18} />
                    <span className="font-semibold text-sm">Exportar</span>
                </button>
                <label className="flex-1 glass-panel py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-colors cursor-pointer">
                    <Upload size={18} />
                    <span className="font-semibold text-sm">Importar</span>
                    <input type="file" accept=".json,.csv" className="hidden" onChange={handleImport} />
                </label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 px-6 pb-20">
                {displayRecords.map(record => {
                    const isSelected = selectedIds.has(record.id);
                    const isSelectionMode = selectedIds.size > 0;

                    return (
                        <div
                            key={record.id}
                            className={`relative group overflow-hidden rounded-[2.5rem] bg-zinc-950 border transition-all duration-700 cursor-pointer select-none aspect-square flex flex-col p-6 ${isSelected
                                ? 'border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.2)] scale-[0.98]'
                                : 'border-white/5 hover:border-white/10 shadow-2xl hover:shadow-blue-500/5'
                                }`}
                            onTouchStart={() => handlePressStart(record.id)}
                            onTouchEnd={handlePressEnd}
                            onTouchMove={handlePressEnd}
                            onMouseDown={() => handlePressStart(record.id)}
                            onMouseUp={handlePressEnd}
                            onMouseLeave={handlePressEnd}
                            onClick={() => {
                                if (isSelectionMode) toggleSelection(record.id);
                                else openDetail(record);
                            }}
                        >
                            {/* Premium Decorative Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-indigo-600/5 opacity-50" />
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-[80px] group-hover:bg-blue-500/20 transition-colors duration-700" />

                            {/* Selection Badge - Luxury Style */}
                            {isSelectionMode && (
                                <div className="absolute top-4 right-4 z-20 animate-in zoom-in duration-300">
                                    <div className={`p-1 rounded-full backdrop-blur-xl border ${isSelected
                                        ? 'bg-blue-500 border-blue-400'
                                        : 'bg-white/5 border-white/10 text-transparent'
                                        }`}>
                                        <CheckCircle2 size={20} className={isSelected ? "text-white" : "opacity-0"} />
                                    </div>
                                </div>
                            )}

                            {/* Actions - Top Left */}
                            {!isSelectionMode && (
                                <div className="absolute top-4 right-4 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-500">
                                    <button
                                        onClick={(e) => openEdit(record, e)}
                                        className="p-2 rounded-xl bg-white/5 border border-white/5 text-zinc-500 hover:text-white hover:bg-white/10 transition-all"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(record.id, e)}
                                        className="p-2 rounded-xl bg-red-500/5 border border-red-500/5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Content Layout */}
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="mb-4">
                                    <div className="w-10 h-10 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-all duration-500">
                                        <MapPinned size={18} className="text-blue-500/70" />
                                    </div>
                                    <h3 className="font-black text-white text-base md:text-lg tracking-tighter line-clamp-2 uppercase italic leading-tight group-hover:text-blue-400 transition-colors">
                                        {record.name}
                                    </h3>
                                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mt-2">
                                        {[record.neighborhood, record.city].filter(Boolean).join(' • ') || 'Local Privado'}
                                    </p>
                                </div>

                                <div className="mt-auto space-y-3">
                                    <div className="flex gap-2">
                                        <div className="bg-white/[0.02] px-3 py-1.5 rounded-xl border border-white/5 flex items-center gap-2">
                                            <span className="text-[8px] font-black text-blue-500/50">LT</span>
                                            <span className="text-[10px] font-mono text-zinc-400 group-hover:text-zinc-200">{record.lat ? record.lat.toFixed(4) : '--'}</span>
                                        </div>
                                        <div className="bg-white/[0.02] px-3 py-1.5 rounded-xl border border-white/5 flex items-center gap-2">
                                            <span className="text-[8px] font-black text-blue-500/50">LG</span>
                                            <span className="text-[10px] font-mono text-zinc-400 group-hover:text-zinc-200">{record.lng ? record.lng.toFixed(4) : '--'}</span>
                                        </div>
                                    </div>

                                    <div className="h-0.5 w-12 bg-blue-500/20 rounded-full group-hover:w-full transition-all duration-700" />
                                </div>
                            </div>
                        </div>
                    );
                })}

                {displayRecords.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                        <Database size={48} className="mb-4 opacity-50" />
                        <p>{records.length > 0 ? 'Nenhum endereço encontrado.' : 'Nenhum endereço registrado.'}</p>
                    </div>
                )}
            </div>

            <button
                onClick={openCreate}
                className="fixed bottom-[100px] right-6 z-40 bg-blue-600 text-white p-4 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)] hover:bg-blue-500 transition-colors animate-fade-in"
                title="Adicionar Endereço Manualmente"
            >
                <Plus size={24} />
            </button>

            {/* Edit/Create Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="w-full max-w-sm glass-panel p-6 rounded-2xl border border-white/10 flex flex-col gap-4 shadow-xl relative overflow-hidden">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-bold">{editingRecord ? 'Editar Endereço' : 'Novo Endereço'}</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-zinc-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex flex-col items-center justify-center gap-2 mb-2">
                            <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-white/20 group">
                                {editMainImage ? (
                                    <img src={editMainImage} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><ImageIcon className="text-zinc-600" /></div>
                                )}
                                <button type="button" onClick={() => setPhotoActionTarget('main')} disabled={isExtracting} className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition">
                                    <Camera size={24} className="text-white" />
                                    <span className="text-[10px] font-bold mt-1 max-w-[80px] text-center">Alterar Foto Principal</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-zinc-400">Nome da Imagem/Local</label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full bg-zinc-900/50 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none"
                            />
                        </div>

                        <div className="flex gap-4">
                            <div className="flex flex-col gap-2 flex-1">
                                <label className="text-xs text-zinc-400">Bairro (Opcional)</label>
                                <input
                                    type="text"
                                    value={editNeighborhood}
                                    onChange={(e) => setEditNeighborhood(e.target.value)}
                                    placeholder="Ex: Centro"
                                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none text-xs"
                                />
                            </div>
                            <div className="flex flex-col gap-2 flex-1">
                                <label className="text-xs text-zinc-400">Cidade (Opcional)</label>
                                <input
                                    type="text"
                                    value={editCity}
                                    onChange={(e) => setEditCity(e.target.value)}
                                    placeholder="Ex: São Paulo"
                                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none text-xs"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-zinc-400">Notas/Referência (Opcional)</label>
                            <textarea
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="Ponto de referência, cor do portão..."
                                className="w-full bg-zinc-900/50 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none text-xs h-16 resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-1">
                            <div
                                className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 cursor-pointer active:scale-95 transition-all hover:bg-blue-500/10 group relative overflow-hidden"
                            >
                                <div
                                    className="absolute inset-0 z-0"
                                    onClick={() => {
                                        if (navigator.vibrate) navigator.vibrate(20);
                                        if ('geolocation' in navigator) {
                                            handleUseCurrentLocationForEdit();
                                        }
                                    }}
                                />
                                <div className="relative z-10 flex items-center justify-between mb-1 pointer-events-none">
                                    <label className="text-[10px] font-black text-blue-500/60 uppercase tracking-tighter">Latitude</label>
                                    <LocateFixed size={12} className="text-blue-500 opacity-40 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <input
                                    type="text"
                                    value={editLat}
                                    onChange={(e) => setEditLat(e.target.value)}
                                    className="relative z-20 w-full bg-transparent text-sm font-mono text-white tracking-widest focus:outline-none border-b border-transparent focus:border-blue-500/30"
                                    placeholder="---.------"
                                />
                            </div>

                            <div
                                className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 cursor-pointer active:scale-95 transition-all hover:bg-indigo-500/10 group relative overflow-hidden"
                            >
                                <div
                                    className="absolute inset-0 z-0"
                                    onClick={() => {
                                        if (navigator.vibrate) navigator.vibrate(20);
                                        if ('geolocation' in navigator) {
                                            handleUseCurrentLocationForEdit();
                                        }
                                    }}
                                />
                                <div className="relative z-10 flex items-center justify-between mb-1 pointer-events-none">
                                    <label className="text-[10px] font-black text-indigo-500/60 uppercase tracking-tighter">Longitude</label>
                                    <LocateFixed size={12} className="text-indigo-500 opacity-40 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <input
                                    type="text"
                                    value={editLng}
                                    onChange={(e) => setEditLng(e.target.value)}
                                    className="relative z-20 w-full bg-transparent text-sm font-mono text-white tracking-widest focus:outline-none border-b border-transparent focus:border-indigo-500/30"
                                    placeholder="---.------"
                                />
                            </div>
                        </div>

                        <button
                            onClick={async () => {
                                if (!editLat || !editLng) {
                                    alert('Capture ou digite as coordenadas primeiro.');
                                    return;
                                }
                                if (navigator.vibrate) navigator.vibrate(40);
                                setIsExtracting(true);
                                try {
                                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${editLat}&lon=${editLng}`);
                                    const data = await res.json();
                                    if (data && data.address) {
                                        const addr = data.address;
                                        const street = addr.road || addr.pedestrian || addr.suburb || '';
                                        const houseNumber = addr.house_number ? `, ${addr.house_number}` : '';
                                        setEditName(`${street}${houseNumber}`);
                                        setEditNeighborhood(addr.suburb || addr.neighbourhood || addr.city_district || '');
                                        setEditCity(addr.city || addr.town || addr.village || '');
                                    } else {
                                        alert('Cidade/Endereço não identificado para estas coordenadas.');
                                    }
                                } catch (err) {
                                    console.error(err);
                                    alert('Erro ao buscar endereço.');
                                } finally {
                                    setIsExtracting(false);
                                }
                            }}
                            disabled={isExtracting}
                            className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            <Database size={14} className={isExtracting ? 'animate-spin' : ''} />
                            SINCRONIZAR ENDEREÇO VIA GPS
                        </button>

                        <div className="flex flex-col gap-2 border-t border-white/10 pt-4 mt-2">
                            <label className="text-xs text-zinc-400 font-bold">Imagens Auxiliares de Treinamento</label>
                            <p className="text-[10px] text-zinc-500 leading-tight">Adicione mais ângulos ou tire novas fotos para o Escaneador reconhecer melhor este endereço.</p>

                            <div className="flex flex-wrap gap-2 mt-2">
                                <button type="button" onClick={() => setPhotoActionTarget('extra')} disabled={isExtracting} className="w-16 h-16 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition opacity-70 hover:opacity-100">
                                    <Camera size={20} className="text-white mb-1" />
                                    <span className="text-[8px] font-bold text-center leading-none">Nova<br />Foto</span>
                                </button>

                                {isExtracting && (
                                    <div className="w-16 h-16 rounded-xl border border-white/10 bg-zinc-800 flex items-center justify-center animate-pulse">
                                        <span className="text-[10px] text-blue-400">Lendo..</span>
                                    </div>
                                )}

                                {editAdditionalImages.map((img) => (
                                    <div key={img.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 group">
                                        <img src={img.image} className="w-full h-full object-cover" />
                                        <button onClick={() => handleRemoveAdditionalImage(img.id)} className="absolute inset-0 bg-red-500/80 items-center justify-center hidden group-hover:flex transition">
                                            <Trash size={16} className="text-white" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleSaveEdit}
                            className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest py-5 rounded-3xl shadow-[0_10px_30px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-3 text-[10px]"
                            disabled={isExtracting}
                        >
                            <Save size={18} />
                            {editingRecord ? 'CONFIRMAR ALTERAÇÕES' : 'CRIAR NOVO REGISTRO'}
                        </button>

                        {photoActionTarget && (
                            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                                <div className="w-full bg-zinc-900 border border-white/10 p-5 rounded-2xl flex flex-col gap-3 shadow-2xl animate-slide-up">
                                    <h4 className="text-center font-bold text-sm text-zinc-300 mb-2">Adicionar Mídia</h4>

                                    <label className="w-full glow-btn py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer font-bold">
                                        <Camera size={18} />
                                        <span>Tirar Nova Foto</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={photoActionTarget === 'main' ? handleReplaceMainImage : handleAddImage}
                                        />
                                    </label>

                                    <label className="w-full glass-panel py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer text-blue-400 hover:bg-blue-500/10 font-bold transition">
                                        <ImageIcon size={18} />
                                        <span>Importar Arquivo</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={photoActionTarget === 'main' ? handleReplaceMainImage : handleAddImage}
                                        />
                                    </label>

                                    <button
                                        type="button"
                                        onClick={() => setPhotoActionTarget(null)}
                                        className="w-full py-3 rounded-xl font-bold mt-2 text-zinc-400 hover:bg-white/5 transition"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Detail View Modal */}
            {isDetailModalOpen && selectedDetail && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-fade-in">
                    <div className="w-full max-w-sm glass-panel overflow-hidden rounded-[3rem] border border-white/10 shadow-2xl animate-scale-up">
                        {/* Header Image */}
                        <div className="h-48 relative">
                            {selectedDetail.imageThumbnail ? (
                                <img src={selectedDetail.imageThumbnail} className="w-full h-full object-cover" alt="Thumb" />
                            ) : (
                                <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><Database size={48} className="text-zinc-700" /></div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-black/20" />
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-8 -mt-10 relative z-10 bg-zinc-900 rounded-t-[3rem] border-t border-white/5">
                            <div className="flex flex-col gap-6">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Endereço Confirmado</p>
                                    <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">{selectedDetail.name}</h2>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl">
                                        <p className="text-[9px] font-bold text-zinc-500 uppercase mb-1">Bairro</p>
                                        <p className="text-sm font-bold text-zinc-200">{selectedDetail.neighborhood || 'N/A'}</p>
                                    </div>
                                    <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl">
                                        <p className="text-[9px] font-bold text-zinc-500 uppercase mb-1">Cidade</p>
                                        <p className="text-sm font-bold text-zinc-200">{selectedDetail.city || 'N/A'}</p>
                                    </div>
                                </div>

                                <div className="bg-blue-500/5 border border-blue-500/10 p-5 rounded-[2rem]">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <LocateFixed size={12} /> Coordenadas GPS
                                    </p>
                                    <div className="flex justify-between items-center font-mono">
                                        <div>
                                            <span className="text-[9px] text-zinc-500 block">LATITUDE</span>
                                            <span className="text-white text-sm">{selectedDetail.lat?.toFixed(6) || '---'}</span>
                                        </div>
                                        <div className="w-px h-8 bg-white/10" />
                                        <div className="text-right">
                                            <span className="text-[9px] text-zinc-500 block">LONGITUDE</span>
                                            <span className="text-white text-sm">{selectedDetail.lng?.toFixed(6) || '---'}</span>
                                        </div>
                                    </div>
                                </div>

                                {selectedDetail.notes && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Notas e Referências</p>
                                        <p className="text-sm text-zinc-400 leading-relaxed italic">"{selectedDetail.notes}"</p>
                                    </div>
                                )}

                                <button
                                    onClick={() => setIsDetailModalOpen(false)}
                                    className="w-full bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all mt-2"
                                >
                                    Fechar Detalhes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SENDING ROUTE ANIMATION OVERLAY */}
            {isSendingRoute && (
                <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in">
                    <div className="flex flex-col items-center gap-6 saturate-150">
                        <div className="relative w-32 h-32 flex items-center justify-center">
                            {/* Outer pulsing ring */}
                            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/30 animate-ping"></div>
                            {/* Inner spinning gradient */}
                            <div className="absolute inset-2 rounded-full border-4 border-t-emerald-400 border-r-blue-500 border-b-transparent border-l-transparent animate-spin"></div>
                            {/* Center icon */}
                            <MapPinned size={48} className="text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-blue-500 animate-pulse">Enviando a Rota...</h2>
                            <p className="text-emerald-200/80 mt-2 font-medium">Processando {selectedIds.size} endereço{selectedIds.size > 1 ? 's' : ''} no mapa</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
