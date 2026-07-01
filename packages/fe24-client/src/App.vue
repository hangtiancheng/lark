<template>
  <main>
    <RouterView v-slot="{ Component }">
      <Suspense>
        <component :is="Component" />
        <template #fallback>
          <div
            class="flex h-screen w-screen items-center justify-center"
            v-loading="true"
          />
        </template>
      </Suspense>
    </RouterView>
  </main>
</template>
