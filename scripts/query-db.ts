
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env.local');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

async function getProfile() {
    console.log('Querying profile data...');

    try {
        // 1. Get Profile Summary Specs
        // const [expCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.experiences);
        // const [projCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.projects);
        // const [certCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.certifications);
        // const [skillCount] = await db.select({ count: sql<number>`count(*)` }).from(schema.skills);

        // Using raw counts for simplicity in script or just separate queries
        const experiences = await db.select().from(schema.experiences);
        const projects = await db.select().from(schema.projects);
        const certifications = await db.select().from(schema.certifications);
        const skills = await db.select().from(schema.skills);

        // Get Site Settings
        const profileSettings = await db
            .select()
            .from(schema.siteSettings)
            .where(eq(schema.siteSettings.category, "profile"));

        const profile = {
            name: "Bharadwaz Kari",
            headline: "Senior Cloud Architect & DevOps Leader",
            yearsOfExperience: "15+",
            stats: {
                experiences: experiences.length,
                projects: projects.length,
                certifications: certifications.length,
                skills: skills.length,
            }
        };

        profileSettings.forEach((setting) => {
            profile[setting.key] = setting.value;
        });

        console.log('--- PROFILE SUMMARY ---');
        console.log(JSON.stringify(profile, null, 2));

        console.log('\n--- TOP SKILLS ---');
        const topSkills = skills
            .sort((a, b) => (b.proficiency || 0) - (a.proficiency || 0))
            .slice(0, 10)
            .map(s => `${s.name} (${s.proficiency}%)`);
        console.log(topSkills.join(', '));

        console.log('\n--- LATEST EXPERIENCE ---');
        const currentExp = experiences.find(e => e.isCurrent);
        if (currentExp) {
            console.log(`${currentExp.title} at ${currentExp.company}`);
            console.log(currentExp.description);
        } else {
            console.log("No current experience found.");
        }

    } catch (error) {
        console.error('Error querying database:', error);
    } finally {
        await pool.end();
    }
}

getProfile();
