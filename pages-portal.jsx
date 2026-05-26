/* ════════════════════════════════════════════════════════════════
   Portal flow — Sign-in (magic link), Dashboard, Contribution detail
   Exports: SignInPage, PortalDashboardPage, ContributionDetailPage

   Backed by Supabase (useAuth in shared.jsx). Magic-link only; the
   invite-only policy is enforced server-side (Supabase Auth has
   "Enable Signups" disabled, so signInWithOtp with shouldCreateUser:false
   for an unknown email returns "Signups not allowed").
   ════════════════════════════════════════════════════════════════ */

const { useState: useStatePortal, useEffect: useEffectPortal } = React;

/* ───────── Sign-in (magic link) ───────── */
function SignInPage({ navigate, auth }) {
  const [email, setEmail]       = useStatePortal("");
  const [sending, setSending]   = useStatePortal(false);
  const [sent, setSent]         = useStatePortal(false);
  const [error, setError]       = useStatePortal(null);

  // If already signed in, bounce straight to the portal
  useEffectPortal(() => {
    if (auth.user) navigate("portal");
  }, [auth.user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    const res = await auth.signInWithMagicLink(email);
    setSending(false);
    if (res.ok) {
      setSent(true);
    } else {
      // Friendly remap of common Supabase error messages
      let msg = res.error || "Something went wrong.";
      if (/signups not allowed/i.test(msg) || /user not found/i.test(msg)) {
        msg = "That email isn't on the contributor list. Request access below if you should be.";
      }
      setError(msg);
    }
  };

  return (
    <main className="page-fade">
      <div className="page">
        <div className="signin-wrap">
          <div className="signin-greeting">
            <span className="eyebrow" style={{ display: "block", marginBottom: 18 }}>§ Contributor portal · sign-in</span>
            <h1>The <em>back room</em>.</h1>
            <p>
              For thesis contributors only. Sign in to follow the thesis's progress and to leave the editor a note.
            </p>
            <div className="marginalia" style={{ marginTop: 32 }}>
              <span className="key">What lives here</span>
              <span>· thesis progress updates (chronological)</span><br/>
              <span>· a private text field to leave the editor a note</span><br/>
              <span>· your contributor profile (yours to edit)</span>
            </div>
          </div>

          <div className="signin-card">
            <span className="label card-eyebrow">Sign in by email</span>
            {!sent ? (
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label className="field-label" htmlFor="email">Email</label>
                  <input
                    id="email"
                    className="field-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@institution.edu"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="hint">
                  <span className="key">How it works:</span> we email you a single-use sign-in link. No password to remember.
                </div>
                {error && <div className="signin-error">— {error}</div>}
                <div className="actions">
                  <button className="btn btn-primary" type="submit" disabled={sending || !email}>
                    {sending ? "Sending link…" : "Email me a sign-in link →"}
                  </button>
                  <span className="request" onClick={() => window.location.href = "mailto:thesis@adityaparupudi.com?subject=Contributor%20access%20request"}>
                    Request access
                  </span>
                </div>
              </form>
            ) : (
              <div>
                <p style={{ fontFamily: "var(--serif)", fontSize: 18, lineHeight: 1.55, marginBottom: 16 }}>
                  <strong>Check your inbox.</strong> A sign-in link is on its way to <em>{email}</em>.
                </p>
                <div className="hint">
                  Click the link in the email to land back here, signed in. The link expires in 1 hour and can only be used once.
                </div>
                <div className="actions" style={{ marginTop: 18 }}>
                  <button className="btn btn-quiet" type="button" onClick={() => { setSent(false); setError(null); }}>
                    Send to a different email
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

/* ───────── Profile fill-in (shown on first sign-in) ───────── */
function ProfileFillIn({ auth, onDone }) {
  const [fullName, setFullName]       = useStatePortal(auth.profile?.full_name || "");
  const [role, setRole]               = useStatePortal(auth.profile?.role || "");
  const [institution, setInstitution] = useStatePortal(auth.profile?.institution || "");
  const [saving, setSaving]           = useStatePortal(false);
  const [error, setError]             = useStatePortal(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await auth.updateProfile({
      full_name: fullName.trim(),
      role: role.trim() || null,
      institution: institution.trim() || null,
    });
    setSaving(false);
    if (res.ok) onDone && onDone();
    else setError(res.error);
  };

  return (
    <form className="compose" onSubmit={submit} style={{ maxWidth: 560 }}>
      <h4>Tell us who you <em>are</em>.</h4>
      <p style={{ fontFamily: "var(--serif)", fontSize: 15, lineHeight: 1.5, color: "var(--fg-2)", marginBottom: 24 }}>
        This is a one-time thing — just so the editor knows who's writing when you send a note.
      </p>
      <div className="field">
        <label className="field-label" htmlFor="full_name">Full name</label>
        <input id="full_name" className="field-input" type="text" required value={fullName}
               onChange={(e) => setFullName(e.target.value)} placeholder="Dr. Jane Doe" />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="role">Role / title <span style={{color:"var(--fg-3)"}}>(optional)</span></label>
        <input id="role" className="field-input" type="text" value={role}
               onChange={(e) => setRole(e.target.value)} placeholder="e.g. Operations Researcher" />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="institution">Institution / affiliation <span style={{color:"var(--fg-3)"}}>(optional)</span></label>
        <input id="institution" className="field-input" type="text" value={institution}
               onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. University of Amsterdam" />
      </div>
      {error && <div className="signin-error">— {error}</div>}
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={saving || !fullName.trim()}>
          {saving ? "Saving…" : "Save profile →"}
        </button>
      </div>
    </form>
  );
}

/* ───────── Portal dashboard ───────── */
function PortalDashboardPage({ navigate, auth, toast }) {
  // Redirect to sign-in if not authenticated (after auth loading resolves)
  useEffectPortal(() => {
    if (!auth.loading && !auth.user) navigate("signin");
  }, [auth.user, auth.loading]);

  if (auth.loading) return (
    <main className="page-fade"><div className="page" style={{ padding: "120px 0" }}>
      <span className="eyebrow">§ Loading session…</span>
    </div></main>
  );
  if (!auth.user) return null;

  // First-sign-in profile fill-in
  if (!auth.profileComplete) {
    return (
      <main className="page-fade">
        <div className="page">
          <section className="portal-hello" style={{ paddingBottom: 24 }}>
            <div>
              <span className="eyebrow" style={{ display: "block", marginBottom: 18 }}>§ Contributor portal · first sign-in</span>
              <h1>Welcome.</h1>
            </div>
          </section>
          <section className="portal-section">
            <ProfileFillIn auth={auth} onDone={() => toast.show("Profile saved")} />
          </section>
        </div>
      </main>
    );
  }

  const firstName = (auth.profile.full_name || "").replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/, "").split(" ")[0];

  return (
    <main className="page-fade">
      <div className="page">
        <section className="portal-hello">
          <div>
            <span className="eyebrow" style={{ display: "block", marginBottom: 18 }}>§ Contributor portal</span>
            <h1>Good to see you,<br/><em>{firstName}</em>.</h1>
            <p>
              The latest from the thesis is below. Leave the editor a note any time — they'll see it within the hour.
            </p>
          </div>
          <div className="portal-meta">
            <div><span className="v">{auth.profile.full_name}</span></div>
            {(auth.profile.role || auth.profile.institution) && (
              <div>
                {auth.profile.role}{auth.profile.role && auth.profile.institution ? " · " : ""}{auth.profile.institution}
              </div>
            )}
            {auth.profile.contributor_since && (
              <div>Contributor since {formatDate(auth.profile.contributor_since)}</div>
            )}
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-quiet" onClick={async () => { await auth.signOut(); navigate("home"); }}>Sign out</button>
            </div>
          </div>
        </section>

        {/* Thesis updates feed */}
        <section className="portal-section">
          <div className="subhead">§ Thesis progress</div>
          <h3>What's <em>new</em>.</h3>
          <ThesisUpdatesFeed />
        </section>

        {/* Quick add update — note for the editor */}
        <section className="portal-section" style={{ borderBottom: 0 }}>
          <div className="subhead">§ A note for the editor</div>
          <h3>Something to <em>say</em>?</h3>
          <NoteForEditor auth={auth} toast={toast} />
        </section>
      </div>
    </main>
  );
}

/* ───────── Thesis updates feed (reads from public.thesis_updates) ───────── */
function ThesisUpdatesFeed() {
  const [updates, setUpdates] = useStatePortal(null); // null = loading, [] = empty, [...] = loaded
  const [error,   setError]   = useStatePortal(null);

  useEffectPortal(() => {
    let alive = true;
    const supa = window.__supabase;
    if (!supa) { setError("Auth service unavailable."); return; }
    supa.from("thesis_updates")
      .select("id, title, body, published_at")
      .order("published_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError(error.message);
        else setUpdates(data || []);
      });
    return () => { alive = false; };
  }, []);

  if (error) {
    return <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--bad)" }}>— {error}</p>;
  }
  if (updates === null) {
    return <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--fg-3)" }}>Loading…</p>;
  }
  if (updates.length === 0) {
    return (
      <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--fg-2)", lineHeight: 1.55 }}>
        No updates posted yet. When the editor publishes one, it'll appear here.
      </p>
    );
  }
  return (
    <div className="update-thread">
      {updates.map((u) => (
        <div key={u.id} className="update-item">
          <span className="u-date">{formatDate(u.published_at)}</span>
          <div>
            <div className="u-title" style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 20, lineHeight: 1.3, marginBottom: 6 }}>
              {u.title}
            </div>
            <div className="u-body" style={{ whiteSpace: "pre-wrap" }}>{u.body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────── Note for the editor (posts to /api/contributor-note) ───────── */
function NoteForEditor({ auth, toast }) {
  const [body, setBody]             = useStatePortal("");
  const [submitting, setSubmitting] = useStatePortal(false);
  const [error, setError]           = useStatePortal(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const token = await auth.getAccessToken();
      if (!token) throw new Error("Session expired — please sign in again.");
      const r = await fetch("/api/contributor-note", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({
          note: body.trim(),
          contributor_name: auth.profile?.full_name || auth.user.email,
        }),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out.message || out.error || ("HTTP " + r.status));
      setBody("");
      toast.show("Note sent to the editor — a copy is in your inbox.");
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="compose" onSubmit={submit}>
      <h4>A <em>note</em> for the editor.</h4>
      <textarea
        className="field-textarea"
        placeholder="A question · a follow-up thought · a correction · a paper you've come across — anything you'd like the editor to see."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
      ></textarea>
      {error && <div className="signin-error">— {error}</div>}
      <div className="compose-actions">
        <span className="label">Sent as email to <code>thesis@adityaparupudi.com</code> · you get a copy.</span>
        <button className="btn btn-primary" type="submit" disabled={submitting || !body.trim()}>
          {submitting ? "Sending…" : "Send to the editor →"}
        </button>
      </div>
    </form>
  );
}

/* ───────── Contribution detail (kept as dead code; no nav reaches it in v1) ─────────
   Routes still expose /#/contribution/{id} but the new portal does NOT link to
   personal contributions per the v1 spec ("contributors don't see their personal
   contribution"). Component preserved here in case it's reintroduced later. */
function ContributionDetailPage({ navigate, auth, route, toast }) {
  useEffectPortal(() => {
    if (!auth.loading && !auth.user) navigate("signin");
  }, [auth.user, auth.loading]);
  if (auth.loading || !auth.user) return null;
  return (
    <main className="page-fade">
      <div className="page" style={{ padding: "120px 0" }}>
        <h1>Personal contribution view</h1>
        <p style={{ marginTop: 18, fontFamily: "var(--serif)", fontSize: 18, lineHeight: 1.5, maxWidth: "55ch" }}>
          Personal contribution detail isn't shown in the current portal. The editor will share
          your contribution with you directly.
        </p>
        <p style={{ marginTop: 18 }}>
          <EditorialLink onClick={() => navigate("portal")}>Back to the portal</EditorialLink>
        </p>
      </div>
    </main>
  );
}

/* ───────── helpers ───────── */
function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
  } catch { return String(iso); }
}

Object.assign(window, {
  SignInPage, PortalDashboardPage, ContributionDetailPage,
});
