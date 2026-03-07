import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY || "");

export interface AddressData {
    address: string;
    neighborhood?: string;
    city?: string;
    recipientName?: string;
    notes?: string;
}

export const analyzeLabel = async (base64Image: string): Promise<AddressData | null> => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Remove data:image/jpeg;base64, prefix if present
        const base64Data = base64Image.split(',')[1] || base64Image;

        const prompt = `Analyze this shipping label and extract the delivery information. 
        Return ONLY a JSON object with these keys: 
        "address" (street and number), 
        "neighborhood", 
        "city", 
        "recipientName", 
        "notes" (any other relevant info).
        If you can't find a field, leave it empty.
        Respond ONLY with the JSON.`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: "image/jpeg"
                }
            }
        ]);

        const response = await result.response;
        const text = response.text().trim();

        // Basic JSON extraction
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return null;
    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        return null;
    }
};
