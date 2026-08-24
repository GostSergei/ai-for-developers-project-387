# Базовая линия производительности (Lighthouse)

Эталонные значения Core Web Vitals для утреннего отчёта. Метрики получены из
Lighthouse CLI против продакшена:
https://ai-for-developers-project-387-production-79c6.up.railway.app

Утренний отчёт сравнивает текущие значения с этой базовой линией. Просадка более
чем на 30% от базы считается проблемой и выносится в чеклист правок.

| Метрика | Описание | База |
|---|---|---|
| LCP | Largest Contentful Paint, с | 2.3 |
| CLS | Cumulative Layout Shift | 0 |
| INP | Interaction to Next Paint, мс | 2300 |
| TBT | Total Blocking Time, мс | 110 |

Значения зафиксированы из первого реального прогона Lighthouse (артефакт
`lighthouse-report-<run_id>` во вкладке Actions): поля
`audits.largest-contentful-paint.displayValue`, `audits.cumulative-layout-shift.displayValue`,
`audits.interactive.displayValue`, `audits.total-blocking-time.displayValue`.
