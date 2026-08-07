export type WorkflowVideoFeature = 'all-reference' | 'first-last-frame' | 'smart-multi-frame'

/**
 * 将输入栏里的参考图顺序映射成视频接口约定的 FormData 字段。
 * 首尾帧模式只把前两张图声明为首帧/尾帧，其余图片继续作为普通参考图。
 */
export const resolveWorkflowVideoReferenceRole = (
  feature: WorkflowVideoFeature | undefined,
  referenceIndex: number,
) => {
  if (feature === 'all-reference') return 'input_reference'
  if (referenceIndex === 0) return 'first_frame_image'
  if (feature === 'first-last-frame' && referenceIndex === 1) return 'last_frame_image'
  return 'input_reference'
}
