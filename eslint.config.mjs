/**********************************************************************************
 * Copyright (c) 2025-2026 EclipseSource, Arm Limited and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License as outlined in the LICENSE file.
 **********************************************************************************/

import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
    {
        ignores: [
            'node_modules',
            'dist',
            "*.config.{ts,js,mjs}",
            "*.setup.{ts,js}",
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.commonjs,
                ...globals.node
            }
        },
        rules: {
            // ESLint Convention
            quotes: ['error', 'single'],
            semi: ['error', 'always'],

            'block-spacing': ['error', 'always'],
            'brace-style': [
                'error',
                '1tbs',
                {
                    allowSingleLine: true
                }
            ],
            'eol-last': ['error'],
            'linebreak-style': ['error', 'unix'],

            // ESLint Best Practices
            'no-console': ['warn'],
            'no-constant-condition': [
                'error',
                {
                    checkLoops: false
                }
            ],

            'no-trailing-spaces': ['error'],
            'object-curly-spacing': ['error', 'always']
        }
    },
    {
        name: 'typescript',
        files: ['**/*.ts', '**/*.mts', '**/*.cts', '**/*.tsx'],
        plugins: {
            typescript: tseslint
        },
        rules: {
            '@typescript-eslint/no-this-alias': 'off',
            '@typescript-eslint/no-namespace': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_'
                }
            ],
            // To enable in with separate PR, it requires larger code changes
            /*
            '@typescript-eslint/explicit-member-accessibility': [
                'error',
                {
                    accessibility: 'explicit',
                    overrides: {
                        constructors: 'off'
                    }
                }
            ],
            */
        }
    }
];
