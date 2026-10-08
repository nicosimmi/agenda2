// Datos de demostración (SPEC §14): negocios, profesionales y cuentas FICTICIOS.
// Vacía las tablas antes de insertar, así que se puede repetir sin fallar. Solo para dev/demo.
import { hash } from "@node-rs/argon2";
import { createDb, type Db } from "./client.ts";
import * as s from "./schema.ts";
import {
  DEMO_BUSINESSES as BUSINESSES,
  DEMO_CATEGORIES as CATEGORIES,
  DEMO_CUSTOMER_EMAIL,
  DEMO_PASSWORD,
} from "@agendia/shared";

export { DEMO_CUSTOMER_EMAIL, DEMO_PASSWORD };

export async function seed(db: Db): Promise<void> {
  const passwordHash = await hash(DEMO_PASSWORD);

  await db.transaction(async (tx) => {
    // Vaciar en un solo paso; CASCADE resuelve el orden de las claves foráneas.
    await tx.execute(`TRUNCATE users, categories, businesses CASCADE`);

    const categories = await tx
      .insert(s.categories)
      .values(CATEGORIES.map(([slug, name]) => ({ slug, name })))
      .returning();
    const categoryId = new Map(categories.map((c) => [c.slug, c.id]));

    await tx.insert(s.users).values({
      email: DEMO_CUSTOMER_EMAIL,
      passwordHash,
      role: "customer",
      name: "Clara Cliente (demo)",
    });
    await tx.insert(s.users).values({
      email: "admin@demo.agendia.test",
      passwordHash,
      role: "platform_admin",
      name: "Admin (demo)",
    });

    for (const b of BUSINESSES) {
      const [business] = await tx
        .insert(s.businesses)
        .values({
          slug: b.slug,
          name: b.name,
          description: b.description,
          categoryId: categoryId.get(b.category)!,
          status: b.status ?? "published",
          addressLine: b.address,
          city: b.city,
          province: b.province,
          postalCode: b.postalCode,
          timezone: b.timezone ?? "Europe/Madrid",
          contactEmail: `${b.slug}@demo.agendia.test`,
          contactPhone: "600000000",
        })
        .returning();
      const businessId = business!.id;

      const [owner] = await tx
        .insert(s.users)
        .values({
          email: `${b.slug}@demo.agendia.test`,
          passwordHash,
          role: "business_owner",
          name: `Propietario de ${b.name} (demo)`,
        })
        .returning();
      await tx.insert(s.businessMembers).values({ userId: owner!.id, businessId, role: "owner" });

      const services = await tx
        .insert(s.services)
        .values(
          b.services.map(([name, durationMin, bufferMin, priceCents]) => ({
            businessId,
            name,
            durationMin,
            bufferMin,
            priceCents,
          })),
        )
        .returning();

      for (const member of b.staff) {
        const [row] = await tx
          .insert(s.staff)
          .values({ businessId, name: member.name })
          .returning();
        const staffId = row!.id;
        // Todos los profesionales hacen todos los servicios del negocio.
        await tx
          .insert(s.staffServices)
          .values(services.map((service) => ({ businessId, staffId, serviceId: service.id })));
        await tx
          .insert(s.workingHours)
          .values(
            member.shifts.flatMap(([weekdays, startTime, endTime]) =>
              weekdays.map((weekday) => ({ businessId, staffId, weekday, startTime, endTime })),
            ),
          );
      }

      if (b.faq) {
        await tx
          .insert(s.faqEntries)
          .values(b.faq.map(([question, answer]) => ({ businessId, question, answer })));
      }
    }
  });
}

if (import.meta.main) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("El seed borra todos los datos: no se ejecuta con NODE_ENV=production");
  }
  const { db, pool } = createDb();
  try {
    await seed(db);
    console.log(`Seed cargado: ${BUSINESSES.length} negocios. Contraseña demo: ${DEMO_PASSWORD}`);
  } finally {
    await pool.end();
  }
}
