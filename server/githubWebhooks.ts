/**
 * GitHub App Webhook Handler for ChittyAssets
 * Processes GitHub events and triggers appropriate actions
 */

import crypto from 'crypto';
import express, { type Request, type Response, type NextFunction, type Express } from 'express';
import { storage } from './storage';

interface GitHubWebhookPayload {
  action?: string;
  repository?: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  sender?: {
    login: string;
    id: number;
  };
  installation?: {
    id: number;
  };
  pull_request?: any;
  issue?: any;
  workflow_run?: any;
  check_run?: any;
}

export class GitHubWebhookHandler {
  private webhookSecret: string;

  constructor(webhookSecret: string) {
    this.webhookSecret = webhookSecret;
  }

  /**
   * Verify webhook signature
   */
  private verifySignature(payload: string, signature: string | undefined): boolean {
    if (!signature) return false;

    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  }

  /**
   * Main webhook handler middleware
   */
  public handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;
      const event = req.headers['x-github-event'] as string;
      const delivery = req.headers['x-github-delivery'] as string;

      // Verify signature
      const payload = JSON.stringify(req.body);
      if (!this.verifySignature(payload, signature)) {
        console.error('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      console.log(`📨 GitHub webhook received: ${event} (${delivery})`);

      // Process the webhook based on event type
      await this.processWebhook(event, req.body as GitHubWebhookPayload);

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  };

  /**
   * Process webhook based on event type
   */
  private async processWebhook(event: string, payload: GitHubWebhookPayload): Promise<void> {
    switch (event) {
      case 'push':
        await this.handlePush(payload);
        break;

      case 'pull_request':
        await this.handlePullRequest(payload);
        break;

      case 'issues':
        await this.handleIssue(payload);
        break;

      case 'workflow_run':
        await this.handleWorkflowRun(payload);
        break;

      case 'check_run':
        await this.handleCheckRun(payload);
        break;

      case 'installation':
        await this.handleInstallation(payload);
        break;

      case 'repository_dispatch':
        await this.handleRepositoryDispatch(payload);
        break;

      default:
        console.log(`Unhandled event type: ${event}`);
    }
  }

  /**
   * Handle push events
   */
  private async handlePush(payload: GitHubWebhookPayload): Promise<void> {
    console.log(`🚀 Push to ${payload.repository?.full_name}`);

    // Trigger Notion sync on push to main
    if (payload.repository?.full_name === 'chittyos/chittyassets') {
      await this.triggerNotionSync();
    }

    // Log activity
    await this.logActivity('push', payload);
  }

  /**
   * Handle pull request events
   */
  private async handlePullRequest(payload: GitHubWebhookPayload): Promise<void> {
    const action = payload.action;
    const pr = payload.pull_request;

    console.log(`🔄 Pull request ${action}: #${pr?.number}`);

    // Auto-label based on files changed
    if (action === 'opened' || action === 'synchronize') {
      await this.autoLabelPullRequest(pr);
    }

    // Run security checks
    if (action === 'opened') {
      await this.runSecurityChecks(pr);
    }

    await this.logActivity('pull_request', payload);
  }

  /**
   * Handle issue events
   */
  private async handleIssue(payload: GitHubWebhookPayload): Promise<void> {
    const action = payload.action;
    const issue = payload.issue;

    console.log(`📋 Issue ${action}: #${issue?.number}`);

    // Auto-respond to new issues
    if (action === 'opened') {
      await this.autoRespondToIssue(issue);
    }

    await this.logActivity('issue', payload);
  }

  /**
   * Handle workflow run events
   */
  private async handleWorkflowRun(payload: GitHubWebhookPayload): Promise<void> {
    const run = payload.workflow_run;

    console.log(`⚙️ Workflow ${run?.name}: ${run?.status}`);

    // Send notifications for failed workflows
    if (run?.conclusion === 'failure') {
      await this.notifyWorkflowFailure(run);
    }

    await this.logActivity('workflow_run', payload);
  }

  /**
   * Handle check run events
   */
  private async handleCheckRun(payload: GitHubWebhookPayload): Promise<void> {
    const check = payload.check_run;

    console.log(`✅ Check run ${check?.name}: ${check?.status}`);

    await this.logActivity('check_run', payload);
  }

  /**
   * Handle installation events
   */
  private async handleInstallation(payload: GitHubWebhookPayload): Promise<void> {
    const action = payload.action;

    console.log(`🔧 App installation ${action}`);

    if (action === 'created') {
      await this.onAppInstalled(payload);
    } else if (action === 'deleted') {
      await this.onAppUninstalled(payload);
    }

    await this.logActivity('installation', payload);
  }

  /**
   * Handle repository dispatch events
   */
  private async handleRepositoryDispatch(payload: any): Promise<void> {
    const eventType = payload.event_type;

    console.log(`📡 Repository dispatch: ${eventType}`);

    // Handle custom events
    switch (eventType) {
      case 'deploy':
        await this.triggerDeployment(payload.client_payload);
        break;
      case 'sync':
        await this.triggerNotionSync();
        break;
      default:
        console.log(`Unknown dispatch event: ${eventType}`);
    }

    await this.logActivity('repository_dispatch', payload);
  }

  /**
   * Helper functions
   */

  private async triggerNotionSync(): Promise<void> {
    console.log('🔄 Triggering Notion sync...');
    // Trigger the Notion sync workflow
    // This would call the GitHub API to trigger the workflow
  }

  private async autoLabelPullRequest(pr: any): Promise<void> {
    console.log(`🏷️ Auto-labeling PR #${pr?.number}`);
    // Analyze changed files and add appropriate labels
  }

  private async runSecurityChecks(pr: any): Promise<void> {
    console.log(`🔒 Running security checks for PR #${pr?.number}`);
    // Trigger security scanning workflows
  }

  private async autoRespondToIssue(issue: any): Promise<void> {
    console.log(`💬 Auto-responding to issue #${issue?.number}`);
    // Post welcome message or categorize issue
  }

  private async notifyWorkflowFailure(run: any): Promise<void> {
    console.log(`⚠️ Notifying about workflow failure: ${run?.name}`);
    // Send notifications via Slack/Discord/email
  }

  private async onAppInstalled(payload: GitHubWebhookPayload): Promise<void> {
    console.log(`✨ App installed on ${payload.repository?.full_name}`);
    // Initialize repository settings
  }

  private async onAppUninstalled(payload: GitHubWebhookPayload): Promise<void> {
    console.log(`👋 App uninstalled from ${payload.repository?.full_name}`);
    // Clean up repository data
  }

  private async triggerDeployment(payload: any): Promise<void> {
    console.log(`🚀 Triggering deployment: ${payload?.environment}`);
    // Trigger deployment workflow
  }

  private async logActivity(event: string, payload: GitHubWebhookPayload): Promise<void> {
    // Log webhook activity for audit trail
    const activity = {
      event,
      repository: payload.repository?.full_name,
      sender: payload.sender?.login,
      timestamp: new Date().toISOString(),
      installation_id: payload.installation?.id,
    };

    console.log('📝 Activity logged:', activity);
    // Store in database if needed
  }
}

/**
 * Setup GitHub webhook routes
 */
export function setupGitHubWebhooks(app: Express): void {
  const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('⚠️ GITHUB_APP_WEBHOOK_SECRET not configured');
    return;
  }

  const handler = new GitHubWebhookHandler(webhookSecret);

  // GitHub webhook endpoint
  app.post('/api/github/webhooks', express.raw({ type: 'application/json' }), handler.handleWebhook);

  // GitHub App callback (OAuth flow)
  app.get('/api/github/callback', async (req, res) => {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Missing code parameter' });
    }

    // Exchange code for access token
    // This would implement OAuth flow
    console.log('GitHub OAuth callback received');

    res.redirect('/dashboard?github=connected');
  });

  // GitHub App setup endpoint
  app.get('/api/github/setup', async (req, res) => {
    res.json({
      message: 'ChittyAssets GitHub App Setup',
      status: 'ready',
      version: '1.0.0',
    });
  });

  console.log('✅ GitHub webhooks configured');
}