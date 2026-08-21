# Заметки по CI-ботам (opencode)

Здесь описаны известные «грабли» при настройке GitHub Actions-ботов на базе
opencode и способы их обхода. Документ полезно читать при создании/правке любых
`opencode-*.yml` workflow.

## Контекст

Боты запускают действие `anomalyco/opencode/github@latest` с `use_github_token: true`.
В этом режиме агент должен уметь коммитить, пушить ветки и открывать PR — то есть
в ранне должны быть настроены git-identity и учётные данные для push.

## Баг 1: `persist-credentials: false` → `fatal: could not read Username`

**Симптом**

При попытке агента сделать `git push` workflow падает:

```
fatal: could not read Username for 'https://github.com': No such device or address
```

**Причина**

`actions/checkout` с `persist-credentials: false` после клонирования **не сохраняет**
учётные данные в git-конфиге репозитория. Токен используется только для самого
клонирования, но не остаётся для последующих `git push`.

**Обход**

Включить сохранение учётных данных в checkout:

```yaml
- uses: actions/checkout@v6
  with:
    persist-credentials: true
```

`actions/checkout` сам настраивает авторизацию (через includeIf + отдельный файл
в `RUNNER_TEMP`) так, что `git push` в рамках workflow проходит.

## Баг 2: ручной extraheader через `base64` → `Failed sending HTTP request`

**Симптом**

```
fatal: unable to access 'https://github.com/...': Failed sending HTTP request
```

Это CURLE_SEND_ERROR (код 55) — git/curl не может корректно отправить HTTP-запрос.
Ошибка **не** про авторизацию, а про битый HTTP-заголовок.

**Причина**

Ручная настройка учётки вручную, например:

```yaml
CRED=$(printf "x-access-token:%s" "${{ github.token }}" | base64)
git config --local http.https://github.com/.extraheader "AUTHORIZATION: basic ${CRED}"
```

Утилита `base64` (GNU coreutils) по умолчанию **переносит строку каждые 76 символов**
и добавляет `\n` в конце. Для длинного `github.token` перенос попадает в значение
`http.extraheader`, ломая HTTP-заголовок `AUTHORIZATION`.

**Обход**

Не писать extraheader вручную. Достаточно `persist-credentials: true` (см. Баг 1) —
checkout сам формирует корректный заголовок без переносов (`Buffer.from(...).toString('base64')`
внутри action, в отличие от системного `base64`).

Если ручная настройка всё же нужна — убрать переносы: `base64 -w 0`. Но это не
рекомендуется, т.к. дублирует работу checkout и добавляет лишний источник ошибок.

## Важно: `use_github_token: true` и `configureGit`

Внутренний обработчик действия (`github.handler.ts`) настраивает учётку для push
через `configureGit()` **только** в режиме GitHub App:

```ts
if (!useGithubToken) {
  await configureGit(appToken)
}
```

То есть в режиме `use_github_token: true` учётные данные для push агент получает
**не** от opencode, а именно от `actions/checkout`. Отсюда критичность
`persist-credentials: true` (Баг 1).

## Правильный шаблон шага настройки

После checkout достаточно задать только git-identity:

```yaml
- name: Configure git identity
  run: |
    git config --local user.name "github-actions[bot]"
    git config --local user.email "41898282+github-actions[bot]@users.noreply.github.com"
```

## Про «не пушащие» боты (review/triage)

- `opencode-review.yml` (триггер `pull_request` opened) — права `contents: read`:
  ревью не должно пушить. Если агент вдруг отклонится от промпта и изменит файлы,
  пуш просто не пройдёт (нет прав) — это безопасное поведение.
- `opencode-triage.yml` (триггер `issues` opened) — для `issues`-события действие
  требует вход `prompt`, иначе падает («PROMPT input is required for issues events»).

## Сводка

| Проблема | Симптом | Решение |
|---|---|---|
| `persist-credentials: false` | `could not read Username` | `persist-credentials: true` |
| ручной extraheader через `base64` | `Failed sending HTTP request` | убрать, полагаться на checkout |
