import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ArtKind, artSpec } from '../core/data/art';

/**
 * Portada generada en SVG. Se usa en lugar de imágenes reales para mantener el
 * proyecto autocontenido (sin dependencias de red) y determinista.
 */
@Component({
  selector: 'mh-art',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + spec().width + ' ' + spec().height"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient [attr.id]="gradientId()" [attr.gradientTransform]="'rotate(' + spec().angle + ' .5 .5)'">
          <stop offset="0" [attr.stop-color]="spec().from" />
          <stop offset="1" [attr.stop-color]="spec().to" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" [attr.fill]="'url(#' + gradientId() + ')'" />
      @for (c of spec().circles; track $index) {
        <circle [attr.cx]="c.cx" [attr.cy]="c.cy" [attr.r]="c.r" [attr.fill]="'rgba(255,255,255,' + c.opacity + ')'" />
      }
    </svg>
  `,
  styles: [
    `
      :host {
        position: absolute;
        inset: 0;
        display: block;
        overflow: hidden;
      }
      svg {
        width: 100%;
        height: 100%;
        display: block;
      }
    `,
  ],
})
export class ArtComponent {
  readonly seed = input.required<string>();
  readonly kind = input<ArtKind>('poster');
  readonly spec = computed(() => artSpec(this.seed(), this.kind()));
  readonly gradientId = computed(() => 'g-' + Math.abs(hash(this.seed() + this.kind())));
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return h;
}
