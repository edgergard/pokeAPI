---
project: trainer-studio
stack: nextjs
theme: dark
ui-language: en
screens: 11
status: approved
rounds: 1
date: "2026-11-22"
---

# Trainer Studio — design

## Направление (Direction)
- **Настроение:** dark, holo, arcade. Развиваем нынешний стиль, а не заменяем: глубокий чёрно-синий фон, жёлтый акцент, стеклянные панели, фольгированные 3D-карты с наклоном. Поверх него добавляется игровой слой: цвета редкостей, полосы опыта, ритуал открытия капсул. Ориентир — Marvel Snap: чистое меню коллекции и сочные карты. Запоминающийся элемент: голографическая карта, которая в бою становится 3D-бойцом, а в капсуле переворачивается со вспышкой цвета редкости.
- **Шрифты:** свои, уже подключены через `next/font` в `app/layout.tsx`: Inter (`--font-sans`), Bricolage Grotesque (`--font-display`, заголовки), JetBrains Mono (`--font-mono`, цифры и eyebrow-подписи). Geist из шаблона не используем: эти шрифты и есть бренд.
- **Изображения и иконки:** официальные арты и спрайты PokeAPI только через адаптер `getCreatureArt(id)`. При ошибке загрузки показывается силуэт в цвете типа с кнопкой повтора. Иконки — lucide-react. Капсула — собственный визуал (не Poke Ball). Цвета 18 типов — существующие `--type`.
- **Тон текстов:** нейтральный, коротко и по делу. Пример: "Stage 4 cleared · +1 Capsule".
- **Prototype:** variant A chosen (see prototype.md)
- **Вне дизайна:** Later из idea.md: режим забега с магазином, синергии типов, призраки, недельные задания, достижения, лента уровня коллекции (S08 показывает только счётчик), Wonder Pick, офлайн-сундук, шайни. Золота как валюты нет.

## Навигация (Navigation)
~~~text
nav (sticky glass, desktop): Logo→/ | /ladder | /collection | /capsules [badge: unopened] | /trainer [dot: unspent points]
  right: Lv pill + XP bar · CTA "Fight · Stage N" → /battle/?stage=N · Motion toggle · gear → /settings
375px: top row = logo · Lv pill · Fight · gear; bottom tab bar (5 × 44px): Home, Ladder, Collection, Capsules, Trainer
onboarding (S01 до onboardingStep=done): только Logo + Motion; deep links → /
dialogs: S05 capsule-reveal (from S01/S03/S04), S09 team (from S01/S03/S07/S10), S10 level-up (from S03)
footer (S01, S11): "Unofficial fan project, not affiliated with Nintendo, Game Freak or The Pokémon Company · Data: PokéAPI"
~~~
**Аккаунты и пейволл:** нет: `accounts: none`, `monetization: free`. Онбординг — мягкий порог: остальная навигация появляется после первого покемона.
**Маршруты шаблона:** это существующий проект, не шаблон. Маршруты лежат в корневом `app/`, а не в `src/app/` (FSD в `src/`). Оставляем `app/not-found.tsx`. `app/page.tsx` и `app/battle/page.tsx` переделываются, остальные создаются. `app/layout.tsx` получает AppNav, `<main>`, skip-link и `aria-current`.
**Query-параметры при статическом экспорте:** `?stage` и `?id` читаются через `useSearchParams` только в компоненте, который рендерится после `useHydrated()` (как сейчас `SetupWithQuery` в `src/views/battle/BattlePage.tsx`). **Не** через обёртку `<Suspense>`: на миграции она ломала гидрацию в `next dev`.

## Маршруты (Routes)
| screen-id | Route file | Type | Tab label / icon | Must feature | Auth required |
|---|---|---|---|---|---|
| home | app/page.tsx | page | Home / lucide `house` | #1 Onboarding, #5 Trainer, #6 Dailies | no |
| ladder | app/ladder/page.tsx | page | Ladder / `milestone` | #6 PvE battles | no |
| battle | app/battle/page.tsx (`?stage=N` / `?stage=intro`) | page | — (nav CTA) | #1, #6, #7 | no |
| capsules | app/capsules/page.tsx | page | Capsules / `package-open` | #3 Capsules | no |
| capsule-reveal | — (widget dialog) | dialog | — | #1, #3 | no |
| collection | app/collection/page.tsx | page | Collection / `layout-grid` | #4 Collection | no |
| creature | app/creature/page.tsx (`?id=25`) | page | — | #4, #7, #3 craft | no |
| trainer | app/trainer/page.tsx | page | Trainer / `user-round` | #5 Trainer | no |
| team | — (widget dialog) | dialog | — | #5, #6 | no |
| level-up | — (widget dialog) | dialog | — | #5 | no |
| settings | app/settings/page.tsx | page | gear / `settings` | #2 Save | no |

## Флоу (Flows)
### first-visit — Первый визит → первый покемон (цель < 2:00)
1. home (hero): одна кнопка "Fill my team with random Pokémon" → карта раздаётся лицом вверх с меткой *Loaner*, выезжает карта соперника с "VS"; чанк арены начинает предзагружаться.
2. home (dealt): "Fight" → battle `?stage=intro`.
3. battle: заскриптованный бой 1×1 примерно на 25 с, игрок всегда побеждает. ×2 доступно сразу, Skip через 5 с.
4. battle (result): "Victory", заполняется полоса опыта тренера, "+1 Capsule" → "Open capsule".
5. capsule-reveal: тряска → вспышка цвета редкости → переворот: "New! <name> joined your collection." Первая капсула гарантирует Uncommon или выше. "Add to team" → одолженный покемон уходит.
6. home (hub): появляется навигация, CTA "Fight" один раз пульсирует, карточка показывает "Stage 1 is ready".

**Первая ценность:** шаг 5, около 1:20. · **Где могут уйти:**
- **Перезагрузка:** `onboardingStep: dealt|fought|capsule|done` сохраняется после каждого шага, и игрок продолжает с того же места ("Open your capsule").
- **Повторная крутка при перезагрузке:** её нет. Крутка сидируется `hash(saveSeed, pullIndex)` и записывается до анимации.
- **Нет WebGL:** тот же сценарий в текстовом бою.
- **Хранилище заблокировано:** флоу проходит до конца, показывается баннер.
- **Игрок v1:** найден старый localStorage-ростер. Шаг миграции 0 импортирует его покемонов (Lv 1) и ставит `done`. Экран: "Your v1 trainers were imported: N Pokémon added." → "Open welcome capsule".

### loop — Бой → награда → рост
1. home или CTA навигации "Fight · Stage 7" → превью в battle: твои N карт против соперника (Lv, ★, иконки талантов). Фокус на "Fight", Enter запускает бой.
2. Арена: ×2, Skip to result (бой просимулирован заранее). Если закрыть вкладку посреди боя, бой не засчитывается.
3. Результат: награды записываются при входе в экран, потом анимируются: опыт каждого покемона, доля скамейки, "+1 talent point", отметки заданий (засчитываются автоматически), капсулы, пыль. Primary "Next stage" сразу ведёт к превью следующего этапа: от боя до боя 2 клика.
4. Поражение: "Retry" и одна подсказка ("Bulbasaur is Lv 12 on the bench → Put in team", или "Spend 1 talent point" → creature), плюс Edit team.
5. Новый уровень тренера → level-up "Trainer Lv 3 · Team slot 2 unlocked" → "Fill slot 2" → team, новый слот пульсирует → Save.

**Первая ценность:** "Next stage" после каждой победы. · **Где могут уйти:** между сессиями ничего не сгорает: неоткрытые капсулы видны бейджем, очки талантов копятся, задания копятся до 3 дней.

### save-transfer — Перенос прогресса в другой браузер
1. settings: "Export save" → скачивается `trainer-studio-<YYYY-MM-DD>.txt`, "Exported just now".
2. Другой браузер → settings → "Import save" → выбор файла → проверка версии схемы и контрольной суммы.
3. Подтверждение "Replace current progress? Your current save moves to the backup slot." → "Replace".
4. Тост "Save imported", home перезагружается с импортированным тренером.

**Первая ценность:** шаг 4. · **Где могут уйти:**
- Битый файл или файл из новой версии: понятная ошибка, ничего не меняется.
- Старая версия: файл мигрирует, сообщение "Upgraded from v1".
- "Restore backup" откатывает один импорт.
- На хабе баннер "Back up your progress" после 7 дней или 10 боёв без экспорта.

## Экраны (Screens)
Все числа на экранах (пороги уровней, шансы, pity, цены в пыли, опыт) берутся из `economy.ts`. Пример трека для иллюстрации: Lv 1 команда 1 · Lv 2 дневные задания · Lv 3 слот 2 · Lv 5 слот 3 · Lv 8 Great-капсулы · Lv 10 слот 4.

### home — Home
- **Назначение:** старт без трения, потом ежедневная стартовая точка (Must #1, #5, #6).
- **Элементы:**
  - *онбординг:* состояния hero / dealt / pending capsule / welcome back (флоу first-visit).
  - *хаб, сверху вниз:*
    - баннеры (storage blocked / persist denied / backup due);
    - полоса тренера: имя, Lv, опыт, "Next: Lv 5 · team slot 3";
    - карточка следующего этапа: имя соперника, его мини-спрайты, награда за первое прохождение;
    - полоса команды из 1–4 holo-карт: точки непотраченных очков талантов, закрытые слоты "Unlocks at Trainer Lv 5";
    - 3 дневных задания x/y;
    - лоток капсул: число и pity;
    - плитка "23 / 1025 caught".
- **Главное действие:** "Fill my team with random Pokémon" (онбординг) / "Fight" (хаб) · **Второстепенные:** Edit team (team), Open capsules, строка задания → ladder.
- **Состояния:**
  - content: хаб;
  - empty: на хабе невозможно, после онбординга всегда есть хотя бы один покемон;
  - loading: скелетон гидрации, hero виден сразу;
  - error (сохранение не читается): "Restore backup" / "Import file" / "Start fresh" с подтверждением;
  - задания закрыты: "Daily quests unlock at Trainer Lv 2";
  - задания разобраны: "New quests in 5 h";
  - часы перевели назад: "Quests refill at 06:00", без ошибки.
- **Тексты** (en): title "Trainer Studio", empty "No quests right now. New quests in 5 h", button "Fill my team with random Pokémon" / "Fight".
- **Доступность:** после выдачи карт и после боя live-регион объявляет "Loaner Pikachu joined your team" и "Victory. 1 capsule earned". Фокус переходит на следующую главную кнопку.

### ladder — Ladder
- **Назначение:** выбрать этап и посмотреть на соперника (Must #6).
- **Элементы:** "Stage 7 / 25 cleared"; вертикальный путь узлов (✓ пройден, светится текущий, тусклые закрыты); панель выбранного узла: команда соперника (спрайты, Lv, ★), рекомендуемая сила против твоей, награды за первое прохождение.
- **Главное действие:** "Fight" · **Второстепенные:** Edit team, выбор любого пройденного узла (переигровка ради опыта).
- **Состояния:**
  - content: путь и панель;
  - empty: невозможно, первый этап всегда открыт;
  - loading: скелетон;
  - error: "Couldn't load stages. Reload" (данные запечены, так что только на случай битой сборки);
  - узел закрыт: "Clear stage 6 first";
  - всё пройдено: "Ladder complete. Replay any stage for XP and capsules.";
  - в команде есть пустые открытые слоты: primary меняется на "Fill team".
- **Тексты** (en): title "Ladder", empty —, button "Fight".
- **Доступность:** путь — это список кнопок с `aria-current="step"` на текущем этапе и `aria-disabled` на закрытых. Стрелки переключают узлы.

### battle — Battle
- **Назначение:** один маршрут, три фазы: превью → арена → результат (Must #1, #6, #7).
- **Элементы:**
  - "Back to ladder", название этапа;
  - полоса составов N×N (1–4) с Lv, ★ и иконками талантов (Must #7), те же бейджи на HUD-картах;
  - 3D-арена;
  - ×2, Skip, Replay (тот же сид), сворачиваемый лог;
  - оверлей результата: исход, полосы опыта, добыча, отметки заданий, строки с очками талантов, подсказка при поражении.
- **Главное действие:** "Fight" → (арена) → "Next stage" (победа) / "Retry" (поражение) / "Open capsule" (intro) · **Второстепенные:** ×2, Skip, Replay, Edit team, Open capsules (n), Ladder.
- **Состояния:**
  - content: фазы;
  - empty: невозможно;
  - loading: "Preparing arena";
  - error: 5 существующих уведомлений + Retry, ErrorBoundary, потеря GPU-контекста;
  - без WebGL: текстовый бой;
  - закрытый или неверный `?stage`: редирект на ladder с тостом "Stage locked".
- **Тексты** (en): title "Stage 7 · Rival Juniper Vale", empty —, button "Fight"; результат "Victory · First-clear bonus" / "Defeated. Try a stronger lineup."
- **Доступность:** существующие live-регион и лог боя остаются. Результат объявляется одной фразой, фокус переходит на главную кнопку. Skip — настоящая кнопка с подписью.

### capsules — Capsules
- **Назначение:** открыть капсулы, увидеть честные шансы, потратить пыль (Must #3).
- **Элементы:**
  - стопки по тирам с числом;
  - закрытый тир: "Great capsules unlock at Trainer Lv 8";
  - таблица шансов по тирам, видна всегда;
  - pity-шкала по тирам: "Epic guaranteed within 18 opens";
  - баланс пыли;
  - "Buy a specific Pokémon": PokemonSearch только по неполученным, цена зависит от редкости.
- **Главное действие:** "Open" ("Open all" при 2 и больше) · **Второстепенные:** Open 1, Craft with dust.
- **Состояния:**
  - content: стопки;
  - empty: "No capsules. Win battles and finish daily quests to earn them." + Fight;
  - loading: скелетон;
  - error: "Couldn't open. Try again" (результат сидирован, повторится тот же);
  - не хватает пыли: кнопка неактивна, "Need 40 more dust".
- **Тексты** (en): title "Capsules", empty "No capsules. Win battles and finish daily quests to earn them.", button "Open".
- **Доступность:** таблица шансов — настоящая `<table>` с заголовками. Pity-шкала — `role="progressbar"` с текстовым значением.

### capsule-reveal — Capsule reveal (dialog)
- **Назначение:** ритуал открытия (Must #1, #3).
- **Элементы:** тряска → вспышка цвета редкости → переворот, редчайшая карта последней → итоговая сетка с метками New / ★ up / +20 dust; внизу pity тикает или сбрасывается ("Pity reset · Epic within 40").
- **Главное действие:** "Add to team" (самый первый покемон) / "View new" / "Done" · **Второстепенные:** Skip (Esc), Open next.
- **Состояния:**
  - content: раскрытие и итог;
  - empty: нет, диалог открывается только с капсулой;
  - loading: нет, результат уже записан;
  - error: нет, результаты бросаются и сохраняются до анимации;
  - reduced motion: кроссфейд и мгновенный переворот.
- **Тексты** (en): title "Capsule", "New! Pikachu joined your collection.", button "Done".
- **Доступность:** нативный `<dialog>` (shared/ui Dialog). Каждое раскрытие объявляется ("Rare: Eevee, new"). Esc пропускает анимацию, но не результат.

### collection — Collection
- **Назначение:** покедекс (Must #4).
- **Элементы:**
  - "Collection 23 / 1025" с полосой;
  - фильтры: owned/missing, тип, редкость, поколение;
  - сортировка: уровень, редкость, номер;
  - поиск (PokemonSearch в режиме фильтра);
  - сетка: полученный — holo mini-card (Lv, ★, точка очка таланта); неполученный — силуэт с "Craft · 120 dust".
- **Главное действие:** открыть карту → creature · **Второстепенные:** фильтры, чип пыли.
- **Состояния:**
  - content: сетка;
  - empty filter: "No Pokémon match these filters" + Clear filters;
  - loading: shimmer (данные запечены);
  - error спрайта: силуэт в цвете типа, клик повторяет загрузку (так везде, где есть спрайты).
- **Тексты** (en): title "Collection", empty "No Pokémon match these filters", button "Clear filters".
- **Доступность:** сетка — список ссылок с подписью "Pikachu, level 12, 2 stars" или "Missing: Mewtwo". Фильтры — нативные элементы управления.

### creature — Creature
- **Назначение:** сделать одного покемона сильнее (Must #4, #7, крафт из #3). На десктопе отдельная страница, на 375px полноэкранная.
- **Элементы:**
  - большая holo-карта с наклоном и типами;
  - Lv x/cap, полоса опыта, ★★☆☆☆ "2 more duplicates to ★3";
  - статы base → current (формула, вклад талантов);
  - TalentTree: 3 ветки × 4 узла, "2 points available", бесплатный Reset;
  - движения;
  - prev/next.
- **Главное действие:** "Add to team" / "In team ✓" · **Второстепенные:** назначить талант, Reset talents, prev/next.
- **Состояния:**
  - content: полученный покемон;
  - неполученный: силуэт, шансы по редкости, "Craft for 120 dust" или неактивная "Need 40 more dust";
  - loading: скелетон;
  - error (неверный id): "No Pokémon #<id>" + ссылка на Collection;
  - таланты закрыты: "First talent point at Lv 5";
  - упор в потолок: "Level cap 20. Earn ★3 to raise it."
- **Тексты** (en): title "<Name>", empty "No Pokémon #<id>", button "Add to team".
- **Доступность:** узлы талантов — кнопки с состоянием (`aria-pressed`, `aria-disabled` с причиной). Изменение статов объявляется ("Attack 54 → 60").

### trainer — Trainer
- **Назначение:** уровень аккаунта и таланты, которые меняют правила (Must #5).
- **Элементы:** имя (переименование на месте, по умолчанию случайное), Lv, полоса опыта; таймлайн открытий из `economy.ts`; TalentTree тренера (~15 узлов, линии зависимостей; locked / available / owned).
- **Главное действие:** "Learn talent" · **Второстепенные:** rename, Reset tree (с подтверждением).
- **Состояния:**
  - content: дерево;
  - empty: невозможно;
  - loading: скелетон;
  - error: общий error boundary;
  - узел закрыт: "Requires Trainer Lv 6";
  - нет очков: "Next point at Lv 9".
- **Тексты** (en): title "Trainer", empty —, button "Learn talent".
- **Доступность:** дерево — список групп; связи дублируются текстом ("Requires: Quick Draw"). Переименование — подписанное поле, Enter сохраняет, Esc отменяет.

### team — Team (dialog)
- **Назначение:** выбрать, кто дерётся; N = 1–4 по уровню тренера (Must #5, #6).
- **Элементы:** "2 / 3"; слоты через TeamShowcase (drag, click-swap, Alt+arrows), закрытые слоты показывают нужный уровень; сила команды; список полученных покемонов с поиском, сортировкой и фильтром по типу.
- **Главное действие:** "Save team" · **Второстепенные:** Auto-fill strongest, Remove from slot.
- **Состояния:**
  - content: слоты и список;
  - пустой слот: "Tap a Pokémon below";
  - только 1 полученный: "Open capsules to grow your roster";
  - loading: нет (данные локальные);
  - error записи: "Couldn't save the team. Try again", выбор при этом сохраняется;
  - новый открытый слот пульсирует.
- **Тексты** (en): title "Team", empty "Tap a Pokémon below", button "Save team".
- **Доступность:** нынешние Alt+arrows и live-объявления перестановок. Закрытый слот: "Slot 3, unlocks at Trainer level 5".

### level-up — Trainer level-up (dialog)
- **Назначение:** превратить новый уровень в действие (Must #5).
- **Элементы:** "Trainer Lv 3" и LockInBurst; список открытий ("Team slot 2 · Daily quests · 1 talent point").
- **Главное действие:** контекстное: "Fill slot 2" / "See quests" / "Learn talent" · **Второстепенные:** "Later".
- **Состояния:**
  - content: список;
  - empty: уровень без открытий показывает "+1 talent point";
  - loading и error: нет (данные уже записаны).
- **Тексты** (en): title "Trainer Lv 3", empty "+1 talent point", button "Fill slot 2".
- **Доступность:** при открытии фокус на главной кнопке, заголовок связан через `aria-labelledby`.

### settings — Settings & Save
- **Назначение:** сохранение под контролем игрока (Must #2), плюс Motion и информация об IP.
- **Элементы:**
  - статус хранилища ("Saved on this device · persistent" или "Browser may clear data. Export often.");
  - дата последнего экспорта;
  - "Export save";
  - Import (проверка → подтверждение → результат);
  - "Restore backup" (с датой);
  - Motion toggle;
  - "Reset progress" (подтверждение вводом текста);
  - About: дисклеймер, кредит PokéAPI, ссылка на исходники.
- **Главное действие:** "Export save" · **Второстепенные:** Import save, Restore backup, Reset progress.
- **Состояния:**
  - content: всё выше;
  - empty: бэкапа нет — "No backup yet";
  - loading: "Importing…";
  - error: "This file is damaged or not a Trainer Studio save" / "Made by a newer version. Update the page and try again";
  - мигрировано: "Upgraded from v1";
  - success: "Save imported";
  - хранилище заблокировано: только экспорт.
- **Тексты** (en): title "Settings", empty "No backup yet", button "Export save".
- **Доступность:** результат импорта объявляется через live-регион. Сброс требует ввести "RESET", поле подписано.

## Дизайн-токены (Tokens)
### Colors
Только тёмная тема. Токены шаблона (shadcn) — **слой алиасов** над существующими токенами `src/app/styles.css`. Существующие `ink-*`, `accent`, `danger`, `side-*`, `--type` не переименовываются.

| Token | Light | Dark | Use |
|---|---|---|---|
| --background | — | #07080b (ink-950) | фон приложения |
| --foreground | — | #e7e9ef (ink-100) | основной текст |
| --card | — | #151821 (ink-850) | панели, glass-фон, holo-карты |
| --card-foreground | — | #e7e9ef | текст на панелях |
| --popover | — | #151821 | = card (диалоги, меню) |
| --popover-foreground | — | #e7e9ef | = card-foreground |
| --primary | — | #ffd23f (accent) | главные кнопки, CTA Fight, фокус |
| --primary-foreground | — | #07080b | текст на primary |
| --secondary | — | #1b1f2a (ink-800) | второстепенные кнопки |
| --secondary-foreground | — | #e7e9ef | текст на secondary |
| --muted | — | #0f1117 (ink-900) | приглушённые блоки, дорожки полос |
| --muted-foreground | — | #818a9e (ink-500) | вторичный текст, подписи |
| --accent | — | #1b1f2a | нейтральный hover и selected (shadcn), не бренд |
| --accent-foreground | — | #e7e9ef | текст на hover |
| --destructive | — | #ff6b6b (danger) | Reset, ошибки |
| --border | — | #3a4152 (ink-600) | декоративные разделители, не границы полей |
| --input | — | #818a9e | границы полей ввода (≥ 3:1) |
| --ring | — | #ffd23f | кольцо фокуса |
| --rarity-common | — | #aab1c2 | new: рамка, вспышка, текст редкости |
| --rarity-uncommon | — | #5ee39a | new |
| --rarity-rare | — | #5eb0ff | new |
| --rarity-epic | — | #c48cff | new |
| --rarity-legendary | — | #ffb347 | new; оранжевый, чтобы не путаться с primary |

sidebar/chart: template (не используются). Полосы опыта: заливка `--primary` (тренер) и `--rarity-rare` (покемоны) на дорожке `--muted`.

### Contrast (WCAG AA)
| Pair | Light | Dark | Pass |
|---|---|---|---|
| --foreground on --background | — | 16.50:1 | yes |
| --card-foreground on --card | — | 14.61:1 | yes |
| --popover-foreground on --popover | — | 14.61:1 | yes |
| --muted-foreground on --background | — | 5.78:1 | yes |
| --muted-foreground on --muted | — | 5.45:1 | yes |
| --muted-foreground on --card | — | 5.12:1 | yes |
| --primary-foreground on --primary | — | 13.87:1 | yes |
| --primary-foreground on accent-strong #ffe27a (hover) | — | 15.65:1 | yes |
| --secondary-foreground on --secondary | — | 13.56:1 | yes |
| --destructive on --background | — | 7.22:1 | yes |
| --ring vs --background | — | 13.87:1 | yes |
| --input vs --background | — | 5.78:1 | yes |
| rarity-common / uncommon / rare / epic / legendary on --background | — | 9.32 / 12.33 / 8.71 / 8.15 / 11.24 | yes |
| rarity-* on --card | — | 8.25 / 10.92 / 7.71 / 7.21 / 9.95 | yes |
| --background text on rarity fills (бейджи) | — | 9.32–12.33 | yes |

`--border` (1.96:1) только декоративный: никакой интерактивный элемент не держится на нём одном.

### Scales
`--radius: 1rem`, чтобы шкала шаблона (`rounded-lg` … `rounded-4xl`) совпала с нынешними xl/2xl/3xl. Произвольные `[2rem]` и `[10px]` заменяются шкалой. Размеры текста: только шкала Tailwind (`text-xs` и больше), произвольные 10–11 px убрать: бейджи типов сейчас 11 px. Motion-токены (`--ease-*`, `--dur-*`, `--stagger`) остаются как есть.

### Theme wiring
Тема только тёмная, светлой палитры нет.
- В `src/app/styles.css` добавить блок `:root` с переменными shadcn из таблицы, значения ссылаются на существующие токены (`--background: var(--color-ink-950)` и так далее), плюс `@theme inline` маппинги `--color-background: var(--background)` и так далее, как в `globals.css` шаблона (без `.dark` и без `@custom-variant dark`).
- Токены редкостей: `--color-rarity-*` в `@theme`.
- `color-scheme: dark` и `themeColor #0b0c10` в `app/layout.tsx` остаются.
- Существующие классы (`bg-ink-900`, `text-accent`) продолжают работать. Новый код пишет семантические классы (`bg-card`, `text-muted-foreground`, `bg-primary`).

## Компоненты (Components)
| Component | Screens | Variants / states | Base |
|---|---|---|---|
| HoloCard | home, battle, capsule-reveal, collection, creature, team | large / mini / slot / silhouette (unowned) / locked; Lv, ★, точка таланта; sprite fallback + retry | existing `src/widgets/team-showcase/TeamShowcase.tsx` (вынести карту и наклон в отдельный компонент) |
| AppNav | все | desktop top bar + CTA Fight / 375px top row + bottom tabs / onboarding minimal; бейджи, `aria-current` | new |
| BattleArena | battle | N×N 1–4, intro-сценарий, ×2 / Skip / Replay, текстовый fallback, результат с наградами, отметками заданий, подсказкой | existing `src/widgets/battle-arena/ui/BattleArena.tsx`, `ResultOverlay.tsx`, `Hud.tsx` (обобщить с 4×4) |
| TalentTree | creature, trainer | creature 3×4 / trainer ~15 узлов; locked / available / owned; reset | new |
| CapsuleReveal | capsule-reveal | single / multi, редчайшая последней, pity внизу, reduced motion | new (на `src/widgets/team-showcase/LockInBurst.tsx` и `src/shared/ui/Dialog`) |
| OddsPity | capsules, capsule-reveal, home | таблица шансов по тирам, pity-шкала, закрытый тир | new |
| LadderPath | ladder, home (карточка этапа) | cleared / current / locked, панель выбранного узла | new |
| QuestList | home, battle (результат) | прогресс, запас 3 дня, пусто, clock-guard, закрыто | new |
| PokemonSearch | capsules, collection, team | filter mode / unowned-only buy mode | existing `src/features/team-builder/ui/PokemonCombobox.tsx` (перенести в `src/features/pokemon-search`) |
| TeamDialog | team (из home, battle, creature, level-up) | 1–4 слота, закрытые, пульсирующий новый слот | existing `TeamShowcase` + `useSlotReorder` + `src/shared/ui/Dialog` |

**Переиспользуется:**
- `widgets/battle-arena`: Stage, Hud, BattleLog, director3d, fallbacks;
- `team-showcase` и `useSlotReorder`;
- `LockInBurst`;
- `views/home/HeroHeading`, `views/battle/BattleAmbient`;
- `features/motion-toggle`;
- `shared/ui` (Button, Dialog, Field, Spinner, Spotlight, ErrorBoundary).

shadcn-компоненты не добавляем: свой UI-кит в `src/shared/ui`.

**Удаляется:**
- `features/team-builder`: TeamBuilderForm, ConfirmTeamDialog, схема имени;
- `features/battle-setup`: углы, пресеты, кубик соперника;
- параметр `?red`;
- `<select>` ростера и Remove;
- `shared/ui/Pokeball`: риск по IP, заменяется визуалом капсулы.

Редирект `/#/battle…` теперь ведёт на `/`.

## Доступность (Accessibility)
- Контраст посчитан выше, все пары AA. Нет текста мельче `text-xs` (12 px).
- В `app/layout.tsx`: skip-link "Skip to content", `<main id="content">` на каждой странице, `aria-current="page"` в AppNav.
- Видимый фокус на всех интерактивных элементах, включая иконки-кнопки: `focus-visible:ring-2 ring-ring`. Целевые размеры не меньше 44×44 (`tap-target`), нижний таб-бар 44 px.
- У каждой кнопки-иконки есть `aria-label`. Состояния через `aria-pressed`, `aria-disabled`, `aria-current`; у закрытых элементов причина в тексте.
- Награды, раскрытия капсул, результаты боя и импорта объявляются через live-регионы. Фокус после диалогов возвращается к вызвавшему элементу.
- Motion: режим Auto / On / Off сохраняется. Reduced motion выключает тряску, вспышки и наклон (кроссфейд вместо них), 3D-бой идёт в спокойном режиме камеры.
- Цвет редкости никогда не единственный признак: рядом всегда текст ("Rare") и форма рамки.

## Следующий шаг (Next)
`/product-prototype` — 2–3 визуальных варианта ключевых экранов для сравнения (необязательно); затем `/product-build` — сборка Must-функций по этому дизайну.
