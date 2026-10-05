import './index.css'

// Punto de entrada mínimo. La aplicación (React, rutas, contextos) vive en arranque.tsx
// y se descarga con import() dinámico.
const arrancar = () => import('./arranque')

if (document.documentElement.classList.contains('is-login')) {
  // Se está mostrando el cascarón del login que viene en index.html: se deja que el
  // navegador pinte ese primer cuadro y RECIÉN ENTONCES se descarga el resto. Si React
  // se pidiera en paralelo, en celulares lentos competiría con el primer pintado.
  requestAnimationFrame(() => requestAnimationFrame(() => { void arrancar() }))
} else {
  // Usuario con sesión o ruta interna: no hay cascarón que esperar, se arranca ya.
  void arrancar()
}
