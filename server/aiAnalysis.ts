import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

export interface ReceiptAnalysis {
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  items: Array<{
    description: string;
    quantity: number;
    price: number;
  }>;
  taxAmount?: number;
  confidence: number;
  category: string;
}

export interface DocumentAnalysis {
  documentType: string;
  keyFields: Record<string, any>;
  confidence: number;
  summary: string;
  extractedText: string;
}

export interface AssetValuation {
  estimatedValue: number;
  currency: string;
  confidence: number;
  factors: string[];
  marketComparisons?: Array<{
    source: string;
    price: number;
    similarity: number;
  }>;
}

export class AIAnalysisService {
  async analyzeReceipt(base64Image: string): Promise<ReceiptAnalysis> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert receipt analyzer. Analyze the receipt image and extract structured data. 
                     Respond with JSON in this exact format: {
                       "merchant": string,
                       "amount": number,
                       "currency": string,
                       "date": string (ISO format),
                       "items": [{"description": string, "quantity": number, "price": number}],
                       "taxAmount": number,
                       "confidence": number (0-1),
                       "category": string
                     }`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this receipt and extract all the key information including merchant, total amount, date, individual items, and tax amount."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result as ReceiptAnalysis;
    } catch (error) {
      throw new Error("Failed to analyze receipt: " + (error as Error).message);
    }
  }

  async analyzeDocument(base64Image: string): Promise<DocumentAnalysis> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert document analyzer. Analyze the document image and extract structured data.
                     Respond with JSON in this exact format: {
                       "documentType": string,
                       "keyFields": object,
                       "confidence": number (0-1),
                       "summary": string,
                       "extractedText": string
                     }`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this document and extract the document type, key fields, and provide a summary of the content."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result as DocumentAnalysis;
    } catch (error) {
      throw new Error("Failed to analyze document: " + (error as Error).message);
    }
  }

  async analyzeAssetPhoto(base64Image: string, assetType: string): Promise<AssetValuation> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert asset appraiser. Analyze the asset photo and provide valuation insights.
                     Respond with JSON in this exact format: {
                       "estimatedValue": number,
                       "currency": string,
                       "confidence": number (0-1),
                       "factors": [string],
                       "marketComparisons": [{"source": string, "price": number, "similarity": number}]
                     }`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this ${assetType} photo and provide an estimated value based on visible condition, brand, model, and other factors. Include factors that influenced your valuation.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result as AssetValuation;
    } catch (error) {
      throw new Error("Failed to analyze asset: " + (error as Error).message);
    }
  }

  async generateLegalDocument(templateType: string, assetData: any, jurisdiction: string): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert legal document generator. Generate a professional ${templateType} document for ${jurisdiction} jurisdiction. Use proper legal formatting and language.`
          },
          {
            role: "user",
            content: `Generate a ${templateType} document with the following asset information: ${JSON.stringify(assetData)}. Include all necessary legal clauses and make it court-ready.`
          },
        ],
        max_tokens: 2000,
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      throw new Error("Failed to generate legal document: " + (error as Error).message);
    }
  }

  async calculateTrustScore(asset: any, evidence: any[]): Promise<number> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a trust scoring expert. Analyze the asset and evidence data to calculate a trust score from 0.0 to 100.0.
                     Respond with JSON: {"trustScore": number, "factors": [string]}`
          },
          {
            role: "user",
            content: `Calculate trust score for this asset: ${JSON.stringify(asset)} with evidence: ${JSON.stringify(evidence)}. Consider verification status, documentation completeness, blockchain verification, and source credibility.`
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
      });

      const result = JSON.parse(response.choices[0].message.content || '{"trustScore": 0}');
      return Math.max(0, Math.min(100, result.trustScore));
    } catch (error) {
      console.error("Failed to calculate trust score:", error);
      return 0;
    }
  }
}

export const aiAnalysisService = new AIAnalysisService();
