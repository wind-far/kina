<template>
  <div v-if="visible" class="container-kvmiPn">
    <div class="preview-area-TnDJHN">
      <div class="container-T1jCWT">
        <div class="preview-area-QscVpt">
          <div class="image-player-KCJSe1">
            <div class="image-player-container-V9ZRXE">
              <div class="image-player-content-Ml9sbe">
                <img
                  v-if="currentImage"
                  class="image-player-image-_Tib2c"
                  :src="currentImage.src"
                  :alt="currentImage.id"
                >
              </div>
            </div>

            <div class="image-player-navigation-mJIQnd">
              <div class="container-H3ng83">
                <button
                  class="arrow-container-UvRNxR"
                  :disabled="internalIndex === 0"
                  type="button"
                  @click="prevImage"
                >
                  <svg
                    width="1em"
                    height="1em"
                    viewBox="0 0 24 24"
                    preserveAspectRatio="xMidYMid meet"
                    fill="none"
                    role="presentation"
                    xmlns="http://www.w3.org/2000/svg"
                    class="arrow-qw6CEe"
                    :class="{ 'disabled-Zss3dM': internalIndex === 0 }"
                  >
                    <g>
                      <path
                        data-follow-fill="currentColor"
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M6.26 12.844a1.2 1.2 0 0 1 0-1.688L14.321 3a1.2 1.2 0 0 1 1.707 1.687L8.801 12l7.227 7.313A1.2 1.2 0 0 1 14.321 21l-8.06-8.156Z"
                        fill="currentColor"
                      />
                    </g>
                  </svg>
                </button>
                <span class="page-number-Zjog_T">
                  <span class="num-BCKBO0">{{ internalIndex + 1 }}</span>
                  <span>/</span>
                  <span class="num-BCKBO0">{{ totalImages }}</span>
                </span>
                <button
                  class="arrow-container-UvRNxR"
                  :disabled="internalIndex === totalImages - 1"
                  type="button"
                  @click="nextImage"
                >
                  <svg
                    width="1em"
                    height="1em"
                    viewBox="0 0 24 24"
                    preserveAspectRatio="xMidYMid meet"
                    fill="none"
                    role="presentation"
                    xmlns="http://www.w3.org/2000/svg"
                    class="arrow-qw6CEe"
                    :class="{ 'disabled-Zss3dM': internalIndex === totalImages - 1 }"
                  >
                    <g>
                      <path
                        data-follow-fill="currentColor"
                        d="M17.74 12.844a1.2 1.2 0 0 0 0-1.688L9.678 3A1.2 1.2 0 1 0 7.97 4.687L15.2 12l-7.23 7.313A1.2 1.2 0 1 0 9.68 21l8.06-8.156Z"
                        fill="currentColor"
                      />
                    </g>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="operation-area-EihPQ7">
      <div class="switch-area-AKmr_H">
        <button class="collapse-button-L4UIFa operation-icon-w5Y4Pg" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
            <g>
              <path
                data-follow-fill="currentColor"
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M21.01 16.018a1.2 1.2 0 0 0-.01-1.697l-8.156-8.06a1.2 1.2 0 0 0-1.688 0L3 14.32a1.2 1.2 0 0 0 1.687 1.707L12 8.801l7.313 7.227a1.2 1.2 0 0 0 1.697-.01Z"
                fill="currentColor"
              />
            </g>
          </svg>
        </button>
        <button class="collapse-button-L4UIFa operation-icon-w5Y4Pg" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
            <g>
              <path
                data-follow-fill="currentColor"
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M21.01 7.982A1.2 1.2 0 0 1 21 9.679l-8.156 8.06a1.2 1.2 0 0 1-1.688 0L3 9.68a1.2 1.2 0 0 1 1.687-1.707L12 15.199l7.313-7.227a1.2 1.2 0 0 1 1.697.01Z"
                fill="currentColor"
              />
            </g>
          </svg>
        </button>
      </div>

      <button class="close-button-PTpYOA operation-icon-w5Y4Pg" type="button" @click="closePreview">
        <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
          <g>
            <path
              data-follow-fill="currentColor"
              d="M19.579 6.119a1.2 1.2 0 0 0-1.697-1.698L12 10.303 6.12 4.422a1.2 1.2 0 1 0-1.697 1.697L10.303 12l-5.881 5.882a1.2 1.2 0 0 0 1.697 1.697L12 13.698l5.882 5.882a1.2 1.2 0 1 0 1.697-1.697L13.697 12l5.882-5.882Z"
              clip-rule="evenodd"
              fill-rule="evenodd"
              fill="currentColor"
            />
          </g>
        </svg>
      </button>
    </div>

    <div class="detail-area-mylLyv">
      <div class="container-LTKJ3M">
        <div class="operation-area-uoDdSN">
          <div class="publish-button-jPQ6gf">
            <button class="lv-btn lv-btn-secondary lv-btn-size-default lv-btn-shape-square left-button-IpJMp_ preview-text-button" type="button" @click="handleDownload">
              <div class="icon-wrapper-H4Qy6w">
                <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                  <g>
                    <path
                      data-follow-fill="currentColor"
                      d="M12 2a1 1 0 0 1 1 1v10.312l4.023-4.021a1 1 0 0 1 1.414 1.414l-5.73 5.728a1 1 0 0 1-1.414 0l-5.73-5.728A1 1 0 1 1 6.977 9.29L11 13.312V3a1 1 0 0 1 1-1ZM3 20.002a1 1 0 0 1 1-1L20 19a1 1 0 0 1 0 2l-16 .002a1 1 0 0 1-1-1Z"
                      clip-rule="evenodd"
                      fill-rule="evenodd"
                      fill="currentColor"
                    />
                  </g>
                </svg>
              </div>
              <span>下载</span>
            </button>
          </div>

          <div class="operation-buttons-ita9Ow">
            <div class="operation-button-pTosuC">
              <button class="icon-wrapper-SP2zJN" type="button" @click="handleFavorite">
                <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                  <g>
                    <path
                      data-follow-fill="currentColor"
                      d="M9.893 7.177 12 3.787l2.107 3.39a3 3 0 0 0 1.829 1.329l3.874.956-2.572 3.052a3 3 0 0 0-.698 2.15l.287 3.98-3.697-1.503a3 3 0 0 0-2.26 0l-3.697 1.503.287-3.98a3 3 0 0 0-.698-2.15L4.19 9.462l3.874-.956a3 3 0 0 0 1.829-1.329Zm1.258-5.811a1 1 0 0 1 1.698 0l2.957 4.755a1 1 0 0 0 .61.443l5.435 1.342a1 1 0 0 1 .525 1.616l-3.609 4.28a1 1 0 0 0-.232.717l.403 5.585a1 1 0 0 1-1.374.998l-5.187-2.109a1 1 0 0 0-.754 0l-5.187 2.11a1 1 0 0 1-1.374-.999l.404-5.585a1 1 0 0 0-.233-.716l-3.61-4.281a1 1 0 0 1 .526-1.616l5.436-1.342a1 1 0 0 0 .61-.443l2.956-4.755Z"
                      clip-rule="evenodd"
                      fill-rule="evenodd"
                      fill="currentColor"
                    />
                  </g>
                </svg>
              </button>
            </div>

            <div class="operation-button-pTosuC">
              <button class="icon-wrapper-SP2zJN" type="button" @click="handlePublish">
                <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                  <g>
                    <path
                      data-follow-fill="currentColor"
                      d="M17.523 8.332a1 1 0 0 1-1.415 0L13 5.223v9.357a1 1 0 1 1-2 0V5.223L7.892 8.332a1 1 0 1 1-1.415-1.415l4.816-4.815a1 1 0 0 1 1.414 0l4.816 4.816a1 1 0 0 1 0 1.414ZM4.439 14.58a1 1 0 1 0-2 0v2.35a4 4 0 0 0 4 4h11.122a4 4 0 0 0 4-4v-2.35a1 1 0 0 0-2 0v2.35a2 2 0 0 1-2 2H6.439a2 2 0 0 1-2-2v-2.35Z"
                      clip-rule="evenodd"
                      fill-rule="evenodd"
                      fill="currentColor"
                    />
                  </g>
                </svg>
              </button>
            </div>

            <div>
              <div class="operation-button-pTosuC">
                <button class="icon-wrapper-SP2zJN" type="button">
                  <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                    <g>
                      <path
                        data-follow-fill="currentColor"
                        d="M7 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm7 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm5 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
                        clip-rule="evenodd"
                        fill-rule="evenodd"
                        fill="currentColor"
                      />
                    </g>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="info-section-QOKtGr">
          <div class="ref-image-container-DCcHUl image-thumbnail-list-iZWaR8">
            <div class="scroll-container-Nuo9r_">
              <div
                v-for="(image, index) in images"
                :key="image.id"
                class="image-thumbnail-holder-au3bpp"
                :class="{ 'selected-_OYWHD': index === internalIndex }"
                @click="internalIndex = index"
              >
                <img :src="image.src" :alt="image.id">
              </div>
            </div>
          </div>

          <div class="detail-info-x1mqoZ">
            <div class="prompt-tip-hH75TU">图片提示词</div>
            <div class="prompt-value-iSLqEB">
              <div class="prompt-value-text-yJUIwx">
                <span class="prompt-value-container-lIP4pF">
                  <span>{{ currentPromptText }}</span>
                </span>
              </div>
            </div>
            <div class="prompt-tags-HZ34uU">
              <div>{{ currentModelLabel }}</div>
              <span class="divider-bogpTC"></span>
              <div>{{ currentAspectRatioLabel }}</div>
              <span class="divider-bogpTC"></span>
              <div>{{ currentResolutionLabel }}</div>
              <span class="divider-bogpTC"></span>
              <span class="more-info-label-tsxIEt">
                <span class="more-info-label-inner-n_l9zm">
                  <span class="more-info-label-Bp1woI">
                    <span class="more-info-label-text-HMW7Yo">详细信息</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="icon-G_8Owc">
                      <g>
                        <path
                          data-follow-fill="currentColor"
                          d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Zm0-2a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm0-10.3a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Zm0 7.2a1.2 1.2 0 0 0 1.2-1.2v-3.6a1.2 1.2 0 0 0-2.4 0v3.6a1.2 1.2 0 0 0 1.2 1.2Z"
                          fill="currentColor"
                        />
                      </g>
                    </svg>
                  </span>
                </span>
                <div class="more-info-mask-VNvIc5"></div>
              </span>
            </div>
          </div>
        </div>

        <div class="post-edit-buttons-X__8j8">
          <div class="container-CR8FG0">
            <div class="group-container-sx43Zo">
              <div class="group-gyYOPU">
                <div class="detail-button-view-container-sEElmO">
                  <button class="lv-btn lv-btn-secondary lv-btn-size-default lv-btn-shape-square detail-button-view-x33260" type="button" @click="handleGenerateVideo">
                    <div class="icon-f2nkjH">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                        <g>
                          <path
                            data-follow-fill="currentColor"
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M5.889 2.112A4.889 4.889 0 0 0 1 7v10a4.89 4.89 0 0 0 4.889 4.89H18.11A4.89 4.89 0 0 0 23 17V7c0-2.7-2.189-4.888-4.889-4.888H5.89ZM3 7a2.889 2.889 0 0 1 2.889-2.888H18.11A2.889 2.889 0 0 1 21 7v10a2.889 2.889 0 0 1-2.889 2.89H5.89A2.889 2.889 0 0 1 3 17V7Zm12.405 4.4c-.175-.386-.7-.68-1.75-1.269l-1.14-.638c-1.01-.565-1.515-.848-1.928-.8a1.29 1.29 0 0 0-.9.527c-.243.337-.243.916-.243 2.073v1.277c0 1.156 0 1.735.243 2.073.213.294.539.485.9.527.413.047.918-.236 1.927-.8l1.14-.64c1.051-.587 1.576-.882 1.751-1.268a1.289 1.289 0 0 0 0-1.061Z"
                            fill="currentColor"
                          />
                        </g>
                      </svg>
                    </div>
                    <div class="text-FN1TsU">生成视频</div>
                  </button>
                </div>

                <div class="detail-button-view-container-sEElmO">
                  <button class="lv-btn lv-btn-secondary lv-btn-size-default lv-btn-shape-square detail-button-view-x33260" type="button" @click="handleEditInCanvas">
                    <div class="icon-f2nkjH">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                        <g>
                          <path
                            data-follow-fill="currentColor"
                            d="M6.938 3.125a1 1 0 0 1 1 1v1.813h8.125V4.125a1 1 0 1 1 2 0v1.813h1.812a1 1 0 1 1 0 2h-1.813v2.937a1 1 0 1 1-2 0V7.937H7.938v8.125h2.938a1 1 0 1 1 0 2H7.937v1.813a1 1 0 1 1-2 0v-1.813H4.125a1 1 0 1 1 0-2h1.813V7.938H4.125a1 1 0 0 1 0-2h1.813V4.125a1 1 0 0 1 1-1Zm10.518 17.363.208-.477a3.68 3.68 0 0 1 1.871-1.898l.641-.285a.447.447 0 0 0 0-.812l-.605-.27a3.682 3.682 0 0 1-1.898-1.961l-.213-.515a.427.427 0 0 0-.794 0l-.214.515a3.682 3.682 0 0 1-1.898 1.962l-.605.269a.447.447 0 0 0 0 .812l.64.285a3.675 3.675 0 0 1 1.872 1.898l.208.477c.152.35.635.35.787 0Z"
                            clip-rule="evenodd"
                            fill-rule="evenodd"
                            fill="currentColor"
                          />
                        </g>
                      </svg>
                    </div>
                    <div class="text-FN1TsU">去画布编辑</div>
                    <div class="icon-f2nkjH">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg" class="suffix-icon-fLgyoX">
                        <g>
                          <path
                            data-follow-fill="currentColor"
                            d="M17.74 12.844a1.2 1.2 0 0 0 0-1.688L9.678 3A1.2 1.2 0 1 0 7.97 4.687L15.2 12l-7.23 7.313A1.2 1.2 0 1 0 9.68 21l8.06-8.156Z"
                            fill="currentColor"
                          />
                        </g>
                      </svg>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div class="group-container-sx43Zo">
              <div class="group-gyYOPU">
                <div class="detail-button-view-container-sEElmO">
                  <button class="lv-btn lv-btn-secondary lv-btn-size-default lv-btn-shape-square detail-button-view-x33260" type="button">
                    <div class="icon-f2nkjH">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                        <g>
                          <path
                            data-follow-fill="currentColor"
                            d="M20.75 17a1 1 0 0 1 1 1v.806a2.945 2.945 0 0 1-2.944 2.944H5.194a2.945 2.945 0 0 1-2.94-2.793l-.004-.151V18a1 1 0 0 1 1.995-.102L4.25 18v.806l.005.096c.048.476.45.848.94.848h13.61a.945.945 0 0 0 .945-.944V18a1 1 0 0 1 1-1ZM5.077 9a.5.5 0 0 1 .5.5v1.595h2.15V9.5a.5.5 0 0 1 .5-.5h.577a.5.5 0 0 1 .5.5v4.574a.5.5 0 0 1-.5.5h-.577a.5.5 0 0 1-.5-.5V12.4h-2.15v1.674a.5.5 0 0 1-.5.5H4.5a.5.5 0 0 1-.5-.5V9.5a.5.5 0 0 1 .5-.5h.577Zm8.004 0c.616 0 1.157.115 1.624.343.467.228.83.549 1.09.963.266.414.4.908.4 1.481 0 .568-.134 1.062-.4 1.482-.26.413-.623.734-1.09.962-.467.229-1.008.343-1.624.343h-2.136a.5.5 0 0 1-.5-.5V9.5a.5.5 0 0 1 .5-.5h2.136Zm6.203.787a.5.5 0 0 1 .5.5V11h.712a.5.5 0 0 1 .5.5v.576a.5.5 0 0 1-.5.5h-.712v.712a.5.5 0 0 1-.5.5h-.576a.5.5 0 0 1-.5-.5v-.712h-.712a.5.5 0 0 1-.5-.5V11.5a.5.5 0 0 1 .5-.5h.712v-.712a.5.5 0 0 1 .499-.5h.577Zm-7.262 3.53h.996c.318 0 .594-.06.828-.176a1.34 1.34 0 0 0 .557-.526 1.65 1.65 0 0 0 .199-.828c0-.324-.066-.6-.199-.828a1.284 1.284 0 0 0-.557-.518 1.767 1.767 0 0 0-.828-.183h-.997v3.058ZM18.805 2.25a2.944 2.944 0 0 1 2.944 2.944V6a1 1 0 0 1-2 0v-.806a.944.944 0 0 0-.944-.944H5.194a.944.944 0 0 0-.944.944V6a1 1 0 0 1-2 0v-.806A2.944 2.944 0 0 1 5.194 2.25h13.612Z"
                            fill="currentColor"
                          />
                        </g>
                      </svg>
                    </div>
                    <div class="text-FN1TsU">智能超清</div>
                    <div class="icon-PmuOA3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="21" height="12" fill="none" viewBox="0 0 21 12">
                        <rect width="21" height="12" fill="currentColor" rx="4"></rect>
                        <path fill="#121217" d="M7.48 8.39h-.287L4.057 4.918V8.39H3.56V3.35h.294l3.129 3.388V3.35h.497zm4.023-1.736h-2.24v.056q.028.68.238.98.224.322.735.322.532 0 1.1-.238l.055.441a3.9 3.9 0 0 1-1.35.259q-1.758 0-1.758-1.897 0-.896.441-1.393.455-.518 1.302-.518 1.477 0 1.477 1.652zM9.998 5.072q-.685 0-.735 1.225h1.358q.028-1.225-.623-1.225m6.149-.322h.994l-1.148 3.64h-.924l-.658-2.87-.61 2.87h-.937l-1.078-3.64h.98l.623 2.94.623-2.94h.889l.665 2.94z"></path>
                      </svg>
                    </div>
                  </button>
                </div>

                <div class="detail-button-view-container-sEElmO">
                  <button class="lv-btn lv-btn-secondary lv-btn-size-default lv-btn-shape-square detail-button-view-x33260" type="button">
                    <div class="icon-f2nkjH">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                        <g>
                          <path
                            data-follow-fill="currentColor"
                            d="M17.611 3.5A4.89 4.89 0 0 1 22.5 8.389v7.222a4.89 4.89 0 0 1-4.889 4.889H6.39a4.889 4.889 0 0 1-4.882-4.638l-.007-.25V8.388A4.89 4.89 0 0 1 6.39 3.499h11.22ZM6.39 5.5A2.889 2.889 0 0 0 3.5 8.389v7.222l.015.295A2.89 2.89 0 0 0 6.389 18.5H17.61a2.889 2.889 0 0 0 2.889-2.889V8.39a2.889 2.889 0 0 0-2.888-2.89H6.39Zm.89 3.713a.5.5 0 0 1 .5.5v1.595h2.149V9.713a.5.5 0 0 1 .5-.5h.577a.5.5 0 0 1 .5.5v4.574a.5.5 0 0 1-.5.5h-.577a.5.5 0 0 1-.5-.5v-1.674h-2.15v1.674a.5.5 0 0 1-.5.5h-.577a.5.5 0 0 1-.5-.5V9.713a.5.5 0 0 1 .5-.5h.577Zm7.974 0c.616 0 1.157.114 1.624.343.467.228.832.549 1.092.963.265.414.397.908.397 1.481 0 .568-.132 1.062-.397 1.481a2.6 2.6 0 0 1-1.092.963c-.467.228-1.008.343-1.624.343h-2.136a.5.5 0 0 1-.5-.5V9.713a.5.5 0 0 1 .5-.5h2.136Zm-1.059 4.316h.995c.319 0 .595-.059.829-.175.238-.123.424-.298.557-.526a1.65 1.65 0 0 0 .198-.828c0-.324-.065-.6-.198-.828a1.283 1.283 0 0 0-.557-.518 1.765 1.765 0 0 0-.829-.183h-.995v3.058Z"
                            fill="currentColor"
                          />
                        </g>
                      </svg>
                    </div>
                    <div class="text-FN1TsU">超清</div>
                  </button>
                </div>

                <div class="detail-button-view-container-sEElmO">
                  <button class="lv-btn lv-btn-secondary lv-btn-size-default lv-btn-shape-square detail-button-view-x33260" type="button">
                    <div class="icon-f2nkjH">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                        <g>
                          <path
                            data-follow-fill="currentColor"
                            d="m8.56 5.726 3.948-2.776a.5.5 0 0 1 .788.41v2.23h2.72v2H9.187a.996.996 0 0 1-.631-.225c-.518-.367-.61-1.208.003-1.64Zm10.775 9.213a1 1 0 1 0 1.5 1.323 6.403 6.403 0 0 0 1.605-4.249 6.403 6.403 0 0 0-1.606-4.249 6.41 6.41 0 0 0-4.817-2.174v2a4.41 4.41 0 0 1 3.318 1.498 4.403 4.403 0 0 1 1.105 2.925 4.403 4.403 0 0 1-1.105 2.926Zm-14.67-5.88a1 1 0 1 0-1.5-1.323 6.403 6.403 0 0 0-1.605 4.249c0 1.628.607 3.117 1.606 4.25a6.41 6.41 0 0 0 4.817 2.174v-2a4.41 4.41 0 0 1-3.318-1.498 4.403 4.403 0 0 1-1.105-2.926c0-1.123.416-2.145 1.105-2.926Zm3.318 9.35h2.404v2.232a.5.5 0 0 0 .788.409l3.962-2.785a.816.816 0 0 0 .066-.05.999.999 0 0 0-.591-1.806H7.983v2Z"
                            clip-rule="evenodd"
                            fill-rule="evenodd"
                            fill="currentColor"
                          />
                        </g>
                      </svg>
                    </div>
                    <div class="text-FN1TsU">细节修复</div>
                  </button>
                </div>

                <div class="detail-button-view-container-sEElmO">
                  <button class="lv-btn lv-btn-secondary lv-btn-size-default lv-btn-shape-square detail-button-view-x33260" type="button">
                    <div class="icon-f2nkjH">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                        <g>
                          <path
                            data-follow-fill="currentColor"
                            d="M20.186 7.249c.664-.67 1.799-.196 1.801.75l.013 5a1.69 1.69 0 0 1-.49 1.196l-3.744 3.965c-.063.857-.41 1.671-1.087 2.255l-.174.144c-.826.661-1.849 1.114-3.396 1.138h-.34c-1.198-.03-2.079-.14-2.721-.276-1.006-.214-1.431-.492-1.583-.621l-.072-.072c.607-.622.94-1.338 1.202-2.072l.246-.737c.278-.86.552-1.713 1.148-2.438l.486-.567a3.282 3.282 0 0 1 2.606-1.112l6.105-6.553Zm-15.52 6.98a.427.427 0 0 1 .793 0l.214.516a3.683 3.683 0 0 0 1.898 1.962l.605.268a.448.448 0 0 1 0 .813l-.64.284a3.68 3.68 0 0 0-1.872 1.899l-.208.477a.427.427 0 0 1-.787 0l-.208-.477a3.68 3.68 0 0 0-1.871-1.899l-.64-.284a.448.448 0 0 1 0-.813l.604-.268a3.682 3.682 0 0 0 1.898-1.962l.213-.516ZM14.8 15.807c-.71-.377-1.517-.22-1.976.298-.154.175-.303.349-.444.52-.344.419-.533.937-.826 1.846-.121.375-.264.822-.461 1.3.45.059 1.014.109 1.718.125 1.407.033 2.114-.346 2.692-.844.303-.261.496-.693.473-1.273a2.478 2.478 0 0 0-.144-.719 5.797 5.797 0 0 0-.158-.285l-.174-.274a2.242 2.242 0 0 0-.7-.694Zm1.462-1.412c.32.258.627.583.902.995.066.1.127.2.186.296L20 12.882l-.007-2.492-3.731 4.005ZM2.17 10.198a1.004 1.004 0 0 1 1.2-.752.998.998 0 0 1 .743 1.201c-.065.28-.114.565-.15.85a.998.998 0 1 1-1.982-.24c.044-.356.108-.71.189-1.059Zm2.458-4.624a.998.998 0 0 1 1.412-.052c.402.377.422 1.01.046 1.415-.196.21-.38.433-.552.662a1 1 0 0 1-1.4.204A1.004 1.004 0 0 1 3.94 6.4c.214-.286.444-.563.689-.826Zm12.025-.942a1 1 0 0 1 1.4-.192c.284.216.555.45.815.697.4.379.416 1.012.036 1.415a.997.997 0 0 1-1.41.042 8.1 8.1 0 0 0-.656-.559 1.004 1.004 0 0 1-.185-1.403ZM9.071 2.805a.994.994 0 0 1 1.243.666 1.008 1.008 0 0 1-.67 1.25 8.236 8.236 0 0 0-.81.294.997.997 0 0 1-1.309-.533 1.006 1.006 0 0 1 .538-1.311 10.218 10.218 0 0 1 1.008-.366Zm4.164-.351c.356.046.71.111 1.056.194a1.004 1.004 0 0 1-.473 1.948 8.017 8.017 0 0 0-.844-.156.997.997 0 0 1-.859-1.12 1.005 1.005 0 0 1 1.12-.866Z"
                            fill="currentColor"
                          />
                        </g>
                      </svg>
                    </div>
                    <div class="text-FN1TsU">局部重绘</div>
                  </button>
                </div>

                <div class="detail-button-view-container-sEElmO">
                  <button class="lv-btn lv-btn-secondary lv-btn-size-default lv-btn-shape-square detail-button-view-x33260" type="button">
                    <div class="icon-f2nkjH">
                      <svg width="1em" height="1em" viewBox="0 0 25 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                        <g>
                          <path data-follow-fill="currentColor" d="M7.5 10a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3v-4Zm3-1a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-4ZM3 3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2H5v1a1 1 0 0 1-2 0v-2Zm1 18a1 1 0 0 1-1-1v-2a1 1 0 1 1 2 0v1h1a1 1 0 1 1 0 2H4Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor" />
                          <path data-follow-fill="currentColor" d="M3.293 2.793a1 1 0 0 1 1.414 0l2.701 2.701a1 1 0 0 1-1.414 1.414l-2.701-2.7a1 1 0 0 1 0-1.415Zm0 18.414a1 1 0 0 1 0-1.414l2.701-2.701a1 1 0 0 1 1.414 1.414l-2.7 2.701a1 1 0 0 1-1.415 0ZM22 3.5a1 1 0 0 0-1-1h-2a1 1 0 1 0 0 2h1v1a1 1 0 1 0 2 0v-2Zm-1 18a1 1 0 0 0 1-1v-2a1 1 0 1 0-2 0v1h-1a1 1 0 1 0 0 2h2Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor" />
                          <path data-follow-fill="currentColor" d="M21.707 2.793a1 1 0 0 0-1.414 0l-2.701 2.701a1 1 0 0 0 1.414 1.414l2.701-2.7a1 1 0 0 0 0-1.415Zm0 18.414a1 1 0 0 0 0-1.414l-2.701-2.701a1 1 0 0 0-1.414 1.414l2.7 2.701a1 1 0 0 0 1.415 0Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor" />
                        </g>
                      </svg>
                    </div>
                    <div class="text-FN1TsU">扩图</div>
                  </button>
                </div>

                <div class="detail-button-view-container-sEElmO">
                  <button class="lv-btn lv-btn-secondary lv-btn-size-default lv-btn-shape-square detail-button-view-x33260" type="button">
                    <div class="icon-f2nkjH">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                        <g>
                          <path data-follow-fill="currentColor" d="M3.167 19.667A1.167 1.167 0 1 1 3.166 22a1.167 1.167 0 0 1 .001-2.333ZM7.833 18.5a1.167 1.167 0 1 1 0 2.334 1.167 1.167 0 0 1 0-2.334Zm5.23-15.505a3.4 3.4 0 0 1 4.806 0l3.135 3.136a3.399 3.399 0 0 1 0 4.806l-7.067 7.068a3.4 3.4 0 0 1-4.806 0l-3.136-3.136a3.4 3.4 0 0 1 .001-4.808l7.066-7.066ZM3.166 15a1.167 1.167 0 1 1-.001 2.333A1.167 1.167 0 0 1 3.167 15Zm4.243-3.524a1.4 1.4 0 0 0 0 1.979l3.135 3.135a1.4 1.4 0 0 0 1.978 0l1.827-1.826L9.236 9.65 7.41 11.476Zm9.045-7.066a1.4 1.4 0 0 0-1.978 0L10.65 8.236l5.114 5.113 3.826-3.826a1.399 1.399 0 0 0 0-1.978L16.455 4.41Z" fill="currentColor" />
                        </g>
                      </svg>
                    </div>
                    <div class="text-FN1TsU">消除笔</div>
                  </button>
                </div>

                <div class="detail-button-view-container-sEElmO">
                  <button class="lv-btn lv-btn-secondary lv-btn-size-default lv-btn-shape-square detail-button-view-x33260" type="button">
                    <div class="icon-f2nkjH">
                      <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                        <g>
                          <path data-follow-fill="currentColor" d="M16.092 5.86c1.905.08 3.113 1.362 3.96 2.47.225.293.437.592.634.87.2.282.383.54.565.779.377.492.674.793.941.946a1 1 0 0 1 .408 1.294c-.684 1.448-1.687 3.317-3.349 4.82-1.69 1.528-4.017 2.639-7.25 2.639-6.143 0-9.079-3.976-10.386-6.944l-.24-.579a1 1 0 0 1 .271-1.114l.262-.249c.267-.272.553-.612.874-1.01.41-.509.878-1.115 1.363-1.665.937-1.059 2.233-2.26 3.939-2.26l.3.004c1.47.05 2.55.48 3.418 1.24l.053.037a.391.391 0 0 0 .189.054.295.295 0 0 0 .202-.064l.172-.143c.875-.693 1.96-1.129 3.487-1.129l.187.004Zm-.398 2c-.889.033-1.469.272-1.937.619l-.21.167c-.845.725-2.057.702-2.899.09l-.163-.13c-.44-.386-1.01-.67-1.966-.736l-.435-.014c-.747 0-1.515.54-2.44 1.586-.446.503-.858 1.04-1.304 1.594-.27.334-.556.675-.85.99 1.148 2.559 3.547 5.652 8.511 5.652 2.722 0 4.574-.916 5.908-2.122 1.132-1.024 1.92-2.286 2.53-3.478a7.654 7.654 0 0 1-.776-.884 28.48 28.48 0 0 1-.61-.838c-.198-.28-.39-.55-.588-.81-.816-1.067-1.554-1.69-2.56-1.69l-.21.004ZM7.51 12.114a.9.9 0 0 1 1.228-.333l.144.077c.746.377 1.888.602 3.111.606 1.305.003 2.514-.246 3.247-.663l.082-.042a.899.899 0 0 1 .807 1.605l-.214.115c-1.094.552-2.554.79-3.93.786-1.47-.005-3.031-.284-4.144-.922l-.077-.05a.9.9 0 0 1-.254-1.179Z" fill="currentColor" />
                        </g>
                      </svg>
                    </div>
                    <div class="text-FN1TsU">对口型</div>
                  </button>
                </div>
              </div>
            </div>

            <div class="group-container-sx43Zo">
              <div class="group-gyYOPU">
                <div>
                  <div class="detail-button-view-container-sEElmO">
                    <button class="lv-btn lv-btn-secondary lv-btn-size-default lv-btn-shape-square detail-button-view-x33260" type="button">
                      <div class="icon-f2nkjH">
                        <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                          <g>
                            <path
                              data-follow-fill="currentColor"
                              d="M3.764 8.02a2.5 2.5 0 0 1 2.5-2.5H17.03a2.5 2.5 0 0 1 2.5 2.5V9.8a3.25 3.25 0 0 1 2-.082V8.019a4.5 4.5 0 0 0-4.5-4.5H6.264a4.5 4.5 0 0 0-4.5 4.5v7.932a4.5 4.5 0 0 0 4.5 4.5h5.837a2.436 2.436 0 0 1-.05-.57v-1.43H6.263a2.5 2.5 0 0 1-2.5-2.5V8.019Zm17.67 3.964a1 1 0 0 0-1.41-.004l-5.773 5.707a.25.25 0 0 0-.074.178v2.366c0 .138.112.25.25.25h2.347a.25.25 0 0 0 .178-.075l5.71-5.791a1 1 0 0 0-.006-1.41l-1.221-1.22Z"
                              clip-rule="evenodd"
                              fill-rule="evenodd"
                              fill="currentColor"
                            />
                          </g>
                        </svg>
                      </div>
                      <div class="text-FN1TsU">重新编辑</div>
                    </button>
                  </div>
                  <div class="simple-tooltip-scroll-anchor sf-hidden"></div>
                </div>

                <div>
                  <div>
                    <div class="tooltip-container-BTcBzf">
                      <div class="detail-button-view-container-sEElmO">
                        <button class="lv-btn lv-btn-secondary lv-btn-size-default lv-btn-shape-square detail-button-view-x33260" type="button">
                          <div class="icon-f2nkjH">
                            <svg width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
                              <g>
                                <path
                                  data-follow-fill="currentColor"
                                  d="m8.56 5.726 3.948-2.776a.5.5 0 0 1 .788.41v2.23h2.72v2H9.187a.996.996 0 0 1-.631-.225c-.518-.367-.61-1.208.003-1.64Zm10.775 9.213a1 1 0 1 0 1.5 1.323 6.403 6.403 0 0 0 1.605-4.249 6.403 6.403 0 0 0-1.606-4.249 6.41 6.41 0 0 0-4.817-2.174v2a4.41 4.41 0 0 1 3.318 1.498 4.403 4.403 0 0 1 1.105 2.925 4.403 4.403 0 0 1-1.105 2.926Zm-14.67-5.88a1 1 0 1 0-1.5-1.323 6.403 6.403 0 0 0-1.605 4.249c0 1.628.607 3.117 1.606 4.25a6.41 6.41 0 0 0 4.817 2.174v-2a4.41 4.41 0 0 1-3.318-1.498 4.403 4.403 0 0 1-1.105-2.926c0-1.123.416-2.145 1.105-2.926Zm3.318 9.35h2.404v2.232a.5.5 0 0 0 .788.409l3.962-2.785a.816.816 0 0 0 .066-.05.999.999 0 0 0-.591-1.806H7.983v2Z"
                                  clip-rule="evenodd"
                                  fill-rule="evenodd"
                                  fill="currentColor"
                                />
                              </g>
                            </svg>
                          </div>
                          <div class="text-FN1TsU">再次生成</div>
                        </button>
                      </div>
                      <div class="simple-tooltip-scroll-anchor sf-hidden"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface ImageItem {
  id: string
  src: string
  promptText?: string
  modelLabel?: string
  aspectRatioLabel?: string
  resolutionLabel?: string
  featureLabel?: string
  createDate?: string
}

interface Props {
  visible: boolean
  currentIndex: number
  images: ImageItem[]
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  currentIndex: 0,
  images: () => [],
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:currentIndex': [value: number]
  'download': [image: ImageItem]
  'favorite': [image: ImageItem]
  'publish': [image: ImageItem]
  'generateVideo': [image: ImageItem]
  'editInCanvas': [image: ImageItem]
}>()

const internalIndex = ref(props.currentIndex)

const currentImage = computed(() => {
  if (props.images.length === 0) return null
  return props.images[internalIndex.value] || props.images[0]
})

const currentPromptText = computed(() => currentImage.value?.promptText || '暂无提示词')
const currentModelLabel = computed(() => currentImage.value?.modelLabel || '图片 4.0')
const currentAspectRatioLabel = computed(() => currentImage.value?.aspectRatioLabel || '1:1')
const currentResolutionLabel = computed(() => currentImage.value?.resolutionLabel || '2K')
const totalImages = computed(() => props.images.length)

watch(
  () => props.currentIndex,
  (newIndex) => {
    internalIndex.value = newIndex
  },
)

watch(internalIndex, (newIndex) => {
  emit('update:currentIndex', newIndex)
})

const closePreview = () => {
  emit('update:visible', false)
}

const prevImage = () => {
  if (internalIndex.value > 0) {
    internalIndex.value -= 1
  }
}

const nextImage = () => {
  if (internalIndex.value < props.images.length - 1) {
    internalIndex.value += 1
  }
}

const handleDownload = () => {
  if (currentImage.value) {
    emit('download', currentImage.value)
  }
}

const handleFavorite = () => {
  if (currentImage.value) {
    emit('favorite', currentImage.value)
  }
}

const handlePublish = () => {
  if (currentImage.value) {
    emit('publish', currentImage.value)
  }
}

const handleGenerateVideo = () => {
  if (currentImage.value) {
    emit('generateVideo', currentImage.value)
  }
}

const handleEditInCanvas = () => {
  if (currentImage.value) {
    emit('editInCanvas', currentImage.value)
  }
}
</script>

<style>
@import "./ImagePreview.css";
</style>
