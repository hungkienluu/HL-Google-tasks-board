import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export async function getTasksClient() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    throw new Error("Missing access token. Sign in again.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken
  });

  return google.tasks({ version: "v1", auth: oauth2Client });
}
