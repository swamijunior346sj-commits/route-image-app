import { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, MapPin, ScanLine, X, Loader2, ImagePlus, SwitchCamera, Maximize2 } from 'lucide-react';
import { getRecords, saveRecord, addPointToActiveRoute } from '../services/db';
import type { LocationRecord } from '../services/db';
import { extractFeatures, cosineSimilarity } from '../services/imageProcessing';

export const ScannerView = () => {
    const webcamRef = useRef<Webcam>(null);
    const [loading, setLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState('Aponte a câmera focar na imagem');
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

        // Convert base64 to image element
        const img = new Image();
        img.src = imageSrc;
        await new Promise(r => { img.onload = r; });

        const features = await extractFeatures(img);
        return { imageSrc, features };
    };

    const handleScan = useCallback(async () => {
        try {
            setLoading(true);
            setStatusMsg('Processando imagem do endereço...');
            setMatch(null);

            const capture = await captureAndExtract();
            if (!capture) {
                throw new Error("Erro ao acessar a câmera.");
            }

            setStatusMsg('Buscando correspondência na base de dados...');
            const records = await getRecords();

            let bestMatch: LocationRecord | null = null;
            let highestSimilarity = 0;

            for (const rec of records) {
                const sim = cosineSimilarity(capture.features, rec.featureVector);
                if (sim > highestSimilarity) {
                    highestSimilarity = sim;
                    bestMatch = rec;
                }

                // Compare with all saved additional views for better accuracy!
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
                setStatusMsg(`Sucesso! Encontramos com ${(highestSimilarity * 100).toFixed(1)}% de semelhança.`);

                // Add to active route points
                await addPointToActiveRoute({
                    id: bestMatch.id,
                    name: bestMatch.name,
                    lat: bestMatch.lat !== null ? bestMatch.lat : -23.55052,
                    lng: bestMatch.lng !== null ? bestMatch.lng : -46.633309,
                    scannedAt: Date.now()
                });
            } else {
                setStatusMsg('Nenhum endereço reconhecido nesta imagem.');
            }
        } catch (err: any) {
            console.error(err);
            setStatusMsg(err.message || 'Erro ao processar imagem.');
        } finally {
            setLoading(false);
        }
    }, [webcamRef]);

    const handleRegisterStart = async () => {
        try {
            setLoading(true);
            setStatusMsg('Capturando e extraindo características...');

            const capture = await captureAndExtract();
            if (!capture) {
                throw new Error("Erro ao acessar câmera.");
            }

            // fetch gps instantly
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        setLatInput(pos.coords.latitude.toString());
                        setLngInput(pos.coords.longitude.toString());
                    },
                    (err) => console.log(err),
                    { timeout: 5000 }
                );
            }

            setRegisterImage(capture.imageSrc);
            setRegisterFeatures(capture.features);
            setMode('register');
            setStatusMsg('Insira o endereço ou código correspondente para vincular a esta imagem.');
        } catch (err: any) {
            console.error(err);
            setStatusMsg('Falha ao capturar imagem.');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRegistration = async () => {
        if (!registerImage || !registerFeatures || !addressInput.trim()) return;

        try {
            setLoading(true);

            let lat = parseFloat(latInput);
            let lng = parseFloat(lngInput);

            // Auto-fetch precise coordinates using the typed address/city/neighborhood if left empty
            if (isNaN(lat) || isNaN(lng)) {
                try {
                    setStatusMsg('Buscando coordenadas precisas no mapa...');
                    const queryParts = [addressInput.trim()];
                    if (neighborhoodInput.trim()) queryParts.push(neighborhoodInput.trim());
                    if (cityInput.trim()) queryParts.push(cityInput.trim());

                    const query = queryParts.join(', ');

                    let url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
                    // try to add a gentle locale bias to Brazil if applicable
                    url += `&countrycodes=br`;

                    const res = await fetch(url);
                    const data = await res.json();

                    if (data && data.length > 0) {
                        lat = parseFloat(data[0].lat);
                        lng = parseFloat(data[0].lon);
                    }
                } catch (geoErr) {
                    console.log("Falha ao resolver endereço via Nominatim", geoErr);
                }
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

            // reset
            setMode('scan');
            setRegisterImage(null);
            setRegisterFeatures(null);
            setAddressInput('');
            setNotesInput('');
            setCityInput('');
            setNeighborhoodInput('');
            setLatInput('');
            setLngInput('');
            setIsPreviewExpanded(false);
            setStatusMsg('Endereço vinculado e salvo com sucesso!');
        } catch (err) {
            console.error(err);
            setStatusMsg('Erro ao salvar endereço.');
        } finally {
            setLoading(false);
        }
    };

    const cancelRegister = () => {
        setMode('scan');
        setRegisterImage(null);
        setRegisterFeatures(null);
        setAddressInput('');
        setNotesInput('');
        setCityInput('');
        setNeighborhoodInput('');
        setLatInput('');
        setLngInput('');
        setIsPreviewExpanded(false);
        setStatusMsg('Pronto para novo escaneamento.');
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
                    if ('geolocation' in navigator) {
                        navigator.geolocation.getCurrentPosition(
                            (pos) => {
                                setLatInput(pos.coords.latitude.toString());
                                setLngInput(pos.coords.longitude.toString());
                            },
                        );
                    }
                    setRegisterImage(imageSrc);
                    setRegisterFeatures(features);
                    setMode('register');
                    setStatusMsg('Insira o endereço ou código correspondente para vincular à imagem importada.');
                } else {
                    setStatusMsg('Buscando correspondência na base de dados (imagem importada)...');
                    const records = await getRecords();
                    let bestMatch: LocationRecord | null = null;
                    let highestSimilarity = 0;

                    for (const rec of records) {
                        const sim = cosineSimilarity(features, rec.featureVector);
                        if (sim > highestSimilarity) {
                            highestSimilarity = sim;
                            bestMatch = rec;
                        }

                        if (rec.additionalImages) {
                            for (const addView of rec.additionalImages) {
                                const simAdd = cosineSimilarity(features, addView.features);
                                if (simAdd > highestSimilarity) {
                                    highestSimilarity = simAdd;
                                    bestMatch = rec;
                                }
                            }
                        }
                    }

                    if (bestMatch && highestSimilarity > SIMILARITY_THRESHOLD) {
                        setMatch(bestMatch);
                        setStatusMsg(`Encontramos com ${(highestSimilarity * 100).toFixed(1)}% de semelhança!`);
                        await addPointToActiveRoute({
                            id: bestMatch.id,
                            name: bestMatch.name,
                            lat: bestMatch.lat !== null ? bestMatch.lat : -23.55052,
                            lng: bestMatch.lng !== null ? bestMatch.lng : -46.633309,
                            scannedAt: Date.now()
                        });
                    } else {
                        setStatusMsg('Nenhum endereço reconhecido na imagem importada.');
                    }
                }
            } catch (err: any) {
                setStatusMsg('Falha ao processar a imagem importada.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        reader.readAsDataURL(file);

        // reset input value so we can upload the same file twice
        e.target.value = '';
    };

    return (
        <div className="relative w-full h-full bg-black overflow-hidden flex flex-col pt-safe">
            {/* Header overlay */}
            <div className="absolute top-0 z-10 w-full p-4 glass-panel border-b-0 animate-fade-in flex flex-col gap-2">
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">Scanner Visão</h1>
                <p className="text-sm text-zinc-300 font-medium">{statusMsg}</p>
            </div>

            <div className="relative flex-1 overflow-hidden">
                {mode === 'scan' && !match && (
                    <>
                        <Webcam
                            key={facingMode} // Force re-mount when camera changes
                            ref={webcamRef}
                            audio={false}
                            screenshotFormat="image/jpeg"
                            videoConstraints={{ facingMode }}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        <button
                            onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                            className="absolute top-4 right-4 z-20 bg-black/50 backdrop-blur-md p-3 rounded-full text-white border border-white/20 hover:bg-white/20 transition-colors"
                            title="Alternar Câmera"
                        >
                            <SwitchCamera size={24} />
                        </button>
                    </>
                )}

                {/* Registration preview */}
                {mode === 'register' && registerImage && (
                    <img src={registerImage} className="absolute inset-0 w-full h-full object-cover blur-sm opacity-50" alt="Preview" />
                )}

                {/* Scanner HUD Overlay */}
                {mode === 'scan' && !match && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        {/* Máscara de Enquadramento (Blur/Darkened outside) */}
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>

                        {/* Viewfinder Hole */}
                        <div className="relative w-64 h-64 border-2 border-white/30 rounded-[2rem] overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                            {/* Corners */}
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-3xl"></div>
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-3xl"></div>
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-3xl"></div>
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-3xl"></div>

                            {/* Scanning Line Animation */}
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

            {/* MATCH MODAL */}
            {match && (
                <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="w-full max-w-sm glass-panel p-6 rounded-2xl border border-white/10 flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                            <MapPin className="text-green-400" size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-center">Endereço Reconhecido</h2>
                        <p className="text-center font-medium text-lg text-zinc-200">{match.name}</p>
                        {match.lat && match.lng ? (
                            <p className="text-xs text-zinc-400 font-mono">Lat: {match.lat.toFixed(5)}, Lng: {match.lng.toFixed(5)}</p>
                        ) : null}
                        <p className="text-sm text-green-400">Adicionado à rota atual!</p>

                        <button
                            onClick={() => setMatch(null)}
                            className="mt-4 w-full py-3 rounded-xl glow-btn font-semibold"
                        >
                            Continuar
                        </button>
                    </div>
                </div>
            )}

            {/* Bottom Controls */}
            <div className="absolute bottom-20 w-full px-6 flex flex-col gap-4 z-10 pb-4">
                {mode === 'scan' && !match ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-4">
                            <button
                                onClick={handleRegisterStart}
                                disabled={loading}
                                className="flex-1 glass-panel py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition-colors disabled:opacity-50 border border-white/20 shadow-lg"
                            >
                                <Camera size={20} />
                                <span className="font-semibold text-sm">Vincular Endereço</span>
                            </button>
                            <button
                                onClick={handleScan}
                                disabled={loading}
                                className="flex-1 glow-btn py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-500/30"
                            >
                                <ScanLine size={20} />
                                <span className="font-semibold text-sm">Ler Câmera</span>
                            </button>
                        </div>

                        {/* Import Buttons Row */}
                        <div className="flex gap-4 mt-1">
                            <label className="flex-1 glass-panel py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50 text-zinc-300">
                                <ImagePlus size={16} />
                                <span className="text-xs font-medium">Importar para Vincular</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleImageUpload(e, true)}
                                    disabled={loading}
                                />
                            </label>

                            <label className="flex-1 glass-panel py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50 text-blue-300 border-blue-500/30">
                                <ImagePlus size={16} />
                                <span className="text-xs font-medium">Importar para Ler</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleImageUpload(e, false)}
                                    disabled={loading}
                                />
                            </label>
                        </div>
                    </div>
                ) : mode === 'register' ? (
                    <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col gap-4 animate-slide-up">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-bold">Salvar Endereço</h3>
                            <button onClick={cancelRegister} className="text-zinc-400 hover:text-white p-1">
                                <X size={20} />
                            </button>
                        </div>
                        {registerImage && (
                            <div className="relative group cursor-pointer" onClick={() => setIsPreviewExpanded(true)}>
                                <img src={registerImage} className="w-full h-24 object-cover rounded-lg border border-white/10" alt="Scanned Target" />
                                <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center rounded-lg transition-all">
                                    <Maximize2 className="text-white" size={24} />
                                </div>
                            </div>
                        )}
                        <div className="flex flex-col gap-2 overflow-y-auto max-h-[45vh] pr-2 custom-scrollbar">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-zinc-400 font-bold uppercase ml-1">Endereço Principal *</label>
                                <input
                                    type="text"
                                    placeholder="Nome da rua / número / código"
                                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-primary"
                                    value={addressInput}
                                    onChange={(e) => setAddressInput(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2">
                                <div className="flex flex-col gap-1 flex-1">
                                    <label className="text-[10px] text-zinc-400 font-bold uppercase ml-1">Cidade (Opcional)</label>
                                    <input
                                        type="text"
                                        placeholder="Cidade"
                                        className="w-full bg-zinc-900/50 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-primary"
                                        value={cityInput}
                                        onChange={(e) => setCityInput(e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                    <label className="text-[10px] text-zinc-400 font-bold uppercase ml-1">Bairro (Opcional)</label>
                                    <input
                                        type="text"
                                        placeholder="Bairro"
                                        className="w-full bg-zinc-900/50 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-primary"
                                        value={neighborhoodInput}
                                        onChange={(e) => setNeighborhoodInput(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <div className="flex flex-col gap-1 flex-1">
                                    <label className="text-[10px] text-zinc-400 font-bold uppercase ml-1">Lat (GPS) (Opcional)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="Lagitude"
                                        className="w-full bg-zinc-900/50 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-primary"
                                        value={latInput}
                                        onChange={(e) => setLatInput(e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-col gap-1 flex-1">
                                    <label className="text-[10px] text-zinc-400 font-bold uppercase ml-1">Lng (GPS) (Opcional)</label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="Longitude"
                                        className="w-full bg-zinc-900/50 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-primary"
                                        value={lngInput}
                                        onChange={(e) => setLngInput(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-zinc-400 font-bold uppercase ml-1">Notas (Opcional)</label>
                                <textarea
                                    placeholder="Ex: Casa verde, portão preto, deixar com vizinho..."
                                    rows={2}
                                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-primary resize-none custom-scrollbar"
                                    value={notesInput}
                                    onChange={(e) => setNotesInput(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSaveRegistration}
                            disabled={loading || !addressInput.trim()}
                            className="w-full glow-btn py-4 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Confirmar e Salvar'}
                        </button>
                    </div>
                ) : null}
            </div>

            {/* Expanded Image Preview Modal */}
            {isPreviewExpanded && registerImage && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-4 animate-fade-in"
                >
                    <button
                        onClick={() => setIsPreviewExpanded(false)}
                        className="absolute top-6 right-6 bg-white/10 p-2 rounded-full text-white hover:bg-white/20 transition backdrop-blur-md z-10"
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={registerImage}
                        className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
                        alt="Expanded Preview"
                    />
                    <div className="mt-4 text-zinc-400 text-sm font-medium">Revisão de Imagem</div>
                </div>
            )}
        </div>
    );
};
