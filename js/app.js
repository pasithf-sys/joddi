/* joddi — จดรายจ่ายง่ายๆ ข้อมูลทั้งหมดเก็บในเครื่อง (localStorage) */
'use strict';

/* ---------- ข้อมูลพื้นฐาน ---------- */
const CATS = {
  exp: [
    {id:'food',      name:'อาหาร',     ico:'🍜', color:'#ff8a5b'},
    {id:'drink',     name:'กาแฟ/ชา',   ico:'☕', color:'#c08a5a'},
    {id:'transport', name:'เดินทาง',   ico:'🚌', color:'#4c9be8'},
    {id:'shopping',  name:'ช้อปปิ้ง',  ico:'🛍️', color:'#e86aa6'},
    {id:'bills',     name:'บิล/ค่างวด', ico:'🧾', color:'#8b7cf6'},
    {id:'fun',       name:'บันเทิง',   ico:'🎮', color:'#f5b83d'},
    {id:'health',    name:'สุขภาพ',    ico:'💊', color:'#3cc9a6'},
    {id:'other',     name:'อื่นๆ',     ico:'✨', color:'#8b98a5'},
  ],
  inc: [
    {id:'salary',  name:'เงินเดือน', ico:'💼', color:'#2fb36b'},
    {id:'side',    name:'งานเสริม',  ico:'💻', color:'#26a6c9'},
    {id:'gift',    name:'ของขวัญ',   ico:'🎁', color:'#e86aa6'},
    {id:'iother',  name:'อื่นๆ',     ico:'💰', color:'#8b98a5'},
  ],
};
const ALLCATS = [...CATS.exp, ...CATS.inc];
const catOf = id => ALLCATS.find(c => c.id === id) || CATS.exp[7];
const WD = ['อา','จ','อ','พ','พฤ','ศ','ส'];

/* ---------- ที่เก็บข้อมูล ---------- */
const store = {
  get(k, d){ try{ const v = localStorage.getItem('joddi.'+k); return v ? JSON.parse(v) : d; }catch{ return d; } },
  set(k, v){ try{ localStorage.setItem('joddi.'+k, JSON.stringify(v)); }catch{} },
};
let tx = store.get('tx', []);
let settings = Object.assign({budget:0, theme:'auto'}, store.get('settings', {}));
const saveTx = () => store.set('tx', tx);
const saveSettings = () => store.set('settings', settings);

/* ---------- ตัวช่วยวันที่/ตัวเลข ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const mkey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
const parseYmd = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const daysIn = m => { const [y,mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };
const shiftMonth = (m, n) => { const [y,mo] = m.split('-').map(Number); return mkey(new Date(y, mo-1+n, 1)); };
const todayStr = () => ymd(new Date());
const monthName = (m, long=true) => { const [y,mo] = m.split('-').map(Number);
  return new Date(y, mo-1, 1).toLocaleDateString('th-TH', {month: long?'long':'short', year: long?'numeric':'2-digit'}); };
const fmt = n => Number(n).toLocaleString('th-TH', {maximumFractionDigits:2});
const fmt0 = n => Math.round(n).toLocaleString('th-TH');
const baht = n => '฿' + fmt(n);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const dayLabel = s => {
  const t = todayStr(), y = ymd(new Date(Date.now() - 864e5));
  if(s === t) return 'วันนี้'; if(s === y) return 'เมื่อวาน';
  const d = parseYmd(s);
  return `${WD[d.getDay()]} ${d.getDate()} ${monthName(mkey(d), false).split(' ')[0]}`;
};

/* ---------- คำนวณ ---------- */
const byMonth = m => tx.filter(t => t.date.startsWith(m));
const total = (list, type) => list.reduce((s, t) => s + (t.type === type ? t.amount : 0), 0);
function byCat(list){
  const map = {};
  for(const t of list) if(t.type === 'exp') map[t.cat] = (map[t.cat] || 0) + t.amount;
  return Object.entries(map).map(([id, v]) => ({...catOf(id), v})).sort((a,b) => b.v - a.v);
}
function dailyExp(m){
  const arr = Array(daysIn(m)).fill(0);
  for(const t of byMonth(m)) if(t.type === 'exp') arr[Number(t.date.slice(8)) - 1] += t.amount;
  return arr;
}

/* ---------- สถานะหน้าจอ ---------- */
const ui = {tab:'home', month: mkey(new Date()), q:'', cat:'all', selDay:null};
let sheet = null;

/* ---------- วาดหน้า ---------- */
const view = document.getElementById('view');
function render(){
  document.getElementById('monthlabel').textContent = monthName(ui.month);
  document.getElementById('monthnav').style.visibility = ui.tab === 'settings' ? 'hidden' : '';
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  view.innerHTML = {home, list: listView, stats, settings: settingsView}[ui.tab]();
  if(ui.tab === 'list'){ /* คงตำแหน่งช่องค้นหา */ }
}

function emptyState(){
  return `<div class="card empty"><div class="em">🪙</div><h2>ยังไม่มีรายการเดือนนี้</h2>
    <p>แตะปุ่ม <b>+</b> เพื่อจดรายการแรก ใช้เวลาไม่ถึง 5 วินาที</p>
    <div style="display:grid;gap:8px;max-width:260px;margin:14px auto 0">
      <button class="btn block" data-act="add">+ จดรายการ</button>
      ${tx.length === 0 ? '<button class="btn ghost block" data-act="demo">ลองด้วยข้อมูลตัวอย่าง</button>' : ''}
    </div></div>`;
}

function home(){
  const m = ui.month, list = byMonth(m);
  if(!list.length) return emptyState();
  const exp = total(list, 'exp'), inc = total(list, 'inc');
  const isCur = m === mkey(new Date());
  const dim = daysIn(m), now = new Date();
  const elapsed = isCur ? now.getDate() : (m < mkey(now) ? dim : 0);
  const left = isCur ? dim - now.getDate() + 1 : 0;
  const b = settings.budget;
  const pct = b ? exp / b * 100 : 0;
  const ringColor = pct > 100 ? '#ffb3b6' : pct > 80 ? '#ffe08a' : '#fff';
  const remain = b - exp;

  let budgetBlock;
  if(b){
    const allowance = isCur && remain > 0 ? `ใช้ได้อีกวันละ <b>${baht(remain / left)}</b> (เหลือ ${left} วัน)` : '';
    budgetBlock = `<div class="herorow">
      <div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="11"/>
        <circle cx="50" cy="50" r="42" fill="none" stroke="${ringColor}" stroke-width="11" stroke-linecap="round" pathLength="100" stroke-dasharray="${Math.min(pct,100)} 100"/></svg>
        <div class="t num">${Math.round(pct)}%</div></div>
      <div class="herotext">${remain >= 0 ? `งบเหลือ <b>${baht(remain)}</b> จาก ${baht(b)}` : `<b>เกินงบ ${baht(-remain)}</b> จาก ${baht(b)}`}<br>${allowance}</div></div>`;
  } else {
    budgetBlock = `<div class="nobudget">ยังไม่ได้ตั้งงบรายเดือน · <button data-act="goto-settings">ตั้งงบเลย</button></div>`;
  }

  // ภาพรวมรายวัน
  const daily = dailyExp(m), max = Math.max(...daily, 1);
  const todayN = isCur ? now.getDate() : 0;
  const bars = daily.map((v, i) => {
    const d = i + 1, future = isCur && d > todayN;
    const cls = ['bar', d === todayN ? 'today' : '', v === 0 ? 'zero' : '', future ? 'future' : '', ui.selDay === d ? 'sel' : ''].join(' ');
    return `<button class="${cls}" data-act="sel-day" data-day="${d}" aria-label="วันที่ ${d}: ${fmt(v)} บาท"><i style="--h:${v/max*100}%"></i></button>`;
  }).join('');
  const selD = ui.selDay && ui.selDay <= dim ? ui.selDay : null;
  const cap = selD ? `วันที่ <b>${selD}</b> ใช้ไป <b>${baht(daily[selD-1])}</b>` : 'แตะแท่งเพื่อดูยอดแต่ละวัน';

  // หมวดหมู่
  const cats = byCat(list).slice(0, 4), ctot = exp || 1;
  const catRows = cats.map(c => catRow(c, c.v, c.v / ctot)).join('');

  // ข้อมูลเชิงลึก
  const avg = elapsed ? exp / elapsed : 0;
  const proj = isCur && elapsed ? exp / elapsed * dim : null;
  // เดือนปัจจุบัน: เทียบเฉพาะช่วงวันเดียวกันของเดือนก่อน จะได้ไม่เทียบครึ่งเดือนกับทั้งเดือน
  const prevExp = total(byMonth(shiftMonth(m, -1)).filter(t => !isCur || Number(t.date.slice(8)) <= elapsed), 'exp');
  const delta = prevExp ? (exp - prevExp) / prevExp * 100 : null;
  const biggest = list.filter(t => t.type === 'exp').sort((a,b) => b.amount - a.amount)[0];

  return `
  <section class="card hero">
    <div class="lbl">ใช้ไปแล้ว${isCur ? 'เดือนนี้' : ''}</div>
    <div class="big num"><sup>฿</sup>${fmt(exp)}</div>
    ${budgetBlock}
    <div class="pills"><div class="pill">รายรับ<b class="num">${baht(inc)}</b></div><div class="pill">คงเหลือสุทธิ<b class="num">${baht(inc - exp)}</b></div></div>
  </section>

  <div class="tiles">
    <div class="tile"><div class="k">เฉลี่ยต่อวัน</div><div class="v num">${baht(avg)}</div><div class="s">${elapsed} วันที่ผ่านมา</div></div>
    <div class="tile"><div class="k">${proj !== null ? 'คาดว่าสิ้นเดือน' : 'เทียบเดือนก่อน'}</div>
      <div class="v num ${proj !== null && b && proj > b ? 'up' : ''}">${proj !== null ? baht(proj) : (delta === null ? '–' : (delta > 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(delta)) + '%')}</div>
      <div class="s">${proj !== null ? (b ? (proj > b ? 'เกินงบ ระวัง!' : 'อยู่ในงบ') : 'ตามจังหวะตอนนี้') : 'ยอดใช้จ่ายรวม'}</div></div>
    ${proj !== null ? `<div class="tile"><div class="k">เทียบเดือนก่อน</div><div class="v num ${delta > 0 ? 'up' : 'down'}">${delta === null ? '–' : (delta > 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(delta)) + '%'}</div><div class="s">ช่วงเดียวกันเดือนก่อน ${baht(prevExp)}</div></div>` : ''}
    ${biggest ? `<div class="tile"><div class="k">ก้อนใหญ่สุด</div><div class="v num">${baht(biggest.amount)}</div><div class="s">${catOf(biggest.cat).ico} ${esc(biggest.note || catOf(biggest.cat).name)}</div></div>` : ''}
  </div>

  <section class="card"><h3>รายจ่ายรายวัน<small>สูงสุด ${baht(max === 1 && !exp ? 0 : Math.max(...daily))}</small></h3>
    <div class="bars">${bars}</div>
    <div class="baraxis"><span>1</span><span>${Math.round(dim/2)}</span><span>${dim}</span></div>
    <div class="barcap">${cap}</div></section>

  <section class="card"><h3>ใช้ไปกับอะไรมากสุด<button data-act="goto-stats" style="color:var(--accent);font-size:12px">ดูทั้งหมด ›</button></h3>
    ${catRows || '<div class="sub">ยังไม่มีรายจ่าย</div>'}</section>

  <section class="card"><h3>ล่าสุด<button data-act="goto-list" style="color:var(--accent);font-size:12px">ดูทั้งหมด ›</button></h3>
    <div style="margin:-6px -18px -18px">${txRows([...list].sort(cmpTx).slice(0, 4))}</div></section>`;
}

const cmpTx = (a, b) => b.date.localeCompare(a.date) || b.ts - a.ts;

function catRow(c, v, share){
  return `<div class="catrow"><div class="catico" style="background:${c.color}22">${c.ico}</div>
    <div class="catmain"><div class="catname"><span>${c.name}</span><span class="num">${baht(v)}</span></div>
    <div class="meter"><i style="--w:${Math.max(share*100, 2)}%;background:${c.color}"></i></div>
    <div class="sub">${Math.round(share*100)}% ของรายจ่าย</div></div></div>`;
}

function txRows(list){
  return list.map(t => { const c = catOf(t.cat);
    return `<button class="tx" data-act="edit" data-id="${t.id}">
      <div class="catico" style="background:${c.color}22">${c.ico}</div>
      <div class="catmain"><div class="nm">${esc(t.note || c.name)}</div><div class="sub">${c.name}</div></div>
      <div class="amt num ${t.type}">${t.type === 'inc' ? '+' : '−'}${baht(t.amount)}</div></button>`;
  }).join('');
}

function listView(){
  const all = byMonth(ui.month);
  const q = ui.q.trim().toLowerCase();
  let list = all.filter(t => (ui.cat === 'all' || t.cat === ui.cat) &&
    (!q || (t.note || '').toLowerCase().includes(q) || catOf(t.cat).name.includes(q) || String(t.amount).includes(q)));
  list.sort(cmpTx);
  const used = [...new Set(all.map(t => t.cat))];
  const chips = `<button class="chip ${ui.cat === 'all' ? 'on' : ''}" data-act="filter" data-cat="all">ทั้งหมด</button>` +
    used.map(id => `<button class="chip ${ui.cat === id ? 'on' : ''}" data-act="filter" data-cat="${id}">${catOf(id).ico} ${catOf(id).name}</button>`).join('');
  let body = '';
  if(!all.length) return emptyState();
  if(!list.length) body = `<div class="empty"><div class="em">🔍</div>ไม่พบรายการที่ตรงกัน</div>`;
  else {
    const days = {};
    for(const t of list) (days[t.date] ||= []).push(t);
    body = Object.keys(days).sort().reverse().map(d => {
      const e = total(days[d], 'exp');
      return `<div class="day"><div class="dayhead"><span>${dayLabel(d)}</span><span class="num">${e ? '−' + baht(e) : ''}</span></div>
        <div class="group">${txRows(days[d])}</div></div>`;
    }).join('');
  }
  return `<div class="search"><span>🔍</span><input id="q" type="search" placeholder="ค้นหาโน้ต หมวด หรือจำนวนเงิน" value="${esc(ui.q)}"></div>
    <div class="chips">${chips}</div>${body}`;
}

function stats(){
  const m = ui.month, list = byMonth(m);
  if(!list.length) return emptyState();
  const exp = total(list, 'exp'), cats = byCat(list);

  // โดนัท
  let acc = 0;
  const segs = cats.map(c => { const p = c.v / exp * 100; const s = `<circle cx="50" cy="50" r="38" fill="none" stroke="${c.color}" stroke-width="16" pathLength="100" stroke-dasharray="${Math.max(p-.6,.1)} ${100-Math.max(p-.6,.1)}" stroke-dashoffset="${-acc}"/>`; acc += p; return s; }).join('');
  const donut = exp ? `<div class="donutwrap"><div class="donut"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="none" stroke="var(--soft)" stroke-width="16"/>${segs}</svg>
      <div class="c"><b class="num">${baht(exp)}</b><span>รายจ่ายรวม</span></div></div>
      <div class="legend">${cats.map(c => `<div><i style="background:${c.color}"></i><span>${c.name}</span><b class="num">${Math.round(c.v/exp*100)}%</b></div>`).join('')}</div></div>` : '<div class="sub">ยังไม่มีรายจ่าย</div>';

  // ตามวันในสัปดาห์
  const wd = Array(7).fill(0), wdn = Array(7).fill(0);
  const dim = daysIn(m);
  for(let d = 1; d <= dim; d++) wdn[new Date(Number(m.slice(0,4)), Number(m.slice(5))-1, d).getDay()]++;
  for(const t of list) if(t.type === 'exp') wd[parseYmd(t.date).getDay()] += t.amount;
  const wdAvg = wd.map((v, i) => wdn[i] ? v / wdn[i] : 0), wmax = Math.max(...wdAvg, 1), wtop = wdAvg.indexOf(Math.max(...wdAvg));
  const order = [1,2,3,4,5,6,0];
  const wcols = order.map(i => `<div class="col ${i === wtop ? 'hi' : ''}"><small class="num">${wdAvg[i] ? fmt0(wdAvg[i]) : ''}</small><i style="--h:${wdAvg[i]/wmax*78}%"></i><em>${WD[i]}</em></div>`).join('');

  // 6 เดือนล่าสุด
  const months = Array.from({length:6}, (_, i) => shiftMonth(m, i - 5));
  const mv = months.map(k => total(byMonth(k), 'exp')), mmax = Math.max(...mv, 1);
  const mcols = months.map((k, i) => `<div class="col ${k === m ? 'hi' : ''}"><small class="num">${mv[i] ? fmt0(mv[i]) : ''}</small><i style="--h:${mv[i]/mmax*78}%"></i><em>${monthName(k, false).split(' ')[0]}</em></div>`).join('');

  return `<section class="card"><h3>สัดส่วนรายจ่าย</h3>${donut}</section>
  <section class="card"><h3>รายจ่ายหมวดต่างๆ</h3>${cats.map(c => catRow(c, c.v, c.v / exp)).join('') || '<div class="sub">ยังไม่มีรายจ่าย</div>'}</section>
  <section class="card"><h3>วันไหนใช้เยอะ<small>เฉลี่ยต่อวัน</small></h3><div class="cols">${wcols}</div>
    ${exp ? `<div class="barcap">คุณใช้เงินเยอะสุดใน<b>วัน${['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'][wtop]}</b></div>` : ''}</section>
  <section class="card"><h3>แนวโน้ม 6 เดือน</h3><div class="cols">${mcols}</div></section>`;
}

function settingsView(){
  return `
  <section class="card"><h3>งบประมาณ</h3>
    <div class="setrow"><div class="l"><b>งบรายเดือน</b><span>ใช้คำนวณวงแหวนและเงินที่ใช้ได้ต่อวัน</span></div>
      <label class="field">฿<input id="budget" inputmode="decimal" placeholder="0" value="${settings.budget || ''}"></label></div></section>
  <section class="card"><h3>หน้าตา</h3>
    <div class="setrow"><div class="l"><b>ธีม</b></div>
      <div class="seg">${[['auto','อัตโนมัติ'],['light','สว่าง'],['dark','มืด']].map(([k,l]) => `<button class="${settings.theme === k ? 'on' : ''}" data-act="theme" data-v="${k}">${l}</button>`).join('')}</div></div></section>
  <section class="card"><h3>ข้อมูลของคุณ <small>${tx.length} รายการ</small></h3>
    <div class="setrow"><div class="l"><b>ส่งออก CSV</b><span>เปิดใน Excel / Google Sheets ได้</span></div><button class="btn ghost" data-act="export-csv">ส่งออก</button></div>
    <div class="setrow"><div class="l"><b>สำรองข้อมูล (JSON)</b><span>เก็บไว้เผื่อเปลี่ยนเครื่อง</span></div><button class="btn ghost" data-act="export-json">สำรอง</button></div>
    <div class="setrow"><div class="l"><b>นำเข้าจากไฟล์สำรอง</b><span>รวมกับข้อมูลที่มีอยู่</span></div><button class="btn ghost" data-act="import">นำเข้า</button></div>
    <div class="setrow"><div class="l"><b>ข้อมูลตัวอย่าง</b><span>เพิ่มรายการสมมติไว้ลองเล่น</span></div><button class="btn ghost" data-act="demo">เพิ่ม</button></div>
    <div class="setrow"><div class="l"><b style="color:var(--danger)">ลบข้อมูลทั้งหมด</b><span>ลบแล้วกู้คืนไม่ได้</span></div><button class="btn danger" data-act="wipe">ลบ</button></div></section>
  <p class="note">joddi เก็บข้อมูลไว้ในเครื่องนี้เท่านั้น ไม่ส่งขึ้นเซิร์ฟเวอร์<br>ล้างข้อมูลเบราว์เซอร์ = ข้อมูลหาย แนะนำให้สำรองเป็นระยะ</p>`;
}

/* ---------- แผ่นเพิ่ม/แก้ไขรายการ ---------- */
function openSheet(id){
  const t = id ? tx.find(x => x.id === id) : null;
  sheet = t ? {id, type:t.type, amt:String(t.amount), cat:t.cat, note:t.note || '', date:t.date}
            : {id:null, type:'exp', amt:'0', cat:'food', note:'', date:todayStr()};
  const wrap = document.getElementById('sheetwrap');
  wrap.hidden = false;
  renderSheet(true);
  document.body.style.overflow = 'hidden';
}
function closeSheet(){
  sheet = null;
  document.getElementById('sheetwrap').hidden = true;
  document.body.style.overflow = '';
}
function renderSheet(first){
  const s = sheet, el = document.getElementById('sheet');
  el.classList.toggle('noanim', !first);
  const recent = [...new Set(tx.filter(t => t.type === s.type && t.note).sort(cmpTx).map(t => t.note))].slice(0, 5);
  el.innerHTML = `<div class="grab"></div>
    <div class="typeseg"><button class="${s.type === 'exp' ? 'on' : ''}" data-act="type" data-v="exp">รายจ่าย</button><button class="${s.type === 'inc' ? 'on' : ''}" data-act="type" data-v="inc">รายรับ</button></div>
    <div class="amount"><span class="cur">฿</span><span class="v num ${s.type}">${esc(s.amt === '' ? '0' : addCommas(s.amt))}</span></div>
    <div class="cats">${CATS[s.type].map(c => `<button class="cat ${s.cat === c.id ? 'on' : ''}" data-act="cat" data-id="${c.id}"><span>${c.ico}</span>${c.name}</button>`).join('')}</div>
    <div class="meta"><label class="nt">📝<input id="note" maxlength="60" placeholder="โน้ต (ไม่บังคับ)" value="${esc(s.note)}"></label>
      <label class="dt"><input id="date" type="date" max="2999-12-31" value="${s.date}"></label></div>
    ${recent.length && !s.id ? `<div class="quick">${recent.map(n => `<button data-act="quick" data-note="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
    <div class="keys">${['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k => `<button class="key ${k === '⌫' ? 'ctl' : ''}" data-act="key" data-k="${k}" aria-label="${k === '⌫' ? 'ลบ' : k}">${k}</button>`).join('')}</div>
    <div class="actions">${s.id ? '<button class="btn danger" data-act="delete">ลบ</button>' : ''}<button class="btn" data-act="save">${s.id ? 'บันทึกการแก้ไข' : 'บันทึก'}</button></div>`;
}
function addCommas(a){ const [i, d] = a.split('.'); return Number(i).toLocaleString('en-US') + (d !== undefined ? '.' + d : ''); }
function pressKey(k){
  let a = sheet.amt;
  if(k === '⌫') a = a.length > 1 ? a.slice(0, -1) : '0';
  else if(k === '.'){ if(!a.includes('.')) a += '.'; }
  else {
    if(a === '0') a = k; else a += k;
    const [i, d] = a.split('.');
    if(i.length > 9 || (d && d.length > 2)) return;
  }
  sheet.amt = a;
  renderSheet(false);
}
function saveSheet(){
  const amount = parseFloat(sheet.amt);
  if(!(amount > 0)){ toast('ใส่จำนวนเงินก่อนนะ'); return; }
  if(!sheet.date) sheet.date = todayStr();
  const rec = {type:sheet.type, amount, cat:sheet.cat, note:sheet.note.trim(), date:sheet.date};
  if(sheet.id){ const t = tx.find(x => x.id === sheet.id); Object.assign(t, rec); }
  else tx.push({id:uid(), ts:Date.now(), ...rec});
  saveTx();
  ui.month = sheet.date.slice(0, 7);
  const edit = !!sheet.id;
  closeSheet();
  if(ui.tab === 'settings') ui.tab = 'home';
  render();
  toast(edit ? 'แก้ไขแล้ว ✓' : `จดแล้ว ✓ ${rec.type === 'exp' ? '−' : '+'}${baht(amount)}`);
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg, action){
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button data-act="toast-action">${esc(action.label)}</button>` : '');
  el._action = action && action.fn;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), action ? 5000 : 2200);
}

/* ---------- ส่งออก/นำเข้า ---------- */
function download(name, mime, content){
  const url = URL.createObjectURL(new Blob([content], {type:mime}));
  const a = Object.assign(document.createElement('a'), {href:url, download:name});
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportCsv(){
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [...tx].sort(cmpTx).map(t => [t.date, t.type === 'exp' ? 'รายจ่าย' : 'รายรับ', catOf(t.cat).name, t.amount, q(t.note || '')].join(','));
  download(`joddi-${todayStr()}.csv`, 'text/csv;charset=utf-8', '﻿วันที่,ประเภท,หมวด,จำนวน,โน้ต\n' + rows.join('\n'));
  toast('ส่งออก CSV แล้ว');
}
function exportJson(){
  download(`joddi-backup-${todayStr()}.json`, 'application/json', JSON.stringify({app:'joddi', v:1, settings, tx}, null, 2));
  toast('สำรองข้อมูลแล้ว');
}
function importJson(file){
  const r = new FileReader();
  r.onload = () => {
    try{
      const data = JSON.parse(r.result);
      const incoming = Array.isArray(data) ? data : data.tx;
      if(!Array.isArray(incoming)) throw 0;
      const have = new Set(tx.map(t => t.id));
      let n = 0;
      for(const t of incoming){
        if(!t || !(t.amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !t.id || have.has(t.id)) continue;
        tx.push({id:String(t.id), ts:t.ts || Date.now(), type:t.type === 'inc' ? 'inc' : 'exp', amount:Number(t.amount), cat:t.cat || 'other', note:String(t.note || '').slice(0, 60), date:t.date});
        have.add(t.id); n++;
      }
      if(data.settings && data.settings.budget && !settings.budget) settings.budget = Number(data.settings.budget) || 0;
      saveTx(); saveSettings(); render(); toast(`นำเข้า ${n} รายการ`);
    }catch{ toast('ไฟล์ไม่ถูกต้อง'); }
  };
  r.readAsText(file);
}

/* ---------- ข้อมูลตัวอย่าง ---------- */
function addDemo(){
  let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const samples = {
    food:[['ข้าวมันไก่',55],['ก๋วยเตี๋ยว',60],['ข้าวกะเพรา',65],['หมูกระทะ',380],['ส้มตำ+ไก่ย่าง',140],['เดลิเวอรี่',210]],
    drink:[['กาแฟ',65],['ชานม',45],['อเมริกาโน่',70]],
    transport:[['BTS',44],['วินมอเตอร์ไซค์',40],['Grab',150],['น้ำมัน',500]],
    shopping:[['เสื้อ',590],['ของใช้ในบ้าน',320],['Shopee',450]],
    bills:[['ค่าไฟ',1250],['ค่าเน็ต',599],['ค่ามือถือ',399]],
    fun:[['หนัง',260],['เกม',329],['Netflix',419]],
    health:[['ยา',120],['ฟิตเนส',900]],
  };
  const now = new Date(); let n = 0;
  for(let back = 0; back < 3; back++){
    const base = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const lastDay = back === 0 ? now.getDate() : daysIn(mkey(base));
    for(let d = 1; d <= lastDay; d++){
      const cnt = 1 + Math.floor(rnd() * 3);
      for(let k = 0; k < cnt; k++){
        const cat = pick(['food','food','food','drink','drink','transport','transport','shopping','fun','health']);
        const [note, amt] = pick(samples[cat]);
        tx.push({id:uid(), ts:Date.now() + n++, type:'exp', amount:Math.round(amt * (0.85 + rnd() * 0.3)), cat, note, date:ymd(new Date(base.getFullYear(), base.getMonth(), d))});
      }
    }
    for(const [cat, note, amt, day] of [['bills','ค่าไฟ',1250,5],['bills','ค่าเน็ต',599,8],['bills','ค่ามือถือ',399,10]])
      if(day <= lastDay) tx.push({id:uid(), ts:Date.now() + n++, type:'exp', amount:amt, cat, note, date:ymd(new Date(base.getFullYear(), base.getMonth(), day))});
    tx.push({id:uid(), ts:Date.now() + n++, type:'inc', amount:32000, cat:'salary', note:'เงินเดือน', date:ymd(new Date(base.getFullYear(), base.getMonth(), 1))});
  }
  if(!settings.budget){ settings.budget = 15000; saveSettings(); }
  saveTx(); render(); toast('เพิ่มข้อมูลตัวอย่างแล้ว');
}

/* ---------- ธีม ---------- */
function applyTheme(){
  const r = document.documentElement;
  if(settings.theme === 'auto') r.removeAttribute('data-theme'); else r.dataset.theme = settings.theme;
}

/* ---------- เหตุการณ์ ---------- */
const importEl = document.getElementById('importfile');
importEl.addEventListener('change', () => { if(importEl.files[0]) importJson(importEl.files[0]); importEl.value = ''; });

document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if(tab){ ui.tab = tab.dataset.tab; ui.selDay = null; render(); window.scrollTo(0, 0); return; }
  const el = e.target.closest('[data-act]');
  if(!el) return;
  const d = el.dataset;
  switch(d.act){
    case 'prev-month': ui.month = shiftMonth(ui.month, -1); ui.selDay = null; render(); break;
    case 'next-month': ui.month = shiftMonth(ui.month, 1); ui.selDay = null; render(); break;
    case 'this-month': ui.month = mkey(new Date()); ui.selDay = null; render(); break;
    case 'goto-settings': ui.tab = 'settings'; render(); window.scrollTo(0, 0); break;
    case 'goto-stats': ui.tab = 'stats'; render(); window.scrollTo(0, 0); break;
    case 'goto-list': ui.tab = 'list'; render(); window.scrollTo(0, 0); break;
    case 'add': openSheet(); break;
    case 'edit': openSheet(d.id); break;
    case 'close-sheet': closeSheet(); break;
    case 'sel-day': ui.selDay = ui.selDay === Number(d.day) ? null : Number(d.day); render(); break;
    case 'filter': ui.cat = d.cat; render(); break;
    case 'theme': settings.theme = d.v; saveSettings(); applyTheme(); render(); break;
    case 'export-csv': exportCsv(); break;
    case 'export-json': exportJson(); break;
    case 'import': importEl.click(); break;
    case 'demo': addDemo(); break;
    case 'wipe':
      if(confirm('ลบข้อมูลทั้งหมดใน joddi? กู้คืนไม่ได้นะ')){ tx = []; saveTx(); render(); toast('ลบข้อมูลทั้งหมดแล้ว'); }
      break;
    case 'toast-action': { const fn = document.getElementById('toast')._action; document.getElementById('toast').classList.remove('show'); if(fn) fn(); break; }
    // ในแผ่นเพิ่มรายการ
    case 'type': if(sheet.type !== d.v){ sheet.type = d.v; sheet.cat = CATS[d.v][0].id; renderSheet(false); } break;
    case 'cat': sheet.cat = d.id; renderSheet(false); break;
    case 'key': pressKey(d.k); break;
    case 'quick': {
      sheet.note = d.note;
      const prev = tx.filter(t => t.note === d.note && t.type === sheet.type).sort(cmpTx)[0];
      if(prev){ sheet.cat = prev.cat; if(sheet.amt === '0') sheet.amt = String(prev.amount); }
      renderSheet(false); break;
    }
    case 'save': saveSheet(); break;
    case 'delete': {
      const t = tx.find(x => x.id === sheet.id), idx = tx.indexOf(t);
      tx.splice(idx, 1); saveTx(); closeSheet(); render();
      toast('ลบรายการแล้ว', {label:'เลิกทำ', fn: () => { tx.splice(idx, 0, t); saveTx(); render(); }});
      break;
    }
  }
});

document.addEventListener('input', e => {
  if(e.target.id === 'q'){
    ui.q = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const q = document.getElementById('q'); q.focus(); q.setSelectionRange(pos, pos);
  } else if(e.target.id === 'note' && sheet) sheet.note = e.target.value;
  else if(e.target.id === 'date' && sheet) sheet.date = e.target.value;
  else if(e.target.id === 'budget'){
    settings.budget = Math.max(0, parseFloat(e.target.value) || 0); saveSettings();
  }
});

document.addEventListener('keydown', e => {
  if(!sheet){ return; }
  if(e.key === 'Escape'){ closeSheet(); return; }
  if(e.target.tagName === 'INPUT'){ if(e.key === 'Enter'){ e.preventDefault(); saveSheet(); } return; }
  if(/^[0-9.]$/.test(e.key)) pressKey(e.key);
  else if(e.key === 'Backspace') pressKey('⌫');
  else if(e.key === 'Enter'){ e.preventDefault(); saveSheet(); }
});

/* ---------- เริ่มต้น ---------- */
applyTheme();
render();
if('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'localhost'){
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
