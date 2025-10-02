// config/cookies.js
export const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 gün
  path: "/", // ÖNEMLİ: her yerde aynı path
};
