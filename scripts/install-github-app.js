#!/usr/bin/env node

/**
 * GitHub App Installation Script for ChittyAssets
 * This script helps install and configure the ChittyAssets GitHub App
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('\n🤖 ChittyAssets GitHub App Installation\n', 'bright');
  log('This script will help you install and configure the ChittyAssets GitHub App.\n', 'blue');

  // Check if running in a git repository
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
  } catch (error) {
    log('❌ Error: Not in a git repository', 'red');
    process.exit(1);
  }

  // Get repository information
  const repoUrl = execSync('git config --get remote.origin.url').toString().trim();
  const repoMatch = repoUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);

  if (!repoMatch) {
    log('❌ Error: Could not parse GitHub repository URL', 'red');
    process.exit(1);
  }

  const owner = repoMatch[1];
  const repo = repoMatch[2];

  log(`📦 Repository: ${owner}/${repo}\n`, 'green');

  // Check for existing installation
  const envPath = path.join(process.cwd(), '.env');
  const envExists = fs.existsSync(envPath);

  if (envExists) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    if (envContent.includes('GITHUB_APP_ID')) {
      log('⚠️  GitHub App configuration already exists in .env file', 'yellow');
      const overwrite = await question('Do you want to overwrite? (y/N): ');
      if (overwrite.toLowerCase() !== 'y') {
        log('Installation cancelled', 'yellow');
        process.exit(0);
      }
    }
  }

  // Installation options
  log('\nSelect installation method:', 'bright');
  log('1. Create new GitHub App', 'blue');
  log('2. Use existing GitHub App', 'blue');
  log('3. Install from manifest URL', 'blue');

  const choice = await question('\nEnter choice (1-3): ');

  switch (choice) {
    case '1':
      await createNewApp(owner, repo);
      break;
    case '2':
      await useExistingApp();
      break;
    case '3':
      await installFromManifest(owner, repo);
      break;
    default:
      log('Invalid choice', 'red');
      process.exit(1);
  }

  log('\n✅ GitHub App installation complete!', 'green');
  log('\nNext steps:', 'bright');
  log('1. Install the app on your repository', 'blue');
  log('2. Configure webhooks in the GitHub App settings', 'blue');
  log('3. Test the integration with: npm run test:github-app', 'blue');

  rl.close();
}

async function createNewApp(owner, repo) {
  log('\n📝 Creating new GitHub App...', 'yellow');

  const manifestPath = path.join(__dirname, '..', '.github', 'app', 'app-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // Update manifest with repository-specific information
  manifest.name = `${repo} Bot`;
  manifest.url = `https://github.com/${owner}/${repo}`;

  // Generate manifest URL
  const manifestUrl = `https://github.com/settings/apps/new?state=${generateState()}&manifest=${encodeURIComponent(JSON.stringify(manifest))}`;

  log('\n🌐 Opening browser to create GitHub App...', 'blue');
  log(`If browser doesn't open, visit:\n${manifestUrl}\n`, 'yellow');

  // Try to open browser
  const platform = process.platform;
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';

  try {
    execSync(`${command} "${manifestUrl}"`);
  } catch (error) {
    log('Could not open browser automatically', 'yellow');
  }

  log('\n⏳ Complete the GitHub App creation in your browser', 'blue');

  const appId = await question('\nEnter the App ID from GitHub: ');
  const clientId = await question('Enter the Client ID: ');
  const clientSecret = await question('Enter the Client Secret: ');
  const webhookSecret = await question('Enter the Webhook Secret: ');
  const privateKey = await question('Enter the path to the private key file: ');

  await saveConfiguration({
    appId,
    clientId,
    clientSecret,
    webhookSecret,
    privateKey: fs.readFileSync(privateKey, 'utf-8')
  });
}

async function useExistingApp() {
  log('\n🔧 Configuring existing GitHub App...', 'yellow');

  const appId = await question('Enter the App ID: ');
  const clientId = await question('Enter the Client ID: ');
  const clientSecret = await question('Enter the Client Secret: ');
  const webhookSecret = await question('Enter the Webhook Secret: ');
  const privateKey = await question('Enter the path to the private key file: ');

  await saveConfiguration({
    appId,
    clientId,
    clientSecret,
    webhookSecret,
    privateKey: fs.readFileSync(privateKey, 'utf-8')
  });
}

async function installFromManifest(owner, repo) {
  log('\n🔗 Installing from manifest URL...', 'yellow');

  const manifestUrl = await question('Enter the manifest URL: ');

  log('\n🌐 Opening browser to install GitHub App...', 'blue');

  const platform = process.platform;
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';

  try {
    execSync(`${command} "${manifestUrl}"`);
  } catch (error) {
    log('Could not open browser automatically', 'yellow');
  }

  log('\n⏳ Complete the installation in your browser', 'blue');

  const appId = await question('\nEnter the App ID from GitHub: ');
  const clientId = await question('Enter the Client ID: ');
  const clientSecret = await question('Enter the Client Secret: ');
  const webhookSecret = await question('Enter the Webhook Secret: ');
  const privateKey = await question('Enter the path to the private key file: ');

  await saveConfiguration({
    appId,
    clientId,
    clientSecret,
    webhookSecret,
    privateKey: fs.readFileSync(privateKey, 'utf-8')
  });
}

async function saveConfiguration(config) {
  log('\n💾 Saving configuration...', 'yellow');

  // Save to .env file
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');

    // Remove existing GitHub App configuration
    envContent = envContent.replace(/^GITHUB_APP_.*$/gm, '');
    envContent = envContent.replace(/\n\n+/g, '\n\n');
  }

  // Add new configuration
  envContent += `
# GitHub App Configuration
GITHUB_APP_ID=${config.appId}
GITHUB_APP_CLIENT_ID=${config.clientId}
GITHUB_APP_CLIENT_SECRET=${config.clientSecret}
GITHUB_APP_WEBHOOK_SECRET=${config.webhookSecret}
`;

  fs.writeFileSync(envPath, envContent.trim() + '\n');

  // Save private key
  const keyPath = path.join(process.cwd(), '.github', 'app', 'private-key.pem');
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(keyPath, config.privateKey);
  fs.chmodSync(keyPath, 0o600); // Set restrictive permissions

  // Update .gitignore
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  let gitignoreContent = '';

  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  }

  if (!gitignoreContent.includes('private-key.pem')) {
    gitignoreContent += '\n# GitHub App private key\n.github/app/private-key.pem\n';
    fs.writeFileSync(gitignorePath, gitignoreContent);
  }

  log('✅ Configuration saved successfully', 'green');

  // Create GitHub secrets documentation
  log('\n📝 Creating GitHub Secrets documentation...', 'yellow');

  const secretsDoc = `
# GitHub Secrets Required

Add these secrets to your repository:
1. Go to Settings → Secrets and variables → Actions
2. Add the following repository secrets:

- GITHUB_APP_ID: ${config.appId}
- GITHUB_APP_PRIVATE_KEY: [Contents of private-key.pem]
- GITHUB_APP_WEBHOOK_SECRET: ${config.webhookSecret}

These are already saved in your local .env file.
`;

  fs.writeFileSync(path.join(process.cwd(), '.github', 'app', 'SECRETS.md'), secretsDoc);

  log('📄 Secrets documentation created at .github/app/SECRETS.md', 'green');
}

function generateState() {
  return Math.random().toString(36).substring(2, 15);
}

// Run the script
main().catch((error) => {
  log(`\n❌ Error: ${error.message}`, 'red');
  process.exit(1);
});