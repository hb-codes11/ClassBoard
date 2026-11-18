import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../classboard/classboard-auth.js', import.meta.url), 'utf8');
const start = source.indexOf("uploadToggle?.addEventListener('click', () => {");
const end = source.indexOf("document.getElementById('cancelResourceUpload')", start);
const openCode = source.slice(start, end);
for (const activeType of ['Lab manual', 'Notes', 'Syllabus', 'MST / PYQs', 'all']) {
  let click;
  let changes = 0;
  const typeSelect = {
    value: 'Notes',
    options: ['Notes', 'Syllabus', 'Lab manual', 'MST / PYQs', 'Academic calendar'].map(value => ({ value })),
    dispatchEvent() { changes++; }
  };
  const panel = { hidden: true, scrollIntoView() {} };
  vm.runInNewContext(openCode, {
    uploadToggle: { addEventListener(_, handler) { click = handler; }, setAttribute() {} },
    uploadPanel: panel,
    document: {
      querySelector: () => ({ dataset: { resourceType: activeType } }),
      getElementById: () => ({ elements: { namedItem: () => typeSelect } })
    },
    Event: class {}
  });
  click();
  assert.equal(typeSelect.value, activeType === 'all' ? 'Notes' : activeType);
  assert.equal(changes, activeType === 'all' ? 0 : 1);
  typeSelect.value = 'Syllabus';
  click(); // Closing the panel preserves an in-progress choice.
  assert.equal(typeSelect.value, 'Syllabus');
}
const saveStart = source.indexOf("const publishedType = String(values.get('type'));");
const saveEnd = source.indexOf('try { await loadLiveClassData(context.classId); }', saveStart);
const tabs = ['Notes','Lab manual','Syllabus'].map(resourceType => ({ dataset: { resourceType }, clicked: false, click() { this.clicked = true; } }));
vm.runInNewContext(source.slice(saveStart, saveEnd), {
  values: new Map([['type', 'Lab manual']]),
  document: { querySelectorAll: () => tabs }
});
assert.deepEqual(tabs.map(tab => tab.clicked), [false,true,false]);
console.log('PASS: active upload category, all-files default, close behavior, and saved-category navigation');
