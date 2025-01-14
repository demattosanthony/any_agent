import * as jwt from "jsonwebtoken";
import { Response } from "express";
import { eq, sql } from "drizzle-orm";
import db from "./config/db";
import { users } from "./config/schema";

export type RefreshTokenData = {
  userId: string;
  refreshTokenVersion?: number;
};

export type AccessTokenData = {
  userId: string;
};

export type DbUser = typeof users.$inferSelect;

const createAuthTokens = (
  user: DbUser
): { refreshToken: string; accessToken: string } => {
  const refreshToken = jwt.sign(
    { userId: user.id, refreshTokenVersion: user.refreshTokenVersion },
    process.env.REFRESH_TOKEN_SECRET!,
    {
      expiresIn: "30d",
    }
  );

  const accessToken = jwt.sign(
    { userId: user.id },
    process.env.ACCESS_TOKEN_SECRET!,
    {
      expiresIn: "15min",
    }
  );

  return { refreshToken, accessToken };
};

// __prod__ is a boolean that is true when the NODE_ENV is "production"
const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  domain: process.env.NODE_ENV === "production" ? ".syyclops.com" : "",
  maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 year
} as const;

export const sendAuthCookies = (res: Response, user: DbUser) => {
  const { accessToken, refreshToken } = createAuthTokens(user);
  res.cookie("id", accessToken, cookieOpts);
  res.cookie("rid", refreshToken, cookieOpts);
};

export const clearAuthCookies = (res: Response) => {
  res.clearCookie("id", cookieOpts);
  res.clearCookie("rid", cookieOpts);
};

export const checkTokens = async (
  accessToken: string,
  refreshToken: string
) => {
  try {
    // verify
    const data = <AccessTokenData>(
      jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET!)
    );

    // get userId from token data
    return {
      userId: data.userId,
    };
  } catch {
    // token is expired or signed with a different secret
    // so now check refresh token
  }

  if (!refreshToken) {
    throw new Error("No refresh token provided");
  }

  // 1. verify refresh token
  let data;
  try {
    data = <RefreshTokenData>(
      jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!)
    );
  } catch {
    throw new Error("Invalid refresh token");
  }

  // 2. get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, data.userId),
  });

  // 3.check refresh token version
  if (!user || user.refreshTokenVersion !== data.refreshTokenVersion) {
    throw new Error("Invalid refresh token");
  }

  return {
    userId: data.userId,
    user,
  };
};
