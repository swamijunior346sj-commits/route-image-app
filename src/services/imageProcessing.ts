import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

let model: mobilenet.MobileNet | null = null;
let isModelLoading = false;

export const loadModel = async () => {
    if (model) return model;
    if (isModelLoading) {
        while (!model) {
            await new Promise(r => setTimeout(r, 100));
        }
        return model;
    }

    isModelLoading = true;
    await tf.ready();
    // MobileNet features inference without final classification head
    model = await mobilenet.load({ version: 2, alpha: 0.5 });
    isModelLoading = false;
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

    // model.infer expects true for embeddings layer
    const embedding = model.infer(input, true);
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
