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
  const getById = await $trpc.sysUser.getById.query('1')
  console.log( getById)
  console.log(getById.nickname)
  await $trpc.sysUser.create.mutate({
    id:'333',
    username: 'testuser001',
    password: 'password123',
    email: 'test@example.com',
    nickname: 'TestUser',
    phone: '13800138000',
    status: 1
  })
}
</script>
