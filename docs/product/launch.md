---
project: trainer-studio
track: web
status: preparing
launched: ""
url: "https://pokeapi-trainer-studio.vercel.app/"
date: "2026-11-23"
---

# Trainer Studio — launch

## Готовность (Readiness)
- main = dev, CI зелёный на main: да — 0e8bcec (dev впереди только на `docs(plan)`)
- `npm run check` на main: зелёный (817 тестов)
- Пробелы приёмки, перенесённые в запуск: нет (Must 7/7). Уже в production на Vercel с 2026-11-23 после Gate B и hotfix #16.
- Перенесённые из PLAN.md пункты запуска:
  - GitHub Pages ещё отдаёт старую сборку v1 по старому пути — нужен деплой под `/trainer-studio/`.
  - Имя Vercel-проекта `pokeapi-trainer-studio` содержит «poke» (риск IP по idea.md).
  - Без IndexedDB сейв живёт только в памяти и теряется при полной загрузке страницы боя.

## Данные (Data)
| Data | Where it goes (service) | Why | Retention |
|---|---|---|---|
| Весь прогресс игры (коллекция, уровни, капсулы, задания, имя тренера) | IndexedDB в браузере игрока (`trainer-studio` / `save:v2`, `save:backup`) — никуда не отправляется | сохранение игры | пока игрок не очистит данные браузера или не нажмёт Reset progress |
| Настройка Motion | localStorage браузера (`trainer-studio:motion`) | предпочтение анимаций | до очистки браузера |
| Файл экспорта сохранения | скачивается на устройство игрока | перенос прогресса | у игрока |
| IP-адрес и стандартные заголовки запроса | хостинг: Vercel и GitHub Pages (логи доступа) | отдача сайта | по политикам Vercel / GitHub |
| IP-адрес при загрузке картинок покемонов | raw.githubusercontent.com (GitHub) | спрайты и арт | по политике GitHub |

Аналитики, рекламы, аккаунтов, cookies для отслеживания, платежей и AI-провайдеров нет. Шрифты отдаются с самого сайта (next/font).

## Юридические страницы (Legal)
- /privacy — черновик написан (оператор edgergard, связь через GitHub Issues); проверь и опубликуй (you)
- /terms — черновик написан (право Украины, отказ от аффилиации с правообладателями); проверь и опубликуй (you)

## Предполётная проверка (Preflight)
- [x] Env: переменных окружения нет, ключей нет — pass
- [x] Секреты в клиентском коде: нет — pass
- [x] Реальная 404 — pass (`app/not-found.tsx`)
- [x] `robots.txt` и `sitemap.xml` — fix в launch PR
- [x] Open Graph-картинка — fix в launch PR (`/opengraph-image.png`, без арта покемонов)
- [x] /privacy и /terms в подвале Home и Settings — fix в launch PR
- [x] Убран `preconnect` к pokeapi.co, мёртвый клиент PokeAPI и @tanstack/react-query — fix в launch PR
- [x] Запасное сохранение без IndexedDB (sessionStorage) — fix в launch PR
- [x] Защита от расходов: платных сервисов нет — pass

## Сервисы и ключи (Services)
- [x] Vercel: проект подключён к GitHub, production-ветка `main` (you)
- [ ] Vercel: переименовать проект в `trainer-studio` (you)
- [ ] GitHub Pages: опубликовать сборку под `/trainer-studio/` (agent, по твоему «go»)

## Деплой (Deploy)
- Preview: —
- Production: https://pokeapi-trainer-studio.vercel.app/ — v2 выкачен 2026-11-23 (PR #15, hotfix #16)

## Календарь ручных шагов (Calendar)
| When | What | Who |
|---|---|---|
| — | — | — |

## Известные пробелы (Gaps)
- —

## Дальше (Next)
После запуска `/product` показывает дни с `launched`; правки идут через `/ship-pr`.
