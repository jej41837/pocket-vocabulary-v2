import './csv.js';

(() => {
  const W='pocket-vocab-words-v1', P='pocket-vocab-prefs-v1', C='pocket-vocab-chapters-v1', K='pocket-vocab-gemini-key-v1';
  const labels={definition:'영영',example:'예문',synonyms:'동의어',antonyms:'반의어',derived:'파생어',related:'유의어'};
  const blank=()=>({definition:'',example:'',exampleKo:'',exampleMeaning:'',synonyms:'',antonyms:'',derived:'',related:''});
  const samples=[
    {id:'sample-cultivate',word:'cultivate',meanings:['경작하다, 재배하다','기르다, 함양하다','관계를 쌓다'],chapter:'Day 1',details:{definition:'To develop a quality, skill, or feeling through deliberate effort.\nTo encourage something to grow or improve over time.',example:'The course helps students cultivate critical thinking.',exampleKo:'이 과정은 학생들이 비판적 사고력을 기르도록 돕는다.',exampleMeaning:'기르도록',synonyms:'nurture, develop, foster',antonyms:'neglect',derived:'cultivation, cultivated',related:'grow, encourage'}},
    {id:'sample-resilient',word:'resilient',meanings:['회복력이 있는','탄력 있는'],chapter:'Day 1',details:{definition:'able to recover quickly from difficulty',example:'She remained resilient through every change.',exampleKo:'그녀는 모든 변화 속에서도 회복력을 유지했다.',exampleMeaning:'회복력을 유지했다',synonyms:'strong, flexible',antonyms:'fragile',derived:'resilience, resiliently',related:'durable, adaptable'}},
    {id:'sample-insight',word:'insight',meanings:['통찰력','이해'],chapter:'Day 1',details:{definition:'a clear and deep understanding',example:'The data gave us a useful insight.',exampleKo:'그 데이터는 우리에게 유용한 통찰력을 주었다.',exampleMeaning:'통찰력',synonyms:'perception, understanding',antonyms:'ignorance',derived:'insightful',related:'awareness, intuition'}},
    {id:'sample-derive',word:'derive',meanings:['이끌어내다','유래하다'],chapter:'Day 2',details:{definition:'to obtain something from a source',example:'We can derive the formula from this result.',exampleKo:'우리는 이 결과로부터 공식을 이끌어낼 수 있다.',exampleMeaning:'이끌어낼',synonyms:'obtain, deduce',antonyms:'',derived:'derivation, derivative',related:'infer, originate'}}
  ];
  const sampleDefinitions={
    'sample-cultivate':['to prepare and use land for growing crops','to develop a quality or skill through effort','to develop and maintain a relationship over time'],
    'sample-resilient':['able to recover quickly from difficulty','able to return to its original shape after being bent'],
    'sample-insight':['the ability to understand a situation deeply','an understanding of something'],
    'sample-derive':['to obtain something from a source','to come from or originate in something']
  };
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const load=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
  const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random();
  const split=v=>(Array.isArray(v)?v:String(v||'').split(/\n|\s*;\s*/)).map(x=>String(x).trim()).filter(Boolean);
  const definitionLines=value=>String(value||'').split(/\r?\n/).map(x=>x.trim());
  const alignedDefinitions=(meanings,values)=>meanings.map((_,i)=>String(values[i]||'').trim());
  const norm=x=>{const demo=samples.find(s=>s.id===x.id)?.details||{},meanings=split(x.meanings||x.meaning),legacy=definitionLines(x.details?.definition),starter=x.details?.definition===demo.definition&&sampleDefinitions[x.id]?sampleDefinitions[x.id]:legacy;return{id:x.id||uid(),word:String(x.word||'').trim(),meanings,definitions:alignedDefinitions(meanings,Array.isArray(x.definitions)?x.definitions:starter),chapter:String(x.chapter||'Day 1').trim()||'Day 1',details:{...blank(),...(x.details||{}),definition:'',exampleKo:x.details?.exampleKo||demo.exampleKo||'',exampleMeaning:x.details?.exampleMeaning||demo.exampleMeaning||''}}};
  const esc=v=>String(v||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const escRe=v=>String(v).replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
  const mix=a=>[...a].sort(()=>Math.random()-.5);
  const initial=load(W,samples).map(norm).filter(x=>x.word&&x.meanings.length);
  const st={words:initial,chapters:[...new Set([...load(C,['Day 1','Day 2']).map(String),...initial.map(x=>x.chapter)])],prefs:{maskWord:false,maskMeaning:true,maskDetails:false,view:'card',filters:Object.keys(labels),activeChapter:'all',...load(P,{})},shown:new Map(),quiz:null,pendingImport:[]};
  const study={index:0,revealed:false,selected:-1,panel:'definition',touch:null,lastTap:0,lastTouchToggle:0,lastWheel:0};
  const e={words:$('#wordsContainer'),empty:$('#emptyState'),count:$('#wordCount'),search:$('#searchInput'),toast:$('#toast'),edit:$('#editModal'),filter:$('#filterModal'),imp:$('#ocrModal'),chapter:$('#chapterModal'),apiKeyModal:$('#apiKeyModal'),form:$('#wordForm'),wordId:$('#wordId'),word:$('#wordInput'),meaning:$('#meaningInput'),chapterInput:$('#chapterInput'),definition:$('#definitionInput'),example:$('#exampleInput'),exampleKo:$('#exampleKoInput'),exampleMeaning:$('#exampleMeaningInput'),synonyms:$('#synonymsInput'),antonyms:$('#antonymsInput'),derived:$('#derivedInput'),related:$('#relatedInput'),text:$('#ocrText'),image:$('#imageInput'),camera:$('#cameraInput'),gallery:$('#galleryInput'),excel:$('#excelInput'),preview:$('#imagePreview'),progress:$('#ocrProgress'),bar:$('#ocrProgressBar'),status:$('#ocrStatus'),previewPanel:$('#importPreviewPanel'),previewTable:$('#importPreviewTable'),chapterSelect:$('#chapterSelect'),chapterLabel:$('#activeChapterLabel'),newChapter:$('#newChapterInput'),book:$('#wordbookView'),test:$('#testView'),intro:$('#testIntro'),quiz:$('#quizArea'),result:$('#resultArea')};
  const apiKey=()=>sessionStorage.getItem(K)||localStorage.getItem(K)||'';
  const apiHeaders=()=>{const h={'Content-Type':'application/json'},key=apiKey();if(key)h['X-Gemini-Api-Key']=key;return h};
  const save=()=>{localStorage.setItem(W,JSON.stringify(st.words));localStorage.setItem(C,JSON.stringify(st.chapters));localStorage.setItem(P,JSON.stringify(st.prefs))};
  const mtext=(x,sep=' · ')=>x.meanings.join(sep);
  const setFor=i=>st.shown.get(i)||new Set(), visible=(i,f)=>setFor(i).has(f);
  function mark(i,f,v){const s=setFor(i);v?s.add(f):s.delete(f);st.shown.set(i,s)}
  function masked(i,f){const k=f==='word'||f==='exampleWord'?'maskWord':f==='meaning'?'maskMeaning':'maskDetails';return st.prefs[k]&&!visible(i,f)}
  let timer;function toast(x){e.toast.textContent=x;e.toast.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>e.toast.classList.remove('show'),2300)}
  function open(x){x.classList.remove('hidden');document.body.style.overflow='hidden'}function close(x){x.classList.add('hidden');if(!$$('.modal-backdrop:not(.hidden)').length)document.body.style.overflow=''}

  function renderChapters(){
    const a=['<option value="all">전체 챕터</option>',...st.chapters.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>')].join('');
    e.chapterSelect.innerHTML=a;e.chapterSelect.value=st.prefs.activeChapter;if(!e.chapterSelect.value){st.prefs.activeChapter='all';e.chapterSelect.value='all'}
    e.chapterLabel.textContent=st.prefs.activeChapter==='all'?'전체':st.prefs.activeChapter;
    e.chapterInput.innerHTML=st.chapters.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
  }
  function emphasize(text,term,english=false,maskId=''){
    const source=String(text||''),target=String(term||'').trim();
    if(!target)return{html:esc(source),found:false};
    const pattern=english?new RegExp('(^|[^A-Za-z])('+escRe(target)+'(?:s|es|d|ed|ing)?)(?=$|[^A-Za-z])','gi'):new RegExp('('+escRe(target)+')','g');
    let html='',last=0,found=false;
    for(const match of source.matchAll(pattern)){
      const before=english?match[1].length:0,termText=english?match[2]:match[1],start=match.index+before;
      html+=esc(source.slice(last,start))+(maskId?'<button type="button" class="inline-word-mask" data-field="exampleWord" data-id="'+esc(maskId)+'">••••</button>':'<strong>'+esc(termText)+'</strong>');
      last=start+termText.length;found=true;
    }
    return{html:html+esc(source.slice(last)),found};
  }
  function exampleHtml(word,hideWord=false){
    const details=word.details,english=details.example?emphasize(details.example,word.word,true,hideWord?word.id:'').html:'<span class="example-missing">영어 예문을 추가해 주세요.</span>';
    const candidates=[details.exampleMeaning,...word.meanings.flatMap(m=>m.split(/[,;]+/))].map(x=>String(x||'').trim()).filter(Boolean);
    const used=candidates.find(x=>String(details.exampleKo||'').includes(x))||'';
    const korean=details.exampleKo?emphasize(details.exampleKo,used).html:'<span class="example-missing">한국어 예문을 추가해 주세요.</span>';
    return '<div class="example-pair"><p lang="en">'+english+'</p><p lang="ko">'+korean+'</p></div>';
  }
  function ex(word){return exampleHtml(word,masked(word.id,'exampleWord'))}
  function info(word){return st.prefs.filters.filter(k=>k==='definition'?word.definitions.some(Boolean):k==='example'?(word.details.example||word.details.exampleKo):word.details[k]).map(k=>{const hide=masked(word.id,'details'),x=k==='definition'?word.definitions.map((value,i)=>value?'<div><strong>'+esc(word.meanings[i])+'</strong> · '+esc(value)+'</div>':'').join(''):k==='example'?ex(word):esc(word.details[k]);return '<div class="detail-row '+(k==='example'?'example':'')+'"><dt>'+labels[k]+'</dt><dd class="'+(hide?'masked':'')+'" '+(hide?'data-field="details" data-id="'+word.id+'"':'')+'>'+x+'</dd></div>'}).join('')}
  function cardVisible(x){return(st.prefs.maskWord&&visible(x.id,'word'))||(st.prefs.maskMeaning&&visible(x.id,'meaning'))||(st.prefs.maskDetails&&visible(x.id,'details'))||(st.prefs.maskWord&&x.details.example&&visible(x.id,'exampleWord'))}
  function render(){
    const q=e.search.value.trim().toLowerCase(), list=st.words.filter(x=>(st.prefs.activeChapter==='all'||x.chapter===st.prefs.activeChapter)&&(x.word+' '+mtext(x)+' '+x.definitions.join(' ')+' '+Object.values(x.details).join(' ')).toLowerCase().includes(q));
    e.count.textContent=st.words.length;e.words.classList.toggle('list-mode',st.prefs.view==='list');
    e.words.innerHTML=list.map((x,n)=>{const d=info(x),hasMask=st.prefs.maskWord||st.prefs.maskMeaning||(st.prefs.maskDetails&&d);return '<article class="word-card"><span class="chapter-tag">'+esc(x.chapter)+'</span><div class="word-top"><div class="word-main"><div><div class="word-index">WORD '+String(n+1).padStart(2,'0')+'</div><h3 class="'+(masked(x.id,'word')?'masked':'')+'" data-field="word" data-id="'+x.id+'">'+esc(x.word)+'</h3></div><ul class="meaning '+(masked(x.id,'meaning')?'masked':'')+'" data-field="meaning" data-id="'+x.id+'">'+x.meanings.map(y=>'<li>'+esc(y)+'</li>').join('')+'</ul></div><div class="word-actions"><button class="mini-button edit-word" data-id="'+x.id+'" type="button"><svg viewBox="0 0 24 24"><path d="m4 20 4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10zM14 7l3 3"/></svg></button><button class="mini-button delete-word" data-id="'+x.id+'" type="button"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 4h6M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg></button></div></div>'+(d?'<dl class="details">'+d+'</dl>':'')+(hasMask?'<button class="reveal-button" data-card-toggle="'+x.id+'" type="button">'+(cardVisible(x)?'다시 가리기':'정답 보기')+'</button>':'')+'</article>'}).join('');
    e.empty.classList.toggle('hidden',!!list.length);e.empty.querySelector('h3').textContent=q?'검색 결과가 없어요':'이 챕터에는 단어가 없어요';e.empty.querySelector('p').textContent=q?'다른 단어나 뜻으로 검색해 보세요.':'직접 입력하거나 사진·엑셀 파일을 불러와 보세요.';$('#emptyAddButton').classList.toggle('hidden',!!q);available();renderStudy();
  }
  function view(x){st.prefs.view=x;save();$('#cardViewButton').classList.toggle('active',x==='card');$('#listViewButton').classList.toggle('active',x==='list');render()}
  function form(i=''){
    e.form.reset();renderChapters();e.wordId.value=i;const x=st.words.find(w=>w.id===i);$('#editModalTitle').textContent=x?'단어 정보 수정':'새 단어 추가';
    if(x){e.word.value=x.word;e.meaning.value=x.meanings.join('\n');e.chapterInput.value=x.chapter;e.definition.value=x.definitions.join('\n');e.example.value=x.details.example;e.exampleKo.value=x.details.exampleKo;e.exampleMeaning.value=x.details.exampleMeaning;e.synonyms.value=x.details.synonyms;e.antonyms.value=x.details.antonyms;e.derived.value=x.details.derived;e.related.value=x.details.related}else e.chapterInput.value=st.prefs.activeChapter==='all'?st.chapters[0]:st.prefs.activeChapter;open(e.edit);
  }
  function submit(ev){
    ev.preventDefault();const meanings=split(e.meaning.value),x={id:e.wordId.value||uid(),word:e.word.value.trim(),meanings,definitions:alignedDefinitions(meanings,definitionLines(e.definition.value)),chapter:e.chapterInput.value||'Day 1',details:{...blank(),example:e.example.value.trim(),exampleKo:e.exampleKo.value.trim(),exampleMeaning:e.exampleMeaning.value.trim(),synonyms:e.synonyms.value.trim(),antonyms:e.antonyms.value.trim(),derived:e.derived.value.trim(),related:e.related.value.trim()}};
    if(!x.word||!x.meanings.length)return toast('영단어와 뜻을 입력해 주세요');
    const previous=st.words.find(w=>w.id===x.id),exampleChanged=!previous||previous.details.example!==x.details.example||previous.details.exampleKo!==x.details.exampleKo;
    if(exampleChanged&&!!x.details.example!==!!x.details.exampleKo)return toast('영어와 한국어 예문을 함께 입력해 주세요');
    if(x.details.exampleMeaning&&!x.details.exampleKo.includes(x.details.exampleMeaning)&&(exampleChanged||previous?.details.exampleMeaning!==x.details.exampleMeaning))return toast('사용된 뜻은 한국어 예문에 적힌 표현으로 입력해 주세요');
    const i=st.words.findIndex(w=>w.id===x.id);i<0?st.words.unshift(x):st.words[i]=x;if(!st.chapters.includes(x.chapter))st.chapters.push(x.chapter);save();renderChapters();render();close(e.edit);if(i<0)show('wordbook');toast(i<0?'새 단어를 추가했어요':'단어 정보를 수정했어요');
  }
  function remove(i){const x=st.words.find(w=>w.id===i);if(!x)return;st.words=st.words.filter(w=>w.id!==i);st.shown.delete(i);studyReset();save();render();toast('‘'+x.word+'’ 단어를 삭제했어요')}
  function forms(x){x=x.toLowerCase().trim();if(!/^[a-z-]+$/.test(x))return'';const a=new Set();if(x.endsWith('y')){a.add(x.slice(0,-1)+'ies');a.add(x.slice(0,-1)+'ied')}else{a.add(x+'s');a.add(x+'ed');a.add(x+'ing')}if(x.endsWith('ive'))a.add(x.slice(0,-3)+'ion');return [...a].slice(0,4).join(', ')}

  // [Gemini 연동] 자동정보 채우기 (공공사전 대체)
  async function geminiAutoFill(){
    const word=e.word.value.trim(),meanings=split(e.meaning.value);if(!word)return toast('먼저 영단어를 입력해 주세요');
    const b=$('#generateDetailsButton');b.disabled=true;b.textContent='Gemini가 추가 정보를 분석하는 중…';
    try{
      const r=await fetch('/api/vocab',{
        method:'POST',
        headers:apiHeaders(),
        body:JSON.stringify({type:'enrich',word,meanings,example:e.example.value.trim()})
      });
      if(!r.ok){const x=await r.json().catch(()=>({}));throw Error(x.error||'Gemini API 오류')}
      const d=await r.json();
      if(d.definitions){const current=definitionLines(e.definition.value),generated=alignedDefinitions(meanings,d.definitions);e.definition.value=meanings.map((_,i)=>current[i]||generated[i]||'').join('\n')}
      if(!e.example.value && d.example) e.example.value = d.example;
      if(!e.exampleKo.value && d.exampleKo) e.exampleKo.value = d.exampleKo;
      if(!e.exampleMeaning.value && d.exampleMeaning) e.exampleMeaning.value = d.exampleMeaning;
      if(!e.synonyms.value && d.synonyms) e.synonyms.value = d.synonyms;
      if(!e.antonyms.value && d.antonyms) e.antonyms.value = d.antonyms;
      if(!e.derived.value && d.derived) e.derived.value = d.derived;
      if(!e.related.value && d.related) e.related.value = d.related;
      else if(!e.related.value && d.synonyms) e.related.value = d.synonyms;
      toast('Gemini가 추가 정보를 채웠어요. 확인 후 저장해 주세요');
    }catch(error){
      console.error(error);
      toast(error.message||'Gemini 호출 실패 혹은 정보를 찾지 못했어요.');
    }finally{
      b.disabled=false;b.innerHTML='<span>✦</span> 영어·뜻만 입력했다면 추가 정보 자동 채우기';
    }
  }

  // [Gemini 연동] OCR 사진 분석
  function currentImportChapter(){return st.prefs.activeChapter==='all'?(st.chapters[0]||'Day 1'):st.prefs.activeChapter}
  function importPreview(rows){
    const fallback=currentImportChapter(),items=rows.map(x=>({word:String(x.word||'').trim(),meanings:split(x.meanings||x.meaning),chapter:String(x.chapter||fallback).trim()||fallback,details:{...blank(),...(x.details||{}),definition:Array.isArray(x.definitions)?x.definitions.join('\n'):x.details?.definition||''}})).filter(x=>x.word||x.meanings.length);
    if(!items.length){e.previewPanel.classList.add('hidden');return toast('가져올 단어를 찾지 못했어요')}
    const opts=[...new Set([...st.chapters,...items.map(x=>x.chapter),fallback])];
    $('#bulkChapterSelect').innerHTML=opts.map(c=>'<option>'+esc(c)+'</option>').join('');
    $('#selectAllImport').checked=true;
    const fields=[['definition','영영풀이 (뜻 순서대로 줄바꿈)'],['example','영어 예문'],['exampleKo','한국어 예문'],['exampleMeaning','예문에서 사용된 뜻'],['synonyms','동의어'],['antonyms','반의어'],['derived','파생어'],['related','유의어']];
    e.previewTable.innerHTML='<div class="preview-table-wrap"><table class="preview-table detail-preview"><thead><tr><th>선택</th><th>영어</th><th>뜻 (여러 뜻은 ;)</th>'+fields.map(f=>'<th>'+f[1]+'</th>').join('')+'<th>챕터</th><th></th></tr></thead><tbody>'+items.map((x,i)=>'<tr><td><input data-select type="checkbox" checked aria-label="'+(i+1)+'번째 선택"></td><td><input data-col="word" value="'+esc(x.word)+'"></td><td><textarea data-col="meaning">'+esc(x.meanings.join('; '))+'</textarea></td>'+fields.map(f=>'<td><textarea data-col="'+f[0]+'">'+esc(x.details[f[0]]||'')+'</textarea></td>').join('')+'<td><select data-col="chapter">'+opts.map(c=>'<option '+(c===x.chapter?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select></td><td><button class="preview-remove" data-remove type="button" aria-label="행 삭제">×</button></td></tr>').join('')+'</tbody></table></div>';
    e.previewPanel.classList.remove('hidden');
    e.previewPanel.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function imageData(file){
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('사진을 읽지 못했어요'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(Error('지원하지 않는 사진 형식이에요'));img.onload=()=>{const max=1800,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.86))};img.src=reader.result};reader.readAsDataURL(file)})
  }
  async function runGeminiOCR(file) {
    const status = $('#ocrStatus'), bar = $('#ocrProgressBar');
    if (!file) return;
    try {
      e.progress.classList.remove('hidden');e.previewPanel.classList.add('hidden');
      e.preview.src=URL.createObjectURL(file);e.preview.classList.remove('hidden');
      status.textContent = '이미지를 준비하는 중…'; bar.style.width = '30%';
      const base64Image = await imageData(file);
      status.textContent = 'Gemini가 단어장을 분석하고 있어요…'; bar.style.width = '60%';
      const response = await fetch('/api/vocab', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ type: 'ocr', image: base64Image })
      });
      if (!response.ok) { const x = await response.json().catch(() => ({})); throw new Error(x.error || 'Gemini API 오류'); }
      const result = await response.json();
      const formatted = Array.isArray(result) ? result.map(x => x.word + ' | ' + (Array.isArray(x.meanings) ? x.meanings.join('; ') : x.meanings)).join('\n') : '';
      $('#ocrText').value = formatted;
      importPreview(Array.isArray(result)?result:[]);
      bar.style.width = '100%'; status.textContent = '분석 완료! 아래 미리보기에서 확인하세요.';
    } catch (error) {
      console.error(error);
      status.textContent = error.message || 'AI 분석에 실패했어요. 직접 입력이나 엑셀을 이용해 주세요.';
    }
  }

  function add(a){
    const seen=new Set(st.words.map(x=>x.word.toLowerCase()+'|'+x.chapter)),fresh=a.map(norm).filter(x=>x.word&&x.meanings.length&&!seen.has(x.word.toLowerCase()+'|'+x.chapter));if(!fresh.length)return toast('새로 추가할 단어가 없어요');st.words=[...fresh,...st.words];fresh.forEach(x=>{if(!st.chapters.includes(x.chapter))st.chapters.push(x.chapter)});save();renderChapters();render();show('wordbook');toast(fresh.length+'개 단어를 추가했어요');
  }
  function textImport(){const c=st.prefs.activeChapter==='all'?st.chapters[0]:st.prefs.activeChapter,a=e.text.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(x=>{const p=x.split(/\s*[|｜]\s*/);return p.length>1?{id:uid(),word:p.shift(),meanings:split(p.join('|')),chapter:c,details:blank()}:null}).filter(Boolean);if(!a.length)return toast('‘단어 | 뜻’ 형식으로 한 줄씩 입력해 주세요');add(a);close(e.imp);e.text.value='';e.image.value='';e.preview.classList.add('hidden');e.progress.classList.add('hidden')}
  async function excel(file){
    if(!file)return;
    try{
      const csv=/\.csv$/i.test(file.name);
      if(!csv&&!window.XLSX)throw Error('엑셀 도구를 불러오지 못했어요');
      let a;
      if(csv)a=await window.VocabCsv.read(file);
      else{const b=XLSX.read(await file.arrayBuffer(),{type:'array'});a=XLSX.utils.sheet_to_json(b.Sheets[b.SheetNames[0]],{header:1,defval:''})}
      if(a.length<2)throw Error('데이터가 없어요');
      const h=a.shift().map(x=>String(x).replace(/^\uFEFF/,'').trim().toLowerCase()),f=k=>h.findIndex(x=>k.some(y=>x.includes(y))),wi=f(['영단어','영어','word','english']),mi=f(['뜻','의미','meaning','korean']),ci=f(['챕터','chapter','day','단원']),di=f(['영영풀이','영영 풀이','definition']),ei=f(['영어 예문','english example','example']),ki=f(['한국어 예문','예문 번역','korean example','exampleko']),ui=f(['사용된 뜻','examplemeaning']),c=currentImportChapter();
      importPreview(a.map(r=>({word:String(r[wi>=0?wi:0]||'').trim(),meanings:split(r[mi>=0?mi:1]),chapter:String(ci>=0?r[ci]:c).trim()||c,definitions:di>=0?definitionLines(r[di]):[],details:{...blank(),example:ei>=0?String(r[ei]||''):'',exampleKo:ki>=0?String(r[ki]||''):'',exampleMeaning:ui>=0?String(r[ui]||''):''}})));
      toast('미리보기에서 수정한 뒤 저장해 주세요');
    }catch(x){console.error(x);toast(x.message||'파일을 읽지 못했어요. 첫 행의 열 이름을 확인해 주세요')}
  }
  function studyWords(){return st.prefs.activeChapter==='all'?st.words:st.words.filter(x=>x.chapter===st.prefs.activeChapter)}
  function studyReset(){study.revealed=false;study.selected=-1;study.panel='definition'}
  function studyMove(step){const list=studyWords();if(!list.length)return;study.index=(study.index+step+list.length)%list.length;studyReset();renderStudy();$('#studyContent').scrollTop=0}
  function studyChips(value,kind){return String(value||'').split(/[,;]+/).map(x=>x.trim()).filter(Boolean).map(x=>'<span class="study-chip '+kind+'">'+esc(x)+'</span>').join('')}
  function renderStudy(){
    const list=studyWords(),content=$('#studyContent'),count=$('#studyProgressText'),bar=$('#studyProgressBar');
    $('#studyChapterLabel').textContent=st.prefs.activeChapter==='all'?'Daily vocabulary':st.prefs.activeChapter;
    if(study.index>=list.length)study.index=0;
    count.textContent=list.length?(study.index+1)+' / '+list.length:'0 / 0';
    bar.style.width=list.length?((study.index+1)/list.length*100)+'%':'0%';
    if(!list.length){content.innerHTML='<div class="study-empty"><span>▤</span><h2>아직 학습할 단어가 없어요</h2><p>단어를 추가하면 이곳에서 한 장씩 공부할 수 있어요.</p><button type="button" class="study-empty-add">단어 추가하기</button></div>';$('#studyFooterHint').textContent='';return}
    const x=list[study.index],selected=study.selected>=0;
    const intro='<button id="studyWordCard" class="study-word-card '+(study.revealed?'is-revealed':'')+'" type="button" aria-label="'+esc(x.word)+(study.revealed?' — 두 번 눌러 단어만 보기':' — 두 번 눌러 뜻 보기')+'"><strong>'+esc(x.word)+'</strong>'+(study.revealed?'<small>WORD · '+esc(x.chapter)+'</small>':'')+'</button>';
    if(!study.revealed){content.innerHTML='<div class="study-default">'+intro+'<p class="study-recall">뜻을 떠올린 뒤 단어를 두 번 눌러보세요</p></div>';$('#studyFooterHint').textContent='↖  단어를 두 번 눌러 뜻 보기';return}
    const choices='<div class="study-meaning-heading"><strong>뜻을 선택하세요</strong><small>'+x.meanings.length+'개의 뜻</small></div><div class="study-meanings">'+x.meanings.map((m,i)=>'<button type="button" class="study-meaning '+(i===study.selected?'selected':'')+'" data-study-meaning="'+i+'"><span class="study-number">'+(i+1)+'</span><strong>'+esc(m)+'</strong><span class="study-chevron">'+(i===study.selected?'⌄':'›')+'</span></button>'+(i===study.selected?studyPanel(x,i):'')).join('')+'</div>';
    content.innerHTML='<div class="study-expanded">'+intro+choices+'</div>';
    $('#studyFooterHint').textContent=selected?'↖  정보 박스를 왼쪽으로 밀어 예문 보기':'↖  뜻 카드를 눌러 자세히 보기';
  }
  function studyPanel(x,index){
    const definition=x.definitions[index]?'<ol class="study-definitions"><li>'+esc(x.definitions[index])+'</li></ol>':'<p class="study-no-detail">이 뜻에 등록된 영영 풀이가 없어요.</p>';
    const chips='<div class="study-chip-row"><span>동의어</span><div>'+ (studyChips(x.details.synonyms,'synonym')||'<em>—</em>')+'</div></div><div class="study-chip-row"><span>파생어</span><div>'+(studyChips(x.details.derived,'derived')||'<em>—</em>')+'</div></div>';
    const context=(x.details.example||x.details.exampleKo)?exampleHtml(x):'<p class="study-no-detail">등록된 예문이 없어요.</p>';
    return '<div class="study-detail-panel" data-study-panel="'+study.panel+'"><div class="study-panel-head"><span class="study-panel-icon">'+(study.panel==='definition'?'▤':'❞')+'</span><strong>'+(study.panel==='definition'?'DEFINITIONS':'IN CONTEXT')+'</strong><button class="study-panel-next" type="button" aria-label="'+(study.panel==='definition'?'예문 보기':'영영 풀이 보기')+'">'+(study.panel==='definition'?'→':'←')+'</button></div>'+(study.panel==='definition'?definition+chips:context)+'<div class="study-panel-dots" aria-hidden="true"><i class="'+(study.panel==='definition'?'active':'')+'"></i><i class="'+(study.panel==='example'?'active':'')+'"></i></div></div>';
  }
  function show(x){
    const views={study:$('#studyView'),wordbook:e.book,test:e.test,add:$('#addView'),account:$('#accountView')};
    Object.entries(views).forEach(([key,node])=>node.classList.toggle('active',key===x));
    document.body.classList.toggle('study-active',x==='study');
    $$('[data-nav]').forEach(y=>y.classList.toggle('active',y.dataset.nav===x));
    if(x==='study')renderStudy();
    if(x==='test'&&!st.quiz)reset();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function pool(d){const a=st.prefs.activeChapter==='all'?st.words:st.words.filter(x=>x.chapter===st.prefs.activeChapter);return d==='example'?a.filter(x=>x.details.example):a}
  function available(){const d=$('input[name="direction"]:checked')?.value||'word',n=pool(d).length;$('#startTestButton').disabled=n<2;$('#startTestButton').style.opacity=n>1?'1':'.45';$('#testAvailability').textContent=n>1?n+'개 단어에서 문제가 출제돼요.':d==='example'?'예문이 있는 단어를 2개 이상 추가해 주세요.':'시험을 보려면 단어가 2개 이상 필요해요.'}
  function reset(){e.intro.classList.remove('hidden');e.quiz.classList.add('hidden');e.result.classList.add('hidden')}
  const prompt=(x,d)=>d==='word'?x.word:d==='meaning'?mtext(x,', '):x.details.example.replace(new RegExp(escRe(x.word),'gi'),'_____');
  const answer=(x,d)=>d==='word'?mtext(x):x.word;
  function start(){const d=$('input[name="direction"]:checked').value,a=pool(d);if(a.length<2)return available();st.quiz={d,qs:mix(a).slice(0,Math.min(10,a.length)),i:0,score:0,wrong:[],done:false};e.intro.classList.add('hidden');e.result.classList.add('hidden');e.quiz.classList.remove('hidden');draw()}
  function draw(){const q=st.quiz,x=q.qs[q.i],a=mix([x,...mix(pool(q.d).filter(y=>y.id!==x.id)).slice(0,3)]);q.done=false;$('#questionText').textContent=prompt(x,q.d);$('#quizProgressText').textContent=(q.i+1)+' / '+q.qs.length;$('#quizProgressBar').style.width=((q.i+1)/q.qs.length*100)+'%';$('#liveScore').textContent=q.score+'점';$('#answerOptions').innerHTML=a.map(y=>'<button class="answer-option" type="button" data-choice="'+y.id+'">'+esc(answer(y,q.d))+'</button>').join('');$('#nextQuestionButton').classList.add('hidden')}
  function choose(b){const q=st.quiz;if(!q||q.done)return;q.done=true;const x=q.qs[q.i],p=b.dataset.choice;$$('.answer-option').forEach(y=>{y.disabled=true;if(y.dataset.choice===x.id)y.classList.add('correct')});if(p===x.id){q.score++;toast('정답이에요!')}else{b.classList.add('wrong');const y=st.words.find(z=>z.id===p)||{word:''};q.wrong.push({word:x.word,meaning:mtext(x),selected:answer(y,q.d)})}$('#liveScore').textContent=q.score+'점';$('#nextQuestionButton').textContent=q.i===q.qs.length-1?'결과 보기':'다음 문제';$('#nextQuestionButton').classList.remove('hidden')}
  function next(){if(!st.quiz?.done)return;if(st.quiz.i<st.quiz.qs.length-1){st.quiz.i++;draw()}else result()}
  function result(){const q=st.quiz,s=Math.round(q.score/q.qs.length*100);e.quiz.classList.add('hidden');e.result.classList.remove('hidden');$('#resultScore').textContent=s;$('#resultMessage').textContent=s===100?'완벽하게 외웠어요!':s>=70?'거의 다 외웠어요!':'한 번 더 보면 확실해져요';$('#resultDetail').textContent=q.qs.length+'문제 중 '+q.score+'문제를 맞혔어요.';$('#wrongAnswers').innerHTML=q.wrong.map(x=>'<div class="wrong-item"><strong>'+esc(x.word)+' · '+esc(x.meaning)+'</strong><span>선택한 답: '+esc(x.selected)+'</span></div>').join('')}
  function toggle(i){const x=st.words.find(w=>w.id===i);if(!x)return;const h=cardVisible(x);['word','meaning','details','exampleWord'].forEach(f=>mark(i,f,!h));render()}
  function addChapter(){const x=e.newChapter.value.trim();if(!x)return;if(!st.chapters.includes(x))st.chapters.push(x);st.prefs.activeChapter=x;e.newChapter.value='';save();renderChapters();render();toast('‘'+x+'’ 챕터를 만들었어요')}

  // [개선된 챕터 관리 UI 렌더링]
  function chapterManager() {
    let manager = $('#chapterManager');
    if (!manager) { manager = document.createElement('div'); manager.id = 'chapterManager'; manager.className = 'chapter-manager'; $('#newChapterInput').parentElement.after(manager); }
    const list = chapters();
    manager.innerHTML = '<strong>챕터 수정</strong>' + list.map((x, i) => '<div class="chapter-manage-row"><span>' + esc(x) + '</span><div class="btns"><button type="button" data-rename="' + i + '">이름 변경</button><button type="button" data-delete="' + i + '">삭제</button></div></div>').join('');
    manager.onclick = event => {
      const rename = event.target.closest('[data-rename]'), del = event.target.closest('[data-delete]'); if (!rename && !del) return;
      const index = Number((rename || del).dataset.rename ?? (rename || del).dataset.delete), current = list[index]; const words = getWords();
      if (rename) { const next = window.prompt('새 챕터 이름', current); if (!next || !next.trim() || next.trim() === current) return; const name = next.trim(); saveWords(words.map(x => (x.chapter || 'Day 1') === current ? { ...x, chapter: name } : x)); localStorage.setItem('pocket-vocab-chapters-v1', JSON.stringify(list.map(x => x === current ? name : x))); location.reload(); }
      if (del) { if (list.length <= 1) return toast('챕터는 하나 이상 남겨야 해요'); if (!confirm('‘' + current + '’ 챕터를 삭제할까요? 단어는 첫 챕터로 이동합니다.')) return; const target = list.find(x => x !== current); saveWords(words.map(x => (x.chapter || 'Day 1') === current ? { ...x, chapter: target } : x)); localStorage.setItem('pocket-vocab-chapters-v1', JSON.stringify(list.filter(x => x !== current))); location.reload(); }
    };
  }
  const chapters = () => [...new Set([...st.chapters, 'Day 1'])];
  const saveWords = words => { st.words = words; save(); };
  const getWords = () => st.words;

  function bind(){
    $('#openAddButton').onclick=()=>show('add');$('#emptyAddButton').onclick=()=>show('add');$('#openOcrButton').onclick=()=>show('account');$('#filterButton').onclick=()=>open(e.filter);$('#chapterButton').onclick=()=>{renderChapters();chapterManager();open(e.chapter)};
    $('#studyLaunchButton').onclick=()=>show('study');$('#studyBackButton').onclick=()=>show('wordbook');
    $('#studyChapterButton').onclick=()=>{renderChapters();chapterManager();open(e.chapter)};
    $('#chooseManualAdd').onclick=()=>form();$('#chooseFileAdd').onclick=()=>open(e.imp);
    $$('.account-choice').forEach(x=>x.onclick=()=>{if(x.dataset.loginOption==='guest')show('study');else $('#accountChoiceMessage').textContent='이메일 로그인은 준비 중입니다.'});
    const studyContent=$('#studyContent');
    const toggleStudyCard=()=>{if(study.revealed)studyReset();else study.revealed=true;renderStudy()};
    studyContent.ondblclick=ev=>{if(ev.target.closest('#studyWordCard')&&Date.now()-study.lastTouchToggle>500)toggleStudyCard()};
    studyContent.onkeydown=ev=>{if(ev.target.id==='studyWordCard'&&(ev.key==='Enter'||ev.key===' ')){ev.preventDefault();toggleStudyCard()}};
    studyContent.onclick=ev=>{const meaning=ev.target.closest('[data-study-meaning]');if(meaning){const n=Number(meaning.dataset.studyMeaning);study.selected=study.selected===n?-1:n;study.panel='definition';renderStudy();return}if(ev.target.closest('.study-panel-next')){study.panel=study.panel==='definition'?'example':'definition';renderStudy();return}if(ev.target.closest('.study-empty-add'))show('add')};
    studyContent.onpointerdown=ev=>{study.touch={x:ev.clientX,y:ev.clientY,target:ev.target}};
    studyContent.onpointerup=ev=>{if(!study.touch)return;const dx=ev.clientX-study.touch.x,dy=ev.clientY-study.touch.y,target=study.touch.target;study.touch=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.3){if(target.closest('.study-detail-panel')&&study.selected>=0){study.panel=dx<0?'example':'definition';renderStudy()}else studyMove(dx<0?1:-1);return}if(ev.pointerType==='touch'&&target.closest('#studyWordCard')){const now=Date.now();if(now-study.lastTap<360){study.lastTap=0;study.lastTouchToggle=now;toggleStudyCard()}else study.lastTap=now}};
    studyContent.addEventListener('wheel',ev=>{if(study.revealed||studyWords().length<2||Math.abs(ev.deltaY)<15)return;ev.preventDefault();const now=Date.now();if(now-study.lastWheel<450)return;study.lastWheel=now;studyMove(ev.deltaY>0?1:-1)},{passive:false});
    $$('.close-modal').forEach(x=>x.onclick=()=>close(e.edit));$$('.close-filter').forEach(x=>x.onclick=()=>close(e.filter));$$('.close-ocr').forEach(x=>x.onclick=()=>close(e.imp));$$('.close-chapter').forEach(x=>x.onclick=()=>close(e.chapter));[e.edit,e.filter,e.imp,e.chapter].forEach(x=>x.onclick=ev=>{if(ev.target===x)close(x)});
    e.form.onsubmit=submit;$('#generateDetailsButton').onclick=geminiAutoFill;e.search.oninput=render;$('#cardViewButton').onclick=()=>view('card');$('#listViewButton').onclick=()=>view('list');
    ['maskWord','maskMeaning','maskDetails'].forEach(k=>{const x=$('#'+k);x.checked=st.prefs[k];x.onchange=()=>{st.prefs[k]=x.checked;st.shown.clear();save();render()}});
    $('#revealAllButton').onclick=()=>{const h=st.words.some(cardVisible);st.words.forEach(x=>['word','meaning','details','exampleWord'].forEach(f=>mark(x.id,f,!h)));render();$('#revealAllButton').textContent=h?'전체 정답 보기':'전체 다시 가리기'};
    e.words.onclick=ev=>{const t=ev.target.closest?.('*'),a=t?.closest('.edit-word'),b=t?.closest('.delete-word'),c=t?.closest('[data-card-toggle]'),d=t?.closest('[data-field]');if(a)form(a.dataset.id);else if(b)remove(b.dataset.id);else if(c)toggle(c.dataset.cardToggle);else if(d){mark(d.dataset.id,d.dataset.field,!visible(d.dataset.id,d.dataset.field));render()}};
    $$('#detailFilters input').forEach(x=>{x.checked=st.prefs.filters.includes(x.value);x.onchange=()=>{st.prefs.filters=$$('#detailFilters input:checked').map(y=>y.value);save();render()}});
    e.chapterSelect.onchange=()=>{st.prefs.activeChapter=e.chapterSelect.value;study.index=0;studyReset();save();renderChapters();render()};$('#addChapterButton').onclick=addChapter;e.newChapter.onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();addChapter()}};
    $$('[data-nav]').forEach(x=>x.onclick=()=>show(x.dataset.nav));$$('[data-go-home]').forEach(x=>x.onclick=()=>{st.quiz=null;show('wordbook')});$$('input[name="direction"]').forEach(x=>x.onchange=available);$('#startTestButton').onclick=start;$('#retryTestButton').onclick=()=>{reset();start()};$('#quitTestButton').onclick=()=>{st.quiz=null;reset()};$('#answerOptions').onclick=ev=>{const x=ev.target.closest('.answer-option');if(x)choose(x)};$('#nextQuestionButton').onclick=next;
    
    // 이미지/엑셀/OCR 바인딩
    e.image.onchange=()=>runGeminiOCR(e.image.files[0]);
    $('#cameraInput').onchange=()=>runGeminiOCR($('#cameraInput').files[0]);
    $('#galleryInput').onchange=()=>runGeminiOCR($('#galleryInput').files[0]);
    e.excel.onchange=()=>excel(e.excel.files[0]);$('#importOcrButton').onclick=textImport;
    $('#confirmImportButton').onclick=()=>{
      const rows = $$('#importPreviewTable tbody tr').filter(row=>row.querySelector('[data-select]').checked).map(row => ({ id: uid(), word: row.querySelector('[data-col="word"]').value.trim(), meanings: split(row.querySelector('[data-col="meaning"]').value), definitions:definitionLines(row.querySelector('[data-col="definition"]').value), chapter: row.querySelector('[data-col="chapter"]').value, details:Object.fromEntries(Object.keys(blank()).map(k=>[k,k==='definition'?'':row.querySelector('[data-col="'+k+'"]').value.trim()])) })).filter(x => x.word && x.meanings.length);
      add(rows); $('#importPreviewPanel').classList.add('hidden'); close(e.imp);
    };
    $('#importPreviewTable').onclick = event => { const button = event.target.closest('[data-remove]'); if (button) { button.closest('tr').remove(); } };
    $('#selectAllImport').onchange=ev=>{$$('#importPreviewTable [data-select]').forEach(x=>x.checked=ev.target.checked)};
    $('#applyBulkChapter').onclick=()=>{const chapter=$('#bulkChapterSelect').value;$$('#importPreviewTable tbody tr').filter(r=>r.querySelector('[data-select]').checked).forEach(r=>r.querySelector('[data-col="chapter"]').value=chapter);toast('선택한 단어의 챕터를 변경했어요')};
    $('#enrichSelectedImport').onclick=async()=>{const rows=$$('#importPreviewTable tbody tr').filter(r=>r.querySelector('[data-select]').checked),button=$('#enrichSelectedImport');if(!rows.length)return toast('먼저 단어를 선택해 주세요');button.disabled=true;for(let i=0;i<rows.length;i++){const row=rows[i],word=row.querySelector('[data-col="word"]').value.trim();if(!word)continue;button.textContent=(i+1)+' / '+rows.length+' 검색 중…';try{const meanings=split(row.querySelector('[data-col="meaning"]').value),response=await fetch('/api/vocab',{method:'POST',headers:apiHeaders(),body:JSON.stringify({type:'enrich',word,meanings,example:row.querySelector('[data-col="example"]').value.trim()})});if(!response.ok)throw Error((await response.json().catch(()=>({}))).error||'API 오류');const data=await response.json();Object.keys(blank()).forEach(k=>{const input=row.querySelector('[data-col="'+k+'"]');if(!input)return;if(k==='definition'&&data.definitions){const current=definitionLines(input.value),generated=alignedDefinitions(meanings,data.definitions);input.value=meanings.map((_,i)=>current[i]||generated[i]||'').join('\n')}else if(!input.value.trim()&&data[k])input.value=data[k]})}catch(error){console.error(error);toast(word+': '+error.message);break}}button.disabled=false;button.textContent='선택 항목 빈 정보 채우기'};
    $('#apiKeyButton').onclick=()=>{$('#userApiKeyInput').value=apiKey();open(e.apiKeyModal)};
    $$('.close-api-key').forEach(x=>x.onclick=()=>close(e.apiKeyModal));
    $('#saveApiKeyButton').onclick=()=>{const key=$('#userApiKeyInput').value.trim();if(key)sessionStorage.setItem(K,key);else sessionStorage.removeItem(K);if($('#rememberApiKey').checked&&key)localStorage.setItem(K,key);else localStorage.removeItem(K);close(e.apiKeyModal);toast(key?'내 API 키를 적용했어요':'API 키를 비웠어요')};
    $('#removeApiKeyButton').onclick=()=>{sessionStorage.removeItem(K);localStorage.removeItem(K);$('#userApiKeyInput').value='';toast('저장된 API 키를 삭제했어요')};
  }
  function init(){save();$('#todayLabel').textContent=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(new Date());renderChapters();bind();view(st.prefs.view);render();show('wordbook')}
  init();
})();
