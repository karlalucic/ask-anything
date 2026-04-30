interface AdminUser {
  id: string;
  email?: string | null;
}

function splitEnvList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdminUser(user: AdminUser | null | undefined): boolean {
  if (!user) return false;

  const allowedIds = splitEnvList(process.env.ADMIN_USER_IDS);
  if (allowedIds.includes(user.id)) return true;

  const allowedEmails = splitEnvList(process.env.ADMIN_EMAILS);
  return Boolean(user.email && allowedEmails.includes(user.email));
}
