(() => {
  "use strict";

  const STORAGE_KEY = "investlab-simulacoes-v1";
  const ACCOUNTS_STORAGE_KEY = "investlab-contas-v1";
  const PASSWORD_HASH_ITERATIONS = 210000;
  const currency = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
  const percent = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2
  });
  const investments = [
    { id: "cdb", name: "CDB", detail: "Renda fixa · IR estimado", rate: 10, taxable: true, color: "#5b67e8" },
    { id: "lci", name: "LCI / LCA", detail: "Renda fixa · sem IR nesta estimativa", rate: 9, taxable: false, color: "#18a999" },
    { id: "tesouro", name: "Tesouro Direto", detail: "Renda fixa · IR estimado", rate: 10.5, taxable: true, color: "#f0a33a" },
    { id: "cripto", name: "Criptomoedas", detail: "Cenário hipotético · pode haver perdas", rate: 15, taxable: false, color: "#e56b79" }
  ];

  let latestResults = [];
  let charts = {};
  let marketFetchInProgress = false;
  let currentUserId = "";
  let marketRefreshTimer = null;

  function addExternalAsset(tagName, attributes) {
    const element = document.createElement(tagName);
    Object.keys(attributes).forEach((key) => element.setAttribute(key, attributes[key]));
    document.head.appendChild(element);
    return element;
  }

  function installStyles() {
    addExternalAsset("script", { src: "https://cdn.tailwindcss.com" });
    addExternalAsset("script", { src: "https://cdn.jsdelivr.net/npm/chart.js" });

    const style = document.createElement("style");
    style.textContent = `
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f5f7fb; }
      * { box-sizing: border-box; }
      body { margin: 0; min-width: 320px; background: #f5f7fb; }
      button, input { font: inherit; }
      button { cursor: pointer; }
      .access-screen { min-height:100vh; display:grid; place-items:center; padding:24px; background:linear-gradient(145deg,#eef1ff,#f7f8fb 55%); }
      .access-card { width:min(430px,100%); padding:28px; border:1px solid #e5e8f0; border-radius:18px; background:#fff; box-shadow:0 12px 40px rgba(31,43,80,.08); }
      .access-brand { display:flex; align-items:center; gap:10px; margin-bottom:25px; color:#19223a; font-size:17px; font-weight:800; }
      .access-brand .brand-mark { width:32px; height:32px; }
      .access-card h1 { margin:0 0 7px; font-size:24px; }
      .access-intro { margin:0 0 20px; color:#70798d; font-size:12px; line-height:1.55; }
      .access-tabs { display:grid; grid-template-columns:1fr 1fr; gap:5px; padding:4px; margin-bottom:18px; border-radius:9px; background:#f1f3f9; }
      .access-tab { height:37px; border:0; border-radius:7px; background:transparent; color:#70798d; font-size:12px; font-weight:700; }
      .access-tab.active { background:#fff; color:#505dd7; box-shadow:0 2px 8px rgba(31,43,80,.09); }
      .access-form { display:grid; gap:9px; }
      .access-form[hidden] { display:none; }
      .access-form label { margin-top:4px; color:#394258; font-size:11px; font-weight:750; }
      .access-form input { width:100%; height:42px; padding:0 11px; border:1px solid #e1e5ed; border-radius:8px; outline:none; }
      .access-form input:focus { border-color:#6874ed; box-shadow:0 0 0 3px rgba(91,103,232,.12); }
      .access-feedback { display:none; margin:0 0 12px; padding:10px 11px; border-radius:8px; font-size:11px; line-height:1.45; }
      .access-feedback.error { display:block; background:#fff0f1; color:#b43e4b; }
      .access-feedback.success { display:block; background:#edf9f5; color:#167c67; }
      .access-note { margin:17px 0 0; padding-top:13px; border-top:1px solid #edf0f5; color:#858d9d; font-size:10px; line-height:1.5; }
      .account-actions { display:flex; align-items:center; gap:10px; }
      .logout-btn { height:34px; padding:0 12px; border:1px solid #e1e5ed; border-radius:9px; background:#fff; color:#46516a; font-size:11px; font-weight:700; }
      .app-shell { min-height: 100vh; }
      .topbar { height: 72px; background: rgba(255,255,255,.94); border-bottom: 1px solid #e8ebf2; display:flex; align-items:center; justify-content:space-between; padding: 0 max(24px, calc((100vw - 1200px)/2)); position:sticky; top:0; z-index:5; backdrop-filter: blur(12px); }
      .brand { display:flex; align-items:center; gap:11px; font-size:19px; font-weight:800; letter-spacing:-.04em; color:#19223a; }
      .brand-mark { width:35px; height:35px; display:grid; place-items:center; border-radius:11px; color:#fff; background:linear-gradient(135deg,#6574f5,#4654d6); font-size:18px; }
      .top-note { color:#70798d; font-size:13px; }
      .market-comparison-grid { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr); gap:20px; align-items:stretch; }
      .market-panel { min-width:0; }
      .market-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0 0 10px; }
      .market-status { color:#747e91; font-size:11px; }
      .market-status.error { color:#b43e4b; }
      .market-refresh { height:34px; padding:0 11px; border:1px solid #e1e5ed; border-radius:9px; background:#fff; color:#46516a; font-size:11px; font-weight:700; }
      .market-refresh:disabled { opacity:.6; cursor:wait; }
      .market-table-wrap { overflow-x:auto; }
      .market-table { min-width:0; }
      .market-table th { padding:10px 6px; font-size:9px; }
      .market-table td { padding:12px 6px; font-size:11px; }
      .market-asset { color:#263047; font-weight:750; }
      .market-symbol { display:block; margin-top:3px; color:#9299a7; font-size:9px; text-transform:uppercase; }
      .market-volume { display:block; margin-top:4px; color:#858d9d; font-size:9px; font-weight:500; }
      .market-disclaimer { margin:13px 0 0; padding:11px 12px; border-radius:10px; background:#fff8e9; color:#766342; font-size:10px; line-height:1.55; }
      .market-source { display:block; margin-top:9px; color:#8a92a2; font-size:10px; }
      .market-source a { color:#5663df; }
      .page { width:min(1200px, calc(100% - 40px)); margin:0 auto; padding:38px 0 56px; }
      .eyebrow { color:#5b67e8; text-transform:uppercase; font-weight:800; letter-spacing:.12em; font-size:11px; }
      .hero { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:28px; }
      h1 { margin:8px 0 8px; font-size:clamp(28px,4vw,38px); line-height:1.12; letter-spacing:-.05em; color:#172033; }
      .hero p { margin:0; max-width:650px; color:#70798d; line-height:1.65; font-size:15px; }
      .demo-badge { background:#edf0ff; color:#4d59d2; border-radius:999px; padding:9px 13px; font-size:12px; font-weight:700; white-space:nowrap; }
      .layout { display:grid; grid-template-columns: minmax(290px, .82fr) minmax(0, 1.65fr); gap:20px; align-items:start; }
      .card { background:#fff; border:1px solid #e8ebf2; border-radius:18px; box-shadow:0 6px 24px rgba(31,43,80,.035); }
      .panel { padding:23px; }
      .panel-title { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:0 0 5px; font-size:17px; font-weight:800; letter-spacing:-.025em; }
      .panel-subtitle { margin:0 0 21px; color:#81899a; font-size:12px; line-height:1.5; }
      .field { margin:0 0 15px; }
      .field label { display:flex; justify-content:space-between; align-items:center; margin-bottom:7px; color:#394258; font-size:12px; font-weight:700; }
      .field-hint { color:#9aa1af; font-size:11px; font-weight:500; }
      .input-wrap { position:relative; }
      .input-prefix,.input-suffix { position:absolute; top:50%; transform:translateY(-50%); color:#8a92a2; font-size:13px; pointer-events:none; }
      .input-prefix { left:12px; }.input-suffix { right:12px; }
      .field input { width:100%; height:43px; border:1px solid #e1e5ed; border-radius:10px; background:#fff; padding:0 13px; color:#202a40; outline:none; transition:.18s; }
      .field input.with-prefix { padding-left:37px; }.field input.with-suffix { padding-right:38px; }
      .field input:focus { border-color:#6874ed; box-shadow:0 0 0 3px rgba(91,103,232,.12); }
      .divider { height:1px; background:#edf0f5; margin:20px 0; }
      .investments-heading { margin:0 0 11px; color:#394258; font-size:12px; font-weight:800; }
      .investment-option { display:grid; grid-template-columns:20px minmax(0,1fr) 112px; align-items:center; gap:10px; padding:11px 0; border-top:1px solid #f0f2f6; }
      .investment-option input[type=checkbox] { width:16px; height:16px; accent-color:#5b67e8; margin:0; }
      .investment-name { display:block; font-size:12px; font-weight:750; color:#263047; }
      .investment-detail { display:block; margin-top:3px; font-size:10px; color:#8991a1; line-height:1.35; }
      .rate-field { display:flex; align-items:center; gap:5px; min-width:0; }
      .rate-field input { height:36px; min-width:0; width:100%; text-align:right; padding:0 6px; font-size:12px; }
      .rate-field span { flex:none; color:#858da0; font-size:11px; white-space:nowrap; }
      .primary-btn,.secondary-btn,.danger-btn { border:0; border-radius:10px; height:44px; padding:0 16px; font-weight:750; font-size:13px; transition:transform .15s, background .15s; }
      .primary-btn { width:100%; background:#5866e8; color:#fff; box-shadow:0 5px 12px rgba(88,102,232,.2); }
      .primary-btn:hover { background:#4856d7; transform:translateY(-1px); }
      .secondary-btn { background:#eef0ff; color:#505dd7; }
      .secondary-btn:hover { background:#e2e5ff; }
      .danger-btn { height:32px; padding:0 10px; background:#fff0f1; color:#c34d5a; font-size:11px; }
      .message { display:none; margin-top:12px; padding:10px 12px; border-radius:9px; font-size:12px; line-height:1.45; }
      .message.error { display:block; background:#fff0f1; color:#b43e4b; }.message.success { display:block; background:#edf9f5; color:#167c67; }
      .results { min-width:0; display:grid; gap:20px; }
      .kpis { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:13px; }
      .kpi { padding:17px 18px; }
      .kpi-label { display:block; color:#828a9b; font-size:11px; font-weight:650; }
      .kpi-value { display:block; margin-top:8px; color:#202a40; font-size:clamp(17px,2vw,22px); font-weight:850; letter-spacing:-.04em; }
      .kpi-caption { display:block; margin-top:5px; color:#9299a7; font-size:10px; }
      .chart-card { padding:21px 22px 18px; }
      .chart-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px; }
      .chart-head h2 { margin:0; font-size:15px; font-weight:800; letter-spacing:-.02em; }
      .chart-head p { margin:5px 0 0; color:#8a92a2; font-size:11px; }
      .chart-wrap { position:relative; height:250px; }
      .chart-wrap.short { height:220px; }
      .table-card { padding:21px 22px; overflow:hidden; }
      .table-scroll { overflow-x:auto; }
      table { width:100%; border-collapse:collapse; text-align:left; white-space:nowrap; }
      th { padding:11px 10px; color:#8b93a3; font-size:10px; text-transform:uppercase; letter-spacing:.06em; border-bottom:1px solid #edf0f5; }
      td { padding:13px 10px; color:#394258; font-size:12px; border-bottom:1px solid #f0f2f6; }
      tr:last-child td { border-bottom:0; }
      .product-cell { display:flex; align-items:center; gap:9px; font-weight:750; color:#273148; }
      .dot { width:8px; height:8px; border-radius:50%; flex:none; }
      .value-strong { font-weight:800; color:#202a40; }
      .return-positive { color:#13856f; font-weight:750; }.return-negative { color:#cc5360; font-weight:750; }
      .section { margin-top:28px; }
      .section-head { display:flex; justify-content:space-between; align-items:flex-end; gap:12px; margin-bottom:13px; }
      .section-head h2 { margin:0; font-size:19px; letter-spacing:-.035em; }
      .section-head p { margin:4px 0 0; color:#858d9d; font-size:12px; }
      .history-list { display:grid; gap:10px; }
      .history-item { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:13px 15px; border:1px solid #edf0f5; border-radius:12px; }
      .history-main { display:flex; align-items:center; gap:11px; min-width:0; }
      .history-main input { accent-color:#5b67e8; }
      .history-title { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:440px; font-size:12px; font-weight:750; color:#2b354b; }
      .history-meta { display:block; margin-top:4px; color:#8a92a1; font-size:10px; }
      .history-total { color:#29334a; font-size:12px; font-weight:800; white-space:nowrap; }
      .empty-state { padding:23px 15px; border:1px dashed #dfe3ec; border-radius:12px; color:#858d9d; text-align:center; font-size:12px; }
      .history-actions { display:flex; gap:8px; align-items:center; }
      .history-save-form { display:flex; align-items:center; gap:7px; }
      .history-save-form label { color:#46516a; font-size:10px; font-weight:700; }
      .history-save-form input { width:145px; height:34px; border:1px solid #e1e5ed; border-radius:8px; padding:0 9px; }
      .history-save-form .primary-btn,.history-save-form .secondary-btn { width:auto; height:34px; padding:0 10px; }
      .disclaimer { margin-top:27px; padding:15px 17px; color:#777f90; background:#eef1f7; border-radius:12px; font-size:11px; line-height:1.6; }
      .formula { display:block; margin-top:7px; color:#60697b; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:10px; }
      @media (max-width:900px) { .layout { grid-template-columns:1fr; }.market-comparison-grid { grid-template-columns:1fr; }.hero { align-items:flex-start; flex-direction:column; }.demo-badge { align-self:flex-start; } }
      @media (max-width:600px) { .topbar { height:62px; padding:0 17px; }.top-note { display:none; }.page { width:calc(100% - 28px); padding:25px 0 38px; }.panel,.chart-card,.table-card { padding:17px; }.kpis { grid-template-columns:1fr; gap:9px; }.kpi { padding:14px 16px; }.kpi-value { margin-top:4px; }.chart-wrap { height:220px; }.section-head { align-items:flex-start; flex-direction:column; }.history-item { align-items:flex-start; }.history-title { max-width:190px; }.history-actions { flex-direction:column-reverse; align-items:flex-end; }.history-save-form { flex-wrap:wrap; }.history-save-form label { flex-basis:100%; }.history-save-form input { min-width:100px; flex:1; }.access-card { padding:22px; } }
    `;
    document.head.appendChild(style);
  }

  function normalizeUserId(value) {
    return String(value || "").trim().toLowerCase();
  }

  function validUserId(value) {
    return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
  }

  function validPassword(value) {
    return value.length >= 10 &&
      value.length <= 128 &&
      /\d/.test(value) &&
      /\p{Ll}/u.test(value) &&
      /\p{Lu}/u.test(value) &&
      /[\p{P}\p{S}]/u.test(value);
  }

  function readAccounts() {
    try {
      const saved = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
      if (!saved) return [];
      const accounts = JSON.parse(saved);
      if (!Array.isArray(accounts) || accounts.some((account) => {
        return !account || typeof account.id !== "string" ||
          typeof account.salt !== "string" || typeof account.passwordHash !== "string" ||
          !Number.isInteger(account.iterations) || account.iterations < 1;
      })) {
        throw new Error("Formato de contas inválido.");
      }
      return accounts;
    } catch (error) {
      console.error("Não foi possível ler as contas locais:", error);
      throw new Error("Não foi possível acessar as contas salvas neste navegador.");
    }
  }

  function writeAccounts(accounts) {
    try {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    } catch (error) {
      console.error("Não foi possível salvar as contas locais:", error);
      throw new Error("Não foi possível salvar a conta neste navegador.");
    }
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
  }

  async function hashPassword(password, salt, iterations) {
    if (!window.crypto || !window.crypto.subtle || !window.crypto.getRandomValues) {
      throw new Error("A criptografia local não está disponível. Abra o sistema pelo Live Server ou em HTTPS.");
    }
    const key = await window.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const derived = await window.crypto.subtle.deriveBits({
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    }, key, 256);
    return bytesToHex(new Uint8Array(derived));
  }

  function sameHash(left, right) {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
      difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
  }

  function setAccessFeedback(message, type) {
    const feedback = document.querySelector("#access-feedback");
    feedback.textContent = message;
    feedback.className = `access-feedback ${type}`;
  }

  function setAccessMode(mode) {
    const loginForm = document.querySelector("#login-form");
    const registerForm = document.querySelector("#register-form");
    loginForm.hidden = mode !== "login";
    registerForm.hidden = mode !== "register";
    document.querySelectorAll("[data-access-mode]").forEach((tab) => {
      const active = tab.dataset.accessMode === mode;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    document.querySelector("#access-feedback").className = "access-feedback";
    document.querySelector("#access-feedback").textContent = "";
  }

  function renderAccess(message, messageType) {
    document.body.innerHTML = `
      <main class="access-screen">
        <section class="access-card">
          <div class="access-brand"><span class="brand-mark">↗</span><span>InvestLab</span></div>
          <h1>Acesse sua conta</h1>
          <p class="access-intro">Entre ou crie uma conta usando somente seu ID e sua senha.</p>
          <div class="access-tabs" role="tablist" aria-label="Acesso à conta">
            <button class="access-tab active" type="button" data-access-mode="login" role="tab" aria-selected="true">Entrar</button>
            <button class="access-tab" type="button" data-access-mode="register" role="tab" aria-selected="false">Criar conta</button>
          </div>
          <p id="access-feedback" class="access-feedback" role="status" aria-live="polite"></p>
          <form id="login-form" class="access-form">
            <label for="login-id">ID</label>
            <input id="login-id" name="id" type="text" minlength="3" maxlength="32" pattern="[A-Za-z0-9][A-Za-z0-9._\\-]{2,31}" autocomplete="username" required>
            <label for="login-password">Senha</label>
            <input id="login-password" name="password" type="password" autocomplete="current-password" required>
            <button class="primary-btn" type="submit">Entrar</button>
          </form>
          <form id="register-form" class="access-form" hidden>
            <label for="register-id">Escolha seu ID</label>
            <input id="register-id" name="id" type="text" minlength="3" maxlength="32" pattern="[A-Za-z0-9][A-Za-z0-9._\\-]{2,31}" autocomplete="username" required>
            <label for="register-password">Crie sua senha</label>
            <input id="register-password" name="password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required>
            <button class="primary-btn" type="submit">Criar conta e entrar</button>
          </form>
          <p class="access-note">Senha com 10+ caracteres, incluindo maiúscula, minúscula, número e símbolo. A conta fica apenas neste navegador; não use uma senha importante.</p>
        </section>
      </main>`;

    document.querySelectorAll("[data-access-mode]").forEach((tab) => {
      tab.addEventListener("click", () => setAccessMode(tab.dataset.accessMode));
    });
    document.querySelector("#login-form").addEventListener("submit", handleLogin);
    document.querySelector("#register-form").addEventListener("submit", handleRegistration);
    if (message) setAccessFeedback(message, messageType || "error");
  }

  async function handleLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Entrando...";
    try {
      const id = normalizeUserId(form.elements.id.value);
      const password = form.elements.password.value;
      const account = readAccounts().find((item) => item.id === id);
      if (!account) throw new Error("ID ou senha incorretos.");
      const candidate = await hashPassword(password, hexToBytes(account.salt), account.iterations);
      if (!sameHash(candidate, account.passwordHash)) throw new Error("ID ou senha incorretos.");
      enterApp(id);
    } catch (error) {
      setAccessFeedback(error instanceof Error ? error.message : "Não foi possível entrar.", "error");
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = "Entrar";
      }
    }
  }

  async function handleRegistration(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const id = normalizeUserId(form.elements.id.value);
    const password = form.elements.password.value;
    if (!validUserId(id)) {
      setAccessFeedback("O ID deve ter de 3 a 32 caracteres: letras, números, ponto, _ ou -.", "error");
      return;
    }
    if (!validPassword(password)) {
      setAccessFeedback("A senha deve ter 10+ caracteres, incluindo maiúscula, minúscula, número e símbolo.", "error");
      return;
    }

    button.disabled = true;
    button.textContent = "Criando conta...";
    try {
      const accounts = readAccounts();
      if (accounts.some((account) => account.id === id)) {
        throw new Error("Esse ID já está cadastrado. Escolha outro ou entre na conta existente.");
      }
      if (!window.crypto || !window.crypto.subtle || !window.crypto.getRandomValues) {
        throw new Error("A criptografia local não está disponível. Abra o sistema pelo Live Server ou em HTTPS.");
      }
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const account = {
        id,
        salt: bytesToHex(salt),
        passwordHash: await hashPassword(password, salt, PASSWORD_HASH_ITERATIONS),
        iterations: PASSWORD_HASH_ITERATIONS
      };
      writeAccounts([...accounts, account]);
      enterApp(id);
    } catch (error) {
      setAccessFeedback(error instanceof Error ? error.message : "Não foi possível criar a conta.", "error");
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = "Criar conta e entrar";
      }
    }
  }

  function enterApp(id) {
    currentUserId = id;
    renderApp();
  }

  function logout() {
    if (marketRefreshTimer !== null) {
      window.clearInterval(marketRefreshTimer);
      marketRefreshTimer = null;
    }
    Object.keys(charts).forEach(destroyChart);
    currentUserId = "";
    latestResults = [];
    renderAccess("Você saiu da conta.", "success");
  }

  function renderApp() {
    const root = document.createElement("div");
    root.className = "app-shell";
    root.innerHTML = `
      <header class="topbar">
        <div class="brand"><span class="brand-mark">↗</span><span>InvestLab</span></div>
        <div class="account-actions"><span id="account-user" class="top-note"></span><button id="logout-button" class="logout-btn" type="button">Sair</button></div>
      </header>
      <main class="page">
        <section class="hero">
          <div>
            <span class="eyebrow">Planejamento financeiro</span>
            <h1>Seu futuro, em perspectiva.</h1>
            <p>Explore como aportes e diferentes hipóteses de rentabilidade podem influenciar seu patrimônio ao longo do tempo.</p>
          </div>
          <span class="demo-badge">Simulação educacional · valores hipotéticos</span>
        </section>

        <section class="layout" aria-label="Simulador e resultados">
          <form id="simulation-form" class="card panel">
            <h2 class="panel-title">Monte sua simulação</h2>
            <p class="panel-subtitle">Ajuste os valores e compare as modalidades sob as mesmas condições.</p>
            <div class="field">
              <label for="initial-value">Investimento inicial <span class="field-hint">R$</span></label>
              <div class="input-wrap"><span class="input-prefix">R$</span><input id="initial-value" class="with-prefix" type="number" min="0" step="100" value="5000" required></div>
            </div>
            <div class="field">
              <label for="monthly-value">Aporte mensal <span class="field-hint">R$</span></label>
              <div class="input-wrap"><span class="input-prefix">R$</span><input id="monthly-value" class="with-prefix" type="number" min="0" step="50" value="500" required></div>
            </div>
            <div class="field">
              <label for="period-years">Período <span class="field-hint">de 1 a 50 anos</span></label>
              <div class="input-wrap"><input id="period-years" class="with-suffix" type="number" min="1" max="50" step="1" value="20" required><span class="input-suffix">anos</span></div>
            </div>
            <div class="divider"></div>
            <p class="investments-heading">Rentabilidade anual hipotética</p>
            <div id="investment-options"></div>
            <button class="primary-btn" type="submit">Calcular comparação <span aria-hidden="true">→</span></button>
            <div id="form-message" class="message" role="status" aria-live="polite"></div>
          </form>

          <div class="results">
            <section class="kpis" aria-label="Resumo da simulação">
              <article class="card kpi"><span class="kpi-label">Maior patrimônio líquido estimado</span><strong id="kpi-total" class="kpi-value">—</strong><span id="kpi-product" class="kpi-caption">Execute uma simulação para ver resultados</span></article>
              <article class="card kpi"><span class="kpi-label">Total de aportes</span><strong id="kpi-invested" class="kpi-value">—</strong><span class="kpi-caption">Valor inicial + aportes mensais</span></article>
              <article class="card kpi"><span class="kpi-label">Rendimento estimado</span><strong id="kpi-earnings" class="kpi-value">—</strong><span class="kpi-caption">Após o imposto estimado, quando aplicável</span></article>
            </section>
            <section class="card chart-card">
              <div class="chart-head"><div><h2>Evolução do patrimônio</h2><p id="line-chart-caption">Projeção do cenário de maior patrimônio</p></div></div>
              <div class="chart-wrap"><canvas id="evolution-chart" aria-label="Gráfico de evolução do patrimônio"></canvas></div>
            </section>
            <section class="card table-card">
              <div class="chart-head"><div><h2>Comparação de modalidades</h2><p>Projeções com o mesmo valor inicial, aporte e prazo.</p></div></div>
              <div class="table-scroll">
                <table>
                  <thead><tr><th>Modalidade</th><th>Taxa anual</th><th>Patrimônio líquido</th><th>Rendimento líquido</th><th>IR estimado</th><th>Acumulado</th></tr></thead>
                  <tbody id="results-body"><tr><td colspan="6">Preencha os parâmetros e calcule para ver a comparação.</td></tr></tbody>
                </table>
              </div>
            </section>
            <div class="market-comparison-grid">
              <section class="card chart-card">
                <div class="chart-head"><div><h2>Patrimônio final por modalidade</h2><p>Comparação dos valores líquidos projetados.</p></div></div>
                <div class="chart-wrap short"><canvas id="comparison-chart" aria-label="Gráfico de comparação entre modalidades"></canvas></div>
              </section>
              <section class="card chart-card market-panel" aria-label="Cotações do mercado">
                <div class="chart-head">
                  <div><h2>Cotações do mercado</h2><p>Criptoativos com maior volume entre os acompanhados.</p></div>
                  <button id="refresh-market" class="market-refresh" type="button">Atualizar</button>
                </div>
                <div class="market-toolbar"><span id="market-status" class="market-status" role="status" aria-live="polite">Carregando cotações...</span></div>
                <div class="market-table-wrap">
                  <table class="market-table">
                    <thead><tr><th>Ativo / Volume 24h</th><th>Preço</th><th>Variação 24h</th></tr></thead>
                    <tbody id="market-quotes"><tr><td colspan="3">Buscando cotações...</td></tr></tbody>
                  </table>
                </div>
                <p class="market-disclaimer"><strong>Atenção:</strong> volume ou valorização recente não garantem retorno futuro. Criptoativos são voláteis e podem sofrer perdas. Não existe investimento que garanta retorno rápido e seguro.</p>
                <span class="market-source">Atualização a cada 60 segundos. Fonte: <a href="https://www.coingecko.com/" target="_blank" rel="noopener noreferrer">CoinGecko</a>. Pode haver atraso ou limite de consultas.</span>
              </section>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <div><h2>Histórico de simulações</h2><p>Salvo somente neste navegador. Selecione duas ou mais para comparar.</p></div>
            <div class="history-actions">
              <button id="compare-history" class="secondary-btn" type="button">Comparar selecionadas</button>
              <button id="save-simulation" class="primary-btn" type="button" style="width:auto">Salvar simulação</button>
              <form id="save-simulation-form" class="history-save-form" hidden>
                <label for="simulation-name">Nome da simulação</label>
                <input id="simulation-name" name="name" type="text" maxlength="60" required>
                <button class="primary-btn" type="submit">Confirmar</button>
                <button id="cancel-save-simulation" class="secondary-btn" type="button">Cancelar</button>
              </form>
            </div>
          </div>
          <div class="card panel">
            <div id="history-list" class="history-list"></div>
            <div id="history-chart-container" style="display:none; margin-top:18px">
              <div class="chart-head"><div><h2>Comparação de simulações salvas</h2><p>Patrimônio líquido estimado em cada cenário.</p></div></div>
              <div class="chart-wrap short"><canvas id="history-chart" aria-label="Gráfico de comparação de simulações salvas"></canvas></div>
            </div>
          </div>
        </section>

        <aside class="disclaimer">
          <strong>Aviso educacional:</strong> os resultados são estimativas baseadas nas hipóteses informadas e não representam garantia de rentabilidade, oferta de produtos ou recomendação de investimento. A rentabilidade real pode variar. A estimativa simplificada de IR usa a alíquota regressiva de referência para CDB/Tesouro sobre os rendimentos positivos, conforme o prazo total; não representa cálculo tributário individual. LCI/LCA são consideradas isentas nesta simulação. Custos, inflação, mudanças de taxas e regras tributárias não estão incluídos. A taxa de criptomoedas pode ser negativa.
          <span class="formula">Premissa: aportes no final de cada mês. VF = P(1+r)^n + A × ((1+r)^n − 1) / r; para r = 0, VF = P + A × n. Taxa mensal equivalente: r = (1 + taxa anual)^(1/12) − 1.</span>
        </aside>
      </main>`;
    document.body.replaceChildren(root);
    root.querySelector("#account-user").textContent = `Conta: ${currentUserId}`;

    const optionContainer = root.querySelector("#investment-options");
    investments.forEach((investment, index) => {
      const option = document.createElement("div");
      option.className = "investment-option";
      option.innerHTML = `
        <input type="checkbox" id="include-${investment.id}" data-investment="${investment.id}" ${index < 3 ? "checked" : ""} aria-label="Incluir ${investment.name} na comparação">
        <label for="include-${investment.id}"><span class="investment-name">${investment.name}</span><span class="investment-detail">${investment.detail}</span></label>
        <div class="rate-field"><input type="number" id="rate-${investment.id}" value="${investment.rate}" min="-99.9" max="1000" step="0.1" aria-label="Taxa anual hipotética de ${investment.name}"><span>% a.a.</span></div>`;
      optionContainer.appendChild(option);
    });

    root.querySelector("#simulation-form").addEventListener("submit", (event) => {
      event.preventDefault();
      runSimulation();
    });
    root.querySelector("#save-simulation").addEventListener("click", showSaveForm);
    root.querySelector("#save-simulation-form").addEventListener("submit", (event) => {
      event.preventDefault();
      saveSimulation();
    });
    root.querySelector("#cancel-save-simulation").addEventListener("click", hideSaveForm);
    root.querySelector("#logout-button").addEventListener("click", logout);
    root.querySelector("#compare-history").addEventListener("click", compareHistory);
    root.querySelector("#refresh-market").addEventListener("click", refreshMarketQuotes);
    renderHistory();
    runSimulation();
    refreshMarketQuotes();
    marketRefreshTimer = window.setInterval(refreshMarketQuotes, 60000);
  }

  function formatMarketVolume(value) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: "compact",
      maximumFractionDigits: 2
    }).format(value);
  }

  async function refreshMarketQuotes() {
    if (marketFetchInProgress) return;
    marketFetchInProgress = true;
    const status = document.querySelector("#market-status");
    const refreshButton = document.querySelector("#refresh-market");
    const quotesBody = document.querySelector("#market-quotes");
    status.className = "market-status";
    status.textContent = "Buscando cotações...";
    refreshButton.disabled = true;

    try {
      const url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=brl&ids=bitcoin%2Cethereum%2Csolana&order=volume_desc&per_page=3&page=1&sparkline=false&price_change_percentage=24h";
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error(response.status === 429
          ? "Limite de consultas da API atingido. Aguarde um pouco e tente novamente."
          : `A API respondeu com erro (${response.status}).`);
      }
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("A API não retornou cotações para os ativos consultados.");
      }

      data.sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0));
      quotesBody.replaceChildren();
      data.forEach((asset) => {
        const row = document.createElement("tr");
        const assetCell = document.createElement("td");
        assetCell.className = "market-asset";
        assetCell.textContent = asset.name || "Ativo";
        const symbol = document.createElement("span");
        symbol.className = "market-symbol";
        symbol.textContent = asset.symbol || "";
        assetCell.appendChild(symbol);
        const volume = document.createElement("span");
        volume.className = "market-volume";
        volume.textContent = `Volume: ${Number.isFinite(asset.total_volume) ? formatMarketVolume(asset.total_volume) : "Indisponível"}`;
        assetCell.appendChild(volume);

        const priceCell = document.createElement("td");
        priceCell.textContent = Number.isFinite(asset.current_price)
          ? currency.format(asset.current_price)
          : "Indisponível";

        const changeCell = document.createElement("td");
        const change = asset.price_change_percentage_24h;
        if (Number.isFinite(change)) {
          changeCell.textContent = `${change > 0 ? "+" : ""}${percent.format(change)}%`;
          changeCell.className = change >= 0 ? "return-positive" : "return-negative";
        } else {
          changeCell.textContent = "Indisponível";
        }

        row.append(assetCell, priceCell, changeCell);
        quotesBody.appendChild(row);
      });

      const updatedAt = new Date();
      status.textContent = `Consultado em ${updatedAt.toLocaleTimeString("pt-BR")}.`;
    } catch (error) {
      console.error("Falha ao consultar cotações:", error);
      status.className = "market-status error";
      status.textContent = error instanceof Error
        ? `${error.message} Confira sua conexão e tente novamente.`
        : "Não foi possível carregar as cotações. Confira sua conexão e tente novamente.";
      if (!quotesBody.rows.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 3;
        cell.textContent = "Cotações indisponíveis no momento.";
        row.appendChild(cell);
        quotesBody.appendChild(row);
      }
    } finally {
      marketFetchInProgress = false;
      refreshButton.disabled = false;
    }
  }

  function annualTaxRate(months) {
    if (months <= 6) return 0.225;
    if (months <= 12) return 0.20;
    if (months <= 24) return 0.175;
    return 0.15;
  }

  function calculateInvestment(investment, annualRate, initial, monthly, months) {
    const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
    let balance = initial;
    const points = [{ month: 0, balance: initial }];

    for (let month = 1; month <= months; month += 1) {
      balance *= 1 + monthlyRate;
      balance += monthly;
      if (month % 12 === 0 || month === months) {
        points.push({ month, balance });
      }
    }

    const contributed = initial + monthly * months;
    const grossEarnings = balance - contributed;
    const tax = investment.taxable && grossEarnings > 0
      ? grossEarnings * annualTaxRate(months)
      : 0;
    const netBalance = balance - tax;

    return {
      ...investment,
      annualRate,
      months,
      contributed,
      grossBalance: balance,
      tax,
      netBalance,
      netEarnings: netBalance - contributed,
      accumulatedReturn: contributed > 0 ? (netBalance / contributed - 1) * 100 : 0,
      points: points.map((point) => {
        const investedAtPoint = initial + monthly * point.month;
        const gain = point.balance - investedAtPoint;
        const estimatedTax = investment.taxable && gain > 0
          ? gain * annualTaxRate(point.month)
          : 0;
        return { month: point.month, balance: point.balance - estimatedTax };
      })
    };
  }

  function showMessage(message, type) {
    const element = document.querySelector("#form-message");
    element.textContent = message;
    element.className = `message ${type}`;
  }

  function invalidateSimulation(message) {
    latestResults = [];
    document.querySelector("#kpi-total").textContent = "—";
    document.querySelector("#kpi-product").textContent = "Corrija os parâmetros para ver resultados";
    document.querySelector("#kpi-invested").textContent = "—";
    document.querySelector("#kpi-earnings").textContent = "—";
    const body = document.querySelector("#results-body");
    body.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "Corrija os parâmetros para atualizar a comparação.";
    row.appendChild(cell);
    body.appendChild(row);
    destroyChart("evolution");
    destroyChart("comparison");
    showMessage(message, "error");
  }

  function runSimulation() {
    latestResults = [];
    const initial = Number(document.querySelector("#initial-value").value);
    const monthly = Number(document.querySelector("#monthly-value").value);
    const years = Number(document.querySelector("#period-years").value);
    const months = years * 12;
    const selected = investments.filter((investment) => {
      return document.querySelector(`#include-${investment.id}`).checked;
    });

    if (!Number.isFinite(initial) || initial < 0 || !Number.isFinite(monthly) || monthly < 0) {
      invalidateSimulation("Informe valores iniciais e aportes válidos, iguais ou maiores que zero.");
      return;
    }
    if (!Number.isInteger(years) || years < 1 || years > 50) {
      invalidateSimulation("O período deve ser um número inteiro entre 1 e 50 anos.");
      return;
    }
    if (selected.length < 3) {
      invalidateSimulation("Selecione pelo menos três modalidades para comparar.");
      return;
    }

    const rates = {};
    for (const investment of selected) {
      const rate = Number(document.querySelector(`#rate-${investment.id}`).value);
      if (!Number.isFinite(rate) || rate <= -100 || rate > 1000) {
        invalidateSimulation(`Informe uma taxa anual válida para ${investment.name}, maior que -100% e até 1000%.`);
        return;
      }
      rates[investment.id] = rate;
    }

    latestResults = selected
      .map((investment) => calculateInvestment(investment, rates[investment.id], initial, monthly, months))
      .sort((a, b) => b.netBalance - a.netBalance);
    showMessage("Simulação atualizada. Os resultados são estimativas hipotéticas.", "success");
    renderResults(initial, monthly, years);
  }

  function renderResults() {
    if (!latestResults.length) return;
    const best = latestResults[0];
    document.querySelector("#kpi-total").textContent = currency.format(best.netBalance);
    document.querySelector("#kpi-product").textContent = `Maior projeção: ${best.name}`;
    document.querySelector("#kpi-invested").textContent = currency.format(best.contributed);
    document.querySelector("#kpi-earnings").textContent = currency.format(best.netEarnings);
    document.querySelector("#line-chart-caption").textContent = `Cenário de ${best.name} · taxa hipotética de ${percent.format(best.annualRate)}% a.a.`;

    const tbody = document.querySelector("#results-body");
    tbody.replaceChildren();
    latestResults.forEach((result) => {
      const row = document.createElement("tr");
      const earningsClass = result.netEarnings >= 0 ? "return-positive" : "return-negative";
      const cells = [
        `<span class="product-cell"><span class="dot" style="background:${result.color}"></span>${result.name}</span>`,
        `${percent.format(result.annualRate)}%`,
        `<span class="value-strong">${currency.format(result.netBalance)}</span>`,
        `<span class="${earningsClass}">${currency.format(result.netEarnings)}</span>`,
        currency.format(result.tax),
        `<span class="${result.accumulatedReturn >= 0 ? "return-positive" : "return-negative"}">${percent.format(result.accumulatedReturn)}%</span>`
      ];
      cells.forEach((value) => {
        const cell = document.createElement("td");
        cell.innerHTML = value;
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    });
    drawCharts();
  }

  function chartOptions(formatTooltip) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => formatTooltip(context.parsed.y) } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#858d9d", maxTicksLimit: 8, font: { size: 10 } }, border: { display: false } },
        y: {
          grid: { color: "#edf0f5" },
          ticks: { color: "#858d9d", font: { size: 10 }, callback: (value) => compactCurrency(value) },
          border: { display: false }
        }
      }
    };
  }

  function compactCurrency(value) {
    if (Math.abs(value) >= 1000000) return `R$ ${(value / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
    if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
    return currency.format(value);
  }

  function destroyChart(name) {
    if (charts[name]) {
      charts[name].destroy();
      delete charts[name];
    }
  }

  function drawCharts() {
    if (!window.Chart || !latestResults.length) return;
    const best = latestResults[0];
    const labels = best.points.map((point) => point.month === 0 ? "Início" : `${point.month / 12} ano${point.month / 12 === 1 ? "" : "s"}`);
    destroyChart("evolution");
    charts.evolution = new Chart(document.querySelector("#evolution-chart"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          data: best.points.map((point) => point.balance),
          borderColor: best.color,
          backgroundColor: `${best.color}20`,
          fill: true,
          tension: 0.32,
          pointRadius: 2,
          pointHoverRadius: 5,
          borderWidth: 2.5
        }]
      },
      options: chartOptions((value) => currency.format(value))
    });

    destroyChart("comparison");
    charts.comparison = new Chart(document.querySelector("#comparison-chart"), {
      type: "bar",
      data: {
        labels: latestResults.map((result) => result.name),
        datasets: [{
          data: latestResults.map((result) => result.netBalance),
          backgroundColor: latestResults.map((result) => `${result.color}d9`),
          borderRadius: 7,
          maxBarThickness: 48
        }]
      },
      options: {
        ...chartOptions((value) => currency.format(value)),
        scales: {
          ...chartOptions((value) => currency.format(value)).scales,
          x: { ...chartOptions((value) => currency.format(value)).scales.x, ticks: { color: "#697286", font: { size: 10 } } }
        }
      }
    });
  }

  function readHistory() {
    try {
      const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEY}:${encodeURIComponent(currentUserId)}`) || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch (error) {
      console.error("Não foi possível ler o histórico de simulações:", error);
      return [];
    }
  }

  function writeHistory(history) {
    try {
      localStorage.setItem(`${STORAGE_KEY}:${encodeURIComponent(currentUserId)}`, JSON.stringify(history));
      return true;
    } catch (error) {
      console.error("Não foi possível salvar o histórico de simulações:", error);
      showMessage("Não foi possível salvar. Verifique o espaço disponível no navegador.", "error");
      return false;
    }
  }

  function saveSimulation() {
    if (!latestResults.length) {
      showMessage("Faça uma simulação válida antes de salvá-la.", "error");
      return;
    }
    const form = document.querySelector("#save-simulation-form");
    const nameInput = document.querySelector("#simulation-name");
    const name = nameInput.value.trim();
    if (!name) {
      showMessage("Digite um nome para salvar a simulação.", "error");
      nameInput.focus();
      return;
    }

    const history = readHistory();
    history.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      savedAt: new Date().toISOString(),
      initial: Number(document.querySelector("#initial-value").value),
      monthly: Number(document.querySelector("#monthly-value").value),
      years: Number(document.querySelector("#period-years").value),
      results: latestResults.map(({ id, name: investmentName, annualRate, netBalance, contributed, netEarnings, tax }) => ({
        id, name: investmentName, annualRate, netBalance, contributed, netEarnings, tax
      }))
    });
    if (writeHistory(history)) {
      renderHistory();
      form.reset();
      form.hidden = true;
      showMessage("Simulação salva neste navegador.", "success");
    }
  }

  function showSaveForm() {
    const form = document.querySelector("#save-simulation-form");
    form.hidden = false;
    document.querySelector("#simulation-name").focus();
  }

  function hideSaveForm() {
    const form = document.querySelector("#save-simulation-form");
    form.reset();
    form.hidden = true;
  }

  function renderHistory() {
    const container = document.querySelector("#history-list");
    const history = readHistory();
    container.replaceChildren();
    if (!history.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Você ainda não salvou simulações. Execute um cenário e clique em “Salvar simulação”.";
      container.appendChild(empty);
      document.querySelector("#history-chart-container").style.display = "none";
      return;
    }

    history.forEach((simulation) => {
      const best = Array.isArray(simulation.results)
        ? simulation.results.reduce((winner, result) => !winner || result.netBalance > winner.netBalance ? result : winner, null)
        : null;
      const item = document.createElement("article");
      item.className = "history-item";
      const main = document.createElement("label");
      main.className = "history-main";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.historyId = simulation.id;
      checkbox.setAttribute("aria-label", `Selecionar ${simulation.name} para comparar`);
      const description = document.createElement("span");
      const title = document.createElement("span");
      title.className = "history-title";
      title.textContent = simulation.name;
      const meta = document.createElement("span");
      meta.className = "history-meta";
      meta.textContent = `${simulation.years} anos · inicial ${currency.format(simulation.initial)} · aporte ${currency.format(simulation.monthly)} · ${new Date(simulation.savedAt).toLocaleDateString("pt-BR")}`;
      description.append(title, meta);
      main.append(checkbox, description);
      const total = document.createElement("span");
      total.className = "history-total";
      total.textContent = best ? currency.format(best.netBalance) : "—";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "danger-btn";
      remove.textContent = "Excluir";
      remove.setAttribute("aria-label", `Excluir simulação ${simulation.name}`);
      remove.addEventListener("click", () => deleteSimulation(simulation.id));
      item.append(main, total, remove);
      container.appendChild(item);
    });
  }

  function deleteSimulation(id) {
    const history = readHistory().filter((simulation) => simulation.id !== id);
    if (writeHistory(history)) {
      renderHistory();
      if (charts.history) {
        destroyChart("history");
        document.querySelector("#history-chart-container").style.display = "none";
      }
    }
  }

  function compareHistory() {
    const ids = Array.from(document.querySelectorAll("[data-history-id]:checked")).map((checkbox) => checkbox.dataset.historyId);
    if (ids.length < 2) {
      showMessage("Selecione pelo menos duas simulações salvas para compará-las.", "error");
      return;
    }
    const selected = readHistory().filter((simulation) => ids.includes(simulation.id));
    const labels = [];
    const values = [];
    const colors = [];
    selected.forEach((simulation) => {
      const best = simulation.results.reduce((winner, result) => !winner || result.netBalance > winner.netBalance ? result : winner, null);
      labels.push(simulation.name);
      values.push(best ? best.netBalance : 0);
      const product = investments.find((investment) => best && investment.id === best.id);
      colors.push(product ? `${product.color}d9` : "#6874ed");
    });
    if (!window.Chart) {
      showMessage("A biblioteca de gráficos ainda está carregando. Tente novamente em instantes.", "error");
      return;
    }
    document.querySelector("#history-chart-container").style.display = "block";
    destroyChart("history");
    charts.history = new Chart(document.querySelector("#history-chart"), {
      type: "bar",
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 7, maxBarThickness: 52 }] },
      options: chartOptions((value) => currency.format(value))
    });
    document.querySelector("#history-chart-container").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function start() {
    installStyles();
    const chartScript = document.querySelector('script[src="https://cdn.jsdelivr.net/npm/chart.js"]');
    if (chartScript) {
      chartScript.addEventListener("load", () => {
        if (latestResults.length) drawCharts();
      });
      chartScript.addEventListener("error", () => {
        const message = "Não foi possível carregar os gráficos. Verifique sua conexão com a internet.";
        if (document.querySelector("#form-message")) showMessage(message, "error");
        else setAccessFeedback(message, "error");
      });
    }
    renderAccess();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
