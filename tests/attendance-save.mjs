import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../classboard/classboard-auth.js', import.meta.url), 'utf8');
const start = source.indexOf("card.querySelector('.subject-calculator').addEventListener('submit', async (event) => {");
assert(start >= 0);
const handler = source.slice(source.indexOf('async (event)', start), source.indexOf('}, true);', start) + 1);
async function run({ subject = { id: 'subject' }, heldError = null, roles = ['student'], code = 'IBM-2' } = {}) {
  const notices = [], writes = [], button = { disabled: false };
  const sandbox = {
    window: { classboardContext: { roles, classCode: code } },
    document: { getElementById: () => null },
    heldInput: { value: '20' }, attendedInput: { value: '15' },
    classId: 'class', userId: 'user', roles, rollNumber: 1, batchFromRoll: 'B1', held: 18,
    resolveSubject: () => subject, batchCodesForClass: () => ['B1','B2'],
    card: { dataset: { subjectName: 'Java' }, querySelector: () => button },
    notifyApp: (...args) => notices.push(args), loadAttendancePlanner: async () => {},
    client: { from(table) { return { upsert() { writes.push(table); return { select() { return { maybeSingle: async () => ({error: table === 'attendance_class_counts' ? heldError : null}) }; } }; } }; } }
  };
  await vm.runInNewContext(`(${handler})`, sandbox)({ preventDefault() {}, stopImmediatePropagation() {} });
  assert.equal(button.disabled, false, 'button remains usable');
  return { notices, writes };
}
let result = await run({subject:null});
assert.equal(result.writes.length,0);
assert.match(result.notices[0][0],/Could not identify/);
for (const roles of [['student'],['student','admin']]) {
  result = await run({roles, heldError:{message:'permission denied'}});
  assert.deepEqual(result.writes,['attendance_class_counts']);
  assert.equal(result.notices.length,1);
  assert.equal(result.notices[0][1],true);
  assert.match(result.notices[0][0],/did not save: permission denied/);
}
result = await run();
assert.deepEqual(result.writes,['attendance_class_counts','student_attendance_progress']);
assert.match(result.notices[0][0],/were saved/);
result = await run({code:'INTEL-1'});
assert.deepEqual(result.writes,['student_attendance_progress']);
console.log('PASS: missing subject, failed IBM/staff shared saves, successful shared and private saves');
