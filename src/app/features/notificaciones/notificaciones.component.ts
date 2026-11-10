import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MediaHubStore } from '../../core/store/mediahub.store';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { AppNotification } from '../../core/models';

@Component({
  selector: 'mh-notificaciones',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">Centro de notificaciones</h1>
        <p class="page-sub">Alertas del sistema, avisos de escaneo y registros de actividad</p>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-outlined" type="button" (click)="markAllRead()" [disabled]="unreadCount() === 0">
          <mh-icon name="check" [size]="18" />
          <span>Marcar todas como leídas</span>
        </button>
        <button class="btn btn-text" type="button" (click)="clearAll()" [disabled]="notifications().length === 0">
          <mh-icon name="trash" [size]="18" />
          <span>Limpiar historial</span>
        </button>
      </div>
    </div>

    @if (notifications().length === 0) {
      <div class="empty-state" style="padding: 48px; text-align: center; color: var(--md-sys-color-on-surface-variant)">
        <mh-icon name="bell-off" [size]="48" />
        <p style="margin-top: 12px">No tienes notificaciones pendientes.</p>
      </div>
    } @else {
      <div style="display: flex; flex-direction: column; gap: 10px; max-width: 800px">
        @for (n of notifications(); track n.id) {
          <article
            class="card"
            style="background: var(--md-sys-color-surface-container-low); padding: 16px 20px; border-radius: 16px; display: flex; align-items: flex-start; gap: 16px"
            [style.opacity]="n.read ? '0.7' : '1'"
          >
            <div
              style="width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0"
              style="background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container)"
            >
              <mh-icon [name]="n.icon || 'bell'" [size]="20" />
            </div>

            <div style="flex: 1; min-width: 0">
              <div style="display: flex; justify-content: space-between; align-items: baseline">
                <span style="font: var(--md-sys-typescale-title-small); font-weight: 600">{{ n.title }}</span>
                <span style="font: var(--md-sys-typescale-body-small); color: var(--md-sys-color-on-surface-variant)">
                  {{ formatDate(n.at) }}
                </span>
              </div>
              <p style="margin-top: 4px; font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant)">
                {{ n.body }}
              </p>
            </div>

            @if (!n.read) {
              <button class="icon-btn" type="button" title="Marcar como leída" (click)="markRead(n.id)">
                <mh-icon name="check" [size]="16" />
              </button>
            }
          </article>
        }
      </div>
    }
  `,
})
export class NotificacionesComponent {
  private readonly store = inject(MediaHubStore);
  private readonly toast = inject(ToastService);

  readonly notifications = computed(() => this.store.notifications());
  readonly unreadCount = computed(() => this.store.unreadNotifications());

  formatDate(iso: string): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }

  markRead(id: string): void {
    this.store.dispatch({ type: 'ReadNotificationCommand', payload: id });
  }

  markAllRead(): void {
    this.notifications()
      .filter((n) => !n.read)
      .forEach((n) => this.store.dispatch({ type: 'ReadNotificationCommand', payload: n.id }));
    this.toast.success('Todas las notificaciones marcadas como leídas.');
  }

  clearAll(): void {
    this.notifications().forEach((n) =>
      this.store.dispatch({ type: 'DismissNotificationCommand', payload: n.id }),
    );
    this.toast.show('Historial de notificaciones borrado.', 'info');
  }
}
