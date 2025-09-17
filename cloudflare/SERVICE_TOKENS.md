# Cloudflare Access Service Tokens Configuration

## Overview

Service tokens enable machine-to-machine authentication for ChittyAssets without requiring interactive login. These are used for API access, CI/CD pipelines, and inter-service communication.

## Required Service Tokens

### 1. ChittyOS API Service Token
**Token Name**: `CHITTY_API_SERVICE_TOKEN`
**Purpose**: Main service token for ChittyOS ecosystem services
**Scope**: Production API access
**Used By**:
- ChittyChain services
- ChittyRegistry
- ChittyID verification services

### 2. Clerk Webhook Token
**Token Name**: `CLERK_WEBHOOK_TOKEN`
**Purpose**: Authenticate Clerk/ChittyAuth webhook calls
**Scope**: `/api/auth/webhook/*` endpoints
**Used By**: Clerk webhook services

### 3. GitHub Actions Token
**Token Name**: `GITHUB_ACTIONS_TOKEN`
**Purpose**: CI/CD pipeline authentication
**Scope**: Deployment and testing endpoints
**Used By**: GitHub Actions workflows

### 4. Staging Service Token
**Token Name**: `CHITTY_STAGING_SERVICE_TOKEN`
**Purpose**: Staging environment service authentication
**Scope**: Staging API access
**Used By**: Staging test services

### 5. CI Service Token
**Token Name**: `CI_SERVICE_TOKEN`
**Purpose**: Automated testing access
**Scope**: `/api/test/*` endpoints
**Used By**: CI/CD testing pipelines

## Creating Service Tokens

### Via Cloudflare Dashboard

1. Navigate to Zero Trust → Access → Service Auth
2. Click "Create Service Token"
3. Name the token (e.g., `chitty-api-service`)
4. Set expiration (recommended: 1 year with rotation)
5. Copy both Client ID and Client Secret
6. Store securely in environment variables

### Via Cloudflare API

```bash
# Create service token
curl -X POST "https://api.cloudflare.com/client/v4/accounts/{account_id}/access/service_tokens" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "chitty-api-service",
    "duration": "8760h"
  }'
```

## Using Service Tokens

### In Application Code

```javascript
// Example: Using service token for API requests
const headers = {
  'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID,
  'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET,
  'Content-Type': 'application/json'
};

const response = await fetch('https://assets.chitty.cc/api/assets', {
  headers
});
```

### In GitHub Actions

```yaml
- name: Deploy to Cloudflare
  env:
    CF_ACCESS_CLIENT_ID: ${{ secrets.CF_ACCESS_CLIENT_ID }}
    CF_ACCESS_CLIENT_SECRET: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}
  run: |
    curl -X POST https://assets.chitty.cc/api/deploy \
      -H "CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}" \
      -H "CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET}" \
      --data '{"version": "${{ github.sha }}"}'
```

### In ChittyAuth Integration

```typescript
// server/chittyAuth.ts extension for Cloudflare
export class ChittyAuthCloudflare {
  private serviceToken: {
    clientId: string;
    clientSecret: string;
  };

  constructor() {
    this.serviceToken = {
      clientId: process.env.CF_ACCESS_CLIENT_ID!,
      clientSecret: process.env.CF_ACCESS_CLIENT_SECRET!,
    };
  }

  async authenticateService(req: Request): Promise<boolean> {
    const clientId = req.headers['cf-access-client-id'];
    const clientSecret = req.headers['cf-access-client-secret'];

    return (
      clientId === this.serviceToken.clientId &&
      clientSecret === this.serviceToken.clientSecret
    );
  }
}
```

## Token Rotation

### Rotation Schedule

- **Production tokens**: Every 6 months
- **Staging tokens**: Every 12 months
- **Development tokens**: Every 12 months
- **Emergency tokens**: After each use

### Rotation Process

1. Create new token with overlapping validity
2. Update environment variables in:
   - GitHub Secrets
   - Cloudflare Workers environment
   - Kubernetes secrets
   - Local .env files
3. Test new token in staging
4. Deploy to production
5. Revoke old token after 24 hours

### Automated Rotation Script

```bash
#!/bin/bash
# rotate-service-token.sh

TOKEN_NAME=$1
ENVIRONMENT=$2

# Create new token
NEW_TOKEN=$(cloudflare-cli create-service-token --name "${TOKEN_NAME}-new")

# Update GitHub secrets
gh secret set CF_ACCESS_CLIENT_ID --body "$(echo $NEW_TOKEN | jq -r .client_id)"
gh secret set CF_ACCESS_CLIENT_SECRET --body "$(echo $NEW_TOKEN | jq -r .client_secret)"

# Update Cloudflare Workers
wrangler secret put CF_ACCESS_CLIENT_ID
wrangler secret put CF_ACCESS_CLIENT_SECRET

echo "Token rotation complete. Remember to revoke old token in 24 hours."
```

## Security Best Practices

### Storage

- ✅ Store in environment variables
- ✅ Use secret management systems (Vault, AWS Secrets Manager)
- ✅ Encrypt at rest
- ❌ Never commit to git
- ❌ Never log token values

### Access Control

- Limit token scope to specific paths
- Use separate tokens per environment
- Implement token allowlisting
- Monitor token usage in Access logs

### Monitoring

Set up alerts for:
- Unauthorized token usage
- Token expiration (30 days before)
- Unusual request patterns
- Failed authentication attempts

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Verify token not expired
   - Check correct headers are sent
   - Ensure token has required permissions

2. **403 Forbidden**
   - Token lacks access to resource
   - IP/geo restrictions in place
   - Service Auth policy not configured

3. **Token Expired**
   - Rotate token immediately
   - Update all services
   - Review rotation schedule

### Debug Headers

Enable debug mode to see policy evaluation:

```javascript
headers['CF-Access-Debug-Mode'] = 'true';
```

## Emergency Procedures

### Token Compromise

1. Immediately revoke compromised token
2. Create new token with different name
3. Update all services
4. Review access logs for unauthorized usage
5. File security incident report

### Emergency Access

For emergency access when tokens fail:

1. Use break-glass policy with MFA
2. Document access reason
3. Rotate all tokens after incident
4. Review and update policies

## Integration with ChittyAuth

ChittyAuth automatically handles Cloudflare Access tokens when configured:

```typescript
// Automatic service token injection
const chittyAuth = new ChittyAuth({
  cloudflare: {
    enabled: true,
    clientId: process.env.CF_ACCESS_CLIENT_ID,
    clientSecret: process.env.CF_ACCESS_CLIENT_SECRET,
  }
});
```

This enables seamless authentication between ChittyAuth (Clerk) and Cloudflare Access.