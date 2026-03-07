import { useRef, useState, useCallback, useEffect } from 'react';
import {
    getRecords,
    saveRecord,
    addPointToActiveRoute,
    addToDailyRoute,
    checkAndUpdateUsage,
    type LocationRecord
} from '../services/db';
import { extractFeatures, cosineSimilarity } from '../services/imageProcessing';
import { analyzeAddressImage } from '../services/geminiService';
import { LoadingOverlay } from './LoadingOverlay';

interface ScannerProps {
    onNavigateToDailyRoute: () => void;
    onBack?: () => void;
    initialViewMode?: 'camera' | 'confirm';
    initialAction?: 'camera' | 'import' | null;
    onShowPaywall?: () => void;
}

export const ScannerView = ({ onNavigateToDailyRoute, onBack, initialViewMode = 'camera', initialAction = null, onShowPaywall }: ScannerProps) => {
    // --- State ---
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'camera' | 'confirm'>(initialViewMode === 'confirm' ? 'confirm' : 'camera');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importFileInputRef = useRef<HTMLInputElement>(null);

    // Registering/Confirmation State
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [capturedFeatures, setCapturedFeatures] = useState<number[] | null>(null);
    const [addressInput, setAddressInput] = useState('');
    const [locationNameInput, setLocationNameInput] = useState('');
    const [neighborhoodInput, setNeighborhoodInput] = useState('');
    const [cityInput, setCityInput] = useState('');
    const [notesInput, setNotesInput] = useState('');
    const [latInput, setLatInput] = useState('');
    const [lngInput, setLngInput] = useState('');
    const [deadlineInput, setDeadlineInput] = useState('');

    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
    const [aiStatus, setAiStatus] = useState('');
    const [visualSignature, setVisualSignature] = useState('');

    const SIMILARITY_THRESHOLD = 0.80;

    useEffect(() => {
        if (initialAction === 'camera') {
            const timer = setTimeout(() => {
                fileInputRef.current?.click();
            }, 50);
            return () => clearTimeout(timer);
        } else if (initialAction === 'import') {
            const timer = setTimeout(() => {
                importFileInputRef.current?.click();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [initialAction]);

    // --- Camera Logic ---
    const captureAndAnalyze = useCallback(async (image: HTMLImageElement): Promise<{ features: number[] } | null> => {
        try {
            const features = await extractFeatures(image);
            return { features };
        } catch (err) {
            console.error('Feature extraction failed:', err);
            return null;
        }
    }, []);

    const runAiWithAnimation = async (imageSrc: string): Promise<void> => {
        setIsAiAnalyzing(true);
        setAiStatus('Iniciando leitura de IA...');

        const statusMessages = [
            'Detectando elementos da etiqueta...',
            'Lendo endereço com IA...',
            'Preenchendo campos automaticamente...',
        ];
        let msgIdx = 0;
        const msgInterval = setInterval(() => {
            msgIdx = (msgIdx + 1) % statusMessages.length;
            setAiStatus(statusMessages[msgIdx]);
        }, 600);

        try {
            const [aiReading] = await Promise.all([
                analyzeAddressImage(imageSrc),
                new Promise(r => setTimeout(r, 2000)),
            ]);

            if (aiReading) {
                if (aiReading.address) setAddressInput(aiReading.address);
                if (aiReading.neighborhood) setNeighborhoodInput(aiReading.neighborhood);
                if (aiReading.city) setCityInput(aiReading.city);
                if (aiReading.notes) setNotesInput(aiReading.notes);
                if (aiReading.recipientName) setLocationNameInput(aiReading.recipientName);
                if (aiReading.visualSignature) setVisualSignature(aiReading.visualSignature);
            }
        } catch (err) {
            console.warn('AI analysis failed:', err);
        } finally {
            clearInterval(msgInterval);
            setIsAiAnalyzing(false);
            setAiStatus('');
        }
    };



    const handleNativeCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        console.log("📸 Captura detectada:", file?.name);
        if (!file) {
            if (onBack) onBack(); else onNavigateToDailyRoute();
            return;
        }
        await processImageData(file);
    };

    const handleImportImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        console.log("📥 Importação detectada:", file?.name);
        if (!file) {
            if (onBack) onBack(); else onNavigateToDailyRoute();
            return;
        }
        await processImageData(file);
    };

    const processImageData = async (file: File) => {
        console.log("🎨 Iniciando processamento de imagem...");
        setLoading(true);
        try {
            const usage = await checkAndUpdateUsage();
            if (!usage.allowed) {
                if (onShowPaywall) onShowPaywall();
                else alert("Limite diário atingido! Faça o upgrade para o plano PRO.");
                setLoading(false);
                return;
            }

            const reader = new FileReader();
            reader.onerror = () => {
                console.error("❌ Erro ao ler arquivo");
                setLoading(false);
            };
            reader.onload = async (event) => {
                try {
                    const base64 = event.target?.result as string;
                    if (!base64) {
                        setLoading(false);
                        if (onBack) onBack(); else onNavigateToDailyRoute();
                        return;
                    }

                    const img = new Image();
                    img.onerror = () => {
                        console.error("❌ Erro ao carregar imagem no objeto Image");
                        setLoading(false);
                    };
                    img.onload = async () => {
                        try {
                            console.log("🔍 Analisando features da imagem...");
                            const result = await captureAndAnalyze(img);
                            if (!result) {
                                alert("Falha ao analisar a imagem.");
                                setLoading(false);
                                if (onBack) onBack(); else onNavigateToDailyRoute();
                                return;
                            }

                            // Lógica Unificada: Escanear e, se falhar, alternar para o modo de Registro.
                            const records = await getRecords();
                            let isMatchFound = false;

                            // 1. Tentar reconhecimento prévio via IA (Alta precisão)
                            console.log("🤖 Solicitando análise Gemini AI...");
                            let aiReading = null;
                            try {
                                aiReading = await analyzeAddressImage(base64);
                            } catch (e) {
                                console.warn("⚠️ Falha na análise de IA inicial, seguindo para embeddings", e);
                            }

                            if (aiReading && aiReading.visualSignature) {
                                const exactMatch = records.find(r => r.visualSignature === aiReading.visualSignature);
                                if (exactMatch) {
                                    console.log("🎯 Match exato encontrado via Visual Signature!");
                                    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                                    setAiStatus(`Reconhecido: ${exactMatch.name}`);
                                    await addPointToActiveRoute({
                                        id: exactMatch.id!,
                                        name: exactMatch.name,
                                        lat: exactMatch.lat,
                                        lng: exactMatch.lng,
                                        scannedAt: Date.now(),
                                        notes: exactMatch.notes,
                                        neighborhood: exactMatch.neighborhood,
                                        city: exactMatch.city,
                                        visualSignature: exactMatch.visualSignature,
                                        isRecent: true
                                    });
                                    isMatchFound = true;
                                    setTimeout(() => {
                                        setLoading(false);
                                        onNavigateToDailyRoute();
                                    }, 1500);
                                    return;
                                }
                            }

                            // 2. Tentar aproximação via Similaridade Embeddings (MobileNet fallback)
                            console.log("🧠 Verificando similaridade visual...");
                            let bestMatch: LocationRecord | null = null;
                            let highestSim = 0;

                            for (const rec of records) {
                                const sim = cosineSimilarity(result.features, rec.featureVector);
                                if (sim > highestSim) { highestSim = sim; bestMatch = rec; }
                            }

                            if (bestMatch && highestSim > SIMILARITY_THRESHOLD) {
                                console.log("📍 Match por similaridade encontrado!", highestSim);
                                if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                                await addPointToActiveRoute({
                                    id: bestMatch.id!,
                                    name: bestMatch.name,
                                    lat: bestMatch.lat,
                                    lng: bestMatch.lng,
                                    scannedAt: Date.now(),
                                    notes: bestMatch.notes,
                                    neighborhood: bestMatch.neighborhood,
                                    city: bestMatch.city,
                                    visualSignature: bestMatch.visualSignature,
                                    isRecent: true
                                });
                                isMatchFound = true;
                                setTimeout(() => {
                                    setLoading(false);
                                    onNavigateToDailyRoute();
                                }, 500);
                                return;
                            }

                            // 3. Importação não pôde associar imagem a uma parada existente
                            // Abrimos a tela de Confirmação com a imagem importada para Criar Nova Parada.
                            if (!isMatchFound) {
                                console.log("🆕 Nenhuma correspondência encontrada. Abrindo tela de registro.");
                                setCapturedImage(base64);
                                setCapturedFeatures(result.features);
                                setViewMode('confirm');

                                if ('geolocation' in navigator) {
                                    navigator.geolocation.getCurrentPosition(
                                        (pos) => {
                                            setLatInput(pos.coords.latitude.toString());
                                            setLngInput(pos.coords.longitude.toString());
                                        },
                                        undefined,
                                        { enableHighAccuracy: true, timeout: 10000 }
                                    );
                                }

                                if (aiReading) {
                                    if (aiReading.address) setAddressInput(aiReading.address);
                                    if (aiReading.neighborhood) setNeighborhoodInput(aiReading.neighborhood);
                                    if (aiReading.city) setCityInput(aiReading.city);
                                    if (aiReading.notes) setNotesInput(aiReading.notes);
                                    if (aiReading.recipientName) setLocationNameInput(aiReading.recipientName);
                                    if (aiReading.visualSignature) setVisualSignature(aiReading.visualSignature);
                                    setLoading(false);
                                } else {
                                    await runAiWithAnimation(base64);
                                    setLoading(false);
                                }
                            }
                        } catch (innerErr) {
                            console.error("❌ Erro interno no onload da imagem:", innerErr);
                            setLoading(false);
                            alert("Erro ao processar imagem.");
                        }
                    };
                    img.src = base64;
                } catch (readerErr) {
                    console.error("❌ Erro ao converter arquivo:", readerErr);
                    setLoading(false);
                }
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error('❌ Erro global no processImageData:', err);
            setLoading(false);
            if (onBack) onBack(); else onNavigateToDailyRoute();
        }
    };

    const handleSaveEntry = async () => {
        if (!capturedImage || !capturedFeatures || !addressInput.trim()) return;
        setLoading(true);
        try {
            let lat = parseFloat(latInput);
            let lng = parseFloat(lngInput);

            if (isNaN(lat) || isNaN(lng)) {
                try {
                    const query = [addressInput, neighborhoodInput, cityInput].filter(Boolean).join(', ');
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
                    const data = await res.json();
                    if (data && data.length > 0) {
                        lat = parseFloat(data[0].lat);
                        lng = parseFloat(data[0].lon);
                    }
                } catch (e) { console.error(e); }
            }

            const record = await saveRecord(
                locationNameInput.trim() || addressInput.trim(),
                isNaN(lat) ? null : lat,
                isNaN(lng) ? null : lng,
                capturedImage,
                capturedFeatures,
                { notes: notesInput, neighborhood: neighborhoodInput, city: cityInput, deadline: deadlineInput, visualSignature: visualSignature }
            );

            await addToDailyRoute({
                id: record.id,
                name: record.name,
                lat: record.lat,
                lng: record.lng,
                scannedAt: Date.now(),
                notes: record.notes,
                neighborhood: record.neighborhood,
                city: record.city,
                deadline: record.deadline,
                visualSignature: record.visualSignature
            });

            setTimeout(() => {
                setCapturedImage(null);
                setAddressInput('');
                setLocationNameInput('');
                setNeighborhoodInput('');
                setCityInput('');
                setNotesInput('');
                setLatInput('');
                setLngInput('');
                setDeadlineInput('');
                onNavigateToDailyRoute();
            }, 500);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };



    if (loading) {
        return <LoadingOverlay title="Processando" subtitle={aiStatus || "Analisando dados da imagem"} />;
    }

    if (viewMode === 'confirm') {
        return (
            <div className="fixed inset-0 z-[11000] bg-[#f8fafc] flex flex-col font-sans pointer-events-auto">
                {/* Header Premium */}
                <header className="px-6 pt-12 pb-6 flex items-center justify-between">
                    <button
                        onClick={() => {
                            setViewMode('camera');
                            setCapturedImage(null);
                        }}
                        className="flex items-center justify-center size-10 rounded-full bg-white border border-gray-100 text-gray-400 active:scale-90 transition-all shadow-sm"
                    >
                        <span className="material-symbols-outlined !text-[20px]">arrow_back</span>
                    </button>
                    <h1 className="text-[17px] font-bold text-gray-800">Detalhes da Parada</h1>
                    <button
                        onClick={handleSaveEntry}
                        disabled={loading || !addressInput.trim()}
                        className="text-[14px] font-black uppercase tracking-widest text-[#2970ff] disabled:opacity-30"
                    >
                        Concluído
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto px-6 pb-32 no-scrollbar">
                    {/* Visual Preview Card */}
                    <div className="mb-8 relative group">
                        <div className="aspect-[4/3] rounded-[2rem] overflow-hidden bg-gray-100 border border-gray-100 shadow-sm relative">
                            {capturedImage && (
                                <img src={capturedImage} className="w-full h-full object-cover" alt="Capture" />
                            )}

                            {isAiAnalyzing && (
                                <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center">
                                    <div className="size-12 border-4 border-blue-50 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{aiStatus}</p>
                                </div>
                            )}
                            {visualSignature && !isAiAnalyzing && (
                                <div className="absolute top-4 right-4 bg-blue-600/90 backdrop-blur-sm text-white px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg animate-in zoom-in duration-300">
                                    <span className="material-symbols-outlined !text-[12px]">qr_code_2</span>
                                    <span className="text-[10px] font-black tracking-widest uppercase">ID: {visualSignature}</span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute -bottom-3 right-6 bg-white size-12 rounded-full shadow-lg border border-gray-50 flex items-center justify-center text-gray-400 hover:text-[#2970ff] transition-colors"
                        >
                            <span className="material-symbols-outlined filled-icon !text-[20px]">photo_camera</span>
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Address Section */}
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-black text-gray-300 uppercase tracking-widest px-1">Endereço</label>
                                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm focus-within:ring-2 focus-within:ring-blue-50 transition-all">
                                    <textarea
                                        className="w-full bg-transparent border-none p-0 text-[15px] font-semibold text-gray-800 placeholder:text-gray-300 outline-none resize-none"
                                        rows={2}
                                        value={addressInput}
                                        onChange={e => setAddressInput(e.target.value)}
                                        placeholder="Digite o endereço completo"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-black text-gray-300 uppercase tracking-widest px-1">Bairro</label>
                                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                                        <input
                                            className="w-full bg-transparent border-none p-0 text-[15px] font-semibold text-gray-800 placeholder:text-gray-300 outline-none"
                                            value={neighborhoodInput}
                                            onChange={e => setNeighborhoodInput(e.target.value)}
                                            placeholder="Bairro"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-black text-gray-300 uppercase tracking-widest px-1">Cidade</label>
                                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                                        <input
                                            className="w-full bg-transparent border-none p-0 text-[15px] font-semibold text-gray-800 placeholder:text-gray-300 outline-none"
                                            value={cityInput}
                                            onChange={e => setCityInput(e.target.value)}
                                            placeholder="Cidade"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Details Section */}
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-black text-gray-300 uppercase tracking-widest px-1">Destinatário</label>
                                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                                    <input
                                        className="w-full bg-transparent border-none p-0 text-[15px] font-semibold text-gray-800 placeholder:text-gray-300 outline-none"
                                        value={locationNameInput}
                                        onChange={e => setLocationNameInput(e.target.value)}
                                        placeholder="Nome do cliente"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-black text-gray-300 uppercase tracking-widest px-1">Instruções de entrega</label>
                                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                                    <textarea
                                        className="w-full bg-transparent border-none p-0 text-[14px] font-medium text-gray-600 placeholder:text-gray-300 outline-none resize-none"
                                        rows={3}
                                        value={notesInput}
                                        onChange={e => setNotesInput(e.target.value)}
                                        placeholder="Ex: Tocar campainha 2x, deixar na vizinha do lado..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                <footer className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc] to-transparent">
                    <button
                        onClick={handleSaveEntry}
                        disabled={loading || !addressInput.trim()}
                        className="w-full h-16 bg-[#2970ff] text-white font-bold rounded-2xl shadow-[0_8px_24px_rgba(41,112,255,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {loading ? (
                            <span className="material-symbols-outlined animate-spin">refresh</span>
                        ) : (
                            <>
                                <span className="text-[16px]">Confirmar Parada</span>
                                <span className="material-symbols-outlined !text-[20px]">arrow_forward</span>
                            </>
                        )}
                    </button>
                </footer>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-8 z-[10000] animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 flex flex-col items-center text-center shadow-2xl animate-in zoom-in-95 duration-500">
                <div className="size-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-500 mb-6 animate-bounce">
                    <span className="material-symbols-outlined !text-[44px]">photo_camera</span>
                </div>

                <h2 className="text-2xl font-black text-gray-900 mb-2 leading-tight">Scanner Ativo</h2>
                <p className="text-gray-400 text-[13px] font-medium mb-8 leading-relaxed max-w-[240px]">
                    Posicione a etiqueta no centro ou importe uma imagem da sua galeria.
                </p>

                <div className="w-full space-y-3">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-14 bg-[#2970ff] text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                        <span className="material-symbols-outlined !text-[20px]">camera</span>
                        <span>Abrir Câmera</span>
                    </button>

                    <button
                        onClick={() => importFileInputRef.current?.click()}
                        className="w-full h-14 bg-gray-50 text-gray-800 font-bold rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-3 border border-gray-100"
                    >
                        <span className="material-symbols-outlined !text-[20px]">image</span>
                        <span>Galeria</span>
                    </button>

                    <button
                        onClick={onBack}
                        className="w-full py-4 text-[12px] font-black uppercase tracking-widest text-gray-300 hover:text-gray-400"
                    >
                        Voltar ao Mapa
                    </button>
                </div>
            </div>

            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleNativeCapture} className="hidden" />
            <input type="file" accept="image/*" ref={importFileInputRef} onChange={handleImportImage} className="hidden" />
        </div>
    );
};
