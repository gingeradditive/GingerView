<script lang="ts">
	import DashboardPrintJobPanel from '$lib/components/DashboardPrintJobPanel.svelte';
	import DashboardQuickActionsPanel from '$lib/components/DashboardQuickActionsPanel.svelte';
	import DashboardTemperaturePanel from '$lib/components/DashboardTemperaturePanel.svelte';
	import DashboardZHeightPanel from '$lib/components/DashboardZHeightPanel.svelte';
	import DashboardFlowPanel from '$lib/components/DashboardFlowPanel.svelte';
	import DashboardPelletPanel from '$lib/components/DashboardPelletPanel.svelte';
</script>

<div class="dashboard-container">
	<div class="dashboard">
		<div class="panel panel-printjob">
			<DashboardPrintJobPanel />
		</div>
		<div class="panel panel-actions">
			<DashboardQuickActionsPanel />
		</div>
		<div class="panel panel-temps">
			<DashboardTemperaturePanel />
		</div>
		<div class="panel panel-zheight">
			<DashboardZHeightPanel />
		</div>
		<div class="panel panel-flow">
			<DashboardFlowPanel />
		</div>
		<div class="panel panel-pellet">
			<DashboardPelletPanel />
		</div>
	</div>
</div>

<style>
	.dashboard-container {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100vh;
		padding-bottom: 100px;
		box-sizing: border-box;
	}

	.dashboard {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		grid-template-rows: auto auto;
		gap: 36px;
		padding: 16px;
		box-sizing: border-box;
		width: 100%;
		max-width: 1138px;
		max-height: 683px;
	}

	.panel {
		min-width: 0;
	}

	/* Row 1: PrintJob (3 cols) | QuickActions (1 col) | Temperature (2 cols, spans 2 rows) */
	.panel-printjob {
		grid-column: 1 / 4;
		grid-row: 1;
	}

	.panel-actions {
		grid-column: 4;
		grid-row: 1;
	}

	.panel-temps {
		grid-column: 5 / 7;
		grid-row: 1 / 3;
	}

	/* Row 2: ZHeight (1 col) | Flow (2 cols) | Pellet (1 col) */
	.panel-zheight {
		grid-column: 1;
		grid-row: 2;
	}

	.panel-flow {
		grid-column: 2 / 4;
		grid-row: 2;
	}

	.panel-pellet {
		grid-column: 4;
		grid-row: 2;
	}

	/* Desktop: keep 6-column layout */
	@media (min-width: 900px) {
		.dashboard {
			grid-template-columns: repeat(6, 1fr);
			grid-template-rows: auto auto;
		}
	}

	/* Tablet / narrow: stack vertically */
	@media (max-width: 640px) {
		.dashboard {
			grid-template-columns: 1fr 1fr;
			grid-template-rows: auto auto auto auto;
		}

		.panel-printjob {
			grid-column: 1 / 3;
			grid-row: 1;
		}

		.panel-actions {
			grid-column: 1;
			grid-row: 2;
		}

		.panel-temps {
			grid-column: 2;
			grid-row: 2 / 4;
		}

		.panel-zheight {
			grid-column: 1;
			grid-row: 3;
		}

		.panel-flow {
			grid-column: 1;
			grid-row: 4;
		}

		.panel-pellet {
			grid-column: 2;
			grid-row: 4;
		}
	}
</style>
