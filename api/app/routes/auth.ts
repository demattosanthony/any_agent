import { Router } from "express";
import { checkTokens, DbUser, sendAuthCookies } from "../createAuthToken";
import db from "../config/db";
import { eq } from "drizzle-orm";
import myPassport, { authenticateSaml } from "../config/passport";
import { organizations, users } from "../config/schema";
import { Strategy as SamlStrategy } from "passport-saml";

const router = Router();

router.get("/google", myPassport.authenticate("google", { session: false }));

router.get(
  "/google/callback",
  myPassport.authenticate("google", {
    session: false,
    failureRedirect: process.env.FRONTEND_URL + "?error=unauthorized", // Add error parameter
  }),
  (req, res) => {
    sendAuthCookies(res, req.user as DbUser);
    if ((req.user as DbUser).subscriptionStatus === "active") {
      res.redirect(process.env.FRONTEND_URL!);
    } else {
      res.redirect(process.env.FRONTEND_URL!);
    }
  }
);

// SAML Auth Routes
router.get("/saml/:slug", authenticateSaml);

router.post("/saml/:slug/callback", authenticateSaml, (req, res) => {
  sendAuthCookies(res, req.user as DbUser);
  res.redirect(process.env.FRONTEND_URL!);
});

// Metadata endpoint - IdP needs this to configure the integration
// router.get("/saml/:slug/metadata", async (req, res) => {
//   const { slug } = req.params;
//   const org = await db.query.organizations.findFirst({
//     where: eq(organizations.slug, slug),
//     with: {
//       samlConfig: true,
//     },
//   });

//   if (!org || !org.samlConfig) {
//     res.status(404).send("Organization not found");
//     return;
//   }

//   const strategy = new SamlStrategy(
//     {
//       entryPoint: org.samlConfig.entryPoint,
//       issuer: org.samlConfig.issuer,
//       cert: org.samlConfig.cert,
//       callbackUrl: org.samlConfig.callbackUrl,
//     },
//     (profile: any, done: any) => {
//       done(null, profile);
//     }
//   );
//   res.type("application/xml");
//   res.send(strategy.generateServiceProviderMetadata(null));
// });

router.post("/logout", (req, res) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    domain: process.env.NODE_ENV === "production" ? ".syyclops.com" : "",
    path: "/", // Make sure this matches the path used when setting the cookies
  };

  res.clearCookie("id", cookieOptions);
  res.clearCookie("rid", cookieOptions);
  res.status(200).send("Logged out");
});

router.get("/me", async (req, res) => {
  const { id, rid } = req.cookies;
  let user: DbUser | null | undefined = null;

  try {
    const { userId } = await checkTokens(id, rid);
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        organizationMembers: {
          with: {
            organization: true,
          },
        },
      },
    });
    res.json(user);
  } catch (e) {
    res.json(user);
  }
});

export default router;
