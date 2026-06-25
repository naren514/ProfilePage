/**
 * Naren Challa – Profile Seed Script
 *
 * Populates the database with resume data: site settings (hero, about, skills,
 * contact), work experience, and certifications.
 *
 * Usage: npm run db:seed
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { experiences, certifications, siteSettings, projects } from "./schema";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

// ============================================================
// SITE SETTINGS
// ============================================================

const heroSettings = {
  name: "Naren Challa",
  title: "Solution Architect – Enterprise Business Applications",
  location: "Toronto, ON",
  subtitle:
    "Enterprise applications leader with 18+ years directing the strategy, implementation, and lifecycle management of ERP-centric platforms — Oracle OTM/GTM, Oracle Fusion, Oracle EBS, and SAP — in complex manufacturing, retail, and high-tech environments.",
  stats: [
    { label: "Years of Experience", value: "18+" },
    { label: "Enterprise Clients", value: "7+" },
    { label: "Cloud Cost Reduction", value: "60%" },
    { label: "Driver Utilization Gain", value: "30%" },
  ],
};

const aboutSettings = {
  headline: "Enterprise Applications Leader Across Supply Chain & Manufacturing",
  description:
    "I specialize in directing strategy, implementation, and lifecycle management of ERP-centric platforms — Oracle OTM/GTM, Oracle Fusion, Oracle EBS, and SAP — for some of the world's most demanding environments including Meta, lululemon, Kraft/Mondelez, and Milwaukee Tool. I translate business priorities into technology roadmaps, lead blended global teams of up to 16, and deliver measurable outcomes with full ownership from architecture governance through post-go-live stabilization.",
  features: [
    {
      name: "TMS & ERP Architecture",
      description:
        "Deep expertise in Oracle OTM/GTM, Oracle Fusion, Oracle EBS, and SAP — from business case and design through implementation and stabilization across manufacturing, retail, and high-tech industries.",
    },
    {
      name: "Cloud & Integration",
      description:
        "AWS (S3, SQS, EC2, API Gateway), Oracle Cloud Infrastructure, MuleSoft, Kafka, and Snowflake — designing scalable, governed integration patterns that replace legacy point-to-point architectures.",
    },
    {
      name: "Global Team Leadership",
      description:
        "Leading blended teams of up to 16 across onsite, offshore, vendor, and systems-integrator groups through complex multi-workstream enterprise deliveries and M&A integration events.",
    },
    {
      name: "Supply Chain Optimization",
      description:
        "Tuning planning, capacity-allocation, and compliance workflows against operational KPIs — OTIF, equipment utilization, lead time, and dwell — delivering outcomes including 60% cloud cost reduction and 30% driver-utilization improvement.",
    },
  ],
};

const skillsSettings = [
  {
    name: "Enterprise Applications",
    skills: [
      "Oracle Transportation Management (OTM)",
      "Oracle Global Trade Management (GTM)",
      "Oracle Fusion",
      "Oracle EBS",
      "SAP (FICO Integration)",
      "E2Open",
    ],
  },
  {
    name: "Cloud & Data",
    skills: [
      "AWS (S3, SQS, EC2, API Gateway)",
      "Oracle Cloud Infrastructure (OCI)",
      "Kafka",
      "Snowflake",
      "PostgreSQL",
      "SQL",
      "Power BI",
    ],
  },
  {
    name: "Integration & Governance",
    skills: [
      "REST APIs",
      "OpenAPI",
      "MuleSoft",
      "Oracle Integration Cloud (OIC)",
      "EDI (204, 210, 214, 990)",
      "API Security",
      "Architecture Governance",
    ],
  },
  {
    name: "Leadership & Delivery",
    skills: [
      "Technology Roadmaps",
      "Vendor & SI Management",
      "Offshore/Nearshore Delivery",
      "Change Management",
      "Incident & Release Management (ITIL)",
      "Go-Live & Hypercare",
    ],
  },
];

const contactSettings = {
  email: "in.naren@gmail.com",
  linkedin: "linkedin.com/in/nchalla",
  phone: "+1 608-886-1295",
};

// ============================================================
// EXPERIENCE DATA
// ============================================================

const experienceData = [
  {
    company: "Meta Platforms",
    title: "Solution Architect",
    location: "Toronto, ON (Remote)",
    employmentType: "full-time",
    startDate: "2024-08-01",
    endDate: null,
    isCurrent: true,
    description:
      "Lead solution strategy, design, and implementation for enterprise logistics and global trade applications, spanning order management, planning, contract and rate management, shipment visibility, and Oracle Fusion/OMS integrations via MuleSoft.",
    achievements: [
      "Created a configuration-workbook model enabling scalable operational handover of new shipping lanes without dedicated project support.",
      "Tuned planning and capacity-allocation rules against operational KPIs — OTIF, equipment utilization, lead time, and dwell — improving ocean containerization and volume utilization.",
      "Standardized carrier and distribution-center onboarding across APAC and North America, consolidating EDI and API integrations into repeatable, governed patterns.",
      "Established global trade compliance workflows and controls for product classification, restricted-party screening, transaction screening, and trade-document generation.",
      "Built reporting and exception-visibility tooling enabling business teams and customs brokers to monitor application health and act proactively.",
    ],
    technologies: [
      "Oracle OTM",
      "Oracle GTM",
      "Oracle Fusion",
      "MuleSoft",
      "EDI",
      "REST APIs",
    ],
    sortOrder: 1,
  },
  {
    company: "lululemon Athletica",
    title: "Lead Architect",
    location: "Vancouver, BC (Remote)",
    employmentType: "full-time",
    startDate: "2022-11-01",
    endDate: "2024-07-31",
    isCurrent: false,
    description:
      "Led architecture and delivery of the enterprise shipping, rating, address-validation, and routing API platform powering guest-order fulfillment across 7 distribution centers and 500+ stores.",
    achievements: [
      "Designed an AWS-based microservice and orchestration architecture optimized for high-throughput transportation execution, reducing technical debt from legacy point-to-point integrations.",
      "Reduced AWS spend by up to 60% through cloud cost-optimization initiatives, alongside peak-readiness testing and performance remediation.",
      "Managed integration of 5 parcel carriers — UPS, USPS, FedEx, Canada Post, and Australia Post — standardizing vendor onboarding patterns and improving operational observability.",
      "Modernized inbound logistics data architecture on AWS and Snowflake; designed a product-classification service determining classification codes and duty rates by destination country, with Kafka/Postgres integration to E2Open.",
    ],
    technologies: [
      "AWS (S3, SQS, EC2, API Gateway)",
      "Snowflake",
      "Kafka",
      "PostgreSQL",
      "E2Open",
      "REST APIs",
      "OpenAPI",
    ],
    sortOrder: 2,
  },
  {
    company: "Inspirage",
    title: "Senior Principal Consultant",
    location: "Remote",
    employmentType: "full-time",
    startDate: "2021-12-01",
    endDate: "2022-11-30",
    isCurrent: false,
    description:
      "Led enterprise application modernization for Milwaukee Tool, a global manufacturer, delivering global trade management across the United States, Canada, and Mexico on AWS/Kafka integration architecture.",
    achievements: [
      "Designed a custom AWS regulation engine (S3, SQS, EC2, API Gateway) that validates streaming orders, enforces sourcing conditions, and automates compliance decisioning — improving compliance-team productivity through automation.",
      "Produced TMS transformation solution designs for inbound and outbound freight, targeting OTIF, equipment-utilization, lead-time, and dwell improvements.",
      "Managed implementation from requirements and conference-room-pilot sessions through process documentation, standardization, and go-live readiness.",
    ],
    technologies: [
      "Oracle GTM",
      "AWS (S3, SQS, EC2, API Gateway)",
      "Kafka",
      "Oracle OTM",
      "REST APIs",
    ],
    sortOrder: 3,
  },
  {
    company: "Oracle",
    title: "Principal Consultant",
    location: "Remote / Various",
    employmentType: "full-time",
    startDate: "2015-01-01",
    endDate: "2021-12-31",
    isCurrent: false,
    description:
      "Served as trusted advisor to enterprise customers — manufacturers, retailers, and logistics providers — implementing and optimizing OTM and GTM on programs ranging from $3M to $250M freight under management, from business case through stabilization.",
    achievements: [
      "Led multiple implementation workstreams, translating business strategy into application roadmaps and facilitating design decisions with business leaders, IT partners, and super users migrating from legacy platforms.",
      "Designed a multi-segment planning solution that improved driver utilization by 30%.",
      "Delivered carrier self-service onboarding, air-freight spot-bid and rate automation, and customs documentation with electronic filing.",
      "Built integration patterns spanning parcel carriers, digital freight brokerages, mapping engines, Oracle Fusion, and Oracle Integration Cloud.",
      "Stabilized application environments through cloud migrations, go-lives, and quarterly release cycles — managing incident triage, change, and continuous improvement — while mentoring customer and delivery teams.",
    ],
    technologies: [
      "Oracle OTM",
      "Oracle GTM",
      "Oracle Fusion",
      "Oracle Integration Cloud (OIC)",
      "EDI",
      "REST APIs",
    ],
    sortOrder: 4,
  },
  {
    company: "Payless ShoeSource",
    title: "Solution Architect – TMS",
    location: "Topeka, KS",
    employmentType: "full-time",
    startDate: "2014-01-01",
    endDate: "2015-12-31",
    isCurrent: false,
    description:
      "Led international inbound and outbound OTM implementation, enabling advanced planning, freight-cost optimization, and improved shipment visibility.",
    achievements: [
      "Designed workflows across master data, allocation, order management, planning and tendering, tracking, financials, carrier portal, and analytics.",
      "Trained users across multiple geographies on new transportation management processes and platform capabilities.",
    ],
    technologies: ["Oracle OTM", "EDI"],
    sortOrder: 5,
  },
  {
    company: "Starbucks Coffee Company",
    title: "TMS Subject-Matter Expert",
    location: "Seattle, WA",
    employmentType: "full-time",
    startDate: "2013-01-01",
    endDate: "2014-12-31",
    isCurrent: false,
    description:
      "Deployed Oracle EBS-to-OTM interfaces for pick release and ship confirm; implemented a drayage solution and supported design and rollout of the service-provider portal.",
    achievements: [
      "Deployed Oracle EBS-to-OTM interfaces for pick release and ship confirm.",
      "Implemented a drayage solution and supported design and rollout of the service-provider portal.",
    ],
    technologies: ["Oracle OTM", "Oracle EBS", "EDI"],
    sortOrder: 6,
  },
  {
    company: "Kraft Foods / Mondelez International",
    title: "OTM Developer",
    location: "Chicago, IL",
    employmentType: "full-time",
    startDate: "2008-01-01",
    endDate: "2013-12-31",
    isCurrent: false,
    description:
      "Delivered application integration for major M&A events in a global manufacturing environment — the Kraft–Cadbury acquisition and the Kraft–Mondelez corporate spin-off — alongside Brazil and Canada market implementations.",
    achievements: [
      "Delivered application integration for the Kraft–Cadbury acquisition and the Kraft–Mondelez corporate spin-off.",
      "Built SAP-to-OTM master-data interfaces, freight-pay/SAP FICO integration, EDI flows (204, 210, 990, 214), custom screens, and detention-tracking processes supporting operations and data integrity.",
      "Led Brazil and Canada market implementations.",
    ],
    technologies: ["Oracle OTM", "SAP", "EDI (204, 210, 990, 214)", "SQL"],
    sortOrder: 7,
  },
];

// ============================================================
// PROJECTS DATA
// ============================================================

const projectsData = [
  {
    slug: "aws-transportation-execution-platform",
    title: "AWS Transportation Execution Platform",
    summary:
      "Redesigned lululemon's shipping, rating, address-validation, and routing API platform for high-throughput guest-order fulfillment across 7 distribution centers and 500+ stores — reducing AWS spend by 60% and integrating 5 parcel carriers under standardized onboarding patterns.",
    company: "lululemon Athletica",
    role: "Lead Architect",
    startDate: "2022-11-01",
    endDate: "2024-07-31",
    situation:
      "lululemon's guest-order fulfillment relied on legacy point-to-point integrations connecting 7 distribution centers and 500+ stores to 5 parcel carriers (UPS, USPS, FedEx, Canada Post, Australia Post). The architecture had accumulated significant technical debt, lacked operational observability, and was driving up AWS infrastructure costs — while peak-season demand left no margin for unplanned downtime.",
    task: "Redesign the core transportation execution platform — shipping, rating, address-validation, and routing — to handle high-throughput order volume, reduce infrastructure spend, simplify carrier onboarding, and give operations teams real-time visibility into platform health.",
    action:
      "Designed an AWS-based microservice and orchestration architecture (S3, SQS, EC2, API Gateway) optimized for transportation execution throughput. Ran targeted cloud cost-optimization initiatives against over-provisioned services and idle resources. Standardized carrier integration patterns across all 5 parcel carriers to eliminate bespoke onboarding work for each new carrier. Modernized the inbound logistics data architecture on AWS and Snowflake, designing a product-classification service that determines classification codes and duty rates by destination country — integrated via Kafka and Postgres into E2Open.",
    result:
      "Reduced AWS spend by up to 60% through cost-optimization. All 5 parcel carriers now operate under unified onboarding and monitoring patterns, reducing future time-to-integrate. Improved operational observability across distribution centers and stores. Inbound product classification runs automatically at order time, replacing a manual compliance process.",
    lessonsLearned:
      "Cost optimization and performance optimization are often in tension — the discipline is knowing which trade-off a given service can tolerate at peak. Standardizing carrier onboarding patterns before the fourth carrier rather than after would have recovered significant engineering time.",
    technologies: [
      "AWS (S3, SQS, EC2, API Gateway)",
      "Snowflake",
      "Kafka",
      "PostgreSQL",
      "E2Open",
      "REST APIs",
      "OpenAPI",
    ],
    isFeatured: true,
    isPublished: true,
    sortOrder: 1,
  },
  {
    slug: "global-trade-compliance-platform",
    title: "Global Trade Compliance & Carrier Onboarding — Meta",
    summary:
      "Designed and implemented Meta's global trade management platform spanning product classification, restricted-party screening, trade-document generation, and carrier/DC onboarding across APAC and North America — establishing compliance workflows and exception-visibility tooling from the ground up.",
    company: "Meta Platforms",
    role: "Solution Architect",
    startDate: "2024-08-01",
    endDate: null,
    situation:
      "Meta's logistics and global trade operations lacked standardized compliance workflows and a repeatable carrier integration model. New shipping lanes required dedicated project effort each time, customs documentation was inconsistent across markets, and business teams had limited visibility into application health — leaving compliance risk unmitigated at scale.",
    task: "Design and implement the enterprise global trade management platform covering the full compliance lifecycle: product classification, restricted-party screening, transaction screening, trade-document generation, and carrier/DC onboarding across APAC and North American lanes.",
    action:
      "Established global trade compliance workflows and controls across four pillars: product classification, restricted-party screening, transaction screening, and trade-document generation. Standardized carrier and distribution-center onboarding across APAC and North America, consolidating EDI and API integrations into governed, repeatable patterns. Created a configuration-workbook model enabling scalable operational handover of new shipping lanes without requiring dedicated project support. Built reporting and exception-visibility tooling so business teams and customs brokers could monitor application health and act proactively rather than reactively.",
    result:
      "Carrier and DC onboarding across APAC and NA now follows a single governed integration model. New shipping lanes can be activated via configuration without engineering project work. Compliance workflows cover the full trade lifecycle from order to customs clearance. Business teams and customs brokers have proactive visibility into platform health, reducing reactive incident management.",
    technologies: ["Oracle OTM", "Oracle GTM", "Oracle Fusion", "MuleSoft", "EDI", "REST APIs"],
    isFeatured: true,
    isPublished: true,
    sortOrder: 2,
  },
  {
    slug: "aws-regulation-engine-milwaukee-tool",
    title: "Custom AWS Regulation Engine for Global Trade",
    summary:
      "Designed a real-time AWS regulation engine that validates streaming orders, enforces sourcing conditions, and automates compliance decisioning for Milwaukee Tool's US, Canada, and Mexico trade operations — replacing a manual compliance review process.",
    company: "Milwaukee Tool (via Inspirage)",
    role: "Senior Principal Consultant",
    startDate: "2021-12-01",
    endDate: "2022-11-30",
    situation:
      "Milwaukee Tool, a global power-tool manufacturer, was expanding trade operations across the United States, Canada, and Mexico. Compliance decisions — sourcing restrictions, trade regulations, classification enforcement — were handled manually, creating bottlenecks that scaled poorly as order volume grew.",
    task: "Design an automated regulation engine capable of validating orders at streaming volume, enforcing sourcing conditions in real time, and automating compliance decisioning to free the compliance team from routine validation work.",
    action:
      "Designed and delivered a custom AWS architecture using S3, SQS, EC2, and API Gateway as the core of a streaming order-validation pipeline. The engine processes inbound orders, validates against trade regulations and sourcing conditions, and triggers automated compliance decisions — routing exceptions to compliance-team queues for human review. Integrated Oracle GTM for global trade management across the three markets. Managed the full implementation lifecycle from requirements and conference-room-pilot sessions through process documentation, standardization, and go-live readiness.",
    result:
      "Compliance-team productivity improved through automation of deterministic decisions — analysts now focus on exceptions rather than routine validation. The streaming architecture handles order bursts without queue buildup. Standardized integration patterns are reusable as Milwaukee Tool expands to additional trade lanes.",
    technologies: ["Oracle GTM", "AWS (S3, SQS, EC2, API Gateway)", "Kafka", "Oracle OTM", "REST APIs"],
    isFeatured: true,
    isPublished: true,
    sortOrder: 3,
  },
  {
    slug: "tms-multi-segment-planning",
    title: "Multi-Segment TMS Planning — 30% Driver Utilization Improvement",
    summary:
      "Designed a multi-segment transportation planning solution for an enterprise logistics client managing up to $250M freight under management — improving driver utilization by 30% and delivering carrier self-service onboarding, spot-bid automation, and customs documentation with electronic filing.",
    company: "Oracle",
    role: "Principal Consultant",
    startDate: "2015-01-01",
    endDate: "2021-12-31",
    situation:
      "An enterprise logistics customer was running fragmented transportation planning — separate workflows for each leg of multi-stop movements, with no unified optimization across segments. Driver utilization was constrained by planning gaps between legs, and carrier onboarding was a manual, time-intensive process on both sides.",
    task: "Design a multi-segment planning solution that optimizes across shipment legs, improves equipment and driver utilization, and reduces the operational overhead of carrier onboarding and freight tendering.",
    action:
      "Designed a multi-segment planning solution that unified optimization across shipment legs, enabling planners to consolidate loads and maximize equipment utilization per driver cycle. Delivered carrier self-service onboarding, eliminating the back-and-forth of manual carrier setup. Implemented air-freight spot-bid and rate automation, reducing manual tendering cycles. Built integration patterns spanning parcel carriers, digital freight brokerages, mapping engines, Oracle Fusion, and Oracle Integration Cloud.",
    result:
      "Driver utilization improved by 30% through consolidated multi-segment planning. Carrier self-service onboarding reduced onboarding lead time significantly. Spot-bid automation cut tendering cycle time for air freight. Electronic customs filing replaced a paper-based process.",
    technologies: [
      "Oracle OTM",
      "Oracle GTM",
      "Oracle Fusion",
      "Oracle Integration Cloud (OIC)",
      "EDI",
      "REST APIs",
    ],
    isFeatured: false,
    isPublished: true,
    sortOrder: 4,
  },
  {
    slug: "kraft-mondelez-ma-integration",
    title: "M&A Application Integration — Kraft-Cadbury & Kraft-Mondelez",
    summary:
      "Delivered application integration through two major M&A events in a global manufacturing environment — the Kraft-Cadbury acquisition and the Kraft-Mondelez corporate spin-off — alongside Brazil and Canada market implementations, with no disruption to ongoing freight operations.",
    company: "Kraft Foods / Mondelez International",
    role: "OTM Developer",
    startDate: "2008-01-01",
    endDate: "2013-12-31",
    situation:
      "Kraft Foods underwent two major corporate restructuring events within five years: the acquisition of Cadbury and the spin-off that created Mondelez International. Each event required rapid application integration — SAP and OTM systems had to reflect new organizational structures, legal entities, and trade flows without disrupting ongoing freight operations.",
    task: "Deliver application integration for both M&A events while simultaneously building out market implementations for Brazil and Canada, maintaining operational continuity throughout.",
    action:
      "Built SAP-to-OTM master-data interfaces to synchronize organizational and vendor data across the new corporate structures. Implemented freight-pay and SAP FICO integration to ensure financial flows reflected the new entity model. Built EDI flows (204, 210, 990, 214) for carrier communication. Developed custom screens and detention-tracking processes supporting operations and data integrity. Led Brazil and Canada market implementations in parallel, adapting global configurations to local regulatory and carrier requirements.",
    result:
      "Both M&A integrations delivered with no disruption to freight operations. Brazil and Canada market implementations went live on schedule. Reusable integration patterns established during this engagement became templates for subsequent market expansions.",
    technologies: ["Oracle OTM", "SAP", "EDI (204, 210, 990, 214)", "SQL"],
    isFeatured: false,
    isPublished: true,
    sortOrder: 5,
  },
];

// Education stored in siteSettings
const educationSettings = [
  {
    degree: "MBA — Operations and Supply Chain Management",
    institution: "University of Colorado Colorado Springs",
    year: "2016",
  },
  {
    degree: "Bachelor of Technology — Computer Science",
    institution: "JNT University, India",
    year: "2008",
  },
];

// Lab / open-source tools stored in siteSettings
const labSettings = [
  {
    title: "EDI Explainer",
    description:
      "AI-powered X12 EDI message analyzer for logistics and transportation teams. Paste a 204, 210, 214, or 990 payload and get row-level segment breakdowns with context, field definitions, and confidence scores. Includes a document ingestion pipeline for implementation guides and a persistent correction store to improve future explanations.",
    githubUrl: "https://github.com/naren514/ediexplainer",
    technologies: ["Next.js", "TypeScript", "OpenAI", "Prisma", "SQLite"],
    sortOrder: 1,
  },
  {
    title: "otmOS",
    description:
      "A consolidated web workspace for Oracle Transportation Management teams — replacing the usual sprawl of spreadsheets, static docs, and one-off scripts. Includes XML/JSON validation, XPath/JSONPath generation, payload inspection, a data dictionary and schema browser, SQL builder with relationship guidance, and QA test cycle management.",
    githubUrl: "https://github.com/naren514/otmOS",
    technologies: ["Next.js", "TypeScript"],
    sortOrder: 2,
  },
  {
    title: "ReleaseDataGen",
    description:
      "Streamlit app that generates and posts Oracle OTM Order Release XML payloads for dev and test environments. Supports manual entry, CSV/Excel import, and randomized test-data generation. Built-in safeguards block posting to production endpoints. Outputs individual XML files or ZIP batches.",
    githubUrl: "https://github.com/naren514/ReleaseDataGen",
    technologies: ["Python", "Streamlit", "Docker", "Google Cloud Run"],
    sortOrder: 3,
  },
  {
    title: "Fuel Surcharge Updater",
    description:
      "Automated service that fetches weekly U.S. diesel prices from the EIA API and posts updated rate factors to Oracle OTM — only when EIA data is fresher than what's already loaded. Supports dry-run mode, manual triggers, and scheduled execution. Designed for containerized deployment on Google Cloud Run.",
    githubUrl: "https://github.com/naren514/Fuel-surcharge-Updater",
    technologies: ["Python", "FastAPI", "Docker", "Google Cloud Scheduler", "EIA API"],
    sortOrder: 4,
  },
  {
    title: "Container & Vessel Tracker",
    description:
      "Lightweight vessel-visibility dashboard built on live AIS data. Input a vessel name and destination port to get real-time position and ETA. Accepts both manual CSV uploads and live WebSocket feeds from aisstream.io. No authentication required — built for supply chain teams that need quick vessel-level visibility without a full TMS.",
    githubUrl: "https://github.com/naren514/Container-Vessel-Tracker",
    technologies: ["Python", "Streamlit", "AISStream API", "Docker"],
    sortOrder: 5,
  },
  {
    title: "Parcel Rate Comparator",
    description:
      "Compare 2025 retail shipping rates across USPS, UPS, and FedEx in one shot. Enter origin ZIP, destination ZIP, weight, and package dimensions — get back rates for 6 services with DIM weight calculated per carrier, zone lookup, residential surcharges applied, and results sorted cheapest-first.",
    githubUrl: "https://github.com/naren514/parcel-rate-comparator",
    liveUrl: "https://parcel-rate-comparator.vercel.app",
    technologies: ["Next.js", "TypeScript", "Tailwind CSS"],
    sortOrder: 6,
  },
  {
    title: "Carrier Surcharge Tracker",
    description:
      "Track UPS and FedEx surcharge history from 2022 to present — fuel, residential, peak, and additional handling. Includes a monthly impact calculator: enter your package volume, average base rate, and residential mix to see exactly how much surcharges are adding to your shipping bill, with a Q4 peak warning built in.",
    githubUrl: "https://github.com/naren514/carrier-surcharge-tracker",
    liveUrl: "https://carrier-surcharge-tracker.vercel.app",
    technologies: ["Next.js", "TypeScript", "Recharts", "Tailwind CSS"],
    sortOrder: 7,
  },
];

// Professional certifications stored in siteSettings (not the reading list table)
const certificationsSettings = [
  { name: "Oracle TMS Implementation Specialist", issuer: "Oracle", year: "2019" },
  { name: "Oracle Cloud Infrastructure (OCI) Certified", issuer: "Oracle", year: "2020" },
  { name: "ITIL 4 Foundation", issuer: "AXELOS", year: "2021" },
];

// ============================================================
// SEED FUNCTION
// ============================================================

async function seed() {
  console.log("🌱 Seeding Naren Challa profile data...\n");

  // --- Site Settings ---
  console.log("📋 Upserting site settings...");

  const settingsToUpsert = [
    { key: "hero", value: heroSettings, category: "content", label: "Hero Section" },
    { key: "about", value: aboutSettings, category: "content", label: "About Section" },
    { key: "skills", value: skillsSettings, category: "content", label: "Skills" },
    { key: "contact", value: contactSettings, category: "content", label: "Contact" },
    { key: "certifications", value: certificationsSettings, category: "content", label: "Certifications" },
    { key: "education", value: educationSettings, category: "content", label: "Education" },
    { key: "lab", value: labSettings, category: "content", label: "Lab" },
  ];

  for (const setting of settingsToUpsert) {
    await db
      .insert(siteSettings)
      .values(setting)
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: setting.value, updatedAt: new Date() },
      });
    console.log(`  ✓ ${setting.label}`);
  }

  // --- Experiences ---
  console.log("\n💼 Seeding work experience...");
  await db.delete(experiences);
  for (const exp of experienceData) {
    await db.insert(experiences).values(exp);
    console.log(`  ✓ ${exp.title} at ${exp.company}`);
  }

  // Clear any certifications that were accidentally added to the reading list table
  await db.delete(certifications);
  console.log("\n🗑️  Cleared reading list table (certifications now live in site settings)");

  // --- Projects ---
  console.log("\n🚀 Seeding projects...");
  await db.delete(projects);
  for (const project of projectsData) {
    await db.insert(projects).values(project);
    console.log(`  ✓ ${project.title}`);
  }

  console.log("\n✅ Seed complete!");
  console.log("\n📝 Next steps:");
  console.log("   1. Visit /experience to see the certifications section below the timeline");
  console.log("   2. Visit /admin/certifications to add reading list articles");
  console.log("   3. Visit /admin/projects to add portfolio projects");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  });
