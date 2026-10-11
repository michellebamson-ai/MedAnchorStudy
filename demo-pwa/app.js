/* MedAnchor Study — demo build.
   No server, no database, no API keys. Every screen that would need one says
   so plainly instead of pretending, so nothing breaks during a demo. */

(function () {
  "use strict";

  var app = document.getElementById("app");
  var tabbar = document.getElementById("tabbar");
  var LOGO = "icons/logo.png";

  /* ---------------- tiny helpers ---------------- */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function go(route) {
    if (location.hash !== "#" + route) location.hash = route;
    else render(route);
  }

  /* The single message used everywhere a server would be needed. */
  function locked(title, body) {
    return (
      '<div class="locked">' +
        '<div class="mark">◈</div>' +
        "<h3>" + esc(title) + "</h3>" +
        "<p>" + esc(body) + "</p>" +
        '<span class="pill">Full version</span>' +
      "</div>"
    );
  }

  function head(title, sub) {
    return (
      '<div class="top"><img src="' + LOGO + '" alt="">' +
      "<div><h2>" + esc(title) + "</h2>" +
      (sub ? '<p class="sub">' + esc(sub) + "</p>" : "") +
      "</div></div>"
    );
  }

  /* ---------------- screens ---------------- */

  var screens = {};

  screens.welcome = function () {
    tabbar.hidden = true;
    return (
      '<div class="welcome">' +
        '<img src="' + LOGO + '" alt="MedAnchor Study logo">' +
        "<h1>MedAnchor Study</h1>" +
        '<p class="tagline">Turn dense lecture notes into understanding you can actually use.</p>' +
        '<div class="dots"><i class="on"></i><i></i><i></i></div>' +
        '<button class="primary" style="margin-top:30px;max-width:320px;width:100%" data-go="login">Get started</button>' +
        '<button class="link" data-go="login">I already have an account</button>' +
      "</div>"
    );
  };

  screens.login = function (r) {
    tabbar.hidden = true;
    var err = '<p class="err" id="err"></p>';
    return (
      '<div class="welcome" style="justify-content:flex-start;padding-top:34px">' +
        '<img src="' + LOGO + '" alt="" style="width:min(120px,34vw)">' +
        "<h1>Welcome back</h1>" +
        '<p class="tagline">Sign in to pick up where you left off.</p>' +
        '<div style="width:100%;max-width:380px;margin-top:26px;text-align:left">' +
          '<div class="field"><label for="em">Email</label><input id="em" type="email" autocomplete="email" placeholder="you@example.com"></div>' +
          '<div class="field"><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" placeholder="••••••••"></div>' +
          err +
          '<button class="primary" id="signin">Sign in</button>' +
          '<button class="link" id="demo">Enter the demo instead</button>' +
          '<button class="link" data-go="welcome">← Back</button>' +
        "</div>" +
      "</div>"
    );
  };

  screens.setup = function () {
    tabbar.hidden = true;
    return (
      '<div class="welcome" style="justify-content:flex-start;padding-top:30px">' +
        '<h1 style="font-size:26px">Set up your profile</h1>' +
        '<p class="tagline">This tailors the examples and depth to your course.</p>' +
        '<div style="width:100%;max-width:400px;margin-top:22px;text-align:left">' +
          '<div class="field"><label for="nm">First name</label><input id="nm" placeholder="What should we call you?"></div>' +
          '<div class="field"><label for="cr">Course</label><input id="cr" placeholder="e.g. Public Health"></div>' +
          '<button class="primary" id="finish">Continue</button>' +
          '<button class="link" data-go="home">Skip for now</button>' +
        "</div>" +
      "</div>"
    );
  };

  screens.home = function () {
    tabbar.hidden = false;
    return (
      head("What to do next", "Pick up where you left off") +
      '<div class="stats">' +
        '<div class="stat"><b>3</b><span>Reviewed</span></div>' +
        '<div class="stat"><b>2</b><span>Weak topics</span></div>' +
        '<div class="stat"><b>5</b><span>Day streak</span></div>' +
      "</div>" +
      '<button class="tile" data-go="tutor">' +
        '<span class="ico">◆</span><span class="body"><span class="t">Revise Hypertension</span>' +
        '<span class="d">Recommended — weakest topic this week</span></span>' +
      "</button>" +
      '<button class="tile" data-go="materials">' +
        '<span class="ico">▤</span><span class="body"><span class="t">Upload lecture notes</span>' +
        '<span class="d">Turn slides into summaries and questions</span></span>' +
      "</button>" +
      '<button class="tile" data-go="plan">' +
        '<span class="ico">☷</span><span class="body"><span class="t">Study plan</span>' +
        '<span class="d">Exam in 6 days — 45 minutes free tonight</span></span>' +
      "</button>" +
      '<button class="tile" data-go="progress">' +
        '<span class="ico">◔</span><span class="body"><span class="t">Your progress</span>' +
        '<span class="d">What is strong and what needs work</span></span>' +
      "</button>"
    );
  };

  screens.materials = function () {
    tabbar.hidden = false;
    return (
      head("Materials", "Your lecture notes and slides") +
      locked(
        "Document upload needs the full version",
        "This demo has no server to store your files, so uploading and reading is switched off."
      ) +
      '<div class="card"><h3>What this does in the full app</h3>' +
        "<p>Upload a PDF, PowerPoint or Word file and it is read as text — including scanned pages and speaker notes. You then get summaries, flashcards, practice questions and exam cases from your own material.</p>" +
      "</div>"
    );
  };

  screens.tutor = function () {
    tabbar.hidden = false;
    return (
      head("AI Tutor", "Socratic teaching, one question at a time") +
      locked(
        "The AI tutor needs the full version",
        "Answers are generated by a live AI service, which this offline demo does not have."
      ) +
      '<div class="card"><h3>How it works in the full app</h3>' +
        "<p>It asks a question rather than giving the answer. It grades what you say back, spots misconceptions, and raises difficulty as you improve — grounded in your own uploaded notes.</p>" +
      "</div>"
    );
  };

  screens.plan = function () {
    tabbar.hidden = false;
    return (
      head("Study Plan", "Built around your deadlines") +
      '<div class="card"><h3>Tonight — 45 minutes free</h3><p>10 min &nbsp;·&nbsp; Revise Hypertension (weakest topic)</p></div>' +
      '<div class="card"><h3>Tomorrow — 60 minutes</h3><p>25 min &nbsp;·&nbsp; Practice questions on Cardiology</p></div>' +
      '<div class="card"><h3>Saturday — 40 minutes</h3><p>20 min &nbsp;·&nbsp; Spaced review of last week</p></div>' +
      locked(
        "Editing your plan needs the full version",
        "Plans are saved to your account on the server, so this demo shows a fixed sample week."
      )
    );
  };

  screens.progress = function () {
    tabbar.hidden = false;
    return (
      head("Your progress", "Across every part of the app") +
      '<div class="card"><h3>Needs work</h3><p>Hypertension &nbsp;·&nbsp; 42% understood</p></div>' +
      '<div class="card"><h3>Getting there</h3><p>Sensitivity &amp; specificity &nbsp;·&nbsp; 68% understood</p></div>' +
      '<div class="card"><h3>Strong</h3><p>Cardiovascular anatomy &nbsp;·&nbsp; 91% understood</p></div>' +
      locked(
        "Live progress needs the full version",
        "Real progress is calculated from your activity on the server as you work."
      )
    );
  };

  /* ---------------- router ---------------- */

  var TABS = { home: "home", materials: "materials", tutor: "tutor", plan: "plan", progress: "progress" };

  function currentRoute() {
    var r = (location.hash || "#welcome").slice(1);
    return screens[r] ? r : "welcome";
  }

  function render(route) {
    route = route || currentRoute();
    app.innerHTML = screens[route] ? screens[route](route) : screens.welcome();

    // Highlight the matching tab.
    Array.prototype.forEach.call(tabbar.querySelectorAll("button"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-go") === route);
    });

    // Wire the screen-specific buttons.
    wire();
    window.scrollTo(0, 0);
  }

  function wire() {
    var si = document.getElementById("signin");
    if (si) {
      si.addEventListener("click", function () {
        var em = document.getElementById("em").value.trim();
        var pw = document.getElementById("pw").value.trim();
        var err = document.getElementById("err");
        if (!em) { err.textContent = "Enter your email address."; return; }
        if (!pw) { err.textContent = "Enter your password."; return; }
        // No server in this build, so sign-in cannot be verified. Say so
        // rather than failing in a way that looks like a bug.
        err.textContent = "Sign-in needs the full version. Use “Enter the demo instead”.";
      });
    }

    var demo = document.getElementById("demo");
    if (demo) {
      demo.addEventListener("click", function () {
        try { localStorage.setItem("medanchor-demo", "1"); } catch (e) {}
        go("home");
      });
    }

    var fin = document.getElementById("finish");
    if (fin) {
      fin.addEventListener("click", function () {
        var n = document.getElementById("nm").value.trim();
        try { if (n) localStorage.setItem("medanchor-name", n); } catch (e) {}
        go("home");
      });
    }
  }

  /* Delegated so it survives every re-render. */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-go]");
    if (!t) return;
    var r = t.getAttribute("data-go");
    if (TABS[r]) { try { localStorage.setItem("medanchor-tab", r); } catch (err) {} }
    go(r);
  });

  window.addEventListener("hashchange", function () { render(currentRoute()); });

  /* ---------------- service worker ---------------- */

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {
        /* Offline support is a bonus, not a requirement. */
      });
    });
  }

  /* ---------------- start ---------------- */

  var start = location.hash ? currentRoute() : "welcome";
  render(start);

  // Expose for the checker script.
  window.__medanchor = { screens: Object.keys(screens), render: render, go: go };
})();
