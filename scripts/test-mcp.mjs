#!/usr/bin/env node

/**
 * MCP Server Test Script
 * Tests the portfolio MCP server endpoints using the MCP SDK
 *
 * Usage: node scripts/test-mcp.mjs [baseUrl]
 * Example: node scripts/test-mcp.mjs http://localhost:3000
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const BASE_URL = process.argv[2] || 'http://localhost:3000';
// MCP endpoint using Streamable HTTP transport
const MCP_ENDPOINT = `${BASE_URL}/api/mcp`;

async function testMCP() {
  console.log(`\n🔌 Testing MCP Server at ${MCP_ENDPOINT}\n`);
  console.log('='.repeat(50));

  const client = new Client({
    name: "test-client",
    version: "1.0.0",
  });

  try {
    // Connect using Streamable HTTP transport
    console.log('\n📡 Connecting to MCP Server...');
    const transport = new StreamableHTTPClientTransport(new URL(MCP_ENDPOINT));
    await client.connect(transport);
    console.log('✅ Connected successfully!');

    // Test 1: List Tools
    console.log('\n🔧 Test 1: List Available Tools');
    const toolsResult = await client.listTools();
    const tools = toolsResult.tools || [];
    console.log(`✅ Found ${tools.length} tools:`);
    tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description?.slice(0, 50)}...`);
    });

    // Test 2: List Resources
    console.log('\n📦 Test 2: List Available Resources');
    const resourcesResult = await client.listResources();
    const resources = resourcesResult.resources || [];
    console.log(`✅ Found ${resources.length} resources:`);
    resources.forEach(r => {
      console.log(`   - ${r.uri}: ${r.name}`);
    });

    // Test 3: List Prompts
    console.log('\n📝 Test 3: List Available Prompts');
    const promptsResult = await client.listPrompts();
    const prompts = promptsResult.prompts || [];
    console.log(`✅ Found ${prompts.length} prompts:`);
    prompts.forEach(p => {
      console.log(`   - ${p.name}: ${p.description?.slice(0, 50)}...`);
    });

    // Test 4: Call get_profile_summary tool
    console.log('\n⚡ Test 4: Call get_profile_summary tool');
    try {
      const profileResult = await client.callTool({
        name: 'get_profile_summary',
        arguments: {}
      });
      if (profileResult.content?.[0]?.text) {
        const profile = JSON.parse(profileResult.content[0].text);
        console.log('✅ Profile retrieved:');
        console.log(`   Name: ${profile.name}`);
        console.log(`   Headline: ${profile.headline}`);
        console.log(`   Years Experience: ${profile.yearsOfExperience}`);
        if (profile.stats) {
          console.log(`   Stats:`, profile.stats);
        }
      }
    } catch (error) {
      console.log('⚠️  Tool call error:', error.message);
    }

    // Test 5: Read portfolio://contact resource
    console.log('\n📖 Test 5: Read portfolio://contact resource');
    try {
      const contactResult = await client.readResource({
        uri: 'portfolio://contact'
      });
      if (contactResult.contents?.[0]?.text) {
        const contact = JSON.parse(contactResult.contents[0].text);
        console.log('✅ Contact info:');
        Object.entries(contact).forEach(([k, v]) => {
          console.log(`   ${k}: ${v}`);
        });
      }
    } catch (error) {
      console.log('⚠️  Resource read error:', error.message);
    }

    // Test 6: Get skills
    console.log('\n🎯 Test 6: Call get_skills tool');
    try {
      const skillsResult = await client.callTool({
        name: 'get_skills',
        arguments: {}
      });
      if (skillsResult.content?.[0]?.text) {
        const skills = JSON.parse(skillsResult.content[0].text);
        console.log(`✅ Found ${skills.totalSkills} skills across categories:`);
        Object.keys(skills.skillsByCategory || {}).forEach(cat => {
          console.log(`   - ${cat}: ${skills.skillsByCategory[cat].length} skills`);
        });
      }
    } catch (error) {
      console.log('⚠️  Skills tool error:', error.message);
    }

    await client.close();
    console.log('\n' + '='.repeat(50));
    console.log('🎉 MCP Server tests complete!\n');

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
    console.log('\nTroubleshooting tips:');
    console.log('1. Make sure the dev server is running (npm run dev)');
    console.log('2. Check that the MCP endpoint is accessible');
    console.log('3. Verify database connection is working');
    process.exit(1);
  }
}

testMCP().catch(console.error);
