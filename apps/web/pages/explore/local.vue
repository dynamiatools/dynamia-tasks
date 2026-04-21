<script setup lang="ts">
// Local connector has no hasExplorer, so we redirect to a flat task list
// by using "local" as both connectorId and sourceId (server ignores sourceId for local)
const router = useRouter()
onMounted(() => {
  router.replace('/explore/local/local')
})
</script>
<template><div>redirecting...</div></template>

