(async()=>{
 const q=new URLSearchParams(location.search);if(q.get('recover')!=='1')return;
 const wait=ms=>new Promise(r=>setTimeout(r,ms));while(!document.body)await wait(20);
 const box=document.createElement('div');box.style='position:fixed;inset:0;z-index:999999;background:#fff;padding:30px;font:16px/1.7 sans-serif;color:#123;overflow:auto';box.innerHTML='<h2>正在扫描历史产品配置…</h2><p>请勿关闭页面，也不要点击后台“保存并同步”。</p>';document.body.appendChild(box);
 try{
  const s=[...document.scripts].find(x=>/\/assets\/index-.*\.js/.test(x.src));if(!s)throw Error('未找到应用脚本');
  const t=await fetch(s.src,{cache:'no-store'}).then(r=>r.text());
  const url=t.match(/https:\/\/[a-z0-9]+\.supabase\.co/i)?.[0],key=t.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];if(!url||!key)throw Error('无法读取云端连接配置');
  const H={apikey:key,Authorization:`Bearer ${key}`},T='benefit_configs';
  const get=async p=>{const r=await fetch(`${url}/rest/v1/${T}${p}`,{headers:H,cache:'no-store'});if(!r.ok)throw Error(await r.text());return r.json()};
  const post=async(id,payload)=>{const r=await fetch(`${url}/rest/v1/${T}?on_conflict=id`,{method:'POST',headers:{...H,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id,payload,updated_at:new Date().toISOString()})});if(!r.ok)throw Error(await r.text())};
  const core=await get('?id=in.(products,products_draft,products_published)&select=id,payload,updated_at');
  const shares=await get('?id=like.share_%25&select=id,payload,updated_at&order=updated_at.desc&limit=500');
  const arr=p=>Array.isArray(p)?p:Array.isArray(p?.products)?p.products:[];
  const generic=n=>/新产品|未命名|待配置|测试产品/.test(String(n||''));
  const score=p=>{let n=0;if(p?.name&&!generic(p.name))n+=10;if(p?.grade)n+=2;if(p?.stage)n+=2;if(p?.status==='在售')n+=2;if(p?.core?.servicePeriod)n+=3;if(+p?.core?.liveLessons)n+=2;if(+p?.core?.knowledgeVideos)n+=2;const z=p?.pricing||{};if([z.originalPerSubject,z.singlePerSubject,z.twoPerSubject,z.threePlusPerSubject].some(v=>+v>0))n+=6;if(p?.giftSelections?.length)n+=3;if(p?.physicalGiftSelections?.length)n+=2;if(p?.customGiftItems?.length)n+=3;if(p?.customPhysicalItems?.length)n+=2;if(p?.customCourseData||p?.parsedCourseData||p?.annualCourseData)n+=3;return n};
  const m=new Map(),add=(p,src,at)=>{if(!p?.id||generic(p.name))return;const c={p,src,at:at||'',s:score(p)};const o=m.get(p.id);if(!o||c.s>o.s||(c.s===o.s&&c.at>o.at))m.set(p.id,c)};
  core.forEach(r=>arr(r.payload).forEach(p=>add(p,r.id,r.updated_at)));shares.forEach(r=>{const p=r.payload?.products?.[0];if(p)add(p,r.id,r.updated_at)});
  const best=[...m.values()].filter(x=>x.s>=12);const d=new Map();best.forEach(x=>{const k=`${x.p.grade}|${x.p.name}|${x.p.stage}`;const o=d.get(k);if(!o||x.s>o.s||(x.s===o.s&&x.at>o.at))d.set(k,x)});const found=[...d.values()].sort((a,b)=>String(a.p.grade).localeCompare(String(b.p.grade),'zh-CN')||String(a.p.name).localeCompare(String(b.p.name),'zh-CN'));
  if(!found.length)throw Error('未找到可自动恢复的历史产品快照');
  box.innerHTML=`<h2>找到 ${found.length} 个历史产品</h2><p>扫描了 ${shares.length} 条历史分享快照。确认后会先备份当前错误数据，再恢复云端 draft / published。</p><ul>${found.map(x=>`<li><b>${x.p.grade} · ${x.p.name}</b>　${x.p.stage||''}　${x.p.status||''}</li>`).join('')}</ul><button id="go" style="padding:12px 20px;background:#1677ff;color:#fff;border:0;border-radius:8px;font-weight:700">确认恢复</button> <button id="no" style="padding:12px 20px">取消</button>`;
  document.querySelector('#no').onclick=()=>{q.delete('recover');location.search=q.toString()};
  document.querySelector('#go').onclick=async()=>{if(!confirm(`确认恢复这 ${found.length} 个产品吗？`))return;box.innerHTML='<h2>正在备份并恢复，请稍候…</h2>';const by=Object.fromEntries(core.map(r=>[r.id,r]));const ts=Date.now();await post(`recovery_backup_${ts}_draft`,by.products_draft?.payload||null);await post(`recovery_backup_${ts}_published`,by.products_published?.payload||null);const libs=[...core].sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))).find(r=>r.payload?.gradeCourseLibraries)?.payload?.gradeCourseLibraries||{};const payload={products:found.map(x=>x.p),gradeCourseLibraries:libs,version:Date.now(),recoveredAt:new Date().toISOString()};await post('products_draft',payload);await post('products_published',payload);box.innerHTML=`<h2>恢复完成</h2><p>已恢复 ${found.length} 个产品，页面即将刷新。</p>`;await wait(1200);q.delete('recover');q.set('restored',Date.now());location.search=q.toString()};
 }catch(e){box.innerHTML=`<h2 style="color:#c33">恢复扫描失败</h2><pre style="white-space:pre-wrap">${String(e?.message||e)}</pre><p>请不要继续保存配置。</p>`}
})();
