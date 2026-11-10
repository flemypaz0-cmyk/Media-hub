import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MediaHubStore } from '../../core/store/mediahub.store';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { Profile, ProfileRole } from '../../core/models';

type ModalTab = 'general' | 'seguridad' | 'parental' | 'bibliotecas' | 'preferencias';

interface PaletteColor {
  hex: string;
  name: string;
}

@Component({
  selector: 'mh-usuarios',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">Perfiles y usuarios</h1>
        <p class="page-sub">Crea, edita y configura roles, control parental, PIN y accesos a biblioteca</p>
      </div>
      <div class="page-head-actions">
        <button class="btn btn-filled" type="button" (click)="openCreateModal()">
          <mh-icon name="user-plus" [size]="18" />
          <span>Nuevo perfil</span>
        </button>
      </div>
    </div>

    <!-- Lista de perfiles -->
    <div class="grid wide" style="margin-bottom: 32px">
      @for (p of profiles(); track p.id) {
        <article
          class="card"
          style="background: rgba(255, 255, 255, 0.035); border: 1px solid rgba(255, 255, 255, 0.08); padding: 22px; border-radius: 20px; backdrop-filter: blur(12px);"
          [style.borderColor]="p.id === currentProfile().id ? 'var(--md-sys-color-primary)' : 'rgba(255, 255, 255, 0.08)'"
        >
          <div style="display: flex; gap: 16px; align-items: flex-start">
            <span
              class="avatar"
              [style.background]="p.color"
              style="width: 60px; height: 60px; font-size: 1.6rem; color: #fff; font-weight: 600; box-shadow: 0 4px 16px rgba(0,0,0,0.3);"
            >
              {{ p.avatar }}
            </span>
            <div style="flex: 1; min-width: 0">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
                <span style="font-size: 1.2rem; font-weight: 600">{{ p.name }}</span>
                @if (p.id === currentProfile().id) {
                  <span class="badge res" style="position: static">Activo</span>
                }
              </div>

              <div style="display: flex; gap: 6px; margin: 8px 0; flex-wrap: wrap">
                <span class="pill primary">{{ roleLabel(p.role) }}</span>
                @if (p.pin) {
                  <span class="pill" style="display: inline-flex; align-items: center; gap: 4px">
                    <mh-icon name="lock" [size]="12" /> PIN Activo
                  </span>
                }
                @if (p.parental.enabled) {
                  <span class="pill" style="background: rgba(239, 68, 68, 0.18); color: #fca5a5">
                    Parental: {{ p.parental.maxRating }}
                  </span>
                }
              </div>

              <div class="card-meta" style="color: var(--md-sys-color-on-surface-variant); font-size: 0.82rem">
                Bibliotecas accesibles:
                <b>{{ p.libraryAccess.length ? p.libraryAccess.join(', ') : 'Todas las colecciones' }}</b>
              </div>
            </div>

            <!-- Acciones CRUD del perfil -->
            <div style="display: flex; gap: 6px; align-items: center">
              @if (p.id !== currentProfile().id) {
                <button class="btn btn-tonal" style="height: 36px; padding: 0 14px" type="button" (click)="switchProfile(p.id)">
                  Activar
                </button>
              }
              <button class="icon-btn" type="button" title="Editar perfil" (click)="openEditModal(p)">
                <mh-icon name="edit" [size]="18" />
              </button>
              @if (profiles().length > 1) {
                <button class="icon-btn" type="button" title="Eliminar perfil" (click)="deleteProfile(p)">
                  <mh-icon name="trash" [size]="18" />
                </button>
              }
            </div>
          </div>
        </article>
      }
    </div>

    <!-- Modal CRUD (Crear y Editar) -->
    @if (showModal()) {
      <div class="dialog-scrim" (click)="closeModal()">
        <div class="dialog wide" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="dlg-head">
            <h2>{{ editingProfileId() ? 'Editar perfil: ' + formName() : 'Crear nuevo perfil' }}</h2>
            <button class="icon-btn" aria-label="Cerrar" (click)="closeModal()">
              <mh-icon name="close" />
            </button>
          </div>

          <!-- Pestañas del configurador -->
          <div class="tabs" style="padding: 0 24px; margin-bottom: 12px">
            <button type="button" class="tab" [class.active]="activeTab() === 'general'" (click)="activeTab.set('general')">
              General
            </button>
            <button type="button" class="tab" [class.active]="activeTab() === 'seguridad'" (click)="activeTab.set('seguridad')">
              Seguridad & PIN
            </button>
            <button type="button" class="tab" [class.active]="activeTab() === 'parental'" (click)="activeTab.set('parental')">
              Control Parental
            </button>
            <button type="button" class="tab" [class.active]="activeTab() === 'bibliotecas'" (click)="activeTab.set('bibliotecas')">
              Bibliotecas
            </button>
            <button type="button" class="tab" [class.active]="activeTab() === 'preferencias'" (click)="activeTab.set('preferencias')">
              Preferencias
            </button>
          </div>

          <div class="dlg-body" style="max-height: 60vh; overflow-y: auto">
            <!-- TAB 1: GENERAL -->
            @if (activeTab() === 'general') {
              <div class="field">
                <span class="field-label">Nombre del perfil *</span>
                <input
                  class="input"
                  type="text"
                  placeholder="Ej. Familiar, Niños, Frank..."
                  [value]="formName()"
                  (input)="onNameChange($event)"
                />
              </div>

              <div class="grid-2">
                <div class="field">
                  <span class="field-label">Rol del usuario</span>
                  <select class="select" [value]="formRole()" (change)="onRoleChange($event)">
                    <option value="user">Usuario Estándar (reproducción y favoritos)</option>
                    <option value="child">Infantil (con restricciones parentales automáticas)</option>
                    <option value="admin">Administrador (acceso total a configuración y medios)</option>
                  </select>
                </div>

                <div class="field">
                  <span class="field-label">Avatar o Iniciales</span>
                  <input
                    class="input"
                    type="text"
                    maxlength="3"
                    placeholder="Iniciales o emoji"
                    [value]="formAvatar()"
                    (input)="formAvatar.set($any($event.target).value.toUpperCase())"
                  />
                </div>
              </div>

              <div class="field">
                <span class="field-label">Color distintivo</span>
                <div style="display: flex; gap: 10px; margin-top: 6px; flex-wrap: wrap">
                  @for (col of paletteColors; track col.hex) {
                    <button
                      type="button"
                      [style.background]="col.hex"
                      [title]="col.name"
                      style="width: 38px; height: 38px; border-radius: 50%; border: 3px solid transparent; cursor: pointer; transition: transform 160ms ease;"
                      [style.transform]="formColor() === col.hex ? 'scale(1.2)' : 'scale(1)'"
                      [style.borderColor]="formColor() === col.hex ? '#ffffff' : 'transparent'"
                      (click)="formColor.set(col.hex)"
                    ></button>
                  }
                </div>
              </div>
            }

            <!-- TAB 2: SEGURIDAD & PIN -->
            @if (activeTab() === 'seguridad') {
              <div class="switch-row">
                <div class="sw-text">
                  <div class="sw-title">Bloquear acceso con código PIN</div>
                  <div class="sw-sub">Exige ingresar un código numérico para cambiar a este perfil o abrirlo.</div>
                </div>
                <button
                  type="button"
                  class="switch"
                  [class.on]="formPinEnabled()"
                  (click)="formPinEnabled.set(!formPinEnabled())"
                ></button>
              </div>

              @if (formPinEnabled()) {
                <div class="field" style="margin-top: 16px">
                  <span class="field-label">Código PIN (4 dígitos)</span>
                  <input
                    class="input pin-input"
                    type="password"
                    maxlength="4"
                    placeholder="••••"
                    [value]="formPin()"
                    (input)="formPin.set($any($event.target).value)"
                  />
                  <span class="hint">Este código será solicitado antes de cambiar a este perfil.</span>
                </div>
              }
            }

            <!-- TAB 3: CONTROL PARENTAL -->
            @if (activeTab() === 'parental') {
              <div class="switch-row">
                <div class="sw-text">
                  <div class="sw-title">Activar filtro de control parental</div>
                  <div class="sw-sub">Oculta películas y series que superen la clasificación por edad configurada.</div>
                </div>
                <button
                  type="button"
                  class="switch"
                  [class.on]="formParentalEnabled()"
                  (click)="formParentalEnabled.set(!formParentalEnabled())"
                ></button>
              </div>

              @if (formParentalEnabled()) {
                <div class="field" style="margin-top: 16px">
                  <span class="field-label">Calificación por edad máxima permitida</span>
                  <select class="select" [value]="formMaxRating()" (change)="formMaxRating.set($any($event.target).value)">
                    <option value="ALL">ALL — Todas las edades (sin restricciones)</option>
                    <option value="G">G — Apta para todo público</option>
                    <option value="PG">PG — Guía paternal sugerida</option>
                    <option value="PG-13">PG-13 — Mayores de 13 años</option>
                    <option value="R">R — Restringido (mayores de 17)</option>
                    <option value="NC-17">NC-17 — Exclusivo adultos</option>
                  </select>
                </div>
              }
            }

            <!-- TAB 4: BIBLIOTECAS -->
            @if (activeTab() === 'bibliotecas') {
              <p style="font: var(--md-sys-typescale-body-medium); color: var(--md-sys-color-on-surface-variant); margin-bottom: 14px">
                Selecciona a qué categorías tiene acceso este perfil. Si no seleccionas ninguna, tendrá acceso completo a todo el catálogo.
              </p>
              <div class="multi-select" style="display: flex; flex-direction: column; gap: 8px">
                @for (cat of availableCategories(); track cat.id) {
                  <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 6px 10px; border-radius: 8px; background: rgba(255,255,255,0.03)">
                    <input
                      type="checkbox"
                      [checked]="isCategorySelected(cat.name)"
                      (change)="toggleCategoryAccess(cat.name)"
                    />
                    <span [style.color]="cat.color" style="font-weight: 600">{{ cat.name }}</span>
                  </label>
                }
              </div>
            }

            <!-- TAB 5: PREFERENCIAS -->
            @if (activeTab() === 'preferencias') {
              <div class="switch-row">
                <div class="sw-text">
                  <div class="sw-title">Reproducción automática del siguiente episodio</div>
                  <div class="sw-sub">Inicia el siguiente capítulo al terminar el episodio actual.</div>
                </div>
                <button
                  type="button"
                  class="switch"
                  [class.on]="formAutoplayNext()"
                  (click)="formAutoplayNext.set(!formAutoplayNext())"
                ></button>
              </div>

              <div class="switch-row">
                <div class="sw-text">
                  <div class="sw-title">Vista previa de vídeo en hover</div>
                  <div class="sw-sub">Muestra una muestra animada al posar el cursor sobre los pósters.</div>
                </div>
                <button
                  type="button"
                  class="switch"
                  [class.on]="formHoverPreview()"
                  (click)="formHoverPreview.set(!formHoverPreview())"
                ></button>
              </div>

              <div class="field" style="margin-top: 14px">
                <span class="field-label">Idioma preferido</span>
                <select class="select" [value]="formLang()" (change)="formLang.set($any($event.target).value)">
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </div>
            }
          </div>

          <div class="dlg-foot">
            <button class="btn btn-text" type="button" (click)="closeModal()">Cancelar</button>
            <button class="btn btn-filled" type="button" (click)="saveProfile()">
              <mh-icon name="check" [size]="18" />
              <span>{{ editingProfileId() ? 'Guardar cambios' : 'Crear perfil' }}</span>
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class UsuariosComponent {
  private readonly store = inject(MediaHubStore);
  private readonly toast = inject(ToastService);

  readonly profiles = computed(() => this.store.profiles());
  readonly currentProfile = computed(() => this.store.currentProfile());
  readonly availableCategories = computed(() => this.store.categories());

  readonly paletteColors: PaletteColor[] = [
    { hex: '#4f5bd5', name: 'Índigo MediaHub' },
    { hex: '#7c3aed', name: 'Violeta Cinema' },
    { hex: '#ec4899', name: 'Rosa Neón' },
    { hex: '#ef4444', name: 'Rojo Carmesí' },
    { hex: '#f59e0b', name: 'Ámbar Cálido' },
    { hex: '#10b981', name: 'Esmeralda' },
    { hex: '#06b6d4', name: 'Cian Claro' },
    { hex: '#64748b', name: 'Pizarra Neutro' },
  ];

  /* Estado del modal */
  readonly showModal = signal(false);
  readonly editingProfileId = signal<string | null>(null);
  readonly activeTab = signal<ModalTab>('general');

  /* Campos del formulario */
  readonly formName = signal('');
  readonly formRole = signal<ProfileRole>('user');
  readonly formAvatar = signal('');
  readonly formColor = signal('#4f5bd5');
  readonly formPinEnabled = signal(false);
  readonly formPin = signal('');
  readonly formParentalEnabled = signal(false);
  readonly formMaxRating = signal('ALL');
  readonly formLibraryAccess = signal<string[]>([]);
  readonly formAutoplayNext = signal(true);
  readonly formHoverPreview = signal(true);
  readonly formLang = signal('es');

  roleLabel(role: ProfileRole): string {
    return role === 'admin' ? 'Administrador' : role === 'child' ? 'Infantil' : 'Estándar';
  }

  openCreateModal(): void {
    this.editingProfileId.set(null);
    this.activeTab.set('general');
    this.formName.set('');
    this.formRole.set('user');
    this.formAvatar.set('');
    this.formColor.set('#4f5bd5');
    this.formPinEnabled.set(false);
    this.formPin.set('');
    this.formParentalEnabled.set(false);
    this.formMaxRating.set('ALL');
    this.formLibraryAccess.set([]);
    this.formAutoplayNext.set(true);
    this.formHoverPreview.set(true);
    this.formLang.set('es');
    this.showModal.set(true);
  }

  openEditModal(p: Profile): void {
    this.editingProfileId.set(p.id);
    this.activeTab.set('general');
    this.formName.set(p.name);
    this.formRole.set(p.role);
    this.formAvatar.set(p.avatar);
    this.formColor.set(p.color || '#4f5bd5');
    this.formPinEnabled.set(!!p.pin);
    this.formPin.set(p.pin || '');
    this.formParentalEnabled.set(p.parental?.enabled ?? false);
    this.formMaxRating.set(p.parental?.maxRating ?? 'ALL');
    this.formLibraryAccess.set([...(p.libraryAccess || [])]);
    this.formAutoplayNext.set(p.preferences?.autoplayNext ?? true);
    this.formHoverPreview.set(p.preferences?.hoverPreview ?? true);
    this.formLang.set(p.preferences?.lang ?? 'es');
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingProfileId.set(null);
  }

  onNameChange(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    this.formName.set(val);
    if (!this.formAvatar() && val.trim()) {
      this.formAvatar.set(val.trim()[0].toUpperCase());
    }
  }

  onRoleChange(e: Event): void {
    const role = (e.target as HTMLSelectElement).value as ProfileRole;
    this.formRole.set(role);
    if (role === 'child') {
      this.formParentalEnabled.set(true);
      this.formMaxRating.set('PG');
    }
  }

  isCategorySelected(catName: string): boolean {
    return this.formLibraryAccess().includes(catName);
  }

  toggleCategoryAccess(catName: string): void {
    const current = this.formLibraryAccess();
    if (current.includes(catName)) {
      this.formLibraryAccess.set(current.filter((c) => c !== catName));
    } else {
      this.formLibraryAccess.set([...current, catName]);
    }
  }

  switchProfile(id: string): void {
    const p = this.profiles().find((x) => x.id === id);
    if (p?.pin) {
      const entered = window.prompt(`Ingresa el PIN de seguridad para ${p.name}:`);
      if (entered !== p.pin) {
        this.toast.error('PIN incorrecto. Acceso denegado.');
        return;
      }
    }
    this.store.dispatch({ type: 'SwitchProfileCommand', payload: id });
    this.toast.success(`Perfil cambiado a ${p?.name || 'nuevo usuario'}`);
  }

  deleteProfile(p: Profile): void {
    if (this.profiles().length <= 1) {
      this.toast.error('No se puede eliminar el único perfil existente.');
      return;
    }
    if (confirm(`¿Estás seguro de eliminar el perfil de "${p.name}"?`)) {
      this.store.dispatch({ type: 'DeleteProfileCommand', payload: p.id });
      this.toast.show(`Perfil "${p.name}" eliminado.`, 'info');
    }
  }

  saveProfile(): void {
    const name = this.formName().trim();
    if (!name) {
      this.toast.error('Introduce un nombre para el perfil.');
      this.activeTab.set('general');
      return;
    }

    const pin = this.formPinEnabled() ? this.formPin().trim() : '';
    if (this.formPinEnabled() && (!pin || pin.length < 4)) {
      this.toast.error('El PIN debe tener 4 dígitos.');
      this.activeTab.set('seguridad');
      return;
    }

    const profileData: Profile = {
      id: this.editingProfileId() || 'p-' + Date.now(),
      name,
      role: this.formRole(),
      avatar: this.formAvatar().trim() || name[0].toUpperCase(),
      color: this.formColor(),
      pin,
      parental: {
        enabled: this.formParentalEnabled(),
        maxRating: this.formMaxRating(),
      },
      preferences: {
        hoverPreview: this.formHoverPreview(),
        autoplayNext: this.formAutoplayNext(),
        imageAdjustments: null,
        lang: this.formLang(),
        writeTagsToFile: false,
        keyboardShortcuts: true,
      },
      libraryAccess: this.formLibraryAccess(),
    };

    if (this.editingProfileId()) {
      this.store.dispatch({
        type: 'UpdateProfileCommand',
        payload: profileData,
      });
      this.toast.success(`Perfil "${name}" actualizado correctamente.`);
    } else {
      this.store.dispatch({
        type: 'CreateProfileCommand',
        payload: profileData,
      });
      this.toast.success(`Perfil "${name}" creado exitosamente.`);
    }

    this.closeModal();
  }
}
