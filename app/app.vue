<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtWelcome />
    <button @click="click">click</button>
  </div>
</template>
<script setup lang="ts">
const { $trpc } = useNuxtApp()
const click = async () =>{
  const res = await $trpc.sysUser.test.mutate()
  console.log( res)
}
</script>
