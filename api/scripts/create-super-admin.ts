// Used to create a super admin user
import { eq } from "drizzle-orm";
import db from "../app/config/db";
import { users } from "../app/config/schema";

const email = process.argv[2];
if (!email) {
  console.error("Please provide an email address");
  process.exit(1);
}

await db
  .update(users)
  .set({ systemRole: "super_admin" })
  .where(eq(users.email, email));
