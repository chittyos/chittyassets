# Notion Command Center Sync Setup

This document explains how to set up the Notion Command Center sync for ChittyAssets.

## Overview

The Notion Command Center Sync workflow automatically syncs repository metadata, commits, and project status to a Notion database. This provides a centralized command center for monitoring all ChittyOS projects.

## Prerequisites

1. **Notion Account**: You need admin access to a Notion workspace
2. **Notion Integration**: Create an integration at https://www.notion.so/my-integrations
3. **Notion Database**: Create a database with the required properties (see below)

## Setup Steps

### 1. Create Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Name it "ChittyAssets Sync"
4. Select your workspace
5. Copy the **Internal Integration Token** (starts with `secret_`)

### 2. Create Notion Database

Create a new database in Notion with these properties:

| Property Name | Type | Description |
|--------------|------|-------------|
| Repository | Title | The repository name |
| Version | Text | Current version from package.json |
| Description | Text | Repository description |
| Last Sync | Date | Timestamp of last successful sync |
| Status | Select | Options: Active, Inactive, Failed |
| Dependencies | Number | Count of dependencies |
| Branch | Text | Current branch name |
| Last Commit | Text | Short SHA of last commit |

### 3. Share Database with Integration

1. Open your database in Notion
2. Click "Share" in the top right
3. Search for your integration name
4. Click "Invite"

### 4. Get Database ID

1. Open the database as a full page
2. Copy the URL (e.g., `https://www.notion.so/myworkspace/abc123def456...`)
3. The database ID is the part after the workspace name and before the `?`
   - In the example above: `abc123def456...`

### 5. Configure GitHub Secrets

Add these secrets to your GitHub repository:

1. Go to Settings → Secrets and variables → Actions
2. Add the following repository secrets:

| Secret Name | Value | Description |
|------------|-------|-------------|
| `NOTION_API_KEY` | `secret_...` | Your Notion integration token |
| `NOTION_DATABASE_ID` | `abc123...` | Your database ID from step 4 |
| `NOTION_STATUS_PAGE_ID` | `xyz789...` | (Optional) Page ID for status updates |
| `CHITTY_REGISTRY_API_KEY` | `chitty_...` | (Optional) ChittyRegistry API key |

### 6. Create Status Page (Optional)

If you want sync status updates:

1. Create a new page in Notion for status updates
2. Share it with your integration
3. Get the page ID from the URL (similar to database ID)
4. Add as `NOTION_STATUS_PAGE_ID` secret

## Testing

After setup, you can test the workflow:

1. Go to Actions tab in GitHub
2. Select "Notion Command Center Sync"
3. Click "Run workflow"
4. Select branch and click "Run workflow"

## Workflow Triggers

The sync runs on:
- Every push to main branch
- Every pull request
- Manual trigger (workflow_dispatch)
- Every 6 hours (scheduled)

## Troubleshooting

### Common Issues

1. **"API token is invalid"**
   - Check that `NOTION_API_KEY` is correctly set
   - Ensure the token starts with `secret_`

2. **"Database not found"**
   - Verify the database ID is correct
   - Ensure the database is shared with your integration

3. **"Unauthorized"**
   - Make sure the integration has access to the database
   - Re-invite the integration if necessary

4. **Workflow times out**
   - Check network connectivity
   - Verify Notion API is accessible
   - Review script logs for hanging operations

### Debugging

Enable debug mode by adding this secret:
- `ACTIONS_RUNNER_DEBUG`: `true`

This will provide verbose output in the workflow logs.

## Monitoring

The workflow creates GitHub issues on failure to notify maintainers. Issues are labeled with:
- `bug`
- `notion-sync`

## Support

For issues with:
- **Notion API**: Check https://developers.notion.com/
- **GitHub Actions**: See https://docs.github.com/actions
- **ChittyAssets**: Open an issue in this repository