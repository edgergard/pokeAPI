# Trainer Studio v2: автобатлеры, гача и дизайн коллекционной игры

Отчёт собран 2026-11-22. Каждое число взято из источника из раздела 8 или помечено **(допущение)**. Пометка **(не подтверждено)** значит, что при проверке источник не нашёлся. Утверждения, которые проверка признала ошибочными, из отчёта убраны.

## 1. Короткий вывод

- **«Pokemon-автобатлер в браузере» не новинка.** Уже есть бесплатный открытый Pokemon Auto Chess, а также PokeRogue и PokeClicker. Незанятым выглядит другое: одиночная игра без сервера и аккаунтов, где в автобое дерётся ваша собственная прокачанная коллекция, есть 3D-карты и надёжное переносимое сохранение **(допущение)**.
- **Каркас автобоя лучше взять из Super Auto Pets.** Каждый ход фиксированные 10 золота, юнит стоит 3, реролл 1, есть заморозка. Забег идёт до 10 побед или 5 поражений. Это проще экономики TFT с процентами и честнее для одиночной игры.
- **Главное конструктивное решение: коллекция расширяет выбор, а не добавляет сырую силу.** Магазин внутри забега наполняется только вашими покемонами. Постоянные уровни и таланты внутри забега стоит нормализовать, а полную силу давать только в PvE, которое подстраивается под игрока.
- **Из гачи стоит оставить ритуал открытия и честные гарантии.** Ритуал: вспышка нужного цвета, переворот карты. Гарантии: видимые шансы, один явный счётчик гарантии (pity), полезные дубликаты, «пыль» для покупки недостающих покемонов. Выбросить стоит премиум-валюту, стамину, FOMO, скрытый soft pity и ловушку 50/50.
- **Прогрессию лучше держать простой.** Два трека: уровень тренера открывает системы, уровень покемона растёт до 50 и даёт статы по формуле Pokemon. Звёзды идут от дубликатов, таланты маленькие, задания в формате «3 дневных + недельное», валюты только мягкие.
- **Главный риск — IP Nintendo/TPC, а не законы о лутбоксах.** Безопаснее всего: никаких денег вообще, никакого «Pokemon» в названии, никакого продвижения в прессе, арт за адаптером, который можно заменить, и видеодемо для портфолио.
- **Технически:** данные PokeAPI стоит запекать при сборке, сохранение перенести в IndexedDB с экспортом в файл, а весь RNG сделать сидированным со счётчиками, что совпадает с уже детерминированным боем.

## 2. Автобатлеры: как устроены и что из них взять

| Игра | Формат | Экономика | Улучшение юнитов | Соперники | Длина сессии |
|---|---|---|---|---|---|
| Dota Auto Chess (мод, 4 янв 2019) | 8 игроков, общий пул героев, скамейка на 8 | +1 за каждые 10 накопленного золота («up to forty»), серии, +1 за победу | 3 одинаковых → 2★, три 2★ → 3★; синергии по классу и расе | живые | — |
| Teamfight Tactics | 8 игроков | 5 в раунд, проценты +1/10 (не больше +5), серии +1/+2/+3, +1 за PvP-победу | 3 копии → звезда | живые | 30–40 мин (допущение) |
| Hearthstone Battlegrounds | 8 игроков, дуэли 1 на 1, 30 HP, стол до 7 миньонов | 3 золота на 1-м ходу, +1 за ход, максимум 10; покупка 3, продажа 1, рефреш 1 | 3 копии → золотой миньон и Discover с уровня выше | живые | 20–30 мин (допущение) |
| Super Auto Pets | 5 слотов, тиры магазина открываются на ходах 1/3/5/7/9/11 | каждый ход 10 золота, питомец 3, реролл 1, первый ролл бесплатный, заморозка | XP от дубликатов (2, затем ещё 3) | асинхронные «призраки», 10 побед или 5 жизней | 15–25 мин (допущение) |
| Backpack Battles | раскладка предметов в сетке рюкзака, до 18 раундов | старт 13 золота, доход 10–22, магазин из 5 предметов, рерольлы по 1, затем по 2 | соседние предметы комбинируются, редкость растёт по раундам | асинхронные сборки других игроков; 10 побед или 5 поражений | — |
| The Bazaar | дни по 6 часов: монстр в 3-й час, PvP в 6-й | Prestige 20, проигрыш в PvP отнимает столько, какой сейчас день | — | призраки, цель 10 PvP-побед | — |
| Mechabellum (не подтверждено) | между раундами драфт апгрейдов, варианты одинаковы для обоих игроков | — | — | режим 2.0 «Star Expedition» против зеркальных армий | — |

Контекст:
- Dota Auto Chess к маю 2019 собрал более 8 млн игроков и породил TFT, Underlords и Auto Chess.
- Шансы магазина в TFT меняются от патча к патчу (14.9, 14.12), поэтому любую таблицу шансов стоит считать временной.
- The Bazaar прошёл путь: закрытая бета с 30 окт 2024, бесплатная открытая бета с 5 мар 2025, запуск в Steam 13–14 авг 2025 с отказом от free-to-play после критики монетизации.
- Clash Mini (коллекционные «Mini» с постоянной прокачкой) Supercell закрыла: о решении объявили 15 мар 2024, серверы выключили 25 апр 2024, потому что игра не дотянула до планки качества студии.

**Что взять:**
1. **Доход как в SAP**: 10 золота за раунд без переноса, юнит 3, реролл 1, первый ролл бесплатный, заморозка. Проценты в стиле TFT (до +5) можно сделать талантом тренера.
2. **Пул магазина — это коллекция игрока.** Редкость и стадия эволюции задают тир, а тиры открываются на ходах 1/3/5/7/9/11.
3. **Слияние внутри забега отдельно от аккаунта.** 3 копии дают «золотую» или эволюционировавшую форму и Discover с тира выше, как в BG.
4. **Типы покемонов работают как племена.** При столе на 4–6 слотов пороги синергии 2/3/4 (допущение).
5. **Бой по правилам BG:** первым ходит тот, у кого больше юнитов, атаки идут слева направо, цели случайные, но сначала Taunt. Против затяжных боёв помогает «усталость» как в Backpack Battles. Всё сидировано, поэтому бой можно повторить.
6. **Структура забега:** 10 побед до 5 поражений, элитные или боссовые PvE-узлы каждые 3–4 раунда с наградой в виде шаров (допущение по частоте).
7. **Призраки без бэкенда:** снимки досок игрока по раундам, бот-драфтер по тем же правилам магазина, JSON-пак призраков в бандле, импорт досок друзей текстом (всё допущение).
8. **Меньше раздражения от RNG:** заморозка, видимые шансы по тирам, одинаковый выбор для обеих сторон. По данным PC Gamer и Riot, RNG и потеря контроля — частые жалобы на TFT (не подтверждено).

## 3. Гача: механики, психология, что оставить и что выбросить

**Как это устроено у референсов:**
- **Genshin:** жёсткий pity 90 на баннере персонажей и 80 на баннере оружия. Soft pity около 74 — это оценка сообщества, официально его не публиковали. Проигрыш 50/50 гарантирует, что следующая 5★ будет из баннера. Дубликаты 2–7 открывают созвездия C1–C6, дальше превращаются в Starglitter для магазина. Лимит Resin подняли со 160 до 200 в v4.7, одна единица восстанавливается за 8 мин, полная шкала примерно за 26 ч.
- **Honkai: Star Rail:** 5★ на баннере персонажей 0,6%, на баннере Light Cone 0,8%. Pity 90 и 80 соответственно, 4★ гарантирована каждые 10 круток. Light Cone разыгрывается 75/25, поэтому в худшем случае нужный выпадет за 160 круток. Дубликаты дают Eidolon и Starlight для обменного магазина.
- **AFK Journey:** герой S-уровня 3,43% (5,22% с учётом pity). Дубликаты ведут по Ascension, для Supreme+ нужен оригинал плюс 7 копий.
- **Pokemon TCG Pocket:** один бесплатный пак раз в 12 ч. Pack Points покупают конкретные карты, то есть работают как pity на завершение коллекции. Шансы публикуются по слотам: 1★ 2,572% и 10,288%, корона 0,04% и 0,16%. Карта-корона — альтернативный арт с теми же статами. Wonder Pick: выбрать 1 из 5 закрытых карт из чужого пака.
- **Провал с обменом в TCG Pocket:** обмен 1★ стоил 400 токенов, а уничтожение карты 1★ давало 100. 5 фев 2025 всем раздали по 1000 токенов, позже токены заменили на Shinedust (сообщалось на 29 июл 2025).
- **Выручка TCG Pocket** (оценки AppMagic, неофициальные): около $1,3 млрд gross за первый год; $975,2 млн net за два года, второй год на 68% ниже первого.

**Типовые паттерны:**
- **Две валюты.** Премиум-валюта конвертируется в зарабатываемую. FTC прямо назвала такую многослойность способом скрыть реальные траты.
- **Pity и обменные магазины** ограничивают максимальное невезение.
- **Дубликаты всегда полезны:** первые копии дают ступени силы, следующие превращаются в валюту.
- **Дневной лимит стамины** возвращает игрока каждый день.
- **Батл-пасс:** бесплатный трек плюс платный примерно за $10.
- **Поэтапное раскрытие:** цвет вспышки заранее сообщает редкость (синий, фиолетовый, золотой).

**Психология:**
- **Подкрепление по вариативному графику** даёт самое устойчивое поведение, и лутбоксы под него подходят.
- **Эффект «почти выиграл»** (проигранное 50/50) усиливает желание крутить дальше (не перепроверено).
- **Невозвратные затраты:** частично заполненный счётчик pity тянет вернуться. В основном это комментарии, отдельных экспериментов нет.
- **Связь с проблемной игрой:** у подростков, покупающих лутбоксы, признаки проблемной игры встречались в 11,4 раза чаще (4,5 с поправками). Исследование кросс-секционное, причинности оно не доказывает.

**Критика и регулирование:**
- В янв 2025 HoYoverse согласилась на урегулирование с FTC на $20 млн без признания вины. Условия: запрет продажи лутбоксов детям до 16 без согласия родителей, раскрытие шансов, возможность купить лутбокс напрямую за доллары, а не только за виртуальную валюту.
- В Бельгии платные лутбоксы с 2018 года считаются азартной игрой, но применяют закон слабо: 82% топ-100 iPhone-игр по-прежнему с лутбоксами.
- В Нидерландах суд 9 мар 2022 решил по FUT, что FIFA в целом — игра навыка.
- В Бразилии ECA Digital действует с 17 мар 2026, санкции начинаются в ноябре 2026.
- Все эти нормы касаются **платной** случайности. Игра без покупок и без обмениваемых предметов под них не попадает (допущение, не юридическая консультация).

**Оставить:**
- Ритуал открытия: шар трясётся, вспышка цвета редкости, карты переворачиваются, самая редкая последней. Кнопки «пропустить» и «открыть всё» — с первого дня.
- Точные шансы и счётчик pity прямо в интерфейсе. Один жёсткий pity на 40–50 круток (допущение по числу), без скрытого soft pity и без 50/50.
- Дубликаты 2–6 дают звезду или очко таланта, лишние копии превращаются в «пыль», за которую покупается любой недостающий покемон, как Pack Points.
- Покедекс с силуэтами и награды за поколение и тип. Шайни как чисто косметический топ-тир, по аналогии с картами-коронами.
- Wonder Pick как мини-игра после боя: 1 из 5 закрытых карт команды соперника.
- RNG круток сидирован от сохранения, `hash(saveSeed, pullIndex)`, чтобы перезагрузка не перекидывала результат (допущение).

**Выбросить:**
- Премиум-валюту, даже «бутафорскую».
- Стамину и ускорители таймеров.
- Лимитированные баннеры. «Избранный шар» допустим, но каждый покемон доступен навсегда.
- Серии входов, которые сбрасываются. Максимум накопительный бесплатный шар, копится до 3 дней (допущение).

## 4. Прогрессия и экономика

**Референсы:**
- **Genshin:** Adventure Rank открывает пороги возвышения (AR15/25/30/35/40/50 → уровни 40–90; для 5-го порога источники расходятся, AR40 или AR45). Рост линейный, без выбора билда; колумнист The Star считает, что это толкает игроков копить (это мнение, а не данные).
- **Pokemon:** кривые опыта кубические (Fast 0,8n³, Medium Fast n³, Slow 1,25n³). На 100-м уровне суммарный опыт от 600 тыс. до 1,64 млн. Кривая каждого вида доступна в PokeAPI `growth-rate`.
- **Статы Pokemon (Gen III+):** floor((floor((2·Base + IV + floor(EV/4))·Level/100) + 5)·Nature). IV от 0 до 31, EV 510 в сумме, характер ×1,1 или ×0,9.
- **Деревья талантов:** в PoE 1 дерево из 1325 узлов, персонаж заполняет меньше 10%. Таланты Genshin растут только вертикально.
- **Marvel Snap:** уровень коллекции как общая лента наград; к CL474 у всех одинаковый набор Pool 1–2.
- **AFK Arena:** Resonating Crystal даёт +5 к потолку уровня за каждого Ascended-героя, то есть поощряет широкую коллекцию.
- **Задания:** в GW2 Wizard's Vault неделя приносит около 850 Astral Acclaim против примерно 60 в день. В Hearthstone патч 29.2 (апр 2024) поднял требования недельных заданий примерно до +200%, и в патче 31.0 (окт 2024) это откатили, потому что игроки бросали задания.
- **Экономика:** по Machinations и Unity, у каждого источника валюты должен быть сток, первую сессию стоит делать щедрой, а баланс моделировать до релиза.

**Рекомендуемая простая модель (все числа — допущение для старта):**
- **Уровень тренера:** около 30 уровней, опыт линейный. Открывает слоты команды, задания, тиры сундуков и очки талантов тренера. Задаёт потолок уровня покемона, например потолок = уровень тренера × 2.
- **Уровень покемона:** 1–50. Кривая из PokeAPI growth-rate, уменьшенная примерно в 20 раз. Статы по формуле Pokemon с Level/50, IV 0–31 при поимке (так у дубликатов появляется ценность), характер ±10%. EV заменяются талантами.
- **Звёзды 1–5:** от дубликатов или осколков. Каждая звезда даёт +10 к потолку уровня и новый тир талантов.
- **Таланты:** у покемона 3 ветки × 4 узла, 1 очко за каждые 5 уровней, перераспределение бесплатно. У тренера около 20 узлов, которые меняют правила автобоя (рерольлы, скамейка, проценты), а не голые статы.
- **Задания:** 3 дневных по ~10 минут, накопление до 2–3 дней. Одно недельное с основной наградой. Около 50 достижений. Кампания на 30–50 этапов с наградой за первое прохождение. Задания по возможности считать в боях, а не по календарю.
- **Валюты:** шары, «пыль» (из лишних дубликатов, тратится на покупку покемонов) и золото прокачки (уровни, перераспределение талантов, косметика). Вся экономика в одном `economy.ts`.
- **Против перекоса силы:** топ-редкость и составы кампании зафиксированы, долгие цели горизонтальные (новые виды и билды). Сила ограничена базовыми статами из PokeAPI.
- **Баланс в коде:** бой детерминированный, поэтому Node-скрипт может прогнать 30 «дней» игры и посчитать, сколько дней нужно до максимума одного покемона и до 50% покедекса. Его можно запускать в CI.

## 5. Конкуренты в Pokemon-нише и где пробел

| Игра | Платформа | Цена | Сильная сторона | Жалоба | Модель сохранения |
|---|---|---|---|---|---|
| Pokemon Auto Chess | браузер | бесплатно, GPL-3.0, «non profit» по собственному описанию | готовый автобатлер с ботами | нужны онлайн-лобби, общий магазин вместо своей коллекции (допущение) | онлайн-аккаунт (допущение) |
| PokeRogue | браузер | бесплатно, AGPL-3.0, «никогда не монетизируется» | глубокие реиграбельные забеги, сотни тысяч игроков в день (май 2024) | хрупкое сохранение и синхронизация | аккаунт на сервере + кэш в localStorage |
| PokeClicker | браузер, десктоп | бесплатно, открытый код | длинная инкрементальная прогрессия | гринд в середине игры (допущение) | только локально, экспорт и импорт файлом |
| Pokemon Showdown | браузер | бесплатно, MIT | эталонный симулятор боя, команды в виде текста | нет коллекции и прогрессии (допущение) | команды текстом |
| Pokemon TCG Pocket | мобильная | F2P-гача | коллекционирование, ритуал открытия паков | дорогие токены обмена при запуске; выручка в сентябре 2025 упала на 56,6% за месяц | серверный аккаунт |
| Pokemon Masters EX | мобильная | F2P-гача | 7 лет работы | давление гачи (допущение); закрывается в Турции 2026-12-22 | серверный аккаунт |
| Pokemon Quest | Switch, мобильная | F2P | простота | слишком пассивная, медленная прокачка, ранний лимит инвентаря | аккаунт платформы |
| Rumble Rush, UNITE | мобильная, Switch | F2P | — | Rumble Rush закрылась через ~14 месяцев (2020-07-21); UNITE закрывается 2027-03-23 | сохранение умирает вместе с сервером |

**Пробел.** Ниша занята:
- забеги — PokeRogue;
- idle с сохранением в файл — PokeClicker;
- симулятор боя — Showdown;
- браузерный автобатлер — Pokemon Auto Chess;
- коллекционирование — TCG Pocket.

Тонко остаётся там, где всё это соединено: офлайн, без аккаунтов, ваша постоянная коллекция с уровнями и талантами дерётся в автобое, карты в 3D, сохранение — переносимый файл, который не умрёт вместе с сервером (допущение). Позиционирование: «твоя коллекция дерётся за тебя». В README стоит прямо сравнить игру с Pokemon Auto Chess и PokeRogue.

## 6. Риски

**IP Nintendo/TPC (главный риск).**
- Прецеденты:
  - Pokemon Uranium (2016) снят после действий Nintendo.
  - Pokemon Prism получил cease and desist за ~4 дня до релиза.
  - Pokemon Essentials снят по DMCA в авг 2018.
  - С Game Jolt удалили 379 фан-игр (дек 2020).
  - Relic Castle закрылся в мар 2024, хотя был без рекламы и некоммерческим (кто прислал уведомление, не раскрыто).
- PokeRogue жив и обновляется в 2026 году (v1.12), но это показывает выживаемость, а не легальность.
- Бывший главный юрист TPC Don McGowan (2024): компания вмешивается, когда у проекта появляется финансирование, а пресса — это то, как она узнаёт о проекте.
- Иск против Palworld — патентный и против коммерческого конкурента. Решение было назначено на 2026-11-09, подтверждённого итога нет.
- Меры:
  - никаких денег: ни рекламы, ни донатов, ни Patreon;
  - без «Pokemon/Poke» в названии, домене и имени репозитория;
  - дисклеймер «unofficial fan project», без логотипов и без арта Poke Ball;
  - шары лучше назвать нейтрально, «капсулы» (допущение: гача-цикл вокруг «покеболов» повторяет официальные продукты);
  - не продвигать в прессе;
  - в портфолио подавать как технический кейс с видеодемо;
  - весь арт за `getCreatureArt(id)`, чтобы игру можно было переодеть в оригинальных существ.

**PokeAPI и спрайты.**
- Fair Use Policy требует кэшировать ресурсы локально, за нарушение грозит вечный бан IP.
- Права на изображения в репозитории спрайтов принадлежат TPC; CC0 покрывает только права контрибьюторов.
- С 2025-05-08 GitHub ужесточил лимиты для неавторизованных запросов к raw-файлам, и пользователи жалуются на HTTP 429.
- Решение: данные (виды, статы, типы) запекать при сборке, чтобы в рантайме не было ни одного запроса к API. Спрайты грузить лениво, кэшировать в service worker, иметь запасной вариант при 429, сетку коллекции делать постраничной.
- Компромисс: хотлинк упирается в 429, а упаковка спрайтов в бандл — это уже самостоятельное распространение защищённых файлов.

**Сохранения в браузере.**
- **localStorage:** около 5 MiB на origin, запись синхронная, при переполнении `QuotaExceededError`.
- **IndexedDB:** в Chrome до 60% диска.
- **Safari ITP:** стирает всё хранилище после 7 дней использования Safari без взаимодействия с сайтом. У веб-приложений с домашнего экрана свой счётчик.
- **`navigator.storage.persist()`:** Firefox спрашивает пользователя, остальные браузеры решают сами.
- **Решение:**
  - один версионированный документ в IndexedDB (например, idb-keyval);
  - `persist()` после первого значимого действия;
  - экспорт `{format, schemaVersion, createdAt, gameVersion, checksum, data}`: gzip через CompressionStream (Baseline с 2023), затем base64 в `.txt`;
  - SHA-256 только для обнаружения порчи файла;
  - цепочка миграций и валидация zod при импорте, слот бэкапа;
  - напоминания экспортировать;
  - без шифрования и античита: игрок один, вредить некому (допущение).

**Детерминизм и часы.**
- RNG mulberry32 или sfc32 передаётся явно, `Math.random` не используется. Сиды от счётчиков боёв и круток (допущение).
- Перевод системных часов — известный эксплойт (Wuthering Waves, Disney Dreamlight Valley). Без сервера его не закрыть.
- Поэтому: хранить максимальное виденное время; если часы ушли назад, ставить таймеры на паузу, а не наказывать; дневные задания накапливаются не больше чем на 2–3 дня; офлайн-сундук ограничен 12 ч.

## 7. Предлагаемый core loop v2 и первая версия

```
[Открыть капсулы/сундуки] -> новые покемоны / дубликаты -> звёзды, пыль
        |
        v
[Прокачка] уровни покемонов (до потолка тренера) + очки талантов
        |
        v
[Выбор отряда из коллекции] -> он задаёт пул магазина забега
        |
        v
[Забег автобатлера] магазин 10 золота -> расстановка -> сидированный автобой
   ^       элита/босс каждые 3-4 раунда   до 10 побед / 5 поражений
   |                                              |
   |                                              v
   +---- [Награды] капсулы, опыт тренера и покемонов, Wonder Pick 1 из 5
                 |
                 v
          [Задания и покедекс] дневные/недельные, лента уровня коллекции
                 |
                 v
          уровень тренера -> новые системы, слоты, таланты тренера
```

**Идея объёма. Это только предложения, решение за вами.**

- **Сначала:**
  - сохранение в IndexedDB с экспортом и импортом, миграциями и бэкапом;
  - запечённые данные PokeAPI и адаптер арта;
  - капсулы с видимыми шансами, pity и пылью;
  - уровни покемонов со статами и звёзды из дубликатов;
  - уровень тренера как замок на системы;
  - режим забега на базе существующего боя 4×4: магазин из коллекции, слияние 3 копий, 10 побед / 5 поражений, бот-соперники;
  - около 10 заданий.
- **Потом:**
  - дерево талантов покемона, затем дерево тренера;
  - синергии типов;
  - призраки из собственных досок и импорт досок друзей;
  - кампания на 30–50 этапов;
  - недельные задания и достижения;
  - Wonder Pick;
  - офлайн-сундук;
  - шайни-косметика;
  - Node-симуляция экономики в CI.
- **Не делать:** реальные деньги, премиум-валюту, стамину, лимитированные баннеры, аккаунты и сервер.

## 8. Источники (все проверены 2026-11-22)

**Автобатлеры:**
- https://en.wikipedia.org/wiki/Dota_Auto_Chess
- https://wiki.leagueoflegends.com/en-us/TFT:Gold
- https://dotesports.com/tft/news/teamfight-tactics-champion-pool-rolling-chances
- https://esports.gg/news/teamfight-tactics/upcoming-systems-changes-in-tft-patch-14-9/
- https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-12-notes
- https://mobalytics.gg/tft/guides/how-to-manage-your-economy-in-teamfight-tactics-three-strategies
- https://www.pcgamer.com/teamfight-tactics-basic-overview/
- https://riotgames.com/en/news/dev-teamfight-tactics-reckoning-learnings
- https://www.pcgamesn.com/teamfight-tactics/set-16-paris-open-interview
- https://hearthstone.wiki.gg/wiki/Battlegrounds
- https://hearthstone.blizzard.com/en-us/news/24008697/28-2-patch-notes
- https://hearthstone.blizzard.com/en-us/news/24077473/29-2-patch-notes
- https://superautopets.wiki.gg/wiki/The_Basics
- https://superautopets.wiki.gg/wiki/Custom_Packs
- https://backpackbattles.wiki.gg/wiki/Game_Mechanics
- https://cavac.at/cavacopedia/Backpack%20Battles
- https://pcgamer.com/games/arrange-your-items-to-optimize-your-fights-in-asynchronous-autobattler-backpack-battles
- https://esports.gg/news/gaming/reynad-confirms-the-bazaar-closed-beta-release-date-and-more/
- https://www.pcgamesn.com/the-bazaar/open-beta-release-date
- https://www.pcgamesn.com/the-bazaar/steam-launch-monetization-changes
- https://automaton-media.com/articles/newsjp/the-bazaar-20250814-353462/
- https://senseos.gg/guides/the-bazaar/how-a-run-works/
- https://senseos.gg/guides/the-bazaar/ghosts-and-matchmaking/
- https://pcgamer.com/games/roguelike/the-bazaar-could-be-the-future-of-autobattlers-if-it-stops-strangling-itself-to-death-with-its-own-microtransactions
- https://www.pcgamer.com/games/card-games/after-its-disastrous-launch-last-year-im-here-to-tell-you-that-2025s-most-promising-auto-battler-finally-lives-up-to-its-potential
- https://www.dbltap.com/reviews/mechabellum-review
- https://www.pcgamer.com/i-cant-stop-playing-this-autobattling-strategy-masterpiece
- https://allthings.how/mechabellum-2-0-explained-star-expedition-mode-and-the-centurion-mech/
- https://support.riotgames.com/en-us/legends-of-runeterra/gameplay/champion-levels-and-stars-the-path-of-champions
- https://support.riotgames.com/legends-of-runeterra/gameplay/relics-the-path-of-champions
- https://supercell.com/en/news/clash-mini-ending-development/
- https://www.pocketgamer.com/clash-mini/is-discontinuing-but-also-coming-to-clash-royale
- https://gamingonphone.com/news/clash-mini-discontinues-development-server-shut-down-to-begin-in-late-april-2024
- https://deconstructoroffun.com/blog/2022/1/14/clash-mini

**Гача:**
- https://game8.co/games/Genshin-Impact/archives/305937
- https://www.hoyolab.com/article/39798396
- https://timesaver.gg/blog/genshin-pity-system-explained
- https://game8.co/games/Genshin-Impact/archives/468191
- https://progameguides.com/genshin-impact/genshin-impact-character-constellations/
- https://game8.co/games/Genshin-Impact/archives/301611
- https://www.destructoid.com/genshin-impact-will-increase-its-resin-cap-in-version-4-7/
- https://www.thegamer.com/genshin-impact-original-resin-changes/
- https://genshin-impact.fandom.com/wiki/Gnostic_Chorus
- https://honkai-star-rail.fandom.com/wiki/Light_Cone_Event_Warp
- https://primagames.com/tips/how-does-the-pity-and-gacha-work-in-honkai-star-rail-answered
- https://www.pcgamesn.com/honkai-star-rail/undying-starlight
- https://honkai-star-rail.fandom.com/wiki/Starlight_Exchange
- https://www.prydwen.gg/afk-journey/guides/banners-and-rates
- https://prydwen.gg/afk-journey/guides/ascension-info
- https://serebii.net/pokemonmasters/scout/hildaexmasterfairscout-november30th2025-january7th2026.shtml
- https://pokemonmasters-game.com/en-US/announcements/Bsearch_7020_4W_3
- https://bulbapedia.bulbagarden.net/wiki/Sync_pair_scout
- https://www.pokemon.com/us/strategy/a-guide-to-collecting-cards-and-using-wonder-picks-in-pokemon-trading-card-game-pocket
- https://mein-mmo.de/en/pokemon-tcg-pocket-the-rarest-cards-and-how-to-get-them,1197587
- https://game8.co/games/Pokemon-TCG-Pocket/archives/474500
- https://dexerto.com/pokemon/rarest-cards-in-pokemon-tcg-pocket-pull-rates-2971330
- https://bulbapedia.bulbagarden.net/wiki/Wonder_Pick
- https://game8.co/games/Pokemon-TCG-Pocket/archives/486253
- https://www.pocketgamer.biz/pokmon-trading-card-game-pocket-rockets-past-500m
- https://gonintendo.com/contents/54418-pokemon-tcg-pocket-reaches-1-3-billion-in-revenue-2-billion-battles-and-490-million
- https://www.pocketgamer.biz/pokmon-trading-card-game-pocket-celebrates-second-anniversary/
- https://insider-gaming.com/pokemon-tcg-pocket-is-gifting-players-free-trade-tokens/
- https://automaton-media.com/en/news/pokemon-tcg-pocket-hands-out-1000-free-trade-tokens-while-devs-work-on-controversial-trade-system/
- https://community.pokemon.com/en-us/discussion/17262/trading-feature-update
- https://www.sportskeeda.com/pokemon/pokemon-tcg-pocket-trade-token-changes-revealed
- https://www.pcgamer.com/games/rpg/ftc-says-genshin-impact-deceived-children-and-orders-its-publisher-to-pay-a-usd20-million-fine-and-stop-selling-loot-boxes-to-kids
- https://samurai-gamers.com/wuthering-waves/wuwa-wish-rarity-indicator-guide/
- https://twinfinite.net/guides/difference-between-4-star-5-star-pulls-in-honkai-star-rail/?amp=1
- https://hostedgg.com/blog/gacha-pull-reveal-color-culture
- https://www.nature.com/articles/s41598-022-21222-3.pdf
- https://www.cambridge.org/core/product/50BF93F6CDB8DA64128A31A6C1AE24DA
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12444325
- https://ftc.gov/business-guidance/blog/2025/01/level-tips-businesses-ftcs-settlement-genshin-impact-developer-hoyoverse
- https://www.gamedeveloper.com/business/researcher-claims-belgium-s-loot-box-ban-is-ineffective-
- https://www.pcgamesn.com/belgium-loot-box-laws-study
- https://cms.law/en/nld/legal-updates/Dutch-court-rules-fifa-loot-boxes-not-a-game-of-chance-revokes-ea-penalty
- https://www.raadvanstate.nl/actueel/nieuws/@130206/dwangsom-onterecht-opgelegd-loot-boxes/
- https://www.pcgamer.com/gaming-industry/brazils-president-has-signed-a-ban-on-selling-loot-boxes-to-minors-as-part-of-a-larger-online-child-safety-law
- https://www.mayerbrown.com/ja/insights/publications/2026/04/enforcement-of-brazils-eca-digital-introduces-new-obligations-for-companies
- https://thenextweb.com/news/europe-video-game-loot-box-age-restrictions

**Прогрессия и экономика:**
- https://game8.co/games/Genshin-Impact/archives/301576
- https://www.androidcentral.com/genshin-impact-ascension-guide-materials-quests-levels-and-requirements
- https://www.thegamer.com/genshin-impact-talents-guide/
- https://www.thestar.com.my/tech/tech-news/2026/06/01/side-quest-xp-diving-deep-into-the-levelling-systems-of-gacha-games
- https://www.serebii.net/games/exp.shtml
- https://pokeapi.co/api/v2/growth-rate/
- https://pokeapi.co/api/v2/growth-rate/5/
- https://pokeapi.co/api/v2/growth-rate/6/
- https://bulbapedia.bulbagarden.net/wiki/Experience
- https://www.dragonflycave.com/stats.aspx
- https://www.smogon.com/dp/articles/stats
- https://bulbapedia.bulbagarden.net/wiki/Effort_values
- https://gamedeveloper.com/business/a-study-on-gacha-progression
- https://arknights.wiki.gg/wiki/Headhunting
- https://www.pocketgamer.com/afk-arena/afk-arena-ascension-guide
- https://www.bluestacks.com/blog/game-guides/afk-arena/afka-signature-item-guide-tier-list-en.html
- https://afk.guide/?p=974
- https://afk.guide/level-caps/
- https://theriagames.com/?p=51884
- https://pathofexile.com/passive-skill-tree
- https://www.poewiki.net/wiki/Passive
- https://progameguides.com/marvel-snap/what-are-marvel-snap-card-pools/
- https://gamerant.com/marvel-snap-card-pools-mechanic-explained-collection-level/
- https://create.roblox.com/docs/production/game-design/introduction-to-quest-design
- https://wiki.guildwars2.com/wiki/Wizard%27s_Vault
- https://gamedeveloper.com/production/deep-dive-reimagining-the-battle-pass-to-maximize-enjoyment-in-guild-wars-2
- https://www.indiehackers.com/post/designing-with-data-what-daily-quests-actually-do-to-your-game-metrics-926d83be10
- https://hearthstone.blizzard.com/en-us/news/24148498/hearthstone-progression-update
- https://pcgamer.com/games/card-games/blizzard-backs-down-on-unpopular-hearthstone-change-so-now-weekly-quests-will-only-waste-twice-as-much-of-your-time-rather-than-triple
- https://outof.games/news/9981-the-best-daily-quests-know-when-to-leave-you-alone/
- https://machinations.io/articles/what-is-game-economy-design
- https://machinations.gitbook.io/docs/getting-started/framework-basics
- https://dev.to/hiroshi_takamura_c851fe71/how-to-design-a-game-economy-sources-sinks-loops-and-balance-j05
- https://unity.com/how-to/design-balanced-in-game-economy-guide-part-3
- https://gdcvault.com/play/1020524/Economic-Balancing-and-Improved-Monetization
- https://hostedgg.com/blog/gacha-powercreep-panic
- https://www.gamedeveloper.com/design/the-philosophy-of-grinding-and-how-to-reduce-it
- https://www.appgamer.com/afk-arena/strategy-guide/afk-rewards
- https://gamerempire.net/afk-arena-guide-tips-tricks-strategy/
- https://www.gamedeveloper.com/design/my-approach-to-economy-balancing-using-spreadsheets
- https://dev.to/sam_novak_574b07811e18495/designing-game-economies-why-spreadsheets-eventually-break-g5k

**Конкуренты:**
- https://dotesports.com/pokemon/news/pokerogue-creator-walks-away-from-viral-pokemon-project-after-adding-an-ending
- https://github.com/pagefaultgames/pokerogue
- https://newreleases.io/project/github/pagefaultgames/pokerogue/release/v1.11.4
- https://newreleases.io/project/github/pagefaultgames/pokerogue/release/v1.12.0.6
- https://newreleases.io/project/github/pagefaultgames/pokerogue/release/1.10.0
- https://github.com/pagefaultgames/pokerogue/issues/7580
- https://github.com/pagefaultgames/pokerogue/issues/7157
- https://github.com/Admiral-Billy/Pokerogue-App/issues/165
- https://pokeclicker.com
- https://companion.pokeclicker.com
- https://en.wikipedia.org/wiki/Pok%C3%A9mon_Showdown
- https://www.smogon.com/resources/beginner/ps_guide
- https://kotaku.com/a-fan-made-browser-game-is-pro-pokemon-players-secret-w-1838788058
- https://sportskeeda.com/pokemon/what-pokemon-auto-chess-play-it
- https://github.com/keldaanCommunity
- https://crynimar.itch.io/pokemom-auto-battler/devlog
- https://www.pokecommunity.com/threads/pokemon-auto-battler-single-player-roguelike-playtest.543078
- https://retrododo.com/kanto-tactics-combines-pokemon-with-teamfight-tactics-gameplay/
- https://www.pocketgamer.biz/pokemon-trading-card-game-pocket-smashes-400-million-in-10-weeks
- https://www.pocketgamer.biz/pokmon-tcg-pocket-surpasses-1bn-in-just-over-200-days/
- https://www.pocketgamer.biz/pokemon-tcg-pocket-dethrones-pokemon-go-as-it-celebrates-first-anniversary-and-13bn
- https://www.pocketgamer.biz/pokemon-tcg-pocket-makes-16bn-in-15-years/
- https://tribune.com.pk/story/2570608/pokemon-tcg-pocket-revenue-drops-over-50-as-global-player-base-declines-for-fifth-time-in-6-months
- https://game8.co/articles/latest/pokemon-tcg-pocket-backlash-prompts-trading-feature-improvements
- https://bulbagarden.net/threads/pokemon-masters-exs-7-year-anniversary-celebrations-begin-with-the-marvelous-mega-7-years-mega-evolution-party-event-plus-new-ex-master-sync-pairs.311443/
- https://www.pocketgamer.biz/pokmon-masters-ex-to-end-service-in-turkiye-in-december/
- https://ahost2.bulbagarden.net/threads/303847
- https://gameinformer.com/review/pokemon-quest/a-square-peg-in-a-round-hole
- https://www.denofgeek.com/games/pokemon-quest-review/
- https://gamesradar.com/pokemon-rumble-rush-is-shutting-down-14-months-after-it-went-live
- https://gematsu.com/2026/10/pokemon-unite-to-end-service-on-march-23-2027

**Риски: IP и правовые прецеденты:**
- https://gameinformer.com/b/news/archive/2016/08/14/fan-game-pok-233-mon-uranium-gets-takedown-notices-from-nintendo.aspx
- https://www.nintendolife.com/news/2018/08/nintendo_enforces_takedown_of_fan-made_game_creator_pokemon_essentials
- https://www.gamesradar.com/after-almost-10-years-unofficial-pokemon-website-known-for-sharing-fan-made-games-shuts-down-after-reportedly-receiving-a-dmca-takedown-notice
- https://kotaku.com/pokemon-fan-games-relic-castle-shutdown-dmca-reason-1851359618
- https://www.nbcnews.com/tech/nintendo-pokemon-company-palworld-pocketpair-lawsuit-rcna171817
- https://en.wikipedia.org/wiki/Nintendo_and_fan_games
- https://www.axios.com/2022/01/24/fan-made-game-escapes-nintendo
- https://www.gamedeveloper.com/console/nintendo-files-takedown-notice-against-i-pokemon-i-fan-game-creation-tool
- https://www.engadget.com/2018/08/29/pokemon-essentials-nintendo-takedown/
- https://www.videogameschronicle.com/news/pokemon-fan-game-repository-taken-down-by-a-reported-dmca-notice
- https://www.techdirt.com/2024/03/28/site-that-listed-information-about-3rd-party-pokemon-fan-games-shuts-down-under-threat
- https://www.techradar.com/news/nintendo-is-removing-videos-of-fan-game-that-had-players-shooting-pokemon
- https://www.techdirt.com/2024/03/20/pokemon-co-is-now-dmcaing-years-old-videos-showing-pokemon-modded-into-other-games/
- https://malaysia.news.yahoo.com/palworld-pok-mon-mod-creator-173625058.html
- https://www.pcgamer.com/games/they-can-never-kill-emulation-players-vexed-as-nintendo-continues-its-siege-on-switch-emulation-handing-dmcas-to-various-emulators-on-github
- https://wiki.pokerogue.net/changelog:current
- https://wiki.pokerogue.net/events:events
- https://nintendoeverything.com/nintendo-and-the-pokemon-company-update-palworld-lawsuit-limited-to-older-versions-only/
- https://courtdocket.org/nintendos-palworld-lawsuit-update-30k-cap-and-patent-rejections/
- https://www.gfinityesports.com/article/uspto-revokes-nintendo-summon-and-battle-patent-in-palworld-conflict
- https://openclassactions.com/news/palworld-nintendo-patent-lawsuit-update-july-2026.php
- https://www.engadget.com/gaming/nintendo/nintendo-palworld-lawsuit-seeks-65700-in-damages-163051523.html
- https://www.videogameschronicle.com/news/palworld-lawsuit-nears-end-with-nintendo-reportedly-poised-to-gain-almost-nothing/
- https://lawfold.com/palworld-nintendo-pokemon-lawsuit/
- https://aftermath.site/pokemon-lawyer-cease-desist-fan-project-pikachu-movie/
- https://www.gamesradar.com/former-pokemon-lawyer-explains-why-nintendo-goes-after-so-many-fan-games-no-one-likes-suing-fans

**Риски: технические:**
- https://pokeapi.co/docs/v2
- https://github.com/PokeAPI/sprites
- https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt
- https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/
- https://github.com/orgs/community/discussions/158445
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- https://webkit.org/blog/14403/updates-to-storage-policy/
- https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- https://datatracker.ietf.org/doc/html/rfc6265
- https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream
- https://pcgamer.com/games/rpg/players-unlock-unreleased-content-in-live-service-game-ultimate-hacker-style-setting-their-system-clocks-forward-a-few-weeks
- https://bugnet.io/blog/how-to-fix-daily-reward-exploit-via-device-clock-change
- https://gameranx.com/features/id/363712/article/disney-dreamlight-valley-how-to-time-travel-and-why-you-shouldnt-do-it/
