#!/usr/bin/env node

/**
 * Update Notion sync status
 * Updates a status page in Notion with the latest sync results
 */

import { Client } from '@notionhq/client';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const statusPageId = process.env.NOTION_STATUS_PAGE_ID;

async function updateSyncStatus(status) {
  console.log(`📝 Updating sync status: ${status}`);

  try {
    if (!statusPageId) {
      console.warn('⚠️ NOTION_STATUS_PAGE_ID not configured, skipping status update');
      return;
    }

    const emoji = status === 'success' ? '✅' : '❌';
    const statusText = status === 'success' ? 'Operational' : 'Failed';
    const color = status === 'success' ? 'green' : 'red';

    await notion.blocks.children.append({
      block_id: statusPageId,
      children: [
        {
          object: 'block',
          type: 'callout',
          callout: {
            icon: {
              type: 'emoji',
              emoji: emoji,
            },
            color: color === 'green' ? 'green_background' : 'red_background',
            rich_text: [
              {
                type: 'text',
                text: {
                  content: `ChittyAssets Sync ${statusText}`,
                },
                annotations: {
                  bold: true,
                },
              },
              {
                type: 'text',
                text: {
                  content: `\nLast update: ${new Date().toLocaleString()}`,
                },
              },
              {
                type: 'text',
                text: {
                  content: `\nRun: #${process.env.GITHUB_RUN_NUMBER || 'N/A'}`,
                },
              },
              {
                type: 'text',
                text: {
                  content: `\nCommit: ${(process.env.GITHUB_SHA || 'unknown').substring(0, 7)}`,
                },
              },
              {
                type: 'text',
                text: {
                  content: `\nBranch: ${process.env.GITHUB_REF_NAME || 'main'}`,
                },
              },
            ],
          },
        },
      ],
    });

    console.log(`✅ Status updated: ${statusText}`);
  } catch (error) {
    console.error('Failed to update status:', error.message);
    // Don't fail the workflow if status update fails
  }
}

// Get status from command line argument
const status = process.argv[2] || 'unknown';
updateSyncStatus(status);