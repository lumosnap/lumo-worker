import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { plans } from "../src/db/schema/billing";
import { eq } from "drizzle-orm";

config({ path: ".dev.vars" });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("DATABASE_URL is not set in .dev.vars");
    process.exit(1);
}

async function seed() {
    console.log("🌱 Seeding database...");

    const client = postgres(DATABASE_URL!);
    const db = drizzle(client);

    // Default plans
    const defaultPlans = [
        { name: "trial", displayName: "Trial", priceMonthly: "0.00", imageLimit: 500, description: "Free trial plan with limited uploads", isActive: true },
        { name: "starter", displayName: "Starter", priceMonthly: "9.99", imageLimit: 50000, description: "For hobbyists and small projects", isActive: true },
    ];

    for (const plan of defaultPlans) {
        const [existing] = await db.select().from(plans).where(eq(plans.name, plan.name));
        if (!existing) {
            await db.insert(plans).values(plan);
            console.log(`  ✅ Created plan: ${plan.displayName}`);
        } else {
            console.log(`  ⏭️  Plan already exists: ${plan.displayName}`);
        }
    }

    console.log("🎉 Seeding complete!");
    await client.end();
    process.exit(0);
}

seed().catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
});
