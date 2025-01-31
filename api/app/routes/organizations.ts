import { NextFunction, Router, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import db from "../config/db";
import {
  organizationMembers,
  organizations,
  samlConfigs,
  users,
} from "../config/schema";
import { authMiddleware } from "../middleware/auth";
import { z } from "zod";

const router = Router();

// Middleware to check if user is org admin
async function isOrgAdmin(req: any, res: Response, next: NextFunction) {
  const member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, req.params.orgId),
      eq(organizationMembers.userId, req.dbUser!.id)
    ),
  });

  if (!member || member.role !== "owner") {
    res.status(403).json({ error: "Not authorized" });
    return;
  }
  next();
}

const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  domain: z.string().optional(),
});

// Create organization
router.post("/", authMiddleware, async (req, res) => {
  const validatedData = createOrgSchema.parse(req.body);
  const { name, domain } = validatedData;

  try {
    if (!req.dbUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-");

    // Create org and add current user as owner in transaction
    const [org] = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({
          name,
          slug,
          domain: domain || null,
        })
        .returning();

      await tx.insert(organizationMembers).values({
        organizationId: org.id,
        userId: req.dbUser!.id,
        role: "owner",
      });

      return [org];
    });

    res.json(org);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Failed to create organization" });
  }
});

// Get organization by domain (used for SSO)
router.get("/domain/:domain", async (req, res) => {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.domain, req.params.domain),
    with: {
      samlConfig: true,
    },
  });

  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  res.json(org);
});

// Get user's organizations
router.get("/me", async (req, res) => {
  const memberships = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.userId, req.dbUser!.id),
    with: {
      organization: true,
    },
  });

  res.json(
    memberships.map((m) => ({
      ...m.organization,
      role: m.role,
    }))
  );
});

const samlConfigSchema = z.object({
  entryPoint: z.string().url(),
  issuer: z.string().min(1),
  cert: z.string().min(1),
  callbackUrl: z.string().url(),
});

interface DecryptedSamlConfig {
  entry_point: string;
  issuer: string;
  cert: string;
  callback_url: string;
}

// Update organization settings (including SAML)
router.put("/:orgId", authMiddleware, isOrgAdmin, async (req, res) => {
  const { name, domain, saml } = req.body;

  try {
    if (saml) {
      samlConfigSchema.parse(saml); // Validate SAML config
    }

    const passphrase = process.env.PGCRYPTO_KEY;
    if (!passphrase) {
      throw new Error("Encryption key not configured");
    }

    await db.transaction(async (tx) => {
      // Update org details
      if (name || domain) {
        await tx
          .update(organizations)
          .set({
            name: name || undefined,
            domain: domain || undefined,
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, req.params.orgId));
      }

      // Update or create SAML config
      if (saml) {
        const existing = await tx.query.samlConfigs.findFirst({
          where: eq(samlConfigs.organizationId, req.params.orgId),
        });

        // Encrypt SAML data using pgcrypto
        const encryptedConfig = {
          entryPoint: sql`pgp_sym_encrypt(${saml.entryPoint}::text, ${passphrase})`,
          issuer: sql`pgp_sym_encrypt(${saml.issuer}::text, ${passphrase})`,
          cert: sql`pgp_sym_encrypt(${saml.cert}::text, ${passphrase})`,
          callbackUrl: saml.callbackUrl,
          updatedAt: new Date(),
        };

        // Insert or update SAML config
        if (existing) {
          await tx
            .update(samlConfigs)
            .set(encryptedConfig)
            .where(eq(samlConfigs.id, existing.id));
        } else {
          await tx.insert(samlConfigs).values({
            organizationId: req.params.orgId,
            ...encryptedConfig,
          });
        }
      }
    });

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, req.params.orgId),
      with: {
        samlConfig: true,
      },
    });

    // If there's a SAML config, decrypt it before sending
    if (org?.samlConfig) {
      const decryptedConfig = await db
        .execute(
          sql`
        SELECT 
          pgp_sym_decrypt(${org.samlConfig.entryPoint}, ${passphrase})::text as entry_point,
          pgp_sym_decrypt(${org.samlConfig.issuer}, ${passphrase})::text as issuer,
          pgp_sym_decrypt(${org.samlConfig.cert}, ${passphrase})::text as cert,
          ${org.samlConfig.callbackUrl} as callback_url
      `
        )
        .then((result) => result.rows[0] as unknown as DecryptedSamlConfig);

      // Replace the encrypted values with decrypted ones in the response
      org.samlConfig = {
        ...org.samlConfig,
        entryPoint: decryptedConfig.entry_point as unknown as any,
        issuer: decryptedConfig.issuer as unknown as any,
        cert: decryptedConfig.cert as unknown as any,
      };
    }

    res.json(org);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Failed to update organization" });
  }
});

// Manage members
router.post("/:orgId/members", authMiddleware, isOrgAdmin, async (req, res) => {
  const { email, role } = req.body;

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await db.insert(organizationMembers).values({
      organizationId: req.params.orgId,
      userId: user.id,
      role,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: "Failed to add member" });
  }
});

export default router;
