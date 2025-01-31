import Express from "express";
import cors from "cors";
import path from "path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import cookieParser from "cookie-parser";
import { CONFIG } from "./config/constants";
import { authMiddleware } from "./middleware/auth";

// Clients
import db from "./config/db";
import s3 from "./config/s3";
import myPassport from "./config/passport";

// Routes
import authRoutes from "./routes/auth";
import threadRoutes from "./routes/threads";
import modelRoutes from "./routes/model";
import paymentRoutes from "./routes/payments";
import organizationRoutes from "./routes/organizations";

// Error Handling
export function handleError(res: Express.Response, error: Error) {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
}

async function main() {
  try {
    await migrate(db, {
      migrationsFolder: path.join(__dirname, "../drizzle"),
    });
  } catch (error) {
    console.error("Error occurred during database migration", error);
    process.exit(1);
  }

  const app = Express();

  if (CONFIG.__prod__) {
    // you need this if you have nginx or another proxy in front
    // dokku uses nginx
    app.set("trust proxy", 1);
  }

  app.use("/payments/webhook", Express.raw({ type: "application/json" }));
  app.use("/auth/saml/:slug/callback", Express.urlencoded({ extended: false }));
  app.use(Express.json({ limit: "50mb" }));

  app.use(
    cors({
      credentials: true,
      origin: CONFIG.CORS_ORIGINS,
    })
  );
  app.use(cookieParser());
  app.use(myPassport.initialize());

  app.use("/auth", authRoutes);
  app.use("/threads", threadRoutes);
  app.use("/models", modelRoutes);
  app.use("/payments", paymentRoutes);
  app.use("/organizations", organizationRoutes);

  app.post("/presigned-url", authMiddleware, async (req, res) => {
    try {
      const { filename, mime_type, size } = req.body;
      const file_key = `uploads/${Date.now()}-${filename}`;
      const url = s3.presign(file_key, {
        expiresIn: 3600, // 1 hour
        type: mime_type,
        method: "PUT",
      });
      const viewUrl = s3.file(file_key).presign({
        expiresIn: 3600,
        method: "GET",
      });

      res.json({
        url,
        viewUrl,
        file_metadata: {
          filename,
          mime_type,
          file_key,
          size,
        },
      });
    } catch (error: any) {
      handleError(res, error);
    }
  });

  app.listen(CONFIG.PORT, () => {
    console.log(`Server is running on http://localhost:${CONFIG.PORT}`);
  });
}

main();
