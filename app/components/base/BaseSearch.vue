<template>
    <UTooltip :delay-duration="0" :text="$t('common.search') as string">
        <UButton @click="handleClick" color="neutral" variant="ghost" icon="i-tabler:search"></UButton>
    </UTooltip>

</template>
<script lang="ts" setup>
const handleClick = () => {
    console.log('13213');
}

</script>
