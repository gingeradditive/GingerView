<script lang="ts">
	// CodeMirror 6 wrapper for the config editor: line numbers, undo/redo, search
	// (Mod-f), bracket matching and the Klipper `.cfg` highlighting. CodeMirror
	// owns its DOM, so the document is kept in sync by hand rather than with
	// `bind:value` — see the effect below.
	import { onMount } from 'svelte';
	import { basicSetup } from 'codemirror';
	import { Compartment, EditorState, type Extension } from '@codemirror/state';
	import { EditorView, keymap } from '@codemirror/view';
	import { indentWithTab } from '@codemirror/commands';
	import { indentUnit } from '@codemirror/language';
	import { editorHighlighting, languageForFile } from '$lib/editor/klipper-config-language';

	let {
		value = $bindable(''),
		path = '',
		readOnly = false
	}: {
		value?: string;
		/** Drives the language mode, and tells a new document from an edit. */
		path?: string;
		readOnly?: boolean;
	} = $props();

	/** Klipper's own configs are indented four spaces; Mainsail matches this too. */
	const indentSize = 4;

	const editable = new Compartment();

	let host = $state<HTMLDivElement | null>(null);
	let view: EditorView | null = null;
	/**
	 * Last document the two sides agreed on. Without it every keystroke would
	 * bounce back from the effect below as a full-document replacement, dropping
	 * the cursor to the end of the file.
	 */
	let synced = '';
	let currentPath = '';

	const theme = EditorView.theme({
		'&': {
			height: '100%',
			fontSize: '0.82rem',
			backgroundColor: 'var(--color-background)',
			color: 'var(--color-text-secondary)'
		},
		'&.cm-focused': { outline: 'none', backgroundColor: 'var(--color-white)' },
		'.cm-scroller': {
			fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
			lineHeight: '1.55'
		},
		'.cm-content': { padding: '12px 0' },
		'.cm-gutters': {
			backgroundColor: 'transparent',
			border: 'none',
			color: 'var(--color-gray-light)',
			paddingRight: '4px'
		},
		'.cm-activeLine': { backgroundColor: 'rgba(var(--rgb-black), 0.03)' },
		'.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-text-subtle)' },
		'.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
			backgroundColor: 'rgba(var(--rgb-red), 0.12)'
		},
		'.cm-cursor': { borderLeftColor: 'var(--color-red)', borderLeftWidth: '2px' },
		'.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
			backgroundColor: 'rgba(var(--rgb-red), 0.08)',
			outline: '1px solid rgba(var(--rgb-red), 0.33)'
		},
		'.cm-panels': { backgroundColor: 'var(--color-background)', color: 'var(--color-text-muted)' },
		'.cm-panels input, .cm-panels button': { fontFamily: 'inherit' }
	});

	function extensions(filePath: string): Extension[] {
		return [
			basicSetup,
			// Tab indents instead of moving focus: the editor fills the pane, so
			// leaving it by accident is worse than losing the tab-out shortcut.
			keymap.of([indentWithTab]),
			indentUnit.of(' '.repeat(indentSize)),
			EditorState.tabSize.of(indentSize),
			theme,
			editorHighlighting,
			languageForFile(filePath),
			editable.of(EditorState.readOnly.of(readOnly)),
			EditorView.updateListener.of((update) => {
				if (!update.docChanged) return;
				synced = update.state.doc.toString();
				value = synced;
			})
		];
	}

	function buildState(doc: string, filePath: string) {
		return EditorState.create({ doc, extensions: extensions(filePath) });
	}

	onMount(() => {
		currentPath = path;
		synced = value;
		view = new EditorView({ parent: host!, state: buildState(value, path) });
		return () => {
			view?.destroy();
			view = null;
		};
	});

	$effect(() => {
		const doc = value;
		const filePath = path;
		if (!view) return;

		// A different file is a different document: rebuild so the undo history and
		// the scroll position do not carry over from the previous one.
		if (filePath !== currentPath) {
			currentPath = filePath;
			synced = doc;
			view.setState(buildState(doc, filePath));
			return;
		}
		// Same file, changed from the outside (revert, reload): replace the text but
		// keep the editor as it is.
		if (doc !== synced) {
			synced = doc;
			view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc } });
		}
	});

	$effect(() => {
		view?.dispatch({ effects: editable.reconfigure(EditorState.readOnly.of(readOnly)) });
	});
</script>

<div class="code-editor" bind:this={host}></div>

<style>
	.code-editor {
		flex: 1;
		min-height: 0;
		min-width: 0;
		overflow: hidden;
	}
</style>
