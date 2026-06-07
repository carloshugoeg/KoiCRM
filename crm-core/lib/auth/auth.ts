import NextAuth from "next-auth"
import type { Provider } from "next-auth/providers"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { z } from "zod"
import { prisma } from "@/lib/db/client"
import {
  getAuthDayKey,
  isAuthDayValid,
  secondsUntilNextAuthDay,
} from "@/lib/auth/daily-session"
import { verifyPassword } from "@/lib/auth/password"

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const providers: Provider[] = [
  Credentials({
    async authorize(raw) {
      const parsed = credentialsSchema.safeParse(raw)
      if (!parsed.success) return null
      const { email, password } = parsed.data
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user?.password) return null
      const valid = await verifyPassword(password, user.password)
      if (!valid) return null
      return { id: user.id, email: user.email, name: user.name, image: user.image }
    },
  }),
]

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  )
}

/** Persist Google sign-in without PrismaAdapter (incompatible with JWT sessions). */
async function linkGoogleAccount(
  user: { id?: string; email?: string | null; name?: string | null; image?: string | null },
  account: {
    provider: string
    providerAccountId: string
    type: string
    access_token?: string | null
    expires_at?: number | null
    token_type?: string | null
    scope?: string | null
    id_token?: string | null
  },
) {
  const email = user.email
  if (!email) return

  let dbUser = await prisma.user.findUnique({ where: { email } })
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        email,
        name: user.name ?? undefined,
        image: user.image ?? undefined,
        emailVerified: new Date(),
      },
    })
  } else {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        emailVerified: dbUser.emailVerified ?? new Date(),
        name: user.name ?? dbUser.name,
        image: user.image ?? dbUser.image,
      },
    })
  }

  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      },
    },
    create: {
      userId: dbUser.id,
      type: account.type,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      access_token: account.access_token,
      expires_at: account.expires_at,
      token_type: account.token_type,
      scope: account.scope,
      id_token: account.id_token,
    },
    update: {
      access_token: account.access_token,
      expires_at: account.expires_at,
      token_type: account.token_type,
      scope: account.scope,
      id_token: account.id_token,
    },
  })

  user.id = dbUser.id
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        await linkGoogleAccount(user, account)
      }
      return true
    },
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id
        token.authDay = getAuthDayKey()
        token.exp = Math.floor(Date.now() / 1000) + secondsUntilNextAuthDay()
      }

      if (!token.authDay && token.iat) {
        token.authDay = getAuthDayKey(new Date(token.iat * 1000))
      }

      if (!isAuthDayValid(token.authDay)) {
        token.error = "SessionExpired"
        token.exp = Math.floor(Date.now() / 1000) - 3600
      }

      return token
    },
    async session({ session, token }) {
      if (token.error === "SessionExpired") {
        return { ...session, user: undefined, expires: new Date(0).toISOString() }
      }

      if (token.id) {
        session.user.id = token.id as string
      } else if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true },
        })
        if (dbUser) session.user.id = dbUser.id
      }
      return session
    },
  },
})
