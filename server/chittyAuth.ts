/**
 * ChittyAuth - Unified authentication system for ChittyOS ecosystem
 * Combines ChittyID (identity management) + ChittyVerify (verification layer)
 * Underpinned by Clerk for secure authentication infrastructure
 */

import { ClerkExpressRequireAuth, ClerkExpressWithAuth, RequireAuthProp, WithAuthProp } from '@clerk/express';
import { clerkClient, createClerkClient } from '@clerk/backend';
import type { Express, RequestHandler, Request, Response, NextFunction } from 'express';
import { storage } from './storage';

// Initialize Clerk client with environment variables
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY || '',
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
});

/**
 * ChittyID - Identity management service
 * Handles user identification and profile management
 */
export class ChittyID {
  private static instance: ChittyID;

  private constructor() {}

  static getInstance(): ChittyID {
    if (!ChittyID.instance) {
      ChittyID.instance = new ChittyID();
    }
    return ChittyID.instance;
  }

  async createIdentity(clerkUserId: string, metadata: any) {
    // Create ChittyID from Clerk user
    const clerkUser = await clerk.users.getUser(clerkUserId);

    const chittyId = {
      id: `chitty_${clerkUserId}`,
      clerkId: clerkUserId,
      email: clerkUser.emailAddresses[0]?.emailAddress,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      profileImageUrl: clerkUser.imageUrl,
      verificationStatus: 'pending',
      createdAt: new Date(),
      metadata: {
        ...metadata,
        primaryEmail: clerkUser.emailAddresses[0]?.emailAddress,
        phoneNumber: clerkUser.phoneNumbers[0]?.phoneNumber,
      }
    };

    // Store in database
    await storage.upsertUser({
      id: chittyId.id,
      email: chittyId.email,
      firstName: chittyId.firstName,
      lastName: chittyId.lastName,
      profileImageUrl: chittyId.profileImageUrl,
    });

    return chittyId;
  }

  async getIdentity(chittyId: string) {
    return await storage.getUser(chittyId);
  }

  async updateIdentity(chittyId: string, updates: any) {
    // Update both Clerk and local database
    const user = await storage.getUser(chittyId);
    if (!user) throw new Error('ChittyID not found');

    // Extract Clerk ID from ChittyID
    const clerkId = chittyId.replace('chitty_', '');

    // Update Clerk user
    await clerk.users.updateUser(clerkId, {
      firstName: updates.firstName,
      lastName: updates.lastName,
    });

    // Update local database
    await storage.upsertUser({
      id: chittyId,
      email: updates.email || user.email,
      firstName: updates.firstName || user.firstName,
      lastName: updates.lastName || user.lastName,
      profileImageUrl: updates.profileImageUrl || user.profileImageUrl,
    });

    return await this.getIdentity(chittyId);
  }
}

/**
 * ChittyVerify - Verification and validation layer
 * Handles multi-factor authentication and identity verification
 */
export class ChittyVerify {
  private static instance: ChittyVerify;

  private constructor() {}

  static getInstance(): ChittyVerify {
    if (!ChittyVerify.instance) {
      ChittyVerify.instance = new ChittyVerify();
    }
    return ChittyVerify.instance;
  }

  async verifyIdentity(chittyId: string, verificationMethod: 'email' | 'phone' | 'document'): Promise<boolean> {
    // Extract Clerk ID
    const clerkId = chittyId.replace('chitty_', '');
    const clerkUser = await clerk.users.getUser(clerkId);

    switch (verificationMethod) {
      case 'email':
        // Check if primary email is verified in Clerk
        const primaryEmail = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId);
        return primaryEmail?.verification?.status === 'verified';

      case 'phone':
        // Check if primary phone is verified in Clerk
        const primaryPhone = clerkUser.phoneNumbers.find(p => p.id === clerkUser.primaryPhoneNumberId);
        return primaryPhone?.verification?.status === 'verified';

      case 'document':
        // Custom document verification logic
        // This could integrate with a document verification service
        return await this.verifyDocument(chittyId);

      default:
        return false;
    }
  }

  async verifyDocument(chittyId: string): Promise<boolean> {
    // Placeholder for document verification
    // In production, this would integrate with document verification services
    // For now, we'll check if user has uploaded verification documents
    const user = await storage.getUser(chittyId);
    return user?.verificationStatus === 'verified';
  }

  async initiateVerification(chittyId: string, method: 'email' | 'phone') {
    const clerkId = chittyId.replace('chitty_', '');

    if (method === 'email') {
      // Trigger email verification through Clerk
      await clerk.users.updateUser(clerkId, {
        publicMetadata: {
          verificationRequested: true,
          verificationMethod: method,
          requestedAt: new Date().toISOString(),
        }
      });
    } else if (method === 'phone') {
      // Trigger phone verification through Clerk
      await clerk.users.updateUser(clerkId, {
        publicMetadata: {
          verificationRequested: true,
          verificationMethod: method,
          requestedAt: new Date().toISOString(),
        }
      });
    }

    return { success: true, method };
  }

  async getVerificationStatus(chittyId: string) {
    const emailVerified = await this.verifyIdentity(chittyId, 'email');
    const phoneVerified = await this.verifyIdentity(chittyId, 'phone');
    const documentVerified = await this.verifyDocument(chittyId);

    return {
      chittyId,
      email: emailVerified,
      phone: phoneVerified,
      document: documentVerified,
      overallStatus: emailVerified && (phoneVerified || documentVerified) ? 'verified' : 'pending',
      verificationLevel: this.calculateVerificationLevel(emailVerified, phoneVerified, documentVerified),
    };
  }

  private calculateVerificationLevel(email: boolean, phone: boolean, document: boolean): number {
    let level = 0;
    if (email) level += 1;
    if (phone) level += 1;
    if (document) level += 2; // Document verification has higher weight
    return level;
  }
}

/**
 * ChittyAuth - Main authentication service
 * Orchestrates ChittyID and ChittyVerify with Clerk
 */
export class ChittyAuth {
  private chittyId: ChittyID;
  private chittyVerify: ChittyVerify;

  constructor() {
    this.chittyId = ChittyID.getInstance();
    this.chittyVerify = ChittyVerify.getInstance();
  }

  /**
   * Setup ChittyAuth with Express app
   */
  async setupAuth(app: Express) {
    // Health check endpoint
    app.get('/api/auth/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'ChittyAuth',
        components: {
          chittyId: 'active',
          chittyVerify: 'active',
          clerk: 'active',
        }
      });
    });

    // Sign up with ChittyAuth
    app.post('/api/auth/signup', async (req, res) => {
      try {
        const { email, password, firstName, lastName, phoneNumber } = req.body;

        // Create user in Clerk
        const clerkUser = await clerk.users.createUser({
          emailAddress: [email],
          password,
          firstName,
          lastName,
          phoneNumber: phoneNumber ? [phoneNumber] : undefined,
        });

        // Create ChittyID
        const chittyIdentity = await this.chittyId.createIdentity(clerkUser.id, {
          signupSource: 'chittyassets',
          signupDate: new Date().toISOString(),
        });

        // Initiate email verification
        await this.chittyVerify.initiateVerification(chittyIdentity.id, 'email');

        res.json({
          success: true,
          chittyId: chittyIdentity.id,
          message: 'ChittyID created successfully. Please verify your email.',
        });
      } catch (error) {
        console.error('ChittyAuth signup error:', error);
        res.status(400).json({
          success: false,
          message: 'Failed to create ChittyID',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Verify identity
    app.post('/api/auth/verify', ClerkExpressRequireAuth(), async (req: RequireAuthProp<Request>, res) => {
      try {
        const clerkId = req.auth.userId;
        const chittyId = `chitty_${clerkId}`;
        const { method } = req.body;

        const result = await this.chittyVerify.initiateVerification(chittyId, method);

        res.json({
          success: true,
          ...result,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          message: 'Verification failed',
        });
      }
    });

    // Get verification status
    app.get('/api/auth/verification-status', ClerkExpressRequireAuth(), async (req: RequireAuthProp<Request>, res) => {
      try {
        const clerkId = req.auth.userId;
        const chittyId = `chitty_${clerkId}`;

        const status = await this.chittyVerify.getVerificationStatus(chittyId);

        res.json(status);
      } catch (error) {
        res.status(400).json({
          success: false,
          message: 'Failed to get verification status',
        });
      }
    });

    // Get ChittyID profile
    app.get('/api/auth/profile', ClerkExpressRequireAuth(), async (req: RequireAuthProp<Request>, res) => {
      try {
        const clerkId = req.auth.userId;
        const chittyId = `chitty_${clerkId}`;

        const identity = await this.chittyId.getIdentity(chittyId);
        const verificationStatus = await this.chittyVerify.getVerificationStatus(chittyId);

        res.json({
          ...identity,
          verification: verificationStatus,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          message: 'Failed to get profile',
        });
      }
    });

    // Update ChittyID profile
    app.put('/api/auth/profile', ClerkExpressRequireAuth(), async (req: RequireAuthProp<Request>, res) => {
      try {
        const clerkId = req.auth.userId;
        const chittyId = `chitty_${clerkId}`;

        const updated = await this.chittyId.updateIdentity(chittyId, req.body);

        res.json({
          success: true,
          profile: updated,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          message: 'Failed to update profile',
        });
      }
    });
  }

  /**
   * Middleware to require ChittyAuth authentication
   */
  requireAuth(): RequestHandler {
    return ClerkExpressRequireAuth();
  }

  /**
   * Middleware to optionally include ChittyAuth authentication
   */
  withAuth(): RequestHandler {
    return ClerkExpressWithAuth();
  }

  /**
   * Middleware to require verified ChittyID
   */
  requireVerified(): RequestHandler {
    return async (req: RequireAuthProp<Request>, res: Response, next: NextFunction) => {
      try {
        // First check Clerk auth
        await ClerkExpressRequireAuth()(req, res, async () => {
          const clerkId = req.auth.userId;
          const chittyId = `chitty_${clerkId}`;

          const status = await this.chittyVerify.getVerificationStatus(chittyId);

          if (status.overallStatus === 'verified') {
            next();
          } else {
            res.status(403).json({
              success: false,
              message: 'ChittyID verification required',
              verificationStatus: status,
            });
          }
        });
      } catch (error) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }
    };
  }
}

// Export singleton instance
export const chittyAuth = new ChittyAuth();

// Export middleware functions for convenience
export const requireChittyAuth = () => chittyAuth.requireAuth();
export const withChittyAuth = () => chittyAuth.withAuth();
export const requireVerifiedChitty = () => chittyAuth.requireVerified();