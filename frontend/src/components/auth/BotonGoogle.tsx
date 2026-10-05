import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';

/**
 * Botón "Continuar con Google". Se carga aparte del resto de la pantalla de login
 * (React.lazy) y solo después de pintar la página: el script de Google Sign-In
 * pesa ~100 KiB y, cargado desde el inicio, compite con el primer pintado en
 * celulares lentos. El proveedor vive aquí porque es lo único que lo usa.
 */
export default function BotonGoogle({
    onSuccess,
    onError,
}: {
    onSuccess: (respuesta: CredentialResponse) => void;
    onError: () => void;
}) {
    return (
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
            <GoogleLogin
                onSuccess={onSuccess}
                onError={onError}
                theme="outline"
                size="large"
                shape="rectangular"
                text="continue_with"
            />
        </GoogleOAuthProvider>
    );
}
