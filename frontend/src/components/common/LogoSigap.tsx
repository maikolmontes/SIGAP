import { useId } from 'react'

/**
 * Logo de SIGAP: una agenda (hoja de calendario con argollas) con una insignia
 * de verificación. Representa la agenda docente y su seguimiento y aprobación.
 * Es un SVG en línea: nítido a cualquier tamaño y sin pedir otro archivo.
 * El mismo dibujo está en public/logo_sigap.svg.
 */
export default function LogoSigap({ className = 'h-14 w-14' }: { className?: string }) {
    const id = useId() // cada instancia necesita su propio id de degradado
    return (
        <svg
            className={className}
            viewBox="0 0 64 64"
            role="img"
            aria-label="SIGAP"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id={`${id}-fondo`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#0f1f4b" />
                    <stop offset="1" stopColor="#1d4ed8" />
                </linearGradient>
            </defs>
            <rect width="64" height="64" rx="16" fill={`url(#${id}-fondo)`} />
            {/* Hoja de la agenda */}
            <rect x="13" y="16" width="38" height="36" rx="6" fill="#ffffff" />
            <path d="M13 22a6 6 0 0 1 6-6h26a6 6 0 0 1 6 6v5H13z" fill="#67e8f9" />
            {/* Argollas */}
            <rect x="20" y="11" width="5" height="11" rx="2.5" fill="#ffffff" stroke="#0f1f4b" strokeWidth="1.5" />
            <rect x="39" y="11" width="5" height="11" rx="2.5" fill="#ffffff" stroke="#0f1f4b" strokeWidth="1.5" />
            {/* Días */}
            <g fill="#bfdbfe">
                <rect x="19" y="33" width="5" height="5" rx="1.5" />
                <rect x="29" y="33" width="5" height="5" rx="1.5" />
                <rect x="39" y="33" width="5" height="5" rx="1.5" />
                <rect x="19" y="42" width="5" height="5" rx="1.5" />
                <rect x="29" y="42" width="5" height="5" rx="1.5" />
            </g>
            {/* Insignia de verificación */}
            <circle cx="46" cy="46" r="11" fill="#00a896" />
            <path d="M40.5 46.5l4 4 7-8" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}
