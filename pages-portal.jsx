/* ════════════════════════════════════════════════════════════════
   Portal flow — Sign-in, Dashboard, Contribution detail
   Exports: SignInPage, PortalDashboardPage, ContributionDetailPage
   ════════════════════════════════════════════════════════════════ */

const { useState: useStatePortal, useEffect: useEffectPortal } = React;

/* ───────── Sign-in ───────── */
function SignInPage({ navigate, auth }) {
  const [email, setEmail] = useStatePortal("elena.visser@eur.nl");
  const [password, setPassword] = useStatePortal("");
  const [error, setError] = useStatePortal(null);
  const [loading, setLoading] = useStatePortal(false);

  useEffectPortal(() => {
    if (auth.user) navigate("portal");
  }, [auth.user]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setTimeout(() => {
      const res = auth.signIn(email, password);
      setLoading(false);
      if (!res.ok) setError(res.error);
      else navigate("portal");
    }, 500);
  };

  return (
    <main className="page-fade">
      <div className="page">
        <div className="signin-wrap">
          <div className="signin-greeting">
            <span className="eyebrow" style={{ display: "block", marginBottom: 18 }}>§ Contributor portal · sign-in</span>
            <h1>The <em>back room</em>.</h1>
            <p>
              For thesis contributors only. Sign in to see your contribution, what has changed since, and to add an update.
            </p>
            <div className="marginalia" style={{ marginTop: 32 }}>
              <span className="key">What lives here</span>
              <span>· your named contribution</span><br/>
              <span>· the changelog of edits since your last visit</span><br/>
              <span>· a private text field to leave a new update</span><br/>
              <span>· your previous notes, timestamped</span>
            </div>
          </div>

          <div className="signin-card">
            <span className="label card-eyebrow">Sign in</span>
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
              <div className="field">
                <label className="field-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  className="field-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="hint">
                <span className="key">Demo:</span> use any email + password <span className="key">"thesis"</span>
              </div>
              {error && <div className="signin-error">— {error}</div>}
              <div className="actions">
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in →"}
                </button>
                <span className="request" onClick={() => alert("In production this routes a request to the author for manual approval.")}>
                  Request access
                </span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ───────── Portal dashboard ───────── */
function PortalDashboardPage({ navigate, auth, toast }) {
  useEffectPortal(() => {
    if (!auth.user) navigate("signin");
  }, [auth.user]);

  if (!auth.user) return null;

  return (
    <main className="page-fade">
      <div className="page">
        <section className="portal-hello">
          <div>
            <span className="eyebrow" style={{ display: "block", marginBottom: 18 }}>§ Contributor portal</span>
            <h1>Good to see you,<br/><em>{auth.user.name.replace("Dr. ", "")}</em>.</h1>
            <p>
              Three of your contributions are cited in the current manuscript. One has new edits since your last visit — flagged below.
            </p>
          </div>
          <div className="portal-meta">
            <div><span className="v">{auth.user.name}</span></div>
            <div>{auth.user.role} · {auth.user.institution}</div>
            <div>Contributor since {auth.user.contributorSince}</div>
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-quiet" onClick={() => { auth.signOut(); navigate("home"); }}>Sign out</button>
            </div>
          </div>
        </section>

        {/* Your contributions */}
        <section className="portal-section">
          <div className="subhead">§ Your contributions</div>
          <h3>What's <em>on the page</em>.</h3>
          {CONTRIBUTIONS.map(c => (
            <div key={c.id} className="contribution-card" onClick={() => navigate("contribution/" + c.id)}>
              <div>
                <div className="c-eyebrow">Chapter {c.chapter} · {c.chapterTitle}</div>
                <h4>{c.paragraph.replace(/§/g, "§")}</h4>
                <p className="c-excerpt">{c.excerpt}</p>
                <span className="label">{c.cited}</span>
              </div>
              <div className="c-meta">
                {c.unread && <span className="pill unread">New edits</span>}
                <div>
                  <div className="k">Last revised</div>
                  <div className="v">{c.lastRevised}</div>
                </div>
                <div>
                  <div className="k">Thread</div>
                  <div className="v">{c.updates.length} {c.updates.length === 1 ? "note" : "notes"}</div>
                </div>
                <EditorialLink onClick={(e) => { e.stopPropagation && e.stopPropagation(); navigate("contribution/" + c.id); }}>
                  Open thread
                </EditorialLink>
              </div>
            </div>
          ))}
        </section>

        {/* Recent activity across thesis */}
        <section className="portal-section">
          <div className="subhead">§ What's changed since your last visit</div>
          <h3>Recent <em>edits</em> to the manuscript.</h3>
          <div className="update-thread">
            <div className="update-item">
              <span className="u-date">Apr 22, 2025</span>
              <div>
                <div className="u-body">Chapter II — second-round revision complete. Lorem ipsum dolor sit amet — several of your citations have moved into the new §2.1 framing.</div>
                <span className="u-tag">Structural · affects your contribution</span>
              </div>
            </div>
            <div className="update-item">
              <span className="u-date">Apr 18, 2025</span>
              <div>
                <div className="u-body">Chapter IV — your quote on lorem ipsum has been promoted from a footnote to a pull quote in §4.1.</div>
                <span className="u-tag">Editorial · approval requested</span>
              </div>
            </div>
            <div className="update-item">
              <span className="u-date">Mar 30, 2025</span>
              <div>
                <div className="u-body">Chapter VII — placeholder pilot data now appears as Figure 12. Caption credits you as co-author.</div>
                <span className="u-tag">Figure added</span>
              </div>
            </div>
          </div>
        </section>

        {/* Quick add update */}
        <section className="portal-section" style={{ borderBottom: 0 }}>
          <div className="subhead">§ Add an update</div>
          <h3>Something to <em>say</em>?</h3>
          <QuickAdd toast={toast} />
        </section>
      </div>
    </main>
  );
}

function QuickAdd({ toast }) {
  const [chapter, setChapter] = useStatePortal("IV");
  const [body, setBody] = useStatePortal("");
  const [submitting, setSubmitting] = useStatePortal(false);
  const submit = (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setBody("");
      toast.show("Update sent to the editor");
    }, 600);
  };
  return (
    <form className="compose" onSubmit={submit}>
      <h4>A <em>note</em> for the editor.</h4>
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, alignItems: "end", marginBottom: 14 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">About chapter</label>
          <select className="field-input" style={{ borderBottom: "1px solid var(--line)", fontFamily: "var(--serif)", fontSize: 22, background: "transparent", color: "var(--fg)", outline: "none" }} value={chapter} onChange={e => setChapter(e.target.value)}>
            {CHAPTERS.map(ch => <option key={ch.num} value={ch.num}>{ch.num}. {ch.title}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Tag</label>
          <input className="field-input" type="text" defaultValue="Update" />
        </div>
      </div>
      <textarea
        className="field-textarea"
        placeholder="A corrected quote · a follow-up thought · a new data point — whatever you'd like the manuscript to absorb."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
      ></textarea>
      <div className="compose-actions">
        <span className="label">Saved automatically — only sent when you submit.</span>
        <button className="btn btn-primary" type="submit" disabled={submitting || !body.trim()}>
          {submitting ? "Sending…" : "Send to the editor →"}
        </button>
      </div>
    </form>
  );
}

/* ───────── Contribution detail ───────── */
function ContributionDetailPage({ navigate, auth, route, toast }) {
  useEffectPortal(() => {
    if (!auth.user) navigate("signin");
  }, [auth.user]);

  if (!auth.user) return null;

  const c = CONTRIBUTIONS.find(x => x.id === route.params.id);
  if (!c) {
    return (
      <main className="page-fade">
        <div className="page" style={{ padding: "120px 0" }}>
          <h1>Contribution not found.</h1>
          <p style={{ marginTop: 18 }}>
            <EditorialLink onClick={() => navigate("portal")}>Back to the portal</EditorialLink>
          </p>
        </div>
      </main>
    );
  }

  const [composeBody, setComposeBody] = useStatePortal("");
  const [thread, setThread] = useStatePortal(c.updates);
  const [submitting, setSubmitting] = useStatePortal(false);

  const submit = (e) => {
    e.preventDefault();
    if (!composeBody.trim()) return;
    setSubmitting(true);
    setTimeout(() => {
      setThread([{ date: "Today", body: composeBody.trim(), tag: "Your note · just now" }, ...thread]);
      setComposeBody("");
      setSubmitting(false);
      toast.show("Note added to the thread");
    }, 500);
  };

  return (
    <main className="page-fade">
      <div className="page">
        <section style={{ padding: "56px 0 24px", borderBottom: "1px solid var(--line)" }}>
          <EditorialLink onClick={() => navigate("portal")}>Back to portal</EditorialLink>
        </section>

        <section style={{ padding: "48px 0 24px" }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 18 }}>
            § Chapter {c.chapter} · {c.chapterTitle}
          </span>
          <h1 style={{ fontSize: "clamp(36px, 5.5vw, 72px)", lineHeight: 0.98, letterSpacing: "-0.02em" }}>
            Your contribution to<br/><em>{c.chapterTitle.toLowerCase()}</em>.
          </h1>
          <div style={{ marginTop: 32, padding: 32, background: "var(--bg-2)", borderLeft: "2px solid var(--fg)" }}>
            <span className="label" style={{ marginBottom: 12, display: "block" }}>The cited paragraph — {c.paragraph}</span>
            <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 24, lineHeight: 1.5, margin: 0, maxWidth: "60ch" }}>
              {c.excerpt}
            </p>
          </div>
          <div style={{ marginTop: 24, display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div>
              <span className="label">Citation</span>
              <div style={{ fontFamily: "var(--serif)", fontSize: 18, marginTop: 4 }}>{c.cited}</div>
            </div>
            <div>
              <span className="label">Last revised</span>
              <div style={{ fontFamily: "var(--serif)", fontSize: 18, marginTop: 4 }}>{c.lastRevised}</div>
            </div>
            <div>
              <span className="label">Anchor</span>
              <div style={{ fontFamily: "var(--mono)", fontSize: 13, marginTop: 4, color: "var(--fg-2)" }}>
                /thesis/ch-{c.chapter.toLowerCase()}#{c.id}
              </div>
            </div>
          </div>
        </section>

        {/* Thread */}
        <section style={{ padding: "56px 0 24px", borderTop: "1px solid var(--line)" }}>
          <div className="subhead" style={{ fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 8 }}>§ Thread</div>
          <h3 style={{ fontSize: "clamp(28px, 3.4vw, 44px)", lineHeight: 1, marginBottom: 28, letterSpacing: "-0.01em" }}>
            What's been <em>said</em>.
          </h3>
          <div className="update-thread">
            {thread.map((u, i) => (
              <div key={i} className="update-item">
                <span className="u-date">{u.date}</span>
                <div>
                  <div className="u-body">{u.body}</div>
                  <span className="u-tag">{u.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Add update */}
        <section style={{ padding: "48px 0 80px" }}>
          <form className="compose" onSubmit={submit}>
            <h4>Add to the <em>thread</em>.</h4>
            <textarea
              className="field-textarea"
              placeholder="A correction, a follow-up, a new source — anything you'd like the editor to see."
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              rows={5}
            ></textarea>
            <div className="compose-actions">
              <span className="label">Posted to the thread + emailed to the editor.</span>
              <button className="btn btn-primary" type="submit" disabled={submitting || !composeBody.trim()}>
                {submitting ? "Sending…" : "Post note →"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

Object.assign(window, {
  SignInPage, PortalDashboardPage, ContributionDetailPage,
});
