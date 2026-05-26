/* ════════════════════════════════════════════════════════════════
   /api/contributor-note  —  Vercel serverless function
   ────────────────────────────────────────────────────────────────
   Receives a "Note for the editor" from a signed-in contributor and
   relays it via Resend to thesis@adityaparupudi.com (cc the
   contributor so they have a copy of what they sent).

   Authentication: the caller must include their Supabase access token
   in the Authorization header — we verify it against Supabase's
   /auth/v1/user endpoint to establish identity. No token = 401.

   Environment vars (set in Vercel dashboard, production):
     - RESEND_API_KEY            re_… key with sending access for adityaparupudi.com
     - SUPABASE_URL              https://iepyjygjitcmapgefetg.supabase.co  (defaulted below)
     - SUPABASE_PUBLISHABLE_KEY  sb_publishable_…                        (defaulted below)

   Why the defaults: project URL + publishable key are public-safe
   (they appear in client-side JS anyway). Hardcoding them here makes
   the function still work if env vars aren't set yet, but real value
   in env vars allows zero-downtime project swaps later.
   ════════════════════════════════════════════════════════════════ */

const RESEND_API           = "https://api.resend.com/emails";
const SUPABASE_URL         = process.env.SUPABASE_URL         || "https://iepyjygjitcmapgefetg.supabase.co";
const SUPABASE_PUBLIC_KEY  = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_1m7mCDnTSSEw3fVva0Wp4g_KYf8ZXVJ";

const EDITOR_INBOX  = "thesis@adityaparupudi.com";
const FROM_ADDRESS  = "Adityaparupudi.com Notes <notes@adityaparupudi.com>";

module.exports = async (req, res) => {
  // CORS — same-origin only since the form lives on the same host as the API
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  // ────────── 1. Verify the caller ──────────
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "missing_auth", message: "Sign in required." });
  }

  let user;
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: {
        Authorization: "Bearer " + token,
        apikey: SUPABASE_PUBLIC_KEY,
      },
    });
    if (!r.ok) {
      return res.status(401).json({ error: "invalid_session" });
    }
    user = await r.json();
  } catch (e) {
    return res.status(500).json({ error: "auth_check_failed", message: String(e) });
  }
  if (!user || !user.email) {
    return res.status(401).json({ error: "invalid_user" });
  }

  // ────────── 2. Parse the note body ──────────
  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch (_e) {
    body = {};
  }
  const note = String(body.note || "").trim();
  const contributorName = String(body.contributor_name || user.email).trim();

  if (note.length === 0) {
    return res.status(400).json({ error: "empty_note", message: "Note text is required." });
  }
  if (note.length > 10000) {
    return res.status(400).json({ error: "note_too_long", message: "Notes must be under 10000 characters." });
  }

  // ────────── 3. Send via Resend ──────────
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "config", message: "Email service not configured." });
  }

  const subject = "[Contributor Update] - " + contributorName;
  const timestamp = new Date().toUTCString();

  const textBody =
`${note}

—

Submitted ${timestamp}
From:   ${contributorName} <${user.email}>
Source: adityaparupudi.com/#/portal (contributor note)`;

  const htmlBody = `
<div style="font-family:Inter,system-ui,sans-serif;font-size:14px;line-height:1.55;color:#0B0B0B">
  <div style="white-space:pre-wrap;margin-bottom:24px">${escapeHtml(note)}</div>
  <hr style="border:none;border-top:1px solid #D9D9D9;margin:24px 0" />
  <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#6B6B6B">
    Submitted ${escapeHtml(timestamp)}<br/>
    From:&nbsp;&nbsp;&nbsp; ${escapeHtml(contributorName)} &lt;${escapeHtml(user.email)}&gt;<br/>
    Source: adityaparupudi.com/#/portal (contributor note)
  </div>
</div>`;

  const payload = {
    from:      FROM_ADDRESS,
    to:        [EDITOR_INBOX],
    cc:        [user.email],
    reply_to:  user.email,
    subject,
    text: textBody,
    html: htmlBody,
  };

  try {
    const r = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(502).json({
        error: "send_failed",
        upstream_status: r.status,
        upstream: out,
      });
    }
    return res.status(200).json({ ok: true, id: out.id || null });
  } catch (e) {
    return res.status(500).json({ error: "send_threw", message: String(e) });
  }
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
