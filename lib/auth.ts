import NextAuth, { type AuthOptions, type Session } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { JWT } from "next-auth/jwt";

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
      expiresAt: Date.now() + refreshedTokens.expires_in * 1000
    };
  } catch (error) {
    console.error("Failed to refresh access token", error);
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
          scope: "openid email profile https://www.googleapis.com/auth/tasks"
        }
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = (account.expires_at ?? 0) * 1000;
      }

      if (token.expiresAt && Date.now() < (token.expiresAt as number) - 60_000) {
        return token;
      }

      if (token.refreshToken) {
        return refreshAccessToken(token);
      }

      return token;
    },
    async session({ session, token }) {
      const enrichedSession: Session & {
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: number;
      } = {
        ...session,
        accessToken: token.accessToken as string,
        refreshToken: token.refreshToken as string,
        expiresAt: token.expiresAt as number
      };
      return enrichedSession;
    }
  }
};

export const authHandler = NextAuth(authOptions);
