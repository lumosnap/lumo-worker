import { createDb } from "../src/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Environment } from "../src/env";
import { plans } from "../src/db/schema/billing";
import { profiles } from "../src/db/schema/profiles";
import { albums } from "../src/db/schema/albums";

// Mock environment for testing
const testEnv: Partial<Environment> = {
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/lumosnap_dev",
  BETTER_AUTH_SECRET: "kKu3stiDEKoK9XeB0FNo1Js0yjGqs3Gig8BEpRqc924=",
  BETTER_AUTH_URL: "http://localhost:8787",
  SUPABASE_URL: "http://localhost:5432",
  SUPABASE_SERVICE_ROLE_KEY: "test-key",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
  SCALAR_OPENAPI_CLIENT_KEY: "b4582a0e41d4b49ff1e03018843c9eaf",
  SCALAR_OPENAPI_DOC_KEY: "c329842399df7ff3a729b4372e7a8ce0",
  BACKBLAZE_API_KEY_ID: "test-backblaze-key-id",
  BACKBLAZE_API_KEY: "test-backblaze-key",
  BACKBLAZE_BUCKET_ID: "test-bucket-id",
  BACKBLAZE_BUCKET_NAME: "test-bucket-name",
  LOG_LEVEL: "debug",
  NODE_ENV: "development",
};

async function seedDatabase() {
  console.log("🌱 Seeding development database...");
  
  try {
    const { db } = createDb(testEnv as Environment);

    // Seed subscription plans
    console.log("📋 Seeding subscription plans...");
    
    const plansData = [
      {
        name: "free" as const,
        displayName: "Free",
        priceMonthly: "0.00",
        storageLimit: 1073741824, // 1GB in bytes
        maxAlbums: 5,
        features: {
          photos: "100 photos per album",
          storage: "1GB storage",
          albums: "5 albums",
          support: "Email support"
        },
        isActive: true,
      },
      {
        name: "pro" as const,
        displayName: "Professional",
        priceMonthly: "9.99",
        storageLimit: 107374182400, // 100GB in bytes
        maxAlbums: 50,
        features: {
          photos: "Unlimited photos per album",
          storage: "100GB storage",
          albums: "50 albums",
          support: "Priority support",
          analytics: "Basic analytics",
          customBranding: "Custom branding"
        },
        isActive: true,
      },
      {
        name: "business" as const,
        displayName: "Business",
        priceMonthly: "29.99",
        storageLimit: 1073741824000, // 1TB in bytes
        maxAlbums: 500,
        features: {
          photos: "Unlimited photos per album",
          storage: "1TB storage",
          albums: "500 albums",
          support: "24/7 phone support",
          analytics: "Advanced analytics",
          customBranding: "White-label option",
          teamMembers: "Up to 10 team members",
          apiAccess: "API access"
        },
        isActive: true,
      },
    ];

    await db.insert(plans).values(plansData).onConflictDoNothing();
    console.log("✅ Subscription plans seeded successfully!");

    // Create a test user profile (you'll need to create the actual user via auth first)
    console.log("👤 Creating test user profile template...");
    // Note: This will only work after a user is created through Better Auth
    // The user will need to sign up first, then we can create their profile
    
    console.log("🎯 Sample data for testing:");
    console.log("1. Create a user account via: POST /api/auth/sign-up");
    console.log("2. Sign in via: POST /api/auth/sign-in");
    console.log("3. Then you can test profile management and album creation");
    
    console.log("\n📊 Seeded Plans Summary:");
    const seededPlans = await db.select().from(plans);
    seededPlans.forEach(plan => {
      console.log(`- ${plan.displayName}: $${plan.priceMonthly}/month, ${plan.maxAlbums} albums`);
    });

    console.log("\n🎉 Database seeding complete!");
    
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

// Run the seeding function
seedDatabase()
  .then(() => {
    console.log("✅ Seeding completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  });