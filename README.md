# ProfilePage - Professional Portfolio

A modern, self-hosted portfolio platform with AI-powered chat, RAG (Retrieval-Augmented Generation), and MCP (Model Context Protocol) server capabilities. Built with Next.js 14, Firebase Auth, Neon PostgreSQL, and Google Gemini AI.

**ProfilePage** is a customizable professional portfolio application for presenting your work, experience, and writing.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

---

## Quick Start (Local Development)

Get up and running in 5 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/ProfilePage.git
cd ProfilePage

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.example .env.local

# 4. Fill in your environment variables (see Step-by-Step Setup below)
#    At minimum, you need: DATABASE_URL and OPENAI_API_KEY

# 5. Push database schema
npm run db:push

# 6. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your portfolio.

### Local Testing Checklist

| Test | URL | What to Check |
|------|-----|---------------|
| Homepage | http://localhost:3000 | Portfolio loads with your info |
| Chat Widget | Click chat icon (bottom right) | AI responds to questions |
| Admin Login | http://localhost:3000/login | Google OAuth works |
| Admin Dashboard | http://localhost:3000/admin | Can manage content |
| API Health | http://localhost:3000/api/chat | Returns JSON (POST with `{"message": "hello"}`) |

### Common Local Development Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Drizzle Studio (database GUI)
npm run db:seed      # Seed sample resume data
```

---

## Features

- **AI-Powered Chat** - Visitors can ask questions about your experience and get intelligent responses powered by RAG
- **MCP Server** - Expose your portfolio data to AI assistants like Claude via the Model Context Protocol
- **Job Fit Assessment** - AI analyzes job descriptions against your profile to show match scores
- **Admin Dashboard** - Full CMS to manage your experience, projects, certifications, and more
- **STAR Format Stories** - Document your achievements in the Situation-Task-Action-Result format
- **Document Upload & RAG** - Upload PDFs/documents to enhance AI responses with your content
- **Modern UI** - Dark theme with Tailwind CSS and shadcn/ui components
- **Firebase Authentication** - Secure admin access with Google OAuth

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Neon PostgreSQL with Drizzle ORM
- **AI**: Google Gemini 2.5 Flash + Embeddings
- **Auth**: Firebase Authentication
- **Styling**: Tailwind CSS + shadcn/ui
- **Vector Search**: pgvector for semantic similarity
- **File Storage**: Vercel Blob

## Prerequisites

Before you begin, you'll need accounts with:

- [GitHub](https://github.com) - For hosting the code
- [Neon](https://neon.tech) - Serverless PostgreSQL database (free tier available)
- [Google AI Studio](https://aistudio.google.com) - For Gemini API key (free tier available)
- [Firebase](https://firebase.google.com) - For authentication (free tier available)
- [Vercel](https://vercel.com) - For deployment & blob storage (free tier available)

You'll also need:
- Node.js 18+ installed locally
- Git installed locally

---

## Step-by-Step Setup Guide

### Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/ProfilePage.git
cd ProfilePage
npm install
```

### Step 2: Set Up Neon PostgreSQL Database

1. **Create a Neon Account**
   - Go to [https://neon.tech](https://neon.tech)
   - Sign up with GitHub, Google, or email

2. **Create a New Project**
   - Click "New Project"
   - Enter a project name (e.g., "profilepage")
   - Select a region closest to your users
   - Click "Create Project"

3. **Get Your Connection String**
   - After creation, you'll see your connection details
   - Copy the connection string that looks like:
     ```
     postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
     ```
   - Save this as your `DATABASE_URL`

4. **Enable pgvector Extension**
   - In the Neon console, go to "SQL Editor"
   - Run this command:
     ```sql
     CREATE EXTENSION IF NOT EXISTS vector;
     ```

### Step 3: Get Google Gemini API Key

1. **Go to Google AI Studio**
   - Visit [https://aistudio.google.com](https://aistudio.google.com)
   - Sign in with your Google account

2. **Create an API Key**
   - Click "Get API Key" in the left sidebar
   - Click "Create API Key"
   - Select or create a Google Cloud project
   - Copy the generated API key
   - Save this as your `OPENAI_API_KEY`

3. **API Key Notes**
   - The free tier includes generous limits for personal use
   - Keep your API key secure and never commit it to git

### Step 4: Set Up Firebase Project

#### 4.1 Create Firebase Project

1. **Go to Firebase Console**
   - Visit [https://console.firebase.google.com](https://console.firebase.google.com)
   - Sign in with your Google account

2. **Create a New Project**
   - Click "Add project"
   - Enter project name (e.g., "profilepage")
   - Disable Google Analytics (optional, not needed)
   - Click "Create project"
   - Wait for creation, then click "Continue"

#### 4.2 Enable Authentication

1. **Go to Authentication**
   - In the left sidebar, click "Build" → "Authentication"
   - Click "Get started"

2. **Enable Google Sign-in**
   - Click on "Google" in the Sign-in providers list
   - Toggle "Enable"
   - Enter your email as the project support email
   - Click "Save"

3. **Add Authorized Domain**
   - Go to "Settings" tab in Authentication
   - Under "Authorized domains", add your production domain
   - `localhost` is already added for development

#### 4.3 Get Firebase Web Config

1. **Register a Web App**
   - Go to Project Settings (gear icon) → "General"
   - Scroll to "Your apps" section
   - Click the web icon (`</>`)
   - Enter app nickname (e.g., "profilepage-web")
   - Don't check "Firebase Hosting"
   - Click "Register app"

2. **Copy Config Values**
   - You'll see a config object like:
     ```javascript
     const firebaseConfig = {
       apiKey: "AIzaSy...",
       authDomain: "your-project.firebaseapp.com",
       projectId: "your-project-id",
       storageBucket: "your-project.appspot.com",
       messagingSenderId: "123456789",
       appId: "1:123456789:web:abc123"
     };
     ```
   - Save these values for your environment variables

#### 4.4 Generate Service Account Key (for Server-side Auth)

1. **Go to Service Accounts**
   - In Project Settings, click "Service accounts" tab
   - You'll see "Firebase Admin SDK" section

2. **Generate New Private Key**
   - Click "Generate new private key"
   - Click "Generate key" to confirm
   - A JSON file will download

3. **Extract Values from JSON**
   - Open the downloaded JSON file
   - You need these values:
     - `project_id` → `FIREBASE_PROJECT_ID`
     - `client_email` → `FIREBASE_CLIENT_EMAIL`
     - `private_key` → `FIREBASE_PRIVATE_KEY`

   **Important**: The private key contains `\n` characters. Keep them as-is when adding to your `.env.local` file, wrapped in quotes.

### Step 5: Set Up Vercel Blob Storage (Optional)

This is needed for the document upload feature (PDFs for RAG).

1. **Create Vercel Account**
   - Go to [https://vercel.com](https://vercel.com)
   - Sign up with GitHub

2. **Create a Blob Store**
   - Go to your Vercel dashboard
   - Click "Storage" in the top nav
   - Click "Create Database"
   - Select "Blob"
   - Enter a name (e.g., "profilepage-documents")
   - Click "Create"

3. **Get Blob Token**
   - After creation, go to the Blob store settings
   - Copy the `BLOB_READ_WRITE_TOKEN`

### Step 6: Configure Environment Variables

1. **Create `.env.local` File**
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in All Values**

   Open `.env.local` and add your values:

   ```env
   # Database (from Step 2)
   DATABASE_URL=postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require

   # Google Gemini AI (from Step 3)
   OPENAI_API_KEY=your-openai-api-key

   # Firebase Client-side (from Step 4.3)
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

   # Firebase Admin/Server-side (from Step 4.4)
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"

   # Vercel Blob Storage (from Step 5, optional)
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

   # App URL
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # NextAuth Secret (only needed for scripts/create-admin.ts local admin creation;
   # not required if using Google OAuth only)
   # NEXTAUTH_SECRET=generate-a-random-string-here
   ```

### Step 7: Initialize the Database

Push the database schema to Neon:

```bash
npm run db:push
```

You should see output confirming tables were created.

#### Optional: Seed Sample Data

```bash
npm run db:seed
```

This loads sample resume data so the portfolio has content on your first visit. This step is optional — you can skip it and add your own content via the admin dashboard instead.

### Step 8: Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your portfolio.

### Step 9: Configure Your Portfolio

1. **Sign In as Admin**
   - Go to [http://localhost:3000/login](http://localhost:3000/login)
   - Click "Sign in with Google"
   - Use your Google account that matches your Firebase project

   > **Note**: If you need to create a local admin user (for testing without Google OAuth), use:
   > ```bash
   > ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=securepassword123 ADMIN_NAME="Your Name" npx tsx scripts/create-admin.ts
   > ```

2. **Configure Settings**
   - Go to [http://localhost:3000/admin/settings](http://localhost:3000/admin/settings)
   - Fill in your name, title, location, and summary
   - Configure your stats (e.g., "15+ Years Experience")
   - Add your contact info (email, LinkedIn, GitHub)
   - Click "Save Changes"

3. **Add Your Content**
   - **Experience**: Add your work history
   - **Projects**: Add portfolio projects with STAR format
   - **Certifications**: Add your professional certifications
   - **Stories**: Document career achievements
   - **Documents**: Upload PDFs to enhance AI chat responses

4. **Test the AI Chat**
   - Return to the homepage: [http://localhost:3000](http://localhost:3000)
   - Click the chat widget (bottom right corner)
   - Ask questions like "What is your experience?" or "Tell me about your projects"
   - Verify the AI responds with your portfolio content

---

## Deployment to Vercel

### Option 1: Deploy via Vercel Dashboard

1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repository
4. Add all environment variables from `.env.local`
   > **Tip:** For `FIREBASE_PRIVATE_KEY`, paste the key as-is with the literal `\n` characters directly into Vercel's environment variable UI — do not replace them with actual newlines. This is the most common cause of auth failures after deployment.
5. Click "Deploy"

### Option 2: Deploy via CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts and add environment variables when asked.

### Post-Deployment

1. **Update Firebase Authorized Domain**
   - Go to Firebase Console → Authentication → Settings
   - Add your Vercel domain (e.g., `your-app.vercel.app`)

2. **Update App URL**
   - In Vercel, update `NEXT_PUBLIC_APP_URL` to your production URL

---

## Admin Dashboard Features

| Section | Description |
|---------|-------------|
| **Settings** | Configure name, title, stats, contact info |
| **Experience** | Manage work history with achievements |
| **Projects** | Add projects with STAR format descriptions |
| **Stories** | Document career stories and lessons |
| **Certifications** | List professional certifications |
| **Volunteer** | Add volunteer experience |
| **Documents** | Upload PDFs for RAG enhancement |
| **Analytics** | View chat usage and token consumption |

---

## MCP Server Integration

The portfolio includes an MCP (Model Context Protocol) server that allows AI assistants to access your portfolio data.

### Available Tools

| Tool | Description |
|------|-------------|
| `get_profile_summary` | Get headline, summary, and key stats |
| `search_experiences` | Search work history |
| `get_skills` | Get skills by category |
| `get_certifications` | Get professional certifications |
| `get_projects` | Get portfolio projects |
| `assess_job_fit` | Analyze job description fit |
| `get_stories` | Get professional stories |
| `semantic_search` | Natural language search |

### Connect to Claude Desktop

Add to your Claude Desktop config:

**macOS**: `~/.config/claude-desktop/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "my-portfolio": {
      "type": "http",
      "url": "https://yourdomain.com/api/mcp"
    }
  }
}
```

---

## Project Structure

```
ProfilePage/
├── src/
│   ├── app/
│   │   ├── (auth)/           # Login page
│   │   ├── (public)/         # Public pages
│   │   ├── admin/            # Admin dashboard
│   │   ├── api/              # API routes
│   │   └── page.tsx          # Homepage
│   ├── components/
│   │   ├── admin/            # Admin components
│   │   ├── chat/             # Chat widget
│   │   ├── layout/           # Header, footer
│   │   ├── sections/         # Homepage sections
│   │   └── ui/               # shadcn/ui components
│   └── lib/
│       ├── ai/               # Gemini AI integration
│       ├── db/               # Database schema
│       ├── firebase/         # Auth config
│       └── rag/              # RAG retrieval
├── drizzle/                  # Database migrations
├── scripts/                  # Utility scripts
└── public/                   # Static assets
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server at http://localhost:3000 |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Drizzle Studio (database GUI) |
| `npm run db:seed` | Seed sample resume data |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Run database migrations |
| `npm run test:e2e` | Run Playwright end-to-end tests |

### Utility Scripts

These scripts are in the `scripts/` directory and are **not included in production builds**:

```bash
# Create an admin user (requires environment variables)
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=your-secure-password-12chars npx tsx scripts/create-admin.ts

# Set up pgvector extension
npx tsx scripts/setup-db.ts

# Seed RAG data from your content
npx tsx scripts/seed-rag-data.ts

# Sync RAG embeddings
npx tsx scripts/sync-rag-data.ts

# Query database directly
npx tsx scripts/query-db.ts
```

> **Security Note**: Admin creation requires `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables. Passwords must be at least 12 characters. These scripts have production guards and will not run in production unless explicitly allowed.

---

## Security

This project implements several security measures:

### Security Headers

The application sets the following HTTP security headers:
- **Strict-Transport-Security (HSTS)** - Enforces HTTPS connections
- **X-Frame-Options** - Prevents clickjacking attacks
- **X-Content-Type-Options** - Prevents MIME type sniffing
- **Content-Security-Policy (CSP)** - Controls resource loading
- **Referrer-Policy** - Controls referrer information
- **Permissions-Policy** - Restricts browser features

### Authentication & Authorization

- Firebase Authentication with Google OAuth
- Session-based middleware protection for `/admin/*` routes
- API route protection for `/api/admin/*` endpoints
- Server-side token verification

### Input Validation

- All API routes use Zod schemas for strict input validation
- Vector embeddings are validated for type safety
- Database queries use parameterized statements via Drizzle ORM

### Rate Limiting

- Database-backed rate limiting on public API endpoints (e.g., `/api/chat`) to protect against abuse
- Rate limits are enforced per-IP with configurable windows and request counts

### Best Practices

- Environment variables for all secrets (never commit `.env.local`)
- Scripts excluded from production builds via `.vercelignore`
- Production guards on administrative scripts
- No hardcoded credentials

---

## Customization

### Changing Colors/Theme

Edit `src/app/globals.css` for CSS variables and `tailwind.config.ts` for Tailwind configuration.

### Adding New Content Sections

1. Add table to `src/lib/db/schema.ts`
2. Run `npm run db:push`
3. Create API routes in `src/app/api/admin/`
4. Create admin page in `src/app/admin/`
5. Create public page in `src/app/(public)/`

---

## Troubleshooting

### Local Development Issues

#### "DATABASE_URL not found"
- Ensure `.env.local` exists and contains the `DATABASE_URL`
- Restart the dev server after adding env variables: `npm run dev`

#### "Module not found" or dependency errors
```bash
rm -rf node_modules package-lock.json
npm install
```

#### Port 3000 already in use
```bash
# Find and kill the process
lsof -i :3000
kill -9 <PID>

# Or use a different port
npm run dev -- -p 3001
```

### Firebase Issues

#### "Firebase: Error (auth/unauthorized-domain)"
- Add `localhost` to Firebase Authentication → Settings → Authorized domains
- For production, add your Vercel domain as well

#### "Firebase Admin SDK initialization failed"
- Check that `FIREBASE_PRIVATE_KEY` includes the full key with `\n` characters
- Wrap the private key in quotes in `.env.local`

### Database Issues

#### "pgvector extension not found"
```sql
-- Run in Neon SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```

#### "relation does not exist" errors
```bash
npm run db:push
```

### AI Chat Issues

#### Chat not returning relevant answers
1. Add content via Admin dashboard first
2. Upload documents in Admin → Documents
3. Click "Sync RAG Data" in Admin dashboard
4. Check that documents show a chunk count > 0

#### "OPENAI_API_KEY" errors
- Verify your API key at [Google AI Studio](https://aistudio.google.com)
- Ensure the key is in `.env.local` without quotes

### Build/Deploy Issues

#### Build fails with type errors
```bash
npm run lint
npm run build
```

#### Vercel deployment fails
- Ensure all environment variables are set in Vercel dashboard
- Check that `FIREBASE_PRIVATE_KEY` is properly escaped

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Next.js](https://nextjs.org) - React framework
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [Neon](https://neon.tech) - Serverless PostgreSQL
- [Google Gemini](https://ai.google.dev) - AI models
- [Firebase](https://firebase.google.com) - Authentication
- [Vercel](https://vercel.com) - Hosting & blob storage
- [Drizzle ORM](https://orm.drizzle.team) - TypeScript ORM
