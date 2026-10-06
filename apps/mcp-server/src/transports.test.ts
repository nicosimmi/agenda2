// Los puntos de entrada reales, arrancados como procesos aparte contra una API que escucha en un
// puerto de verdad: stdio (Claude Desktop, el inspector de MCP) y HTTP (servicio del agente).
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  categories,
  businesses,
  services,
  staff,
  staffServices,
  workingHours,
} from "../../api/src/db/schema.ts";
import {
  createTestApp,
  userWithSession,
  WEB_ORIGIN,
  type TestContext,
} from "../../api/src/test-app.ts";

const entry = (file: string) => fileURLToPath(new URL(file, import.meta.url));
const PUBLIC = 6;

let t: TestContext;
let apiUrl: string;
let customer: Record<string, string>;
const children: ChildProcess[] = [];

beforeAll(async () => {
  t = await createTestApp();
  await t.reset();
  const [category] = await t.db
    .insert(categories)
    .values({ slug: "barberia", name: "Barbería" })
    .returning();
  const [business] = await t.db
    .insert(businesses)
    .values({
      slug: "barberia-test",
      name: "Barbería Test",
      categoryId: category!.id,
      city: "Córdoba",
      status: "published",
    })
    .returning();
  const [service] = await t.db
    .insert(services)
    .values({ businessId: business!.id, name: "Corte", durationMin: 30, priceCents: 1500 })
    .returning();
  const [member] = await t.db
    .insert(staff)
    .values({ businessId: business!.id, name: "Ana" })
    .returning();
  await t.db
    .insert(staffServices)
    .values({ businessId: business!.id, staffId: member!.id, serviceId: service!.id });
  await t.db.insert(workingHours).values({
    businessId: business!.id,
    staffId: member!.id,
    weekday: 1,
    startTime: "09:00",
    endTime: "13:00",
  });
  customer = (await userWithSession(t.db, "customer", "c1@cliente.test")).cookies;
  await t.app.listen({ port: 0, host: "127.0.0.1" });
  const address = t.app.server.address();
  apiUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}, 60_000);

afterAll(async () => {
  for (const child of children) child.kill();
  await t.close();
});

async function mintToken(scopes: string[]) {
  const res = await t.app.inject({
    method: "POST",
    url: "/me/tokens",
    cookies: customer,
    headers: { origin: WEB_ORIGIN },
    payload: { label: "proceso", scopes },
  });
  return res.json().token as string;
}

const names = async (client: Client) => (await client.listTools()).tools.map((x) => x.name).sort();

describe("stdio", () => {
  async function stdioClient(env: Record<string, string>) {
    const client = new Client({ name: "cliente-stdio", version: "1.0.0" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [entry("./stdio.ts")],
        env: { AGENDIA_API_URL: apiUrl, ...env },
        stderr: "ignore",
      }),
    );
    return client;
  }

  it("sin token ofrece solo las herramientas públicas y busca de verdad", async () => {
    const client = await stdioClient({});
    expect(await names(client)).toHaveLength(PUBLIC);
    const res = (await client.callTool({
      name: "search_businesses",
      arguments: { query: "barberia" },
    })) as {
      content: { text: string }[];
    };
    expect(JSON.parse(res.content[0]!.text).businesses[0].slug).toBe("barberia-test");
    await client.close();
  }, 30_000);

  it("con un token de leer y proponer añade propose_* y ninguna confirm_*", async () => {
    const client = await stdioClient({
      AGENDIA_TOKEN: await mintToken(["bookings:read", "bookings:propose"]),
    });
    const list = await names(client);
    expect(list).toContain("propose_booking");
    expect(list.filter((n) => n.startsWith("confirm_"))).toEqual([]);
    await client.close();
  }, 30_000);

  it("con un token inválido el proceso no arranca", async () => {
    await expect(stdioClient({ AGENDIA_TOKEN: "agt_inventado" })).rejects.toThrow();
  }, 30_000);
});

describe("HTTP", () => {
  let url: string;

  beforeAll(async () => {
    const port = await new Promise<number>((resolve) => {
      const probe = createServer().listen(0, "127.0.0.1", () => {
        const { port } = probe.address() as { port: number };
        probe.close(() => resolve(port));
      });
    });
    const child = spawn(process.execPath, [entry("./http.ts")], {
      env: {
        ...process.env,
        AGENDIA_API_URL: apiUrl,
        MCP_PORT: String(port),
        MCP_HOST: "127.0.0.1",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    children.push(child);
    await new Promise<void>((resolve, reject) => {
      child.stderr!.on(
        "data",
        (chunk: Buffer) => chunk.toString().includes("AgendIA MCP") && resolve(),
      );
      child.on("exit", () => reject(new Error("El servidor HTTP no arrancó")));
    });
    url = `http://127.0.0.1:${port}/mcp`;
  }, 30_000);

  async function httpClient(token?: string) {
    const client = new Client({ name: "cliente-http", version: "1.0.0" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(url), {
        requestInit: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      }),
    );
    return client;
  }

  it("un cliente MCP por HTTP ve las herramientas que permite su token", async () => {
    expect(await names(await httpClient())).toHaveLength(PUBLIC);
    const proposer = await names(
      await httpClient(await mintToken(["bookings:read", "bookings:propose"])),
    );
    expect(proposer).toContain("propose_booking");
    expect(proposer.filter((n) => n.startsWith("confirm_"))).toEqual([]);
    const full = await names(
      await httpClient(await mintToken(["bookings:read", "bookings:propose", "bookings:confirm"])),
    );
    expect(full).toContain("confirm_booking");
  }, 30_000);

  it("sin estado: cada petición se resuelve con su propio token, sin mezclarse", async () => {
    const [a, b] = await Promise.all([
      httpClient(await mintToken(["bookings:read", "bookings:propose"])),
      httpClient(),
    ]);
    expect((await names(a)).length).toBeGreaterThan((await names(b)).length);
  }, 30_000);

  const rpc = (init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    path?: string;
  }) =>
    fetch(url.replace("/mcp", init.path ?? "/mcp"), {
      method: init.method ?? "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...init.headers,
      },
      ...(init.body !== undefined && { body: init.body }),
    });
  const listBody = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });

  it("rechaza un token inválido (401), un origen de navegador no permitido (403) y GET (405)", async () => {
    expect(
      (await rpc({ headers: { authorization: "Bearer agt_malo" }, body: listBody })).status,
    ).toBe(401);
    expect((await rpc({ headers: { authorization: "Basic abc" }, body: listBody })).status).toBe(
      401,
    );
    expect((await rpc({ headers: { origin: "http://evil.example" }, body: listBody })).status).toBe(
      403,
    );
    const get = await rpc({ method: "GET" });
    expect(get.status).toBe(405);
    expect(get.headers.get("allow")).toBe("POST");
  }, 30_000);

  it("rutas desconocidas son 404 y un cuerpo que no es JSON no tumba el servidor", async () => {
    expect((await rpc({ path: "/otra", body: listBody })).status).toBe(404);
    const bad = await rpc({ body: "{no es json" });
    expect(bad.status).toBe(500);
    expect(((await bad.json()) as { error: { message: string } }).error.message).toMatch(/JSON/);
    // Sigue vivo.
    expect((await rpc({ body: listBody })).status).toBe(200);
  }, 30_000);
});
