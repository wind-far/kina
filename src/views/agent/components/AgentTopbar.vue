<template>
  <header class="agent-topbar">
    <div class="agent-topbar-title">Canana Agent</div>
    <div class="agent-topbar-actions">
      <button class="agent-topbar-button" type="button">时间</button>
      <button class="agent-topbar-button" type="button">生成结果</button>
      <button class="agent-topbar-button" type="button">操作类型</button>
    </div>
  </header>
</template>

<style scoped>
.agent-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: min(920px, 100%);
  margin: 0 auto;
}

.agent-topbar-title {
  color: rgba(255, 255, 255, 0.88);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 0;
}

.agent-topbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.agent-topbar-button {
  height: 30px;
  padding: 0 11px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.62);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease;
}

.agent-topbar-button:hover {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.78);
}
</style>
