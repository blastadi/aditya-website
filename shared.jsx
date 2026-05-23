/* ════════════════════════════════════════════════════════════════
   Shared primitives, hooks, layout chrome
   Exports to window: useDarkMode, useAuth, useRoute, Masthead,
                       Footer, Marginalia, Placeholder, NAV_ITEMS, CONTRIBUTOR,
                       CONTRIBUTIONS, BLOG_POSTS, CHAPTERS, AWARDS, useToast, Toast
   ════════════════════════════════════════════════════════════════ */

const { useState, useEffect, useCallback, useRef } = React;

/* ───────── Routing ───────── */
function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, "");
  if (!h) return { name: "home", params: {} };
  const [base, ...rest] = h.split("/");
  return { name: base, params: { id: rest[0], sub: rest[1] } };
}

function useRoute() {
  const [route, setRoute] = useState(parseHash());
  useEffect(() => {
    const handler = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  const navigate = useCallback((to) => {
    window.location.hash = "#/" + to.replace(/^\/+/, "");
  }, []);
  return [route, navigate];
}

/* ───────── Dark mode ───────── */
function useDarkMode() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);
  const toggle = useCallback(() => {
    setTheme(t => (t === "light" ? "dark" : "light"));
  }, []);
  return [theme, toggle];
}

/* ───────── Auth (mock) ───────── */
const MOCK_PASSWORD = "thesis";

function useAuth() {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("auth");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  useEffect(() => {
    if (user) localStorage.setItem("auth", JSON.stringify(user));
    else localStorage.removeItem("auth");
  }, [user]);
  const signIn = useCallback((email, password) => {
    if (password !== MOCK_PASSWORD) {
      return { ok: false, error: 'Password incorrect. Try "thesis".' };
    }
    if (!email || !email.includes("@")) {
      return { ok: false, error: "Please enter a valid email address." };
    }
    setUser({
      email,
      name: "Dr. Elena Visser",
      role: "Operations Researcher",
      institution: "Lorem University",
      contributorSince: "Feb 2024"
    });
    return { ok: true };
  }, []);
  const signOut = useCallback(() => setUser(null), []);
  return { user, signIn, signOut };
}

/* ───────── Toast ───────── */
function useToast() {
  const [msg, setMsg] = useState(null);
  const tref = useRef(null);
  const show = useCallback((text) => {
    setMsg(text);
    if (tref.current) clearTimeout(tref.current);
    tref.current = setTimeout(() => setMsg(null), 2800);
  }, []);
  return { msg, show };
}

function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast"><span>◆</span><span>{msg}</span></div>;
}

/* ───────── Static placeholder data ───────── */

const AUTHOR = {
  firstName: "Aditya",
  lastName: "Parupudi",
  full: "Aditya Parupudi",
  brewery: "Royal Swinkels · Uiltje · De Molen",
  role: "Master Brewer — Craft",
  location: "Amsterdam, NL",
  email: "hello@adityaparupudi.com",
  emailReal: "adityaparupudi@gmail.com",
  linkedin: "https://www.linkedin.com/in/adityaparupudi/",
  thesisTitle: "Deciding to Deploy",
  thesisSubtitle: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua — placeholder subtitle until the real one is set.",
  institution: "MSc Management · University of Amsterdam",
  year: "Feb 2025 — Feb 2027",
  status: "In progress · v0.4",
  tagline: "An Award-Winning Research & Development oriented Brewer & Distiller",
};

const NAV_ITEMS = [
  { id: "about",        label: "About",        route: "about" },
  { id: "thesis",       label: "Thesis",       route: "thesis" },
  { id: "blog",         label: "Journal",      route: "blog" },
  { id: "game",         label: "Deploy",       route: "game" },
  { id: "work",         label: "Work",         route: "work", mobile: "hide" },
  { id: "achievements", label: "Awards",       route: "achievements", mobile: "hide" },
  { id: "contact",      label: "Contact",      route: "contact" },
];

const CHAPTERS = [
  { num: "I",   title: "Lorem ipsum dolor sit amet",                pages: "p. 1—24" },
  { num: "II",  title: "Consectetur adipiscing elit",                pages: "p. 25—58" },
  { num: "III", title: "Sed do eiusmod tempor",                      pages: "p. 59—96" },
  { num: "IV",  title: "Ut labore et dolore magna",                  pages: "p. 97—138" },
  { num: "V",   title: "Quis nostrud exercitation",                  pages: "p. 139—186" },
  { num: "VI",  title: "Duis aute irure dolor",                      pages: "p. 187—228" },
  { num: "VII", title: "Excepteur sint occaecat cupidatat",          pages: "p. 229—272" },
];

const CONTRIBUTIONS = [
  {
    id: "contribution-one",
    chapter: "II",
    chapterTitle: "Consectetur adipiscing elit",
    paragraph: "§ 2.3, paragraphs 2 — 5",
    excerpt: "“Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco.”",
    cited: "Cited as primary source",
    lastRevised: "12 days ago",
    unread: true,
    updates: [
      { date: "Apr 18, 2025", body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit — the revised phrasing reads well in §2.3. Glad you kept the original hedge.", tag: "Reviewer note" },
      { date: "Mar 02, 2025", body: "Sed do eiusmod tempor incididunt ut labore et dolore. Original interview ingested into the chapter draft.", tag: "Original contribution" },
    ],
  },
  {
    id: "contribution-two",
    chapter: "IV",
    chapterTitle: "Ut labore et dolore magna",
    paragraph: "§ 4.1 — lorem ipsum pattern",
    excerpt: "“Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.”",
    cited: "Cited as case study",
    lastRevised: "1 month ago",
    unread: false,
    updates: [
      { date: "Mar 21, 2025", body: "Quis autem vel eum iure reprehenderit qui in ea voluptate velit. Caveat in footnote 14 can be dropped.", tag: "Update" },
    ],
  },
  {
    id: "contribution-three",
    chapter: "VII",
    chapterTitle: "Excepteur sint occaecat cupidatat",
    paragraph: "§ 7.2, the audit framework",
    excerpt: "“Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.”",
    cited: "Co-authored",
    lastRevised: "3 months ago",
    unread: false,
    updates: [
      { date: "Feb 10, 2025", body: "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet — pilot ran clean.", tag: "Field test" },
      { date: "Jan 22, 2025", body: "Working session notes attached. Reworded question 3 to read more clearly.", tag: "Working session" },
    ],
  },
];

const BLOG_POSTS = [
  {
    slug: "post-one",
    date: "Apr 12, 2025",
    category: "Essay",
    title: "Lorem ipsum dolor sit amet, <em>consectetur</em> adipiscing.",
    dek: "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua — a placeholder post until the real essay lands.",
    minutes: "12 min read",
    body: [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
      "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
      "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
      "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia <em>dolor sit amet</em>.",
      "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.",
    ],
  },
  {
    slug: "post-two",
    date: "Feb 03, 2025",
    category: "Field notes",
    title: "Quis autem vel eum iure reprehenderit <em>qui in ea</em>.",
    dek: "Voluptate velit esse quam nihil molestiae consequatur — short field notes from somewhere quieter than the office.",
    minutes: "6 min read",
    body: [
      "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.",
      "Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus.",
      "Ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat. On any other day this might have been a memo; today it is something else.",
      "Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est.",
    ],
  },
  {
    slug: "post-three",
    date: "Nov 28, 2024",
    category: "On the work",
    title: "On <em>process</em> — neque porro quisquam est qui dolorem.",
    dek: "Notes on doing the work, in the voice of the work — a short placeholder while the real essay is drafted.",
    minutes: "9 min read",
    body: [
      "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.",
      "Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse.",
      "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum — and yet, somewhere underneath, the work continues anyway.",
    ],
  },
];

const AWARDS = [
  { year: "2024", text: "Most-awarded brewery in Europe, <em>second consecutive year</em>.", tag: "Industry — annual" },
  { year: "2023", text: "Gold — <em>World Beer Cup</em>, Non-Alcoholic IPA category.", tag: "Award · World" },
  { year: "2023", text: "Winner — <em>European Beer Star</em>, Non-Alcoholic IPA.", tag: "Award · Europe" },
  { year: "2023", text: "Winner — <em>Brussels Beer Challenge</em>, Non-Alcoholic IPA.", tag: "Award · Brussels" },
  { year: "2023", text: "Winner — <em>Dutch Beer Challenge</em>, Non-Alcoholic IPA.", tag: "Award · NL" },
  { year: "Ongoing", text: "Most-awarded IPA brewery, <em>consistently</em>, at the Dutch and Brussels Beer Challenges.", tag: "Recurring · IPA category" },
];

const HEADLINE_WINS = [
  {
    text: "Joint top medal-winning brewery — <em>Dutch Beer Challenge</em>.",
    by: "2026",
    note: "Six medals — one gold, four silver, one bronze.",
  },
  {
    text: "The <em>big winner</em> of the 11th Dutch Beer Challenge.",
    by: "2025",
    note: "Seven medals — three gold, two silver, two bronze.",
  },
  {
    text: "Bird of Prey 0.2% — <em>World Beer Cup gold</em>, <em>Best Dutch Beer</em> at Brussels.",
    by: "Since 2023",
    note: "An international non-alcoholic flagship across three years of competition.",
  },
];

const AWARD_GROUPS = [
  {
    year: "2026",
    summary: "Six medals · Dutch Beer Challenge",
    competitions: [
      {
        name: "Dutch Beer Challenge",
        wins: [
          { medal: "Gold",   beer: "Mr. Anderson, Welcome Back",                    category: "Amber Ale · Double/Imperial IPA" },
          { medal: "Silver", beer: "Say Hello To My Little Friend",                 category: "Amber Ale · IPA" },
          { medal: "Silver", beer: "The Imperial March",                            category: "Donker · Stout/Porter" },
          { medal: "Silver", beer: "Houston, We Have A Problem",                    category: "Amber Ale · Hazy IPA / NEIPA" },
          { medal: "Silver", beer: "Uiltje Blond",                                  category: "Blond · Licht blond" },
          { medal: "Bronze", beer: "The Ants Are My Friends, They're Blowing In The Wind", category: "Amber Ale · IPA" },
        ],
      },
    ],
  },
  {
    year: "2025",
    summary: "Eleven medals · three competitions",
    competitions: [
      {
        name: "Dutch Beer Challenge",
        wins: [
          { medal: "Gold",   beer: "Pomme Pressure",      category: "Innovatie/speciaal · Houtgelagerd" },
          { medal: "Gold",   beer: "What's Up, Dude?",    category: "Blond · Hoppy Lager" },
          { medal: "Gold",   beer: "Craft Beer Cookout",  category: "Amber Ale · IPA" },
          { medal: "Silver", beer: "Black in Time",       category: "Donker · Dark/Black IPA" },
          { medal: "Silver", beer: "Juicy Lucy",          category: "Amber Ale · Hazy IPA / NEIPA" },
          { medal: "Bronze", beer: "Bird of Prey 0.2%",   category: "Innovatie/speciaal · Alcoholarm" },
          { medal: "Bronze", beer: "Dr. Raptor",          category: "Amber Ale · Double/Imperial IPA" },
        ],
      },
      {
        name: "World Beer Cup",
        wins: [
          { medal: "Bronze", beer: "Bird of Prey 0.2",    category: "Hoppy Non-Alcohol Beer" },
        ],
      },
      {
        name: "Brussels Beer Challenge",
        wins: [
          { medal: "Gold",   beer: "#Roastme",                          category: "Dark Ale · Dark/Black IPA" },
          { medal: "Bronze", beer: "Say Hello To My Little Friend",     category: "Pale & Amber Ale · American IPA" },
          { medal: "Bronze", beer: "Balcony Bonfire At Your BnB",       category: "Lager · Hoppy Lager" },
        ],
      },
    ],
  },
  {
    year: "2024",
    summary: "Five medals · including Best Dutch Beer",
    competitions: [
      {
        name: "Dutch Beer Challenge",
        wins: [
          { medal: "Gold",   beer: "Lekker Bakske Kobi!",       category: "Innovatie/speciaal · Houtgelagerd" },
          { medal: "Gold",   beer: "Hats, Hops & Warm Socks",   category: "Amber Ale · Hazy IPA / NEIPA" },
          { medal: "Bronze", beer: "Dr. Raptor",                category: "Amber Ale · Double/Imperial IPA" },
        ],
      },
      {
        name: "Brussels Beer Challenge",
        wins: [
          { medal: "Gold",   beer: "Bird of Prey 0.2%",         category: "Alcohol-free speciality beer", note: "+ Best Dutch Beer 2024" },
          { medal: "Bronze", beer: "Dr. Raptor",                category: "Speciality beer above 7% ABV" },
        ],
      },
    ],
  },
  {
    year: "2023",
    summary: "Five medals · World Beer Cup gold",
    competitions: [
      {
        name: "Dutch Beer Challenge",
        wins: [
          { medal: "Gold",   beer: "Lekker Bakske Kobi",        category: "Innovatie/speciaal · Houtgelagerd" },
          { medal: "Gold",   beer: "Smokey the Pear",           category: "Innovatie/speciaal · Rook" },
          { medal: "Silver", beer: "Superb Owl",                category: "Innovatie/speciaal · Alcoholarm" },
        ],
      },
      {
        name: "Brussels Beer Challenge",
        wins: [
          { medal: "Gold",   beer: "Bird of Prey 0.2%",         category: "Alcohol-free speciality beer" },
        ],
      },
      {
        name: "World Beer Cup",
        wins: [
          { medal: "Gold",   beer: "Bird of Prey 0.2%",         category: "Non-Alcoholic IPA" },
        ],
      },
    ],
  },
  {
    year: "2022",
    summary: "Two medals · Dutch Beer Challenge",
    competitions: [
      {
        name: "Dutch Beer Challenge",
        wins: [
          { medal: "Silver", beer: "Dikke Lul 3 Bier",          category: "Amber Ale · Pale Ale / Speciale Belge" },
          { medal: "Silver", beer: "Pitmaster Porter",          category: "Donker · Imperial Stout" },
        ],
      },
    ],
  },
  {
    year: "2021",
    summary: "Five medals · two competitions",
    competitions: [
      {
        name: "Dutch Beer Challenge",
        wins: [
          { medal: "Silver", beer: "Smoking Pils",              category: "Innovatie/speciaal · Rook" },
          { medal: "Bronze", beer: "My Life Span #5",           category: "Amber Ale · Hazy IPA / NEIPA" },
        ],
      },
      {
        name: "London Beer Competition",
        wins: [
          { medal: "Gold",   beer: "Bird of Prey IPA",          category: "90 points · Best in Show by Country" },
          { medal: "Silver", beer: "Dr. Raptor",                category: "84 points" },
        ],
      },
    ],
  },
];

const WORK_ITEMS = [
  {
    year: "Dec 2025 — present",
    role: "Master Brewer &amp; Head of Operations",
    title: "Uiltje Brewing Company",
    body: "Leading brewery operations end-to-end — recipe development, quality, planning, packaging, costing, and the day-to-day of a 40hL brewhouse with canning at 2,500 CPH. Built and maintain a company-wide Google Sheets and Google Cloud-based production / quality / ERP system that supports everything from sales planning to procurement.",
  },
  {
    year: "Jun 2024 — present",
    role: "Master Brewer — Craft",
    title: "Royal Swinkels",
    body: "Trusted recipe-and-craft consultant for Uiltje Brewing and Brouwerij De Molen. Lead recipe formulation, sensory evaluation, and process refinement with Head Brewers and QA/QC. Bridge creative brewing with operational efficiency — ingredient research, process optimisation, mentoring brewing teams.",
  },
  {
    year: "May 2024 — present",
    role: "Consultant Brewer",
    title: "Brouwerij Rodenbach · Flemish Region, BE",
    body: "Craft brewing consultancy with one of Belgium's most storied breweries.",
  },
  {
    year: "Oct 2023 — present",
    role: "Consultant Brewer",
    title: "Brouwerij Palm B.V. · Brussels, BE",
    body: "Recipe and process consultancy for the Palm brewery group.",
  },
  {
    year: "Feb 2025 — Feb 2027",
    role: "Master of Science — Management",
    title: "University of Amsterdam",
    body: "MSc Management with a focus on AI and Business Innovation. Research explores how organisations can deploy AI in a structured, scalable, and responsible way — beyond isolated use cases, into structure, governance, workflows, and team capabilities.",
  },
  {
    year: "Jun 2024 — Sep 2025",
    role: "Master Brewer",
    title: "Brouwerij de Molen · Utrecht",
    body: "Master Brewer for one of the Netherlands' most respected craft breweries.",
  },
  {
    year: "Feb 2022 — Jun 2024",
    role: "Head Brewer",
    title: "Uiltje Brewing Company · Haarlem",
    body: "Developed and curated a portfolio of 30+ beer styles annually for Dutch and EU markets. Managed the Quality Team, ran daily operations on a 40hL brewhouse at up to two brews per day, with canning at 2,500 CPH via Wild Goose. Partnerships with De Proef and Swinkels Family Brewers supported ~15,000 hL/year of external contract brewing.",
  },
  {
    year: "Oct 2019 — Nov 2021",
    role: "Head of Research &amp; Development",
    title: "Simba · India",
    body: "Led R&amp;D for India's largest family-owned craft beer brand. Brewery: 125hL, 6-vessel, fully automated brewhouse running 8 brews/day including contract brewing for Carlsberg. Oversaw the deployment of a 9,000 CPH automated canning line.",
  },
  {
    year: "Jul 2020 — Oct 2021",
    role: "New Product Development Specialist",
    title: "Weapon Distillers · Goa",
    body: "NPD across spirits and infusions for a Goa-based craft distillery.",
  },
  {
    year: "Jul 2018 — May 2019",
    role: "Senior Brewer",
    title: "McCashin's Brewery · Nelson, NZ",
    body: "Senior brewing role in New Zealand's South Island.",
  },
  {
    year: "Jan — Jun 2018",
    role: "Certified Brewmaster",
    title: "VLB Berlin",
    body: "Brewing &amp; Beverage Technology certification programme.",
  },
];

/* ───────── Layout chrome ───────── */

function Masthead({ route, navigate, theme, toggleTheme, auth }) {
  return (
    <header className="masthead">
      <div className="masthead-inner">
        <div className="brand" onClick={() => navigate("home")}>
          <div className="brand-mark">{AUTHOR.full}</div>
          <div className="brand-meta">Master Brewer · Researcher · Editor</div>
        </div>
        <nav className="nav-links" aria-label="Primary">
          {NAV_ITEMS.map(item => (
            <span
              key={item.id}
              className={"nav-link" + (route.name === item.route ? " active" : "") + (item.mobile === "hide" ? " hide-mobile" : "")}
              onClick={() => navigate(item.route)}
            >
              {item.label}
            </span>
          ))}
          {auth.user && (
            <span
              className={"nav-link" + (route.name === "portal" ? " active" : "")}
              onClick={() => navigate("portal")}
              title="Contributor portal"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)", display: "inline-block" }}></span>
              Portal
            </span>
          )}
          <button className="mode-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            <span className="dot"></span>
            <span>{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}

function Footer({ navigate, auth }) {
  return (
    <footer className="footer">
      <div className="page">
        <div className="footer-inner">
          <div className="footer-col">
            <div className="footer-tag">
              A small monograph of working notes — <em>read at your own pace</em>.
            </div>
          </div>
          <div className="footer-col">
            <h5>Sections</h5>
            <ul>
              <li onClick={() => navigate("about")}>About</li>
              <li onClick={() => navigate("thesis")}>Thesis</li>
              <li onClick={() => navigate("blog")}>Journal</li>
              <li onClick={() => navigate("work")}>Work</li>
            </ul>
          </div>
          <div className="footer-col">
            <h5>Contributors</h5>
            <ul>
              {auth.user
                ? <>
                    <li onClick={() => navigate("portal")}>Open portal</li>
                    <li onClick={auth.signOut}>Sign out</li>
                  </>
                : <>
                    <li onClick={() => navigate("signin")}>Sign in</li>
                    <li onClick={() => navigate("signin")}>Request access</li>
                  </>
              }
            </ul>
          </div>
          <div className="footer-col">
            <h5>Elsewhere</h5>
            <ul>
              <li onClick={() => navigate("contact")}>Write to me</li>
              <li><a href={AUTHOR.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>LinkedIn</a></li>
              <li>Subscribe (~3/yr)</li>
              <li>RSS</li>
            </ul>
          </div>
        </div>
        <div className="footer-base">
          <span>{AUTHOR.full} · {AUTHOR.location} · MMXXVI</span>
          <span>Set in Inter · JetBrains Mono</span>
        </div>
      </div>
    </footer>
  );
}

/* ───────── Reusable bits ───────── */

function Placeholder({ label, className = "", style = {} }) {
  return <div className={"placeholder-img " + className} data-label={label || "placeholder"} style={style}></div>;
}

function Marginalia({ rows }) {
  return (
    <div className="marginalia">
      {rows.map((r, i) => (
        <React.Fragment key={i}>
          <span className="key">{r.k}</span>
          <span>{r.v}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

function EditorialLink({ children, onClick }) {
  return (
    <span className="editorial-link" onClick={onClick}>
      <span>{children}</span>
      <span className="arrow">→</span>
    </span>
  );
}

/* ───────── Exports to window ───────── */
Object.assign(window, {
  useRoute, useDarkMode, useAuth, useToast,
  Masthead, Footer, Placeholder, Marginalia, EditorialLink, Toast,
  AUTHOR, NAV_ITEMS, CHAPTERS, CONTRIBUTIONS, BLOG_POSTS,
  AWARDS, HEADLINE_WINS, AWARD_GROUPS, WORK_ITEMS,
});
