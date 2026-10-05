import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSeed} from '../data.js';
import {actOnTask, pendingTasks, canOpen} from '../model.js';
test('superuser performs both stages inside the document while preserving route order and actor',()=>{
 const actor='saq-demo-superuser';let state=makeSeed();
 assert.ok(canOpen(state,'program',actor));
 assert.ok(pendingTasks(state,actor).some(t=>t.id==='task-program'));
 assert.throws(()=>actOnTask(state,'task-program-final',actor,'approve'));
 state=actOnTask(state,'task-program',actor,'approve');
 assert.equal(state.tasks.find(t=>t.id==='task-program-final').status,'pending');
 state=actOnTask(state,'task-program-final',actor,'approve');
 assert.equal(state.entities.find(e=>e.id==='program').history.at(-1).actorId,actor);
 assert.throws(()=>actOnTask(state,'task-program-final',actor,'approve'));
});
