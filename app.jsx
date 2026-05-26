/* ════════════════════════════════════════════════════════════════
   Router / app entry
   ════════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────────
   GamePage — DEPLOY (themed simulation) mounted via iframe.
   Replaces the V4.7 Breakout-style game (now at archive/pages-game-v4-7.jsx).
   DEPLOY lives as a self-contained static app at /deploy/index.html.

   Theme handoff: the parent's data-theme attribute is forwarded to the
   iframe via both URL param (cold load) and postMessage (live toggle).
   DEPLOY listens for {type:"deploy:ready"} → we reply with current theme.
   ──────────────────────────────────────────────────────────────── */
function GamePage({ navigate }) {
  const iframeRef = React.useRef(null);

  // Read the current parent theme from <html data-theme="…">
  const currentTheme = () =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light";

  // Push the current theme into the iframe (postMessage)
  const pushTheme = React.useCallback(() => {
    const f = iframeRef.current;
    if (!f || !f.contentWindow) return;
    f.contentWindow.postMessage({ type: "deploy:theme", value: currentTheme() }, "*");
  }, []);

  // When DEPLOY signals it's ready, send the current theme immediately.
  React.useEffect(() => {
    const onMsg = (e) => {
      if (e && e.data && e.data.type === "deploy:ready") pushTheme();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [pushTheme]);

  // Push theme whenever the parent's data-theme attribute changes (toggle click).
  React.useEffect(() => {
    const obs = new MutationObserver(() => pushTheme());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, [pushTheme]);

  // Cold load — include ?theme= so DEPLOY doesn't briefly flash light before postMessage lands.
  const src = "deploy/index.html?theme=" + currentTheme();

  return (
    <section className="game-page">
      <div className="game-page-bar">
        <button
          className="game-back"
          onClick={() => navigate("home")}
          aria-label="Return to site"
        >← back to site</button>
        <span className="game-title">DEPLOY · AI deployment simulation</span>
        <span className="game-meta">~3 min · five themes · classroom prototype</span>
      </div>
      <iframe
        ref={iframeRef}
        src={src}
        className="game-iframe"
        title="DEPLOY"
        allow="fullscreen"
        onLoad={pushTheme}
      />
    </section>
  );
}

function App() {
  const [route, navigate] = useRoute();
  const [theme, toggleTheme] = useDarkMode();
  const auth = useAuth();
  const toast = useToast();

  let view;
  switch (route.name) {
    case "home":
    case "":
      view = <HomePage navigate={navigate} auth={auth} />;
      break;
    case "about":
      view = <AboutPage navigate={navigate} />;
      break;
    case "thesis":
      view = <ThesisPage navigate={navigate} auth={auth} />;
      break;
    case "blog":
      view = <BlogPage navigate={navigate} />;
      break;
    case "post":
      view = <BlogPostPage navigate={navigate} route={route} />;
      break;
    case "work":
      view = <WorkPage navigate={navigate} />;
      break;
    case "achievements":
      view = <AchievementsPage />;
      break;
    case "contact":
      view = <ContactPage />;
      break;
    case "game":
      view = <GamePage navigate={navigate} />;
      break;
    case "signin":
      view = <SignInPage navigate={navigate} auth={auth} />;
      break;
    case "portal":
      view = <PortalDashboardPage navigate={navigate} auth={auth} toast={toast} />;
      break;
    case "contribution":
      view = <ContributionDetailPage navigate={navigate} auth={auth} route={route} toast={toast} />;
      break;
    default:
      view = <HomePage navigate={navigate} auth={auth} />;
  }

  return (
    <div className="app">
      <Masthead route={route} navigate={navigate} theme={theme} toggleTheme={toggleTheme} auth={auth} />
      <AmbientPetals enabled={route.name !== "game"} />
      {view}
      <Footer navigate={navigate} auth={auth} />
      <Toast msg={toast.msg} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
