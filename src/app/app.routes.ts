import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component')
      .then((module) => module.HomeComponent),
  },
  {
    path: 'enviar',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'seguimiento/:reference',
    loadComponent: () => import('./features/tracking/tracking.component')
      .then((module) => module.TrackingComponent),
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin.component')
      .then((module) => module.AdminComponent),
  },
  {
    path: 'como-funciona',
    loadComponent: () => import('./features/info/info.component').then((module) => module.InfoComponent),
    data: {
      eyebrow: 'Proceso',
      title: 'Cómo funciona CashFlowQba',
      intro: 'Cada remesa conserva un precio cerrado y un seguimiento separado de los datos privados de la entrega.',
      sections: [
        { title: '1. Cotiza', body: 'Indica cuánto recibirá tu familiar y elige únicamente entre los métodos de pago y entrega que estén activos.' },
        { title: '2. Paga', body: 'Recibirás el activo, la red, el monto exacto y una dirección única. La entrega no se libera hasta confirmar el pago.' },
        { title: '3. Sigue la remesa', body: 'El enlace privado muestra detección, confirmaciones de blockchain y avance de la entrega sin exponer datos personales.' },
      ],
    },
  },
  {
    path: 'ayuda',
    loadComponent: () => import('./features/info/info.component').then((module) => module.InfoComponent),
    data: {
      eyebrow: 'Soporte',
      title: 'Ayuda con tu remesa',
      intro: 'Conserva tu referencia y el enlace privado de seguimiento. Nunca compartas claves, semillas ni códigos de autenticación.',
      sections: [
        { title: 'Pago por red incorrecta', body: 'No realices un segundo pago. Contacta soporte con la referencia y el hash de transacción para revisión manual.' },
        { title: 'Confirmaciones', body: 'La barra puede avanzar a distinta velocidad según la red. Solo el evento confirmado habilita la operación.' },
        { title: 'Datos de entrega', body: 'Si necesitas corregir datos después de registrar la remesa, solicita revisión antes de que la entrega sea asignada.' },
      ],
    },
  },
  {
    path: 'terminos',
    loadComponent: () => import('./features/info/info.component').then((module) => module.InfoComponent),
    data: {
      eyebrow: 'Información legal',
      title: 'Términos del servicio',
      intro: 'Resumen informativo pendiente de revisión jurídica antes de producción.',
      sections: [
        { title: 'Cotizaciones', body: 'Cada cotización tiene vencimiento. Al expirar se debe generar una nueva antes de pagar.' },
        { title: 'Disponibilidad', body: 'Solo están disponibles los activos, redes, zonas y métodos mostrados durante la cotización.' },
      ],
    },
  },
  {
    path: 'privacidad',
    loadComponent: () => import('./features/info/info.component').then((module) => module.InfoComponent),
    data: {
      eyebrow: 'Información legal',
      title: 'Privacidad',
      intro: 'Resumen técnico pendiente de revisión jurídica antes de producción.',
      sections: [
        { title: 'Datos utilizados', body: 'Los datos de remitente y beneficiario se usan para gestionar la remesa, el soporte y la entrega.' },
        { title: 'Seguimiento privado', body: 'El estado público requiere un token aleatorio y no muestra teléfonos, dirección, notas ni datos del agente.' },
      ],
    },
  },
  {
    path: '**',
    redirectTo: '',
  },
];
