import { useState, type ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/common/Layout'
import { useAccessibility, type ColorFilter, type FontSize } from '../../context/AccessibilityContext'
import {
  Eye,
  Sliders,
  Type,
  Zap,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  Keyboard,
  MousePointer,
  Sun,
  Coffee,
  Contrast,
  Moon,
  ShieldCheck,
  Check,
  Info,
  ChevronRight
} from 'lucide-react'

type TabType = 'color' | 'text' | 'motion' | 'shortcuts'

export default function Configuracion() {
  const { user } = useAuth()
  const { settings, updateSetting, resetSettings, isDefault } = useAccessibility()
  const [activeTab, setActiveTab] = useState<TabType>('color')
  const [showNotification, setShowNotification] = useState(false)

  // Resolver rol activo consistente con el resto del sistema
  const activeRole = (() => {
    try {
      const stored = localStorage.getItem('sigap_active_role')
      if (stored) {
        const parsed = JSON.parse(stored)
        return parsed.nombre_rol?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || ''
      }
    } catch { /* ignore */ }
    return user?.roles?.toLowerCase() || ''
  })()

  const layoutRol: 'planeacion' | 'director' | 'docente' | 'consultor' =
    activeRole.includes('director') ? 'director'
    : activeRole.includes('planeacion') || activeRole.includes('admin') ? 'planeacion'
    : activeRole.includes('consultor') ? 'consultor'
    : 'docente'

  const roleNameFormatted =
    layoutRol === 'director' ? 'Director de Programa'
    : layoutRol === 'planeacion' ? 'Planeación Institucional'
    : layoutRol === 'consultor' ? 'Consultor / Auditor'
    : 'Docente'

  const handleSave = () => {
    setShowNotification(true)
    setTimeout(() => {
      setShowNotification(false)
    }, 3500)
  }

  const handleReset = () => {
    resetSettings()
    setShowNotification(true)
    setTimeout(() => {
      setShowNotification(false)
    }, 3000)
  }

  const colorFilterOptions: {
    id: ColorFilter
    title: string
    description: string
    icon: ReactNode
    previewBg: string
    badge: string
  }[] = [
    {
      id: 'normal',
      title: 'Estándar Institucional',
      description: 'Colores originales y paleta predeterminada del SIGAP CESMAG.',
      icon: <Sun className="w-5 h-5 text-amber-500" />,
      previewBg: 'bg-gradient-to-r from-blue-600 via-emerald-500 to-amber-400',
      badge: 'Por defecto'
    },
    {
      id: 'grayscale',
      title: 'Escala de Grises',
      description: 'Elimina la saturación. Ideal si te molestan los colores brillantes o sufres de fatiga visual.',
      icon: <Contrast className="w-5 h-5 text-gray-600" />,
      previewBg: 'bg-gradient-to-r from-gray-700 via-gray-400 to-gray-200',
      badge: 'Cero saturación'
    },
    {
      id: 'warm',
      title: 'Descanso Visual (Luz Cálida)',
      description: 'Aplica un filtro ámbar suave que reduce la luz azul en jornadas extensas de revisión de agendas.',
      icon: <Coffee className="w-5 h-5 text-amber-700" />,
      previewBg: 'bg-gradient-to-r from-amber-800 via-amber-600 to-yellow-200',
      badge: 'Anti-fatiga'
    },
    {
      id: 'high-contrast',
      title: 'Alto Contraste',
      description: 'Intensifica la definición de bordes y textos para facilitar la lectura con baja visión.',
      icon: <Sparkles className="w-5 h-5 text-indigo-600" />,
      previewBg: 'bg-gradient-to-r from-black via-blue-900 to-yellow-400',
      badge: 'Alto contraste'
    },
    {
      id: 'inverted',
      title: 'Inversión de Contraste',
      description: 'Fondo oscuro con texto invertido para trabajar en ambientes de iluminación muy tenue.',
      icon: <Moon className="w-5 h-5 text-purple-600" />,
      previewBg: 'bg-gradient-to-r from-zinc-900 via-slate-800 to-neutral-700',
      badge: 'Fondo oscuro'
    }
  ]

  const fontSizeOptions: { id: FontSize; label: string; sublabel: string }[] = [
    { id: 'normal', label: 'A', sublabel: 'Normal (100%)' },
    { id: 'large', label: 'A+', sublabel: 'Grande (112%)' },
    { id: 'xlarge', label: 'A++', sublabel: 'Muy grande (125%)' }
  ]

  // Resumen del estado actual para mostrar en las pestañas
  const colorNameCurrent =
    settings.colorFilter === 'grayscale' ? 'Escala de Grises'
    : settings.colorFilter === 'warm' ? 'Descanso Visual'
    : settings.colorFilter === 'high-contrast' ? 'Alto Contraste'
    : settings.colorFilter === 'inverted' ? 'Invertido'
    : 'Estándar'

  const fontSizeCurrent =
    settings.fontSize === 'xlarge' ? '125%'
    : settings.fontSize === 'large' ? '112%'
    : '100%'

  const tabs: {
    id: TabType
    label: string
    icon: ReactNode
    badge: string
    description: string
  }[] = [
    {
      id: 'color',
      label: 'Filtros y Color',
      icon: <Eye className="w-4 h-4" />,
      badge: colorNameCurrent,
      description: 'Escala de grises, luz cálida, alto contraste'
    },
    {
      id: 'text',
      label: 'Texto y Lectura',
      icon: <Type className="w-4 h-4" />,
      badge: fontSizeCurrent,
      description: 'Tamaño de fuente y espaciado dislexia'
    },
    {
      id: 'motion',
      label: 'Movimiento y Foco',
      icon: <Sliders className="w-4 h-4" />,
      badge: settings.reducedMotion ? 'Sin animaciones' : 'Normal',
      description: 'Reducción de movimiento y foco visible'
    },
    {
      id: 'shortcuts',
      label: 'Atajos de Teclado',
      icon: <Keyboard className="w-4 h-4" />,
      badge: '6 Atajos',
      description: 'Navegación rápida sin ratón'
    }
  ]

  return (
    <Layout rol={layoutRol} path="Ajustes / Centro de Accesibilidad">
      <div className="max-w-5xl mx-auto space-y-5 pb-8">

        {/* Encabezado Compacto */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full mb-2 border border-blue-100">
                <ShieldCheck className="w-3.5 h-3.5" />
                Accesibilidad e Inclusión
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Centro de Accesibilidad
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Personaliza los colores, tamaño de texto y navegación para trabajar con mayor comodidad.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 font-medium">
                {roleNameFormatted}
              </span>
            </div>
          </div>
        </div>

        {/* Toast Notificación flotante de confirmación */}
        {showNotification && (
          <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <p className="text-xs sm:text-sm font-medium">
                {isDefault
                  ? 'Se han restaurado los valores estándar del sistema.'
                  : '¡Preferencias aplicadas y guardadas correctamente!'}
              </p>
            </div>
            <button
              onClick={() => setShowNotification(false)}
              className="text-white/80 hover:text-white text-xs underline font-medium"
            >
              Entendido
            </button>
          </div>
        )}

        {/* BARRA DE PESTAÑAS / SECCIONES (Todo visible al entrar sin desplazarse) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`p-3.5 sm:p-4 rounded-xl border-2 text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                  isActive
                    ? 'border-blue-600 bg-white shadow-sm ring-2 ring-blue-500/10'
                    : 'border-gray-200 bg-gray-50/70 hover:bg-white hover:border-gray-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div
                      className={`p-1.5 rounded-lg ${
                        isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-200/70 text-gray-600'
                      }`}
                    >
                      {tab.icon}
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-blue-100 text-blue-800 font-bold'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  </div>
                  <h3
                    className={`text-xs sm:text-sm font-bold truncate ${
                      isActive ? 'text-blue-900' : 'text-gray-800'
                    }`}
                  >
                    {tab.label}
                  </h3>
                </div>
                <p className="text-[11px] text-gray-500 mt-1 line-clamp-1 hidden sm:block">
                  {tab.description}
                </p>
                {isActive && (
                  <div className="w-full h-0.5 bg-blue-600 rounded-full mt-2" />
                )}
              </button>
            )
          })}
        </div>

        {/* CONTENIDO DE LA SECCIÓN ACTIVA (Panel modular sin scroll excesivo) */}
        <div className="bg-white rounded-2xl p-5 sm:p-7 border border-gray-200 shadow-sm min-h-[380px]">

          {/* 1. FILTROS Y COLOR */}
          {activeTab === 'color' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-blue-600" />
                    Modo de Confort Visual y Filtros de Color
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Elige el modo visual que prefieras. El cambio se refleja de forma instantánea en toda la aplicación.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg hidden sm:inline-block">
                  Activo: {colorNameCurrent}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {colorFilterOptions.map((opt) => {
                  const isSelected = settings.colorFilter === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateSetting('colorFilter', opt.id)}
                      className={`p-4 rounded-xl text-left border-2 transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/40 shadow-sm ring-2 ring-blue-500/15'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      <div>
                        <div className={`h-2.5 w-full rounded-full mb-3 ${opt.previewBg} shadow-inner opacity-90`} />
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            {opt.icon}
                            <h3 className="font-bold text-gray-900 text-xs sm:text-sm">{opt.title}</h3>
                          </div>
                          {isSelected && (
                            <span className="p-0.5 bg-blue-600 text-white rounded-full">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {opt.description}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                        <span className="font-semibold text-blue-700">
                          {isSelected ? '✓ Activado' : 'Seleccionar'}
                        </span>
                        <span className="text-gray-400">{opt.badge}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 2. TEXTO Y LECTURA */}
          {activeTab === 'text' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Type className="w-5 h-5 text-blue-600" />
                    Tamaño de Texto y Espaciado de Lectura
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Ajusta la escala tipográfica para no forzar la vista durante la revisión de agendas y evidencias.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tamaño de fuente */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
                    Escala Tipográfica del Sistema
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {fontSizeOptions.map((f) => {
                      const isSelected = settings.fontSize === f.id
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => updateSetting('fontSize', f.id)}
                          className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'border-blue-600 bg-white text-blue-700 font-bold shadow-sm'
                              : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                          }`}
                        >
                          <span className="text-xl font-black mb-0.5">{f.label}</span>
                          <span className="text-[11px] text-gray-600">{f.sublabel}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Switch de lectura amigable / dislexia */}
                <div
                  onClick={() => updateSetting('dyslexiaFriendly', !settings.dyslexiaFriendly)}
                  className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                    settings.dyslexiaFriendly
                      ? 'border-blue-600 bg-blue-50/40'
                      : 'border-gray-200 bg-gray-50 hover:bg-white'
                  }`}
                >
                  <div className="pr-3">
                    <span className="font-bold text-xs sm:text-sm text-gray-900 block mb-1">
                      Espaciado de lectura amigable
                    </span>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Aumenta el interletreado y separación entre líneas para personas con dislexia o fatiga visual.
                    </p>
                  </div>
                  <div
                    className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                      settings.dyslexiaFriendly ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5 left-0.5 ${
                        settings.dyslexiaFriendly ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Muestra previa interactiva */}
              <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-100">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  Muestra en tiempo real de tus ajustes tipográficos:
                </div>
                <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-sm space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900 text-sm">Asignación: Investigación Aplicada II</span>
                    <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                      Aprobada • 6 Horas
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Así se leerán los textos en tablas, reportes consolidados y observaciones dentro del SIGAP.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. MOVIMIENTO Y ENFOQUE */}
          {activeTab === 'motion' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-emerald-600" />
                    Movimiento, Estabilidad y Foco por Teclado
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Previene mareos por transiciones continuas y facilita la navegación para usuarios con teclado.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Reducir animaciones */}
                <div
                  onClick={() => updateSetting('reducedMotion', !settings.reducedMotion)}
                  className={`p-4 rounded-xl border-2 transition-all flex items-start justify-between cursor-pointer ${
                    settings.reducedMotion
                      ? 'border-emerald-600 bg-emerald-50/40'
                      : 'border-gray-200 bg-gray-50 hover:bg-white'
                  }`}
                >
                  <div className="pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-xs sm:text-sm text-gray-900">Reducir animaciones</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Desactiva transiciones y efectos de rebote para personas con sensibilidad vestibular o equipos de menor rendimiento.
                    </p>
                  </div>
                  <div
                    className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                      settings.reducedMotion ? 'bg-emerald-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5 left-0.5 ${
                        settings.reducedMotion ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>

                {/* Resaltado de foco */}
                <div
                  onClick={() => updateSetting('focusHighlight', !settings.focusHighlight)}
                  className={`p-4 rounded-xl border-2 transition-all flex items-start justify-between cursor-pointer ${
                    settings.focusHighlight
                      ? 'border-emerald-600 bg-emerald-50/40'
                      : 'border-gray-200 bg-gray-50 hover:bg-white'
                  }`}
                >
                  <div className="pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <MousePointer className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-xs sm:text-sm text-gray-900">Resaltado de foco visible</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Muestra un contorno azul nítido alrededor de botones y casillas activas al presionar la tecla Tab.
                    </p>
                  </div>
                  <div
                    className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                      settings.focusHighlight ? 'bg-emerald-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5 left-0.5 ${
                        settings.focusHighlight ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. ATAJOS DE TECLADO */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Keyboard className="w-5 h-5 text-amber-600" />
                    Guía Rápida de Atajos de Navegación Accesible
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Permite navegar e interactuar con el sistema fluidamente sin depender del ratón.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                  <div className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-gray-700 font-mono shadow-xs">Tab</kbd>
                  </div>
                  <p className="text-gray-500">Avanza al siguiente botón o campo editable.</p>
                </div>
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                  <div className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-gray-700 font-mono shadow-xs">Shift + Tab</kbd>
                  </div>
                  <p className="text-gray-500">Retrocede al elemento anterior.</p>
                </div>
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                  <div className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-gray-700 font-mono shadow-xs">Enter</kbd> o <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-gray-700 font-mono shadow-xs">Espacio</kbd>
                  </div>
                  <p className="text-gray-500">Activa botones, enlaces o casillas seleccionadas.</p>
                </div>
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                  <div className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-gray-700 font-mono shadow-xs">Esc</kbd>
                  </div>
                  <p className="text-gray-500">Cierra modales, menús y diálogos emergentes.</p>
                </div>
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                  <div className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-gray-700 font-mono shadow-xs">Flechas ↑ / ↓</kbd>
                  </div>
                  <p className="text-gray-500">Desplaza listas y opciones desplegables.</p>
                </div>
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                  <div className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-gray-700 font-mono shadow-xs">Ctrl + F</kbd>
                  </div>
                  <p className="text-gray-500">Búsqueda rápida en tablas y listas del sistema.</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* BARRA DE ACCIÓN INFERIOR (Siempre accesible en pantalla) */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Las preferencias se sincronizan automáticamente en tu navegador.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleReset}
              disabled={isDefault}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer w-full sm:w-auto ${
                isDefault
                  ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 shadow-sm'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restablecer valores
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-sm shadow-blue-200 cursor-pointer w-full sm:w-auto"
            >
              <Check className="w-4 h-4" />
              Confirmar ajustes
            </button>
          </div>
        </div>

      </div>
    </Layout>
  )
}
