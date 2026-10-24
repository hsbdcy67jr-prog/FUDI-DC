/* FUDI-DC topic expansion. Kept separate from the dashboard shell so the
   authored generators stay easy to review and the static app needs no build. */
(function () {
  const additions = {
    algebra: "Algebra",
    geometry: "Geometry",
    trigonometry: "Trigonometry",
    precalculus: "Precalculus",
    "probability-statistics": "Probability & statistics",
    "discrete-math": "Discrete mathematics",
    "differential-equations": "Differential equations",
  };
  Object.assign(topicNames, additions);
  topicList.push(...Object.keys(additions));

  const newLessons = [
    { id: "algebra-equations", topic: "algebra", title: "Keep an equation balanced", time: "8 min", text: "An equation stays true when you do the same operation to both sides. Undo addition and multiplication in reverse order to isolate the unknown.", formula: "ax + b = c", audio: "To solve an equation, keep both sides balanced. Undo addition first, then multiplication, until the variable is by itself." },
    { id: "geometry-area", topic: "geometry", title: "Area measures the inside", time: "7 min", text: "Area counts the square units inside a shape. For a rectangle, multiply its side lengths; for a triangle, take half the matching base and height product.", formula: "Arectangle = length × width", audio: "Area measures the surface inside a shape. A rectangle's area is its length times its width." },
    { id: "trig-ratios", topic: "trigonometry", title: "Three useful triangle ratios", time: "9 min", text: "Sine, cosine, and tangent compare pairs of side lengths in a right triangle. The angle tells you which sides count as opposite, adjacent, and hypotenuse.", formula: "sin θ = opposite / hypotenuse", audio: "Sine compares the opposite side with the hypotenuse. Cosine uses adjacent over hypotenuse, and tangent uses opposite over adjacent." },
    { id: "precalc-functions", topic: "precalculus", title: "Apply functions in order", time: "8 min", text: "A composite function feeds the output of one rule into another. Evaluate the inner rule first, then use that result as the next input.", formula: "(f ∘ g)(x) = f(g(x))", audio: "For a composite function, do the inner function first. Then feed its result into the outer function." },
    { id: "probability-basics", topic: "probability-statistics", title: "Probability as a fraction of outcomes", time: "8 min", text: "When outcomes are equally likely, probability is the number of favorable outcomes divided by the total number of outcomes.", formula: "P(event) = favorable / total", audio: "For equally likely outcomes, divide the number of favorable outcomes by the total number of outcomes." },
    { id: "discrete-counting", topic: "discrete-math", title: "Count choices without listing them", time: "9 min", text: "Combinations count groups when order does not matter. Choose r items from n by dividing the number of ordered selections by the r! possible orders.", formula: "C(n, r) = n! / (r!(n − r)!)", audio: "A combination counts a group where order does not matter. Divide the number of ordered choices by the number of ways to reorder the group." },
    { id: "differential-initial", topic: "differential-equations", title: "Use an initial condition", time: "10 min", text: "A differential equation describes a rate of change. An initial value chooses one particular solution from the family of possible curves.", formula: "dy/dx = k  ⇒  y = kx + C", audio: "A differential equation describes how a quantity changes. An initial condition tells us which curve in the family to use." },
  ];
  lessons.push(...newLessons);
  const learnCount = document.querySelector(".nav-count");
  if (learnCount) learnCount.textContent = String(lessons.length);

  const originalBuildQuestion = buildQuestion;
  function buildExpandedQuestion(topic, difficulty) {
    if (!Object.prototype.hasOwnProperty.call(additions, topic)) return originalBuildQuestion(topic, difficulty);
    const sequence = state.problemSequence++;
    seedQuestionRandom(topic + "|" + difficulty + "|" + sequence);
    const r = rand;
    let q;
    if (topic === "algebra") {
      if (difficulty === "easy") {
        const a = r(2, 9), x = r(2, 12), b = r(1, 15), c = a * x + b;
        q = { prompt: "Solve for x: " + a + "x + " + b + " = " + c + ".", answer: x, hint: "Undo the addition, then divide by " + a + ".", solution: "Subtract " + b + " from both sides: " + a + "x = " + (c - b) + ". Divide by " + a + ": x = " + x + "." };
      } else if (difficulty === "medium") {
        const a = r(1, 5), b = r(1, 8), x = r(1, 8);
        q = { prompt: "Evaluate " + a + "x² − " + b + "x + 3 when x = " + x + ".", answer: a * x * x - b * x + 3, hint: "Substitute " + x + " for each x, then follow order of operations.", solution: a + "(" + x + "²) − " + b + "(" + x + ") + 3 = " + (a * x * x - b * x + 3) + "." };
      } else {
        const a = r(1, 6), b = r(1, 7), root1 = r(-5, 3), root2 = root1 + r(1, 5);
        q = { prompt: "Solve x² − " + (root1 + root2) + "x + " + (root1 * root2) + " = 0. Enter both roots separated by a comma, smaller root first.", answer: [root1, root2], hint: "Find two numbers whose sum is " + (root1 + root2) + " and whose product is " + (root1 * root2) + ".", solution: "Factor the quadratic using roots " + root1 + " and " + root2 + ": (x − " + root1 + ")(x − " + root2 + ") = 0. The roots are " + root1 + " and " + root2 + "." };
      }
    } else if (topic === "geometry") {
      if (difficulty === "easy") {
        const length = r(3, 16), width = r(2, 12);
        q = { prompt: "A rectangle is " + length + " units long and " + width + " units wide. Find its area.", answer: length * width, hint: "Area = length × width.", solution: length + " × " + width + " = " + (length * width) + " square units." };
      } else if (difficulty === "medium") {
        const base = r(4, 18), height = r(3, 14);
        q = { prompt: "A triangle has base " + base + " and height " + height + ". Find its area.", answer: base * height / 2, hint: "A triangle has half the area of a rectangle with the same base and height.", solution: "A = (" + base + " × " + height + ") ÷ 2 = " + (base * height / 2) + " square units." };
      } else {
        const radius = r(2, 10), pi = 3.14, answer = Math.round(pi * radius * radius * 100) / 100;
        q = { prompt: "A circle has radius " + radius + ". Find its area using π ≈ 3.14; round to two decimals.", answer: answer, hint: "Use A = πr².", solution: "A ≈ 3.14 × " + radius + "² = " + answer + " square units." };
      }
    } else if (topic === "trigonometry") {
      if (difficulty === "easy") {
        const values = [{ angle: 30, fn: "sin", answer: 0.5 }, { angle: 60, fn: "cos", answer: 0.5 }, { angle: 45, fn: "sin", answer: 0.7071 }];
        const item = values[r(0, values.length - 1)];
        q = { prompt: "Evaluate " + item.fn + "(" + item.angle + "°). Enter a decimal to four places if needed.", answer: item.answer, hint: "Use the exact-value table for the special angle " + item.angle + "°.", solution: item.fn + "(" + item.angle + "°) ≈ " + item.answer + "." };
      } else if (difficulty === "medium") {
        const opposite = r(3, 9), hypotenuse = opposite + r(2, 8), value = Math.round(opposite / hypotenuse * 10000) / 10000;
        q = { prompt: "In a right triangle, the opposite side is " + opposite + " and the hypotenuse is " + hypotenuse + ". Find sin(θ), rounded to four decimals.", answer: value, hint: "Sine = opposite ÷ hypotenuse.", solution: opposite + " ÷ " + hypotenuse + " ≈ " + value + "." };
      } else {
        const angle = [30, 45, 60][r(0, 2)], double = angle * 2, result = double === 60 ? 0.866 : (double === 90 ? 1 : 0.866);
        q = { prompt: "Use the double-angle identity to evaluate 2 sin(" + angle + "°) cos(" + angle + "°). Round to three decimals.", answer: result, hint: "Use 2 sin(θ) cos(θ) = sin(2θ).", solution: "2 sin(" + angle + "°) cos(" + angle + "°) = sin(" + double + "°) ≈ " + result + "." };
      }
    } else if (topic === "precalculus") {
      if (difficulty === "easy") {
        const base = r(2, 5), power = r(2, 5);
        q = { prompt: "Evaluate " + base + "^" + power + ".", answer: Math.pow(base, power), hint: "Multiply " + base + " by itself " + power + " times.", solution: base + "^" + power + " = " + Math.pow(base, power) + "." };
      } else if (difficulty === "medium") {
        const x = r(1, 7), offset = r(1, 6), scale = r(2, 5);
        q = { prompt: "If f(x) = 2x + " + offset + " and g(x) = " + scale + "x, find f(g(" + x + ")).", answer: 2 * scale * x + offset, hint: "Find g(" + x + ") first, then substitute that value into f.", solution: "g(" + x + ") = " + (scale * x) + ". Then f(" + (scale * x) + ") = 2(" + (scale * x) + ") + " + offset + " = " + (2 * scale * x + offset) + "." };
      } else {
        const h = r(-4, 4), k = r(-5, 5), x = h + r(-3, 3), a = r(1, 4);
        q = { prompt: "For f(x) = " + a + "(x − " + h + ")² + " + k + ", find f(" + x + ").", answer: a * (x - h) * (x - h) + k, hint: "Substitute x = " + x + " first, then square the difference.", solution: a + "(" + x + " − " + h + ")² + " + k + " = " + (a * (x - h) * (x - h) + k) + "." };
      }
    } else if (topic === "probability-statistics") {
      if (difficulty === "easy") {
        const favorable = r(1, 5), total = favorable + r(2, 10), answer = Math.round(favorable / total * 10000) / 10000;
        q = { prompt: "There are " + favorable + " favorable outcomes out of " + total + " equally likely outcomes. Find the probability as a decimal to four places.", answer: answer, hint: "Divide the favorable outcomes by the total outcomes.", solution: favorable + " ÷ " + total + " ≈ " + answer + "." };
      } else if (difficulty === "medium") {
        const values = Array.from({ length: 4 }, () => r(2, 18)), answer = values.reduce((sum, value) => sum + value, 0) / values.length;
        q = { prompt: "Find the mean of " + values.join(", ") + ".", answer: answer, hint: "Add the values and divide by how many values there are.", solution: "(" + values.join(" + ") + ") ÷ 4 = " + answer + "." };
      } else {
        const p1 = r(2, 8) / 10, p2 = r(2, 8) / 10, answer = Math.round((p1 + p2 - p1 * p2) * 10000) / 10000;
        q = { prompt: "Two independent events have probabilities " + p1 + " and " + p2 + ". Find the probability that at least one occurs.", answer: answer, hint: "Use P(A ∪ B) = P(A) + P(B) − P(A)P(B).", solution: p1 + " + " + p2 + " − (" + p1 + " × " + p2 + ") = " + answer + "." };
      }
    } else if (topic === "discrete-math") {
      if (difficulty === "easy") {
        const n = r(3, 7), answer = [1, 2, 6, 24, 120, 720, 5040, 40320][n];
        q = { prompt: "How many ways can " + n + " distinct books be arranged in a row?", answer: answer, hint: "There are " + n + " choices for the first position, then one fewer each time.", solution: n + "! = " + answer + " arrangements." };
      } else if (difficulty === "medium") {
        const n = r(5, 10), k = r(2, Math.min(4, n - 1));
        let answer = 1;
        for (let index = 1; index <= k; index += 1) answer = answer * (n - index + 1) / index;
        answer = Math.round(answer);
        q = { prompt: "How many groups of " + k + " can be chosen from " + n + " people?", answer: answer, hint: "Order does not matter, so use C(" + n + ", " + k + ").", solution: "C(" + n + ", " + k + ") = " + answer + " groups." };
      } else {
        const n = r(4, 9), answer = Math.pow(2, n);
        q = { prompt: "A set has " + n + " elements. How many subsets does it have, including the empty set?", answer: answer, hint: "Each element is either included or not included.", solution: "There are 2 choices for each of " + n + " elements: 2^" + n + " = " + answer + " subsets." };
      }
    } else if (topic === "differential-equations") {
      if (difficulty === "easy") {
        const slope = r(2, 8), start = r(-5, 8), time = r(2, 7), answer = start + slope * time;
        q = { prompt: "Solve y′ = " + slope + " with y(0) = " + start + ". Find y(" + time + ").", answer: answer, hint: "Integrate the constant rate: y = " + slope + "x + C. Use the initial value to find C.", solution: "y(x) = " + slope + "x + " + start + ". Therefore y(" + time + ") = " + answer + "." };
      } else if (difficulty === "medium") {
        const coefficient = r(1, 6), time = r(2, 6), start = r(1, 8), answer = start + coefficient * time * time / 2;
        q = { prompt: "Solve y′ = " + coefficient + "x with y(0) = " + start + ". Find y(" + time + ").", answer: answer, hint: "Integrate " + coefficient + "x to get (" + coefficient + "/2)x² + C, then use y(0).", solution: "y(x) = " + coefficient + "x²/2 + " + start + ". Thus y(" + time + ") = " + answer + "." };
      } else {
        const rate = r(1, 4), start = r(2, 6), time = r(1, 3), answer = Math.round(start * Math.exp(rate * time) * 100) / 100;
        q = { prompt: "Solve y′ = " + rate + "y with y(0) = " + start + ". Using e ≈ 2.718, estimate y(" + time + ") to two decimals.", answer: answer, hint: "This exponential growth equation has solution y = " + start + "e^(" + rate + "x).", solution: "y(" + time + ") = " + start + "e^(" + (rate * time) + ") ≈ " + answer + "." };
      }
    }
    return Object.assign({}, q, { topic: topic, difficulty: difficulty, id: topic + "-" + difficulty + "-" + sequence });
  }
  buildQuestion = buildExpandedQuestion;
  window.FudiQuestionCatalog = { topics: topicNames, difficultyNames: difficultyNames, build: buildExpandedQuestion };
})();
