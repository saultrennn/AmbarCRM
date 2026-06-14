import "next-auth";

declare module "next-auth" {
  interface User {
    rol?: "admin" | "agente";
  }
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      rol?: "admin" | "agente";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    rol?: "admin" | "agente";
  }
}
