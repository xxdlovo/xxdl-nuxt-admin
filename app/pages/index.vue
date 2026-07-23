<template>
  <!-- <div class="flex w-80 h-20 bg-red-200"> -->
  <UContainer>
    <Placeholder class="h-82" />
    <UButton @click="gotoUrl">后台</UButton>
    <UColorModeSwitch >前后</UColorModeSwitch>
  </UContainer>

  <!-- </div> -->
</template>

<script lang="ts" setup>
const gotoUrl = async ()=>{
  await navigateTo('/system/home')
}
</script>

<style>

</style>
