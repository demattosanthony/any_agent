import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import utilityApiClient from "../config/utilityApi";
import db from "../config/db";
import { users } from "../config/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/create-form", authMiddleware, async (req, res) => {
  try {
    const user = req.dbUser;
    const email = user?.email;

    if (!email) {
      res.status(400).json({ error: "User email not found" });
      return;
    }

    const form = await utilityApiClient.createForm(email);

    // Store the auth id with the user
    // await db
    //   .update(users)
    //   .set({ utilityApiUid: form.uid })
    //   .where(eq(users.id, user!.id));

    res.json(form);
  } catch (error) {
    console.error("Failed to create form", error);
    res.status(500).json({ error: "Failed to create form" });
    return;
  }
});

router.post(
  "/forms/:uid/test-submit-form",
  authMiddleware,
  async (req, res) => {
    try {
      const uid = req.params.uid;
      const { utility, scenario } = req.body;

      const result = await utilityApiClient.testSubmitForm(
        uid,
        utility,
        scenario
      );

      res.json(result);
    } catch (error) {
      console.error("Failed to test submit form", error);
      res.status(500).json({ error: "Failed to test submit form" });
      return;
    }
  }
);

router.get("/authorizations", authMiddleware, async (req, res) => {
  try {
    const {
      uids,
      forms,
      templates,
      users,
      referrals,
      is_archived,
      is_declined,
      is_test,
      is_revoked,
      is_expired,
      utility,
      after,
      include,
      expand_meter_blocks,
      limit,
    } = req.query;

    // Convert query params to expected types
    const params: any = {};
    if (uids) params.uids = Array.isArray(uids) ? uids : [uids as string];
    if (forms) params.forms = Array.isArray(forms) ? forms : [forms as string];
    if (templates)
      params.templates = Array.isArray(templates)
        ? templates
        : [templates as string];
    if (users) params.users = Array.isArray(users) ? users : [users as string];
    if (referrals)
      params.referrals = Array.isArray(referrals)
        ? referrals
        : [referrals as string];
    if (is_archived) params.is_archived = is_archived === "true";
    if (is_declined) params.is_declined = is_declined === "true";
    if (is_test) params.is_test = is_test === "true";
    if (is_revoked) params.is_revoked = is_revoked === "true";
    if (is_expired) params.is_expired = is_expired === "true";
    if (utility)
      params.utility = Array.isArray(utility) ? utility : [utility as string];
    if (after) params.after = after as string;
    if (include)
      params.include = Array.isArray(include) ? include : [include as string];
    if (expand_meter_blocks)
      params.expand_meter_blocks = expand_meter_blocks === "true";
    if (limit) params.limit = parseInt(limit as string);

    const result = await utilityApiClient.getAuthorizations(params);

    res.json(result);
  } catch (error) {
    console.error("Failed to fetch authorizations", error);
    res.status(500).json({ error: "Failed to fetch authorizations" });
    return;
  }
});

router.post("/meters", authMiddleware, async (req, res) => {
  try {
    const { meters, collection_duration } = req.body;

    if (!Array.isArray(meters)) {
      res.status(400).json({ error: "Meters must be an array" });
      return;
    }

    const result = await utilityApiClient.metersHistoricalCollection(
      meters,
      collection_duration
    );

    res.json(result);
  } catch (error) {
    console.error("Failed to fetch historical collection", error);
    res.status(500).json({ error: "Failed to fetch historical collection" });
    return;
  }
});

router.get("/meters/:meterId", authMiddleware, async (req, res) => {
  try {
    const meterId = req.params.meterId;
    const result = await utilityApiClient.getMeter(meterId);

    res.json(result);
  } catch (error) {
    console.error("Failed to fetch meters", error);
    res.status(500).json({ error: "Failed to fetch meters" });
    return;
  }
});

export default router;
