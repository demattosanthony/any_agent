import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { superAdminMiddleware } from "../middleware/superAdmin";
import z from "zod";
import db from "../config/db";
import { organizationMembers, organizations } from "../config/schema";

const router = Router();

router.use("/admin/*", authMiddleware, superAdminMiddleware);

const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1).max(255),
  domain: z.string().optional(), // Example email validation for domain
});

// Create organization
router.post("/organizations", authMiddleware, async (req, res) => {
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

export default router;
