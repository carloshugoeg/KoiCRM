import NextAuth from "next-auth"
import type { Provider } from "next-auth/providers"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { z } from "zod"
import { prisma } from "@/lib/db/client"
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
      if (!user.emailVerified) return null
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

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  providers,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
})
