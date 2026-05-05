/**
 * 工作流执行策略注册表
 * 将不同工作流的节点编排实现集中管理，供 orchestrator 统一分发。
 */

import { nodes, addNode, addEdge, type WorkflowCanvasNode } from './useWorkflowCanvas'
import { MULTI_ANGLE_PROMPTS } from '../config/workflows'
import {
  WORKFLOW_TYPES,
  type MultiAngleStoryboardWorkflowParams,
  type StoryboardWorkflowParams,
  type TextToImageToVideoWorkflowParams,
  type TextToImageWorkflowParams,
  type WorkflowCanvasPosition,
  type WorkflowCharacter,
  type WorkflowExecutionContext,
  type WorkflowExecutionStrategy,
  type WorkflowIntentAnalysisResult,
  type WorkflowMultiAnglePayload,
  type WorkflowStoryboardShot,
} from './workflow-orchestrator-types'

interface CreatedStoryboardShot {
  textId: string
  configId: string
  imageId: string
}

interface MultiAnglePromptConfig {
  label: string
  english: string
  prompt: (character: string) => string
}

const isTextToImageWorkflowParams = (
  params: WorkflowIntentAnalysisResult,
): params is TextToImageWorkflowParams => params.workflow_type === WORKFLOW_TYPES.TEXT_TO_IMAGE

const isTextToImageToVideoWorkflowParams = (
  params: WorkflowIntentAnalysisResult,
): params is TextToImageToVideoWorkflowParams => params.workflow_type === WORKFLOW_TYPES.TEXT_TO_IMAGE_TO_VIDEO

const isStoryboardWorkflowParams = (
  params: WorkflowIntentAnalysisResult,
): params is StoryboardWorkflowParams => params.workflow_type === WORKFLOW_TYPES.STORYBOARD

const isMultiAngleStoryboardWorkflowParams = (
  params: WorkflowIntentAnalysisResult,
): params is MultiAngleStoryboardWorkflowParams => params.workflow_type === WORKFLOW_TYPES.MULTI_ANGLE_STORYBOARD

const readErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message
  return '未知异常'
}

const executeTextToImage = async (
  imagePrompt: string,
  position: WorkflowCanvasPosition,
  context: WorkflowExecutionContext,
) => {
  const spacing = 400
  context.addLog('info', '开始执行文生图工作流')
  context.setCurrentStep(1)
  context.setTotalSteps(2)

  const textId = addNode('text', { x: position.x, y: position.y }, { content: imagePrompt, label: '图片提示词' })
  const configId = addNode('imageConfig', { x: position.x + spacing, y: position.y }, { label: '文生图', autoExecute: true })
  addEdge({ source: textId, target: configId, sourceHandle: 'right', targetHandle: 'left', type: 'promptOrder', data: { promptOrder: 1 } })

  context.addLog('success', '文生图工作流已启动')
  return { textId, configId }
}

const executeTextToImageToVideo = async (
  imagePrompt: string,
  videoPrompt: string,
  position: WorkflowCanvasPosition,
  context: WorkflowExecutionContext,
) => {
  const spacing = 400
  context.addLog('info', '开始执行文生图生视频工作流')
  context.setCurrentStep(1)
  context.setTotalSteps(5)

  const imageTextId = addNode('text', { x: position.x, y: position.y }, { content: imagePrompt, label: '图片提示词' })
  const videoTextId = addNode('text', { x: position.x, y: position.y + 200 }, { content: videoPrompt, label: '视频提示词' })
  const imageConfigId = addNode('imageConfig', { x: position.x + spacing, y: position.y }, { label: '文生图', autoExecute: true })
  addEdge({ source: imageTextId, target: imageConfigId, sourceHandle: 'right', targetHandle: 'left', type: 'promptOrder', data: { promptOrder: 1 } })

  try {
    context.addLog('info', '等待图片生成完成...')
    const imageNodeId = await context.waitForConfigComplete(imageConfigId)
    await context.waitForOutputReady(imageNodeId)

    const imageNode = nodes.value.find((item): item is WorkflowCanvasNode => item.id === imageNodeId)
    const videoX = (imageNode?.position?.x || position.x + spacing) + spacing

    const videoConfigId = addNode('videoConfig', { x: videoX, y: position.y + 200 }, { label: '图生视频', autoExecute: true })
    addEdge({ source: videoTextId, target: videoConfigId, sourceHandle: 'right', targetHandle: 'left', type: 'promptOrder', data: { promptOrder: 1 } })
    addEdge({ source: imageNodeId, target: videoConfigId, sourceHandle: 'right', targetHandle: 'left', type: 'imageRole', data: { imageRole: 'first_frame_image' } })

    context.addLog('success', '文生图生视频工作流已启动')
    return { imageTextId, videoTextId, imageConfigId, imageNodeId, videoConfigId }
  } catch (error: unknown) {
    context.addLog('error', `工作流执行失败: ${readErrorMessage(error)}`)
    throw error
  }
}

const executeStoryboard = async (
  character: WorkflowCharacter,
  shots: WorkflowStoryboardShot[],
  position: WorkflowCanvasPosition,
  context: WorkflowExecutionContext,
) => {
  const spacing = 400
  const rowSpacing = 250
  const shotCount = shots?.length || 0
  context.addLog('info', `开始执行分镜工作流: ${character?.name || '未知角色'}, ${shotCount} 个分镜`)
  context.setCurrentStep(1)
  context.setTotalSteps(2 + shotCount * 2)

  try {
    const characterDescription = `${character?.name || '角色'}: ${character?.description || ''}`
    const characterTextId = addNode('text', { x: position.x, y: position.y }, { content: characterDescription, label: `角色: ${character?.name || '参考'}` })
    const characterConfigId = addNode('imageConfig', { x: position.x + spacing, y: position.y }, { label: '角色参考图', autoExecute: true })
    addEdge({ source: characterTextId, target: characterConfigId, sourceHandle: 'right', targetHandle: 'left', type: 'promptOrder', data: { promptOrder: 1 } })

    context.addLog('info', '等待角色参考图生成...')
    const characterImageId = await context.waitForConfigComplete(characterConfigId)
    await context.waitForOutputReady(characterImageId)
    context.addLog('success', '角色参考图已生成')

    const createdShots: CreatedStoryboardShot[] = []
    for (let index = 0; index < shotCount; index += 1) {
      const shot = shots[index]
      const shotY = position.y + (index + 1) * rowSpacing
      context.setCurrentStep(3 + index * 2)

      const shotTextId = addNode('text', { x: position.x, y: shotY }, { content: shot.prompt, label: `分镜${index + 1}: ${shot.title}` })
      const shotConfigId = addNode('imageConfig', { x: position.x + spacing, y: shotY }, { label: `分镜${index + 1}`, autoExecute: true })
      addEdge({ source: shotTextId, target: shotConfigId, sourceHandle: 'right', targetHandle: 'left', type: 'promptOrder', data: { promptOrder: 1 } })
      addEdge({ source: characterImageId, target: shotConfigId, sourceHandle: 'right', targetHandle: 'left', type: 'imageOrder', data: { imageOrder: 1 } })

      context.addLog('info', `等待分镜${index + 1}生成...`)
      const shotImageId = await context.waitForConfigComplete(shotConfigId)
      await context.waitForOutputReady(shotImageId)
      context.addLog('success', `分镜${index + 1}已生成`)
      createdShots.push({ textId: shotTextId, configId: shotConfigId, imageId: shotImageId })
    }

    context.addLog('success', `分镜工作流完成，共生成 ${shotCount} 个分镜`)
    return { characterTextId, characterConfigId, characterImageId, shots: createdShots }
  } catch (error: unknown) {
    context.addLog('error', `分镜工作流执行失败: ${readErrorMessage(error)}`)
    throw error
  }
}

const executeMultiAngleStoryboard = async (
  multiAngle: WorkflowMultiAnglePayload,
  position: WorkflowCanvasPosition,
  context: WorkflowExecutionContext,
) => {
  const spacing = 400
  const rowSpacing = 300
  const characterDescription = multiAngle?.character_description || ''
  const angles = ['front', 'side', 'back', 'top']

  context.addLog('info', '开始执行多角度分镜工作流')
  context.setCurrentStep(1)
  context.setTotalSteps(2 + angles.length * 2)

  try {
    const characterImageId = addNode('image', { x: position.x, y: position.y }, { url: '', label: '主角色图（请上传）' })
    const createdAngles: Array<{ key: string; textId: string; configId: string }> = []
    const angleX = position.x + spacing + 100

    for (let index = 0; index < angles.length; index += 1) {
      const key = angles[index]
      const config = MULTI_ANGLE_PROMPTS[key] as MultiAnglePromptConfig
      const angleY = position.y + index * rowSpacing

      const textId = addNode('text', { x: angleX, y: angleY }, { content: config.prompt(characterDescription), label: `${config.label}提示词` })
      const configId = addNode('imageConfig', { x: angleX + spacing, y: angleY }, { label: `${config.label} (${config.english})` })
      addEdge({ source: textId, target: configId, sourceHandle: 'right', targetHandle: 'left', type: 'promptOrder', data: { promptOrder: 1 } })
      addEdge({ source: characterImageId, target: configId, sourceHandle: 'right', targetHandle: 'left', type: 'imageOrder', data: { imageOrder: 1 } })

      createdAngles.push({ key, textId, configId })
    }

    context.addLog('success', '多角度分镜工作流已创建，请上传主角色图后点击各节点的"立即生成"按钮')
    return { characterImageId, angles: createdAngles }
  } catch (error: unknown) {
    context.addLog('error', `多角度分镜工作流执行失败: ${readErrorMessage(error)}`)
    throw error
  }
}

export const workflowExecutionStrategies: WorkflowExecutionStrategy[] = [
  {
    key: WORKFLOW_TYPES.MULTI_ANGLE_STORYBOARD,
    execute: (params, position, context) => {
      if (!isMultiAngleStoryboardWorkflowParams(params)) {
        throw new Error('工作流参数与多角度分镜策略不匹配')
      }
      return executeMultiAngleStoryboard(params.multi_angle, position, context)
    },
  },
  {
    key: WORKFLOW_TYPES.STORYBOARD,
    execute: (params, position, context) => {
      if (!isStoryboardWorkflowParams(params)) {
        throw new Error('工作流参数与分镜策略不匹配')
      }
      return executeStoryboard(params.character, params.shots, position, context)
    },
  },
  {
    key: WORKFLOW_TYPES.TEXT_TO_IMAGE_TO_VIDEO,
    execute: (params, position, context) => {
      if (!isTextToImageToVideoWorkflowParams(params)) {
        throw new Error('工作流参数与文生图生视频策略不匹配')
      }
      return executeTextToImageToVideo(params.image_prompt, params.video_prompt, position, context)
    },
  },
  {
    key: WORKFLOW_TYPES.TEXT_TO_IMAGE,
    execute: (params, position, context) => {
      if (!isTextToImageWorkflowParams(params)) {
        throw new Error('工作流参数与文生图策略不匹配')
      }
      return executeTextToImage(params.image_prompt, position, context)
    },
  },
]

export const getWorkflowExecutionStrategy = (workflowType?: string): WorkflowExecutionStrategy => {
  const normalizedWorkflowType = String(workflowType || '').trim().toLowerCase()
  return workflowExecutionStrategies.find(strategy => strategy.key === normalizedWorkflowType)
    || workflowExecutionStrategies.find(strategy => strategy.key === WORKFLOW_TYPES.TEXT_TO_IMAGE)!
}
