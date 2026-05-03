/* ─── StockPilot Dashboard - Core ─────────────────────── */
const THEME_KEY="stockpilot-theme";
const S={user:null,groups:[],invites:[],currentView:"home",currentGroup:null,groupData:null,personalProducts:[],personalMovements:[],groupTab:"overview"};

function fmt$(v){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(v)}
function fmtD(v){return new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short"}).format(new Date(v))}
function setStatus(msg,tone=""){const el=document.getElementById("status-banner");el.textContent=msg;el.className="status-banner";if(tone)el.classList.add(`status-banner--${tone}`);setTimeout(()=>el.classList.add("status-banner--hidden"),4000)}
async function api(path,opts={}){const res=await fetch(path,{headers:{"Content-Type":"application/json",...(opts.headers||{})},...opts});const data=res.headers.get("content-type")?.includes("json")?await res.json():null;if(!res.ok)throw new Error(data?.message||"Request failed");return data}

/* ─── Theme ───────────────────────────────────────────── */
function resolveTheme(){const s=localStorage.getItem(THEME_KEY);return(s==="light"||s==="dark")?s:"dark"}
function applyTheme(t){document.documentElement.dataset.theme=t;localStorage.setItem(THEME_KEY,t)}
document.getElementById("theme-toggle").addEventListener("click",()=>{applyTheme(document.documentElement.dataset.theme==="dark"?"light":"dark")});
document.getElementById("logout-btn").addEventListener("click",async()=>{await fetch("/api/auth/logout",{method:"POST"});window.location.href="/login.html"});

/* ─── Views ───────────────────────────────────────────── */
function showView(v){
  S.currentView=v;
  document.getElementById("view-home").style.display=v==="home"?"block":"none";
  document.getElementById("view-group").style.display=v==="group"?"block":"none";
  document.getElementById("view-personal").style.display=v==="personal"?"block":"none";
  const tn=document.getElementById("tab-nav");
  const mn=document.getElementById("mobile-nav");
  if(v==="group"){
    const tabs = ["overview","inventory","movements","members","requests","logs"];
    tn.innerHTML=tabs.map(t=>`<button class="tab-nav-btn" data-tab="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</button>`).join("");
    if (mn) { mn.innerHTML=tabs.map(t=>`<button class="tab-nav-btn" data-tab="${t}"><span class="nav-icon">°</span>${t.charAt(0).toUpperCase()+t.slice(1)}</button>`).join(""); mn.style.display="flex"; }
    switchGroupTab(S.groupTab||"overview");
  } else {
    tn.innerHTML="";
    if(mn) mn.style.display="none";
  }
  window.scrollTo({top:0,behavior:"smooth"});
}

function switchGroupTab(tab){
  S.groupTab=tab;
  document.querySelectorAll("#view-group .tab-content").forEach(el=>{el.classList.toggle("tab-content--active",el.id===`tab-${tab}`)});
  document.querySelectorAll("#tab-nav .tab-nav-btn, #mobile-nav .tab-nav-btn").forEach(b=>{b.classList.toggle("tab-bar__btn--active",b.dataset.tab===tab)});
}
document.getElementById("tab-nav").addEventListener("click",e=>{const b=e.target.closest("[data-tab]");if(b)switchGroupTab(b.dataset.tab)});
const mnEvent = document.getElementById("mobile-nav");
if (mnEvent) mnEvent.addEventListener("click",e=>{const b=e.target.closest("[data-tab]");if(b)switchGroupTab(b.dataset.tab)});
document.getElementById("nav-home-btn").addEventListener("click",()=>{showView("home");loadHome()});

/* ─── HOME ────────────────────────────────────────────── */
async function loadHome(){
  try{
    const[me,gd,inv]=await Promise.all([api("/api/auth/me"),api("/api/groups"),api("/api/invites")]);
    S.user=me.user;S.groups=gd.groups;S.invites=inv.invites;
    document.getElementById("user-name").textContent=S.user.name;
    renderProfile();renderGroups();renderInvites();loadPersonalStats();
  }catch(err){setStatus(err.message,"error")}
}

function renderProfile(){
  document.getElementById("profile-name").textContent=S.user.name;
  document.getElementById("profile-email").textContent=S.user.email;
  document.getElementById("profile-bio").textContent=S.user.bio||"No bio set";
}

function renderGroups(){
  const el=document.getElementById("groups-grid");
  if(!S.groups.length){el.innerHTML=`<div class="empty-state"><strong>No workspaces yet</strong><p>Create a workspace to collaborate with others.</p></div>`;return}
  el.innerHTML=S.groups.map(g=>`
    <div class="group-card animate-in" onclick="enterGroup('${g._id}')">
      <div class="group-card__header">
        <strong>${g.name}</strong>
        <span class="pill pill--${g.myRole==="owner"?"healthy":g.myRole==="admin"?"pending":"default"}">${g.myRole}</span>
      </div>
      <p class="meta">${g.description||"No description"}</p>
      <div class="meta" style="margin-top:0.5rem">Created ${fmtD(g.createdAt)}</div>
    </div>`).join("");
}

function renderInvites(){
  const el=document.getElementById("invites-list");
  const badge=document.getElementById("invite-badge-btn");
  const cnt=document.getElementById("invite-count");
  if(!S.invites.length){el.innerHTML=`<div class="empty-state"><strong>No pending invites</strong></div>`;badge.style.display="none";return}
  badge.style.display="inline";cnt.textContent=S.invites.length;
  el.innerHTML=S.invites.map(i=>`
    <div class="stack-card animate-in">
      <div class="stack-card__row">
        <div><strong>${i.groupId?.name||"Workspace"}</strong><p>Invited by ${i.invitedBy?.name||"Unknown"}${i.message?` — "${i.message}"`:""}</p><div class="meta">${fmtD(i.createdAt)}</div></div>
        <div style="display:flex;gap:0.5rem">
          <button class="btn btn--success btn--sm" onclick="respondInvite('${i._id}','accept')">Accept</button>
          <button class="btn btn--danger btn--sm" onclick="respondInvite('${i._id}','decline')">Decline</button>
        </div>
      </div>
    </div>`).join("");
}

async function respondInvite(id,action){
  try{await api(`/api/invites/${id}/${action}`,{method:"POST"});setStatus(`Invite ${action}ed.`,"success");await loadHome()}catch(err){setStatus(err.message,"error")}
}

async function loadPersonalStats(){
  try{
    const d=await api("/api/personal/products");
    const prods=d.products||[];
    const units=prods.reduce((s,p)=>s+p.quantity,0);
    const val=prods.reduce((s,p)=>s+p.quantity*p.price,0);
    document.getElementById("personal-stats").innerHTML=`
      <div class="stat-card animate-in"><div class="stat-card__label">Items</div><div class="stat-card__value">${prods.length}</div></div>
      <div class="stat-card animate-in"><div class="stat-card__label">Units</div><div class="stat-card__value">${units}</div></div>
      <div class="stat-card animate-in"><div class="stat-card__label">Value</div><div class="stat-card__value">${fmt$(val)}</div></div>`;
  }catch{}
}

/* ─── Create Group ────────────────────────────────────── */
document.getElementById("create-group-btn").addEventListener("click",()=>{document.getElementById("create-group-modal").classList.add("modal--open")});
document.getElementById("cg-close").addEventListener("click",()=>{document.getElementById("create-group-modal").classList.remove("modal--open")});
document.getElementById("cg-overlay").addEventListener("click",()=>{document.getElementById("create-group-modal").classList.remove("modal--open")});
document.getElementById("create-group-form").addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    await api("/api/groups",{method:"POST",body:JSON.stringify({name:document.getElementById("cg-name").value,description:document.getElementById("cg-desc").value})});
    document.getElementById("create-group-modal").classList.remove("modal--open");
    e.target.reset();setStatus("Workspace created!","success");await loadHome();
  }catch(err){setStatus(err.message,"error")}
});

/* ─── Edit Profile ────────────────────────────────────── */
document.getElementById("edit-profile-btn").addEventListener("click",()=>{
  document.getElementById("epf-name").value=S.user.name;document.getElementById("epf-bio").value=S.user.bio||"";
  document.getElementById("edit-profile-modal").classList.add("modal--open");
});
document.getElementById("ep-close").addEventListener("click",()=>{document.getElementById("edit-profile-modal").classList.remove("modal--open")});
document.getElementById("ep-overlay").addEventListener("click",()=>{document.getElementById("edit-profile-modal").classList.remove("modal--open")});
document.getElementById("edit-profile-form").addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    await api("/api/auth/profile",{method:"PUT",body:JSON.stringify({name:document.getElementById("epf-name").value,bio:document.getElementById("epf-bio").value})});
    document.getElementById("edit-profile-modal").classList.remove("modal--open");
    setStatus("Profile updated.","success");await loadHome();
  }catch(err){setStatus(err.message,"error")}
});

document.getElementById("delete-profile-btn").addEventListener("click", async () => {
  if (!confirm("Are you absolutely sure you want to delete your profile? This action is permanent and will delete all your workspaces and products.")) return;
  try {
    await api("/api/auth/profile", { method: "DELETE" });
    window.location.href = "/login.html";
  } catch (err) {
    setStatus(err.message, "error");
  }
});

/* ─── Global AI Assistant ─────────────────────────────── */
document.getElementById("assistant-fab").addEventListener("click", () => {
  document.getElementById("assistant-widget").style.display = "flex";
  document.getElementById("assistant-fab").style.transform = "scale(0)";
});
document.getElementById("assistant-close").addEventListener("click", () => {
  document.getElementById("assistant-widget").style.display = "none";
  document.getElementById("assistant-fab").style.transform = "scale(1)";
});

document.getElementById("global-chat-form")?.addEventListener("submit",async e=>{
  e.preventDefault();const input=document.getElementById("global-chat-input"),q=input.value.trim();if(!q)return;
  const box=document.getElementById("global-chat-box");
  const um=document.createElement("div");um.className="chat-msg chat-msg--user animate-in";um.innerHTML=`<div class="chat-msg__bubble">${q}</div>`;box.appendChild(um);input.value="";
  const lm=document.createElement("div");lm.className="chat-msg chat-msg--bot animate-in";lm.innerHTML=`<div class="chat-msg__bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>`;box.appendChild(lm);box.scrollTop=box.scrollHeight;
  try{
    const body={query:q};if(S.currentGroup && S.currentView === "group")body.groupId=S.currentGroup;
    const d=await api("/api/insights",{method:"POST",body:JSON.stringify(body)});
    
    let replyText = d.reply;
    const downloadRegex = /<DOWNLOAD_IMAGES ids="([^"]+)"\s*\/>/g;
    let match;
    const allIds = [];
    while ((match = downloadRegex.exec(replyText)) !== null) {
      allIds.push(...match[1].split(',').map(s=>s.trim()));
    }
    if (allIds.length > 0) {
      replyText = replyText.replace(downloadRegex, '');
      replyText += `\n\n<button class="btn btn--success btn--sm" onclick="downloadImages(['${allIds.join("','")}'])" style="margin-top:0.5rem">Download Requested Images</button>`;
    }

    lm.innerHTML=`<div class="chat-msg__bubble">${marked.parse(replyText)}</div>`;
    const mb=lm.querySelectorAll(".language-mermaid");if(mb.length){mb.forEach(b=>{const p=b.parentElement,div=document.createElement("div");div.className="mermaid";div.textContent=b.textContent;p.replaceWith(div)});if(typeof mermaid!=="undefined"){mermaid.initialize({startOnLoad:false,theme:document.documentElement.dataset.theme==="dark"?"dark":"default"});mermaid.run({querySelector:".mermaid"})}}
  }catch(err){lm.innerHTML=`<div class="chat-msg__bubble" style="color:var(--danger)">Error: ${err.message}</div>`}
  box.scrollTop=box.scrollHeight;
});

window.downloadImages = function(ids) {
  const prods = (S.currentView === "group") ? S.groupData.products : S.personalProducts;
  if(!prods) return;
  ids.forEach(id => {
    const p = prods.find(x => x._id === id || x.sku === id);
    if (p && p.imageUrl) {
      const a = document.createElement("a");
      a.href = p.imageUrl;
      a.download = `${p.name.replace(/\\s+/g, '_')}_${new Date().getTime()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  });
};
