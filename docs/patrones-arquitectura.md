# Patrones y principios aplicados en ChePaga

Este documento resume como la app organiza responsabilidades y donde se ven los patrones usados.

## GoF

### Observer

La app usa Zustand como estado global reactivo. Las pantallas se suscriben a stores y se actualizan cuando cambia el estado.

Archivos principales:

- `store/useGruposStore.ts`
- `store/useUserStore.ts`
- `store/useNotificacionesStore.ts`
- `store/useAmistadStore.ts`

### Facade

La app esconde operaciones complejas atras de funciones y hooks simples. Las pantallas no necesitan conocer los detalles internos de permisos, storage, Supabase o links firmados.

Ejemplos:

- `hooks/useImagePicker.ts`: unifica camara y galeria.
- `lib/ticketImage.ts`: concentra subida, borrado y lectura de imagenes/comprobantes.
- `lib/balances.ts`: concentra calculo de saldos, balances y transferencias.

### Strategy

La division de gastos y el calculo de transferencias estan separados en `lib/balances.ts`. Esto permite cambiar o agregar estrategias de division en el futuro sin reescribir pantallas.

Ejemplos actuales:

- `calcularBalanceGrupo`: calcula cuanto queda a favor o en contra de cada persona.
- `calcularTransferenciasMinimas`: reduce las deudas a la menor cantidad de transferencias posibles.
- `calcularResumenPersonal`: calcula el resumen que ve cada usuario en sus grupos.

## GRASP

### Controller

Las pantallas y stores coordinan los casos de uso: crear grupos, agregar gastos, pagar, eliminar miembros, actualizar ranking o exportar reportes.

Ejemplos:

- `app/detalle-grupo.tsx`
- `app/agregar-gasto.tsx`
- `store/useGruposStore.ts`

### Information Expert

La logica de balances vive en `lib/balances.ts`, porque ese modulo tiene la informacion necesaria para calcular saldos, pagos y transferencias.

### Low Coupling

Las pantallas consumen servicios, hooks y componentes reutilizables. Eso evita que una pantalla dependa de detalles internos de otra.

Ejemplos:

- `components/ImageSourceModal.tsx`
- `hooks/useImagePicker.ts`
- `lib/displayName.ts`
- `lib/balances.ts`

### High Cohesion

Cada modulo intenta tener una responsabilidad clara:

- `components`: interfaz reutilizable.
- `hooks`: logica reutilizable de React.
- `store`: estado global y sincronizacion con datos.
- `lib`: reglas de dominio y servicios compartidos.

## SOLID

### Single Responsibility Principle

El calculo de balances fue extraido de las pantallas y del store hacia `lib/balances.ts`. Asi el store se enfoca en estado y la pantalla en presentacion/interaccion.

### Open/Closed Principle

La app queda preparada para agregar nuevas formas de division de gastos o nuevos calculos de reporte sin modificar las pantallas principales.

### Dependency Inversion Principle

Las pantallas dependen de funciones de alto nivel (`useImagePicker`, `calcularBalanceGrupo`, `calcularTransferenciasMinimas`) en lugar de depender directamente de detalles internos de calculo o storage.