import type { CodeLanguage, Difficulty } from '@/engine/types'

export interface CodeSnippet {
  id: string
  language: CodeLanguage
  title: string
  difficulty: Difficulty
  code: string
}

const s = (id: string, language: CodeLanguage, title: string, difficulty: Difficulty, code: string): CodeSnippet => ({
  id,
  language,
  title,
  difficulty,
  code: code.replace(/^\n/, '').replace(/\s+$/, ''),
})

export const CODE_SNIPPETS: CodeSnippet[] = [
  s('js-debounce', 'javascript', 'Debounce helper', 'medium', `
function debounce(fn, wait = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}`),
  s('js-fetch', 'javascript', 'Fetch with retry', 'hard', `
async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
  }
  throw new Error(\`Failed after \${retries} tries\`);
}`),
  s('js-group', 'javascript', 'Group by key', 'medium', `
const groupBy = (items, key) =>
  items.reduce((acc, item) => {
    (acc[item[key]] ||= []).push(item);
    return acc;
  }, {});`),
  s('js-sum', 'javascript', 'Sum of squares', 'easy', `
const nums = [1, 2, 3, 4, 5];
const total = nums
  .map((n) => n * n)
  .filter((n) => n % 2 === 1)
  .reduce((a, b) => a + b, 0);
console.log(total);`),
  s('js-class', 'javascript', 'Event emitter', 'expert', `
class Emitter {
  #handlers = new Map();
  on(event, cb) {
    const list = this.#handlers.get(event) ?? [];
    this.#handlers.set(event, [...list, cb]);
    return () => this.off(event, cb);
  }
  emit(event, ...args) {
    this.#handlers.get(event)?.forEach((cb) => cb(...args));
  }
}`),
  s('py-fib', 'python', 'Memoized Fibonacci', 'easy', `
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n: int) -> int:
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)`),
  s('py-count', 'python', 'Word frequency', 'medium', `
from collections import Counter

def top_words(text, k=5):
    words = [w.strip(".,!?").lower() for w in text.split()]
    counts = Counter(w for w in words if w)
    return counts.most_common(k)`),
  s('py-class', 'python', 'Bank account', 'medium', `
class Account:
    def __init__(self, owner, balance=0.0):
        self.owner = owner
        self.balance = balance

    def withdraw(self, amount):
        if amount > self.balance:
            raise ValueError("insufficient funds")
        self.balance -= amount
        return self.balance`),
  s('py-bsearch', 'python', 'Binary search', 'hard', `
def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1`),
  s('py-dict', 'python', 'Dict comprehension', 'expert', `
scores = {"ana": [91, 78], "bo": [65, 88, 70]}
averages = {
    name: round(sum(vals) / len(vals), 1)
    for name, vals in scores.items()
    if vals
}
best = max(averages, key=averages.get)
print(f"{best}: {averages[best]:.1f}")`),
  s('java-hello', 'java', 'Hello, loop', 'easy', `
public class Main {
    public static void main(String[] args) {
        for (int i = 1; i <= 3; i++) {
            System.out.println("Hello #" + i);
        }
    }
}`),
  s('java-stack', 'java', 'Generic stack', 'hard', `
public class Stack<T> {
    private final List<T> items = new ArrayList<>();

    public void push(T item) {
        items.add(item);
    }

    public T pop() {
        if (items.isEmpty()) throw new IllegalStateException("empty");
        return items.remove(items.size() - 1);
    }
}`),
  s('java-stream', 'java', 'Stream filter', 'medium', `
List<String> names = users.stream()
    .filter(u -> u.getAge() >= 18)
    .map(User::getName)
    .sorted()
    .collect(Collectors.toList());`),
  s('java-record', 'java', 'Record with validation', 'expert', `
public record Point(int x, int y) {
    public Point {
        if (x < 0 || y < 0) {
            throw new IllegalArgumentException("negative");
        }
    }

    public double distanceTo(Point o) {
        return Math.hypot(x - o.x(), y - o.y());
    }
}`),
  s('java-map', 'java', 'Count with map', 'medium', `
Map<Character, Integer> counts = new HashMap<>();
for (char c : text.toCharArray()) {
    counts.merge(c, 1, Integer::sum);
}`),
  s('sql-select', 'sql', 'Active users', 'easy', `
SELECT id, name, email
FROM users
WHERE active = TRUE
ORDER BY created_at DESC
LIMIT 10;`),
  s('sql-join', 'sql', 'Orders per customer', 'medium', `
SELECT c.name, COUNT(o.id) AS orders, SUM(o.total) AS revenue
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.name
HAVING COUNT(o.id) > 0;`),
  s('sql-cte', 'sql', 'Monthly totals CTE', 'hard', `
WITH monthly AS (
  SELECT DATE_TRUNC('month', paid_at) AS month, SUM(amount) AS total
  FROM payments
  GROUP BY 1
)
SELECT month, total,
  total - LAG(total) OVER (ORDER BY month) AS change
FROM monthly;`),
  s('sql-create', 'sql', 'Create table', 'medium', `
CREATE TABLE scores (
  id SERIAL PRIMARY KEY,
  player_id INT NOT NULL REFERENCES players(id),
  wpm NUMERIC(5, 1) CHECK (wpm >= 0),
  recorded_at TIMESTAMP DEFAULT NOW()
);`),
  s('sql-window', 'sql', 'Rank per group', 'expert', `
SELECT *
FROM (
  SELECT player_id, wpm,
    ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY wpm DESC) AS rn
  FROM scores
) ranked
WHERE rn <= 3;`),
]

export const CODE_LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  java: 'Java',
  sql: 'SQL',
}
