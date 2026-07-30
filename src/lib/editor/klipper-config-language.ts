// Syntax highlighting for the config editor.
//
// A Klipper `.cfg` is *almost* an INI file, so none of the off-the-shelf modes
// fit: on top of `[section]` / `key: value` / `#` comments, every option whose
// value is left empty opens an indented block, and the blocks belonging to
// `gcode:` and friends contain G-code plus Jinja2. Klipper configures Jinja
// with single braces (`{ params.X }`) instead of the usual `{{ }}`, so both
// forms have to be recognised.
//
// This is a hand-written stream tokenizer rather than a grammar: the format has
// no nesting to speak of, and the whole point is to make the file readable, not
// to parse it as strictly as Klipper does.

import {
	HighlightStyle,
	StreamLanguage,
	syntaxHighlighting,
	type StreamParser,
	type StringStream
} from '@codemirror/language';
import { json } from '@codemirror/lang-json';
import type { Extension } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';

/** Jinja control words, the ones that read as syntax rather than as data. */
const jinjaKeywords = new Set([
	'if',
	'elif',
	'else',
	'endif',
	'for',
	'endfor',
	'in',
	'set',
	'not',
	'and',
	'or',
	'is',
	'macro',
	'endmacro',
	'call',
	'endcall',
	'block',
	'endblock',
	'raw',
	'endraw',
	'filter',
	'endfilter',
	'with',
	'endwith',
	'do',
	'break',
	'continue',
	'include',
	'import',
	'from',
	'as'
]);

/** Names Klipper injects into every template, plus the Jinja literals. */
const jinjaBuiltins = new Set([
	'printer',
	'params',
	'rawparams',
	'loop',
	'true',
	'false',
	'none',
	'True',
	'False',
	'None'
]);

/** An option whose block holds G-code, so its lines get command highlighting. */
const gcodeKey = /gcode|script|template/i;

/** A whole value that is nothing but a number, or nothing but a boolean. */
const numberValue = /^[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?$/i;
const boolValue = /^(?:true|false)$/i;

interface Ctx {
	/** 0 = not in a `[…]` header, 1 = expecting the type, 2 = expecting the name. */
	header: 0 | 1 | 2;
	/** No token emitted on this line yet. */
	lineStart: boolean;
	/** Past the `:` of a `key: value` line. */
	value: boolean;
	/** Inside the indented block opened by an empty-valued option. */
	block: boolean;
	blockIndent: number;
	blockIsGcode: boolean;
	/** Closing delimiter of the Jinja expression being read, `null` outside one. */
	jinja: string | null;
}

/** Reads a Jinja expression, up to and including its closing delimiter. */
function tokenJinja(stream: StringStream, state: Ctx) {
	if (stream.match(state.jinja as string)) {
		state.jinja = null;
		return 'meta';
	}
	if (stream.eatSpace()) return null;

	if (stream.match(/^"(?:[^"\\]|\\.)*"?/) || stream.match(/^'(?:[^'\\]|\\.)*'?/)) return 'string';
	if (stream.match(/^\d+(?:\.\d+)?/)) return 'number';

	const word = stream.match(/^[A-Za-z_]\w*/) as RegExpMatchArray | null;
	if (word) {
		if (jinjaKeywords.has(word[0])) return 'controlKeyword';
		if (jinjaBuiltins.has(word[0])) return 'variableName.standard';
		return 'variableName';
	}
	if (stream.match(/^[|.,()[\]<>=!+\-*/%~]+/)) return 'operator';

	stream.next();
	return null;
}

/** Reads a line inside an indented block: G-code commands and their parameters. */
function tokenBlock(stream: StringStream, state: Ctx, first: boolean) {
	// `G28`, `SET_HEATER_TEMPERATURE`, `_MY_MACRO` — whatever opens the line.
	if (first && state.blockIsGcode && stream.match(/^[A-Za-z_][\w.]*/)) return 'macroName';
	// `HEATER=extruder`, and the bare-letter form `X10` / `F3000` / `S{BED}`.
	if (stream.match(/^[A-Za-z_]\w*(?==)/) || stream.match(/^[A-Za-z](?=[-+.\d{])/)) {
		return 'attributeName';
	}
	if (stream.match(/^[-+]?(?:\d*\.\d+|\d+\.?)/)) return 'number';
	if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return 'string';
	if (stream.match(/^[=<>!+\-*/%]+/)) return 'operator';

	stream.next();
	return null;
}

const parser: StreamParser<Ctx> = {
	name: 'klipper-config',

	startState: () => ({
		header: 0,
		lineStart: true,
		value: false,
		block: false,
		blockIndent: 0,
		blockIsGcode: false,
		jinja: null
	}),

	token(stream, state) {
		if (stream.sol()) {
			state.lineStart = true;
			state.header = 0;
			state.value = false;
			// A block ends at the first line that carries content and is indented no
			// further than the option that opened it. Blank lines stay inside it.
			if (state.block && stream.string.trim() !== '' && stream.indentation() <= state.blockIndent) {
				state.block = false;
			}
		}

		if (state.jinja !== null) return tokenJinja(stream, state);
		if (stream.eatSpace()) return null;

		const first = state.lineStart;
		state.lineStart = false;

		if (stream.match(/^[#;].*/)) return 'lineComment';

		// Jinja can open anywhere, including in the middle of a G-code argument.
		if (stream.match('{%')) {
			state.jinja = '%}';
			return 'meta';
		}
		if (stream.match('{{')) {
			state.jinja = '}}';
			return 'meta';
		}
		if (stream.match('{')) {
			state.jinja = '}';
			return 'meta';
		}

		if (state.header) {
			if (stream.eat(']')) {
				state.header = 0;
				return 'squareBracket';
			}
			if (stream.match(/^[^\s\]]+/)) {
				// `[gcode_macro START_PRINT]`: the type first, then the instance name.
				const tag = state.header === 1 ? 'keyword' : 'className';
				state.header = 2;
				return tag;
			}
			stream.next();
			return null;
		}

		if (first && !state.block && stream.eat('[')) {
			state.header = 1;
			return 'squareBracket';
		}

		if (state.block) return tokenBlock(stream, state, first);

		if (first) {
			const key = stream.match(/^[^\s:=#;]+/) as RegExpMatchArray | null;
			if (key) {
				state.blockIsGcode = gcodeKey.test(key[0]);
				return 'propertyName';
			}
		}

		if (!state.value && stream.match(/^[:=]/)) {
			state.value = true;
			// Nothing after the separator means the value is the indented block below.
			if (stream.string.slice(stream.pos).trim() === '') {
				state.block = true;
				state.blockIndent = stream.indentation();
			}
			return 'operator';
		}

		// Pin modifiers: `^PG6`, `!ar14`, `~PA0`.
		if (stream.match(/^[!^~]/)) return 'operator';
		if (stream.match(/^,/)) return 'punctuation';

		// Values are taken whole rather than character by character, otherwise the
		// digits inside a pin name (`PF13`) or a device path read as numbers.
		const word = stream.match(/^[^\s#;,]+/) as RegExpMatchArray | null;
		if (word) {
			if (numberValue.test(word[0])) return 'number';
			if (boolValue.test(word[0])) return 'bool';
			return null;
		}

		stream.next();
		return null;
	},

	languageData: {
		commentTokens: { line: '#' }
	}
};

export const klipperConfigLanguage = StreamLanguage.define(parser);

/**
 * GitHub-light palette, chosen to sit on the editor's near-white background
 * without competing with the Ginger red the page uses for its actions.
 */
const highlightStyle = HighlightStyle.define([
	{ tag: t.lineComment, color: '#6e7781', fontStyle: 'italic' },
	{ tag: t.squareBracket, color: '#6e7781' },
	{ tag: t.keyword, color: '#cf222e', fontWeight: '600' },
	{ tag: t.className, color: '#8250df', fontWeight: '600' },
	{ tag: t.propertyName, color: '#0550ae' },
	{ tag: t.macroName, color: '#8250df', fontWeight: '600' },
	{ tag: t.attributeName, color: '#953800' },
	{ tag: t.number, color: '#953800' },
	{ tag: t.bool, color: '#953800' },
	{ tag: t.null, color: '#0550ae' },
	{ tag: t.string, color: '#116329' },
	{ tag: t.meta, color: '#8250df', fontWeight: '600' },
	{ tag: t.controlKeyword, color: '#cf222e' },
	{ tag: t.variableName, color: '#24292f' },
	{ tag: t.standard(t.variableName), color: '#0550ae' },
	{ tag: [t.operator, t.punctuation, t.brace, t.separator], color: '#6e7781' },
	{ tag: t.invalid, color: '#b82520' }
]);

export const editorHighlighting: Extension = syntaxHighlighting(highlightStyle);

/**
 * Language for a file, picked from its extension. `.conf` is Moonraker's own
 * config, close enough to Klipper's to share the mode; anything else (`.md`,
 * `.txt`, …) is left as plain text.
 */
export function languageForFile(path: string): Extension {
	const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
	if (name.endsWith('.json')) return json();
	if (name.endsWith('.cfg') || name.endsWith('.conf')) return klipperConfigLanguage;
	return [];
}
