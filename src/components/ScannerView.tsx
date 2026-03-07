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
import { analyzeAddressImage, type GeminiAddressExtraction } from '../services/geminiService';
import { LoadingOverlay } from './LoadingOverlay';

interface ScannerProps {
    onNavigateToDailyRoute: () => void;
    onBack?: () => void;
    initialViewMode?: 'camera' | 'confirm';
    initialAction?: 'camera' | 'import' | null;
    onShowPaywall?: () => void;
}

export const ScannerView = ({ onNavigateToDailyRoute, onBack, initialViewMode = 'camera', onShowPaywall }: ScannerProps) => {
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
    const [aiStatus, setAiStatus] = useState('');
    const [visualSignature, setVisualSignature] = useState('');

    const SIMILARITY_THRESHOLD = 0.80;

    useEffect(() => {
        // ESSENCIAL: Disparar a câmera imediatamente ao entrar nesta tela
        // O Chrome mobile e o WebView do Android precisam de um pequeno delay ou interação
        // Mas como o usuário clicou em "Capturar", já temos o gesto inicial.
        console.log("🚀 Tentando abrir câmera nativa...");
        const timer = setTimeout(() => {
            if (fileInputRef.current) {
                fileInputRef.current.click();
            }
        }, 300);
        return () => clearTimeout(timer);
    }, []);

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


    // Chamado pelo botão de digitar endereço no failsafe
    const handleManualEntry = () => {
        setCapturedImage(null);
        setCapturedFeatures(new Array(1024).fill(0));
        setAddressInput('');
        setLocationNameInput('');
        setNeighborhoodInput('');
        setCityInput('');
        setNotesInput('');
        setVisualSignature(`MAN-${Date.now().toString().slice(-6)}`);
        setViewMode('confirm');
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
        console.log("🎨 [Scanner] Iniciando processamento...");
        setLoading(true);
        setAiStatus("Preparando imagem...");

        try {
            // 1. Verificação de uso
            const usage = await checkAndUpdateUsage();
            if (!usage.allowed) {
                if (onShowPaywall) onShowPaywall();
                else alert("Limite diário atingido! Faça o upgrade para o plano PRO.");
                setLoading(false);
                return;
            }

            // 2. Leitura do arquivo (Promise based)
            console.log("📂 [Scanner] Lendo arquivo...");
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
                reader.readAsDataURL(file);
            });

            // 3. Carregamento da imagem (Promise based)
            console.log("🖼️ [Scanner] Carregando objeto de imagem...");
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error("Erro ao carregar imagem"));
                image.src = base64;
            });

            // 4. Extração de Features (TensorFlow)
            setAiStatus("Analisando padrões visuais...");
            console.log("🔍 [Scanner] Extraindo features (TensorFlow)...");
            const featuresResult = await captureAndAnalyze(img);
            if (!featuresResult) throw new Error("Falha na extração de features");

            // 5. Análise de Endereço (Gemini) - Com Timeout
            setAiStatus("Lendo endereço com IA...");
            console.log("🤖 [Scanner] Solicitando análise Gemini AI...");
            let aiReading = null;
            try {
                const aiPromise = analyzeAddressImage(base64);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI Timeout')), 12000));
                aiReading = await Promise.race([aiPromise, timeoutPromise]) as GeminiAddressExtraction | null;
                console.log("✅ [Scanner] Gemini respondeu.");
            } catch (aiErr) {
                console.warn("⚠️ [Scanner] Falha ou timeout na IA inicial:", aiErr);
                // Não throw aqui, permitimos seguir para similaridade ou manual
            }

            // 6. Busca por Paradas Existentes
            console.log("🗄️ [Scanner] Buscando registros locais...");
            const records = await getRecords();
            let isMatchFound = false;

            // 6a. Match por Assinatura Visual (Gemini ID)
            if (aiReading?.visualSignature) {
                const exactMatch = records.find(r => r.visualSignature === aiReading.visualSignature);
                if (exactMatch) {
                    console.log("🎯 [Scanner] Match exato via Visual Signature!");
                    setAiStatus(`Reconhecido: ${exactMatch.name}`);
                    await addPointToActiveRoute({
                        ...exactMatch,
                        id: exactMatch.id!,
                        scannedAt: Date.now(),
                        isRecent: true
                    });
                    isMatchFound = true;
                    setTimeout(() => { setLoading(false); onNavigateToDailyRoute(); }, 1200);
                    return; // Early return para o timeout de navegação
                }
            }

            // 6b. Match por Similaridade Visual (MobileNet)
            console.log("🧠 [Scanner] Comparando similaridade visual...");
            let bestMatch: LocationRecord | null = null;
            let highestSim = 0;

            for (const rec of records) {
                const sim = cosineSimilarity(featuresResult.features, rec.featureVector);
                if (sim > highestSim) { highestSim = sim; bestMatch = rec; }
            }

            if (bestMatch && highestSim > SIMILARITY_THRESHOLD) {
                console.log("📍 [Scanner] Match por similaridade encontrado!", highestSim);
                setAiStatus(`Reconhecido: ${bestMatch.name}`);
                await addPointToActiveRoute({
                    ...bestMatch,
                    id: bestMatch.id!,
                    scannedAt: Date.now(),
                    isRecent: true
                });
                isMatchFound = true;
                setTimeout(() => { setLoading(false); onNavigateToDailyRoute(); }, 800);
                return;
            }

            // 7. Fluxo Fallback: Registrar Nova Parada
            if (!isMatchFound) {
                console.log("🆕 [Scanner] Nenhuma correspondência encontrada. Abrindo tela de registro manual.");
                setCapturedImage(base64);
                setCapturedFeatures(featuresResult.features);

                // Preenche campos com o que a IA conseguiu ler (se conseguiu)
                if (aiReading) {
                    setAddressInput(aiReading.address || '');
                    setNeighborhoodInput(aiReading.neighborhood || '');
                    setCityInput(aiReading.city || '');
                    setNotesInput(aiReading.notes || '');
                    setLocationNameInput(aiReading.recipientName || '');
                    setVisualSignature(aiReading.visualSignature || '');
                } else {
                    // Fallback visual signature se nem a IA inicial funcionou
                    setVisualSignature(`VS-${Date.now().toString().slice(-6)}`);
                }

                // Tenta pegar geolocalização atual
                if ('geolocation' in navigator) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            setLatInput(pos.coords.latitude.toString());
                            setLngInput(pos.coords.longitude.toString());
                        },
                        undefined,
                        { enableHighAccuracy: true, timeout: 5000 }
                    );
                }

                setViewMode('confirm');
                setLoading(false); // Libera o carregamento para mostrar a tela de confirmação
            }

        } catch (err) {
            console.error('❌ [Scanner] Erro CRÍTICO no processamento:', err);
            alert("Ocorreu um erro ao processar a imagem. Por favor, tente novamente ou use a entrada manual.");
            setLoading(false);
            if (onBack) onBack(); else onNavigateToDailyRoute();
        }
    };

    const handleSaveEntry = async () => {
        if (!addressInput.trim()) {
            alert("Por favor, digite um endereço.");
            return;
        }
        setLoading(true);
        try {
            let lat = parseFloat(latInput);
            let lng = parseFloat(lngInput);

            // Fallback features if none exist
            const features = capturedFeatures || new Array(1024).fill(0);
            const image = capturedImage || '';

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
                image,
                features,
                { notes: notesInput, neighborhood: neighborhoodInput, city: cityInput, visualSignature: visualSignature }
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

                            {visualSignature && (
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
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center z-[10000] animate-in fade-in duration-500 overflow-hidden">
            {/* Overlay de carregamento da câmera / Estado Inicial */}
            {!capturedImage && !loading && (
                <div className="text-center p-8 max-w-sm w-full animate-in zoom-in-95 duration-700">
                    <div className="relative mb-10">
                        <div className="size-28 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto border-2 border-blue-500/20 shadow-[0_0_50px_rgba(59,130,246,0.2)]">
                            <span className="material-symbols-outlined !text-[56px] text-blue-400">photo_camera</span>
                        </div>
                        <div className="absolute inset-0 size-28 mx-auto rounded-full border-t-2 border-blue-500 animate-spin duration-[2s]"></div>
                    </div>

                    <h2 className="text-2xl font-black text-white mb-3">Preparando Scanner</h2>
                    <p className="text-gray-400 text-sm mb-12 leading-relaxed">
                        Aguardando autorização da câmera para ler as etiquetas de entrega...
                    </p>

                    <div className="space-y-4 w-full">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                fileInputRef.current?.click();
                            }}
                            className="w-full h-16 bg-blue-600 text-white font-black rounded-2xl shadow-[0_8px_30px_rgba(37,99,235,0.3)] active:scale-95 transition-all text-[14px] uppercase tracking-widest"
                        >
                            Abrir Câmera Agora
                        </button>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={handleManualEntry}
                                className="h-14 bg-white/5 text-white/80 font-bold rounded-2xl border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined !text-[20px]">edit</span>
                                <span className="text-[13px]">Manual</span>
                            </button>
                            <button
                                onClick={() => importFileInputRef.current?.click()}
                                className="h-14 bg-white/5 text-white/80 font-bold rounded-2xl border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined !text-[20px]">image</span>
                                <span className="text-[13px]">Galeria</span>
                            </button>
                        </div>

                        <button
                            onClick={onBack}
                            className="w-full py-6 text-gray-500 text-[11px] font-black uppercase tracking-[0.2em] transition-colors hover:text-white"
                        >
                            Cancelar e Voltar
                        </button>
                    </div>
                </div>
            )}

            {/* Inputs Ocultos */}
            <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                onChange={handleNativeCapture}
                className="hidden"
            />
            <input
                type="file"
                accept="image/*"
                ref={importFileInputRef}
                onChange={handleImportImage}
                className="hidden"
            />
        </div>
    );
};
