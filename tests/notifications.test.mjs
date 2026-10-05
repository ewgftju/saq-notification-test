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

test('Pagination keeps 1,003 notifications reachable with stable ordering and no overlap',async()=>{
  const {paginateNotifications}=await import('../model.js');
  const s={notifications:Array.from({length:1003},(_,i)=>({id:`n-${String(i).padStart(4,'0')}`,recipientId:'reviewer',createdAt:at}))};
  const list=visibleNotifications(s,'reviewer');
  const ids=[];
  for(let page=1;page<=101;page++)ids.push(...paginateNotifications(list,page,10).items.map(n=>n.id));
  assert.equal(ids.length,1003);assert.equal(new Set(ids).size,1003);
  assert.deepEqual(ids,list.map(n=>n.id));
  assert.deepEqual(visibleNotifications({notifications:[...s.notifications].reverse()},'reviewer'),list);
  const last=paginateNotifications(list,101,10);
  assert.equal(last.from,1001);assert.equal(last.to,1003);
});
test('Pagination clamps after removals, handles empty results and restricts page size',async()=>{
  const {paginateNotifications}=await import('../model.js');
  const list=Array.from({length:11},(_,i)=>i);
  assert.equal(paginateNotifications(list,2).items.length,1);
  const removed=paginateNotifications(list.slice(0,10),2);
  assert.equal(removed.page,1);assert.equal(removed.items.length,10);
  const empty=paginateNotifications([],8);
  assert.deepEqual([empty.page,empty.from,empty.to,empty.total],[1,0,0,0]);
  assert.equal(paginateNotifications(list,-3,10000).pageSize,10);
  assert.equal(paginateNotifications(list,-3).page,1);
  for(const size of [10,25,50])assert.equal(paginateNotifications(Array(100),1,size).items.length,size);
});
test('Filtering before pagination finds matches beyond the first page',async()=>{
  const {paginateNotifications}=await import('../model.js');
  const s=seed(),list=visibleNotifications(s,'reviewer').filter(n=>n.body.includes('СУР-2026-103'));
  const result=paginateNotifications(list,4,10);
  assert.equal(result.total,1);assert.equal(result.page,1);assert.equal(result.items[0].entityId,'demo-history-04');
});
test('Adding demo history preserves decisions, read state and assignments',async()=>{
  const {ensureDemoHistory}=await import('../data.js');
  const s=seed();readNotification(s,'notice-demo-history-01','reviewer',at);
  const tasks=structuredClone(s.tasks),count=s.notifications.length;
  delete s.preferences.demoHistoryVersion;ensureDemoHistory(s);ensureDemoHistory(s);
  assert.deepEqual(s.tasks,tasks);assert.equal(s.notifications.length,count);
  assert.equal(s.notifications.find(n=>n.id==='notice-demo-history-01').readAt,at);
  assert.ok(s.notifications.filter(n=>n.id.startsWith('notice-demo-history-')).every(n=>canOpen(s,n.entityId,n.recipientId)));
});
