# ChittyAssets - Universal Asset Ownership Verification System

## Overview

ChittyAssets is the asset ownership verification layer of the ChittyChain ecosystem, implementing the "prove ownership once, trusted everywhere" model. As part of the Chitty Foundation's mission to "make proof as frictionless as speech," ChittyAssets transforms smartphones into professional-grade asset protection platforms that integrate seamlessly with ChittyID, ChittyTrust, and ChittyChain.

The system provides evidence-centric asset management with tamper-proof chain-of-custody, AI-powered document analysis, and blockchain anchoring through ChittyChain's off-chain immutability and on-chain settlement layers. ChittyAssets serves critical use cases including divorce proceedings, insurance claims, legal disputes, and property transactions by providing immutable proof of asset ownership and value.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite for build tooling
- **UI Components**: Radix UI primitives with shadcn/ui component library for consistent, accessible design
- **Styling**: Tailwind CSS with custom design system using CSS variables for theming
- **State Management**: TanStack React Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Mobile Support**: Progressive Web App (PWA) ready with touch-optimized interfaces and camera integration

### Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: OpenID Connect (OIDC) with Passport.js integration for Replit Auth
- **File Handling**: Google Cloud Storage for asset document storage with custom ACL policies
- **AI Integration**: OpenAI GPT-4o for document analysis and asset valuation

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon Database serverless platform
- **ORM**: Drizzle with type-safe schema definitions
- **File Storage**: Google Cloud Storage with object-level access control
- **Session Management**: PostgreSQL-backed sessions for authentication persistence
- **Schema**: Comprehensive asset management schema including users, assets, evidence, timelines, warranties, insurance policies, and legal cases

### Authentication and Authorization
- **Provider**: Replit Auth using OpenID Connect protocol
- **Session Storage**: PostgreSQL-based session store with configurable TTL
- **Security Features**: HTTP-only cookies, CSRF protection, secure session management
- **Authorization**: Role-based access control with user-scoped data isolation

### Core Features Architecture
- **Asset Management**: Complete CRUD operations with filtering, search, and categorization
- **Evidence Capture**: Mobile camera integration with AI-powered document analysis
- **Timeline Tracking**: Event-based asset history with verification status
- **Legal Document Generation**: Template-based document creation with jurisdiction support
- **Warranty Management**: Automated warranty tracking with expiration notifications
- **Insurance Integration**: Policy management with claim tracking capabilities

## ChittyChain Ecosystem Integration

### Core ChittyChain Components
- **ChittyChain Identifier System**: UUID v7 (transitioning to Mod-97 Base32) for deterministic, human-readable asset IDs
- **Off-Chain Immutability Layer**: 7-day freeze period with PostgreSQL + pgvector and IPFS CID anchoring
- **On-Chain Settlement**: EVM smart contracts with Chainlink CCIP for final dispute resolution
- **Trust Graph Integration**: Neo4j-based dynamic reputation and risk scoring with time-decay algorithms

### ChittyOS Ecosystem Synergy
- **ChittyID**: Identity verification ("WHO owns assets") complements ChittyAssets ownership proof ("WHAT they own")
- **ChittyTrust**: Trust scoring and reputation management for asset authenticity
- **ChittyResolution**: Dispute resolution mechanisms for ownership conflicts
- **ChittyVerify**: Independent validation and audit trails

### External Dependencies

#### AI and Machine Learning Services
- **OpenAI GPT-4o**: Primary AI service for document analysis, receipt processing, and asset valuation
- **Computer Vision**: Image analysis for EXIF metadata extraction and content recognition

#### Cloud Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Google Cloud Storage**: Object storage for asset documents and evidence files
- **IPFS Network**: Decentralized storage for immutable evidence preservation
- **Replit Infrastructure**: Development environment with sidecar authentication services

### File Upload and Processing
- **Uppy**: File upload library with drag-and-drop interface and progress tracking
- **AWS S3 Integration**: Direct-to-cloud uploads with presigned URL support
- **Image Processing**: Base64 encoding for AI analysis with MIME type validation

### UI and Component Libraries
- **Radix UI**: Headless component primitives for accessibility and keyboard navigation
- **Lucide Icons**: Comprehensive icon library for consistent visual language
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens

### Development and Build Tools
- **Vite**: Fast build tool with Hot Module Replacement (HMR)
- **TypeScript**: Type safety across frontend, backend, and shared schemas
- **ESBuild**: Production bundling for server-side code
- **PostCSS**: CSS processing with Tailwind CSS integration

### Authentication and Security
- **Passport.js**: Authentication middleware with OpenID Connect strategy
- **Connect PG Simple**: PostgreSQL session store for Express sessions
- **Memoizee**: Function memoization for performance optimization