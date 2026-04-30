const internalAuthEmailDomain = "users.grscrm.local";

export function normalizeUsername(value: string | null | undefined) {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/[._-]{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "");

  return normalized;
}

export function isUsernameLike(value: string | null | undefined) {
  return /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(normalizeUsername(value));
}

export function buildInternalAuthEmail(username: string) {
  return `${normalizeUsername(username)}@${internalAuthEmailDomain}`;
}

export function resolveUserDisplayName(
  user:
    | {
        full_name?: string | null;
        username?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
  fallback = "-",
) {
  if (user?.full_name) {
    return user.full_name;
  }

  if (user?.username) {
    return user.username;
  }

  if (user?.email) {
    const internalMatch = user.email.match(/^([^@]+)@users\.grscrm\.local$/i);
    return internalMatch?.[1] || user.email;
  }

  return fallback;
}
