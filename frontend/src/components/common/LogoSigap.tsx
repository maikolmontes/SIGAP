/**
 * Logo de SIGAP (public/logo_sigap.png, versión reducida de LOGOSIGAP.png).
 * Se pide a tamaño 192×171 y se muestra a la altura que indique la clase:
 * conserva la proporción, así que basta con dar el alto (h-16, h-12...).
 */
export default function LogoSigap({ className = 'h-16 w-auto' }: { className?: string }) {
    return (
        <img
            src="/logo_sigap.png"
            alt="SIGAP"
            width={192}
            height={171}
            className={`object-contain ${className}`}
        />
    )
}
