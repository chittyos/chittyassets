# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server with hot reload (Vite frontend + Express backend)
- `npm run build` - Build for production (compiles TypeScript for both client and server)
- `npm start` - Run production server

### Database
- `npm run db:push` - Push database schema changes to Neon PostgreSQL

### Type Checking
- `npm run check` - Run TypeScript type checking for both client and server code

## Architecture Overview

ChittyAssets is a full-stack TypeScript application for asset ownership verification. It integrates with the ChittyChain blockchain ecosystem and uses AI for document analysis.

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Wouter (routing), TanStack Query, Radix UI/shadcn components, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript, PostgreSQL (Neon), Drizzle ORM, Passport.js (Replit Auth)
- **Storage**: Google Cloud Storage for files, PostgreSQL for structured data
- **AI**: OpenAI GPT-4o for document analysis and valuation
- **Blockchain**: ChittyChain integration via custom MCP client

### Key Architecture Patterns

1. **Shared Types**: TypeScript schemas in `/shared/schema.ts` are used by both client and server for type safety
2. **Database Access**: All database operations go through `/server/storage.ts` abstraction layer using Drizzle ORM
3. **Authentication**: Replit Auth via OpenID Connect, sessions stored in PostgreSQL
4. **File Storage**: Google Cloud Storage with ACL, managed through `/server/objectStorage.ts`
5. **API Routes**: RESTful API defined in `/server/routes.ts` with authentication middleware

### Directory Structure

- `/client/src/` - React frontend application
  - `pages/` - Route components (Landing, Dashboard, AssetDetail)
  - `components/` - Reusable UI components
  - `hooks/` - Custom React hooks (useAuth, useIsMobile, useToast)
  
- `/server/` - Express backend application
  - `index.ts` - Server entry point with middleware setup
  - `routes.ts` - API endpoint definitions
  - `chittyCloudMcp.ts` - ChittyChain ecosystem integration
  - `aiAnalysis.ts` - OpenAI GPT-4o integration
  - `storage.ts` - Database operations layer
  - `objectStorage.ts` - File storage operations

### Important Implementation Notes

1. **ChittyChain Integration**: The app integrates with 5 ChittyChain services (ChittyID, ChittyAssets, ChittyTrust, ChittyResolution, ChittyFile). Service status is monitored in real-time via the EcosystemIndicator component.

2. **Asset Lifecycle**: Assets go through a 7-day freeze period before becoming immutable on the blockchain. During this time, evidence can be added and AI analysis performed.

3. **AI Analysis**: GPT-4o analyzes uploaded documents/receipts to extract structured data, calculate trust scores, and generate legal documents. Results are stored in the `aiAnalysisResults` table.

4. **Design System**: Uses ChittyAssets custom colors (chitty-gold, chitty-platinum, chitty-dark, chitty-charcoal) defined in Tailwind config. Components follow shadcn/ui patterns.

5. **Error Handling**: ChittyChain services have graceful fallbacks. If services are unavailable, the app continues with limited functionality and shows appropriate status indicators.

6. **Mobile Support**: Dedicated mobile navigation and responsive design. The `useIsMobile` hook detects mobile devices for UI adjustments.