import nextEslintPluginNext from '@next/eslint-plugin-next';
import nx from '@nx/eslint-plugin';
import baseConfig from '../eslint.config.mjs';

export default [
  { plugins: { '@next/next': nextEslintPluginNext } },
  ...nx.configs['flat/react-typescript'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: false,
          ignoredCircularDependencies: [
            ['generation', 'artifacts'],
            ['artifacts', 'documents'],
            ['documents', 'generation'],
            ['llm', 'artifacts'],
            ['artifacts', 'llm'],
            ['llm', 'directories'],
            ['directories', 'llm'],
            ['directories', 'documents'],
            ['documents', 'directories'],
          ],
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$', '^@admin/.*$'],
          depConstraints: [
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:backend',
              onlyDependOnLibsWithTags: ['scope:backend', 'scope:shared'],
            },
            {
              sourceTag: 'scope:web',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:ui'],
            },
            {
              sourceTag: 'scope:admin',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:ui'],
            },
            {
              sourceTag: 'scope:mobile-capture',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:mobile-ui'],
            },
            {
              sourceTag: 'scope:extension',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['.next/**/*'],
  },
];
