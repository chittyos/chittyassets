# ChittyAssets

Blockchain-integrated asset management system for the ChittyOS ecosystem with ownership proof, dashboard filtering, and multi-platform deployment support.

## Overview

ChittyAssets is a comprehensive digital asset management platform that integrates blockchain technology for ownership verification, provides advanced dashboard filtering capabilities, and supports deployment across multiple platforms including Replit, Cloudflare, and Vercel.

## Features

- **Blockchain Integration**: Secure ownership proof and verification
- **Asset Dashboard**: Filter and manage assets by type and status
- **Multi-Platform Deployment**: Optimized for Replit, Cloudflare Workers, and Vercel
- **ChittyOS Integration**: Seamless integration with ChittyID, ChittyAuth, and ChittyRegistry
- **Real-time Updates**: WebSocket support for live asset tracking
- **Cloud Storage**: Google Cloud Storage and AWS S3 integration via Uppy

## Tech Stack

- **Frontend**: React 18, Radix UI, Tailwind CSS, React Query
- **Backend**: Express.js, Drizzle ORM, Neon Database
- **Authentication**: Passport.js, OpenID Connect, ChittyID integration
- **AI Integration**: Claude Code SDK, OpenAI API
- **File Uploads**: Uppy with AWS S3 and Google Cloud Storage
- **Build Tools**: Vite, ESBuild, TypeScript

## Installation

```bash
# Clone the repository
git clone https://github.com/chittyos/chittyassets.git
cd chittyassets

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Push database schema
npm run db:push

# Start development server
npm run dev
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host/database

# ChittyOS Integration
CHITTYID_CLIENT_ID=your_chittyid_client_id
CHITTYID_CLIENT_SECRET=your_chittyid_client_secret
CHITTYID_ISSUER=https://id.chitty.cc

# AI Services
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key

# Storage
GCS_BUCKET=your_gcs_bucket
AWS_S3_BUCKET=your_s3_bucket
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Session
SESSION_SECRET=your_session_secret
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run check` - TypeScript type checking
- `npm run db:push` - Push database schema changes

## Architecture

```
chittyassets/
├── client/              # React frontend
│   ├── components/      # UI components
│   └── lib/            # Utilities and hooks
├── server/             # Express backend
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   └── db/            # Database layer
├── shared/            # Shared types and schemas
└── attached_assets/   # Asset storage
```

## API Endpoints

### Assets
- `GET /api/assets` - List all assets with filtering
- `POST /api/assets` - Create new asset
- `GET /api/assets/:id` - Get asset details
- `PUT /api/assets/:id` - Update asset
- `DELETE /api/assets/:id` - Delete asset
- `POST /api/assets/:id/verify` - Verify ownership on blockchain

### Authentication
- `GET /auth/chittyid` - ChittyID OAuth flow
- `GET /auth/callback` - OAuth callback
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/filters` - Get available filters
- `POST /api/dashboard/export` - Export filtered data

## ChittyOS Integration

ChittyAssets integrates seamlessly with the ChittyOS ecosystem:

### ChittyID
Universal identity management for asset ownership verification.

### ChittyAuth
Secure authentication with multi-factor support.

### ChittyRegistry
Service discovery and health monitoring.

### ChittyCloude™
Deploy to multiple cloud platforms with a single configuration.

### ChittyBeacon
Track asset access and usage patterns.

## Deployment

### Replit
```bash
# The project includes .replit configuration
# Simply import and run
```

### Cloudflare Workers
```bash
# Build for Cloudflare
npm run build:cloudflare
wrangler deploy
```

### Vercel
```bash
# Deploy with Vercel CLI
vercel --prod
```

### Docker
```bash
# Build Docker image
docker build -t chittyassets .

# Run container
docker run -p 3000:3000 chittyassets
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- Documentation: [docs.chitty.cc](https://docs.chitty.cc)
- Issues: [GitHub Issues](https://github.com/chittyos/chittyassets/issues)
- Discord: [ChittyOS Community](https://discord.gg/chittyos)

## Acknowledgments

Built with the ChittyOS ecosystem for seamless business operations and asset management.