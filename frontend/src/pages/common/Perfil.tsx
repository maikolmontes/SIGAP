import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/common/Layout'

export default function Perfil() {
    const { user } = useAuth();

    // Fallback: Asumimos rol actual por el token para que Layout dibuje el Sidebar correcto
    const isDirector = user?.roles?.toLowerCase().includes('director');
    const layoutRol = isDirector ? 'director' : 'planeacion';

    return (
        <Layout rol={layoutRol} path="Ajustes / Mi Perfil">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-10 max-w-4xl mx-auto mt-4 sm:mt-8">
                <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
                    <div className="flex-shrink-0 relative">
                        {user?.imagen_perfil ? (
                            <img
                                src={user.imagen_perfil}
                                alt="Perfil"
                                className="w-28 h-28 sm:w-36 sm:h-36 rounded-full shadow-lg object-cover ring-4 ring-gray-50"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center text-blue-600 text-5xl font-bold shadow-lg ring-4 ring-gray-50">
                                {user?.nombres ? user.nombres.charAt(0) : 'U'}
                            </div>
                        )}
                        <span className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-4 border-white rounded-full" title="Activo"></span>
                    </div>

                    <div className="flex-1 text-center sm:text-left">
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">
                            {user?.nombres || 'Usuario Institucional'} {user?.apellidos || ''}
                        </h1>
                        <p className="text-gray-500 text-sm sm:text-base flex items-center justify-center sm:justify-start gap-2 mb-4 font-medium">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            {user?.correo || 'Cargando correo...'}
                        </p>

                        <div className="inline-flex bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-semibold border border-indigo-100 shadow-sm">
                            {user?.roles || 'Rol no definido'}
                        </div>
                    </div>
                </div>

                <div className="mt-10 sm:mt-12 pt-8 border-t border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-5">Seguridad y Acceso</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Estado de Cuenta</p>
                                    <p className="font-bold text-gray-900">Validada y Activa</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Método de Ingreso</p>
                                    <p className="font-bold text-gray-900">Google Workspace (SSO)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    )
}
