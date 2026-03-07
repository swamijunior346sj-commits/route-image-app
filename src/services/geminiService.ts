import { GoogleGenAI } from "@google/genai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export interface GeminiAddressExtraction {
    address?: string;
    neighborhood?: string;
    city?: string;
    recipientName?: string;
    notes?: string;
    visualSignature?: string; // ID único baseado em características visuais
}

export const analyzeAddressImage = async (base64Image: string): Promise<GeminiAddressExtraction | null> => {
    if (!API_KEY) {
        console.warn("Gemini API Key missing. Please set VITE_GEMINI_API_KEY in .env");
        return null;
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    // Remove the data:image/jpeg;base64, part if present
    const base64Data = base64Image.split(',')[1] || base64Image;

    const prompt = `
        You are a Brazilian logistics assistant specializing in reading delivery labels.
        Analyze the attached image which contains a package label or address.
        Extract the following information in JSON format:
        - address (Street and Number)
        - neighborhood (Bairro)
        - city (Cidade)
        - recipientName (Nome do recebedor)
        - notes (Any useful reference points or instructions)
        - visualSignature (A unique 10-character alphanumeric ID that represents this specific label. If a tracking code or barcode value is visible, use it. If not, generate a consistent short hash based on the text contents).

        Return ONLY the JSON string. If you cannot find a specific field, leave it empty.
        Ensure it works well with Brazilian format.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
                prompt,
                { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
            ]
        });

        const text = response.text;

        // Try to parse JSON from the text
        if (text) {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        return null;
    } catch (error) {
        console.error("Gemini analysis error:", error);
        return null;
    }
};
