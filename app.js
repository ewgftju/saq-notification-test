import { modules, categories, catalog } from './catalog.js';
import { users, makeSeed, ensureDemoHistory } from './data.js';
import { isDemoSuperuser, pendingTasks, visibleNotifications, paginateNotifications, unreadCount, needsAction, canOpen, readNotification, actOnTask } from './model.js';
import { icon } from './icons.js';

const KEY='saq.notifications.prototype.v1';
const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let storageAvailable=true;
let state;
try { state=JSON.parse(localStorage.getItem(KEY)); } catch { storageAvailable=false; }
if(!state||state.schemaVersion!==1||!Array.isArray(state.entities)||!users.some(u=>u.id===state.activeUserId)) state=makeSeed();
ensureDemoHistory(state);
const identityUrl=new URL(location.href);
if(identityUrl.searchParams.get('demoUser')==='saq-demo-superuser') {
  state.activeUserId='saq-demo-superuser';
  identityUrl.searchParams.delete('demoUser');history.replaceState(history.state,'',identityUrl);
}
let tab='unread', moduleFilter='all', categoryFilter='all', query='', taskTab='incoming', taskQuery='', taskStatus='all', bellOpen=false, bellTab='unread', mobileNav=false;
let noticePage=1,noticePageSize=[10,25,50].includes(state.preferences.notificationPageSize)?state.preferences.notificationPageSize:10;
let sidebarExpanded=false;
try{sidebarExpanded=localStorage.getItem('saq.notifications.sidebar.expanded')==='true';}catch{}
let documentOrigin='tasks';
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
const moduleBadge=(id)=>`<span class="module-badge">${esc(modules[id]?.label || 'Все модули')}</span>`;
const notify=(message)=>{
  const el=document.querySelector('#toast'); el.innerHTML=icon('check')+`<span>${esc(message)}</span>`; el.classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),4500);
};
function navigate(route){bellOpen=false;mobileNav=false;if(location.hash===`#/${route}`)render();else location.hash=`#/${route}`;}
function openEntity(entityId,noticeId){
  documentOrigin=page()==='tasks'?'tasks':'notifications';
  if(noticeId)readNotification(state,noticeId,user().id);
  save();navigate(`document/${entityId}`);
}
function stats(){
  const tasks=pendingTasks(state,user().id);
  return `<div class="stats-line"><span>${icon('mail')}<strong>${unreadCount(state,user().id)}</strong> непрочитанных</span><span>${icon('clock')}<strong>${tasks.filter(isOverdue).length}</strong> просрочено</span></div>`;
}
const moduleNames={sur:'Система управления рисками',evga:'Внутренний государственный аудит',sva:'Служба внутреннего аудита',prof:'Профилактический контроль',objections:'Возражения'};
function currentEntity(){return state.entities.find(e=>e.id===decodeURIComponent(location.hash.split('/')[2]?.split('?')[0]||''));}
function notificationTitle(n){
  if(!/^(Согласуйте|Утвердите|Ознакомьтесь|Рассмотрите|Подтвердите|Предоставьте|Представьте|Учтите)/.test(n.title))return n.title;
  return ({approval:'Документ поступил на согласование',signing:'Документ поступил на утверждение',acknowledge:'Документ направлен для ознакомления',review:n.module==='sur'?'Результаты СУР поступили на рассмотрение':'Материалы поступили на рассмотрение',execution:'Поступил запрос на предоставление сведений',meeting:'Приглашение на заседание комиссии'})[n.category]||n.title;
}
function shell(content){
  const current=page(),u=user(),unread=unreadCount(state,u.id),tasks=pendingTasks(state,u.id),entity=current==='document'?currentEntity():null;
  const title=current==='document'?(entity?.title||'Документ'):current==='tasks'?'Поручения':current==='catalog'?'Каталог событий':current==='rules'?'О макете':'Уведомления';
  const context=entity?moduleNames[entity.module]:'Личный кабинет';
  const subtitle=current==='tasks'?'Адресные задания текущего пользователя':current==='document'?`Документы · ${entity?.number||''}`:current==='notifications'?'События и сообщения по вашим документам':'SAQ · уведомления и поручения';
  return `<div class="app-shell ${sidebarExpanded?'expanded':'collapsed'} ${current==='document'?'document-workspace':''}"><a class="skip" href="#content">Перейти к содержимому</a>
  <aside class="sidebar ${mobileNav?'mobile-open':''}" aria-label="Основная навигация"><div class="brand-row"><a class="brand" href="#/notifications" aria-label="Главная страница SAQ"><img src="./saq-logo.png" width="56" height="44" alt="Логотип SAQ"><span><strong>SAQ</strong><small>Система государственного аудита</small></span></a><button class="sidebar-toggle" data-action="sidebar-toggle" aria-label="${sidebarExpanded?'Свернуть меню':'Развернуть меню'}" aria-expanded="${sidebarExpanded}">${icon(sidebarExpanded?'back':'chevron')}</button><button class="icon-button mobile-close" data-action="mobile-menu" aria-label="Закрыть меню">${icon('close')}</button></div>
    <nav class="main-navigation" aria-label="Разделы личного кабинета"><div class="workspace-label">Личный кабинет</div>
      <a href="#/tasks" class="nav-item ${current==='tasks'?'active':''}" ${current==='tasks'?'aria-current="page"':''} title="Поручения">${icon('tasks')}<span>Поручения</span>${tasks.length?`<b>${tasks.length}</b>`:''}</a>
      <a href="#/notifications" class="nav-item ${current==='notifications'?'active':''}" ${current==='notifications'?'aria-current="page"':''} title="Уведомления">${icon('bell')}<span>Уведомления</span>${unread?`<b>${unread}</b>`:''}</a>
    </nav><div class="sidebar-bottom"><span>SAQ · демонстрационная версия</span></div>
  </aside>
  <header class="topbar"><button class="icon-button mobile-menu" data-action="mobile-menu" aria-label="Открыть меню">${icon('menu')}</button><div class="topbar-title"><span class="topbar-context">${esc(context)}</span><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="header-right"><button class="button secondary reset-button" data-action="reset-demo">${icon('refresh')}Перезапустить демо</button><div class="bell-wrap"><button id="bell-button" class="icon-button bell-button ${bellOpen?'pressed':''}" data-action="bell" aria-label="Уведомления: ${unread} непрочитанных" aria-expanded="${bellOpen}" aria-controls="bell-panel">${icon('bell')}${unread?`<b class="counter">${unread>99?'99+':unread}</b>`:''}</button>${bellOpen?bellPanel():''}</div><span class="language">RU</span><div class="profile"><span><strong>${esc(u.name)}</strong><small>${esc(u.role)}</small></span><span class="avatar">${u.initials}</span></div></div></header>
  <main id="content" tabindex="-1"><section class="demo-session"><label>Пользователь<select id="persona" aria-label="Пользователь">${users.map(p=>`<option value="${p.id}" ${p.id===u.id?'selected':''}>${p.name} · ${p.role}</option>`).join('')}</select></label><p>${esc(u.org)} · ${esc(u.role)}</p></section>${!storageAvailable?'<div class="notice amber">Сохранение в браузере недоступно. Изменения сохранятся до перезагрузки страницы.</div>':''}${content}</main></div>`;
}
function notificationRow(n,compact=false){
  const task=state.tasks.find(t=>t.id===n.taskId),active=needsAction(state,n),unread=!n.readAt;
  const link=`<a class="document-link" href="#/document/${n.entityId}" data-action="open-notice" data-id="${n.id}" aria-label="Перейти к документу: ${esc(n.body)}">Перейти ${icon('arrow')}</a>`;
  return `<article class="notification-row ${unread?'unread':''} ${compact?'compact':''}" data-notice-id="${n.id}">
    <div class="event-icon">${icon(n.category==='deadline'?'clock':n.category==='result'?'check':n.category==='revision'?'return':modules[n.module].icon)}</div>
    <div class="notification-body"><div class="notification-heading"><h3 class="notification-title">${esc(notificationTitle(n))}</h3>${moduleBadge(n.module)}${unread?'<span class="unread-dot" aria-label="Непрочитано"></span>':''}</div>
    <details class="notification-message"><summary title="Развернуть или свернуть текст уведомления"><span class="notification-text">${esc(n.body)}</span>${icon('down')}</summary></details>
    <div class="notification-meta"><span>${esc(person(n.actorId))}</span><span aria-hidden="true">·</span><time datetime="${n.createdAt}" title="${fullDate(n.createdAt)} (Астана, UTC+5)">${shortDate(n.createdAt)}</time>${!compact&&task?`${active&&task.dueAt?`<span class="due ${isOverdue(task)?'overdue':''}">${isOverdue(task)?'Срок истёк':'До'} ${fullDate(task.dueAt)}</span>`:''}`:''}${!compact&&n.relatedModule?`<span class="related">Связано с ${modules[n.relatedModule].label}</span>`:''}${compact?link:''}</div></div>
    ${!compact?`<div class="notification-actions">${link}<div class="row-tools"><button class="icon-button" data-action="toggle-read" data-id="${n.id}" title="${unread?'Отметить прочитанным':'Отметить непрочитанным'}" aria-label="${unread?'Отметить прочитанным':'Отметить непрочитанным'}: ${esc(n.title)}">${icon(unread?'mail':'inbox')}</button></div></div>`:''}
    </article>`;
}
function bellPanel(){
  const all=visibleNotifications(state,user().id);
  const list=all.filter(n=>bellTab==='unread'?!n.readAt:true).slice(0,5);
  return `<section id="bell-panel" class="bell-panel" aria-label="Последние уведомления"><div class="bell-heading"><h2>Уведомления <span>${unreadCount(state,user().id)}</span></h2><button class="icon-button" data-action="bell-close" aria-label="Закрыть уведомления">${icon('close')}</button></div><div class="bell-tabs">${[['unread','Непрочитанные'],['all','Все']].map(([id,label])=>`<button data-action="bell-tab" data-id="${id}" aria-pressed="${bellTab===id}" class="${bellTab===id?'active':''}">${label}</button>`).join('')}</div><div class="bell-feed">${list.length?list.map(n=>notificationRow(n,true)).join(''):'<div class="empty compact-empty">'+icon('check')+'<h3>Здесь пока пусто</h3><p>Подходящих уведомлений нет.</p></div>'}</div><div class="bell-footer"><button data-action="read-all" class="text-button">${icon('double')}Все прочитаны</button><button data-action="all-notices" class="text-button">Все уведомления ${icon('arrow')}</button></div></section>`;
}
function filters(kind='notifications'){
  return `<div class="filters"><label class="search-field">${icon('search')}<input id="search" type="search" value="${esc(query)}" placeholder="${kind==='catalog'?'Найти событие, получателя или текст…':'Поиск по документу, тексту, отправителю…'}" aria-label="Поиск"></label><label class="filter-select"><select id="module-filter" aria-label="Модуль"><option value="all">Все модули</option>${Object.entries(modules).map(([id,m])=>`<option value="${id}" ${moduleFilter===id?'selected':''}>${m.label}</option>`).join('')}</select></label><label class="filter-select"><select id="category-filter" aria-label="Тип уведомления"><option value="all">Все типы</option>${Object.entries(categories).map(([id,l])=>`<option value="${id}" ${categoryFilter===id?'selected':''}>${l}</option>`).join('')}</select></label>${query||moduleFilter!=='all'||categoryFilter!=='all'?'<button class="text-button" data-action="reset-filters">Сбросить</button>':''}</div>`;
}
function notificationPage(){
  const all=visibleNotifications(state,user().id);
  return `<div class="page-heading"><div><h2>Уведомления</h2></div><button class="button secondary" data-action="read-all">${icon('double')}Отметить все прочитанными</button></div>${stats()}
    <section class="panel feed-panel"><div class="tabs">${[['unread','Непрочитанные',unreadCount(state,user().id)],['all','Все',all.length]].map(([id,label,count])=>`<button class="${tab===id?'active':''}" data-action="tab" data-id="${id}" aria-pressed="${tab===id}">${label}<span>${count}</span></button>`).join('')}</div>${filters()}<div id="results">${notificationResults()}</div></section><div class="page-footnote">${icon('shield')}Доступны только сообщения, адресованные выбранному пользователю. Время — Астана, UTC+5.</div>`;
}
function notificationResults(){
  const list=visibleNotifications(state,user().id).filter(n=>tab==='unread'?!n.readAt:true)
    .filter(n=>(moduleFilter==='all'||n.module===moduleFilter)&&(categoryFilter==='all'||n.category===categoryFilter))
    .filter(n=>`${notificationTitle(n)} ${n.title} ${n.body} ${person(n.actorId)}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
  const result=paginateNotifications(list,noticePage,noticePageSize);
  noticePage=result.page;
  const content=result.total?result.items.map(n=>notificationRow(n)).join(''):empty(tab==='unread'&&!query&&moduleFilter==='all'&&categoryFilter==='all'?'Непрочитанных уведомлений нет':'Уведомлений не найдено','Прочитанные сообщения доступны во вкладке «Все». Поиск и фильтры применяются к выбранной вкладке.');
  return `<div id="notification-list" tabindex="-1" aria-label="Список уведомлений">${content}</div>${notificationPagination(result)}`;
}
function notificationPagination({page,total,totalPages,from,to}){
  const pages=[...new Set([1,totalPages,...Array.from({length:5},(_,i)=>page+i-2).filter(p=>p>0&&p<=totalPages)])].sort((a,b)=>a-b);
  const numbers=pages.map((p,i)=>`${i&&p-pages[i-1]>1?'<span class="pagination-gap" aria-hidden="true">…</span>':''}<button data-action="notice-page" data-id="${p}" ${p===page?'aria-current="page"':''} aria-label="Страница ${p}">${p}</button>`).join('');
  return `<div class="notification-pagination"><p class="pagination-range" role="status" aria-live="polite">${total?`${from}–${to} из ${total}`:'0 уведомлений'}</p><label class="page-size">На странице <select id="notice-page-size" aria-label="Уведомлений на странице">${[10,25,50].map(n=>`<option value="${n}" ${noticePageSize===n?'selected':''}>${n}</option>`).join('')}</select></label>${totalPages>1?`<nav class="pagination-pages" aria-label="Страницы уведомлений"><button data-action="notice-page" data-id="${page-1}" aria-label="Предыдущая страница" ${page===1?'disabled':''}>${icon('back')}</button>${numbers}<button data-action="notice-page" data-id="${page+1}" aria-label="Следующая страница" ${page===totalPages?'disabled':''}>${icon('arrow')}</button></nav>`:''}</div>`;
}
function refreshNoticePage(focus=false){
  document.querySelector('#results').innerHTML=notificationResults();
  if(focus){const list=document.querySelector('#notification-list');list.focus({preventScroll:true});document.querySelector('.feed-panel').scrollIntoView({block:'start'});}
}
const empty=(title,subtitle)=>`<div class="empty">${icon('inbox')}<h3>${title}</h3><p>${subtitle}</p></div>`;
const taskActionLabels={approve:'Согласовать','approve-final':'Утвердить',acknowledge:'Ознакомиться','review-selection':'Рассмотреть результаты СУР',review:'Рассмотреть',respond:'Подготовить ответ',revise:'Доработать документ',attendance:'Подтвердить участие'};
function sentRoutes(){
  const grouped=new Map();
  for(const t of state.tasks){if(!grouped.has(t.routeId))grouped.set(t.routeId,[]);grouped.get(t.routeId).push(t);}
  return [...grouped.values()].map(tasks=>({tasks,first:tasks.find(t=>t.action!=='revise')||tasks[0]})).filter(r=>r.first.authorId===user().id).sort((a,b)=>b.first.createdAt.localeCompare(a.first.createdAt));
}
function routeState(route){
  const all=route.tasks;
  if(all.some(t=>t.status==='pending'&&t.action==='revise'))return 'На доработке';
  if(all.some(t=>t.status==='rejected'))return 'Отклонено';
  const pending=all.find(t=>t.status==='pending');
  if(pending)return pending.action==='approve-final'?'На утверждении':pending.action==='approve'?'На согласовании':pending.action==='acknowledge'?'На ознакомлении':'В работе';
  if(all.every(t=>t.status==='cancelled'))return 'Неактуально';
  return 'Завершено';
}
function tasksPage(){
  const incoming=pendingTasks(state,user().id),sent=sentRoutes();
  return `<section class="saq-workflow-root saq-workflow-inbox" aria-labelledby="tasks-heading"><div class="saq-workflow-inbox-heading"><h2 id="tasks-heading">Поручения</h2></div><div class="saq-workflow-tabs" role="tablist" aria-label="Раздел поручений">${[['incoming','Входящие',incoming.length],['sent','Отправленные',sent.length]].map(([id,l,count])=>`<button id="tasks-${id}" data-action="task-tab" data-id="${id}" role="tab" aria-selected="${taskTab===id}" aria-controls="tasks-panel">${l} <span>${count}</span></button>`).join('')}</div><div id="tasks-panel" role="tabpanel" aria-labelledby="tasks-${taskTab}"><div class="saq-workflow-filters ${taskTab==='incoming'?'saq-workflow-filters-single':''}"><div><label class="saq-workflow-label" for="task-search">Поиск</label><input id="task-search" type="search" value="${esc(taskQuery)}" placeholder="Документ, дело или участник"></div>${taskTab==='sent'?`<div><label class="saq-workflow-label" for="task-status">Состояние</label><select id="task-status"><option value="all">Все</option>${['На согласовании','На утверждении','На ознакомлении','В работе','На доработке','Отклонено','Завершено','Неактуально'].map(v=>`<option ${taskStatus===v?'selected':''}>${v}</option>`).join('')}</select></div>`:''}</div><div id="task-results">${taskResults()}</div></div></section>`;
}
function taskResults(){
  const search=taskQuery.trim().toLocaleLowerCase('ru');
  const matches=(e,people,extra='')=>`${e.title} ${e.number} ${e.organization} ${moduleNames[e.module]} ${people} ${extra}`.toLocaleLowerCase('ru').includes(search);
  const incoming=pendingTasks(state,user().id).filter(t=>matches(state.entities.find(e=>e.id===t.entityId),person(t.authorId),taskActionLabels[t.action]));
  const sent=sentRoutes().filter(r=>matches(state.entities.find(e=>e.id===r.first.entityId),r.tasks.map(t=>person(t.recipientId)).join(' '),routeState(r))&&(taskStatus==='all'||routeState(r)===taskStatus));
  const list=taskTab==='incoming'?incoming:sent;
  const documentCell=(e,t)=>`<strong>${esc(e.title)}</strong><span class="saq-workflow-cell-detail">№ ${esc(e.number)} · ${esc(e.organization)}</span><span class="saq-workflow-cell-detail">${esc(moduleNames[e.module])} · Редакция ${esc(t.version)}</span>`;
  return `<p class="saq-workflow-result-count" role="status">Найдено: ${list.length}</p>${!list.length?`<p class="saq-workflow-empty">${search||taskStatus!=='all'?'Нет поручений по выбранным условиям.':taskTab==='incoming'?'Нет новых поручений.':'Нет отправленных документов.'}</p>`:`<div class="saq-workflow-table-wrap"><table class="saq-workflow-table"><thead><tr><th scope="col">Документ</th><th scope="col">${taskTab==='incoming'?'Инициатор':'Участники маршрута'}</th><th scope="col">${taskTab==='incoming'?'Действие':'Состояние'}</th><th scope="col">Дата отправки</th><th scope="col">Документ</th></tr></thead><tbody>${list.map(item=>{
    const t=taskTab==='incoming'?item:item.first,e=state.entities.find(e=>e.id===t.entityId);
    const comment=taskTab==='sent'?[...item.tasks].reverse().find(t=>t.comment&&['returned','rejected'].includes(t.status))?.comment:e.history.slice().reverse().find(h=>h.comment)?.comment;
    const participants=taskTab==='sent'?[...new Set(item.tasks.filter(t=>t.status==='pending').length?item.tasks.filter(t=>t.status==='pending').map(t=>t.recipientId):item.tasks.map(t=>t.recipientId))].map(person).join('; '):person(t.authorId);
    return `<tr><td>${documentCell(e,t)}${comment&&((taskTab==='incoming'&&t.action==='revise')||(taskTab==='sent'&&['На доработке','Отклонено'].includes(routeState(item))))?`<span class="saq-workflow-comment"><strong>Причина:</strong> ${esc(comment)}</span>`:''}</td><td class="saq-workflow-participants">${esc(participants)}</td><td>${taskTab==='incoming'?`${taskActionLabels[t.action]}<span class="saq-workflow-cell-detail">Ожидает решения</span>${t.dueAt?`<span class="saq-workflow-cell-detail ${isOverdue(t)?'danger-text':''}">${isOverdue(t)?'Срок истёк:':'До'} ${fullDate(t.dueAt)}</span>`:''}`:routeState(item)}</td><td><time datetime="${t.createdAt}">${fullDate(t.createdAt)}</time></td><td><a class="task-open" href="#/document/${e.id}" data-action="open-task" data-id="${t.id}" aria-label="Перейти к документу: ${esc(e.title)}">Перейти ${icon('arrow')}</a></td></tr>`;
  }).join('')}</tbody></table></div>`}`;
}
function documentPage(){
  const entity=currentEntity(),id=entity?.id;
  const backLabel=documentOrigin==='tasks'?'К поручениям':'К уведомлениям';
  const back=`<a href="#/${documentOrigin}" class="text-button back-link">${icon('back')}${backLabel}</a>`;
  if(!entity||!canOpen(state,id,user().id))return `${back}<section class="panel">${empty('Документ недоступен','Возможно, документ удалён или ваши права изменились. Обратитесь к отправителю.')}</section>`;
  const task=state.tasks.find(t=>t.entityId===id&&(isDemoSuperuser(user().id)||t.recipientId===user().id)&&t.status==='pending');
  const waiting=state.tasks.find(t=>t.entityId===id&&(isDemoSuperuser(user().id)||t.recipientId===user().id)&&t.status==='waiting');
  return `<div class="document-navigation">${back}<div class="breadcrumb">${esc(moduleNames[entity.module])}<span>/</span>Документы<span>/</span>№ ${esc(entity.number)}</div></div>
  <div class="document-layout"><section class="panel document-panel" aria-label="Документ ${esc(entity.title)}"><header class="document-toolbar"><div><strong>${esc(entity.title)}</strong><span>Редакция ${esc(entity.version)} · ${esc(entity.status)}</span></div>${task?`<div class="document-actions">${taskButtons(task)}</div>`:''}</header>
  ${task?`<div class="document-route-meta"><span>Инициатор: ${esc(person(task.authorId))}</span><span>${actionNames[task.action]}</span>${task.dueAt?`<span class="${isOverdue(task)?'danger-text':''}">${isOverdue(task)?'Срок истёк:':'Срок:'} ${fullDate(task.dueAt)}</span>`:''}</div>`:`<p class="document-route-meta">${waiting?'Ожидается завершение предыдущего этапа согласования.':'Документ открыт для просмотра. Действий от вас не требуется.'}</p>`}
  ${task?.action==='acknowledge'?'<p class="document-ack-note">Ознакомление подтверждается отдельной кнопкой в документе.</p>':''}
  <article class="document-sheet"><h2>${esc(entity.title)}</h2><p class="document-number">№ ${esc(entity.number)}</p><dl class="document-meta"><div><dt>Организация</dt><dd>${esc(entity.organization)}</dd></div><div><dt>Инициатор</dt><dd>${esc(person(entity.authorId))}</dd></div><div><dt>Редакция</dt><dd>${esc(entity.version)}</dd></div><div><dt>Состояние</dt><dd>${esc(entity.status)}</dd></div></dl><p class="document-content">${esc(entity.content)}</p>${entity.kind==='selection'?selectionTable(entity,Boolean(task)):''}${entity.response?`<div class="notice"><strong>Ответ адресата</strong><p>${esc(entity.response)}</p></div>`:''}<p class="document-demo-note">Демонстрационная форма документа · ${esc(moduleNames[entity.module])}</p></article></section>
  <aside class="panel history-panel"><h2>История документа</h2><ol>${[...entity.history].reverse().map(h=>`<li><strong>${esc(h.text)}</strong><span>${esc(person(h.actorId))}</span><time>${shortDate(h.at)}</time>${h.comment?`<p>${esc(h.comment)}</p>`:''}</li>`).join('')}</ol></aside></div>`;
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
function rulesPage(){return `<div class="breadcrumb">Модель SAQ <span>/</span> Как это работает</div><div class="page-heading"><div><h1>Один процесс. Два способа открыть.</h1><p>Уведомление привлекает внимание, поручение хранит обязательное действие.</p></div></div><div class="rules-grid"><section class="panel rule-card">${icon('bell')}<h2>Уведомления</h2><p>Что произошло, с каким документом, кто отправил и когда. В колокольчике — последние 5 сообщений, в общем разделе — весь список уведомлений.</p><p>Счётчик означает количество непрочитанных сообщений.</p></section><section class="panel rule-card">${icon('tasks')}<h2>Поручения</h2><p>Что нужно сделать, по какому документу и в какой срок. Информационные результаты не создают поручений.</p><p>Счётчик означает количество открытых действий.</p></section></div><section class="panel rules-list"><h2>Правила работы</h2>${[
  ['Модуль и тип — разные признаки','«Возражения» — источник. «Согласование», «Заседание» или «Результат» — смысл сообщения. Если событие затрагивает ВГА, дополнительно показывается связь с исходным мероприятием.'],
  ['Единый переход','Из уведомления и поручения открывается тот же документ, нужная редакция и доступное пользователю действие. Если назначение отменено, история остаётся, а выполнить его нельзя.'],
  ['Прочитано — ещё не выполнено','Открытие сообщения меняет только его прочитанность. Ознакомление, решение, ответ на опрос и подписание фиксируются отдельными действиями.'],
  ['Каждому — свои сообщения','Получатель определяется по назначению, организации, области данных и действующему этапу. Роль сама по себе не означает рассылку всем сотрудникам с этой ролью.'],
  ['Обратная связь отправителю','Инициатор получает итог, возврат, отказ или подтверждение ознакомления. Отправитель СУР видит результаты регионов и завершение общего рассмотрения.'],
  ['Хранение','В рабочей SAQ нужен единый серверный реестр событий и личных уведомлений. Документы и поручения остаются в своих процессах. Прочитанные сообщения сохраняются во вкладке «Все».'],
  ['Каналы','Первый этап — кабинет SAQ и колокольчик во всех модулях. Почта может дублировать уведомление со ссылкой после настройки. СМС и push не нужны для первого макета.'],
  ['Без лишнего шума','Сохранение черновика не отправляет уведомлений. Повторная доставка события не создаёт дубль. Напоминание ссылается на существующее поручение.'],
  ['Сроки','Срок берётся из документа и маршрута. Часовой пояс показывается явно. Рабочие дни и переносы рассчитывает бизнес-процесс, а не текст уведомления.'],
].map(([h,p])=>`<article><h3>${h}</h3><p>${p}</p></article>`).join('')}</section><section class="notice"><strong>Границы этого макета</strong><p>Данные демонстрационные. Роли можно переключать в правом верхнем углу. Изменения сохраняются в этом браузере. Серверная авторизация, ЭЦП, реальные рассылки и интеграции с пятью модулями ещё не подключены.</p><button class="button secondary" data-action="reset-demo">${icon('refresh')}Восстановить примеры</button></section>`;}
function render(){
  const p=page();document.title=`${p==='tasks'?'Поручения':p==='catalog'?'Каталог уведомлений':p==='document'?'Документ':p==='rules'?'Модель уведомлений':'Уведомления'} · SAQ`;
  app.innerHTML=shell(p==='tasks'?tasksPage():p==='document'?documentPage():p==='catalog'?catalogPage():p==='rules'?rulesPage():notificationPage());
}
function perform(taskId,decision,comment='',payload={}){
  if(page()!=='document'||state.tasks.find(t=>t.id===taskId)?.entityId!==currentEntity()?.id)return;
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
  event.preventDefault();
  const {action,id,decision}=b.dataset;
  if(action==='bell'||action==='bell-close'){bellOpen=action==='bell'?!bellOpen:false;render();if(bellOpen)document.querySelector('#bell-panel button')?.focus();else document.querySelector('#bell-button')?.focus();}
  if(action==='bell-tab'){bellTab=id;render();}
  if(action==='mobile-menu'){mobileNav=!mobileNav;render();}
  if(action==='sidebar-toggle'){sidebarExpanded=!sidebarExpanded;try{localStorage.setItem('saq.notifications.sidebar.expanded',String(sidebarExpanded));}catch{}render();}
  if(action==='all-notices'){tab='all';noticePage=1;moduleFilter='all';categoryFilter='all';query='';navigate('notifications');}
  if(action==='tab'){tab=id;noticePage=1;render();}
  if(action==='notice-page'){noticePage=Number(id);refreshNoticePage(true);}
  if(action==='task-tab'){taskTab=id;taskStatus='all';render();}
  if(action==='reset-filters'){moduleFilter='all';categoryFilter='all';query='';noticePage=1;render();}
  if(action==='open-notice'){const n=state.notifications.find(n=>n.id===id&&(isDemoSuperuser(user().id)||n.recipientId===user().id));if(n)openEntity(n.entityId,n.id);}
  if(action==='open-task'){const t=state.tasks.find(t=>t.id===id);if(t)openEntity(t.entityId);}
  if(action==='toggle-read'){const n=state.notifications.find(n=>n.id===id&&(isDemoSuperuser(user().id)||n.recipientId===user().id));if(n)n.readAt=n.readAt?null:new Date().toISOString();save();render();}
  if(action==='read-all'){const now=new Date().toISOString();visibleNotifications(state,user().id).forEach(n=>n.readAt ||= now);save();render();notify('Уведомления отмечены прочитанными. Открытые поручения сохранены.');}
  if(action==='decision'&&page()==='document'&&state.tasks.find(t=>t.id===id)?.entityId===currentEntity()?.id)decisionDialog(id,decision);
  if(action==='close-dialog')document.querySelector('#decision-dialog').close();
  if(action==='reset-demo'){
    const dlg=document.querySelector('#decision-dialog');dlg.innerHTML='<form id="reset-form"><div class="dialog-heading"><h2>Восстановить примеры?</h2></div><p>Ваши демонстрационные решения и прочтения будут сброшены.</p><div class="dialog-actions"><button type="button" class="button secondary" data-action="close-dialog">Отмена</button><button class="button primary" type="submit">Восстановить</button></div></form>';dlg.showModal();
  }
});
document.addEventListener('submit',event=>{
  if(event.target.id==='decision-form'){event.preventDefault();perform(event.target.dataset.task,event.target.dataset.decision,new FormData(event.target).get('comment')||'');}
  if(event.target.id==='reset-form'){event.preventDefault();state=makeSeed();save();document.querySelector('#decision-dialog').close();tab='unread';bellTab='unread';noticePage=1;noticePageSize=10;moduleFilter='all';categoryFilter='all';query='';navigate('notifications');notify('Примеры восстановлены.');}
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='persona'){state.activeUserId=el.value;save();tab='unread';bellTab='unread';noticePage=1;taskTab='incoming';taskQuery='';taskStatus='all';moduleFilter='all';categoryFilter='all';query='';bellOpen=false;navigate(page()==='tasks'?'tasks':'notifications');}
  if(el.id==='task-status'){taskStatus=el.value;document.querySelector('#task-results').innerHTML=taskResults();}
  if(el.id==='module-filter'){moduleFilter=el.value;noticePage=1;render();}
  if(el.id==='category-filter'){categoryFilter=el.value;noticePage=1;render();}
  if(el.id==='notice-page-size'){noticePageSize=[10,25,50].includes(Number(el.value))?Number(el.value):10;noticePage=1;state.preferences.notificationPageSize=noticePageSize;save();refreshNoticePage();document.querySelector('#notice-page-size').focus({preventScroll:true});}
  if(el.matches('.selection-check')){const reason=document.querySelector(`.selection-reason[data-id="${el.dataset.id}"]`);reason.disabled=el.checked;if(!el.checked)reason.focus();}
});
document.addEventListener('input',event=>{if(event.target.id==='task-search'){taskQuery=event.target.value;document.querySelector('#task-results').innerHTML=taskResults();}if(event.target.id==='search'){query=event.target.value;noticePage=1;document.querySelector('#results').innerHTML=page()==='catalog'?catalogResults():notificationResults();}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&(bellOpen||mobileNav)){bellOpen=false;mobileNav=false;render();document.querySelector('#bell-button')?.focus();}});
window.addEventListener('hashchange',()=>{bellOpen=false;mobileNav=false;render();window.scrollTo(0,0);});
window.addEventListener('storage',event=>{if(event.key===KEY&&event.newValue){try{const next=JSON.parse(event.newValue);if(next.schemaVersion===1){state={...next,activeUserId:state.activeUserId};render();}}catch{ /* keep current usable session */ }}});
render();
