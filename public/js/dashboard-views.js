/* ─── Helpers ────────────────────────────────────────── */
async function getFileBase64(fileInput) {
  const file = fileInput.files[0];
  if (!file) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

async function getLocationCity() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
          const data = await res.json();
          resolve(data.address.city || data.address.town || data.address.village || data.address.county || "");
        } catch {
          resolve(`Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}`);
        }
      },
      () => resolve("")
    );
  });
}

function handleImageSelect(inputId, dateId, cityId) {
  document.getElementById(inputId).addEventListener("change", async (e) => {
    if (e.target.files.length > 0) {
      const dInput = document.getElementById(dateId);
      const cInput = document.getElementById(cityId);
      if (!dInput.value) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        dInput.value = now.toISOString().slice(0, 16);
      }
      if (!cInput.value) {
        cInput.placeholder = "Locating...";
        cInput.value = await getLocationCity();
        cInput.placeholder = "e.g. New York";
      }
    }
  });
}

setTimeout(() => {
  handleImageSelect("p-image", "p-photo-date", "p-photo-city");
  handleImageSelect("pp-image", "pp-photo-date", "pp-photo-city");
  handleImageSelect("ep-image", "ep-photo-date", "ep-photo-city");
}, 1000);

/* ─── GROUP VIEW ──────────────────────────────────────── */
async function enterGroup(id){
  try{
    const d=await api(`/api/groups/${id}`);
    S.currentGroup=id;S.groupData=d;S.groupTab="overview";
    document.getElementById("group-title").textContent=d.group.name;
    const rp=document.getElementById("group-role-pill");
    rp.textContent=d.group.myRole;rp.className=`pill pill--${d.group.myRole==="owner"?"healthy":d.group.myRole==="admin"?"pending":"default"}`;
    const isAdmin=d.group.myRole==="owner"||d.group.myRole==="admin";
    document.getElementById("add-product-panel").style.display=isAdmin?"block":"none";
    document.getElementById("record-movement-panel").style.display=isAdmin?"block":"none";
    document.getElementById("invite-panel").style.display=isAdmin?"block":"none";
    document.getElementById("edit-group-btn").style.display=isAdmin?"block":"none";
    document.getElementById("delete-group-btn").style.display=(d.group.myRole==="owner")?"block":"none";
    showView("group");renderGroupAll();
  }catch(err){setStatus(err.message,"error")}
}

document.getElementById("edit-group-btn").addEventListener("click", () => {
  document.getElementById("eg-name").value = S.groupData.group.name;
  document.getElementById("eg-desc").value = S.groupData.group.description || "";
  document.getElementById("edit-group-modal").classList.add("modal--open");
});
document.getElementById("eg-close").addEventListener("click", () => document.getElementById("edit-group-modal").classList.remove("modal--open"));
document.getElementById("eg-overlay").addEventListener("click", () => document.getElementById("edit-group-modal").classList.remove("modal--open"));

document.getElementById("edit-group-form").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const b = { name: document.getElementById("eg-name").value, description: document.getElementById("eg-desc").value };
    await api(`/api/groups/${S.currentGroup}`, { method: "PUT", body: JSON.stringify(b) });
    document.getElementById("edit-group-modal").classList.remove("modal--open");
    setStatus("Workspace updated.", "success");
    await refreshGroup();
  } catch (err) { setStatus(err.message, "error"); }
});

document.getElementById("delete-group-btn").addEventListener("click", () => {
  document.getElementById("delete-group-modal").classList.add("modal--open");
});
document.getElementById("dg-close").addEventListener("click", () => document.getElementById("delete-group-modal").classList.remove("modal--open"));
document.getElementById("dg-overlay").addEventListener("click", () => document.getElementById("delete-group-modal").classList.remove("modal--open"));
document.getElementById("dg-cancel").addEventListener("click", () => document.getElementById("delete-group-modal").classList.remove("modal--open"));

document.getElementById("dg-confirm").addEventListener("click", async () => {
  document.getElementById("delete-group-modal").classList.remove("modal--open");
  try {
    await api(`/api/groups/${S.currentGroup}`, { method: "DELETE" });
    setStatus("Workspace deleted.", "success");
    showView("home");
    await loadHome();
  } catch (err) { setStatus(err.message, "error"); }
});

function renderGroupAll(){
  const d=S.groupData;if(!d)return;
  renderGroupStats();renderGroupChart();renderGroupMvmtSummary();
  renderGroupInventory();renderGroupMvmtOptions();renderGroupMvmtList();
  renderGroupMembers();renderGroupRequests();renderGroupLogs();
}

function renderGroupStats(){
  const p=S.groupData.products,m=S.groupData.members;
  const units=p.reduce((s,x)=>s+x.quantity,0);
  const val=p.reduce((s,x)=>s+x.quantity*x.price,0);
  document.getElementById("group-stats").innerHTML=`
    <div class="stat-card animate-in"><div class="stat-card__label">Products</div><div class="stat-card__value">${p.length}</div></div>
    <div class="stat-card animate-in"><div class="stat-card__label">Units</div><div class="stat-card__value">${units}</div></div>
    <div class="stat-card animate-in"><div class="stat-card__label">Value</div><div class="stat-card__value">${fmt$(val)}</div></div>
    <div class="stat-card animate-in"><div class="stat-card__label">Members</div><div class="stat-card__value">${m.length}</div></div>
    <div class="stat-card stat-card--danger animate-in"><div class="stat-card__label">Pending</div><div class="stat-card__value">${S.groupData.pendingRequests.length}</div></div>`;
}

function renderGroupChart(){
  const chart=document.getElementById("category-chart");
  const tbody=document.getElementById("category-breakdown-table");
  const catMap=new Map();
  S.groupData.products.forEach(p=>{
    if(!catMap.has(p.category)) catMap.set(p.category, {val:0, items:0, units:0, value:0});
    const c = catMap.get(p.category);
    c.val += p.quantity;
    c.items++;
    c.units += p.quantity;
    c.value += (p.quantity * p.price);
  });
  const entries=[...catMap.entries()];
  
  if(tbody) {
    if(!entries.length) {
      tbody.innerHTML=`<tr><td colspan="4"><div class="empty-state"><strong>No data</strong></div></td></tr>`;
    } else {
      tbody.innerHTML=entries.map(([label, c])=>`<tr><td><strong>${label}</strong></td><td>${c.items}</td><td>${c.units}</td><td>${fmt$(c.value)}</td></tr>`).join("");
    }
  }

  if(!entries.length){chart.innerHTML=`<text x="50%" y="50%" text-anchor="middle" fill="currentColor" opacity="0.5">No data</text>`;return}
  const max=Math.max(...entries.map(([,c])=>c.val),1);
  const colors=["#6c8cff","#34d399","#fbbf24","#f87171","#a78bfa","#fb923c"];
  const barW=Math.max(40,Math.floor(420/entries.length)),gap=16,startX=56,baseY=210,chartH=170;
  let svg=`<line x1="40" y1="${baseY}" x2="580" y2="${baseY}" stroke="currentColor" opacity="0.15"/>`;
  entries.forEach(([label,c],i)=>{const x=startX+i*(barW+gap),h=Math.max(14,Math.round((c.val/max)*chartH)),y=baseY-h,co=colors[i%colors.length];
    svg+=`<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="8" fill="${co}" opacity="0.85"/><text x="${x+barW/2}" y="${y-6}" text-anchor="middle" font-size="12" fill="currentColor">${c.val}</text><text x="${x+barW/2}" y="${baseY+16}" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.7">${label}</text>`;
  });chart.innerHTML=svg;
}

function renderGroupMvmtSummary(){
  const mvs=S.groupData.movements;
  const inc=mvs.filter(m=>m.type==="in").reduce((s,m)=>s+m.quantity,0);
  const out=mvs.filter(m=>m.type==="out").reduce((s,m)=>s+m.quantity,0);
  document.getElementById("movement-summary").innerHTML=`
    <div class="metric-card"><span>Incoming</span><strong>${inc}</strong></div>
    <div class="metric-card"><span>Outgoing</span><strong>${out}</strong></div>
    <div class="metric-card"><span>Total Moves</span><strong>${mvs.length}</strong></div>`;
}

/* ─── Group Inventory ────────────────────────────────── */
function getGFilteredProducts(){
  const t=(document.getElementById("search-input")?.value||"").trim().toLowerCase();
  if(!t)return S.groupData.products;
  return S.groupData.products.filter(p=>[p.name,p.sku,p.category,p.supplier].join(" ").toLowerCase().includes(t));
}

function renderGroupInventory(){
  const tbody=document.getElementById("inventory-table"),prods=getGFilteredProducts();
  const isAdmin=S.groupData.group.myRole==="owner"||S.groupData.group.myRole==="admin";
  if(!prods.length){tbody.innerHTML=`<tr><td colspan="8"><div class="empty-state"><strong>No items</strong></div></td></tr>`;return}
  tbody.innerHTML=prods.map(p=>`<tr>
    <td data-label="Image">${p.imageUrl?`<img loading="lazy" src="${p.imageUrl}" alt="${p.name}" class="img-thumb" style="width:48px;height:48px;object-fit:cover;border-radius:8px" title="${p.imageMeta?`Added on ${new Date(p.imageMeta.timestamp).toLocaleString()} from ${p.imageMeta.location}`:''}">`:'-'}</td>
    <td data-label="Item"><div class="product-cell"><strong>${p.name}</strong><span>${p.category}</span></div></td>
    <td data-label="SKU">${p.sku}</td><td data-label="Supplier">${p.supplier}</td>
    <td data-label="Units">${p.quantity}</td><td data-label="Value">${fmt$(p.quantity*p.price)}</td>
    <td data-label="Location"><span class="pill ${p.quantity<5?"pill--low":"pill--healthy"}">${p.location}</span></td>
    <td data-label="Action"><div class="action-buttons">${p.imageUrl?`<button class="btn btn--primary btn--sm" onclick="window.downloadImages(['${p._id}'])">↓</button>`:""}${isAdmin?`<button class="btn btn--ghost btn--sm" onclick="openEditModal('${p._id}','group')">Edit</button><button class="btn btn--danger btn--sm" onclick="deleteGroupProduct('${p._id}')">Del</button>`:`<button class="btn btn--ghost btn--sm" onclick="submitGroupRequest('delete_product',{productId:'${p._id}',productName:'${p.name.replace(/'/g,"\\'")}' })">Req Delete</button>`}</div></td>
  </tr>`).join("");
}
document.getElementById("search-input")?.addEventListener("input",renderGroupInventory);

document.getElementById("product-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const imgInput = document.getElementById("p-image");
  const b={name:document.getElementById("p-name").value,sku:document.getElementById("p-sku").value,category:document.getElementById("p-category").value,supplier:document.getElementById("p-supplier").value,price:+document.getElementById("p-price").value,quantity:+document.getElementById("p-quantity").value,location:document.getElementById("p-location").value,barcode:document.getElementById("p-barcode").value};
  const imgBase64 = await getFileBase64(imgInput);
  if (imgBase64) {
    b.image = imgBase64;
    b.locationLog = document.getElementById("p-photo-city").value;
    b.imageTimestamp = document.getElementById("p-photo-date").value;
  }
  try{await api(`/api/groups/${S.currentGroup}/products`,{method:"POST",body:JSON.stringify(b)});e.target.reset();setStatus("Product added.","success");await refreshGroup()}catch(err){setStatus(err.message,"error")}
});

async function deleteGroupProduct(pid){
  if(!confirm("Delete this product?"))return;
  try{await api(`/api/groups/${S.currentGroup}/products/${pid}`,{method:"DELETE"});setStatus("Deleted.","success");await refreshGroup()}catch(err){setStatus(err.message,"error")}
}

async function submitGroupRequest(type,payload){
  try{await api(`/api/groups/${S.currentGroup}/requests`,{method:"POST",body:JSON.stringify({type,payload})});setStatus("Request submitted.","success");await refreshGroup()}catch(err){setStatus(err.message,"error")}
}

/* ─── Group Movements ────────────────────────────────── */
function renderGroupMvmtOptions(){
  const sel=document.getElementById("m-product");
  if(!S.groupData.products.length){sel.innerHTML='<option value="">No products</option>';sel.disabled=true;return}
  sel.disabled=false;sel.innerHTML=S.groupData.products.map(p=>`<option value="${p._id}">${p.name} · ${p.quantity} units</option>`).join("");
}
function renderGroupMvmtList(){
  const el=document.getElementById("movement-list");
  if(!S.groupData.movements.length){el.innerHTML=`<div class="empty-state"><strong>No movements</strong></div>`;return}
  el.innerHTML=S.groupData.movements.slice(0,15).map(m=>`<div class="stack-card"><div class="stack-card__row"><div><strong>${m.productName}</strong><p>${m.type==="in"?"Stock In":"Stock Out"} · ${m.quantity} units</p><div class="meta">${fmtD(m.createdAt)}</div></div><div class="amount">${fmt$(m.amount||0)}</div></div></div>`).join("");
}
document.getElementById("movement-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const b={productId:document.getElementById("m-product").value,type:document.getElementById("m-type").value,quantity:+document.getElementById("m-quantity").value,note:document.getElementById("m-note").value};
  try{await api(`/api/groups/${S.currentGroup}/movements`,{method:"POST",body:JSON.stringify(b)});e.target.reset();setStatus("Movement recorded.","success");await refreshGroup()}catch(err){setStatus(err.message,"error")}
});

/* ─── Members ────────────────────────────────────────── */
function renderGroupMembers(){
  const el=document.getElementById("member-list"),isOwner=S.groupData.group.myRole==="owner",isAdmin=isOwner||S.groupData.group.myRole==="admin";
  el.innerHTML=S.groupData.members.map(m=>{
    const u=m.userId;if(!u)return"";
    let actions="";
    if(isOwner&&m.role!=="owner"){
      actions=m.role==="admin"?`<button class="btn btn--ghost btn--sm" onclick="memberAction('${u._id}','demote')">Demote</button>`:`<button class="btn btn--ghost btn--sm" onclick="memberAction('${u._id}','promote')">Promote</button>`;
      actions+=`<button class="btn btn--ghost btn--sm" onclick="transferOwnership('${u._id}')" title="Transfer Ownership">👑</button>`;
      actions+=`<button class="btn btn--danger btn--sm" onclick="removeMember('${u._id}')">Remove</button>`;
    }
    return`<div class="user-card"><div class="user-card__info"><strong>${u.name}</strong><span>${u.email}</span></div><div style="display:flex;gap:0.5rem;align-items:center"><span class="pill pill--${m.role==="owner"?"healthy":m.role==="admin"?"pending":"default"}">${m.role}</span>${actions}</div></div>`;
  }).join("");
}

async function transferOwnership(uid){
  if(!confirm("Are you sure you want to transfer workspace ownership to this user? You will become an admin."))return;
  try{await api(`/api/groups/${S.currentGroup}/members/${uid}/transfer`,{method:"POST"});setStatus("Ownership transferred.","success");await refreshGroup()}catch(err){setStatus(err.message,"error")}
}

async function memberAction(uid,action){
  try{await api(`/api/groups/${S.currentGroup}/members/${uid}/${action}`,{method:"POST"});setStatus(`Member ${action}d.`,"success");await refreshGroup()}catch(err){setStatus(err.message,"error")}
}
async function removeMember(uid){
  if(!confirm("Remove this member?"))return;
  try{await api(`/api/groups/${S.currentGroup}/members/${uid}`,{method:"DELETE"});setStatus("Member removed.","success");await refreshGroup()}catch(err){setStatus(err.message,"error")}
}

/* ─── Group Invites ──────────────────────────────────── */
document.getElementById("invite-form").addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    await api(`/api/groups/${S.currentGroup}/invites`,{method:"POST",body:JSON.stringify({email:document.getElementById("inv-email").value,message:document.getElementById("inv-message").value})});
    e.target.reset();setStatus("Invite sent!","success");loadSentInvites();
  }catch(err){setStatus(err.message,"error")}
});
async function loadSentInvites(){
  try{
    const d=await api(`/api/groups/${S.currentGroup}/invites`);
    const el=document.getElementById("sent-invites-list");
    if(!d.invites.length){el.innerHTML=`<div class="empty-state"><strong>No invites</strong></div>`;return}
    el.innerHTML=d.invites.map(i=>`<div class="stack-card"><div class="stack-card__row"><div><strong>${i.invitedUserId?.name||i.invitedUserId?.email||"User"}</strong><div class="meta">${fmtD(i.createdAt)}</div></div><span class="pill pill--${i.status}">${i.status}</span></div></div>`).join("");
  }catch{}
}

/* ─── Group Requests ─────────────────────────────────── */
function fmtPayload(r){const p=r.payload;if(r.type==="add_product")return`<strong>${p.name}</strong> · ${p.sku} · ₹${p.price}×${p.quantity}`;if(r.type==="record_movement")return`<strong>${p.type==="in"?"In":"Out"}</strong> · ${p.quantity} units`;if(r.type==="delete_product")return`Delete: <strong>${p.productName||p.productId}</strong>`;if(r.type==="send_message")return`<strong>${p.subject}</strong>: ${p.message}`;return JSON.stringify(p)}

async function renderGroupRequests(){
  const isAdmin=S.groupData.group.myRole==="owner"||S.groupData.group.myRole==="admin";
  try{
    const d=await api(`/api/groups/${S.currentGroup}/requests`);
    const pending=d.requests.filter(r=>r.status==="pending"),done=d.requests.filter(r=>r.status!=="pending");
    const el=document.getElementById("request-list");
    if(!pending.length)el.innerHTML=`<div class="empty-state"><strong>No pending requests</strong></div>`;
    else el.innerHTML=pending.map(r=>`<div class="request-card animate-in"><div class="request-card__header"><div><div class="request-card__type">${r.type.replace(/_/g," ")}</div><div class="meta">By ${r.requestedBy?.name||r.requestedByName||"User"} · ${fmtD(r.createdAt)}</div></div><span class="pill pill--pending">Pending</span></div><div class="request-card__body">${fmtPayload(r)}</div>${isAdmin?`<div class="request-card__actions"><button class="btn btn--success btn--sm" onclick="reviewRequest('${r._id}','approve')">✓ Approve</button><button class="btn btn--danger btn--sm" onclick="reviewRequest('${r._id}','reject')">✗ Reject</button></div>`:""}</div>`).join("");
    const hel=document.getElementById("request-history");
    if(!done.length)hel.innerHTML=`<div class="empty-state"><strong>No history</strong></div>`;
    else hel.innerHTML=done.slice(0,20).map(r=>`<div class="request-card"><div class="request-card__header"><div><div class="request-card__type">${r.type.replace(/_/g," ")}</div><div class="meta">${fmtD(r.createdAt)}</div></div><span class="pill pill--${r.status}">${r.status}</span></div><div class="request-card__body">${fmtPayload(r)}</div>${r.reviewNote?`<div class="request-card__note">Note: ${r.reviewNote}</div>`:""}</div>`).join("");
  }catch{}
}

async function reviewRequest(rid,action){
  const note=prompt(`${action==="approve"?"Approval":"Rejection"} note:`,"");
  if(note===null)return;
  try{await api(`/api/groups/${S.currentGroup}/requests/${rid}/${action}`,{method:"POST",body:JSON.stringify({note:note||action.charAt(0).toUpperCase()+action.slice(1)+"d"})});setStatus(`Request ${action}d.`,"success");await refreshGroup()}catch(err){setStatus(err.message,"error")}
}

/* ─── Group Logs ─────────────────────────────────────── */
async function renderGroupLogs(){
  try{
    const d=await api(`/api/groups/${S.currentGroup}/logs`);
    const tb=document.getElementById("logs-table");
    if(!d.logs.length){tb.innerHTML=`<tr><td colspan="4"><div class="empty-state"><strong>No logs</strong></div></td></tr>`;return}
    tb.innerHTML=d.logs.map(l=>`<tr><td data-label="Date">${fmtD(l.createdAt)}</td><td data-label="User">${l.userId?.name||"System"}</td><td data-label="Action"><strong>${l.action}</strong></td><td data-label="Details">${l.details||"-"}</td></tr>`).join("");
  }catch{}
}

function exportGroupLogs(){
  window.open(`/api/groups/${S.currentGroup}/logs/export`);
}

async function refreshGroup(){if(S.currentGroup)await enterGroup(S.currentGroup)}

/* ─── PERSONAL INVENTORY ─────────────────────────────── */
document.getElementById("enter-personal-btn").addEventListener("click",()=>{showView("personal");loadPersonal()});
document.getElementById("back-home-btn-p").addEventListener("click",()=>{showView("home");loadHome()});
document.getElementById("back-home-btn").addEventListener("click",()=>{showView("home");loadHome()});

async function loadPersonal(){
  try{
    const[pd,md]=await Promise.all([api("/api/personal/products"),api("/api/personal/movements")]);
    S.personalProducts=pd.products||[];S.personalMovements=md.movements||[];
    renderPersonalAll();
  }catch(err){setStatus(err.message,"error")}
}

function renderPersonalAll(){
  const p=S.personalProducts,units=p.reduce((s,x)=>s+x.quantity,0),val=p.reduce((s,x)=>s+x.quantity*x.price,0);
  document.getElementById("p-stats").innerHTML=`
    <div class="stat-card animate-in"><div class="stat-card__label">Items</div><div class="stat-card__value">${p.length}</div></div>
    <div class="stat-card animate-in"><div class="stat-card__label">Units</div><div class="stat-card__value">${units}</div></div>
    <div class="stat-card animate-in"><div class="stat-card__label">Value</div><div class="stat-card__value">${fmt$(val)}</div></div>`;
  renderPersonalInventory();renderPersonalMvmtOptions();renderPersonalMvmtList();
}

function renderPersonalInventory(){
  const t=(document.getElementById("p-search")?.value||"").trim().toLowerCase();
  let prods=S.personalProducts;if(t)prods=prods.filter(p=>[p.name,p.sku,p.category].join(" ").toLowerCase().includes(t));
  const tb=document.getElementById("p-inventory-table");
  if(!prods.length){tb.innerHTML=`<tr><td colspan="8"><div class="empty-state"><strong>No items</strong></div></td></tr>`;return}
  tb.innerHTML=prods.map(p=>`<tr>
    <td data-label="Image">${p.imageUrl?`<img loading="lazy" src="${p.imageUrl}" alt="${p.name}" class="img-thumb" style="width:48px;height:48px;object-fit:cover;border-radius:8px" title="${p.imageMeta?`Added on ${new Date(p.imageMeta.timestamp).toLocaleString()} from ${p.imageMeta.location}`:''}">`:'-'}</td>
    <td data-label="Item"><div class="product-cell"><strong>${p.name}</strong><span>${p.category}</span></div></td><td data-label="SKU">${p.sku}</td><td data-label="Supplier">${p.supplier}</td><td data-label="Units">${p.quantity}</td><td data-label="Value">${fmt$(p.quantity*p.price)}</td><td data-label="Location"><span class="pill ${p.quantity<5?"pill--low":"pill--healthy"}">${p.location}</span></td><td data-label="Action"><div class="action-buttons">${p.imageUrl?`<button class="btn btn--primary btn--sm" onclick="window.downloadImages(['${p._id}'])">↓</button>`:""}<button class="btn btn--ghost btn--sm" onclick="openEditModal('${p._id}','personal')">Edit</button><button class="btn btn--danger btn--sm" onclick="deletePersonalProduct('${p._id}')">Del</button></div></td></tr>`).join("");
}
document.getElementById("p-search")?.addEventListener("input",renderPersonalInventory);

document.getElementById("p-product-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const imgInput = document.getElementById("pp-image");
  const b={name:document.getElementById("pp-name").value,sku:document.getElementById("pp-sku").value,category:document.getElementById("pp-category").value,supplier:document.getElementById("pp-supplier").value,price:+document.getElementById("pp-price").value,quantity:+document.getElementById("pp-quantity").value,location:document.getElementById("pp-location").value,barcode:document.getElementById("pp-barcode").value};
  const imgBase64 = await getFileBase64(imgInput);
  if (imgBase64) {
    b.image = imgBase64;
    b.locationLog = document.getElementById("pp-photo-city").value;
    b.imageTimestamp = document.getElementById("pp-photo-date").value;
  }
  try{await api("/api/personal/products",{method:"POST",body:JSON.stringify(b)});e.target.reset();setStatus("Product added.","success");await loadPersonal()}catch(err){setStatus(err.message,"error")}
});

async function deletePersonalProduct(pid){
  if(!confirm("Delete?"))return;
  try{await api(`/api/personal/products/${pid}`,{method:"DELETE"});setStatus("Deleted.","success");await loadPersonal()}catch(err){setStatus(err.message,"error")}
}

function renderPersonalMvmtOptions(){
  const sel=document.getElementById("pm-product");
  if(!S.personalProducts.length){sel.innerHTML='<option>No products</option>';sel.disabled=true;return}
  sel.disabled=false;sel.innerHTML=S.personalProducts.map(p=>`<option value="${p._id}">${p.name} · ${p.quantity}</option>`).join("");
}
function renderPersonalMvmtList(){
  const el=document.getElementById("p-movement-list");
  if(!S.personalMovements.length){el.innerHTML=`<div class="empty-state"><strong>No movements</strong></div>`;return}
  el.innerHTML=S.personalMovements.slice(0,15).map(m=>`<div class="stack-card"><div class="stack-card__row"><div><strong>${m.productName}</strong><p>${m.type==="in"?"In":"Out"} · ${m.quantity} units</p><div class="meta">${fmtD(m.createdAt)}</div></div><div class="amount">${fmt$(m.amount||0)}</div></div></div>`).join("");
}
document.getElementById("p-movement-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const b={productId:document.getElementById("pm-product").value,type:document.getElementById("pm-type").value,quantity:+document.getElementById("pm-quantity").value,note:document.getElementById("pm-note").value};
  try{await api("/api/personal/movements",{method:"POST",body:JSON.stringify(b)});e.target.reset();setStatus("Recorded.","success");await loadPersonal()}catch(err){setStatus(err.message,"error")}
});

/* ─── Edit Product Modal ─────────────────────────────── */
function openEditModal(pid,ctx){
  const list=ctx==="group"?S.groupData.products:S.personalProducts;
  const p=list.find(x=>x._id===pid);if(!p)return;
  document.getElementById("ep-id").value=p._id;document.getElementById("ep-context").value=ctx;
  document.getElementById("ep-name").value=p.name;document.getElementById("ep-sku").value=p.sku;
  document.getElementById("ep-category").value=p.category;document.getElementById("ep-supplier").value=p.supplier;
  document.getElementById("ep-price").value=p.price;document.getElementById("ep-quantity").value=p.quantity;
  document.getElementById("ep-location").value=p.location||"";document.getElementById("ep-barcode").value=p.barcode||"";
  
  if (p.imageMeta) {
    if (p.imageMeta.timestamp) {
      const d = new Date(p.imageMeta.timestamp);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      document.getElementById("ep-photo-date").value = d.toISOString().slice(0, 16);
    } else {
      document.getElementById("ep-photo-date").value = "";
    }
    document.getElementById("ep-photo-city").value = p.imageMeta.location || "";
  } else {
    document.getElementById("ep-photo-date").value = "";
    document.getElementById("ep-photo-city").value = "";
  }
  
  document.getElementById("edit-product-modal").classList.add("modal--open");
}
function closeEditModal(){document.getElementById("edit-product-modal").classList.remove("modal--open")}
document.getElementById("edit-modal-close").addEventListener("click",closeEditModal);
document.getElementById("edit-modal-cancel").addEventListener("click",closeEditModal);
document.getElementById("edit-modal-overlay").addEventListener("click",closeEditModal);

document.getElementById("edit-product-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const id=document.getElementById("ep-id").value,ctx=document.getElementById("ep-context").value;
  const imgInput = document.getElementById("ep-image");
  const b={name:document.getElementById("ep-name").value,sku:document.getElementById("ep-sku").value,category:document.getElementById("ep-category").value,supplier:document.getElementById("ep-supplier").value,price:+document.getElementById("ep-price").value,quantity:+document.getElementById("ep-quantity").value,location:document.getElementById("ep-location").value,barcode:document.getElementById("ep-barcode").value};
  const imgBase64 = await getFileBase64(imgInput);
  if (imgBase64) {
    b.image = imgBase64;
  }
  b.locationLog = document.getElementById("ep-photo-city").value;
  b.imageTimestamp = document.getElementById("ep-photo-date").value;
  try{
    const url=ctx==="group"?`/api/groups/${S.currentGroup}/products/${id}`:`/api/personal/products/${id}`;
    await api(url,{method:"PUT",body:JSON.stringify(b)});closeEditModal();setStatus("Updated.","success");
    if(ctx==="group")await refreshGroup();else await loadPersonal();
  }catch(err){setStatus(err.message,"error")}
});


/* ─── Init ────────────────────────────────────────────── */
(async()=>{
  applyTheme(resolveTheme());showView("home");
  try{const me=await api("/api/auth/me");document.getElementById("user-name").textContent=me.user?.name||""}catch{window.location.href="/login.html";return}
  await loadHome();
})();
