import { modules, categories, catalog } from './catalog.js';
import { users, makeSeed } from './data.js';
import { pendingTasks, visibleNotifications, unreadCount, needsAction, canOpen, readNotification, archiveNotification, actOnTask } from './model.js';
import { icon } from './icons.js';

const KEY='saq.notifications.prototype.v1';
const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let storageAvailable=true;
let state;
try { state=JSON.parse(localStorage.getItem(KEY)); } catch { storageAvailable=false; }
if(!state||state.schemaVersion!==1||!Array.isArray(state.entities)||!users.some(u=>u.id===state.activeUserId)) state=makeSeed();
let tab='all', moduleFilter='all', categoryFilter='all', query='', taskTab='incoming', bellOpen=false, bellTab='all', mobileNav=false;
let toastTimer;
const app=document.querySelector('#app');
const user=()=>users.find(u=>u.id===state.activeUserId);
const person=(id)=>users.find(u=>u.id===id)?.name || 'Система SAQ';
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch{storageAvailable=false;}};
save();
const page=()=>location.hash.startsWith('#/document/')?'document':location.hash.replace('#/','').split('?')[0]||'notifications';
const fullDate=(value)=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Almaty',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
const day=(value)=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Almaty',day:'numeric',month:'long'}).format(new Date(value));
const shortDate=(value)=>{
  const d=new Date(value),n=new Date(),same=day(d)===day(n),yesterday=day(d)===day(new Date(n.getTime()-86400000));
  const time=new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Almaty',hour:'2-digit',minute:'2-digit'}).format(d);
  return `${same?'Сегодня':yesterday?'Вчера':day(d)}, ${time}`;
};
const isOverdue=t=>t.status==='pending'&&t.dueAt&&new Date(t.dueAt)<new Date();
const actionNames={approve:'Согласование','approve-final':'Утверждение',acknowledge:'Ознакомление','review-selection':'Рассмотрение отбора',review:'Рассмотрение',respond:'Подготовка ответа',revise:'Доработка',attendance:'Подтверждение участия'};
const statusNames={pending:'Требует действия',completed:'Выполнено',returned:'Возвращено',rejected:'Отклонено',cancelled:'Отменено',waiting:'Ожидает этапа'};
const moduleBadge=(id)=>`<span class="module-badge ${modules[id]?.color || ''}">${esc(modules[id]?.label || 'Все модули')}</span>`;
const notify=(message)=>{
  const el=document.querySelector('#toast'); el.innerHTML=icon('check')+`<span>${esc(message)}</span>`; el.classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4500);
};
function navigate(route){bellOpen=false;mobileNav=false;if(location.hash===`#/${route}`)render();else location.hash=`#/${route}`;}
function openEntity(entityId,noticeId){
  if(noticeId)readNotification(state,noticeId,user().id);
  save();navigate(`document/${entityId}`);
}
function stats(){
  const tasks=pendingTasks(state,user().id);
  return `<div class="stats-line"><span>${icon('mail')}<strong>${unreadCount(state,user().id)}</strong> непрочитанных</span><button data-action="go-tasks">${icon('tasks')}<strong>${tasks.length}</strong> требуют действия</button><span class="${tasks.some(isOverdue)?'danger-text':''}">${icon('clock')}<strong>${tasks.filter(isOverdue).length}</strong> просрочено</span></div>`;
}
function shell(content){
  const current=page(),u=user(),unread=unreadCount(state,u.id),tasks=pendingTasks(state,u.id);
  return `<a class="skip" href="#content">Перейти к содержимому</a>
  <aside class="sidebar ${mobileNav?'mobile-open':''}" aria-label="Основная навигация">
    <a class="brand" href="#/notifications"><span class="brand-word">SAQ<span class="brand-dot"></span></span><span>Smart Audit<br>Kazakhstan</span></a>
    <button class="icon-button mobile-close" data-action="mobile-menu" aria-label="Закрыть меню">${icon('close')}</button>
    <div class="workspace-label">ЛИЧНЫЙ КАБИНЕТ</div>
    <nav>
      <a href="#/notifications" class="nav-item ${current==='notifications'?'active':''}">${icon('bell')}<span>Уведомления</span>${unread?`<b>${unread}</b>`:''}</a>
      <a href="#/tasks" class="nav-item ${current==='tasks'?'active':''}">${icon('tasks')}<span>Поручения</span>${tasks.length?`<b>${tasks.length}</b>`:''}</a>
    </nav>
    <div class="workspace-label module-label">МОДУЛИ</div>
    <nav class="module-nav">${Object.entries(modules).map(([id,m])=>`<button data-action="module-nav" data-id="${id}" class="nav-item ${moduleFilter===id&&current==='notifications'?'selected':''}"><span class="module-icon ${m.color}">${icon(m.icon)}</span><span>${m.label}</span><span class="muted-count">${visibleNotifications(state,u.id).filter(n=>n.module===id&&!n.archivedAt).length || '—'}</span></button>`).join('')}</nav>
    <div class="sidebar-bottom"><div class="workspace-label">МОДЕЛЬ SAQ</div><a href="#/catalog" class="nav-item ${current==='catalog'?'active':''}">${icon('book')}<span>Каталог событий</span></a><a href="#/rules" class="nav-item ${current==='rules'?'active':''}">${icon('info')}<span>Как это работает</span></a><div class="sandbox-label"><span></span>Тестовый контур</div></div>
  </aside>
  <header class="topbar"><button class="icon-button mobile-menu" data-action="mobile-menu" aria-label="Открыть меню">${icon('menu')}</button><div class="header-title">Рабочее пространство <span>/</span> <strong>${u.id==='subject'||u.id==='profsubject'?'Кабинет организации':'SAQ'}</strong></div><div class="header-right"><span class="prototype-label">Макет</span><span class="language">RU</span><div class="bell-wrap"><button id="bell-button" class="icon-button bell-button ${bellOpen?'pressed':''}" data-action="bell" aria-label="Уведомления: ${unread} непрочитанных" aria-expanded="${bellOpen}" aria-controls="bell-panel">${icon('bell')}${unread?`<b class="counter">${unread>99?'99+':unread}</b>`:''}</button>${bellOpen?bellPanel():''}</div><span class="header-divider"></span><label class="profile"><span class="avatar">${u.initials}</span><span><small>Тестовая роль</small><select id="persona" aria-label="Тестовая роль">${users.map(p=>`<option value="${p.id}" ${p.id===u.id?'selected':''}>${p.name} · ${p.role}</option>`).join('')}</select></span></label></div></header>
  <main id="content" tabindex="-1">${!storageAvailable?'<div class="notice amber">Сохранение в браузере недоступно. Изменения сохранятся до перезагрузки страницы.</div>':''}${content}</main>`;
}
function notificationRow(n,compact=false){
  const task=state.tasks.find(t=>t.id===n.taskId),active=needsAction(state,n),unread=!n.readAt;
  return `<article class="notification-row ${unread?'unread':''} ${compact?'compact':''}">
    <div class="event-icon ${modules[n.module].color}">${icon(n.category==='deadline'?'clock':n.category==='result'?'check':n.category==='revision'?'return':modules[n.module].icon)}</div>
    <div class="notification-body"><div class="row-labels">${moduleBadge(n.module)}<span class="category-label">${categories[n.category]}</span>${unread?'<span class="unread-dot" aria-label="Непрочитано"></span>':''}</div>
    <button class="notification-open" data-action="open-notice" data-id="${n.id}"><span class="notification-title">${esc(n.title)}</span><span class="notification-text">${esc(n.body)}</span></button>
    <div class="notification-meta"><span>${esc(person(n.actorId))}</span><span>·</span><time datetime="${n.createdAt}" title="${fullDate(n.createdAt)} (Астана, UTC+5)">${shortDate(n.createdAt)}</time>${n.relatedModule?`<span class="related">Связано с ${modules[n.relatedModule].label}</span>`:''}</div>
    ${!compact&&task?`<div class="row-status"><span class="state-pill ${active?'pending':''}">${active?'Требует действия':statusNames[task.status]}</span>${active&&task.dueAt?`<span class="due ${isOverdue(task)?'overdue':''}">${icon('clock')}${isOverdue(task)?'Срок истёк':'До'} ${fullDate(task.dueAt)}</span>`:''}</div>`:''}</div>
    ${!compact?`<div class="row-tools"><button class="icon-button" data-action="toggle-read" data-id="${n.id}" title="${unread?'Отметить прочитанным':'Отметить непрочитанным'}" aria-label="${unread?'Отметить прочитанным':'Отметить непрочитанным'}: ${esc(n.title)}">${icon(unread?'mail':'inbox')}</button><button class="icon-button" data-action="archive" data-id="${n.id}" ${active?'disabled':''} title="${active?'В архив после выполнения поручения':n.archivedAt?'Вернуть из архива':'В архив'}" aria-label="${n.archivedAt?'Вернуть из архива':'В архив'}: ${esc(n.title)}">${icon(n.archivedAt?'return':'archive')}</button></div>`:icon('chevron','row-chevron')}
    </article>`;
}
function bellPanel(){
  const all=visibleNotifications(state,user().id).filter(n=>!n.archivedAt);
  const list=all.filter(n=>bellTab==='unread'?!n.readAt:bellTab==='action'?needsAction(state,n):true).slice(0,5);
  return `<section id="bell-panel" class="bell-panel" aria-label="Последние уведомления"><div class="bell-heading"><h2>Уведомления <span>${unreadCount(state,user().id)}</span></h2><button class="icon-button" data-action="bell-close" aria-label="Закрыть уведомления">${icon('close')}</button></div><div class="bell-tabs">${[['all','Все'],['unread','Непрочитанные'],['action','Требуют действия']].map(([id,label])=>`<button data-action="bell-tab" data-id="${id}" aria-pressed="${bellTab===id}" class="${bellTab===id?'active':''}">${label}</button>`).join('')}</div><div class="bell-feed">${list.length?list.map(n=>notificationRow(n,true)).join(''):'<div class="empty compact-empty">'+icon('check')+'<h3>Здесь пока пусто</h3><p>Подходящих уведомлений нет.</p></div>'}</div><div class="bell-footer"><button data-action="read-all" class="text-button">${icon('double')}Все прочитаны</button><button data-action="all-notices" class="text-button">Все уведомления ${icon('arrow')}</button></div></section>`;
}
function filters(kind='notifications'){
  return `<div class="filters"><label class="search-field">${icon('search')}<input id="search" type="search" value="${esc(query)}" placeholder="${kind==='catalog'?'Найти событие, получателя или текст…':'Поиск по документу, тексту, отправителю…'}" aria-label="Поиск"></label><label class="filter-select"><select id="module-filter" aria-label="Модуль"><option value="all">Все модули</option>${Object.entries(modules).map(([id,m])=>`<option value="${id}" ${moduleFilter===id?'selected':''}>${m.label}</option>`).join('')}</select></label><label class="filter-select"><select id="category-filter" aria-label="Тип уведомления"><option value="all">Все типы</option>${Object.entries(categories).map(([id,l])=>`<option value="${id}" ${categoryFilter===id?'selected':''}>${l}</option>`).join('')}</select></label>${query||moduleFilter!=='all'||categoryFilter!=='all'?'<button class="text-button" data-action="reset-filters">Сбросить</button>':''}</div>`;
}
function notificationPage(){
  const all=visibleNotifications(state,user().id);
  return `<div class="breadcrumb">Личный кабинет <span>/</span> Уведомления</div><div class="page-heading"><div><h1>Уведомления</h1><p>Всё, что требует вашего внимания, — в одном месте.</p></div><button class="button secondary" data-action="read-all">${icon('double')}Отметить все прочитанными</button></div>${stats()}
    <section class="panel feed-panel"><div class="tabs">${[['all','Все',all.filter(n=>!n.archivedAt).length],['unread','Непрочитанные',unreadCount(state,user().id)],['action','Требуют действия',all.filter(n=>needsAction(state,n)).length],['archive','Архив',all.filter(n=>n.archivedAt).length]].map(([id,label,count])=>`<button class="${tab===id?'active':''}" data-action="tab" data-id="${id}" aria-pressed="${tab===id}">${label}<span>${count}</span></button>`).join('')}</div>${filters()}<div id="results">${notificationResults()}</div></section><div class="page-footnote">${icon('shield')}Доступны только сообщения, адресованные выбранному пользователю. Время — Астана, UTC+5.</div>`;
}
function notificationResults(){
  const list=visibleNotifications(state,user().id).filter(n=>tab==='archive'?n.archivedAt:!n.archivedAt).filter(n=>tab==='unread'?!n.readAt:tab==='action'?needsAction(state,n):true)
    .filter(n=>(moduleFilter==='all'||n.module===moduleFilter)&&(categoryFilter==='all'||n.category===categoryFilter))
    .filter(n=>`${n.title} ${n.body} ${person(n.actorId)}`.toLowerCase().includes(query.toLowerCase()));
  if(!list.length)return empty('Уведомлений не найдено','Попробуйте изменить фильтры или выберите другую тестовую роль.');
  let last='';return list.map(n=>{const group=shortDate(n.createdAt).split(',')[0];const heading=group!==last?`<div class="date-group">${group}</div>`:'';last=group;return heading+notificationRow(n);}).join('');
}
const empty=(title,subtitle)=>`<div class="empty">${icon('inbox')}<h3>${title}</h3><p>${subtitle}</p></div>`;
function tasksPage(){
  let list=state.tasks.filter(t=>taskTab==='sent'?t.authorId===user().id:t.recipientId===user().id);
  if(taskTab==='incoming')list=list.filter(t=>t.status==='pending');
  if(taskTab==='completed')list=list.filter(t=>!['pending','waiting'].includes(t.status));
  list.sort((a,b)=>Number(isOverdue(b))-Number(isOverdue(a))||b.createdAt.localeCompare(a.createdAt));
  return `<div class="breadcrumb">Личный кабинет <span>/</span> Поручения</div><div class="page-heading"><div><h1>Поручения</h1><p>Действия по документам из всех доступных модулей.</p></div></div>${stats()}<section class="panel"><div class="tabs">${[['incoming','Входящие'],['sent','Отправленные'],['completed','Завершённые']].map(([id,l])=>`<button data-action="task-tab" data-id="${id}" class="${taskTab===id?'active':''}" aria-pressed="${taskTab===id}">${l}</button>`).join('')}</div>${list.length?`<div class="table-scroll"><table class="task-table"><thead><tr><th>Действие / документ</th><th>Модуль</th><th>${taskTab==='sent'?'Исполнитель':'Отправитель'}</th><th>Срок</th><th>Состояние</th><th></th></tr></thead><tbody>${list.map(t=>{const e=state.entities.find(e=>e.id===t.entityId);return `<tr><td><strong>${actionNames[t.action]}</strong><span>${esc(e.title)} № ${esc(e.number)}</span><small>${esc(e.organization)}</small></td><td>${moduleBadge(e.module)}</td><td>${esc(person(taskTab==='sent'?t.recipientId:t.authorId))}</td><td class="${isOverdue(t)?'danger-text':''}">${t.dueAt?fullDate(t.dueAt):'Не установлен'}</td><td><span class="state-pill ${t.status==='pending'?'pending':''}">${statusNames[t.status]}</span></td><td><button class="button small secondary" data-action="open-task" data-id="${t.id}">Открыть ${icon('arrow')}</button></td></tr>`;}).join('')}</tbody></table></div>`:empty('Поручений пока нет','Здесь появятся действия, назначенные вам по бизнес-процессам SAQ.')}</section><div class="page-footnote">${icon('info')}Прочтение уведомления не закрывает поручение. Решение фиксируется в документе.</div>`;
}
function documentPage(){
  const id=decodeURIComponent(location.hash.split('/')[2]?.split('?')[0]||'');
  const entity=state.entities.find(e=>e.id===id);
  if(!entity||!canOpen(state,id,user().id)) return `<div class="breadcrumb">Документы</div><section class="panel">${empty('Документ недоступен','Возможно, документ удалён или ваши права изменились. Обратитесь к отправителю.')}<div class="center"><button class="button secondary" data-action="all-notices">Вернуться к уведомлениям</button></div></section>`;
  const task=state.tasks.find(t=>t.entityId===id&&t.recipientId===user().id&&t.status==='pending');
  const waiting=state.tasks.find(t=>t.entityId===id&&t.recipientId===user().id&&t.status==='waiting');
  return `<div class="breadcrumb"><a href="#/notifications">Уведомления</a><span>/</span>${modules[entity.module].label}<span>/</span>Документ</div>
  <button class="text-button back-link" data-action="all-notices">${icon('back')}К уведомлениям</button><div class="page-heading document-heading"><div><div class="row-labels">${moduleBadge(entity.module)}<span class="muted">Редакция ${esc(entity.version)}</span></div><h1>${esc(entity.title)}</h1><p>№ ${esc(entity.number)} · ${esc(entity.organization)}</p></div><span class="state-pill">${esc(entity.status)}</span></div>
  <div class="document-layout"><section class="panel document-sheet"><div class="document-label">ДЕМОНСТРАЦИОННЫЙ ДОКУМЕНТ</div><h2>${esc(entity.title)}</h2><p class="document-number">№ ${esc(entity.number)}</p><dl class="document-meta"><div><dt>Организация</dt><dd>${esc(entity.organization)}</dd></div><div><dt>Инициатор</dt><dd>${esc(person(entity.authorId))}</dd></div><div><dt>Редакция</dt><dd>${esc(entity.version)}</dd></div><div><dt>Состояние</dt><dd>${esc(entity.status)}</dd></div></dl><p class="document-content">${esc(entity.content)}</p>
  ${entity.kind==='selection'?selectionTable(entity,Boolean(task)):''}${entity.response?`<div class="notice"><strong>Ответ адресата</strong><p>${esc(entity.response)}</p></div>`:''}
  <div class="document-demo-note">Сокращённая карточка для проверки перехода и действий. В системе здесь откроется документ соответствующего модуля.</div></section>
  <aside class="document-aside"><section class="panel action-panel"><h2>Ваше действие</h2>${task?`<div class="action-type">${icon(task.action==='acknowledge'?'shield':'tasks')}<strong>${actionNames[task.action]}</strong></div><dl><dt>От кого</dt><dd>${esc(person(task.authorId))}</dd><dt>Срок выполнения</dt><dd class="${isOverdue(task)?'danger-text':''}">${task.dueAt?fullDate(task.dueAt):'Не установлен'}</dd></dl>${task.action==='acknowledge'?'<p class="action-help">Открытие документа не подтверждает ознакомление. Для фиксации используйте кнопку ниже.</p>':''}<div class="action-buttons">${taskButtons(task)}</div><p class="test-note">Все решения выполняются только в макете.</p>`:`<div class="done-icon">${icon(waiting?'clock':'check')}</div><h3>${waiting?'Ваш этап ещё не наступил':'Действий не требуется'}</h3><p class="muted">${waiting?'Уведомление появится, когда завершится предыдущий этап.':'Вы можете ознакомиться с документом и историей. Завершённое или отменённое поручение повторно выполнить нельзя.'}</p>`}</section><section class="panel history-panel"><h2>История документа</h2><ol>${[...entity.history].reverse().map(h=>`<li><strong>${esc(h.text)}</strong><span>${esc(person(h.actorId))}</span><time>${shortDate(h.at)}</time>${h.comment?`<p>${esc(h.comment)}</p>`:''}</li>`).join('')}</ol></section></aside></div>`;
}
function selectionTable(e,editable){return `<div class="selection-table"><table><thead><tr><th>Объект / риск</th><th>Включить</th><th>Основание исключения</th></tr></thead><tbody>${e.items.map(i=>`<tr><td><strong>${esc(i.name)}</strong><span>${i.risk} риск</span></td><td><input type="checkbox" class="selection-check" data-id="${i.id}" aria-label="Включить ${esc(i.name)}" ${i.include?'checked':''} ${!editable?'disabled':''}></td><td><input class="selection-reason" data-id="${i.id}" aria-label="Основание исключения: ${esc(i.name)}" placeholder="Укажите причину" value="${esc(i.reason)}" ${i.include||!editable?'disabled':''}></td></tr>`).join('')}</tbody></table></div>`;}
function taskButtons(t){
  const button=(decision,label,tone='primary',ic='check')=>`<button class="button ${tone}" data-action="decision" data-id="${t.id}" data-decision="${decision}">${icon(ic)}${label}</button>`;
  if(t.action==='approve'||t.action==='approve-final')return button('approve',t.action==='approve-final'?'Утвердить':'Согласовать')+button('return','Вернуть на доработку','secondary','return')+button('reject','Отклонить','danger','close');
  if(t.action==='acknowledge')return button('acknowledge','Подтвердить ознакомление');
  if(t.action==='review-selection')return button('submit-selection','Завершить рассмотрение');
  if(t.action==='attendance')return button('yes','Буду участвовать')+button('no','Не смогу участвовать','secondary','close');
  if(t.action==='revise')return button('resubmit','Отправить новую редакцию','primary','arrow');
  if(t.action==='respond')return button('respond','Подготовить ответ','primary','arrow');
  return button('review','Завершить рассмотрение');
}
function catalogPage(){return `<div class="breadcrumb">Модель SAQ <span>/</span> Каталог событий</div><div class="page-heading"><div><h1>Каталог уведомлений</h1><p>${catalog.length} событий: отправители, получатели, шаблоны и связь с поручениями.</p></div><a class="button secondary" href="https://github.com/ewgftju/saq-notification-test/blob/main/docs/notification-design.md" target="_blank" rel="noopener">Полная концепция ${icon('external')}</a></div><div class="notice subtle">«Процесс в макете» означает, что процесс найден в исходном модуле. Единая серверная доставка пока проектируется. «Новый сценарий» — предлагаемое дополнение.</div><section class="panel">${filters('catalog')}<div id="results">${catalogResults()}</div></section>`;}
function catalogResults(){
  const list=catalog.filter(c=>(moduleFilter==='all'||c.module===moduleFilter||c.module==='all')&&(categoryFilter==='all'||c.category===categoryFilter)&&Object.values(c).join(' ').toLowerCase().includes(query.toLowerCase()));
  return list.length?list.map(c=>`<details class="catalog-item"><summary><code>${c.id}</code>${c.module==='all'?'<span class="module-badge">Общее</span>':moduleBadge(c.module)}<strong>${esc(c.event)}</strong><span class="evidence ${c.evidence==='new'?'new':''}">${c.evidence==='new'?'Новый сценарий':'Процесс в макете'}</span>${icon('down')}</summary><div class="catalog-detail"><dl><div><dt>От кого</dt><dd>${esc(c.actor)}</dd></div><div><dt>Кому</dt><dd>${esc(c.recipient)}</dd></div><div><dt>Тип</dt><dd>${categories[c.category]}</dd></div><div><dt>Поручение</dt><dd>${esc(c.task)}</dd></div></dl><div class="template-card"><span>ШАБЛОН УВЕДОМЛЕНИЯ</span><h3>${esc(c.title)}</h3><p>${esc(c.body)}</p><div>${esc(c.action)} ${icon('arrow')}</div></div></div></details>`).join(''):empty('Событий не найдено','Измените фильтр или поисковый запрос.');
}
function rulesPage(){return `<div class="breadcrumb">Модель SAQ <span>/</span> Как это работает</div><div class="page-heading"><div><h1>Один процесс. Два способа открыть.</h1><p>Уведомление привлекает внимание, поручение хранит обязательное действие.</p></div></div><div class="rules-grid"><section class="panel rule-card">${icon('bell')}<h2>Уведомления</h2><p>Что произошло, с каким документом, кто отправил и когда. В колокольчике — последние 5 сообщений, в общем разделе — весь список и архив.</p><p>Счётчик означает количество непрочитанных сообщений.</p></section><section class="panel rule-card">${icon('tasks')}<h2>Поручения</h2><p>Что нужно сделать, по какому документу и в какой срок. Информационные результаты не создают поручений.</p><p>Счётчик означает количество открытых действий.</p></section></div><section class="panel rules-list"><h2>Правила работы</h2>${[
  ['Модуль и тип — разные признаки','«Возражения» — источник. «Согласование», «Заседание» или «Результат» — смысл сообщения. Если событие затрагивает ВГА, дополнительно показывается связь с исходным мероприятием.'],
  ['Единый переход','Из уведомления и поручения открывается тот же документ, нужная редакция и доступное пользователю действие. Если назначение отменено, история остаётся, а выполнить его нельзя.'],
  ['Прочитано — ещё не выполнено','Открытие сообщения меняет только его прочитанность. Ознакомление, решение, ответ на опрос и подписание фиксируются отдельными действиями.'],
  ['Каждому — свои сообщения','Получатель определяется по назначению, организации, области данных и действующему этапу. Роль сама по себе не означает рассылку всем сотрудникам с этой ролью.'],
  ['Обратная связь отправителю','Инициатор получает итог, возврат, отказ или подтверждение ознакомления. Отправитель СУР видит результаты регионов и завершение общего рассмотрения.'],
  ['Хранение','В рабочей SAQ нужен единый серверный реестр событий и личных уведомлений. Документы и поручения остаются в своих процессах. Архив — состояние записи, а не удаление истории.'],
  ['Каналы','Первый этап — кабинет SAQ и колокольчик во всех модулях. Почта может дублировать уведомление со ссылкой после настройки. СМС и push не нужны для первого макета.'],
  ['Без лишнего шума','Сохранение черновика не отправляет уведомлений. Повторная доставка события не создаёт дубль. Напоминание ссылается на существующее поручение.'],
  ['Сроки','Срок берётся из документа и маршрута. Часовой пояс показывается явно. Рабочие дни и переносы рассчитывает бизнес-процесс, а не текст уведомления.'],
].map(([h,p])=>`<article><h3>${h}</h3><p>${p}</p></article>`).join('')}</section><section class="notice"><strong>Границы этого макета</strong><p>Данные демонстрационные. Роли можно переключать в правом верхнем углу. Изменения сохраняются в этом браузере. Серверная авторизация, ЭЦП, реальные рассылки и интеграции с пятью модулями ещё не подключены.</p><button class="button secondary" data-action="reset-demo">${icon('refresh')}Восстановить примеры</button></section>`;}
function render(){
  const p=page();document.title=`${p==='tasks'?'Поручения':p==='catalog'?'Каталог уведомлений':p==='document'?'Документ':p==='rules'?'Модель уведомлений':'Уведомления'} · SAQ`;
  app.innerHTML=shell(p==='tasks'?tasksPage():p==='document'?documentPage():p==='catalog'?catalogPage():p==='rules'?rulesPage():notificationPage());
}
function perform(taskId,decision,comment='',payload={}){
  try{state=actOnTask(state,taskId,user().id,decision,comment,payload);save();document.querySelector('#decision-dialog').close();render();notify('Действие сохранено. Уведомление отправителю создано в макете.');}
  catch(error){const el=document.querySelector('#form-error');if(el&&document.querySelector('#decision-dialog').open)el.textContent=error.message;else notify(error.message);}
}
function decisionDialog(taskId,decision){
  if(decision==='submit-selection'){
    const items=[...document.querySelectorAll('.selection-check')].map(el=>({id:el.dataset.id,include:el.checked,reason:document.querySelector(`.selection-reason[data-id="${el.dataset.id}"]`).value.trim()}));
    perform(taskId,decision,'',{items});return;
  }
  const requiresComment=['return','reject','no','review','respond','resubmit'].includes(decision);
  const titles={approve:'Подтвердить решение',return:'Вернуть на доработку',reject:'Отклонить документ',acknowledge:'Подтвердить ознакомление',yes:'Подтвердить участие',no:'Ответить об отсутствии',review:'Результат рассмотрения',respond:'Ответ адресату',resubmit:'Отправить новую редакцию'};
  const dlg=document.querySelector('#decision-dialog');
  dlg.innerHTML=`<form id="decision-form" data-task="${taskId}" data-decision="${decision}"><div class="dialog-heading"><h2>${titles[decision]}</h2><button type="button" class="icon-button" data-action="close-dialog" aria-label="Закрыть">${icon('close')}</button></div><p>${decision==='acknowledge'?'Вы подтверждаете ознакомление с показанной редакцией документа.':decision==='reject'?'Отклонение завершит маршрут. Поручение на доработку автоматически не создаётся.':'Результат будет сохранён в истории, а адресату поступит уведомление.'}</p>${requiresComment?`<label class="textarea-label">${decision==='respond'?'Текст ответа':decision==='resubmit'?'Что изменено':decision==='review'?'Результат / комментарий':'Причина'} <span>*</span><textarea name="comment" rows="4" required maxlength="2000" placeholder="Введите текст…"></textarea></label>`:''}<p id="form-error" class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="button secondary" data-action="close-dialog">Отмена</button><button type="submit" class="button primary">${decision==='respond'||decision==='resubmit'?'Отправить':'Подтвердить'}</button></div><p class="test-note">Демонстрационное действие. Реальная ЭЦП не используется.</p></form>`;
  dlg.showModal();
}
document.addEventListener('click',event=>{
  const b=event.target.closest('[data-action]');
  if(!b){const link=event.target.closest('a[href^="#/"]');if(link){event.preventDefault();navigate(link.getAttribute('href').slice(2));return;}if(bellOpen&&!event.target.closest('.bell-wrap')){bellOpen=false;render();}return;}
  const {action,id,decision}=b.dataset;
  if(action==='bell'||action==='bell-close'){bellOpen=action==='bell'?!bellOpen:false;render();if(bellOpen)document.querySelector('#bell-panel button')?.focus();else document.querySelector('#bell-button')?.focus();}
  if(action==='bell-tab'){bellTab=id;render();}
  if(action==='mobile-menu'){mobileNav=!mobileNav;render();}
  if(action==='all-notices'){tab='all';navigate('notifications');}
  if(action==='go-tasks'){taskTab='incoming';navigate('tasks');}
  if(action==='tab'){tab=id;render();}
  if(action==='task-tab'){taskTab=id;render();}
  if(action==='module-nav'){moduleFilter=id;categoryFilter='all';query='';tab='all';navigate('notifications');}
  if(action==='reset-filters'){moduleFilter='all';categoryFilter='all';query='';render();}
  if(action==='open-notice'){const n=state.notifications.find(n=>n.id===id&&n.recipientId===user().id);if(n)openEntity(n.entityId,n.id);}
  if(action==='open-task'){const t=state.tasks.find(t=>t.id===id);if(t)openEntity(t.entityId);}
  if(action==='toggle-read'){const n=state.notifications.find(n=>n.id===id&&n.recipientId===user().id);if(n)n.readAt=n.readAt?null:new Date().toISOString();save();render();}
  if(action==='archive'){try{archiveNotification(state,id,user().id);save();render();}catch(error){notify(error.message);}}
  if(action==='read-all'){const now=new Date().toISOString();visibleNotifications(state,user().id).forEach(n=>n.readAt ||= now);save();render();notify('Уведомления отмечены прочитанными. Открытые поручения сохранены.');}
  if(action==='decision')decisionDialog(id,decision);
  if(action==='close-dialog')document.querySelector('#decision-dialog').close();
  if(action==='reset-demo'){
    const dlg=document.querySelector('#decision-dialog');dlg.innerHTML='<form id="reset-form"><div class="dialog-heading"><h2>Восстановить примеры?</h2></div><p>Ваши демонстрационные решения, прочтения и архив будут сброшены.</p><div class="dialog-actions"><button type="button" class="button secondary" data-action="close-dialog">Отмена</button><button class="button primary" type="submit">Восстановить</button></div></form>';dlg.showModal();
  }
});
document.addEventListener('submit',event=>{
  if(event.target.id==='decision-form'){event.preventDefault();perform(event.target.dataset.task,event.target.dataset.decision,new FormData(event.target).get('comment')||'');}
  if(event.target.id==='reset-form'){event.preventDefault();state=makeSeed();save();document.querySelector('#decision-dialog').close();tab='all';moduleFilter='all';categoryFilter='all';query='';navigate('notifications');notify('Примеры восстановлены.');}
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='persona'){state.activeUserId=el.value;save();tab='all';taskTab='incoming';moduleFilter='all';categoryFilter='all';query='';bellOpen=false;navigate('notifications');}
  if(el.id==='module-filter'){moduleFilter=el.value;render();}
  if(el.id==='category-filter'){categoryFilter=el.value;render();}
  if(el.matches('.selection-check')){const reason=document.querySelector(`.selection-reason[data-id="${el.dataset.id}"]`);reason.disabled=el.checked;if(!el.checked)reason.focus();}
});
document.addEventListener('input',event=>{if(event.target.id==='search'){query=event.target.value;document.querySelector('#results').innerHTML=page()==='catalog'?catalogResults():notificationResults();}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&(bellOpen||mobileNav)){bellOpen=false;mobileNav=false;render();document.querySelector('#bell-button')?.focus();}});
window.addEventListener('hashchange',()=>{bellOpen=false;mobileNav=false;render();window.scrollTo(0,0);});
window.addEventListener('storage',event=>{if(event.key===KEY&&event.newValue){try{const next=JSON.parse(event.newValue);if(next.schemaVersion===1){state={...next,activeUserId:state.activeUserId};render();}}catch{ /* keep current usable session */ }}});
render();
