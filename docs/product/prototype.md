---
project: trainer-studio
canvas: "https://claude.ai/artifact/84KrjZaWFbQYsKQZ2KCjxB"
variants: 3
chosen: a
design-updated: yes
status: approved
rounds: 1
date: "2026-11-22"
---

# Trainer Studio — prototypes

## Варианты (Variants)
| Variant | Idea (what it changes) | Row on canvas |
|---|---|---|
| A | As designed: токены design.md без изменений | [A — Home onboarding](https://claude.ai/artifact/84KrjZaWFbQYsKQZ2KCjxB#artboard-Main) |
| B | Snap juice: крупные карты с толстой рамкой цвета редкости и свечением, более тяжёлая типографика, радиус 24px | [B — Battle result](https://claude.ai/artifact/84KrjZaWFbQYsKQZ2KCjxB#artboard-b-battle) |
| C | Cool steel: циановый акцент #4fdcff, rare #9aa5ff, радиус 8px, плотнее и без свечения | [C — Battle result](https://claude.ai/artifact/84KrjZaWFbQYsKQZ2KCjxB#artboard-c-battle) |

**Кликабельный флоу:** [First visit → first Pokémon](https://claude.ai/artifact/84KrjZaWFbQYsKQZ2KCjxB#play-Main) (онбординг → результат боя → открытие капсулы → хаб)

## Экраны (Screens)
| screen-id | Chosen artboard | Local reference |
|---|---|---|
| home (onboarding: hero, dealt) | [Main](https://claude.ai/artifact/84KrjZaWFbQYsKQZ2KCjxB#artboard-Main) | docs/product/prototype/home.dc.html |
| home (hub) | [a-home-hub](https://claude.ai/artifact/84KrjZaWFbQYsKQZ2KCjxB#artboard-a-home-hub) | docs/product/prototype/home-hub.dc.html |
| home (hub, 375px) | [a-home-hub-mobile](https://claude.ai/artifact/84KrjZaWFbQYsKQZ2KCjxB#artboard-a-home-hub-mobile) | docs/product/prototype/home-hub-mobile.dc.html |
| battle (result) | [a-battle](https://claude.ai/artifact/84KrjZaWFbQYsKQZ2KCjxB#artboard-a-battle) | docs/product/prototype/battle.dc.html |
| capsule-reveal | [a-capsule-reveal](https://claude.ai/artifact/84KrjZaWFbQYsKQZ2KCjxB#artboard-a-capsule-reveal) | docs/product/prototype/capsule-reveal.dc.html |
| creature | [a-creature](https://claude.ai/artifact/84KrjZaWFbQYsKQZ2KCjxB#artboard-a-creature) | docs/product/prototype/creature.dc.html |

Остальные экраны (ladder, capsules, collection, trainer, team, level-up, settings) не прототипировались. Они строятся по design.md в том же стиле.

## Выбор (Choice)
Вариант A целиком: нынешний голо-аркадный стиль с жёлтым акцентом и токенами design.md. Его выбрал пользователь, без смешивания с B или C.

## Изменения в design.md (Changes)
- none: variant A unchanged (добавлена только строка Direction "Prototype: variant A chosen").

## Следующий шаг (Next)
`/product-build` — собирает приложение по design.md; агенты стримов используют docs/product/prototype/ как визуальный референс своих экранов.
