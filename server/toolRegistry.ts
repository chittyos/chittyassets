export type ToolCategory =
  | 'cloudflare'
  | 'content'
  | 'communications'
  | 'database';

export interface ToolResource {
  id: string;
  name: string;
  provider: string;
  description: string;
  category: ToolCategory;
  callable: boolean;
  capabilities: string[];
}

const toolResources: ToolResource[] = [
  {
    id: 'cloudflare.workers.assets',
    name: 'Cloudflare Workers Evidence Tools',
    provider: 'Cloudflare',
    description: 'Edge Workers used by the Evidence Ledger for freeze/mint workflows.',
    category: 'cloudflare',
    callable: true,
    capabilities: ['freeze', 'mint', 'status'],
  },
  {
    id: 'notion.search',
    name: 'Notion Workspace Search',
    provider: 'Notion',
    description: 'Search across workspace pages, databases, and synced asset briefs.',
    category: 'content',
    callable: true,
    capabilities: ['search', 'filter', 'page-context'],
  },
  {
    id: 'google.drive.search',
    name: 'Google Drive Discovery',
    provider: 'Google Drive',
    description: 'Search Drive documents, spreadsheets, and evidence attachments.',
    category: 'content',
    callable: true,
    capabilities: ['search', 'metadata', 'shared-drives'],
  },
  {
    id: 'outlook.mail.search',
    name: 'Outlook / SharePoint Email + Files',
    provider: 'Microsoft 365',
    description: 'Search Outlook mailboxes and SharePoint file evidence for discovery.',
    category: 'communications',
    callable: true,
    capabilities: ['search', 'attachments', 'sharepoint-sites'],
  },
  {
    id: 'neon.metadata.search',
    name: 'Neon DB Metadata',
    provider: 'Neon',
    description: 'Search database schemas and column lineage for stored evidence.',
    category: 'database',
    callable: true,
    capabilities: ['tables', 'columns', 'lineage'],
  },
];

export function listToolResources(): ToolResource[] {
  return toolResources;
}
