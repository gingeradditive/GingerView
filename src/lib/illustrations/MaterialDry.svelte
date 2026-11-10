<script lang="ts">
	// Materiale asciutto: un quadrante dell'umidità con la lancetta tutta verso "secco"
	// (a sinistra, dove l'arco è rosso), lontana dalla goccia di "umido" a destra.
	const cx = 120;
	const cy = 140;
	const at = (r: number, deg: number) => {
		const a = (deg * Math.PI) / 180;
		return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
	};
	const [dx0, dy0] = at(56, 180);
	const [dx1, dy1] = at(56, 120);
	const [nx, ny] = at(50, 165);
</script>

<svg class="gv-illu bold" viewBox="0 0 240 200" aria-hidden="true">
	<ellipse class="bg" cx="120" cy="106" rx="104" ry="86" />
	<path class="sf" d="M48 140 A72 72 0 0 1 192 140 Z" />
	<rect class="sf-gray" x="40" y="140" width="160" height="16" rx="6" />
	<path class="ln-accent" d="M{dx0} {dy0} A56 56 0 0 1 {dx1} {dy1}" />
	<path
		class="ln-detail"
		transform="translate(168 118)"
		d="M0 -11 C6 -3 9 1 9 5 A9 9 0 0 1 -9 5 C-9 1 -6 -3 0 -11 Z"
	/>
	<line class="ln" x1={cx} y1={cy} x2={nx} y2={ny} />
	<circle class="dark" {cx} {cy} r="8" />
	<g transform="translate(184 70)">
		<circle class="ok" r="18" />
		<path class="ok-mark" d="M-8 0.5 L-2.5 6 L8.5 -6" />
	</g>
</svg>
