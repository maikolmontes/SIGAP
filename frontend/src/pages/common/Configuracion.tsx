import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/common/Layout'

export default function Configuracion() {
    const { user } = useAuth();
    const isDirector = user?.roles?.toLowerCase().includes('director');
    const layoutRol = isDirector ? 'director' : 'planeacion';

    return (
        <Layout rol={layoutRol} path="Ajustes / Configuración">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 sm:p-12 max-w-4xl mx-auto mt-4 sm:mt-8 flex flex-col items-center justify-center text-center">
                <div className="p-4 bg-gray-50 rounded-full mb-6">
                    <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Configuración del Sistema</h2>
                <p className="text-gray-500 max-w-md mx-auto">
                    Este panel de configuración estará disponible en futuras actualizaciones.
                    Actualmente sus credenciales e información esencial están bloqueadas en lectura.
                </p>
                <div className="mt-8 flex gap-3">
                    <button disabled className="px-5 py-2 bg-gray-100 text-gray-400 font-medium rounded-lg cursor-not-allowed">Guardar cambios</button>
                    <button disabled className="px-5 py-2 border border-gray-200 text-gray-400 font-medium rounded-lg cursor-not-allowed">Restablecer valores</button>
                </div>
            </div>
        </Layout>
    )
}
