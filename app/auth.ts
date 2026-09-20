import NextAuth, { type NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const credentialsSchema = z.object({
  identifier: z.string(),
  password: z.string(),
});

export const authOptions: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  // NOTE: cookies must only be marked `secure` when actually served over
  // HTTPS. Hardcoding `secure: true` silently breaks sessions on plain
  // http://localhost (the browser refuses to send secure cookies over
  // HTTP), which is why the eBay OAuth callback previously couldn't find
  // the user's session and fell back to an insecure workaround.
  useSecureCookies: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
      }
    },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
      }
    }
  },
  providers: [
    {
      id: "credentials",
      name: "Credentials",
      type: "credentials",
      credentials: {
        identifier: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) {
          console.log("Auth attempt - received credentials: no");
          return null;
        }

        console.log("Auth attempt - received credentials: yes");
        const parsedCredentials = credentialsSchema.safeParse(credentials);

        if (!parsedCredentials.success) {
          console.log("Invalid credentials format");
          return null;
        }

        const { identifier, password } = parsedCredentials.data;
        console.log("Looking up user with identifier:", identifier);

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: identifier.toLowerCase() },
              { username: identifier.toLowerCase() },
            ],
          },
        });

        if (!user || !user.password) {
          console.log("No user found");
          return null;
        }

        const passwordsMatch = await bcrypt.compare(password, user.password);
        if (!passwordsMatch) {
          console.log("Passwords do not match");
          return null;
        }

        return {
          id: user.id,
          username: user.username,
          email: user.email,
        };
      },
    },
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: token.id as string,
          username: token.username as string,
        };
      }
      return session;
    },
  },
  debug: process.env.NODE_ENV !== "production",
};

export const { handlers: authHandlers, auth, signIn, signOut } = NextAuth(authOptions);

// Export auth middleware
export { auth as middleware }; 