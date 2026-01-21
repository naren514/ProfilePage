#!/usr/bin/env node

/**
 * Full MCP Server Test Script
 * Tests all tools, resources, and prompts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const BASE_URL = process.argv[2] || "http://localhost:3000";
const MCP_ENDPOINT = BASE_URL + "/api/mcp";

async function testAllMCP() {
  console.log("\n🔌 Full MCP Server Test at " + MCP_ENDPOINT + "\n");
  console.log("=".repeat(60));

  const client = new Client({ name: "full-test-client", version: "1.0.0" });

  try {
    const transport = new StreamableHTTPClientTransport(new URL(MCP_ENDPOINT));
    await client.connect(transport);
    console.log("✅ Connected\n");

    // Test all 9 tools
    console.log("━".repeat(60));
    console.log("📦 TESTING ALL TOOLS");
    console.log("━".repeat(60));

    // 1. get_profile_summary
    console.log("\n1️⃣ get_profile_summary");
    try {
      const result = await client.callTool({ name: "get_profile_summary", arguments: {} });
      const data = JSON.parse(result.content[0].text);
      console.log("   ✅ Name: " + data.name);
      console.log("   ✅ Headline: " + data.headline);
      console.log("   ✅ Experience: " + data.yearsOfExperience + " years");
      console.log("   ✅ Stats: " + JSON.stringify(data.stats));
    } catch (e) { console.log("   ❌ Error: " + e.message); }

    // 2. search_experiences
    console.log("\n2️⃣ search_experiences");
    try {
      const result = await client.callTool({ name: "search_experiences", arguments: {} });
      const data = JSON.parse(result.content[0].text);
      console.log("   ✅ Found " + data.count + " experiences");
      (data.experiences || []).slice(0, 3).forEach(exp => {
        console.log("      - " + exp.title + " at " + exp.company);
      });
    } catch (e) { console.log("   ❌ Error: " + e.message); }

    // 3. search_experiences with query
    console.log("\n3️⃣ search_experiences (query: 'AWS')");
    try {
      const result = await client.callTool({ name: "search_experiences", arguments: { query: "AWS" } });
      const data = JSON.parse(result.content[0].text);
      console.log("   ✅ Found " + data.count + " matching experiences");
    } catch (e) { console.log("   ❌ Error: " + e.message); }

    // 4. get_skills
    console.log("\n4️⃣ get_skills");
    try {
      const result = await client.callTool({ name: "get_skills", arguments: {} });
      const data = JSON.parse(result.content[0].text);
      console.log("   ✅ Total skills: " + data.totalSkills);
      console.log("   ✅ Categories: " + (Object.keys(data.skillsByCategory || {}).join(", ") || "none"));
    } catch (e) { console.log("   ❌ Error: " + e.message); }

    // 5. get_certifications
    console.log("\n5️⃣ get_certifications");
    try {
      const result = await client.callTool({ name: "get_certifications", arguments: {} });
      const data = JSON.parse(result.content[0].text);
      console.log("   ✅ Found " + data.count + " certifications");
      (data.certifications || []).forEach(cert => {
        console.log("      - " + cert.name + " (" + cert.issuer + ")");
      });
    } catch (e) { console.log("   ❌ Error: " + e.message); }

    // 6. get_projects
    console.log("\n6️⃣ get_projects");
    try {
      const result = await client.callTool({ name: "get_projects", arguments: {} });
      const data = JSON.parse(result.content[0].text);
      console.log("   ✅ Found " + data.count + " projects");
      (data.projects || []).forEach(proj => {
        console.log("      - " + proj.title);
        if (proj.situation) console.log("        Situation: " + proj.situation.slice(0, 60) + "...");
      });
    } catch (e) { console.log("   ❌ Error: " + e.message); }

    // 7. get_stories
    console.log("\n7️⃣ get_stories");
    try {
      const result = await client.callTool({ name: "get_stories", arguments: {} });
      const data = JSON.parse(result.content[0].text);
      console.log("   ✅ Found " + data.count + " stories");
      (data.stories || []).slice(0, 2).forEach(story => {
        console.log("      - " + story.title);
      });
    } catch (e) { console.log("   ❌ Error: " + e.message); }

    // 8. get_volunteer_experience
    console.log("\n8️⃣ get_volunteer_experience");
    try {
      const result = await client.callTool({ name: "get_volunteer_experience", arguments: {} });
      const data = JSON.parse(result.content[0].text);
      console.log("   ✅ Found " + data.count + " volunteer experiences");
      (data.volunteerWork || []).forEach(vol => {
        console.log("      - " + vol.role + " at " + vol.organization);
      });
    } catch (e) { console.log("   ❌ Error: " + e.message); }

    // 9. assess_job_fit
    console.log("\n9️⃣ assess_job_fit");
    try {
      const result = await client.callTool({
        name: "assess_job_fit",
        arguments: {
          jobDescription: "Senior Cloud Engineer with AWS experience, Kubernetes, Terraform, and CI/CD pipelines"
        }
      });
      const data = JSON.parse(result.content[0].text);
      console.log("   ✅ Fit Score: " + (data.overallFitScore || data.fitScore || "N/A"));
      console.log("   ✅ Matching Skills: " + (data.matchingSkills || []).slice(0, 5).join(", "));
    } catch (e) { console.log("   ❌ Error: " + e.message); }

    // 10. semantic_search
    console.log("\n🔟 semantic_search");
    try {
      const result = await client.callTool({
        name: "semantic_search",
        arguments: { query: "cloud architecture AWS migration" }
      });
      const data = JSON.parse(result.content[0].text);
      console.log("   ✅ Found " + (data.results?.length || 0) + " results");
      (data.results || []).slice(0, 2).forEach(r => {
        console.log("      - [" + r.type + "] " + (r.title || r.content?.slice(0, 50)) + "...");
      });
    } catch (e) { console.log("   ❌ Error: " + e.message); }

    // Test all 3 resources
    console.log("\n" + "━".repeat(60));
    console.log("📚 TESTING ALL RESOURCES");
    console.log("━".repeat(60));

    // 1. portfolio://profile
    console.log("\n1️⃣ portfolio://profile");
    try {
      const result = await client.readResource({ uri: "portfolio://profile" });
      const data = JSON.parse(result.contents[0].text);
      console.log("   ✅ Name: " + data.name);
      console.log("   ✅ Summary: " + (data.summary || data.headline || "").slice(0, 80) + "...");
    } catch (e) { console.log("   ❌ Error: " + e.message); }

    // 2. portfolio://skills
    console.log("\n2️⃣ portfolio://skills");
    try {
      const result = await client.readResource({ uri: "portfolio://skills" });
      const data = JSON.parse(result.contents[0].text);
      console.log("   ✅ Total skills: " + (data.totalSkills || Object.values(data).flat().length));
      console.log("   ✅ Categories: " + Object.keys(data.skillsByCategory || data).join(", "));
    } catch (e) { console.log("   ❌ Error: " + e.message); }

    // 3. portfolio://contact
    console.log("\n3️⃣ portfolio://contact");
    try {
      const result = await client.readResource({ uri: "portfolio://contact" });
      const data = JSON.parse(result.contents[0].text);
      console.log("   ✅ Website: " + data.website);
      console.log("   ✅ Links: " + Object.keys(data).join(", "));
    } catch (e) { console.log("   ❌ Error: " + e.message); }

    // Test prompts
    console.log("\n" + "━".repeat(60));
    console.log("📝 TESTING PROMPTS");
    console.log("━".repeat(60));

    // 1. candidate-summary
    console.log("\n1️⃣ candidate-summary prompt");
    try {
      const result = await client.getPrompt({ name: "candidate-summary", arguments: { targetRole: "Cloud Architect" } });
      console.log("   ✅ Prompt returned with " + result.messages.length + " messages");
      const content = result.messages[0]?.content;
      const preview = typeof content === "string" ? content.slice(0, 80) : (content?.text?.slice(0, 80) || "");
      console.log("   ✅ Content preview: " + preview + "...");
    } catch (e) { console.log("   ❌ Error: " + e.message); }

    // 2. technical-deep-dive
    console.log("\n2️⃣ technical-deep-dive prompt");
    try {
      const result = await client.getPrompt({ name: "technical-deep-dive", arguments: { technology: "Kubernetes" } });
      console.log("   ✅ Prompt returned with " + result.messages.length + " messages");
      const content = result.messages[0]?.content;
      const preview = typeof content === "string" ? content.slice(0, 80) : (content?.text?.slice(0, 80) || "");
      console.log("   ✅ Content preview: " + preview + "...");
    } catch (e) { console.log("   ❌ Error: " + e.message); }

    await client.close();
    console.log("\n" + "=".repeat(60));
    console.log("🎉 Full MCP test complete!\n");

  } catch (error) {
    console.error("❌ Connection failed:", error.message);
    process.exit(1);
  }
}

testAllMCP();
