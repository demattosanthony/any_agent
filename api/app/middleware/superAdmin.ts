import { NextFunction, Request, Response } from "express";
import { DbUser } from "../createAuthToken";

interface CustomRequest extends Request {
  dbUser?: DbUser;
}

export const superAdminMiddleware = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.dbUser?.systemRole !== "super_admin") {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }
  next();
};
