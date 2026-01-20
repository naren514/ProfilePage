# Aham - AI-Powered Professional Portfolio

A modern, self-hosted portfolio platform with AI-powered chat, RAG (Retrieval-Augmented Generation), and MCP (Model Context Protocol) server capabilities. Built with Next.js 14, Firebase Auth, Neon PostgreSQL, and Google Gemini AI.

**Aham** (Sanskrit: अहम्) means "I" or "self" - representing your professional identity.

## Features

- **AI-Powered Chat** - Visitors can ask questions about your experience, and get intelligent responses powered by RAG
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

- Node.js 18+
- A [Neon](https://neon.tech) PostgreSQL database
- A [Google AI Studio](https://aistudio.google.com) API key (for Gemini)
- A [Firebase](https://firebase.google.com) project (for authentication)
- A [Vercel](https://vercel.com) account (for deployment & blob storage)

## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/aham.git
cd aham
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

Required environment variables:

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Firebase (Client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Firebase Admin (Server-side)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_xxx

# App URL (for CORS and redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set Up the Database

Push the schema to your database:

```bash
npm run db:push
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your portfolio.

### 5. Access the Admin Dashboard

1. Go to `/login`
2. Sign in with your Google account
3. First user to sign in becomes the admin
4. Navigate to `/admin` to manage your content

## Admin Dashboard Features

- **Settings** - Configure your name, title, location, summary, and stats shown on the homepage
- **Experience** - Add your work history with achievements and technologies
- **Projects** - Showcase projects with STAR format descriptions
- **Stories** - Document career stories and lessons learned
- **Certifications** - List your professional certifications
- **Volunteer** - Add volunteer experience
- **Documents** - Upload PDFs to enhance AI responses (RAG)
- **Analytics** - View chat usage and token consumption

## MCP Server

The portfolio includes an MCP (Model Context Protocol) server that allows AI assistants to access your portfolio data programmatically.

### Available Tools

- `get_profile_summary` - Get headline, summary, and key stats
- `search_experiences` - Search work history by company, role, or technology
- `get_skills` - Get skills by category
- `get_certifications` - Get professional certifications
- `get_projects` - Get portfolio projects with STAR details
- `assess_job_fit` - Analyze job description fit
- `get_stories` - Get professional stories
- `get_volunteer_experience` - Get volunteer work
- `semantic_search` - Natural language search across all content

### Connecting to Claude Desktop

Add to your Claude Desktop config (`~/.config/claude-desktop/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "your-portfolio": {
      "type": "http",
      "url": "https://yourdomain.com/api/mcp"
    }
  }
}
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. Add all environment variables
4. Deploy

### Other Platforms

The app can be deployed to any platform that supports Next.js:

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Auth routes (login)
│   ├── (public)/        # Public routes
│   ├── admin/           # Admin dashboard
│   ├── api/             # API routes
│   └── page.tsx         # Homepage
├── components/
│   ├── admin/           # Admin components
│   ├── chat/            # Chat widget
│   ├── layout/          # Header, footer
│   ├── sections/        # Homepage sections
│   └── ui/              # shadcn/ui components
├── lib/
│   ├── ai/              # Gemini AI integration
│   ├── db/              # Drizzle schema & queries
│   ├── firebase/        # Firebase auth
│   └── rag/             # RAG retrieval system
└── hooks/               # React hooks
```

## Customization

### Changing the Theme

Edit `src/app/globals.css` and `tailwind.config.ts` for colors and styling.

### Adding New Sections

1. Create a new table in `src/lib/db/schema.ts`
2. Add API routes in `src/app/api/admin/`
3. Create admin page in `src/app/admin/`
4. Add public page in `src/app/(public)/`

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate Drizzle migrations
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
npm run db:seed      # Seed sample data
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Next.js](https://nextjs.org) - React framework
- [shadcn/ui](https://ui.shadcn.com) - UI components
- [Neon](https://neon.tech) - Serverless PostgreSQL
- [Google Gemini](https://ai.google.dev) - AI models
- [Firebase](https://firebase.google.com) - Authentication
- [Vercel](https://vercel.com) - Hosting & blob storage
