# ChittyAssets - Enterprise Asset Management Platform

## Overview

ChittyAssets is a comprehensive, AI-powered asset management system designed to transform any smartphone into a professional-grade asset protection platform. The application enables users to scan receipts, track warranties, generate legal evidence, and protect assets with AI-powered blockchain verification capabilities.

The system combines mobile-first responsive design with enterprise security features, real-time collaboration capabilities, and intelligent document analysis to provide a complete asset lifecycle management solution.

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

## External Dependencies

### AI and Machine Learning Services
- **OpenAI GPT-4o**: Primary AI service for document analysis, receipt processing, and asset valuation
- **Computer Vision**: Image analysis for EXIF metadata extraction and content recognition

### Cloud Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Google Cloud Storage**: Object storage for asset documents and evidence files
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