/* ════════════════════════════════════════════════════════════════
   Router / app entry
   ════════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────────
   GamePage — DEPLOY (themed simulation) mounted via iframe.
   Replaces the V4.7 Breakout-style game (now at archive/pages-game-v4-7.jsx).
   DEPLOY lives as a self-contained static app at /deploy/index.html.
   ──────────────────────────────────────────────────────────────── */
function GamePage({ navigate }) {
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
        src="deploy/index.html"
        className="game-iframe"
        title="DEPLOY"
        allow="fullscreen"
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
