export const pendingTasks = (state,userId) => state.tasks.filter(t=>t.recipientId===userId && t.status==='pending');
export const visibleNotifications = (state,userId) => state.notifications.filter(n=>n.recipientId===userId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
// Filter before calling this helper. Clamp after reading/archiving the last item.
export function paginateNotifications(list,page=1,pageSize=10) {
  const size=[10,25,50].includes(Number(pageSize))?Number(pageSize):10;
  const total=list.length,totalPages=Math.max(1,Math.ceil(total/size));
  const current=Math.min(totalPages,Math.max(1,Math.trunc(Number(page))||1));
  const start=(current-1)*size;
  return {items:list.slice(start,start+size),page:current,pageSize:size,total,totalPages,from:total?start+1:0,to:Math.min(start+size,total)};
}
export const unreadCount = (state,userId) => visibleNotifications(state,userId).filter(n=>!n.readAt&&!n.archivedAt).length;
export const canOpen = (state,entityId,userId) => Boolean(state.entities.find(e=>e.id===entityId)?.allowedUserIds.includes(userId));
export function needsAction(state,notification) {
  return Boolean(state.tasks.find(t=>t.id===notification.taskId && t.recipientId===notification.recipientId && t.status==='pending'));
}
export function readNotification(state,id,userId,at=new Date().toISOString()) {
  const n=state.notifications.find(n=>n.id===id&&n.recipientId===userId);
  if(n) n.readAt=at;
  return state;
}
export function archiveNotification(state,id,userId,at=new Date().toISOString()) {
  const n=state.notifications.find(n=>n.id===id&&n.recipientId===userId);
  if(!n) throw Error('Уведомление недоступно.');
  if(needsAction(state,n)) throw Error('Сначала выполните поручение. Прочтение уведомления не завершает его.');
  n.archivedAt=n.archivedAt?null:at;
  if(n.archivedAt)n.readAt ||= at;
  return state;
}
export function addNotification(state,data) {
  if(state.notifications.some(n=>n.eventId===data.eventId && n.recipientId===data.recipientId))return;
  state.notifications.push({id:`notice-new-${state.sequence++}`,readAt:null,archivedAt:null,...data});
}
const actions = {
  approve:['approve','return','reject'], 'approve-final':['approve','return','reject'],
  acknowledge:['acknowledge'], 'review-selection':['submit-selection'],
  review:['review'], respond:['respond'], revise:['resubmit'], attendance:['yes','no'],
};
export function actOnTask(input,taskId,userId,decision,comment='',payload={},at=new Date().toISOString()) {
  const state=structuredClone(input);
  const task=state.tasks.find(t=>t.id===taskId);
  if(!task||task.recipientId!==userId||!canOpen(state,task.entityId,userId))throw Error('Нет доступа к этому поручению.');
  if(task.status!=='pending')throw Error('Поручение уже завершено или отменено.');
  const entity=state.entities.find(e=>e.id===task.entityId);
  if(entity.version!==task.version)throw Error('Редакция изменилась. Откройте актуальное поручение.');
  if(!actions[task.action]?.includes(decision))throw Error('Действие недоступно на этом этапе.');
  if(['return','reject','no','respond','review','resubmit'].includes(decision)&&!comment.trim())throw Error('Укажите комментарий к решению.');
  if(decision==='submit-selection') {
    if(!Array.isArray(payload.items)||payload.items.length!==entity.items.length||new Set(payload.items.map(i=>i.id)).size!==entity.items.length)throw Error('Проверьте решения по всем объектам.');
    if(entity.items.some(i=>!payload.items.some(p=>p.id===i.id)))throw Error('Состав отбора изменился.');
    if(payload.items.some(i=>typeof i.include!=='boolean'||(!i.include&&!i.reason?.trim())))throw Error('Для каждого исключённого объекта укажите основание.');
    entity.items=entity.items.map(i=>({...i,...payload.items.find(p=>p.id===i.id)}));
  }
  task.status=decision==='return'?'returned':decision==='reject'?'rejected':'completed';
  task.completedAt=at;task.comment=comment.trim();task.decision=decision;
  const label={approve:task.action==='approve-final'?'Документ утверждён':'Документ согласован',return:'Документ возвращён на доработку',reject:'Документ отклонён',acknowledge:'Ознакомление подтверждено','submit-selection':'Регион завершил рассмотрение',review:'Материалы рассмотрены',respond:'Ответ направлен',resubmit:'Новая редакция направлена на согласование',yes:'Участие в заседании подтверждено',no:'Участник не сможет присутствовать'}[decision];
  entity.history.push({at,actorId:userId,text:label,comment:comment.trim()});
  entity.status=label;
  const eventId=`decision-${task.id}-${at}`;
  const send=(recipientId,title,body,category='result',taskId=null)=>addNotification(state,{eventId,recipientId,actorId:userId,module:entity.module,category,entityId:entity.id,version:entity.version,taskId,title,body,createdAt:at});
  // A return/rejection cancels pending and waiting steps for this route only.
  if(['return','reject'].includes(decision)) {
    for(const other of state.tasks.filter(t=>t.routeId===task.routeId&&t.id!==task.id&&['pending','waiting'].includes(t.status))) {
      const wasActive=other.status==='pending'; other.status='cancelled';
      if(wasActive)addNotification(state,{eventId:`${eventId}-cancel-${other.id}`,recipientId:other.recipientId,actorId:userId,module:entity.module,category:'result',entityId:entity.id,taskId:other.id,version:other.version,title:'Задание по документу отменено',body:`${entity.title} № ${entity.number}: ${label.toLowerCase()}.`,createdAt:at});
    }
    let revisionTask=null;
    if(decision==='return') {
      revisionTask=`revise-${task.id}-${state.sequence++}`;
      state.tasks.push({id:revisionTask,entityId:entity.id,recipientId:task.authorId,authorId:userId,action:'revise',status:'pending',createdAt:at,dueAt:null,version:entity.version,routeId:task.routeId,step:0});
    }
    send(task.authorId,label,`${entity.title} № ${entity.number}. Причина: ${comment.trim()}.`,decision==='return'?'revision':'result',revisionTask);
  } else if(decision==='approve') {
    const remaining=state.tasks.filter(t=>t.routeId===task.routeId&&t.status==='pending');
    const next=state.tasks.filter(t=>t.routeId===task.routeId&&t.status==='waiting').sort((a,b)=>a.step-b.step)[0];
    if(next&&!remaining.length){
      next.status='pending';next.createdAt=at;
      entity.status='На утверждении';
      send(next.recipientId,'Утвердите документ',`${entity.title} № ${entity.number} согласован(а) и ожидает утверждения.`, 'signing',next.id);
    } else if(!next&&!remaining.length)send(task.authorId,label,`${entity.title} № ${entity.number}. Все этапы маршрута завершены.`);
  } else if(decision==='resubmit') {
    entity.version=String(Number(entity.version)+1); entity.status='На согласовании';
    const newId=`review-${entity.id}-${state.sequence++}`;
    state.tasks.push({id:newId,entityId:entity.id,recipientId:task.authorId,authorId:userId,action:'approve',status:'pending',createdAt:at,dueAt:null,version:entity.version,routeId:`route-${entity.id}-v${entity.version}`,step:0});
    send(task.authorId,'Согласуйте новую редакцию',`${entity.title} № ${entity.number}, редакция ${entity.version}. ${comment.trim()}`, 'approval',newId);
  } else if(decision==='respond') {
    const newId=`response-${task.id}-${state.sequence++}`;
    state.tasks.push({id:newId,entityId:entity.id,recipientId:task.authorId,authorId:userId,action:'review',status:'pending',createdAt:at,dueAt:null,version:entity.version,routeId:`response-${task.routeId}`,step:0});
    entity.response=comment.trim();
    send(task.authorId,'Рассмотрите ответ адресата',`${entity.title} № ${entity.number}. Ответ: ${comment.trim()}`, 'review',newId);
  } else {
    const extra=decision==='submit-selection'?`Включено: ${entity.items.filter(i=>i.include).length}; исключено: ${entity.items.filter(i=>!i.include).length}.`:comment.trim();
    send(task.authorId,label,`${entity.title} № ${entity.number}. ${extra}`);
  }
  // Completing a domain action is not implemented by toggling readAt.
  state.notifications.filter(n=>n.taskId===task.id&&n.recipientId===userId).forEach(n=>{n.readAt ||= at;});
  return state;
}
