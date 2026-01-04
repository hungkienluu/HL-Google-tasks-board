import NextAuth, { type AuthOptions, type Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { JWT } from "next-auth/jwt";

const resolveAuthSecret = () => {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "NEXTAUTH_SECRET (or AUTH_SECRET) is not set. Falling back to a default secret; set an environment variable for secure, stable sessions."
      );
    }
    return "taskpulse-fallback-secret";
  }
  return secret;
};

const authSecret = resolveAuthSecret();

const refreshAccessToken = async (token: JWT): Promise<JWT> => {
  try {
    const url = "https://oauth2.googleapis.com/token";
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string
      })
    });

    const refreshedTokens = await response.json();
    if (!response.ok) throw refreshedTokens;

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken
    };
  } catch (error) {
    console.error("Error refreshing access token", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
};

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/tasks",
          access_type: "offline",
          prompt: "consent"
        }
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  secret: authSecret,
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token ?? token.refreshToken,
          expiresAt: account.expires_at ? account.expires_at * 1000 : 0
        };
      }

      if (token.expiresAt && Date.now() < (token.expiresAt as number)) return token;
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      const enrichedSession: Session & {
        accessToken?: string;
        refreshToken?: string;
        error?: string;
        expiresAt?: number;
      } = {
        ...session,
        accessToken: token.accessToken as string,
        refreshToken: token.refreshToken as string,
        error: token.error as string | undefined,
        expiresAt: token.expiresAt as number
      };
      return enrichedSession;
    }
  }
};

export const authHandler = NextAuth(authOptions);
