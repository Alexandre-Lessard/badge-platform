#!/usr/bin/env node
/**
 * Seed a local or staging D1 with data you can actually look at.
 *
 *   node ops/seed.mjs --target local
 *   node ops/seed.mjs --target staging
 *
 * Wipes every user-owned table in the target, then rebuilds it. Products are
 * reseeded too so the shop works. Never touches production: the target is a
 * fixed allowlist and `production` is not on it.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * The local D1 used to hold a copy of the production users table — real
 * customer names and addresses, sitting on a laptop with no access control and
 * no retention. Seeded data replaces it. See the "Données clients" policy in
 * the global CLAUDE.md.
 *
 * ── The five real accounts ────────────────────────────────────────────────
 * Alex's own accounts are recreated so the people who use this app have their
 * usual login present — **account only, never their content**. They sign in
 * with the same seed password as everyone else.
 *
 * This script never reads production. Copying the real password hash was tried
 * and removed: the hash mixes in a per-environment PASSWORD_PEPPER, so a
 * production hash cannot authenticate anywhere else. It bought nothing and
 * cost a production read.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { randomUUID, pbkdf2Sync } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEED_PASSWORD = "Seed1234!";

const TARGETS = {
  local: { db: "badge-db-staging", env: "staging", flag: "--local" },
  staging: { db: "badge-db-staging", env: "staging", flag: "--remote" },
};

/** Alex's own accounts. Recreated account-only, hashes pulled from production. */
const REAL_ACCOUNTS = [
  { email: "alexandre.lessard92@gmail.com", firstName: "Alexandre", lastName: "Lessard", isAdmin: true },
  { email: "7157319@gmail.com", firstName: "Martin", lastName: "Gagne", isAdmin: true },
  { email: "6979751@gmail.com", firstName: "Jason", lastName: "Merriman", isAdmin: false },
  { email: "admin@al-si.com", firstName: "admin", lastName: "alsi", isAdmin: true },
  { email: "test@al-si.com", firstName: "Test", lastName: "alsi", isAdmin: false },
];

// ── args ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const target = args[args.indexOf("--target") + 1];

if (!TARGETS[target]) {
  console.error(`Usage: node ops/seed.mjs --target <${Object.keys(TARGETS).join("|")}>`);
  process.exit(1);
}

// ── helpers ────────────────────────────────────────────────────────────────

const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined ? "NULL" : String(v));
const bool = (v) => (v ? 1 : 0);
const daysAgo = (d) => Date.now() - d * 86_400_000;

/** Category-matching CC photos. `lock` makes a given item's photo stable. */
let photoLock = 1;
const photo = (keyword) => `https://loremflickr.com/640/480/${keyword}?lock=${photoLock++}`;

/**
 * The Worker hashes `password + pepper` with PBKDF2-SHA256, 100k iterations,
 * and stores `pbkdf2$<iterations>$<salt-b64>$<hash-b64>`
 * (apps/worker/src/utils/password.ts). The pepper differs per environment, so
 * the hash has to be built here rather than hardcoded — a hash made with the
 * dev pepper would silently fail to authenticate on staging.
 */
function hashPassword(password, pepper) {
  const salt = Buffer.from("badge-seed-salt-");
  const hash = pbkdf2Sync(`${password}${pepper}`, salt, 100_000, 32, "sha256");
  return `pbkdf2$100000$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** Local reads .dev.vars; staging has its pepper in a wrangler secret. */
function resolvePepper() {
  if (process.env.PASSWORD_PEPPER) return process.env.PASSWORD_PEPPER;

  if (target === "local") {
    const p = join(ROOT, "apps/worker/.dev.vars");
    const m = existsSync(p) && readFileSync(p, "utf8").match(/^PASSWORD_PEPPER=(.*)$/m);
    if (m) return m[1].trim();
    throw new Error("PASSWORD_PEPPER not found in apps/worker/.dev.vars — copy .dev.vars.example first.");
  }

  throw new Error(
    "PASSWORD_PEPPER must be set to seed staging, so the invented accounts can actually sign in:\n" +
      "  PASSWORD_PEPPER=<staging pepper> node ops/seed.mjs --target staging",
  );
}

function runSql(sql) {
  const { db, env, flag } = TARGETS[target];
  const dir = mkdtempSync(join(tmpdir(), "badge-seed-"));
  const file = join(dir, "seed.sql");
  writeFileSync(file, sql);
  execFileSync(
    "pnpm",
    ["--filter", "@badge/worker", "exec", "wrangler", "d1", "execute", db, "--env", env, flag, "--file", file],
    { cwd: ROOT, stdio: "inherit" },
  );
}

// ── the data ───────────────────────────────────────────────────────────────

function buildSql() {
  const S = [];
  const id = () => randomUUID();

  // Order matters: children before parents.
  S.push(`DELETE FROM sticker_codes;`);
  S.push(`DELETE FROM order_items;`);
  S.push(`DELETE FROM orders;`);
  S.push(`DELETE FROM theft_reports;`);
  S.push(`DELETE FROM insurance_requests;`);
  S.push(`DELETE FROM item_documents;`);
  S.push(`DELETE FROM item_photos;`);
  S.push(`DELETE FROM items;`);
  S.push(`DELETE FROM sessions;`);
  S.push(`DELETE FROM users;`);
  S.push(`DELETE FROM contact_messages;`);
  S.push(`DELETE FROM newsletter_subscribers;`);
  S.push(`DELETE FROM products;`);

  // ── Products (the shop needs these) ──────────────────────────────────────
  const products = [
    {
      slug: "sticker-sheet",
      nameFr: "Planche de 10 étiquettes",
      nameEn: "Sheet of 10 stickers",
      descFr: "Dix étiquettes d'identification résistantes aux intempéries.",
      descEn: "Ten weatherproof identification stickers.",
      price: 2999,
      sort: 1,
    },
    {
      slug: "door-sticker",
      nameFr: "Autocollant de porte",
      nameEn: "Door sticker",
      descFr: "Signale que vos biens sont enregistrés au registre Badge.",
      descEn: "Signals that your belongings are registered with Badge.",
      price: 999,
      sort: 2,
    },
  ];
  const productIds = {};
  for (const p of products) {
    productIds[p.slug] = id();
    S.push(
      `INSERT INTO products (id, slug, name_fr, name_en, description_fr, description_en, price_cents, image_urls, is_active, requires_item, sort_order, created_at, updated_at) VALUES (${q(productIds[p.slug])}, ${q(p.slug)}, ${q(p.nameFr)}, ${q(p.nameEn)}, ${q(p.descFr)}, ${q(p.descEn)}, ${n(p.price)}, ${q(JSON.stringify(["/assets/product-stickers.webp"]))}, 1, 0, ${n(p.sort)}, ${n(daysAgo(120))}, ${n(daysAgo(120))});`,
    );
  }

  // ── Users ────────────────────────────────────────────────────────────────
  // Every invented account signs in with `Seed1234!`.
  const SEED_HASH = hashPassword(SEED_PASSWORD, resolvePepper());
  const users = [];

  for (const [i, a] of REAL_ACCOUNTS.entries()) {
    users.push({
      id: id(),
      ...a,
      passwordHash: SEED_HASH,
      clientNumber: String(800000000 + i),
      emailVerified: true,
      real: true,
    });
  }

  // Invented accounts.

  const fake = [
    { firstName: "Camille", lastName: "Boucher", email: "camille.boucher@example.com", city: "Sherbrooke", verified: true },
    { firstName: "Olivier", lastName: "Nadeau", email: "olivier.nadeau@example.com", city: "Trois-Rivières", verified: true },
    { firstName: "Sophie", lastName: "Lavoie", email: "sophie.lavoie@example.com", city: "Québec", verified: true },
    { firstName: "Nadia", lastName: "Beaulieu", email: "nadia.beaulieu@example.com", city: "Gatineau", verified: false },
    { firstName: "Liam", lastName: "O'Connor", email: "liam.oconnor@example.com", city: "Montréal", verified: true },
    { firstName: "Wei", lastName: "Zhang", email: "wei.zhang@example.com", city: "Laval", verified: true },
  ];
  for (const [i, f] of fake.entries()) {
    users.push({
      id: id(),
      ...f,
      isAdmin: false,
      passwordHash: SEED_HASH,
      clientNumber: String(900000000 + i),
      emailVerified: f.verified,
      real: false,
    });
  }

  for (const u of users) {
    S.push(
      `INSERT INTO users (id, email, contact_email, password_hash, first_name, last_name, phone, city, province, country, email_verified, is_admin, client_number, preferred_language, terms_accepted_at, created_at, updated_at) VALUES (${q(u.id)}, ${q(u.email)}, NULL, ${q(u.passwordHash)}, ${q(u.firstName)}, ${q(u.lastName)}, NULL, ${q(u.city ?? null)}, ${u.city ? q("QC") : "NULL"}, ${u.city ? q("CA") : "NULL"}, ${bool(u.emailVerified)}, ${bool(u.isAdmin)}, ${q(u.clientNumber)}, 'fr', ${n(daysAgo(60))}, ${n(daysAgo(60))}, ${n(daysAgo(60))});`,
    );
  }

  // Real accounts get no content, on purpose. Everything below hangs off the
  // invented ones.
  const byEmail = (e) => users.find((u) => u.email === e).id;

  // ── Items, covering the states the UI has to render ──────────────────────
  const items = [
    {
      owner: "camille.boucher@example.com",
      name: "Vélo de route Cervélo",
      category: "velo-route",
      brand: "Cervélo",
      model: "Caledonia 5",
      year: 2024,
      serial: "CVLO-884201",
      value: 650000,
      status: "stolen",
      badgeCode: "BADGE-4K7P2NRC",
      insured: true,
      insurerId: "intact",
      insurerName: "Intact Assurance",
      keyword: "bicycle",
      photos: 2,
      docs: 1,
      theft: {
        police: "SPVM-2026-114872",
        days: 12,
        location: "Rue Saint-Denis, Montréal",
        description: "Cadenas coupé devant un café, en plein jour.",
      },
    },
    {
      owner: "camille.boucher@example.com",
      name: "Ordinateur portable",
      category: "ordinateur-portable",
      brand: "Apple",
      model: 'MacBook Pro 14"',
      year: 2023,
      serial: "C02XK1YZLVDL",
      value: 289900,
      status: "active",
      badgeCode: "BADGE-9TMD3XQH",
      insured: false,
      keyword: "laptop",
      photos: 1,
      docs: 1,
    },
    {
      owner: "olivier.nadeau@example.com",
      name: "Trottinette électrique",
      category: "trottinette-electrique",
      brand: "Segway",
      model: "Ninebot Max G2",
      year: 2025,
      serial: "SGW-2025-44190",
      value: 129900,
      status: "stolen",
      badgeCode: null,
      insured: false,
      keyword: "scooter",
      photos: 1,
      theft: {
        police: null,
        days: 3,
        location: "Stationnement du cégep, Trois-Rivières",
        description: "Disparue pendant un cours. Aucun témoin.",
      },
    },
    {
      owner: "olivier.nadeau@example.com",
      name: "Montre de plongée",
      category: "montre-luxe",
      brand: "Seiko",
      model: "SKX007",
      year: 2019,
      serial: "SKX-7S26-0020",
      value: 45000,
      // Archiving is `archived_at`, not a status — the list filters on the
      // timestamp and the row stays `active`.
      status: "active",
      archiveReason: "sold",
      badgeCode: null,
      insured: false,
      keyword: "watch",
      photos: 1,
    },
    {
      owner: "sophie.lavoie@example.com",
      name: "Voiturette de golf",
      category: "voiturette-golf",
      brand: "Club Car",
      model: "Onward 4",
      year: 2022,
      serial: "CC-ONW-772103",
      value: 1450000,
      status: "active",
      badgeCode: "BADGE-6RJH8WYF",
      insured: true,
      insurerId: "desjardins",
      insurerName: "Desjardins Assurances",
      keyword: "golf-cart",
      photos: 2,
      docs: 2,
    },
    {
      owner: "sophie.lavoie@example.com",
      name: "Appareil photo",
      category: "appareil-photo",
      brand: "Canon",
      model: "EOS R6",
      year: 2021,
      serial: "CN-R6-330912",
      value: 320000,
      status: "active",
      badgeCode: null,
      insured: true,
      insurerId: "beneva",
      insurerName: "Beneva",
      keyword: "camera",
      photos: 1,
    },
    {
      // No serial, no photo, no code — the sparse case the UI must survive.
      owner: "liam.oconnor@example.com",
      name: "Guitare acoustique",
      category: "instrument-musique",
      brand: "Seagull",
      model: null,
      year: null,
      serial: null,
      value: null,
      status: "active",
      badgeCode: null,
      insured: false,
      keyword: null,
      photos: 0,
    },
    {
      owner: "wei.zhang@example.com",
      name: "Motoneige",
      category: "motoneige",
      brand: "Ski-Doo",
      model: "Summit X 850",
      year: 2023,
      serial: "SD-SUM-661204",
      value: 1899000,
      status: "recovered",
      badgeCode: "BADGE-2QW5ZKBN",
      insured: true,
      insurerId: "promutuel",
      insurerName: "Promutuel Assurance",
      keyword: "snowmobile",
      photos: 2,
      docs: 1,
    },
  ];

  const itemIds = {};
  for (const it of items) {
    const iid = id();
    itemIds[it.name] = iid;
    S.push(
      `INSERT INTO items (id, owner_id, name, description, category, brand, model, year, serial_number, estimated_value, is_insured, insurer_id, insurer_name, status, badge_code, archived_at, archive_reason, created_at, updated_at) VALUES (${q(iid)}, ${q(byEmail(it.owner))}, ${q(it.name)}, NULL, ${q(it.category)}, ${q(it.brand)}, ${q(it.model)}, ${n(it.year)}, ${q(it.serial)}, ${n(it.value)}, ${bool(it.insured)}, ${q(it.insurerId ?? null)}, ${q(it.insurerName ?? null)}, ${q(it.status)}, ${q(it.badgeCode)}, ${it.archiveReason ? n(daysAgo(20)) : "NULL"}, ${q(it.archiveReason ?? null)}, ${n(daysAgo(45))}, ${n(daysAgo(45))});`,
    );

    for (let p = 0; p < (it.photos ?? 0); p++) {
      S.push(
        `INSERT INTO item_photos (id, item_id, url, caption, is_primary, created_at) VALUES (${q(id())}, ${q(iid)}, ${q(photo(it.keyword ?? "object"))}, NULL, ${bool(p === 0)}, ${n(daysAgo(44))});`,
      );
    }
    for (let d = 0; d < (it.docs ?? 0); d++) {
      S.push(
        `INSERT INTO item_documents (id, item_id, url, type, file_name, created_at) VALUES (${q(id())}, ${q(iid)}, ${q("/assets/seed/facture.pdf")}, 'application/pdf', ${q(d === 0 ? "facture-achat.pdf" : "certificat-authenticite.pdf")}, ${n(daysAgo(44))});`,
      );
    }
    if (it.theft) {
      S.push(
        `INSERT INTO theft_reports (id, item_id, reporter_id, police_report_number, theft_date, theft_location, description, status, created_at, updated_at) VALUES (${q(id())}, ${q(iid)}, ${q(byEmail(it.owner))}, ${q(it.theft.police)}, ${n(daysAgo(it.theft.days))}, ${q(it.theft.location)}, ${q(it.theft.description)}, 'pending', ${n(daysAgo(it.theft.days))}, ${n(daysAgo(it.theft.days))});`,
      );
    }
  }

  // ── Orders, one per status the admin UI filters on ───────────────────────
  const orders = [
    { owner: "camille.boucher@example.com", status: "shipped", days: 40, qty: 1, codes: true },
    { owner: "sophie.lavoie@example.com", status: "paid", days: 6, qty: 2, codes: false },
    { owner: "olivier.nadeau@example.com", status: "pending", days: 1, qty: 1, codes: false },
    { owner: "wei.zhang@example.com", status: "shipped", days: 75, qty: 1, codes: true },
  ];

  let codeSeq = 0;
  const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const nextCode = () => {
    codeSeq += 1;
    let v = codeSeq * 7919;
    let s = "";
    for (let i = 0; i < 8; i++) {
      s = CODE_ALPHABET[v % 31] + s;
      v = Math.floor(v / 31) + 13;
    }
    return `BADGE-${s}`;
  };

  for (const o of orders) {
    const oid = id();
    const uid = byEmail(o.owner);
    const unit = 2999;
    S.push(
      `INSERT INTO orders (id, email, user_id, stripe_session_id, total_amount_cents, status, shipping_name, shipping_address, created_at, updated_at) VALUES (${q(oid)}, ${q(o.owner)}, ${q(uid)}, ${q(`cs_seed_${oid.slice(0, 12)}`)}, ${n(unit * o.qty)}, ${q(o.status)}, ${q("Seed Client")}, ${q("123 rue Exemple, Montréal, QC H2X 1Y4")}, ${n(daysAgo(o.days))}, ${n(daysAgo(o.days))});`,
    );
    const oiid = id();
    S.push(
      `INSERT INTO order_items (id, order_id, item_id, product_id, badge_code, product_type, quantity, unit_price_cents) VALUES (${q(oiid)}, ${q(oid)}, NULL, ${q(productIds["sticker-sheet"])}, NULL, 'sticker-sheet', ${n(o.qty)}, ${n(unit)});`,
    );

    if (o.codes) {
      // A shipped sheet is ten registered codes; a couple get claimed.
      for (let c = 0; c < 10; c++) {
        const code = nextCode();
        const claimed = c === 0;
        const assigned =
          claimed && o.owner === "camille.boucher@example.com"
            ? itemIds["Vélo de route Cervélo"]
            : claimed && o.owner === "wei.zhang@example.com"
              ? itemIds["Motoneige"]
              : null;
        S.push(
          `INSERT INTO sticker_codes (code, order_item_id, user_id, assigned_item_id, created_at, claimed_at) VALUES (${q(code)}, ${q(oiid)}, ${q(uid)}, ${q(assigned)}, ${n(daysAgo(o.days))}, ${assigned ? n(daysAgo(o.days - 1)) : "NULL"});`,
        );
      }
    }
  }

  // ── Odds and ends the admin screens list ─────────────────────────────────
  S.push(
    `INSERT INTO newsletter_subscribers (id, email, created_at) VALUES (${q(id())}, 'abonne.seed@example.com', ${n(daysAgo(30))});`,
  );
  S.push(
    `INSERT INTO contact_messages (id, name, email, company, type, message, created_at) VALUES (${q(id())}, 'Julie Fortin', 'julie.fortin@example.com', ${q("Assurances Fortin")}, 'insurer', ${q("Bonjour, nous aimerions discuter d'un partenariat pour offrir un rabais à nos assurés.")}, ${n(daysAgo(4))});`,
  );
  S.push(
    `INSERT INTO contact_messages (id, name, email, type, message, created_at) VALUES (${q(id())}, 'Marc Delisle', 'marc.delisle@example.com', 'retailer', ${q("Est-ce que les étiquettes résistent au lave-auto ?")}, ${n(daysAgo(2))});`,
  );

  return S.join("\n");
}

// ── run ────────────────────────────────────────────────────────────────────

console.log(`Seeding ${target} (${TARGETS[target].db}, ${TARGETS[target].flag})`);

runSql(buildSql());

console.log(`
Done.
  Real accounts   : ${REAL_ACCOUNTS.length}, account only (no items, no orders)
  Invented accounts: 6
  Password (all)  : Seed1234!
  Items covering  : stolen, active, archived, recovered, insured, no-serial, no-photo
  Orders covering : pending, paid, shipped (+ claimed and unclaimed sticker codes)
`);
