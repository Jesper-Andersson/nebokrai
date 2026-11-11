<!-- A page's title and description, as browsers, search results and link
     previews (the og: lines) show them. Every page has one. What is the same
     on all pages, such as the canonical address, is in routes/+layout.svelte.
     The strings come from `meta` in i18n.ts. -->
<script lang="ts">
	let { title, description }: { title: string; description: string } = $props();
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
</svelte:head>
