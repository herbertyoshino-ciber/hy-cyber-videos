import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection,
  getDocs, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, NOME_DO_APP, SUBTITULO_DO_APP } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const tela = document.getElementById("tela");
const menu = document.getElementById("menu");
const linkAdmin = document.getElementById("link-admin");
document.getElementById("nome-app").textContent = NOME_DO_APP;
document.getElementById("subtitulo-app").textContent = SUBTITULO_DO_APP;
document.title = `${NOME_DO_APP} — ${SUBTITULO_DO_APP}`;

let usuario = null;   // usuário do Firebase Auth
let perfil = null;    // documento em /usuarios
let admin = false;

// ---------- utilitários ----------

// Cria elementos sem usar innerHTML (evita injeção de código).
function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "texto") e.textContent = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const f of filhos.flat()) {
    if (f === null || f === undefined || f === false) continue;
    e.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return e;
}

function mostrar(...conteudo) {
  tela.replaceChildren(...conteudo);
  window.scrollTo(0, 0);
}

function aviso(texto, tipo = "erro") {
  return el("p", { class: `aviso ${tipo}`, role: "alert", texto });
}

function campo(rotulo, attrs) {
  return el("label", { class: "campo" }, el("span", { texto: rotulo }), el("input", attrs));
}

const ERROS = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/user-disabled": "Esta conta foi desativada.",
  "auth/email-already-in-use": "Já existe uma conta com este e-mail.",
  "auth/weak-password": "A senha precisa ter pelo menos 8 caracteres.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos.",
  "auth/network-request-failed": "Sem conexão. Verifique sua internet.",
  "permission-denied": "Você não tem permissão para isso."
};
const msgErro = (e) => ERROS[e?.code] || "Algo deu errado. Tente de novo.";

// Aceita link do YouTube (watch, youtu.be, shorts, embed) ou só o ID.
function extrairIdYoutube(texto) {
  const t = texto.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  try {
    const u = new URL(t);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id = null;
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
      id = u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop();
    }
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id.slice(0, 11))) return id.slice(0, 11);
  } catch { /* não é URL */ }
  return null;
}

async function carregarVideos() {
  const snap = await getDocs(query(collection(db, "videos"), orderBy("ordem")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- telas públicas ----------

function telaLogin() {
  const msg = el("div");
  const form = el("form", { class: "cartao", novalidate: true },
    el("h1", { texto: "Entrar" }),
    el("p", { class: "sub", texto: "Acesse os vídeos de segurança cibernética." }),
    campo("E-mail", { type: "email", name: "email", autocomplete: "email", required: true }),
    campo("Senha", { type: "password", name: "senha", autocomplete: "current-password", required: true }),
    msg,
    el("button", { class: "btn", type: "submit", texto: "Entrar" }),
    el("div", { class: "links" },
      el("a", { href: "#/cadastro", texto: "Criar conta" }),
      el("button", { type: "button", class: "btn-link", texto: "Esqueci minha senha", onclick: esqueci })
    )
  );

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = new FormData(form);
    msg.replaceChildren();
    try {
      await signInWithEmailAndPassword(auth, f.get("email").trim(), f.get("senha"));
    } catch (e) {
      msg.replaceChildren(aviso(msgErro(e)));
    }
  });

  async function esqueci() {
    const email = new FormData(form).get("email").trim();
    if (!email) return msg.replaceChildren(aviso("Digite seu e-mail acima primeiro."));
    try { await sendPasswordResetEmail(auth, email); } catch { /* não revela se o e-mail existe */ }
    msg.replaceChildren(aviso("Se o e-mail estiver cadastrado, você vai receber um link para trocar a senha.", "ok"));
  }

  mostrar(form);
}

function telaCadastro() {
  const msg = el("div");
  const form = el("form", { class: "cartao", novalidate: true },
    el("h1", { texto: "Criar conta" }),
    campo("Nome", { type: "text", name: "nome", maxlength: "80", autocomplete: "name", required: true }),
    campo("E-mail", { type: "email", name: "email", autocomplete: "email", required: true }),
    campo("Senha (mínimo 8 caracteres)", { type: "password", name: "senha", minlength: "8", autocomplete: "new-password", required: true }),
    campo("Repita a senha", { type: "password", name: "senha2", autocomplete: "new-password", required: true }),
    msg,
    el("button", { class: "btn", type: "submit", texto: "Criar conta" }),
    el("div", { class: "links" }, el("a", { href: "#/login", texto: "Já tenho conta" }))
  );

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = new FormData(form);
    const nome = f.get("nome").trim();
    msg.replaceChildren();
    if (!nome) return msg.replaceChildren(aviso("Digite seu nome."));
    if (f.get("senha").length < 8) return msg.replaceChildren(aviso(ERROS["auth/weak-password"]));
    if (f.get("senha") !== f.get("senha2")) return msg.replaceChildren(aviso("As senhas não são iguais."));
    try {
      sessionStorage.setItem("nomeCadastro", nome);
      await createUserWithEmailAndPassword(auth, f.get("email").trim(), f.get("senha"));
    } catch (e) {
      msg.replaceChildren(aviso(msgErro(e)));
    }
  });

  mostrar(form);
}

function telaRevogado() {
  mostrar(el("div", { class: "cartao" },
    el("h1", { texto: "Acesso suspenso" }),
    el("p", { texto: "Seu acesso aos vídeos foi suspenso pelo administrador. Se acha que é um engano, entre em contato." }),
    el("button", { class: "btn", texto: "Sair", onclick: () => signOut(auth) })
  ));
}

// ---------- telas de membro ----------

async function telaVideos() {
  mostrar(el("p", { class: "carregando", texto: "Carregando vídeos…" }));
  let videos;
  try { videos = await carregarVideos(); }
  catch (e) { return mostrar(aviso(msgErro(e))); }

  const titulo = el("div", { class: "cabecalho" },
    el("h1", { texto: `Olá, ${perfil?.nome || ""}`.trim() }),
    el("p", { class: "sub", texto: "Escolha um vídeo para assistir." })
  );

  if (!videos.length) {
    return mostrar(titulo, el("p", { class: "vazio", texto: admin
      ? "Nenhum vídeo ainda. Vá em Admin para adicionar o primeiro."
      : "Nenhum vídeo publicado ainda. Volte em breve." }));
  }

  const busca = el("input", { type: "search", class: "busca", placeholder: "Buscar vídeo…", "aria-label": "Buscar vídeo" });
  const lista = el("div");

  function render() {
    const termo = busca.value.trim().toLowerCase();
    const filtrados = videos.filter((v) =>
      !termo || `${v.titulo} ${v.descricao} ${v.categoria}`.toLowerCase().includes(termo));
    const grupos = new Map();
    for (const v of filtrados) {
      const cat = v.categoria || "Geral";
      if (!grupos.has(cat)) grupos.set(cat, []);
      grupos.get(cat).push(v);
    }
    lista.replaceChildren(...[...grupos].map(([cat, vs]) => el("section", { class: "grupo" },
      el("h2", { texto: cat }),
      el("div", { class: "grade" }, vs.map((v) => el("a", { class: "card", href: `#/video/${v.id}` },
        el("img", { src: `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`, alt: "", loading: "lazy" }),
        el("div", { class: "card-txt" },
          el("h3", { texto: v.titulo }),
          v.descricao ? el("p", { texto: v.descricao }) : null)
      )))
    )));
    if (!filtrados.length) lista.replaceChildren(el("p", { class: "vazio", texto: "Nada encontrado." }));
  }

  busca.addEventListener("input", render);
  render();
  mostrar(titulo, busca, lista);
}

async function telaVideo(id) {
  mostrar(el("p", { class: "carregando", texto: "Carregando…" }));
  let snap;
  try { snap = await getDoc(doc(db, "videos", id)); }
  catch (e) { return mostrar(aviso(msgErro(e))); }
  if (!snap.exists()) return mostrar(aviso("Vídeo não encontrado."), el("a", { href: "#/videos", texto: "← Voltar" }));

  const v = snap.data();
  const src = `https://www.youtube-nocookie.com/embed/${v.youtubeId}?rel=0&modestbranding=1`;
  mostrar(
    el("a", { href: "#/videos", class: "voltar", texto: "← Todos os vídeos" }),
    el("div", { class: "player" }, el("iframe", {
      src, title: v.titulo, allowfullscreen: true, referrerpolicy: "strict-origin-when-cross-origin",
      allow: "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
    })),
    el("p", { class: "tag", texto: v.categoria || "Geral" }),
    el("h1", { texto: v.titulo }),
    v.descricao ? el("p", { class: "descricao", texto: v.descricao }) : null
  );
}

// ---------- painel do admin ----------

async function telaAdmin() {
  if (!admin) { location.hash = "#/videos"; return; }

  const msg = el("div");
  let editando = null;
  const form = el("form", { class: "cartao largo", novalidate: true },
    el("h2", { id: "titulo-form", texto: "Adicionar vídeo" }),
    campo("Link do YouTube (não listado)", { name: "link", required: true, placeholder: "https://youtu.be/…" }),
    campo("Título", { name: "titulo", maxlength: "150", required: true }),
    el("label", { class: "campo" }, el("span", { texto: "Descrição" }),
      el("textarea", { name: "descricao", maxlength: "5000", rows: "4" })),
    el("div", { class: "linha" },
      campo("Categoria", { name: "categoria", maxlength: "60", placeholder: "Ex.: Phishing", list: "cats" }),
      campo("Ordem", { name: "ordem", type: "number", step: "1", value: "0" })),
    el("datalist", { id: "cats" }),
    msg,
    el("div", { class: "linha" },
      el("button", { class: "btn", type: "submit", id: "btn-salvar", texto: "Salvar vídeo" }),
      el("button", { class: "btn sec", type: "button", id: "btn-cancelar", hidden: true, texto: "Cancelar edição", onclick: limpar }))
  );

  const listaVideos = el("div", { class: "tabela" });
  const listaUsuarios = el("div", { class: "tabela" });
  const buscaUsuario = el("input", { type: "search", class: "busca", placeholder: "Buscar por nome ou e-mail…", "aria-label": "Buscar usuário" });

  function limpar() {
    editando = null;
    form.reset();
    form.ordem.value = "0";
    form.querySelector("#titulo-form").textContent = "Adicionar vídeo";
    form.querySelector("#btn-cancelar").hidden = true;
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    msg.replaceChildren();
    const f = new FormData(form);
    const youtubeId = extrairIdYoutube(f.get("link") || "");
    const titulo = f.get("titulo").trim();
    const ordem = parseInt(f.get("ordem"), 10);
    if (!youtubeId) return msg.replaceChildren(aviso("Link do YouTube inválido."));
    if (!titulo) return msg.replaceChildren(aviso("Digite um título."));
    const dados = {
      titulo,
      descricao: f.get("descricao").trim(),
      categoria: f.get("categoria").trim() || "Geral",
      ordem: Number.isFinite(ordem) ? ordem : 0,
      youtubeId
    };
    try {
      if (editando) await updateDoc(doc(db, "videos", editando), dados);
      else await addDoc(collection(db, "videos"), { ...dados, criadoEm: serverTimestamp() });
      limpar();
      msg.replaceChildren(aviso("Vídeo salvo.", "ok"));
      await renderVideos();
    } catch (e) {
      msg.replaceChildren(aviso(msgErro(e)));
    }
  });

  async function renderVideos() {
    const videos = await carregarVideos();
    form.querySelector("#cats").replaceChildren(
      ...[...new Set(videos.map((v) => v.categoria))].map((c) => el("option", { value: c })));
    if (!videos.length) return listaVideos.replaceChildren(el("p", { class: "vazio", texto: "Nenhum vídeo ainda." }));
    listaVideos.replaceChildren(...videos.map((v) => el("div", { class: "item" },
      el("img", { src: `https://i.ytimg.com/vi/${v.youtubeId}/default.jpg`, alt: "" }),
      el("div", { class: "item-txt" },
        el("strong", { texto: v.titulo }),
        el("small", { texto: `${v.categoria} · ordem ${v.ordem}` })),
      el("div", { class: "acoes" },
        el("button", { class: "btn-link", texto: "Editar", onclick: () => {
          editando = v.id;
          form.link.value = `https://youtu.be/${v.youtubeId}`;
          form.titulo.value = v.titulo;
          form.descricao.value = v.descricao || "";
          form.categoria.value = v.categoria || "";
          form.ordem.value = v.ordem ?? 0;
          form.querySelector("#titulo-form").textContent = "Editar vídeo";
          form.querySelector("#btn-cancelar").hidden = false;
          form.scrollIntoView({ behavior: "smooth" });
        } }),
        el("button", { class: "btn-link perigo", texto: "Excluir", onclick: async () => {
          if (!confirm(`Excluir "${v.titulo}"?`)) return;
          try { await deleteDoc(doc(db, "videos", v.id)); await renderVideos(); }
          catch (e) { alert(msgErro(e)); }
        } }))
    )));
  }

  let usuarios = [];
  async function carregarUsuarios() {
    const snap = await getDocs(query(collection(db, "usuarios"), orderBy("criadoEm", "desc")));
    usuarios = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderUsuarios();
  }

  function renderUsuarios() {
    const termo = buscaUsuario.value.trim().toLowerCase();
    const lista = usuarios.filter((u) => !termo || `${u.nome} ${u.email}`.toLowerCase().includes(termo));
    if (!lista.length) return listaUsuarios.replaceChildren(el("p", { class: "vazio", texto: "Nenhum usuário." }));
    listaUsuarios.replaceChildren(...lista.map((u) => {
      const data = u.criadoEm?.toDate ? u.criadoEm.toDate().toLocaleDateString("pt-BR") : "";
      const souEu = u.id === usuario.uid;
      return el("div", { class: `item ${u.revogado ? "revogado" : ""}` },
        el("div", { class: "item-txt" },
          el("strong", { texto: u.nome || "(sem nome)" }),
          el("small", { texto: `${u.email} · desde ${data}` })),
        el("div", { class: "acoes" },
          el("span", { class: `status ${u.revogado ? "off" : "on"}`, texto: u.revogado ? "Revogado" : "Ativo" }),
          souEu ? null : el("button", {
            class: `btn-link ${u.revogado ? "" : "perigo"}`,
            texto: u.revogado ? "Restaurar" : "Revogar",
            onclick: async () => {
              const novo = !u.revogado;
              if (novo && !confirm(`Revogar o acesso de ${u.nome || u.email}?`)) return;
              try {
                await updateDoc(doc(db, "usuarios", u.id), { revogado: novo });
                u.revogado = novo;
                renderUsuarios();
              } catch (e) { alert(msgErro(e)); }
            }
          }))
      );
    }));
  }
  buscaUsuario.addEventListener("input", renderUsuarios);

  mostrar(
    el("div", { class: "cabecalho" }, el("h1", { texto: "Painel do administrador" })),
    form,
    el("section", { class: "grupo" }, el("h2", { texto: "Vídeos publicados" }), listaVideos),
    el("section", { class: "grupo" }, el("h2", { texto: "Usuários" }), buscaUsuario, listaUsuarios)
  );

  try { await Promise.all([renderVideos(), carregarUsuarios()]); }
  catch (e) { msg.replaceChildren(aviso(msgErro(e))); }
}

// ---------- navegação ----------

function rotear() {
  const [, rota, param] = (location.hash || "#/").split("/");
  if (!usuario) {
    menu.hidden = true;
    return rota === "cadastro" ? telaCadastro() : telaLogin();
  }
  menu.hidden = false;
  linkAdmin.hidden = !admin;
  if (perfil?.revogado && !admin) return telaRevogado();
  if (rota === "video" && param) return telaVideo(decodeURIComponent(param));
  if (rota === "admin") return telaAdmin();
  if (rota !== "videos") { location.hash = "#/videos"; return; }
  return telaVideos();
}

async function garantirPerfil(u) {
  const ref = doc(db, "usuarios", u.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  const nome = (sessionStorage.getItem("nomeCadastro") || u.email.split("@")[0]).slice(0, 80);
  sessionStorage.removeItem("nomeCadastro");
  const dados = { nome, email: u.email, criadoEm: serverTimestamp(), revogado: false };
  await setDoc(ref, dados);
  return dados;
}

onAuthStateChanged(auth, async (u) => {
  usuario = u;
  perfil = null;
  admin = false;
  if (u) {
    mostrar(el("p", { class: "carregando", texto: "Verificando acesso…" }));
    try {
      const [p, a] = await Promise.all([garantirPerfil(u), getDoc(doc(db, "admins", u.uid))]);
      perfil = p;
      admin = a.exists();
    } catch (e) {
      return mostrar(aviso(msgErro(e)), el("button", { class: "btn", texto: "Sair", onclick: () => signOut(auth) }));
    }
    if (!location.hash || location.hash.startsWith("#/login") || location.hash.startsWith("#/cadastro")) {
      location.hash = "#/videos";
      return; // o hashchange chama rotear()
    }
  }
  rotear();
});

window.addEventListener("hashchange", rotear);
document.getElementById("btn-sair").addEventListener("click", async () => {
  await signOut(auth);
  location.hash = "#/login";
});
