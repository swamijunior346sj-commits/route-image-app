import { useState, useEffect, useRef } from 'react';
import { getRecords, deleteRecord, updateRecord, getActiveRoute, updateActiveRoute, saveRecord } from '../services/db';
import type { LocationRecord } from '../services/db';
import { Download, Upload, Trash2, Database, Image as ImageIcon, Edit2, LocateFixed, X, Camera, Trash, Search, CheckSquare, Square, CheckCircle2, MapPinned, Plus } from 'lucide-react';
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
    const timerRef = useRef<NodeJS.Timeout | null>(null);
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

    const loadRoute = () => loadRecords();

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

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 px-4">
                {displayRecords.map(record => {
                    const isSelected = selectedIds.has(record.id);
                    const isSelectionMode = selectedIds.size > 0;

                    return (
                        <div
                            key={record.id}
                            className={`relative glass-panel aspect-square rounded-[2rem] overflow-hidden flex flex-col p-3 transition-all cursor-pointer select-none group ${isSelected ? 'ring-4 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'hover:ring-2 ring-white/20'}`}
                            onTouchStart={() => handlePressStart(record.id)}
                            onTouchEnd={handlePressEnd}
                            onTouchMove={handlePressEnd}
                            onMouseDown={() => handlePressStart(record.id)}
                            onMouseUp={handlePressEnd}
                            onMouseLeave={handlePressEnd}
                            onClick={() => {
                                if (isSelectionMode) toggleSelection(record.id);
                            }}
                        >
                            {/* Background Cover */}
                            <div className="absolute inset-0 z-0">
                                {record.imageThumbnail ? (
                                    <>
                                        <img src={record.imageThumbnail} className="w-full h-full object-cover pointer-events-none opacity-40 group-hover:scale-110 transition-transform duration-500" alt="Thumb" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10"></div>
                                    </>
                                ) : (
                                    <div className="w-full h-full bg-zinc-900/80 flex items-center justify-center opacity-60">
                                        <Database size={40} className="text-zinc-700 pointer-events-none" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black border-t border-white/5 to-transparent"></div>
                                    </div>
                                )}
                            </div>

                            {/* Top Controls: Selection & Actions */}
                            <div className="relative z-10 flex justify-between items-start w-full">
                                {isSelectionMode ? (
                                    <div className="bg-black/50 rounded-full p-1 backdrop-blur-md">
                                        {isSelected ? <CheckCircle2 size={24} className="text-blue-500" /> : <div className="w-[24px] h-[24px] rounded-full border-[3px] border-white/40"></div>}
                                    </div>
                                ) : (
                                    <div></div> /* Spacer */
                                )}

                                {!isSelectionMode && (
                                    <div className="flex gap-1 bg-black/50 backdrop-blur-md rounded-2xl p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => openEdit(record, e)}
                                            className="text-blue-400 hover:text-blue-300 p-1.5 z-10 hover:bg-white/10 rounded-xl"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(record.id, e)}
                                            className="text-red-400 hover:text-red-300 p-1.5 z-10 hover:bg-white/10 rounded-xl"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Bottom Text Area */}
                            <div className="relative z-10 mt-auto flex flex-col w-full px-1">
                                <h3 className="font-bold text-white text-xs sm:text-sm md:text-base leading-tight line-clamp-2 drop-shadow-md mb-0.5">{record.name}</h3>
                                <div className="text-[9px] sm:text-[10px] text-zinc-300 font-mono opacity-80 drop-shadow-md line-clamp-1">
                                    <span className="text-blue-400 font-bold">L:</span> {record.lat ? record.lat.toFixed(4) : '--'} <span className="text-blue-400 font-bold ml-1">L:</span> {record.lng ? record.lng.toFixed(4) : '--'}
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

                        <div className="flex gap-4">
                            <div className="flex flex-col gap-2 flex-1">
                                <label className="text-xs text-zinc-400">Latitude</label>
                                <input
                                    type="number"
                                    value={editLat}
                                    onChange={(e) => setEditLat(e.target.value)}
                                    step="any"
                                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none"
                                />
                            </div>
                            <div className="flex flex-col gap-2 flex-1">
                                <label className="text-xs text-zinc-400">Longitude</label>
                                <input
                                    type="number"
                                    value={editLng}
                                    onChange={(e) => setEditLng(e.target.value)}
                                    step="any"
                                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl p-3 text-white focus:border-primary focus:outline-none"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleUseCurrentLocationForEdit}
                            className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/30 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600/30 transition-colors"
                        >
                            <LocateFixed size={16} />
                            <span className="font-semibold text-xs">Atualizar pela Posição GPS</span>
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
                            className="w-full mt-2 glow-btn py-3 rounded-xl font-bold"
                            disabled={isExtracting}
                        >
                            {editingRecord ? 'Salvar Alterações' : 'Criar Registro'}
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
