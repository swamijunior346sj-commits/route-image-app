import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

let model: mobilenet.MobileNet | null = null;
let isModelLoading = false;

export const loadModel = async () => {
    if (model) return model;
    if (isModelLoading) {
        let attempts = 0;
        while (!model && attempts < 50) { // Wait max 5 seconds
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }
        if (model) return model;
    }

    isModelLoading = true;
    try {
        await tf.ready();
        console.log("📦 Carregando MobileNet V2...");
        model = await mobilenet.load({
            version: 2,
            alpha: 0.5
        });
        console.log("✅ Modelo carregado com sucesso.");
    } catch (err) {
        console.error("❌ Erro ao carregar modelo:", err);
    } finally {
        isModelLoading = false;
    }
    return model;
};

export const extractFeatures = async (
    input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageData
): Promise<number[]> => {
    if (!model) {
        await loadModel();
    }

    if (!model) {
        throw new Error('Model failed to load');
    }

    // --- LABEL-FOCUSED AUTO-CROP ---
    // Optimized for PACKAGE LABELS: capturing barcode and address text.
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 224;
    canvas.height = 224;

    let sourceWidth, sourceHeight;
    if (input instanceof ImageData) {
        sourceWidth = input.width;
        sourceHeight = input.height;
    } else {
        sourceWidth = (input as any).videoWidth || (input as any).naturalWidth || (input as any).width;
        sourceHeight = (input as any).videoHeight || (input as any).naturalHeight || (input as any).height;
    }

    // Capture 85% of center - labels are usually white rectangles.
    const cropSize = Math.min(sourceWidth, sourceHeight) * 0.85;
    const sx = (sourceWidth - cropSize) / 2;
    const sy = (sourceHeight - cropSize) / 2;

    if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 224, 224);
        if (input instanceof ImageData) {
            ctx.putImageData(input, -sx, -sy);
        } else {
            ctx.drawImage(input, sx, sy, cropSize, cropSize, 0, 0, 224, 224);
        }
    }

    // Process label area
    const embedding = model.infer(canvas, true);
    const data = await embedding.data();
    embedding.dispose();

    return Array.from(data);
};

export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};
