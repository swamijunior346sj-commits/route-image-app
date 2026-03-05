import { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, MapPin, ScanLine, X, Loader2, ImagePlus, SwitchCamera, Maximize2, Save } from 'lucide-react';
import { getRecords, saveRecord, addPointToActiveRoute } from '../services/db';
import type { LocationRecord } from '../services/db';
import { extractFeatures, cosineSimilarity } from '../services/imageProcessing';

interface ScannerProps {
    onNavigateToMap: () => void;
}

export const ScannerView = ({ onNavigateToMap }: ScannerProps) => {
    const webcamRef = useRef<Webcam>(null);
    const [loading, setLoading] = useState(false);
    const [isSendingToRoute, setIsSendingToRoute] = useState(false);
    const [statusMsg, setStatusMsg] = useState('Aponte a câmera para a etiqueta do pacote');
    const [mode, setMode] = useState<'scan' | 'register'>('scan');

    // Registering state
    const [registerImage, setRegisterImage] = useState<string | null>(null);
    const [registerFeatures, setRegisterFeatures] = useState<number[] | null>(null);
    const [addressInput, setAddressInput] = useState('');
    const [notesInput, setNotesInput] = useState('');
    const [cityInput, setCityInput] = useState('');
    const [neighborhoodInput, setNeighborhoodInput] = useState('');
    const [latInput, setLatInput] = useState('');
    const [lngInput, setLngInput] = useState('');

    const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

    // Scanned match
    const [match, setMatch] = useState<LocationRecord | null>(null);

    const SIMILARITY_THRESHOLD = 0.80;

    const captureAndExtract = async (): Promise<{ imageSrc: string, features: number[] } | null> => {
        if (!webcamRef.current) return null;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return null;

        const img = new Image();
        img.src = imageSrc;
        await new Promise(r => { img.onload = r; });

        const features = await extractFeatures(img);
        return { imageSrc, features };
    };

    const handleScan = useCallback(async () => {
        try {
            setLoading(true);
            setStatusMsg('Processando etiqueta...');
            setMatch(null);

            if (navigator.vibrate) navigator.vibrate(50);

            const capture = await captureAndExtract();
            if (!capture) throw new Error("Erro ao acessar a câmera.");

            const records = await getRecords();
            let bestMatch: LocationRecord | null = null;
            let highestSimilarity = 0;

            for (const rec of records) {
                const sim = cosineSimilarity(capture.features, rec.featureVector);
                if (sim > highestSimilarity) {
                    highestSimilarity = sim;
                    bestMatch = rec;
                }
                if (rec.additionalImages) {
                    for (const addView of rec.additionalImages) {
                        const simAdd = cosineSimilarity(capture.features, addView.features);
                        if (simAdd > highestSimilarity) {
                            highestSimilarity = simAdd;
                            bestMatch = rec;
                        }
                    }
                }
            }

            if (bestMatch && highestSimilarity > SIMILARITY_THRESHOLD) {
                setMatch(bestMatch);
                setStatusMsg(`Reconhecido: ${(highestSimilarity * 100).toFixed(0)}%`);

                await addPointToActiveRoute({
                    id: bestMatch.id,
                    name: bestMatch.name,
                    lat: bestMatch.lat || -23.55052,
                    lng: bestMatch.lng || -46.633309,
                    scannedAt: Date.now(),
                    notes: bestMatch.notes
                });

                // Auto-navigate animation
                setIsSendingToRoute(true);
                setTimeout(() => {
                    setIsSendingToRoute(false);
                    onNavigateToMap();
                }, 2000);
            } else {
                setStatusMsg('Nenhum endereço reconhecido.');
            }
        } catch (err: any) {
            console.error(err);
            setStatusMsg('Erro no reconhecimento.');
        } finally {
            setLoading(false);
        }
    }, [webcamRef, onNavigateToMap]);

    const handleRegisterStart = async () => {
        try {
            setLoading(true);
            if (navigator.vibrate) navigator.vibrate(50);
            const capture = await captureAndExtract();
            if (!capture) throw new Error("Erro de captura.");

            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        setLatInput(pos.coords.latitude.toString());
                        setLngInput(pos.coords.longitude.toString());
                    },
                    undefined,
                    { timeout: 5000 }
                );
            }

            setRegisterImage(capture.imageSrc);
            setRegisterFeatures(capture.features);
            setMode('register');
            setStatusMsg('Vincule os dados à etiqueta capturada.');
        } catch (err) {
            setStatusMsg('Falha na captura.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRegistration = async () => {
        if (!registerImage || !registerFeatures || !addressInput.trim()) return;
        try {
            setLoading(true);
            if (navigator.vibrate) navigator.vibrate(50);

            let lat = parseFloat(latInput);
            let lng = parseFloat(lngInput);

            if (isNaN(lat) || isNaN(lng)) {
                try {
                    const query = [addressInput, neighborhoodInput, cityInput].filter(Boolean).join(', ');
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}&countrycodes=br`);
                    const data = await res.json();
                    if (data?.length > 0) {
                        lat = parseFloat(data[0].lat);
                        lng = parseFloat(data[0].lon);
                    }
                } catch (e) { console.log(e); }
            }

            await saveRecord(
                addressInput.trim(),
                isNaN(lat) ? null : lat,
                isNaN(lng) ? null : lng,
                registerImage,
                registerFeatures,
                {
                    notes: notesInput.trim(),
                    city: cityInput.trim(),
                    neighborhood: neighborhoodInput.trim(),
                }
            );

            // Animate and switch
            setIsSendingToRoute(true);
            setTimeout(() => {
                setIsSendingToRoute(false);
                setMode('scan');
                setRegisterImage(null);
                setRegisterFeatures(null);
                setAddressInput('');
                onNavigateToMap();
            }, 2000);
        } catch (err) {
            setStatusMsg('Erro ao salvar.');
        } finally {
            setLoading(false);
        }
    };

    const cancelRegister = () => {
        setMode('scan');
        setRegisterImage(null);
        setRegisterFeatures(null);
        setAddressInput('');
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isRegistering: boolean) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const imageSrc = event.target?.result as string;
            if (!imageSrc) return;
            setLoading(true);
            try {
                const img = new Image();
                img.src = imageSrc;
                await new Promise(r => { img.onload = r; });
                const features = await extractFeatures(img);

                if (isRegistering) {
                    setRegisterImage(imageSrc);
                    setRegisterFeatures(features);
                    setMode('register');
                } else {
                    setStatusMsg('Analisando arquivo...');
                    const records = await getRecords();
                    let bestMatch: LocationRecord | null = null;
                    let highestSim = 0;
                    for (const rec of records) {
                        const sim = cosineSimilarity(features, rec.featureVector);
                        if (sim > highestSim) { highestSim = sim; bestMatch = rec; }
                    }
                    if (bestMatch && highestSim > SIMILARITY_THRESHOLD) {
                        setMatch(bestMatch);
                        await addPointToActiveRoute({
                            id: bestMatch.id,
                            name: bestMatch.name,
                            lat: bestMatch.lat || -23.55052,
                            lng: bestMatch.lng || -46.633309,
                            scannedAt: Date.now(),
                            notes: bestMatch.notes
                        });
                        setIsSendingToRoute(true);
                        setTimeout(() => { setIsSendingToRoute(false); onNavigateToMap(); }, 2000);
                    } else {
                        setStatusMsg('Nenhuma correspondência no arquivo.');
                    }
                }
            } catch (err) { setStatusMsg('Erro ao processar arquivo.'); }
            finally { setLoading(false); }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    return (
        <div className="relative w-full h-full bg-black overflow-hidden flex flex-col pt-safe">
            <div className="absolute top-0 z-10 w-full p-4 glass-panel border-b-0 animate-fade-in">
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 leading-tight">Scanner Visão</h1>
                <p className="text-sm text-zinc-300 font-medium truncate">{statusMsg}</p>
            </div>

            <div className="relative flex-1 overflow-hidden">
                {mode === 'scan' && !match && (
                    <>
                        <Webcam
                            key={facingMode}
                            ref={webcamRef}
                            audio={false}
                            screenshotFormat="image/jpeg"
                            videoConstraints={{ facingMode }}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        <button
                            onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                            className="absolute top-4 right-4 z-20 bg-black/50 backdrop-blur-md p-3 rounded-full text-white border border-white/20 hover:bg-white/20 transition-colors"
                        >
                            <SwitchCamera size={24} />
                        </button>
                    </>
                )}

                {mode === 'register' && registerImage && (
                    <img src={registerImage} className="absolute inset-0 w-full h-full object-cover blur-sm opacity-50" alt="Preview" />
                )}

                {mode === 'scan' && !match && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
                        <div className="relative w-64 h-64 border-2 border-white/30 rounded-[2rem] overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-3xl"></div>
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-3xl"></div>
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-3xl"></div>
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-3xl"></div>
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-scan-line shadow-[0_0_15px_rgba(59,130,246,0.8)]"></div>
                            {loading && (
                                <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-sm animate-pulse flex items-center justify-center">
                                    <Loader2 className="animate-spin text-white drop-shadow-glow" size={48} />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="absolute bottom-20 w-full px-6 flex flex-col gap-4 z-10 pb-4">
                {mode === 'scan' ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-4">
                            <button onClick={handleRegisterStart} disabled={loading} className="flex-1 glass-panel py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition-colors border border-white/20 shadow-lg">
                                <Camera size={20} /> <span className="font-semibold text-sm">Vincular</span>
                            </button>
                            <button onClick={handleScan} disabled={loading} className="flex-1 glow-btn py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30">
                                <ScanLine size={20} /> <span className="font-semibold text-sm">Escanear</span>
                            </button>
                        </div>
                        <div className="flex gap-4">
                            <label className="flex-1 glass-panel py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer text-zinc-300 text-[10px] font-bold uppercase">
                                <ImagePlus size={14} /> Importar (Link) <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, true)} />
                            </label>
                            <label className="flex-1 glass-panel py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer text-blue-300 text-[10px] font-bold uppercase border-blue-500/30">
                                <ImagePlus size={14} /> Importar (Scan) <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, false)} />
                            </label>
                        </div>
                    </div>
                ) : (
                    <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col gap-4 animate-slide-up bg-zinc-900/40 backdrop-blur-2xl">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold">Dados da Etiqueta</h3>
                            <button onClick={cancelRegister} className="text-zinc-400 p-1"><X size={20} /></button>
                        </div>
                        <div className="flex flex-col gap-3 overflow-y-auto max-h-[40vh] py-2">
                            <input type="text" placeholder="Endereço / Pacote *" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm" value={addressInput} onChange={e => setAddressInput(e.target.value)} />
                            <div className="flex gap-2">
                                <input type="text" placeholder="Bairro" className="flex-1 bg-black/40 border border-white/10 rounded-xl p-3 text-sm" value={neighborhoodInput} onChange={e => setNeighborhoodInput(e.target.value)} />
                                <input type="text" placeholder="Cidade" className="flex-1 bg-black/40 border border-white/10 rounded-xl p-3 text-sm" value={cityInput} onChange={e => setCityInput(e.target.value)} />
                            </div>
                            <textarea placeholder="Notas extras..." rows={2} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm resize-none" value={notesInput} onChange={e => setNotesInput(e.target.value)} />
                        </div>
                        <button onClick={handleSaveRegistration} disabled={loading || !addressInput.trim()} className="w-full glow-btn py-4 rounded-xl font-bold flex items-center justify-center gap-2">
                            {loading ? <Loader2 className="animate-spin" /> : <><Save size={20} /> Confirmar</>}
                        </button>
                    </div>
                )}
            </div>

            {isSendingToRoute && (
                <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center animate-fade-in">
                    <div className="relative">
                        <div className="w-32 h-32 border-4 border-blue-500/20 rounded-full flex items-center justify-center">
                            <div className="w-24 h-24 border-t-4 border-blue-500 rounded-full animate-spin"></div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <MapPin className="text-blue-400 animate-bounce" size={40} />
                        </div>
                    </div>
                    <div className="mt-8 flex flex-col items-center gap-1">
                        <h3 className="text-2xl font-bold text-white tracking-tight animate-pulse">Enviando à Rota</h3>
                        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Otimizando percurso...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

