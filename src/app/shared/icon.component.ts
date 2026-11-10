import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Conjunto de iconos tipo Material Symbols en SVG (rejilla de 24 px). */
export const ICON_PATHS: Record<string, string> = {
  home: 'M12 3 3 10.5V21h6v-6h6v6h6V10.5L12 3Z',
  tv: 'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM5 15V5h14v10H5z',
  film: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z',
  music: 'M12 3v11.5a3.5 3.5 0 1 1-2-3.16V6l8-2v8.5a3.5 3.5 0 1 1-2-3.16V3Z',
  folder: 'M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2Z',
  search: 'M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 5 1.5-1.5-5-5Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14Z',
  tag: 'M21.4 11.6 12.4 2.6A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .6 1.4l9 9a2 2 0 0 0 2.8 0l7-7a2 2 0 0 0 0-2.8ZM6.5 8A1.5 1.5 0 1 1 8 6.5 1.5 1.5 0 0 1 6.5 8Z',
  chart: 'M3 21h18v-2H5V3H3v18Zm4-3h3V9H7v9Zm5 0h3V5h-3v13Zm5 0h3v-6h-3v6Z',
  server: 'M3 4h18v6H3V4Zm0 8h18v6H3v-6Zm3 2h2v2H6v-2Zm0-8h2v2H6V6Z',
  users: 'M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13Zm8 0c-.3 0-.7 0-1.1.1 1.2.9 2 2 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-6.9-3.5Z',
  bell: 'M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22Zm7-5v-6a7 7 0 0 0-5.5-6.8V3.5a1.5 1.5 0 0 0-3 0v.7A7 7 0 0 0 5 11v6l-2 2v1h18v-1l-2-2Z',
  settings: 'M12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Zm7.4-2.6.1-.9-.1-.9 2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.6-.9L15 3.5H9l-.4 2.6a7.6 7.6 0 0 0-1.6.9l-2.4-1-2 3.4 2 1.6-.1.9.1.9-2 1.6 2 3.4 2.4-1c.5.4 1 .7 1.6.9l.4 2.6h6l.4-2.6c.6-.2 1.1-.5 1.6-.9l2.4 1 2-3.4-2-1.6ZM12 4.5l.2 1.5 1.1.3 1.3-.8 1.5 2.6-1.2 1 .2 1.4v.1l1.2 1-1.5 2.6-1.3-.8-1.1.3-.2 1.5H10l-.2-1.5-1.1-.3-1.3.8L5.9 11l1.2-1-.2-1.4v-.1l-1.2-1 1.5-2.6 1.3.8 1.1-.3L10 4.5h2Z',
  menu: 'M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z',
  plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z',
  close: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4Z',
  play: 'M8 5v14l11-7L8 5Z',
  pause: 'M6 5h4v14H6V5Zm8 0h4v14h-4V5Z',
  next: 'M6 18l8.5-6L6 6v12Zm10-12v12h2V6h-2Z',
  prev: 'M18 6l-8.5 6L18 18V6ZM8 6H6v12h2V6Z',
  shuffle: 'M17 3l4 4-4 4V8h-2.2l-2 2.6-1.3-1.7L14 5.3h3V3ZM3 6h4.3l11.2 12H21v-3l4 4-4 4v-3h-3.2L6.6 8H3V6Zm0 10h3.6l2-2.6 1.3 1.7L7.9 18H21v-3l4 4-4 4v-3h-4.3L3 16v-2Z',
  repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Z',
  volume: 'M3 9v6h4l5 5V4L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.06A4.5 4.5 0 0 0 16.5 12Z',
  queue: 'M3 6h12v2H3V6Zm0 4h12v2H3v-2Zm0 4h8v2H3v-2Zm13-6v9.2a2.8 2.8 0 1 1-2-2.7V6h4v2h-2Z',
  eq: 'M10 20V10H7v8h3Zm0-12v2h3V8h-3Zm5 12V4h-3v16h3Zm0-18v2h3V8h-3Zm-5 4v2h3v-2h-3Z',
  cast: 'M2 16.5v3h3a3 3 0 0 0-3-3Zm0-4v2a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7Zm18-9H4a2 2 0 0 0-2 2v3h2V5h16v14h-7v2h7a2 2 0 0 0 2-2V5.5a2 2 0 0 0-2-2ZM2 8v2h12V8H2Z',
  pip: 'M19 11h-8v6h8v-6Zm2-8H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm0 14.5H3V5h18v12.5Z',
  fullscreen: 'M5 5h5V3H3v7h2V5Zm9-2v2h5v5h2V3h-7ZM5 14H3v7h7v-2H5v-5Zm14 5h-5v2h7v-7h-2v5Z',
  captions: 'M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm-1 12H6v-2h3v-2H6V9h12v7Zm-4-2h-3v-2h3v2Z',
  audio: 'M12 3v11.5a3.5 3.5 0 1 1-2-3.16V6l8-2v8.5a3.5 3.5 0 1 1-2-3.16V3Z',
  quality: 'M4 6h16v12H4V6Zm2 2v8h3v-8H6Zm5 0v8h2V8h-2Zm4 0v8h3v-8h-3Z',
  chapters: 'M3 5h2v14H3V5Zm4 6h2v2H7v-2Zm4-4h2v10h-2V7Zm4 3h2v4h-2v-4Zm4-4h2v12h-2V6Z',
  image: 'M21 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm-9 3.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5ZM5 19l4.5-6 3.5 4.5L16 14l3 5H5Z',
  style: 'M12 2 9.8 8.8 3 11l6.8 2.2L12 20l2.2-6.8L21 11l-6.8-2.2L12 2Z',
  sleep: 'M9 2h6l-3 4h3l-4 5h4l-6 6 1.5-5H8L11 8H8l1-6Z',
  keyboard: 'M20 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm-9 3h2v2h-2V8Zm0 3h2v2h-2v-2Zm-3 3h8v2H8v-2Zm9 0h2v2h-2v-2Zm0-3h2v2h-2v-2Zm0-3h2v2h-2V8Z',
  star: 'm12 17.3-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2l2.9 6.6 7.1.6-5.4 4.8 1.6 7L12 17.3Z',
  heart: 'M12 21s-8-4.9-8-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 11c0 5.1-8 10-8 10Z',
  more: 'M12 8a2 2 0 1 0-2-2 2 2 0 0 0 2 2Zm0 2a2 2 0 1 0 2 2 2 2 0 0 0-2-2Zm0 6a2 2 0 1 0 2 2 2 2 0 0 0-2-2Z',
  edit: 'M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z',
  delete: 'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z',
  watch: 'M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5c-1.7-4.4-6-7.5-11-7.5Zm0 13a5.5 5.5 0 1 1 5.5-5.5 5.5 5.5 0 0 1-5.5 5.5Zm0-8a2.5 2.5 0 1 0 2.5 2.5A2.5 2.5 0 0 0 12 9.5Z',
  eye: 'M12 5C7 5 2.7 8.1 1 12.5 2.7 16.9 7 20 12 20s9.3-3.1 11-7.5C21.3 8.1 17 5 12 5Zm0 12.5a5 5 0 1 1 5-5 5 5 0 0 1-5 5Zm0-8a3 3 0 1 0 3 3 3 3 0 0 0-3-3Z',
  eyeoff: 'M2.1 3.5 3.5 2.1l18.4 18.4-1.4 1.4-3-3A11.6 11.6 0 0 1 12 20C7 20 2.7 16.9 1 12.5a12.8 12.8 0 0 1 4.2-6.1L2.1 3.5ZM12 5c5 0 9.3 3.1 11 7.5a13.6 13.6 0 0 1-3.3 4.8L15 12.7A3.5 3.5 0 1 0 11.3 9l-2.2-2.2A11.5 11.5 0 0 1 12 5Z',
  download: 'M5 20h14v-2H5v2ZM19 9h-4V3H9v6H5l7 7 7-7Z',
  upload: 'M9 16h6v-6h4l-7-7-7 7h4v6Zm-4 2h14v2H5v-2Z',
  trash: 'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z',
  restore: 'M13 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3Zm-1 4h2V8h4v2h-6V7Z',
  pin: 'M16 9V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v5a4 4 0 0 1-3 3.87V15h5v6h2v-6h5v-2.13A4 4 0 0 1 13 9Z',
  shield: 'M12 1 3 5v6c0 5.6 3.8 10.7 9 12 5.2-1.3 9-6.4 9-12V5l-9-4Zm-1 15-4-4 1.4-1.4L11 13.2l5.6-5.6L18 9l-7 7Z',
  language: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm6.9 6h-2.9a15.6 15.6 0 0 0-1.4-3.7A8 8 0 0 1 18.9 8ZM12 4c.8 1 1.5 2.2 1.9 4h-3.8c.4-1.8 1.1-3 1.9-4ZM4.3 14a8 8 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4H4.3Zm.8 2h2.9a15.6 15.6 0 0 0 1.4 3.7A8 8 0 0 1 5.1 16Zm2.9-8H5.1a8 8 0 0 1 4.3-3.7A15.6 15.6 0 0 0 8 8ZM12 20a7.8 7.8 0 0 1-1.9-4h3.8a7.8 7.8 0 0 1-1.9 4Zm2.3-6H9.7a14.5 14.5 0 0 1 0-4h4.6a14.5 14.5 0 0 1 0 4Zm.4 5.7a15.6 15.6 0 0 0 1.4-3.7h2.9a8 8 0 0 1-4.3 3.7Zm1.7-5.7a16.5 16.5 0 0 1 0-4h3.4a16.5 16.5 0 0 1-3.4 0Z',
  theme: 'M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36A5.5 5.5 0 0 1 13.36 2.9 9.2 9.2 0 0 0 12 3Z',
  filter: 'M10 18h4v-2h-4v2ZM3 6v2h18V6H3Zm3 7h12v-2H6v2Z',
  grid: 'M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z',
  list: 'M3 5h2v2H3V5Zm4 0h14v2H7V5ZM3 11h2v2H3v-2Zm4 0h14v2H7v-2Zm-4 6h2v2H3v-2Zm4 0h14v2H7v-2Z',
  info: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z',
  warning: 'M1 21h22L12 2 1 21Zm12-3h-2v-2h2v2Zm0-4h-2v-4h2v4Z',
  playcircle: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-2 14.5v-9l7 4.5-7 4.5Z',
  history: 'M13 3a9 9 0 0 0-9 9H1l3.9 4 3.9-4H6a7 7 0 1 1 7 7 6.9 6.9 0 0 1-4.9-2l-1.4 1.4A9 9 0 1 0 13 3Zm-1 5v5l4.3 2.6.7-1.2-3.5-2.1V8H12Z',
  scan: 'M4 4h4V2H4a2 2 0 0 0-2 2v4h2V4Zm12 0h4a2 2 0 0 1 2 2v4h-2V4h-4V2ZM4 16H2v4a2 2 0 0 0 2 2h4v-2H4v-4Zm16 0h2v4a2 2 0 0 1-2 2h-4v-2h4v-4ZM7 11h10v2H7v-2Z',
  duplicate: 'M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z',
  hide: 'M12 6.5A9.8 9.8 0 0 0 1 12a12.4 12.4 0 0 0 5 5.3l1.5-1.8A7.6 7.6 0 0 1 3.6 12a8 8 0 0 1 12.8-3.2l1.5-1.8A11.6 11.6 0 0 0 12 6.5Zm0 3a2.5 2.5 0 0 1 2.5 2.5 2.5 2.5 0 0 1-2.5 2.5 2.5 2.5 0 0 1-2.5-2.5A2.5 2.5 0 0 1 12 9.5Z',
  playlist: 'M3 6h12v2H3V6Zm0 4h12v2H3v-2Zm0 4h8v2H3v-2Zm13-8v9.5a2.5 2.5 0 1 1-2-2.45V8h4v2h-2Z',
  playlistadd: 'M3 6h12v2H3V6Zm0 4h12v2H3v-2Zm0 4h8v2H3v-2Zm14-8v9.5a2.5 2.5 0 1 1-2-2.45V8h4v2h-2ZM17 2v3h-3v2h3v3h2V7h3V5h-3V2h-2Z',
  activity: 'M13 2 4.5 13H11l-1 9 8.5-11H12l1-9Z',
  clock: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 10.6 4 2.4-.9 1.6L11 13.3V6h2v6.6Z',
  lock: 'M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2Zm-6 9a2 2 0 0 1-1-3.7V6a3 3 0 0 1 6 0v4.3A2 2 0 0 1 12 17Z',
  backup: 'M12 3 3 7.5V13l9 4.5 9-4.5V7.5L12 3Zm0 2.2 6 3v4.3l-6 3-6-3V8.2l6-3Z',
  storage: 'M4 4h16v6H4V4Zm0 8h16v8H4v-8Zm2 2v4h2v-4H6Zm4 0v4h2v-4h-2Z',
  subtitle: 'M3 5h18v14H3V5Zm2 10h6v2H5v-2Zm8 0h6v2h-6v-2Z',
  sort: 'M3 18h6v-2H3v2Zm0-5h12v-2H3v2Zm0-7v2h18V6H3Zm4 10h14v-2H7v2Z',
  replay10: 'M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7Z',
  forward10: 'M12 5V1l5 5-5 5V7a5 5 0 1 0 5 5h2a7 7 0 1 1-7-7Z',
  ab: 'M4 18h3v-6h2v6h3v-9H4v9Zm10 0h3v-6h2v6h3v-9h-8v9Z',
  sparkles: 'M12 2 9.8 8.8 3 11l6.8 2.2L12 20l2.2-6.8L21 11l-6.8-2.2L12 2Z',
};

/**
 * Icono en línea. Uso: `<mh-icon name="play" [size]="20" />`
 */
@Component({
  selector: 'mh-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 24 24" [attr.width]="size()" [attr.height]="size()" aria-hidden="true" focusable="false">
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
      }
      svg {
        fill: currentColor;
      }
    `,
  ],
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(24);
  readonly path = computed(() => ICON_PATHS[this.name()] ?? ICON_PATHS['info']);
}
