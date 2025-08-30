import { storage } from "./storage";
import { chittyCloudMcp } from "./chittyCloudMcp";

export async function seedDemoData(userId: string) {
  try {
    // Create demo assets with ChittyChain integration
    const demoAssets = [
      {
        userId,
        name: "MacBook Pro 16-inch",
        description: "High-performance laptop for professional work with M3 Max chip",
        assetType: "electronics" as const,
        status: "active" as const,
        purchasePrice: "3499.00",
        currentValue: "2800.00",
        purchaseDate: new Date("2024-01-15"),
        location: "Home Office",
        serialNumber: "MBP2024001",
        model: "MacBook Pro 16-inch",
        manufacturer: "Apple",
        condition: "excellent",
        trustScore: "92.5",
        chittyId: await chittyCloudMcp.generateChittyId(),
        verificationStatus: "verified" as const,
        chittyChainStatus: "minted" as const,
        tags: ["work", "computer", "apple", "high-value"],
        metadata: {
          warranty: "AppleCare+ until 2027",
          specifications: {
            processor: "M3 Max",
            memory: "32GB",
            storage: "1TB SSD"
          }
        }
      },
      {
        userId,
        name: "2023 Tesla Model Y",
        description: "Electric SUV with Full Self-Driving capability",
        assetType: "vehicle" as const,
        status: "active" as const,
        purchasePrice: "68990.00",
        currentValue: "58500.00",
        purchaseDate: new Date("2023-06-20"),
        location: "Garage",
        serialNumber: "5YJYGDEE3NF123456",
        model: "Model Y",
        manufacturer: "Tesla",
        condition: "excellent",
        trustScore: "96.8",
        chittyId: await chittyCloudMcp.generateChittyId(),
        verificationStatus: "verified" as const,
        chittyChainStatus: "settled" as const,
        tags: ["vehicle", "electric", "tesla", "high-value"],
        metadata: {
          vin: "5YJYGDEE3NF123456",
          features: ["Full Self-Driving", "Premium Interior", "Tow Package"],
          color: "Pearl White Multi-Coat"
        }
      },
      {
        userId,
        name: "Rolex Submariner",
        description: "Luxury diving watch with ceramic bezel",
        assetType: "jewelry" as const,
        status: "active" as const,
        purchasePrice: "9550.00",
        currentValue: "12500.00",
        purchaseDate: new Date("2022-12-10"),
        location: "Safe Deposit Box",
        serialNumber: "11649325",
        model: "Submariner Date",
        manufacturer: "Rolex",
        condition: "mint",
        trustScore: "98.2",
        chittyId: await chittyCloudMcp.generateChittyId(),
        verificationStatus: "verified" as const,
        chittyChainStatus: "settled" as const,
        tags: ["luxury", "watch", "rolex", "investment"],
        metadata: {
          reference: "126610LV",
          movement: "Caliber 3235",
          authentication: "Certified by Rolex"
        }
      },
      {
        userId,
        name: "Original Picasso Sketch",
        description: "Pencil sketch from Pablo Picasso's Blue Period",
        assetType: "artwork" as const,
        status: "active" as const,
        purchasePrice: "45000.00",
        currentValue: "78000.00",
        purchaseDate: new Date("2020-08-15"),
        location: "Climate-Controlled Storage",
        serialNumber: "PP1904-BS",
        model: "Blue Period Sketch",
        manufacturer: "Pablo Picasso",
        condition: "excellent",
        trustScore: "94.7",
        chittyId: await chittyCloudMcp.generateChittyId(),
        verificationStatus: "verified" as const,
        chittyChainStatus: "frozen" as const,
        freezeTimestamp: new Date(),
        tags: ["art", "picasso", "investment", "collectible"],
        metadata: {
          provenance: "Authenticated by Picasso Foundation",
          dimensions: "12x16 inches",
          medium: "Pencil on paper"
        }
      },
      {
        userId,
        name: "Home Office Property",
        description: "Commercial property used as home office and studio",
        assetType: "real_estate" as const,
        status: "active" as const,
        purchasePrice: "650000.00",
        currentValue: "825000.00",
        purchaseDate: new Date("2021-03-10"),
        location: "123 Innovation Drive, Tech City",
        serialNumber: "PROP-2021-001",
        model: "Commercial Office Space",
        manufacturer: "Custom Build",
        condition: "excellent",
        trustScore: "89.3",
        chittyId: await chittyCloudMcp.generateChittyId(),
        verificationStatus: "pending" as const,
        chittyChainStatus: "draft" as const,
        tags: ["real-estate", "commercial", "office", "investment"],
        metadata: {
          sqft: "2500",
          zoning: "Commercial",
          taxId: "123-456-789"
        }
      }
    ];

    // Create the assets
    for (const assetData of demoAssets) {
      await storage.createAsset(assetData);
    }

    console.log(`Created ${demoAssets.length} demo assets for user ${userId}`);
    return demoAssets.length;
  } catch (error) {
    console.error("Error seeding demo data:", error);
    throw error;
  }
}