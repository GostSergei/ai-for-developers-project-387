/**
 * Конфигурация commitlint для проекта.
 * Правила соответствуют спецификации Conventional Commits
 * (https://www.conventionalcommits.org/). Конфиг самодостаточен —
 * не требует установки @commitlint/config-conventional.
 */
export default {
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'ci', 'style', 'perf', 'build', 'revert'],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-case': [0],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    'body-leading-blank': [2, 'always'],
    'footer-leading-blank': [2, 'always'],
    'trailer-exists': [0],
  },
};
