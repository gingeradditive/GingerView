/**
 * Moves the node to <body> on mount and removes it on destroy.
 *
 * Needed for any `position: fixed` overlay (modals, dialogs) that can end up
 * nested inside the Embla carousel: Embla applies an inline `transform` to
 * the slide track, which creates a new containing block for `position: fixed`
 * descendants and makes them clip/mis-position relative to the carousel
 * instead of the real viewport.
 */
export function portal(node: HTMLElement) {
	document.body.appendChild(node);
	return {
		destroy() {
			node.remove();
		}
	};
}
