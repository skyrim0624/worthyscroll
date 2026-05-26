type Env = {
  ASSETS: Fetcher;
  DB: D1Database;
  APP_ORIGIN?: string;
};

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  email_verified: number;
};

type SessionRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  email_verified: number;
};

const SESSION_COOKIE = "ws_session";
const PASSWORD_ITERATIONS = 100000;
const SESSION_DAYS = 30;
const VERIFICATION_HOURS = 24;
const encoder = new TextEncoder();

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });
}

function error(message: string, status = 400) {
  return json({ error: message }, { status });
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function hashPassword(password: string, salt: string, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64UrlToBytes(salt),
      iterations,
    },
    key,
    256,
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

function parseCookies(request: Request) {
  const cookies = new Map<string, string>();
  const cookieHeader = request.headers.get("Cookie") || "";
  cookieHeader.split(";").forEach((part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName) {
      cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
    }
  });
  return cookies;
}

function sessionCookie(token: string, expiresAt: Date) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expiresAt.toUTCString()}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function publicUser(row: SessionRow | UserRow) {
  return {
    id: "id" in row ? row.id : row.user_id,
    email: row.email,
    displayName: row.display_name || "",
    emailVerified: Boolean(row.email_verified),
  };
}

async function readJson(request: Request) {
  try {
    return await request.json<Record<string, unknown>>();
  } catch {
    return {};
  }
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function currentSession(request: Request, env: Env) {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token) {
    return null;
  }
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const session = await env.DB.prepare(
    `select sessions.user_id, users.email, users.display_name, users.email_verified
     from sessions
     join users on users.id = sessions.user_id
     where sessions.token_hash = ? and sessions.expires_at > ?`,
  )
    .bind(tokenHash, now)
    .first<SessionRow>();

  if (!session) {
    return null;
  }

  await env.DB.prepare("update sessions set last_seen_at = ? where token_hash = ?").bind(now, tokenHash).run();
  return session;
}

async function createSession(env: Env, userId: string) {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await env.DB.prepare("insert into sessions (id, user_id, token_hash, expires_at) values (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, tokenHash, expiresAt.toISOString())
    .run();
  return { token, expiresAt };
}

function appOrigin(request: Request, env: Env) {
  return env.APP_ORIGIN || new URL(request.url).origin;
}

async function handleRegister(request: Request, env: Env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const displayName = String(body.displayName || "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return error("请输入有效邮箱。");
  }
  if (password.length < 8) {
    return error("密码至少需要 8 位。");
  }

  const existing = await env.DB.prepare("select id from users where email = ?").bind(email).first<{ id: string }>();
  if (existing) {
    return error("这个邮箱已经注册过，可以直接登录。", 409);
  }

  const userId = crypto.randomUUID();
  const salt = randomToken(16);
  const passwordHash = await hashPassword(password, salt);
  await env.DB.prepare(
    `insert into users (id, email, display_name, password_hash, password_salt, password_iterations)
     values (?, ?, ?, ?, ?, ?)`,
  )
    .bind(userId, email, displayName || null, passwordHash, salt, PASSWORD_ITERATIONS)
    .run();

  const verificationToken = randomToken();
  const verificationTokenHash = await sha256(verificationToken);
  const expiresAt = new Date(Date.now() + VERIFICATION_HOURS * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    "insert into email_verification_tokens (id, user_id, token_hash, expires_at) values (?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), userId, verificationTokenHash, expiresAt)
    .run();

  const verificationUrl = `${appOrigin(request, env)}/api/auth/verify?token=${encodeURIComponent(verificationToken)}`;

  // NOTE: Cloudflare Email Sending 当前账号返回未授权。这里先返回验证链接，等邮件服务开通后改为真正发邮件。
  return json({
    ok: true,
    emailSent: false,
    verificationUrl,
    message: "账号已创建。当前邮件服务未开通，请先用页面里的验证链接完成邮箱验证。",
  });
}

async function handleVerify(request: Request, env: Env) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!token) {
    return new Response("验证链接无效。", { status: 400 });
  }

  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const record = await env.DB.prepare(
    "select id, user_id from email_verification_tokens where token_hash = ? and used_at is null and expires_at > ?",
  )
    .bind(tokenHash, now)
    .first<{ id: string; user_id: string }>();

  if (!record) {
    return new Response("验证链接已失效或已使用。", { status: 400 });
  }

  await env.DB.batch([
    env.DB.prepare("update users set email_verified = 1, updated_at = ? where id = ?").bind(now, record.user_id),
    env.DB.prepare("update email_verification_tokens set used_at = ? where id = ?").bind(now, record.id),
  ]);

  const session = await createSession(env, record.user_id);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${appOrigin(request, env)}/?verified=1`,
      "Set-Cookie": sessionCookie(session.token, session.expiresAt),
    },
  });
}

async function handleLogin(request: Request, env: Env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const user = await env.DB.prepare("select * from users where email = ?").bind(email).first<UserRow>();

  if (!user) {
    return error("邮箱或密码不对。", 401);
  }
  const passwordHash = await hashPassword(password, user.password_salt, user.password_iterations);
  if (passwordHash !== user.password_hash) {
    return error("邮箱或密码不对。", 401);
  }
  if (!user.email_verified) {
    return error("请先完成邮箱验证。", 403);
  }

  const session = await createSession(env, user.id);
  return json(
    { ok: true, user: publicUser(user) },
    { headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt) } },
  );
}

async function handleLogout(request: Request, env: Env) {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (token) {
    await env.DB.prepare("delete from sessions where token_hash = ?").bind(await sha256(token)).run();
  }
  return json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}

async function handleApi(request: Request, env: Env) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/auth/session") {
    const session = await currentSession(request, env);
    return json({ user: session ? publicUser(session) : null });
  }
  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    return handleRegister(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/auth/verify") {
    return handleVerify(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    return handleLogin(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    return handleLogout(request, env);
  }
  return error("接口不存在。", 404);
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
