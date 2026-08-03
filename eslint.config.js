import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import * as svelteParser from 'svelte-eslint-parser';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

// svelte-eslint-parser tags the variables implicitly declared by `$:` reactive
// statements with a custom scope-manager definition type, "ComputedVariable".
// @typescript-eslint/no-unused-vars switches over the definition types it knows
// about with no default branch, so as soon as it tries to report one of those
// variables it reads `.type` off `undefined` and crashes the whole run:
//
//   TypeError: Cannot read properties of undefined (reading 'type')
//   Rule: "@typescript-eslint/no-unused-vars"
//
// Relabelling the definition as a plain "Variable" before the rules run is
// enough: that is the branch the rule would pick anyway for a `let`, it carries
// no autofix, and nothing in eslint-plugin-svelte keys off "ComputedVariable".
// Drop this once typescript-eslint handles unknown definition types.
const svelteParserWithPatchedDefs = {
	...svelteParser,
	parseForESLint(code, options) {
		const result = svelteParser.parseForESLint(code, options);
		for (const scope of result.scopeManager?.scopes ?? []) {
			for (const variable of scope.variables) {
				for (const def of variable.defs) {
					if (def.type === 'ComputedVariable') {
						def.type = 'Variable';
					}
				}
			}
		}
		return result;
	}
};

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	// `build/` è tracciato in git (viene deployato), quindi non arriva qui via
	// .gitignore, ma contiene solo bundle minificati generati da `vite build`:
	// lintarli produce centinaia di errori su codice che non scriviamo noi.
	{ ignores: ['build/'] },
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			// Un `_` iniziale segnala "non serve, ma non posso toglierlo": il caso
			// tipico è `{#each items as _, index}`, dove il binding dell'elemento è
			// posizionale e va tenuto per arrivare all'indice.
			// NB: non impostare destructuredArrayIgnorePattern, che attiva un ramo di
			// no-unused-vars che legge `def.name.parent` e ricasca nel crash sopra.
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					varsIgnorePattern: '^_'
				}
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parser: svelteParserWithPatchedDefs,
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	}
);
