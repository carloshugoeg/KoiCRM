"use client"

import { useMemo, useState } from "react"
import { avatarColor, avatarInitials } from "@/lib/utils/avatar-color"
import { resolveUserImageSrc } from "@/lib/storage/media-url"
import { cn } from "@/lib/utils"

type Props = {
  userId: string
  name?: string | null
  email?: string | null
  imageUrl?: string | null
  size?: number
  className?: string
}

export function UserAvatar({ userId, name, email, imageUrl, size = 32, className }: Props) {
  const [failed, setFailed] = useState(false)
  const color = avatarColor(userId)
  const initials = avatarInitials(name ?? email)
  const src = useMemo(() => resolveUserImageSrc(imageUrl), [imageUrl])
  const dim = { width: size, height: size, minWidth: size, minHeight: size }

  if (!src || failed) {
    return (
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-bold shrink-0 overflow-hidden border",
          className,
        )}
        style={{
          ...dim,
          background: `${color}22`,
          color,
          borderColor: `${color}60`,
          fontSize: Math.max(10, Math.round(size * 0.36)),
        }}
        aria-hidden={!name && !email}
        title={name ?? email ?? undefined}
      >
        {initials}
      </div>
    )
  }

  return (
    <div
      className={cn("rounded-full shrink-0 overflow-hidden border", className)}
      style={{ ...dim, borderColor: `${color}60` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name ?? email ?? ""}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  )
}
