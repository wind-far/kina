<template>
  <img
    v-if="resolvedCustomIconUrl"
    :src="resolvedCustomIconUrl"
    width="1em"
    height="1em"
    role="presentation"
    alt=""
    style="display:block;object-fit:contain;"
  >

  <svg v-else-if="iconKey === 'home' && active" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g>
      <path data-follow-fill="currentColor" d="M9.343 2.524a4 4 0 0 1 5.17-.122l.144.122 6 5.333A4.002 4.002 0 0 1 22 10.847V19.5a3 3 0 0 1-3 3h-3.5a2 2 0 0 1-2-2v-3a1.5 1.5 0 0 0-3 0v3a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3v-8.653c0-1.07.43-2.094 1.187-2.843l.156-.147 6-5.333Z" fill="currentColor"></path>
    </g>
  </svg>
  <svg v-else-if="iconKey === 'home'" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g>
      <path data-follow-fill="currentColor" d="M12.166 1.52a3.991 3.991 0 0 1 2.347.882l.144.122 6 5.333A4.001 4.001 0 0 1 22 10.847V19.5a3 3 0 0 1-3 3h-5a2.98 2.98 0 0 1-2-.769 2.985 2.985 0 0 1-2 .769H5a3 3 0 0 1-3-3v-8.652c0-1.143.489-2.232 1.343-2.99l6-5.334.144-.122a4.025 4.025 0 0 1 1.473-.75A3.991 3.991 0 0 1 12 1.517c.055 0 .11.001.166.004Zm-.328 2.001c-.42.035-.831.2-1.167.499l-6 5.333c-.427.38-.671.924-.671 1.495V19.5a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V17a1 1 0 0 1 1-1l.102.005A1 1 0 0 1 13 17v2.5a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-8.652a2 2 0 0 0-.67-1.495l-6-5.333-.139-.113a1.995 1.995 0 0 0-1.03-.386l-.083-.005a1.923 1.923 0 0 0-.24.005Z" fill="currentColor"></path>
    </g>
  </svg>

  <svg v-else-if="iconKey === 'generate' && active" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M10.662 2.262c.556-1.095 2.12-1.095 2.676 0l.945 1.864a12.727 12.727 0 0 0 5.591 5.59l1.864.946c1.095.556 1.095 2.12 0 2.676l-1.864.945a12.727 12.727 0 0 0-5.59 5.591l-.946 1.864c-.556 1.095-2.12 1.095-2.676 0l-.945-1.864a12.727 12.727 0 0 0-5.591-5.59l-1.864-.946c-1.095-.556-1.095-2.12 0-2.676l1.864-.945a12.727 12.727 0 0 0 5.59-5.591l.946-1.864Z" fill="currentColor"></path></g>
  </svg>
  <svg v-else-if="iconKey === 'generate'" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g>
      <path data-follow-fill="currentColor" d="m12 4.046-.5.985a14.727 14.727 0 0 1-6.47 6.47L4.047 12l.985.5a14.728 14.728 0 0 1 6.47 6.47l.5.984.499-.985a14.727 14.727 0 0 1 6.47-6.47l.984-.499-.985-.5a14.727 14.727 0 0 1-6.47-6.47l-.5-.983Zm1.338-1.784c-.556-1.095-2.12-1.095-2.676 0l-.945 1.864a12.727 12.727 0 0 1-5.591 5.59l-1.864.946c-1.095.556-1.095 2.12 0 2.676l1.864.945a12.727 12.727 0 0 1 5.59 5.591l.946 1.864c.556 1.095 2.12 1.095 2.676 0l.945-1.864a12.728 12.728 0 0 1 5.591-5.59l1.864-.946c1.095-.556 1.095-2.12 0-2.676l-1.864-.945a12.728 12.728 0 0 1-5.59-5.591l-.946-1.864Z" clip-rule="evenodd" fill-rule="evenodd" fill="currentColor"></path>
    </g>
  </svg>

  <svg v-else-if="iconKey === 'asset' && active" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M2.837 5.77v10.884a4 4 0 0 0 4 4h10.326a4 4 0 0 0 4-4v-8.5a3 3 0 0 0-3-3h-5.737a1 1 0 0 1-.721-.306l-1.11-1.156A3 3 0 0 0 8.43 2.77H5.837a3 3 0 0 0-3 3ZM6 10a1 1 0 1 0 0 2h12a1 1 0 1 0 0-2H6Z" fill="currentColor"></path></g>
  </svg>
  <svg v-else-if="iconKey === 'asset'" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M5.837 3.77A2 2 0 0 0 3.84 5.65l-.003.12v10.884a3 3 0 0 0 2.824 2.995l.176.005h10.326a3 3 0 0 0 2.995-2.824l.005-.176v-8.5a2 2 0 0 0-1.85-1.995l-.15-.005h-5.737a2 2 0 0 1-1.355-.528l-.086-.083-1.11-1.156A2 2 0 0 0 8.55 3.777l-.12-.007H5.837Zm0-1h2.594a4 4 0 0 1 2.884 1.228l1.111 1.156h5.737a4 4 0 0 1 3.995 3.8l.005.2v8.5a4 4 0 0 1-3.8 3.995l-.2.005H6.837a4 4 0 0 1-3.995-3.8l-.005-.2V5.77a3 3 0 0 1 3-3Zm1.163 7.23a1 1 0 0 0 0 2h10a1 1 0 1 0 0-2H7Z" fill="currentColor"></path></g>
  </svg>

  <svg v-else-if="iconKey === 'canvas' && active" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g>
      <path data-follow-fill="currentColor" d="M6 3a2 2 0 0 0-2 2v10.2a2.8 2.8 0 0 0 2.8 2.8H11v1.2a1.8 1.8 0 0 0 1.8 1.8H19a1 1 0 1 0 0-2h-5.8a.2.2 0 0 1-.2-.2V18h4.2a2.8 2.8 0 0 0 2.8-2.8V5a2 2 0 0 0-2-2H6Zm6.25 4.25a1 1 0 0 1 1 1v1.5h1.5a1 1 0 1 1 0 2h-1.5v1.5a1 1 0 1 1-2 0v-1.5h-1.5a1 1 0 1 1 0-2h1.5v-1.5a1 1 0 0 1 1-1Zm5.25 9.25a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Z" fill="currentColor"></path>
    </g>
  </svg>
  <svg v-else-if="iconKey === 'canvas'" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g>
      <path data-follow-fill="currentColor" d="M6 4h12v11.2a1.2 1.2 0 0 1-1.2 1.2H12v2.8c0 .11.09.2.2.2H18a1 1 0 1 1 0 2h-5.8a2.2 2.2 0 0 1-2.2-2.2v-2.8H6.8A2.8 2.8 0 0 1 4 15.2V5a1 1 0 0 1 1-1Zm0-2a3 3 0 0 0-3 3v10.2a4.8 4.8 0 0 0 4.8 4.8H8v.2a4.2 4.2 0 0 0 4.2 4.2H18a3 3 0 1 0 0-6h-.451a4.8 4.8 0 0 0 2.451-4.2V5a3 3 0 0 0-3-3H6Zm6.25 5.25a1 1 0 0 1 1 1v1.5h1.5a1 1 0 1 1 0 2h-1.5v1.5a1 1 0 1 1-2 0v-1.5h-1.5a1 1 0 1 1 0-2h1.5v-1.5a1 1 0 0 1 1-1Zm5.25 8.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" fill="currentColor"></path>
    </g>
  </svg>

  <svg v-else-if="iconKey === 'workflow' && active" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M4 5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H9v2h6v-2h-.5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2H18a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-.5v2.5a1.5 1.5 0 0 1-1.5 1.5H9v2h.5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h.5V14H9v-2H6.5A1.5 1.5 0 0 1 5 10.5V10h-.5A2 2 0 0 1 2.5 8V5Z" fill="currentColor"></path></g>
  </svg>
  <svg v-else-if="iconKey === 'workflow'" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M6 5h3v3H6V5ZM4 5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H9v2h6v-2h-.5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2H18a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-.5v2.5a1.5 1.5 0 0 1-1.5 1.5H9v2h.5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h.5V14H9v-2H6.5A1.5 1.5 0 0 1 5 10.5V10H4.5A2 2 0 0 1 2.5 8V5Zm10.5 0h3v3h-3V5ZM6 16h3.5v3H6v-3Z" fill="currentColor"></path></g>
  </svg>

  <svg v-else-if="iconKey === 'account' && active" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM4 18a8 8 0 1 1 16 0 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" fill="currentColor"></path></g>
  </svg>
  <svg v-else-if="iconKey === 'account'" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM7 7a5 5 0 1 1 10 0A5 5 0 0 1 7 7Zm-1 11a6 6 0 0 1 12 0v.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18.5V18Zm6-8a8 8 0 0 0-8 8v.5A3.5 3.5 0 0 0 7.5 22h9a3.5 3.5 0 0 0 3.5-3.5V18a8 8 0 0 0-8-8Z" fill="currentColor"></path></g>
  </svg>

  <svg v-else-if="iconKey === 'publish' && active" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M12 2a1 1 0 0 1 1 1v10.586l3.293-3.293a1 1 0 0 1 1.414 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L11 13.586V3a1 1 0 0 1 1-1ZM4 14a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4a1 1 0 1 1 2 0v4a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-4a1 1 0 0 1 1-1Z" fill="currentColor"></path></g>
  </svg>
  <svg v-else-if="iconKey === 'publish'" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M12 3a.5.5 0 0 0-.5.5v8.879l-2.646-2.647a1 1 0 0 0-1.415 1.415l4.354 4.353a.293.293 0 0 0 .414 0l4.354-4.353a1 1 0 0 0-1.415-1.415L12.5 12.38V3.5A.5.5 0 0 0 12 3Zm0-2a2.5 2.5 0 0 1 2.5 2.5v4.05l.38-.379a3 3 0 1 1 4.243 4.243l-5 5a3 3 0 0 1-4.243 0l-5-5A3 3 0 0 1 9.12 7.171l.38.378V3.5A2.5 2.5 0 0 1 12 1Zm-8 13a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4a1 1 0 1 1 2 0v4a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-4a1 1 0 0 1 1-1Z" fill="currentColor"></path></g>
  </svg>

  <svg v-else-if="iconKey === 'notification' && active" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M16.865 9.264v3.085c0 1.38.671 2.634 1.737 3.409a30.66 30.66 0 0 1-13.203 0 4.213 4.213 0 0 0 1.737-3.409V9.264a4.865 4.865 0 0 1 9.73 0Zm-11.73 0a6.865 6.865 0 1 1 13.73 0v3.085c0 1.021.699 1.91 1.691 2.15.62.151 1.055.706 1.055 1.343v.075c0 .666-.454 1.252-1.096 1.427a32.572 32.572 0 0 1-17.028 0 1.488 1.488 0 0 1-1.097-1.427v-.075A1.38 1.38 0 0 1 3.445 14.5a2.213 2.213 0 0 0 1.69-2.151V9.264Zm6.867 12.357a4.564 4.564 0 0 1-3.348-1.456c2.219.334 4.477.334 6.696 0a4.564 4.564 0 0 1-3.348 1.456Z" fill="currentColor"></path></g>
  </svg>
  <svg v-else-if="iconKey === 'notification'" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M12 3.4a5.865 5.865 0 0 0-5.865 5.864v3.085c0 1.316-.844 2.446-2.053 2.808a2.38 2.38 0 0 0-1.692 2.285v.075c0 1.111.746 2.082 1.82 2.373a33.572 33.572 0 0 0 15.58.09l.418-.09a2.488 2.488 0 0 0 1.82-2.373v-.075a2.38 2.38 0 0 0-1.692-2.285c-1.209-.362-2.053-1.492-2.053-2.808V9.264A5.865 5.865 0 0 0 12 3.399Zm0-2a7.865 7.865 0 0 1 7.865 7.864v3.085c0 .727.496 1.359 1.33 1.563a4.38 4.38 0 0 1 3.196 4.21v.075a4.487 4.487 0 0 1-3.294 4.336 35.572 35.572 0 0 1-18.193 0A4.487 4.487 0 0 1-.39 18.297v-.075a4.38 4.38 0 0 1 3.196-4.21c.834-.204 1.33-.836 1.33-1.563V9.264A7.865 7.865 0 0 1 12 1.399Zm-2.49 18.84a3.564 3.564 0 0 0 4.98 0 31.58 31.58 0 0 1-4.98 0Z" fill="currentColor"></path></g>
  </svg>

  <svg v-else-if="iconKey === 'app-download' && active" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M8.5 2A4.5 4.5 0 0 0 4 6.5v11A4.5 4.5 0 0 0 8.5 22h7a4.5 4.5 0 0 0 4.5-4.5v-11A4.5 4.5 0 0 0 15.5 2h-7ZM6 6.5A2.5 2.5 0 0 1 8.5 4h7A2.5 2.5 0 0 1 18 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 17.5v-11ZM12 18a1.444 1.444 0 1 0 0-2.889A1.444 1.444 0 0 0 12 18Z" fill="currentColor"></path></g>
  </svg>
  <svg v-else-if="iconKey === 'app-download'" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M8.5 3A3.5 3.5 0 0 0 5 6.5v11A3.5 3.5 0 0 0 8.5 21h7a3.5 3.5 0 0 0 3.5-3.5v-11A3.5 3.5 0 0 0 15.5 3h-7Zm0-2h7A5.5 5.5 0 0 1 21 6.5v11a5.5 5.5 0 0 1-5.5 5.5h-7A5.5 5.5 0 0 1 3 17.5v-11A5.5 5.5 0 0 1 8.5 1ZM9 5.75a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H9Zm3 13a1.444 1.444 0 1 0 0-2.889A1.444 1.444 0 0 0 12 18.75Z" fill="currentColor"></path></g>
  </svg>

  <svg v-else-if="iconKey === 'api-entry' && active" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M6.503 6.005a.6.6 0 0 1 .58.448L9.901 17.25a.6.6 0 0 1-.58.751h-.994a.6.6 0 0 1-.58-.448l-.385-1.472H4.478l-.384 1.472a.6.6 0 0 1-.58.448H2.52a.6.6 0 0 1-.581-.751l2.82-10.797a.6.6 0 0 1 .58-.448h1.164ZM14.321 6a4.081 4.081 0 0 1 0 8.161h-.72v3.24a.6.6 0 0 1-.599.599h-.96a.6.6 0 0 1-.6-.6V6.6a.6.6 0 0 1 .6-.6h2.28Zm7.16-.005c.33 0 .6.27.6.6v10.8a.6.6 0 0 1-.6.6h-.961a.6.6 0 0 1-.6-.6v-10.8a.6.6 0 0 1 .6-.6h.96ZM5.041 13.92h1.757l-.879-3.364-.878 3.364Zm8.56-1.92h.72a1.92 1.92 0 1 0 0-3.839h-.72V12Z" fill="currentColor"></path></g>
  </svg>
  <svg v-else-if="iconKey === 'api-entry'" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M5.34 5.005a1.6 1.6 0 0 0-1.548 1.198L.972 17a1.6 1.6 0 0 0 1.548 2h.994a1.6 1.6 0 0 0 1.548-1.197l.188-.722h1.339l.188.722A1.6 1.6 0 0 0 8.325 19h.994a1.6 1.6 0 0 0 1.548-2L8.048 6.203a1.6 1.6 0 0 0-1.548-1.198H5.34Zm.58 2h.135l2.298 8.797h-.026l-.385-1.472a.6.6 0 0 0-.58-.448H4.478a.6.6 0 0 0-.58.448l-.384 1.472h-.027L5.92 7.005ZM12.042 5a1.6 1.6 0 0 0-1.6 1.6v10.8a1.6 1.6 0 0 0 1.6 1.6h.96a1.6 1.6 0 0 0 1.599-1.6v-2.24h.72a5.081 5.081 0 0 0 0-10.16h-2.28Zm.4 2h1.879a3.081 3.081 0 1 1 0 6.161h-1.88V7Zm8.078-2.005a1.6 1.6 0 0 0-1.6 1.6v10.8a1.6 1.6 0 0 0 1.6 1.6h.96a1.6 1.6 0 0 0 1.6-1.6v-10.8a1.6 1.6 0 0 0-1.6-1.6h-.96Z" fill="currentColor"></path></g>
  </svg>

  <svg v-else-if="iconKey === 'settings' && active" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M5 6.3a1.2 1.2 0 0 0 0 2.4h14a1.2 1.2 0 1 0 0-2.4H5Zm0 9a1.2 1.2 0 0 0 0 2.4h8a1.2 1.2 0 1 0 0-2.4H5Z" fill="currentColor"></path></g>
  </svg>
  <svg v-else-if="iconKey === 'settings'" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M5 5.3a2.2 2.2 0 0 0 0 4.4h14a2.2 2.2 0 1 0 0-4.4H5Zm0 2.4a.2.2 0 0 1 0-.4h14a.2.2 0 1 1 0 .4H5Zm0 6.6a2.2 2.2 0 1 0 0 4.4h8a2.2 2.2 0 1 0 0-4.4H5Zm0 2.4a.2.2 0 1 1 0-.4h8a.2.2 0 1 1 0 .4H5Zm11-1.4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Zm0-9a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z" fill="currentColor"></path></g>
  </svg>

  <svg v-else-if="iconKey === 'marketing' && active" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="M12.5 2.25c.31 0 .592.185.719.47l1.67 3.765a4.5 4.5 0 0 0 2.275 2.274l3.765 1.67a.785.785 0 0 1 0 1.438l-3.765 1.67a4.5 4.5 0 0 0-2.274 2.275l-1.67 3.765a.785.785 0 0 1-1.438 0l-1.67-3.765a4.5 4.5 0 0 0-2.275-2.274l-3.765-1.67a.785.785 0 0 1 0-1.438l3.765-1.67a4.5 4.5 0 0 0 2.274-2.275l1.67-3.765a.785.785 0 0 1 .72-.47Z" fill="currentColor"></path></g>
  </svg>
  <svg v-else-if="iconKey === 'marketing'" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><path data-follow-fill="currentColor" d="m12.5 4.636-.95 2.143A6.5 6.5 0 0 1 8.264 10.07l-2.143.95 2.143.95a6.5 6.5 0 0 1 3.286 3.286l.95 2.143.95-2.143a6.5 6.5 0 0 1 3.286-3.286l2.143-.95-2.143-.95a6.5 6.5 0 0 1-3.286-3.286l-.95-2.143Zm.72-1.916a.785.785 0 0 0-1.438 0l-1.67 3.765a4.5 4.5 0 0 1-2.275 2.274l-3.765 1.67a.785.785 0 0 0 0 1.438l3.765 1.67a4.5 4.5 0 0 1 2.274 2.275l1.67 3.765a.785.785 0 0 0 1.438 0l1.67-3.765a4.5 4.5 0 0 1 2.275-2.274l3.765-1.67a.785.785 0 0 0 0-1.438l-3.765-1.67a4.5 4.5 0 0 1-2.274-2.275L13.22 2.72Z" fill="currentColor"></path></g>
  </svg>

  <svg v-else-if="iconKey === 'logo' && active" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g>
      <path data-follow-fill="currentColor" d="M12 2.5c5.247 0 9.5 4.253 9.5 9.5s-4.253 9.5-9.5 9.5S2.5 17.247 2.5 12 6.753 2.5 12 2.5Zm2.836 6.445a1 1 0 0 1 0 1.414L13.196 12l1.64 1.64a1 1 0 1 1-1.414 1.415l-2.347-2.348a1 1 0 0 1 0-1.414l2.347-2.348a1 1 0 0 1 1.414 0Zm-4.258 0a1 1 0 0 1 0 1.414L8.938 12l1.64 1.64a1 1 0 1 1-1.414 1.415l-2.347-2.348a1 1 0 0 1 0-1.414L9.164 9a1 1 0 0 1 1.414 0Z" fill="currentColor"></path>
    </g>
  </svg>
  <svg v-else-if="iconKey === 'logo'" width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g>
      <path data-follow-fill="currentColor" d="M12 2.5c5.247 0 9.5 4.253 9.5 9.5s-4.253 9.5-9.5 9.5S2.5 17.247 2.5 12 6.753 2.5 12 2.5Zm0 2a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm2.836 4.445a1 1 0 0 1 0 1.414L13.196 12l1.64 1.64a1 1 0 1 1-1.414 1.415l-2.347-2.348a1 1 0 0 1 0-1.414l2.347-2.348a1 1 0 0 1 1.414 0Zm-4.258 0a1 1 0 0 1 0 1.414L8.938 12l1.64 1.64a1 1 0 1 1-1.414 1.415l-2.347-2.348a1 1 0 0 1 0-1.414L9.164 9a1 1 0 0 1 1.414 0Z" fill="currentColor"></path>
    </g>
  </svg>

  <svg v-else width="1em" height="1em" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" role="presentation" xmlns="http://www.w3.org/2000/svg">
    <g><circle cx="12" cy="12" r="8" fill="currentColor"></circle></g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  iconKey?: string
  iconSource?: 'default' | 'custom'
  inactiveIconUrl?: string
  activeIconUrl?: string
  active?: boolean
}>()

const resolvedCustomIconUrl = computed(() => {
  if (props.iconSource !== 'custom') {
    return ''
  }

  const inactiveIconUrl = String(props.inactiveIconUrl || '').trim()
  const activeIconUrl = String(props.activeIconUrl || '').trim()

  if (props.active) {
    return activeIconUrl || inactiveIconUrl
  }

  return inactiveIconUrl || activeIconUrl
})
</script>
