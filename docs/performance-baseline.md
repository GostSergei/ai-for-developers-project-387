# Базовая линия производительности (Lighthouse)

Эталонные значения Core Web Vitals для утреннего отчёта. Метрики получены из
Lighthouse CLI против продакшена:
https://ai-for-developers-project-387-production-79c6.up.railway.app

Утренний отчёт сравнивает текущие значения с этой базовой линией. Просадка более
чем на 10% от базы считается проблемой и выносится в чеклист правок.

| Метрика | Описание | База |
|---|---|---|
| LCP | Largest Contentful Paint, с | TBD |
| CLS | Cumulative Layout Shift | TBD |
| INP | Interaction to Next Paint, мс | TBD |
| TBT | Total Blocking Time, мс | TBD |

Базу нужно заполнить значениями из первого реального прогона Lighthouse
(артефакт `lighthouse-report-<run_id>` во вкладке Actions) — поле `audits.largest-contentful-paint.displayValue`,
`audits.cumulative-layout-shift.displayValue`, `audits.interactive.displayValue`,
`audits.total-blocking-time.displayValue`.
