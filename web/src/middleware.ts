export { default } from "next-auth/middleware";

// Protege todo menos login, api/auth, api/wa (n8n usa su propia x-api-key) y estáticos.
export const config = {
  matcher: ["/((?!login|api/auth|api/wa|_next/static|_next/image|favicon.ico).*)"]
};
