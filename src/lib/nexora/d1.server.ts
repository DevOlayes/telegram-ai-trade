/**
 * Small Supabase-query compatibility layer backed by Cloudflare D1.
 *
 * This intentionally supports only the query operations used by the existing
 * server-side LEXORA modules. It preserves their { data, error, count } result
 * shape so business logic can be migrated without being redesigned.
 */
import { env } from "cloudflare:workers";

type D1Result = { results?: Record<string, unknown>[]; success?: boolean; meta?: { changes?: number; last_row_id?: number } };
type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  all: <T = Record<string, unknown>>() => Promise<{ results?: T[]; meta?: { changes?: number } }>;
  first: <T = Record<string, unknown>>(columnName?: string) => Promise<T | null>;
  run: () => Promise<D1Result>;
};
type D1DatabaseLike = {
  prepare: (sql: string) => D1Statement;
  batch: (statements: D1Statement[]) => Promise<D1Result[]>;
};

const ID_TABLES = new Set([
  "users", "user_roles", "user_milestones", "admin_actions", "trades", "transactions", "referrals", "referral_rewards", "milestones",
  "withdrawals", "deposits", "events", "broadcasts", "broadcast_recipients",
]);
const JSON_COLUMNS = new Set([
  "ui_state", "share_platforms", "risk_flags", "value", "durations", "risk_profiles", "buttons",
  "audience_params", "payload", "metadata",
]);

function ident(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error(`Invalid SQL identifier: ${value}`);
  return `"${value}"`;
}

function decodeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === "string" && JSON_COLUMNS.has(key)) {
      try { out[key] = JSON.parse(value); } catch { /* keep ordinary text */ }
    }
  }
  return out;
}

function encode(value: unknown): unknown {
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return value;
}

function encodeColumn(table: string, column: string, value: unknown): unknown {
  if (value !== null && JSON_COLUMNS.has(column)) return JSON.stringify(value);
  return encode(value);
}

type Filter = { column: string; op: string; value?: unknown };

class D1Query implements PromiseLike<{ data: any; error: any; count?: number }> {
  private action: "select" | "insert" | "update" | "delete" = "select";
  private columns = "*";
  private values: Record<string, unknown>[] = [];
  private patch: Record<string, unknown> = {};
  private filters: Filter[] = [];
  private sorts: { column: string; ascending: boolean }[] = [];
  private maxRows: number | null = null;
  private offset: number | null = null;
  private singleMode: "single" | "maybeSingle" | null = null;
  private countMode: "exact" | null = null;
  private headOnly = false;
  private conflictColumns: string[] = [];
  private returning = false;

  constructor(private readonly sqlDb: D1DatabaseLike, private readonly table: string) {
    ident(table);
  }

  select(columns = "*", options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) {
    this.columns = columns.split(",").map((v) => v.trim()).map((v) => {
      if (v === "*") return "*";
      return ident(v);
    }).join(", ");
    if (options?.count === "exact") this.countMode = "exact";
    if (options?.head) this.headOnly = true;
    if (this.action !== "select") this.returning = true;
    return this;
  }

  insert(input: Record<string, unknown> | Record<string, unknown>[]) {
    this.action = "insert";
    this.values = (Array.isArray(input) ? input : [input]).map((item) => {
      const row = { ...item };
      if (ID_TABLES.has(this.table) && !row.id) row.id = crypto.randomUUID();
      return row;
    });
    return this;
  }

  upsert(input: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) {
    this.action = "insert";
    this.values = (Array.isArray(input) ? input : [input]).map((item) => {
      const row = { ...item };
      if (ID_TABLES.has(this.table) && !row.id) row.id = crypto.randomUUID();
      return row;
    });
    this.conflictColumns = (options?.onConflict ?? "").split(",").map((v) => v.trim()).filter(Boolean);
    return this;
  }

  update(values: Record<string, unknown>) { this.action = "update"; this.patch = values; return this; }
  delete() { this.action = "delete"; return this; }
  eq(column: string, value: unknown) { this.filters.push({ column, op: "=", value }); return this; }
  neq(column: string, value: unknown) { this.filters.push({ column, op: "!=", value }); return this; }
  gt(column: string, value: unknown) { this.filters.push({ column, op: ">", value }); return this; }
  gte(column: string, value: unknown) { this.filters.push({ column, op: ">=", value }); return this; }
  lt(column: string, value: unknown) { this.filters.push({ column, op: "<", value }); return this; }
  lte(column: string, value: unknown) { this.filters.push({ column, op: "<=", value }); return this; }
  is(column: string, value: unknown) { this.filters.push({ column, op: value === null ? "IS" : "=", value }); return this; }
  not(column: string, operator: string, value: unknown) {
    if (operator === "is" && value === null) this.filters.push({ column, op: "IS NOT", value: null });
    else if (operator === "in") this.filters.push({ column, op: "NOT IN", value });
    else throw new Error(`Unsupported not(${operator}) query`);
    return this;
  }
  in(column: string, values: unknown[]) { this.filters.push({ column, op: "IN", value: values }); return this; }
  filter(column: string, operator: string, value: unknown) {
    const op = operator.toLowerCase();
    if (op === "gte" || op === "gt" || op === "lte" || op === "lt" || op === "eq" || op === "neq") {
      const mapped: Record<string, string> = { gte: ">=", gt: ">", lte: "<=", lt: "<", eq: "=", neq: "!=" };
      this.filters.push({ column, op: mapped[op], value });
      return this;
    }
    if (op === "is") return this.is(column, value);
    if (op === "in") {
      const list = String(value).replace(/^\(|\)$/g, "").split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
      return this.in(column, list);
    }
    throw new Error(`Unsupported filter operator: ${operator}`);
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.sorts.push({ column, ascending: options?.ascending !== false });
    return this;
  }
  limit(n: number) { this.maxRows = Math.max(0, Math.trunc(n)); return this; }
  range(from: number, to: number) { this.offset = Math.max(0, from); this.maxRows = Math.max(0, to - from + 1); return this; }
  single() { this.singleMode = "single"; return this; }
  maybeSingle() { this.singleMode = "maybeSingle"; return this; }

  private whereSql(params: unknown[]): string {
    if (!this.filters.length) return "";
    return " WHERE " + this.filters.map((f) => {
      const col = ident(f.column);
      if (f.op === "IS" || f.op === "IS NOT") return `${col} ${f.op} NULL`;
      if (f.op === "IN" || f.op === "NOT IN") {
        const list = Array.isArray(f.value) ? f.value : [];
        if (!list.length) return f.op === "IN" ? "1 = 0" : "1 = 1";
        params.push(...list.map((value) => encodeColumn(this.table, f.column, value)));
        return `${col} ${f.op} (${list.map(() => "?").join(", ")})`;
      }
      params.push(encodeColumn(this.table, f.column, f.value));
      return `${col} ${f.op} ?`;
    }).join(" AND ");
  }

  private async execute(): Promise<{ data: any; error: any; count?: number }> {
    try {
      const params: unknown[] = [];
      const where = this.whereSql(params);
      let sql = "";
      let queryParams: unknown[] = [];
      let rows: Record<string, unknown>[] = [];
      let count: number | undefined;

      if (this.countMode === "exact") {
        const countParams: unknown[] = [];
        const countWhere = this.whereSql(countParams);
        const result = await this.sqlDb.prepare(`SELECT COUNT(*) AS count FROM ${ident(this.table)}${countWhere}`).bind(...countParams).first<{ count: number }>();
        count = Number(result?.count ?? 0);
      }

      if (this.action === "select") {
        if (this.headOnly) return { data: null, error: null, ...(count === undefined ? {} : { count }) };
        sql = `SELECT ${this.columns} FROM ${ident(this.table)}${where}`;
        queryParams = [...params];
        if (this.sorts.length) sql += " ORDER BY " + this.sorts.map((s) => `${ident(s.column)} ${s.ascending ? "ASC" : "DESC"}`).join(", ");
        if (this.maxRows !== null) { sql += " LIMIT ?"; queryParams.push(this.maxRows); }
        if (this.offset !== null) {
          if (this.maxRows === null) sql += " LIMIT -1";
          sql += " OFFSET ?"; queryParams.push(this.offset);
        }
        const result = await this.sqlDb.prepare(sql).bind(...queryParams).all<Record<string, unknown>>();
        rows = (result.results ?? []).map(decodeRow);
      } else if (this.action === "insert") {
        if (!this.values.length) return { data: [], error: null, ...(count === undefined ? {} : { count }) };
        const statements: string[] = [];
        for (const row of this.values) {
          const keys = Object.keys(row);
          if (!keys.length) throw new Error("Cannot insert an empty row");
          const cols = keys.map(ident).join(", ");
          const placeholders = keys.map(() => "?").join(", ");
          let statement = `INSERT INTO ${ident(this.table)} (${cols}) VALUES (${placeholders})`;
          if (this.conflictColumns.length) {
            statement += " ON CONFLICT (" + this.conflictColumns.map(ident).join(", ") + ") DO UPDATE SET " +
              keys.filter((key) => !this.conflictColumns.includes(key) && key !== "id").map((key) => `${ident(key)} = excluded.${ident(key)}`).join(", ");
            if (keys.every((key) => this.conflictColumns.includes(key) || key === "id")) statement = `INSERT OR IGNORE INTO ${ident(this.table)} (${cols}) VALUES (${placeholders})`;
          }
          if (this.returning) statement += ` RETURNING ${this.columns}`;
          const result = await this.sqlDb.prepare(statement).bind(...keys.map((key) => encodeColumn(this.table, key, row[key]))).all<Record<string, unknown>>();
          rows.push(...(result.results ?? []).map(decodeRow));
        }
      } else if (this.action === "update") {
        const keys = Object.keys(this.patch);
        if (!keys.length) return { data: [], error: null, ...(count === undefined ? {} : { count }) };
        const set = keys.map((key) => `${ident(key)} = ?`).join(", ");
        queryParams = [...keys.map((key) => encodeColumn(this.table, key, this.patch[key])), ...params];
        sql = `UPDATE ${ident(this.table)} SET ${set}${where}${this.returning ? ` RETURNING ${this.columns}` : ""}`;
        const result = await this.sqlDb.prepare(sql).bind(...queryParams).all<Record<string, unknown>>();
        rows = (result.results ?? []).map(decodeRow);
      } else {
        sql = `DELETE FROM ${ident(this.table)}${where}${this.returning ? ` RETURNING ${this.columns}` : ""}`;
        const result = await this.sqlDb.prepare(sql).bind(...params).all<Record<string, unknown>>();
        rows = (result.results ?? []).map(decodeRow);
      }

      if (this.singleMode === "single") {
        if (rows.length !== 1) return { data: null, error: { message: `Expected one row, received ${rows.length}`, code: "PGRST116" }, ...(count === undefined ? {} : { count }) };
        return { data: rows[0], error: null, ...(count === undefined ? {} : { count }) };
      }
      if (this.singleMode === "maybeSingle") {
        if (rows.length > 1) return { data: null, error: { message: `Expected at most one row, received ${rows.length}`, code: "PGRST116" }, ...(count === undefined ? {} : { count }) };
        return { data: rows[0] ?? null, error: null, ...(count === undefined ? {} : { count }) };
      }
      return { data: rows, error: null, ...(count === undefined ? {} : { count }) };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : String(error), cause: error } };
    }
  }

  then<TResult1 = { data: any; error: any; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export function d1Db() {
  const sqlDb = (env as unknown as { DB?: D1DatabaseLike }).DB;
  if (!sqlDb) throw new Error("Cloudflare D1 binding DB is unavailable. Check wrangler.jsonc and deploy environment.");
  return {
    from: (table: string) => new D1Query(sqlDb, table),
    async applyBalanceAtomic(
      userId: string,
      delta: { balance?: number; bonus?: number; profit?: number; referral_balance?: number },
      ledger: { kind: string; amount: number; ref_id?: string | null; note?: string | null },
    ) {
      const statements = [
        sqlDb.prepare("INSERT INTO balances (user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING").bind(userId),
        sqlDb.prepare(`UPDATE balances
          SET balance = balance + ?, bonus = bonus + ?, profit = profit + ?,
              referral_balance = referral_balance + ?, updated_at = ?
          WHERE user_id = ?`).bind(
            Number(delta.balance ?? 0),
            Number(delta.bonus ?? 0),
            Number(delta.profit ?? 0),
            Number(delta.referral_balance ?? 0),
            new Date().toISOString(),
            userId,
          ),
        sqlDb.prepare(`INSERT INTO transactions
          (user_id, kind, amount, balance_after, ref_id, note)
          SELECT ?, ?, ?, balance, ?, ? FROM balances WHERE user_id = ?`).bind(
            userId,
            ledger.kind,
            ledger.amount,
            ledger.ref_id ?? null,
            ledger.note ?? null,
            userId,
          ),
      ];
      const results = await sqlDb.batch(statements);
      const failed = results.find((result) => result.success === false);
      if (failed) throw new Error("Atomic balance update failed");
      const row = await sqlDb.prepare(
        "SELECT balance, bonus, profit, referral_balance, updated_at FROM balances WHERE user_id = ?",
      ).bind(userId).first<Record<string, unknown>>();
      if (!row) throw new Error("Balance row missing after atomic update");
      return row;
    },
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      try {
        if (name !== "expire_promotional_credit") throw new Error(`Unsupported D1 RPC: ${name}`);
        const userId = args.p_user_id ?? null;
        const expired = await sqlDb.prepare(
          `UPDATE balances
             SET balance = MAX(0, balance - bonus), bonus = 0, updated_at = ?
           WHERE bonus > 0 AND user_id IN (
             SELECT id FROM users WHERE bonus_expires_at IS NOT NULL AND bonus_expires_at <= ?
               AND (? IS NULL OR id = ?)
           ) RETURNING user_id`,
        ).bind(new Date().toISOString(), new Date().toISOString(), userId, userId).all();
        const ids = (expired.results ?? []).map((row: any) => row.user_id);
        if (ids.length) {
          const placeholders = ids.map(() => "?").join(", ");
          await sqlDb.prepare(`UPDATE users SET bonus_expired_at = ? WHERE id IN (${placeholders})`)
            .bind(new Date().toISOString(), ...ids).run();
        }
        return { data: ids.length, error: null };
      } catch (error) {
        return { data: null, error: { message: error instanceof Error ? error.message : String(error), cause: error } };
      }
    },
  };
}
