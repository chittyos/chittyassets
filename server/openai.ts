import OpenAI from "openai";
import { File } from "@google-cloud/storage";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

// Analyze asset documents using AI vision
export async function analyzeAssetDocument(
  file: File, 
  documentType: string, 
  mimeType: string | undefined
): Promise<{ aiAnalysis: any; extractedData: any } | null> {
  try {
    if (!mimeType?.startsWith('image/')) {
      console.log("Skipping AI analysis - not an image file");
      return null;
    }

    // Get the file as base64
    const [fileBuffer] = await file.download();
    const base64Image = fileBuffer.toString('base64');

    // Use GPT-4o for document analysis
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert asset documentation analyst. Analyze the provided ${documentType} image and extract relevant information. Return structured JSON data with extracted details and analysis insights.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this ${documentType} document and extract all relevant information including: dates, amounts, vendor information, product details, warranty information, serial numbers, model numbers, and any other important asset-related data. Provide both extracted structured data and analytical insights.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });

    const analysisResult = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      aiAnalysis: {
        confidence: analysisResult.confidence || 0.8,
        documentType: analysisResult.document_type || documentType,
        extractionMethod: "openai-gpt4o-vision",
        analysisDate: new Date().toISOString(),
        insights: analysisResult.insights || [],
        qualityScore: analysisResult.quality_score || 0.8
      },
      extractedData: {
        vendor: analysisResult.vendor || null,
        amount: analysisResult.amount || null,
        date: analysisResult.date || null,
        items: analysisResult.items || [],
        serialNumber: analysisResult.serial_number || null,
        model: analysisResult.model || null,
        brand: analysisResult.brand || null,
        category: analysisResult.category || null,
        warranty: analysisResult.warranty || null,
        additionalDetails: analysisResult.additional_details || {}
      }
    };
  } catch (error) {
    console.error("Error analyzing document with OpenAI:", error);
    return null;
  }
}

// Extract specific receipt data
export async function extractReceiptData(imageUrl: string): Promise<any> {
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a receipt analysis expert. Extract structured data from receipt images including merchant, date, total amount, tax, items, and payment method. Return valid JSON only."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all data from this receipt including: merchant name, date, total amount, tax amount, individual items with prices, payment method, and any other relevant details. Return as structured JSON."
            },
            {
              type: "image_url",
              image_url: { url: imageUrl }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    console.error("Error extracting receipt data:", error);
    throw new Error("Failed to analyze receipt: " + (error as Error).message);
  }
}

// Generate legal document content
export async function generateLegalDocument(
  templateType: string,
  assetData: any,
  ownerData: any
): Promise<string> {
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a legal document generation expert. Create a properly formatted ${templateType} document with official legal language, proper structure, and all necessary legal clauses.`
        },
        {
          role: "user",
          content: `Generate a ${templateType} document for the following asset and owner information:

Asset Details:
${JSON.stringify(assetData, null, 2)}

Owner Details:
${JSON.stringify(ownerData, null, 2)}

Include proper legal formatting, official language, signature blocks, notarization sections, and blockchain verification sections where appropriate.`
        }
      ],
      max_tokens: 2000,
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("Error generating legal document:", error);
    throw new Error("Failed to generate legal document: " + (error as Error).message);
  }
}

// Calculate trust score based on asset data
export async function calculateAssetTrustScore(assetData: any): Promise<number> {
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a trust scoring expert. Analyze asset data and calculate a trust score from 0.0 to 1.0 based on verification factors, document quality, blockchain verification, and data completeness. Return only a JSON object with the score and reasoning."
        },
        {
          role: "user",
          content: `Calculate a trust score for this asset data:
${JSON.stringify(assetData, null, 2)}

Consider factors like:
- Document completeness and quality
- Verification status
- Blockchain/immutable evidence
- Cross-reference consistency
- Time factors
- Source credibility

Return JSON format: { "score": 0.85, "factors": [...], "reasoning": "..." }`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content || '{"score": 0.5}');
    return Math.max(0, Math.min(1, result.score || 0.5));
  } catch (error) {
    console.error("Error calculating trust score:", error);
    return 0.5; // Default moderate trust score
  }
}
