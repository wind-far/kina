<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="lv-modal-wrapper lv-modal-wrapper-align-center qrCodeModal-wICnaZ commerceModal-xQfKL9"
      @click.self="closeModal"
    >
      <div class="lv-modal-mask" @click="closeModal"></div>
      <div role="dialog" aria-modal="true" class="lv-modal lv-modal-closable">
        <div class="lv-modal-header sf-hidden"></div>
        <div class="lv-modal-content">
          <div class="qrCodeContainer-PHfrhM">
            <div class="modalTitle-P5DcnG">扫码支付<span>{{ amountText }}</span>元</div>
            <div class="wrapper-y8IP35">
              <div class="qrcode-wrapper-g0iTB8">
                <div class="qrcode-gq6HB7" style="background:none">
                  <div class="container-bbbsvQ qrcode-img-_pA78x qrcode-img-top-oCDxyx qrcode-hide-ZacgyM">
                    <div style="transition:opacity 300ms;opacity:1"></div>
                  </div>
                  <div class="container-bbbsvQ qrcode-img-_pA78x">
                    <div style="transition:opacity 300ms;opacity:1">
                      <img
                        draggable="false"
                        data-apm-action="qrcode-img-_pA78x"
                        alt="qr_code_cover_url"
                        fetchpriority="high"
                        loading="lazy"
                        class="image-eTuIBd"
                        :src="resolvedQrCodeUrl"
                      >
                    </div>
                  </div>
                  <div class="mask-pl1iri">
                    <div class="locked-mask-bLniXk">
                      <div class="agreementF-hQMJXp">支付前请阅读</div>
                      <a
                        :href="agreementHref"
                        class="agreementS-AEjIg_"
                        :target="isExternalAgreement ? '_blank' : undefined"
                        rel="noreferrer"
                      >
                        {{ agreementLabel }}
                      </a>
                      <button
                        class="mweb-button-default mweb-button-mOrK7U agreement-button-FtNiZx"
                        type="button"
                        :disabled="submitting"
                        @click="emitConfirm"
                      >
                        <span style="width:inherit">{{ submitting ? '支付中...' : '同意并支付' }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="pay-text-VhDoIR">
                请扫码完成支付
                <div class="container-bbbsvQ pay-png-c0Civc">
                  <div style="transition:opacity 300ms;opacity:1">
                    <img
                      draggable="false"
                      data-apm-action="pay-png-c0Civc"
                      alt="zhifubao_cover_url"
                      fetchpriority="high"
                      loading="lazy"
                      class="image-eTuIBd"
                      :src="resolvedPayIconUrl"
                    >
                  </div>
                </div>
              </div>
            </div>
            <div class="agreementPrivacy-geWxYy">
              <span></span>
              <a
                :href="agreementHref"
                :target="isExternalAgreement ? '_blank' : undefined"
                rel="noreferrer"
              >
                {{ agreementLabel }}
              </a>
            </div>
          </div>
        </div>
        <span class="lv-modal-close-icon" role="button" tabindex="0" aria-label="关闭扫码支付弹窗" @click="closeModal" @keydown.enter.prevent="closeModal" @keydown.space.prevent="closeModal">
          <svg width="1em" height="1em" viewBox="0 0 16 16" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="closeBtn-H0fiJm" aria-hidden="true">
            <g>
              <g data-follow-fill="currentColor" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor">
                <path d="M12.32 13.098a.333.333 0 0 1-.471 0L2.902 4.15a.333.333 0 0 1 0-.471l.778-.778c.13-.13.34-.13.471 0l8.947 8.947c.13.13.13.341 0 .471l-.778.778Z"></path>
                <path d="M3.68 13.098c.13.13.34.13.471 0l8.947-8.947a.333.333 0 0 0 0-.471l-.778-.778a.333.333 0 0 0-.471 0L2.902 11.85a.333.333 0 0 0 0 .471l.778.778Z"></path>
              </g>
            </g>
          </svg>
        </span>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import './ScanPayModal.css'

const DEFAULT_QR_CODE_URL = 'data:image/png;base64,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'
const DEFAULT_PAY_ICON_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAASLSURBVHgB7VdpaBxVHP+9mdl712azNmmb08SjNtp4EZSW2GKEUisoGKNfbBUrooIFFcSaGMQP4oltFS2FpiAoifpB8KiKGrQaolUxkTQlpGmJNUn3SJpuZ3fneP5nNnslu9l1TT61v50Z3pv33v9+v3kLXOhguQY6O7nQee3ZJmj6WhQtnSt2zsYj93p7c07J9lLoDnRwxp7kHKVYEvDTpOlNtPpey2uA2DO9X+P6TiwDRM4PaG2+DNlCRufj0FMalke5AY2xh4Wemfb0dxkRYN3BcQ5UoADcXcGwvoRmQ8f3kxy9frGQZWAMQf6XdyU6mW70pcSA9MmZW1W1MOUG2qptaKt0mO3n9WkygBe0zqgrS81YkwL0Gf1kClRNrESRYLk3U1YoLk9yZ0kp03TLvJLAWg9HW5WIRHANHznjZuOaS1JzN5dJkJhqJlQwAmvOYcaFPSM6AjHkhIRFIDEBXqsNieCm++kQUwY4BAklViGrDEGIzplehAGDZzl2/SFnHVvtcKDOZTHbn09E8NKQGR/8V0j5JpTbgTcajWJjGfJvLk0tvYeK8eoVOtJjNBZWsHtAySc+vwFRDfhqkh6knSWedH09paS/MW3bUWvFppVWc92+ETX5/n8ZME1OHBqL5ZtGyjg6GpxzPY7ucaWghEiLiWzyCdhaJqLWLZpCIxrD8VkFv4V0DM1qmIwKSPi4bY0Fdc54CvqCMfwwpZusU5QBVS4B+6634c7VNiAZ5oQwu6lSpefPlIbv/Co+Ox3D01fak+vfHomRblZcBASiqm+a3fDLMWzvC+MLUhKIcGIIjoYSCTd4BeIGG1rKrWgui98d65zJ9SdlDR+MRYkDCqPmBQa0Vlswq2jYciSKWZWb3GmEUqMI/Dmjm3fXmIoap4wHqkXsrLNRxCzJ9TUOEcN3eHF4IoaDozKOzsTTxHOEYwF7bF0l4dVjpFzhc+nNnseT53W8OxqDzBeO17tEPFbvwC+3l2J0iwt7KZ23XSoSYenIGwGiLrik/MWzxs7w6UYPrnDHRbwyFMbAOY5H66zY4LMm59W6LXjcuOuBAO3p32c4+v0ydifUzRd8mAqqvcGOWmd2amUUy23lwJHNbtzolcz4vDgYxrNEOu9TajZ+G8Z1XwbRdUJGUMn02GcT0ULfjefWeVLykq1u/w6y56BEH5L+Fjd8FIVDp6LondIwToXlpv5NVIT3UY00UwEK9POTR+2DMt47oWTNcSXtprtWidh1lZNom6V/NR+kXdKV1QCj6aWaer3Rju2X2UnN/HRw8ozjnWEZe6gGzsSQl+4MCbf4GJ64nLZ2BW1t+dz9Hs+KD42x1IFEDg2rDp/ZDhH7PfRrBC8fl7GBvG4k3ndLIk6dV3E0pOJHOnzMKJncvxgM+34KcLojqHbGsN4Wmkg3bm4WnYM/CvmX7iScA4yP0+m4KtFNVRpjZAF7C8sOMUPHghgKPYH9OmfLczJm/AB5n/tYbkBv9T0CSXiGmPxvLI1W4xeEwF6Yrzw+ugiknn82qbBVELFbUCxE/RgG9vbTfz0dF5EF/wJaSZkpLpQGOQAAAABJRU5ErkJggg=='

const props = withDefaults(defineProps<{
  visible: boolean
  amount: number | string
  qrCodeUrl?: string
  payIconUrl?: string
  agreementHref?: string
  agreementLabel?: string
  submitting?: boolean
}>(), {
  qrCodeUrl: '',
  payIconUrl: '',
  agreementHref: '/policies/user-agreement',
  agreementLabel: '《付费服务协议（含自动续费条款）》',
  submitting: false,
})

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'confirm'): void
}>()

// 统一格式化金额，保证弹窗标题始终贴近原稿展示。
const amountText = computed(() => {
  const numeric = Number(props.amount || 0)
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2)
})

const resolvedQrCodeUrl = computed(() => String(props.qrCodeUrl || '').trim() || DEFAULT_QR_CODE_URL)
const resolvedPayIconUrl = computed(() => String(props.payIconUrl || '').trim() || DEFAULT_PAY_ICON_URL)
const agreementHref = computed(() => String(props.agreementHref || '').trim() || '/policies/user-agreement')
const agreementLabel = computed(() => String(props.agreementLabel || '').trim() || '《付费服务协议（含自动续费条款）》')
const isExternalAgreement = computed(() => /^https?:\/\//i.test(agreementHref.value))

const closeModal = () => {
  if (props.submitting) {
    return
  }
  emit('update:visible', false)
}

const emitConfirm = () => {
  if (props.submitting) {
    return
  }
  emit('confirm')
}
</script>
