import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = await readFile(resolve(root, "app.js"), "utf8");
const catalog = await readFile(resolve(root, "catalog.js"), "utf8");
const definitionsStart = app.indexOf("let questionRandomState =");
const definitionsEnd = app.indexOf("\nfunction recordAnswer", definitionsStart);
assert.ok(definitionsStart >= 0 && definitionsEnd > definitionsStart, "question and answer rules are present");

const sandbox = vm.createContext({});
const bootstrap = `
  const topicNames = {
    foundations: "Foundations", limits: "Limits", derivatives: "Derivatives",
    integrals: "Integrals", multivariable: "Multivariable calculus", "linear-algebra": "Linear algebra"
  };
  const difficultyNames = { easy: "Easy", medium: "Medium", challenge: "Challenge" };
  const topicList = Object.keys(topicNames);
  const lessons = [];
  const state = { problemSequence: 0 };
  const window = {};
  const document = { querySelector: () => null };
`;
vm.runInContext(bootstrap + app.slice(definitionsStart, definitionsEnd) + "\n" + catalog, sandbox);

const topics = vm.runInContext("Object.keys(topicNames)", sandbox);
const difficulties = ["easy", "medium", "challenge"];
for (const topic of topics) {
  for (const difficulty of difficulties) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const question = vm.runInContext(`buildQuestion(${JSON.stringify(topic)}, ${JSON.stringify(difficulty)})`, sandbox);
      assert.equal(question.topic, topic);
      assert.equal(question.difficulty, difficulty);
      assert.ok(question.id && question.prompt && question.hint && question.solution, `${topic}/${difficulty} has complete lesson text`);
      const rightAnswer = Array.isArray(question.answer) ? question.answer.join(", ") : String(question.answer);
      assert.ok(vm.runInContext(`isCorrectAnswer(${JSON.stringify(rightAnswer)}, ${JSON.stringify(question.answer)})`, sandbox), `${topic}/${difficulty} accepts its generated answer`);
      const wrongAnswer = Array.isArray(question.answer)
        ? [question.answer[0] + 1, ...question.answer.slice(1)].join(", ")
        : String(question.answer + 1);
      assert.ok(!vm.runInContext(`isCorrectAnswer(${JSON.stringify(wrongAnswer)}, ${JSON.stringify(question.answer)})`, sandbox), `${topic}/${difficulty} rejects a changed answer`);
    }
  }
}
console.log(`Checked ${topics.length} topics × ${difficulties.length} levels × 8 generated problems.`);
