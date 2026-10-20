// 按小时选择问候文本的纯辅助函数，不自行决定认证页面是否显示问候。
// Pure hour-based greeting helper; it does not decide whether auth pages render greetings.
export function getLoginGreeting(hour: number) {
  if (hour >= 5 && hour < 11) return "早安，书房已经替你开灯啦。";
  if (hour >= 11 && hour < 18) return "午安，忙里偷闲翻两页吧。";
  return "晚安，今晚想和哪本书见面？";
}
