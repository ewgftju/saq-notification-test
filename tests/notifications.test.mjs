import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSeed } from '../data.js';
import { catalog } from '../catalog.js';
import { pendingTasks, visibleNotifications, unreadCount, needsAction, canOpen, readNotification, archiveNotification, addNotification, actOnTask } from '../model.js';
const seed=()=>makeSeed(new Date('2026-10-05T04:00:00Z'));
const at='2026-10-05T05:00:00Z';

test('Reading all messages leaves every pending assignment unchanged',()=>{
  const s=seed(),before=pendingTasks(s,'reviewer').map(t=>t.id);
  visibleNotifications(s,'reviewer').forEach(n=>readNotification(s,n.id,'reviewer',at));
  assert.equal(unreadCount(s,'reviewer'),0);assert.deepEqual(pendingTasks(s,'reviewer').map(t=>t.id),before);
});
test('Opening an acknowledgement notification does not acknowledge the document',()=>{
  const s=seed();readNotification(s,'notice-audit-report','subject',at);
  assert.equal(s.tasks.find(t=>t.id==='task-audit-report').status,'pending');
  const out=actOnTask(s,'task-audit-report','subject','acknowledge','',{},at);
  assert.equal(out.tasks.find(t=>t.id==='task-audit-report').status,'completed');
  assert.ok(visibleNotifications(out,'author').some(n=>n.title==='Ознакомление подтверждено'));
});
test('Sequential approval activates and notifies only the next assignee',()=>{
  const s=seed();assert.equal(visibleNotifications(s,'director').length,0);
  const next=actOnTask(s,'task-program','reviewer','approve','',{},at);
  assert.equal(next.tasks.find(t=>t.id==='task-program-final').status,'pending');
  assert.equal(visibleNotifications(next,'director').length,1);
  assert.equal(visibleNotifications(next,'author').filter(n=>n.entityId==='program').length,0);
  const done=actOnTask(next,'task-program-final','director','approve','',{},at);
  assert.ok(visibleNotifications(done,'author').some(n=>n.entityId==='program'&&n.title==='Документ утверждён'));
});
test('Return requires a reason, cancels later steps, and creates author revision task',()=>{
  assert.throws(()=>actOnTask(seed(),'task-program','reviewer','return',' '),/комментарий/);
  const s=actOnTask(seed(),'task-program','reviewer','return','Уточнить охват',{},at);
  assert.equal(s.tasks.find(t=>t.id==='task-program-final').status,'cancelled');
  assert.ok(pendingTasks(s,'author').some(t=>t.entityId==='program'&&t.action==='revise'));
  assert.equal(visibleNotifications(s,'director').length,0);
});
test('Rejection never silently creates a revision assignment',()=>{
  const s=actOnTask(seed(),'task-program','reviewer','reject','Неверный состав объектов',{},at);
  assert.equal(s.tasks.some(t=>t.entityId==='program'&&t.action==='revise'),false);
  assert.equal(s.tasks.find(t=>t.id==='task-program-final').status,'cancelled');
});
test('Closed and wrong-user assignments cannot be acted on',()=>{
  assert.throws(()=>actOnTask(seed(),'task-program','subject','approve'),/доступа/);
  assert.throws(()=>actOnTask(seed(),'task-obsolete','reviewer','approve'),/завершено/);
  const s=actOnTask(seed(),'task-program','reviewer','approve');
  assert.throws(()=>actOnTask(s,'task-program','reviewer','approve'),/завершено/);
  assert.equal(canOpen(s,'program','subject'),false);
});
test('Stale version is blocked even when task is still pending',()=>{
  const s=seed();s.entities.find(e=>e.id==='program').version='2';
  assert.throws(()=>actOnTask(s,'task-program','reviewer','approve'),/Редакция/);
});
test('Region must justify exclusions; result travels to original SUR sender',()=>{
  const s=seed(),items=structuredClone(s.entities.find(e=>e.id==='sur-selection').items);
  items[0].include=false;
  assert.throws(()=>actOnTask(s,'task-sur-selection','region','submit-selection','',{items}),/основание/);
  items[0].reason='Объект уже включён в действующее мероприятие';
  const next=actOnTask(s,'task-sur-selection','region','submit-selection','',{items},at);
  assert.ok(visibleNotifications(next,'analyst').some(n=>n.title==='Регион завершил рассмотрение'&&n.body.includes('исключено: 1')));
  assert.equal(pendingTasks(next,'region').length,0);
});
test('Attendance answer is independent from notification read status',()=>{
  const s=seed();readNotification(s,'notice-meeting','commission',at);
  assert.equal(s.tasks.find(t=>t.id==='task-meeting').status,'pending');
  const next=actOnTask(s,'task-meeting','commission','yes','',{},at);
  assert.ok(visibleNotifications(next,'secretary').some(n=>n.title==='Участие в заседании подтверждено'));
});
test('Deduplication uses event and recipient, allowing individual state',()=>{
  const s=seed(),n=s.notifications[0],count=s.notifications.length;
  addNotification(s,{...n,id:'duplicate'});assert.equal(s.notifications.length,count);
  addNotification(s,{...n,recipientId:'author'});assert.equal(s.notifications.length,count+1);
});
test('Active action cannot be hidden in archive; completion permits archive',()=>{
  const s=seed();assert.throws(()=>archiveNotification(s,'notice-audit-report','subject'),/выполните/);
  const next=actOnTask(s,'task-audit-report','subject','acknowledge');
  archiveNotification(next,'notice-audit-report','subject',at);
  assert.ok(next.notifications.find(n=>n.id==='notice-audit-report').archivedAt);
  assert.equal(needsAction(next,next.notifications.find(n=>n.id==='notice-audit-report')),false);
});
test('Only the notification recipient can mark it read',()=>{
  const s=seed();readNotification(s,'notice-program','subject',at);
  assert.equal(s.notifications.find(n=>n.id==='notice-program').readAt,null);
});
test('New revision keeps old task history and creates a fresh route',()=>{
  const s=actOnTask(seed(),'task-program','reviewer','return','Уточнить предмет',{},at);
  const t=pendingTasks(s,'author').find(t=>t.entityId==='program');
  const next=actOnTask(s,t.id,'author','resubmit','Предмет уточнён',{},at);
  assert.equal(next.entities.find(e=>e.id==='program').version,'2');
  assert.ok(pendingTasks(next,'reviewer').some(t=>t.entityId==='program'&&t.version==='2'&&t.routeId!=='route-program'));
  assert.equal(next.tasks.find(t=>t.id==='task-program').status,'returned');
});
test('Catalog covers all five modules and template fields are present',()=>{
  for(const m of ['sur','evga','sva','prof','objections'])assert.ok(catalog.some(e=>e.module===m));
  assert.equal(new Set(catalog.map(e=>e.id)).size,catalog.length);
  for(const e of catalog)for(const k of ['event','actor','recipient','title','body','task','action'])assert.ok(e[k]);
});
