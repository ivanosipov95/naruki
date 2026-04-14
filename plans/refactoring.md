# Оценка проекта naruki.online: поддержка и развитие

## Текущее состояние

| Метрика | Значение |
|---------|----------|
| app.js | 639 строк |
| raise.js | 917 строк |
| styles.css | 2036 строк (34 KB) |
| Дублирование JS | ~50-60% между app.js и raise.js |
| Тесты | 0 |
| Линтинг | нет |
| Сборка | нет (чистый HTML/CSS/JS) |

---

## 1. Нужен ли фреймворк?

**Нет.** Проект — два калькулятора с формами и таблицами. Фреймворк (React/Vue/Svelte) решает проблемы, которых здесь нет:
- Сложное состояние с вложенными компонентами — нет, состояние плоское
- Реактивный UI с частичным обновлением — нет, рендер идёт целиком по кнопке
- Роутинг, авторизация, API — нет
- Команда из нескольких разработчиков — нет

Фреймворк добавит: сборщик, node_modules, SSR/гидрацию, зависимости для обновления, время сборки. Текущий стек (0 зависимостей, мгновенный деплой) — преимущество, а не проблема.

**Единственное исключение:** если планируется 5+ страниц с общими компонентами и SPA-навигацией — тогда стоит рассмотреть Astro (статика + островки интерактивности). Но для 2 калькуляторов это overkill.

---

## 2. Что реально нужно улучшить

### 2.1 Вынести общий код (критично)

Между app.js и raise.js дублируется 12+ идентичных функций:

```
calculateTaxForIncome()    — расчёт налога по шкале
getBonusForMonth()         — бонус за месяц
createPaymentRow()         — DOM-фабрика строки выплаты
getOneTimePayments()       — чтение выплат из DOM
formatGrossInput()         — форматирование числа
parseGrossInput()          — парсинг числа
normalizeGrossInput()      — очистка ввода
countDigitsBefore()        — позиция каретки
caretFromDigits()          — восстановление каретки
clampNumber()              — валидация
setDirtyState()            — dirty-флаг
setCalculatingState()      — состояние кнопки
trackGoal()                — аналитика
setupCalcSwitchMenu()      — меню навигации
monthNames[]               — массив месяцев
brackets[]                 — налоговые ставки
```

**Решение:** создать `shared.js` с ES-модулями:

```
src/
  shared.js          — tax, format, caret, DOM-утилиты, константы
  app.js             — только логика index.html (~250 строк)
  raise.js           — только логика raise.html (~400 строк)
  nav.js             — setupCalcSwitchMenu, setupCalcSwitchTransition
  theme.js           — без изменений
  analytics.js       — без изменений
```

Подключение через `<script type="module">` — работает во всех браузерах, не нужен сборщик.

**Выигрыш:**
- app.js: 639 → ~250 строк
- raise.js: 917 → ~400 строк
- Баг-фикс в налоговой формуле — одно место вместо двух
- Можно добавлять новые калькуляторы без копирования

### 2.2 Вынести чистую логику для тестирования (важно)

Сейчас расчётная логика смешана с DOM. Нужно разделить:

**Чистые функции (тестируемые без DOM):**
```js
// tax.js
export const brackets = [...];
export function calculateTaxForIncome(income) { ... }
export function calculateMonthlyNet(gross, startMonth, monthlyBonus, oneTimePayments) { ... }
export function getBonusForMonth(month, monthlyBonus, oneTimePayments) { ... }
export function getAfterBonuses({ ... }) { ... }
```

**Тесты (Vitest, без DOM):**
```js
// tax.test.js
import { calculateTaxForIncome, calculateMonthlyNet } from './tax.js';

test('13% для дохода до 2.4М', () => {
  expect(calculateTaxForIncome(200_000)).toBe(26_000);
});

test('прогрессия: 2.4М по 13% + остаток по 15%', () => {
  expect(calculateTaxForIncome(2_500_000)).toBe(2_400_000 * 0.13 + 100_000 * 0.15);
});

test('бонус добавляется к доходу месяца', () => {
  const months = calculateMonthlyNet(100_000, 1, 10_000, []);
  expect(months[0].bonus).toBe(10_000);
  expect(months[0].gross).toBe(100_000);
});
```

**Минимальный набор тестов (покрывает 90% рисков):**
- Налог по каждой ступени шкалы (5 тестов)
- Переход между ступенями внутри года (2 теста)
- Бонусы: ежемесячные + разовые (3 теста)
- Режимы после повышения: same/proportional/custom (3 теста)
- Граничные случаи: нулевой доход, старт с декабря (2 теста)

**Инструмент:** Vitest — нулевая конфигурация, работает с ES-модулями, не тянет за собой фреймворк.

### 2.3 CSS: разделить по смыслу (желательно)

2036 строк в одном файле — на грани управляемости. Разбить:

```
src/styles/
  base.css           — reset, typography, variables, themes
  components.css     — card, field, button, ghost, segmented
  layout.css         — hero, summary, details, footer
  pages.css          — page-specific overrides (raise, index)
  skeleton.css       — loading states
```

Подключить через `@import` в `styles.css` или отдельными `<link>` (HTTP/2 мультиплексирует). Без сборщика, без PostCSS.

### 2.4 Минимальный DX-набор (желательно)

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "lint": "eslint src/*.js",
    "format": "prettier --write src/"
  },
  "devDependencies": {
    "vitest": "^3.x",
    "eslint": "^9.x",
    "prettier": "^3.x"
  }
}
```

Это не превращает проект в Node-приложение — это только dev-инструменты. Продакшн по-прежнему чистый HTML/CSS/JS без сборки.

---

## 3. Чего НЕ нужно делать

| Не делать | Почему |
|-----------|--------|
| React/Vue/Svelte | Нет проблемы, которую они решают |
| TypeScript | Для 2 файлов по 300-400 строк — overhead больше пользы |
| Webpack/Vite для бандлинга | ES-модули работают нативно |
| CSS-in-JS / Tailwind | Текущий CSS чистый и читаемый |
| SSR / Next.js / Nuxt | Статический сайт, серверная логика не нужна |
| Монорепо / nx / turborepo | Один проект, один разработчик |

---

## 4. Рекомендуемый порядок действий

### Шаг 1: Модули + дедупликация (2-3 часа)
- Создать `shared.js` с общими функциями
- Переписать app.js и raise.js на `import` из shared.js
- Поменять `<script>` на `<script type="module">`
- Проверить: оба калькулятора работают как раньше

### Шаг 2: Выделить tax.js с чистой логикой (1 час)
- Вынести `brackets`, `calculateTaxForIncome`, `calculateMonthlyNet`, `getBonusForMonth`, `getAfterBonuses`
- Эти функции не должны трогать DOM

### Шаг 3: Добавить тесты (1-2 часа)
- `npm init -y && npm i -D vitest`
- Написать 15-20 тестов на tax.js
- Добавить `npm test` в CI (GitHub Actions)

### Шаг 4: Линтинг и форматирование (30 мин)
- ESLint + Prettier
- Один прогон для фиксации текущего стиля

### Шаг 5 (опционально): Разбить CSS
- Только если CSS продолжит расти

---

## Итого

Проект в хорошем состоянии для своего масштаба. Главная проблема — дублирование кода между двумя калькуляторами. ES-модули + выделение чистой логики решают и проблему поддержки, и проблему тестирования — без фреймворков и сборщиков.
