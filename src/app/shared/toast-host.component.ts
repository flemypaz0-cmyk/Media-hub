import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/services/toast.service';
import { IconComponent } from './icon.component';

/** Host de los avisos efímeros (snackbar). */
@Component({
  selector: 'mh-toast-host',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-host" aria-live="polite" aria-atomic="false">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class]="'toast toast-' + toast.kind" (click)="toasts.dismiss(toast.id)">
          <mh-icon [name]="toast.icon" [size]="18" />
          <span>{{ toast.text }}</span>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  readonly toasts = inject(ToastService);
}
