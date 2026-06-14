// Crea/actualiza el usuario admin con un hash bcrypt real.
// Uso: node scripts/seed-admin.mjs "Nombre" admin@correo.mx "contraseña"
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const [, , nombre = "Admin", email = "admin@ambarcrm.mx", pass = "demo1234"] = process.argv;
const db = new PrismaClient();

const passwordHash = await bcrypt.hash(pass, 10);
const u = await db.usuario.upsert({
  where: { email },
  update: { nombre, passwordHash, rol: "admin", activo: true },
  create: { nombre, email, passwordHash, rol: "admin" }
});

console.log(`Admin listo: ${u.email} (id ${u.id}). Contraseña: ${pass}`);
await db.$disconnect();
